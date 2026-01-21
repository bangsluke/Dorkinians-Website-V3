import { neo4jService } from "../../netlify/functions/lib/neo4j.js";
import { findMetricByAlias, getMetricDisplayName } from "../config/chatbotMetrics";
import { getZeroStatResponse } from "./zeroStatResponses";
import { statObject, VisualizationType } from "../../config/config";
import { getAppropriateVerb, getResponseTemplate, formatNaturalResponse } from "../config/naturalLanguageResponses";
import { EnhancedQuestionAnalyzer, EnhancedQuestionAnalysis } from "../config/enhancedQuestionAnalysis";
import { EntityNameResolver } from "./entityNameResolver";
import { loggingService } from "./loggingService";
import { spellingCorrector } from "./spellingCorrector";
import { unansweredQuestionLogger } from "./unansweredQuestionLogger";
import { conversationContextManager } from "./conversationContextManager";
import { questionSimilarityMatcher } from "./questionSimilarityMatcher";
import { queryProfiler } from "./queryProfiler";
import { errorHandler } from "./errorHandler";
import { responseTemplateManager } from "./responseTemplates";
import type { LeagueTableEntry } from "./leagueTableService";
import { PlayerQueryBuilder } from "./queryBuilders/playerQueryBuilder";
import { ResponseBuilder } from "./responseBuilder";
import { FormattingUtils } from "./chatbotUtils/formattingUtils";
import { DateUtils } from "./chatbotUtils/dateUtils";
import { TeamMappingUtils } from "./chatbotUtils/teamMappingUtils";
import { PlayerDataQueryHandler } from "./queryHandlers/playerDataQueryHandler";
import { TeamDataQueryHandler } from "./queryHandlers/teamDataQueryHandler";
import { ClubDataQueryHandler } from "./queryHandlers/clubDataQueryHandler";
import { FixtureDataQueryHandler } from "./queryHandlers/fixtureDataQueryHandler";
import { RankingQueryHandler } from "./queryHandlers/rankingQueryHandler";
import { TemporalQueryHandler } from "./queryHandlers/temporalQueryHandler";
import { LeagueTableQueryHandler } from "./queryHandlers/leagueTableQueryHandler";
import { AwardsQueryHandler } from "./queryHandlers/awardsQueryHandler";
import { RelationshipQueryHandler } from "./queryHandlers/relationshipQueryHandler";
import type { ChatbotResponse, QuestionContext, ProcessingDetails, PlayerData, TeamData, StreakData, CoPlayerData, OpponentData, RankingData } from "./types/chatbotTypes";

// Re-export types for use in route handlers and components
export type { QuestionContext, ChatbotResponse };

export class ChatbotService {
	private static instance: ChatbotService;
	private entityResolver: EntityNameResolver;

	// Debug and tracking properties
	public lastQuestionAnalysis: EnhancedQuestionAnalysis | null = null;
	public lastExecutedQueries: string[] = [];
	public lastProcessingSteps: string[] = [];
	public lastQueryBreakdown: Record<string, unknown> | null = null;

	// Caching properties
	private queryCache: Map<string, { data: unknown; timestamp: number }> = new Map();
	private readonly CACHE_TTL: number = 5 * 60 * 1000; // 5 minutes
	private readonly ENABLE_QUERY_PROFILING = process.env.ENABLE_QUERY_PROFILING === "true";

	private constructor() {
		this.entityResolver = EntityNameResolver.getInstance();
	}

	public static getInstance(): ChatbotService {
		if (!ChatbotService.instance) {
			ChatbotService.instance = new ChatbotService();
		}
		return ChatbotService.instance;
	}


	// Resolve player name using fuzzy matching
	private async resolvePlayerName(playerName: string): Promise<string | null> {
		try {
			const result = await this.entityResolver.resolveEntityName(playerName, "player");

			if (result.exactMatch) {
				this.logToBoth(`✅ Exact match found: ${playerName} → ${result.exactMatch}`, null, "log");
				return result.exactMatch;
			}

			if (result.fuzzyMatches.length > 0) {
				const bestMatch = result.fuzzyMatches[0];
				this.logToBoth(
					`🔍 Fuzzy match found: ${playerName} → ${bestMatch.entityName} (confidence: ${bestMatch.confidence.toFixed(2)})`,
					null,
					"log",
				);
				return bestMatch.entityName;
			}

			this.logToBoth(`❌ No match found for player: ${playerName}`, null, "warn");
			return null;
		} catch (error) {
			this.logToBoth(`❌ Error resolving player name: ${error}`, null, "error");
			return null;
		}
	}


	// Helper method to log to both server and client consoles
	private logToBoth(message: string, data?: unknown, level: "log" | "warn" | "error" = "log"): void {
		loggingService.log(message, data, level);
	}

	// Helper method for minimal logging (always shown)
	private logMinimal(message: string, data?: unknown, level: "log" | "warn" | "error" = "log"): void {
		loggingService.logMinimal(message, data, level);
	}

	// Execute a query with optional profiling for slow queries
	private async executeQueryWithProfiling(
		query: string,
		params: Record<string, unknown> = {},
	): Promise<unknown> {
		const startTime = Date.now();

		try {
			const result = await neo4jService.executeQuery(query, params);
			const executionTime = Date.now() - startTime;

			// Profile slow queries or if profiling is enabled
			if (this.ENABLE_QUERY_PROFILING || executionTime > 1000) {
				const { profile } = await queryProfiler.executeWithProfiling(query, params, true);
				if (profile) {
					this.logToBoth(
						`⏱️ Query executed in ${executionTime}ms${profile.optimizationSuggestions?.length ? ` - Suggestions: ${profile.optimizationSuggestions.join(", ")}` : ""}`,
						null,
						executionTime > 2000 ? "warn" : "log",
					);
				}
			}

			return result;
		} catch (error) {
			const executionTime = Date.now() - startTime;
			this.logToBoth(`❌ Query failed after ${executionTime}ms: ${error}`, null, "error");
			throw error;
		}
	}


	private calculateWeekendDates(year: number, ordinal: number = 1): { startDate: string; endDate: string } {
		// Find first Saturday of the year
		const jan1 = new Date(year, 0, 1);
		const dayOfWeek = jan1.getDay(); // 0=Sunday, 6=Saturday
		const daysToFirstSaturday = dayOfWeek === 6 ? 0 : (6 - dayOfWeek);
		const firstSaturday = new Date(year, 0, 1 + daysToFirstSaturday);
		
		// For ordinal weekends, add 7 * (ordinal - 1) days
		const weekendStart = new Date(firstSaturday);
		weekendStart.setDate(weekendStart.getDate() + 7 * (ordinal - 1));
		const weekendEnd = new Date(weekendStart);
		weekendEnd.setDate(weekendEnd.getDate() + 1); // Sunday
		
		// Format as YYYY-MM-DD
		const formatDate = (date: Date): string => {
			const yyyy = date.getFullYear();
			const mm = String(date.getMonth() + 1).padStart(2, "0");
			const dd = String(date.getDate()).padStart(2, "0");
			return `${yyyy}-${mm}-${dd}`;
		};
		
		return {
			startDate: formatDate(weekendStart),
			endDate: formatDate(weekendEnd),
		};
	}

	private isTeamCountQuestion(question?: string): boolean {
		if (!question) return false;
		const q = question.toLowerCase();
		const mentionsClubTeams =
			q.includes("how many of the club's teams") ||
			q.includes("how many of the clubs teams") ||
			q.includes("how many of the club teams") ||
			q.includes("how many of the club's team") ||
			q.includes("how many of the clubs team") ||
			q.includes("how many of the club team") ||
			q.includes("how many of the teams has") ||
			q.includes("how many of the teams have");

		const genericHowManyTeams = q.includes("how many teams") || q.includes("how many team");
		const mentionsPlayed = q.includes("played for") || q.includes("played in");

		return (mentionsClubTeams && mentionsPlayed) || (genericHowManyTeams && mentionsPlayed);
	}

	async processQuestion(context: QuestionContext): Promise<ChatbotResponse> {
		// Clear debug tracking for new question
		this.lastQuestionAnalysis = null;
		this.lastExecutedQueries = [];
		this.lastProcessingSteps = [];
		this.lastQueryBreakdown = null;

		// Essential logging for debugging
		this.logMinimal(`🤖 Using chatbot service for: ${context.question}`, null, "log");

		let originalQuestion = context.question;
		let correctedQuestion: string | undefined;

		try {
			// Ensure Neo4j connection before any database-dependent operations
			const connected = await neo4jService.connect();
			if (!connected) {
				console.error("❌ Neo4j connection failed in production");
				return {
					answer: "I'm sorry, I'm unable to access the club's database at the moment due to a network issue. Please try again later.",
					sources: [],
				};
			}

			// Apply spelling correction after connection is established
			const spellingResult = await spellingCorrector.correctSpelling(context.question);
			if (spellingResult.corrected !== context.question && spellingResult.corrections.length > 0) {
				correctedQuestion = spellingResult.corrected;
				context.question = correctedQuestion;
				this.logToBoth(`🔤 Spelling corrections applied: ${spellingResult.corrections.map(c => `${c.original} → ${c.corrected}`).join(", ")}`, null, "log");
			}

			// Handle "full stats" question with special response
			const fullStatsPattern = /\b(full|all|complete|entire|whole)\s+stats?\b/i;
			if (fullStatsPattern.test(context.question)) {
				const playerName = context.userContext || "you";
				return {
					answer: `You can view your complete player statistics on the Player Stats page. Click the link below to navigate there.`,
					sources: [],
					visualization: undefined,
					debug: {
						question: context.question,
						userContext: context.userContext,
						timestamp: new Date().toISOString(),
						serverLogs: `Special handling for full stats question`,
						processingDetails: {
							questionAnalysis: null,
							cypherQueries: [],
							processingSteps: ["Detected full stats question, returning navigation response"],
							queryBreakdown: null,
						},
					},
				};
			}

			// Use the question directly (removed clarification handling that combined questions)
			let questionToProcess = context.question;

			// Analyze the question
			let analysis = await this.analyzeQuestion(questionToProcess, context.userContext);
			
			// Merge conversation context if session ID provided
			if (context.sessionId) {
				analysis = await conversationContextManager.mergeContext(context.sessionId, analysis);
				// Update questionToProcess to use the merged question from analysis if it was merged
				if (analysis.question !== questionToProcess) {
					questionToProcess = analysis.question;
				}
			}
			
			this.lastQuestionAnalysis = analysis; // Store for debugging

			// Check for streak questions BEFORE clarification check - These questions might be flagged for clarification but should be handled as streak queries
			const questionLower = questionToProcess.toLowerCase();
			
			// Check for consecutive weekends questions
			const isConsecutiveWeekendsQuestion = 
				(questionLower.includes("consecutive") && (questionLower.includes("weekend") || questionLower.includes("weekends"))) ||
				(questionLower.includes("longest") && questionLower.includes("consecutive") && (questionLower.includes("weekend") || questionLower.includes("weekends")));
			
			// Check for consecutive goal involvement questions
			const isConsecutiveGoalInvolvementQuestion = 
				(questionLower.includes("consecutive") && questionLower.includes("games") && 
				(questionLower.includes("scored") || questionLower.includes("assisted") || 
				questionLower.includes("goal involvement") || questionLower.includes("goals involvement"))) ||
				(questionLower.includes("how many") && questionLower.includes("consecutive") && 
				(questionLower.includes("scored") || questionLower.includes("assisted") || 
				questionLower.includes("goal involvement") || questionLower.includes("goals involvement")));

			// Handle clarification needed case (only set if explicitly needed, not pre-emptively)
			// Note: Clarification will be requested post-query if no data is found
			if (analysis.type === "clarification_needed") {
				// CRITICAL: Only block queries if clarification is actually needed (partial names)
				// Full names should proceed even if they don't match userContext
				// Check if the clarification is for a partial name or a full name
				const playerEntities = analysis.extractionResult?.entities?.filter(ent => ent.type === "player") || [];
				const hasFullName = playerEntities.some((e) => {
					let originalText = e.originalText.toLowerCase().trim().replace(/\s*\(resolved to:.*?\)$/i, "").trim();
					// Deduplicate repeating phrase patterns
					const words = originalText.split(/\s+/);
					if (words.length >= 4) {
						const midPoint = Math.floor(words.length / 2);
						const firstHalf = words.slice(0, midPoint).join(" ");
						const secondHalf = words.slice(midPoint).join(" ");
						if (firstHalf === secondHalf) {
							originalText = firstHalf;
						}
					}
					return originalText.includes(" ") && originalText.split(/\s+/).length >= 2;
				});
				
				// If we have a full name, proceed with the query even if type is "clarification_needed"
				// This allows queries about other players to proceed
				if (hasFullName) {
					// Don't block the query - proceed with the extracted name
					// Continue to query execution below
				} else {
					// Partial name - require clarification
					// Store pending clarification if we have a session ID
					if (context.sessionId) {
						const clarificationMessage = analysis.clarificationMessage || analysis.message || "Please clarify your question.";
						// Extract partial name from clarification message if it's a partial name clarification
						let partialName: string | undefined = undefined;
						if (clarificationMessage.includes("Please provide clarification on who")) {
							const match = clarificationMessage.match(/who (\w+) is/);
							if (match) {
								partialName = match[1];
							}
						}
						conversationContextManager.setPendingClarification(context.sessionId, context.question, clarificationMessage, analysis, partialName, context.userContext);
					}
					
					// If there's an explicit clarification message, use it regardless of confidence
					const clarificationMessage = analysis.clarificationMessage || analysis.message;
					if (clarificationMessage) {
						return {
							answer: clarificationMessage,
							sources: [],
							answerValue: "Clarification needed",
						};
					}
					
					// Try to provide a better fallback response if no explicit clarification message
					if (analysis.confidence !== undefined && analysis.confidence < 0.5) {
						const fallbackResponse = questionSimilarityMatcher.generateFallbackResponse(context.question, analysis);
						return {
							answer: fallbackResponse,
							sources: [],
							answerValue: "Clarification needed",
						};
					}
					return {
						answer: "Please clarify your question.",
						sources: [],
						answerValue: "Clarification needed",
					};
				}
			}

			// Create detailed breakdown for debugging
			const statEntity = analysis.metrics[0] || "None";
			const metricConfig = statEntity !== "None" ? statObject[statEntity as keyof typeof statObject] : null;
			const numberDecimalPlaces = metricConfig && typeof metricConfig === "object" && "numberDecimalPlaces" in metricConfig
				? (metricConfig.numberDecimalPlaces as number)
				: 0;
			
			this.lastQueryBreakdown = {
				playerName: context.userContext || "None",
				team: analysis.entities.find((e) => /\d+(?:st|nd|rd|th)?/.test(e)) || "None",
				statEntity: statEntity,
				questionType: analysis.type,
				extractedEntities: analysis.entities,
				extractedMetrics: analysis.metrics,
				numberDecimalPlaces: numberDecimalPlaces,
			};

			// Debug logging for complex queries
			if (analysis.complexity === "complex" || analysis.metrics.length > 1) {
				this.logToBoth(`🔍 Complex query - Type: ${analysis.type}, Metrics: ${analysis.metrics.join(", ")}`, null, "log");
			}

			// Query the database
			this.lastProcessingSteps.push(`Building Cypher query for analysis: ${analysis.type}`);
			const data = await this.queryRelevantData(analysis, context.userContext);
			this.lastProcessingSteps.push(`Query completed, result type: ${data?.type || "null"}`);

			// Generate the response (use original question for response generation, but processed question was used for analysis) - Pass userContext and sessionId so it can be used for post-query clarification checks
			const response = await this.generateResponse(questionToProcess, data, analysis, context.userContext, context.sessionId);

			// Store in conversation context if session ID provided - Use the processed question (which may be combined with clarification) for history
			if (context.sessionId) {
				conversationContextManager.addToHistory(context.sessionId, questionToProcess, analysis);
			}

			// Log unanswered questions (fire-and-forget, non-blocking)
			const shouldLog = response.answer === "I couldn't find relevant information for your question.";

			if (shouldLog) {
				unansweredQuestionLogger.log({
					originalQuestion,
					correctedQuestion,
					analysis,
					confidence: analysis.confidence,
					userContext: context.userContext,
				}).catch((err) => {
					console.error("❌ Failed to log unanswered question:", err);
				});
			}

			return response;
		} catch (error) {
			// Essential error logging
			this.logToBoth(`❌ Error: ${error instanceof Error ? error.message : String(error)} | Question: ${context.question}`, null, "error");
			if (error instanceof Error && error.stack) {
				this.logToBoth(`❌ Error stack: ${error.stack}`, null, "error");
			}

			// Use error handler for better error messages
			const errorObj = error instanceof Error ? error : new Error(String(error));
			const errorResponse = await errorHandler.generateErrorResponse(errorObj, {
				question: context.question,
				analysis: this.lastQuestionAnalysis || undefined,
			});

			// Get processing details even on error so we can see what happened
			const processingDetails = await this.getProcessingDetails();

			return {
				answer: errorResponse.message,
				sources: [],
				cypherQuery: "N/A",
				suggestions: errorResponse.suggestions,
				debug: {
					question: context.question,
					userContext: context.userContext,
					timestamp: new Date().toISOString(),
					serverLogs: this.lastExecutedQueries.join("\n"),
					processingDetails: {
						questionAnalysis: processingDetails.questionAnalysis,
						cypherQueries: processingDetails.cypherQueries,
						processingSteps: processingDetails.processingSteps,
						queryBreakdown: processingDetails.queryBreakdown,
						// Security: Only include error details in development mode
						error: process.env.NODE_ENV === 'development' 
							? (error instanceof Error ? error.message : String(error))
							: undefined,
						// Security: Never include stack traces in client responses
					},
				},
			};
		}
	}

	private async analyzeQuestion(question: string, userContext?: string): Promise<EnhancedQuestionAnalysis> {
		// Use enhanced question analysis
		const analyzer = new EnhancedQuestionAnalyzer(question, userContext);
		const enhancedAnalysis = await analyzer.analyze();

		return enhancedAnalysis;
	}

	// Check if clarification is needed after a query fails - This is called when the query returns "I couldn't find relevant information" to see if a player name mismatch might be the issue
	private checkPostQueryClarificationNeeded(
		analysis: EnhancedQuestionAnalysis,
		userContext?: string,
	): string | null {
		if (!userContext) {
			return null;
		}

		const extractionResult = analysis.extractionResult;
		if (!extractionResult) {
			return null;
		}

		const playerEntities = extractionResult.entities.filter((e) => e.type === "player");
		if (playerEntities.length === 0) {
			return null;
		}

		const selectedPlayerLower = userContext.toLowerCase().trim();

		// Check if any extracted player name partially matches the selected player - Use originalText to check the text before fuzzy matching resolved it
		for (const entity of playerEntities) {
			const originalText = entity.originalText.toLowerCase().trim();
			const cleanOriginalText = originalText.replace(/\s*\(resolved to:.*?\)$/i, "").trim();

			// Skip "I" references as they're handled separately
			if (cleanOriginalText === "i" || cleanOriginalText === "i've" || cleanOriginalText === "me" || cleanOriginalText === "my" || cleanOriginalText === "myself") {
				continue;
			}

			// Check if the original extracted text is contained in the selected player name - If it matches, no clarification needed
			if (selectedPlayerLower.includes(cleanOriginalText) && cleanOriginalText.length >= 2) {
				return null; // Partial match found, no clarification needed
			}
		}

		// No match found - check if we have non-I player entities that don't match
		const nonIPlayerEntities = playerEntities.filter((e) => {
			const originalText = e.originalText.toLowerCase().trim().replace(/\s*\(resolved to:.*?\)$/i, "").trim();
			return originalText !== "i" && 
				originalText !== "i've" && 
				originalText !== "me" && 
				originalText !== "my" && 
				originalText !== "myself";
		});

		if (nonIPlayerEntities.length > 0) {
			// Use originalText for the clarification message to show what was actually extracted
			// Deduplicate repeating phrase patterns (e.g., "Helder Freitas Helder Freitas" -> "Helder Freitas")
			const playerNames = nonIPlayerEntities.map((e) => {
				let originalText = e.originalText.replace(/\s*\(resolved to:.*?\)$/i, "").trim();
				// Remove duplicate phrase patterns
				const words = originalText.split(/\s+/);
				if (words.length >= 4) {
					const midPoint = Math.floor(words.length / 2);
					const firstHalf = words.slice(0, midPoint).join(" ");
					const secondHalf = words.slice(midPoint).join(" ");
					if (firstHalf === secondHalf) {
						originalText = firstHalf;
					} else {
						// Check for shorter repeating patterns
						for (let patternLen = 1; patternLen <= midPoint; patternLen++) {
							const pattern = words.slice(0, patternLen).join(" ");
							let matches = true;
							for (let i = patternLen; i < words.length; i += patternLen) {
								const segment = words.slice(i, i + patternLen).join(" ");
								if (segment !== pattern) {
									matches = false;
									break;
								}
							}
							if (matches && words.length % patternLen === 0) {
								originalText = pattern;
								break;
							}
						}
					}
				}
				return originalText;
			}).filter((name, index, self) => self.indexOf(name) === index); // Remove duplicate names

			// Only require clarification if the extracted name is a partial name (single word)
			// Full names (multiple words) should proceed without clarification, even if they don't match userContext
			const uniquePlayerNames = [...new Set(playerNames)];
			const hasFullName = uniquePlayerNames.some(name => name.includes(" ") && name.split(/\s+/).length >= 2);
			
			if (!hasFullName) {
				// All names are partial (single word) - require clarification
				const playerNamesStr = uniquePlayerNames.join(", ");
				// Check if it's a single first name (likely needs surname clarification)
				const isSingleFirstName = uniquePlayerNames.length === 1 && 
					!playerNamesStr.includes(" ") && 
					playerNamesStr.length > 0 && 
					playerNamesStr.length < 15; // Reasonable first name length

				if (isSingleFirstName) {
					return `Please clarify which ${playerNamesStr} you are asking about.`;
				}

				return `I found a player name "${playerNamesStr}" in your question, but it doesn't match the selected player "${userContext}". Please provide the full player name you're asking about, or confirm if you meant "${userContext}".`;
			}
			// Full name extracted - don't require clarification, proceed with the extracted name
		}

		return null;
	}

	private async queryRelevantData(analysis: EnhancedQuestionAnalysis, userContext?: string): Promise<Record<string, unknown> | null> {
		const { type, entities, metrics } = analysis;
		// Store original question (with original casing) before any normalization
		const originalQuestionWithCasing = analysis.question || "";
		// Store original question before normalization for detection
		const originalQuestionBeforeNormalization = analysis.question?.toLowerCase() || "";
		let question = originalQuestionBeforeNormalization;

		// Normalize apostrophes (curly to straight) for consistent pattern matching
		question = question.replace(/['']/g, "'");
		
		// Normalize colloquial phrases to standard terms
		// Replace colloquial goal-scoring verbs with "score"/"scored" for consistent detection
		question = question
			.replace(/\bbang(ed)?\s+in\b/g, (match, ed) => ed ? "scored" : "score")
			.replace(/\bbang\s+(?:in\s+)?goals?\b/g, "score goals")
			.replace(/\bput\s+away\b/g, "score")
			.replace(/\bput\s+away\s+goals?\b/g, "score goals")
			.replace(/\bnetted?\b/g, (match) => match === "netted" ? "scored" : "score")
			.replace(/\bnet(?:ted)?\s+goals?\b/g, "scored goals")
			.replace(/\bbagged?\b/g, (match) => match === "bagged" ? "scored" : "score")
			.replace(/\bbag(?:ged)?\s+goals?\b/g, "scored goals");
		
		// Update analysis with normalized question
		if (analysis.question) {
			analysis.question = question;
		}

		try {
			// Ensure Neo4j connection before querying
			const connected = await neo4jService.connect();
			if (!connected) {
				this.logToBoth("❌ Neo4j connection failed", null, "error");
				return null;
			}

			// Check if this is a "which team has fewest/most goals conceded" question - This needs to be checked before player routing to avoid misclassification
			// BUT: Exclude player-specific queries like "which team has [player] scored the most goals for?"
			const isPlayerSpecificTeamQuery = 
				(question.includes("which team") || question.includes("what team")) &&
				question.includes("most") &&
				question.includes("for") &&
				(analysis.entities && analysis.entities.length > 0 || 
				 // Also check for player name patterns in the question itself - "has [name] scored/made/played"
				 (question.includes("has") && (question.includes("scored") || question.includes("made") || question.includes("played"))));
			
			const isTeamConcededRankingQuestion = 
				(question.includes("which team") || question.includes("what team")) &&
				(question.includes("fewest") || question.includes("most") || question.includes("least") || question.includes("highest")) &&
				(question.includes("conceded") || question.includes("scored") || question.includes("goals")) &&
				!isPlayerSpecificTeamQuery;

			if (isTeamConcededRankingQuestion) {
				return await ClubDataQueryHandler.queryClubData(entities, metrics, analysis);
			}

			// Check for "how many players have scored exactly one goal in club history" questions
			const isPlayersExactlyOneGoalQuery = 
				(question.includes("how many players") || question.includes("how many player")) &&
				question.includes("scored") &&
				question.includes("exactly one goal") &&
				(question.includes("club history") || question.includes("history"));

			if (isPlayersExactlyOneGoalQuery) {
				this.lastProcessingSteps.push(`Detected players with exactly one goal in club history question, routing to ClubDataQueryHandler`);
				return await ClubDataQueryHandler.queryPlayersWithExactlyOneGoal();
			}

			// Check for penalty shootout questions
			const isPenaltyShootoutScoredQuery = 
				(question.includes("how many") || question.includes("what number")) &&
				question.includes("penalties") &&
				question.includes("scored") &&
				(question.includes("penalty shootout") || question.includes("shootout"));

			const isPenaltyShootoutMissedQuery = 
				(question.includes("how many") || question.includes("what number")) &&
				question.includes("penalties") &&
				question.includes("missed") &&
				(question.includes("shootout") || question.includes("penalty shootout"));

			const isPenaltyShootoutSavedQuery = 
				(question.includes("how many") || question.includes("what number")) &&
				question.includes("penalties") &&
				question.includes("saved") &&
				(question.includes("shootout") || question.includes("penalty shootout"));

			if (isPenaltyShootoutScoredQuery) {
				this.lastProcessingSteps.push(`Detected penalty shootout scored question, routing to ClubDataQueryHandler`);
				return await ClubDataQueryHandler.queryPenaltyShootoutPenaltiesScored();
			}

			if (isPenaltyShootoutMissedQuery) {
				this.lastProcessingSteps.push(`Detected penalty shootout missed question, routing to ClubDataQueryHandler`);
				return await ClubDataQueryHandler.queryPenaltyShootoutPenaltiesMissed();
			}

			if (isPenaltyShootoutSavedQuery) {
				this.lastProcessingSteps.push(`Detected penalty shootout saved question, routing to ClubDataQueryHandler`);
				return await ClubDataQueryHandler.queryPenaltyShootoutPenaltiesSaved();
			}

			// Check for "how many players have played only one game for [team]" questions
			const isPlayersOnlyOneGameForTeamQuery = 
				(question.includes("how many players") || question.includes("how many player")) &&
				(question.includes("only one game") || question.includes("only 1 game")) &&
				(analysis.teamEntities && analysis.teamEntities.length > 0 || 
				 entities.some(e => /^\d+(?:st|nd|rd|th|s)?$/i.test(e)) ||
				 question.match(/\b(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th)\b/i));

			if (isPlayersOnlyOneGameForTeamQuery) {
				// Extract team name from entities or question
				let teamName = "";
				if (analysis.teamEntities && analysis.teamEntities.length > 0) {
					teamName = TeamMappingUtils.mapTeamName(analysis.teamEntities[0]);
				} else {
					// Try to extract from entities
					const teamEntity = entities.find(e => /^\d+(?:st|nd|rd|th|s)?$/i.test(e));
					if (teamEntity) {
						teamName = TeamMappingUtils.mapTeamName(teamEntity);
					} else {
						// Try to extract from question text
						const teamMatch = question.match(/\b(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th)\b/i);
						if (teamMatch) {
							const teamStr = teamMatch[1];
							teamName = TeamMappingUtils.mapTeamName(teamStr);
						}
					}
				}

				if (teamName) {
					this.lastProcessingSteps.push(`Detected players with only one game for team question, routing to ClubDataQueryHandler with team: ${teamName}`);
					return await ClubDataQueryHandler.queryPlayersWithOnlyOneGameForTeam(teamName);
				}
			}

			// Check for "which team used the most players in [season]" questions
			const isTeamPlayerCountBySeasonQuestion = 
				(question.includes("which team") || question.includes("what team")) &&
				(question.includes("used") || question.includes("use")) &&
				(question.includes("most players") || question.includes("most player")) &&
				(/\d{4}[\/\-]\d{2}/.test(question) || analysis.timeRange);

			if (isTeamPlayerCountBySeasonQuestion) {
				// Extract season from question
				let season: string | null = null;
				const seasonMatch = question.match(/(\d{4})[\/\-](\d{2})/);
				if (seasonMatch) {
					season = `${seasonMatch[1]}/${seasonMatch[2]}`;
				} else if (analysis.timeRange) {
					const timeFrameMatch = analysis.timeRange.match(/(\d{4})[\/\-](\d{2})/);
					if (timeFrameMatch) {
						season = `${timeFrameMatch[1]}/${timeFrameMatch[2]}`;
					}
				}
				
				if (season) {
					this.lastProcessingSteps.push(`Detected team player count by season question, routing to ClubDataQueryHandler with season: ${season}`);
					return await ClubDataQueryHandler.queryTeamPlayerCountBySeason(season);
				}
			}

			// Check for "how many goals were scored across all teams in [month] [year]" questions
			// This must be checked BEFORE the year-only check to ensure month-specific queries are handled correctly
			const hasHowManyGoals = question.includes("how many total goals") || question.includes("how many goals");
			const hasAllTeams = question.includes("across all teams") || question.includes("all teams") || question.includes("all team");
			const hasYear = /\d{4}/.test(question);
			const monthNames = ["january", "february", "march", "april", "may", "june", 
				"july", "august", "september", "october", "november", "december"];
			const monthAbbreviations = ["jan", "feb", "mar", "apr", "may", "jun",
				"jul", "aug", "sep", "oct", "nov", "dec"];
			const hasMonth = monthNames.some(month => question.includes(month)) || 
				monthAbbreviations.some(month => question.includes(month));
			const isGoalsByMonthQuestion = hasHowManyGoals && hasAllTeams && hasMonth && hasYear;

			if (isGoalsByMonthQuestion) {
				// Extract month and year from question
				let monthName = "";
				let monthIndex = -1;
				for (let i = 0; i < monthNames.length; i++) {
					if (question.includes(monthNames[i])) {
						monthName = monthNames[i];
						monthIndex = i;
						break;
					} else if (question.includes(monthAbbreviations[i])) {
						monthName = monthNames[i];
						monthIndex = i;
						break;
					}
				}
				const yearMatch = question.match(/\b(20\d{2})\b/);
				if (monthName && yearMatch) {
					const year = parseInt(yearMatch[1], 10);
					this.lastProcessingSteps.push(`Detected goals by month question, routing to ClubDataQueryHandler with month: ${monthName}, year: ${year}`);
					return await ClubDataQueryHandler.queryGoalsByMonthAndYear(monthName, year);
				}
			}

			// Check for "how many total goals were scored across all teams in [year]" questions
			// Make detection more flexible to handle typos: "where" vs "were", "team" vs "teams"
			const isTotalGoalsByYearQuestion = hasHowManyGoals && hasAllTeams && hasYear && !hasMonth;

			if (isTotalGoalsByYearQuestion) {
				// Extract year from question
				const yearMatch = question.match(/\b(20\d{2})\b/);
				if (yearMatch) {
					const year = parseInt(yearMatch[1], 10);
					this.lastProcessingSteps.push(`Detected total goals by year question, routing to ClubDataQueryHandler with year: ${year}`);
					return await ClubDataQueryHandler.queryTotalGoalsByYear(year);
				}
			}

			// Check for "which season did the club record the most total wins across all teams" questions
			const isSeasonWinsQuestion = 
				(question.includes("which season") || question.includes("what season")) &&
				(question.includes("most") || question.includes("highest")) &&
				(question.includes("wins") || question.includes("win")) &&
				(question.includes("across all teams") || question.includes("all teams") || question.includes("club") || question.includes("total wins"));

			if (isSeasonWinsQuestion) {
				this.lastProcessingSteps.push(`Detected season wins question, routing to ClubDataQueryHandler`);
				return await ClubDataQueryHandler.querySeasonWinsCount();
			}

			// Check if this is an awards count question (e.g., "How many awards have I won?")
			const isAwardsCountQuestion = type === "player" && 
				(question.includes("how many awards") || question.includes("how many award")) &&
				(question.includes("won") || question.includes("have") || question.includes("i"));

			if (isAwardsCountQuestion) {
				// Use entities first, fallback to userContext
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName) {
					return await AwardsQueryHandler.queryPlayerAwardsCount(playerName);
				}
			}

			// Check if this is a leagues won count question (e.g., "How many leagues have I won?")
			const isLeaguesWonQuestion = type === "player" && 
				(question.includes("how many leagues") || question.includes("how many league")) &&
				(question.includes("won") || question.includes("have") || question.includes("i"));

			if (isLeaguesWonQuestion) {
				// Use entities first, fallback to userContext
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName) {
					return await PlayerDataQueryHandler.queryPlayerLeagueWinsCount(playerName);
				}
			}

			// Check if this is a SeasonTOTW count question (e.g., "How many times have I been the team of the season?")
			const isSeasonTOTWCountQuestion = type === "player" && 
				(question.includes("how many times") || question.includes("how many")) &&
				(question.includes("team of the season") || question.includes("tots")) &&
				!(question.includes("weekly") || question.includes("week"));

			if (isSeasonTOTWCountQuestion) {
				// Use entities first, fallback to userContext
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName) {
					this.lastProcessingSteps.push(`Detected SeasonTOTW count question for player: ${playerName}`);
					return await AwardsQueryHandler.queryPlayerTOTWData(playerName, "season", question);
				}
			}

			// Check for historical award queries
			const isHistoricalAwardQuestion = 
				(question.includes("who won") && question.includes("award")) ||
				(question.includes("award") && (question.includes("season") || question.includes("won"))) ||
				(question.includes("historical award") || question.includes("award history"));

			if (isHistoricalAwardQuestion && entities.length > 0) {
				const extractionResult = analysis.extractionResult;
				const playerEntities = extractionResult?.entities?.filter(e => e.type === "player").map(e => e.value) || [];
				const awardName = entities.find(e => !playerEntities.includes(e)) || entities[0];
				const seasonMatch = question.match(/(\d{4})[\/\-](\d{2,4})/);
				const season = seasonMatch ? seasonMatch[0].replace("-", "/") : undefined;
				return await AwardsQueryHandler.queryHistoricalAwardWinner(awardName, season);
			}

			// Check for distance/location queries
			// CRITICAL: Only route to distance queries if there's no player mentioned in the question
			// Check for potential player names in the question before routing to distance queries
			const hasPotentialPlayerName = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/.test(question);
			const extractionResult = analysis.extractionResult;
			const playerEntities = extractionResult?.entities?.filter(e => e.type === "player").map(e => e.value) || [];
			const hasPlayerEntity = playerEntities.length > 0;
			
			// Use word boundaries to avoid false positives (e.g., "Farooq" matching "far")
			const isDistanceQuery = 
				/\bdistance\b/i.test(question) || /\bfar\b/i.test(question) || /\btravel/i.test(question) ||
				/\bfurthest\b/i.test(question) || /\bfurthest opposition\b/i.test(question);

			// Only route to distance queries if:
			// 1. It's explicitly a distance query AND
			// 2. There's no player entity extracted AND
			// 3. There's no potential player name pattern in the question (to avoid false positives)
			if (isDistanceQuery && !hasPlayerEntity && !hasPotentialPlayerName) {
				if (question.includes("furthest") && !entities.some(e => playerEntities.includes(e))) {
					return await RelationshipQueryHandler.queryFurthestOpposition();
				} else if (entities.length > 0 && playerEntities.length > 0 && playerEntities.includes(entities[0])) {
					const playerName = entities[0];
					const seasonMatch = question.match(/(\d{4})[\/\-](\d{2,4})/);
					const season = seasonMatch ? seasonMatch[0].replace("-", "/") : undefined;
					return await RelationshipQueryHandler.queryPlayerDistanceTraveled(playerName, season);
				} else if (analysis.oppositionEntities && analysis.oppositionEntities.length > 0) {
					return await RelationshipQueryHandler.queryDistanceToOpposition(analysis.oppositionEntities[0]);
				}
			}
			
			// If it's a distance query but we have a player entity, route to player distance query
			if (isDistanceQuery && hasPlayerEntity && playerEntities.length > 0) {
				const playerName = playerEntities[0];
				const seasonMatch = question.match(/(\d{4})[\/\-](\d{2,4})/);
				const season = seasonMatch ? seasonMatch[0].replace("-", "/") : undefined;
				return await RelationshipQueryHandler.queryPlayerDistanceTraveled(playerName, season);
			}

			// Check for "no goal involvement" streak questions - route to streak handler
			// Handle variations: "longest run", "longest streak", "lowest run" (likely typo/normalization issue)
			// Handle variations: "goal involvement", "goal involvements", "goals goal involvements"
			const isNoGoalInvolvementStreakQuestion = 
				(question.includes("longest run") || question.includes("longest streak") || question.includes("lowest run") || question.includes("run of games")) &&
				(question.includes("no goal involvement") || question.includes("no goal involvements") || 
				 question.includes("no goals goal involvements") || question.includes("no goals goal involvement") ||
				 question.includes("without goal involvement") || question.includes("without goal involvements") ||
				 (question.includes("goal involvement") && (question.includes("no") || question.includes("without"))) ||
				 (question.includes("goals goal involvements") && (question.includes("no") || question.includes("without"))));

			// Check for positive goal involvement streak questions (longest run WITH goal involvements)
			const isGoalInvolvementStreakQuestion = 
				(question.includes("longest run") || question.includes("longest streak") || question.includes("run of games")) &&
				(question.includes("goal involvement") || question.includes("goal involvements")) &&
				!question.includes("no") && !question.includes("without");

			if (isNoGoalInvolvementStreakQuestion || isGoalInvolvementStreakQuestion) {
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName) {
					return await TemporalQueryHandler.queryStreakData([playerName], [], analysis);
				}
			}

			// Check for consecutive goal involvement questions - ensure they're routed to streak handler - This catches questions that might be misclassified as "player" type
			const isConsecutiveGoalInvolvementQuestion = 
				(question.includes("consecutive") && question.includes("games") && 
				(question.includes("scored") || question.includes("assisted") || 
				question.includes("goal involvement") || question.includes("goals involvement"))) ||
				(question.includes("how many") && question.includes("consecutive") && 
				(question.includes("scored") || question.includes("assisted") || 
				question.includes("goal involvement") || question.includes("goals involvement")));

			if (isConsecutiveGoalInvolvementQuestion) {
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName) {
					return await TemporalQueryHandler.queryStreakData([playerName], [], analysis);
				}
			}

			// Check for longest goal scoring streak questions (goals + penalties, excluding assists)
			const isGoalScoringStreakQuestion = 
				(question.includes("longest") && (question.includes("goal scoring streak") || question.includes("goal scoring run") || question.includes("scoring streak"))) ||
				(question.includes("longest") && question.includes("streak") && question.includes("scored") && !question.includes("assist"));

			if (isGoalScoringStreakQuestion) {
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName) {
					return await TemporalQueryHandler.queryStreakData([playerName], [], analysis);
				}
			}

			// Check for longest assisting run questions (assists only)
			// Handle both "assisting" and common typo "assiting"
			const isAssistingRunQuestion = 
				(question.includes("longest") && (question.includes("assisting run") || question.includes("assisting streak") || question.includes("assiting run") || question.includes("assiting streak"))) ||
				(question.includes("longest") && question.includes("run") && (question.includes("assist") || question.includes("assit")) && !question.includes("goal"));

			if (isAssistingRunQuestion) {
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName) {
					return await TemporalQueryHandler.queryStreakData([playerName], [], analysis);
				}
			}

			// Check for hat-trick questions (year-wide, team-specific, or date-filtered) BEFORE routing to handlers
			// This prevents "hat‑tricks" from being treated as a player entity
			// Handles various dash characters: regular hyphen (-), non-breaking hyphen (\u2011), en dash (–), em dash (—), and spaces
			const hatTrickPattern = /hat[-\u2011\u2013\u2014 ]?trick/i;
			const isHatTrickQuestion = hatTrickPattern.test(question) && 
				(question.includes("how many") || question.includes("count"));
			
			if (isHatTrickQuestion) {
				const hasYear = question.match(/\b(20\d{2})\b/) || 
					analysis.extractionResult?.timeFrames?.some(tf => {
						const yearMatch = tf.value?.match(/\b(20\d{2})\b/);
						return yearMatch !== null;
					});
				const hasYearWidePhrases = question.includes("across all teams") || 
					question.includes("across all team") ||
					question.includes("across all") ||
					question.includes("all teams") ||
					question.includes("all team");
				const hasPlayerMention = question.includes("has ") || 
					question.includes("have ") || 
					question.includes(" i ") || 
					question.match(/\bi\b/);
				const hasTeamFilter = (analysis.teamEntities && analysis.teamEntities.length > 0) ||
					question.match(/\b(?:by|for)\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)\b/i);
				const hasDateFilter = question.includes("after ") || 
					question.includes("before ") ||
					question.includes("since ") ||
					question.includes("between ") ||
					analysis.extractionResult?.timeFrames?.some(tf => 
						tf.type === "since" || tf.type === "before" || tf.type === "range"
					);
				
				// Year-wide question: has year AND (year-wide phrases OR no player mention) AND no team filter
				const isYearWideQuestion = hasYear && (hasYearWidePhrases || !hasPlayerMention) && !hasTeamFilter;
				// Team-specific or date-filtered question: hat-trick question with team filter or date filter
				const isFilteredHatTrickQuestion = (hasTeamFilter || hasDateFilter || hasYear) && !hasPlayerMention;

				if (isYearWideQuestion || isFilteredHatTrickQuestion) {
					this.lastProcessingSteps.push(`Detected hat-trick question with filters, routing to FixtureDataQueryHandler`);
					return await FixtureDataQueryHandler.queryFixtureData(entities, metrics, analysis);
				}
			}

			// Check for "most consecutive games played" question (across all players)
			// This should match questions asking "which/what player has the most" not "my/his/her consecutive games"
			const isMostConsecutiveGamesQuestion = 
				(question.includes("most consecutive games") || 
				 question.includes("player has the most consecutive games") ||
				 (question.includes("longest consecutive streak") && question.includes("games"))) &&
				// Must be asking about "which/what player" or "who has", not personal questions
				(question.includes("what player") || question.includes("which player") || 
				 question.includes("who has") || question.includes("player has") ||
				 question.startsWith("what") || question.startsWith("which")) &&
				// Exclude personal questions
				!question.includes("my") && !question.includes("your") && 
				!question.includes("i've") && !question.includes("you've") &&
				!question.includes("have i") && !question.includes("have you") &&
				!question.includes("my longest") && !question.includes("your longest");

			if (isMostConsecutiveGamesQuestion) {
				this.lastProcessingSteps.push(`Detected most consecutive games question, routing to TemporalQueryHandler`);
				return await TemporalQueryHandler.queryMostConsecutiveGamesPlayed();
			}

			// Check for "how many players have I played with" question (handles both singular and plural)
			const isTeammatesCountQuestion = 
				((question.includes("how many players") || question.includes("how many player")) && question.includes("played with")) ||
				(question.includes("how many teammates")) ||
				(question.includes("how many people") && question.includes("played with"));

			if (isTeammatesCountQuestion) {
				// Check if this is a personal question (I, me, my)
				const isPersonalQuestion = question.includes(" i ") || question.includes(" i?") || question.includes(" i've") || 
					question.includes(" have i ") || question.includes(" have you ") || question.startsWith("how many");
				
				// Filter out generic words from entities
				const genericWords = ["player", "players", "teammate", "teammates", "people", "person"];
				const validEntities = entities.filter(e => !genericWords.includes(e.toLowerCase()));
				
				// For personal questions, prioritize userContext; otherwise use valid entities
				let playerName = "";
				if (isPersonalQuestion && userContext) {
					playerName = userContext;
				} else if (validEntities.length > 0) {
					playerName = validEntities[0];
				} else if (userContext) {
					playerName = userContext;
				}
				
				if (playerName) {
					this.lastProcessingSteps.push(`Detected teammates count question, routing to RelationshipQueryHandler with player: ${playerName}`);
					return await RelationshipQueryHandler.queryTeammatesCount(playerName);
				} else {
					this.lastProcessingSteps.push(`Teammates count question detected but no player context available`);
				}
			}

			// Check for home/away games comparison questions (e.g., "Have I played more home or away games?")
			const isHomeAwayComparisonQuestion = 
				(question.includes("more home or away") || question.includes("more away or home")) ||
				(question.includes("played more") && question.includes("home") && question.includes("away")) ||
				(question.includes("home or away") && (question.includes("more") || question.includes("played"))) ||
				(question.includes("have i played") && question.includes("home") && question.includes("away")) ||
				(question.includes("have you played") && question.includes("home") && question.includes("away"));

			if (isHomeAwayComparisonQuestion) {
				// Use entities first, fallback to userContext
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName) {
					this.lastProcessingSteps.push(`Detected home/away games comparison question, routing to PlayerDataQueryHandler with player: ${playerName}`);
					return await PlayerDataQueryHandler.queryHomeAwayGamesComparison(playerName);
				} else {
					this.lastProcessingSteps.push(`Home/away comparison question detected but no player context available`);
				}
			}

			// Check for "highest individual player goals in one game" queries FIRST - these should route to fixture handler
			// This must be checked BEFORE highest scoring game query to avoid misrouting
			const isHighestPlayerGoalsInGameQuery = 
				(question.includes("highest number of goals") && question.includes("player") && question.includes("scored")) ||
				(question.includes("highest goals") && question.includes("player") && (question.includes("scored") || question.includes("one game"))) ||
				(question.includes("most goals") && question.includes("player") && question.includes("one game")) ||
				(question.includes("most goals") && question.includes("player") && question.includes("scored") && question.includes("game")) ||
				(question.includes("highest goals") && question.includes("one game") && question.includes("player"));

			if (isHighestPlayerGoalsInGameQuery) {
				this.lastProcessingSteps.push(`Detected highest individual player goals in one game question, routing to FixtureDataQueryHandler`);
				return await FixtureDataQueryHandler.queryFixtureData(entities, metrics, analysis);
			}

			// Check for "most goals we've conceded in a game when I was playing" questions
			// This must be checked BEFORE isMostGoalsWhenPlayingQuery to avoid misrouting
			const isMostGoalsConcededWhenPlayingQuery = 
				(question.includes("most goals") && question.includes("conceded") && question.includes("game") && (question.includes("when i was playing") || question.includes("when playing") || question.includes("when i was") || question.includes("when you were"))) ||
				(question.includes("most goals") && question.includes("conceded") && (question.includes("when i was playing") || question.includes("when playing") || question.includes("when i was") || question.includes("when you were")));

			if (isMostGoalsConcededWhenPlayingQuery) {
				this.lastProcessingSteps.push(`Detected most goals conceded in game when playing question, routing to FixtureDataQueryHandler`);
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName) {
					return await FixtureDataQueryHandler.queryHighestTeamGoalsConcededInPlayerGames(playerName, analysis);
				} else {
					this.lastProcessingSteps.push(`Most goals conceded when playing question detected but no player context available`);
				}
			}

			// Check for "most goals we've scored in a game when I was playing" questions
			// This must be checked BEFORE isHighestScoringGameQuery to avoid misrouting
			const isMostGoalsWhenPlayingQuery = 
				(question.includes("most goals") && question.includes("game") && (question.includes("when i was playing") || question.includes("when playing") || question.includes("when i was") || question.includes("when you were"))) ||
				(question.includes("most goals") && (question.includes("when i was playing") || question.includes("when playing") || question.includes("when i was") || question.includes("when you were")));

			if (isMostGoalsWhenPlayingQuery) {
				this.lastProcessingSteps.push(`Detected most goals in game when playing question, routing to FixtureDataQueryHandler`);
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName) {
					return await FixtureDataQueryHandler.queryHighestTeamGoalsInPlayerGames(playerName, analysis);
				} else {
					this.lastProcessingSteps.push(`Most goals when playing question detected but no player context available`);
				}
			}

			// Check for "highest scoring game" queries - these should route to fixture handler, not player handler
			// Exclude player-specific patterns (e.g., "when I was playing") to avoid misrouting
			const hasPlayerSpecificPattern = question.includes("when i was playing") || question.includes("when playing") || question.includes("when i was") || question.includes("when you were");
			const isHighestScoringGameQuery = 
				!hasPlayerSpecificPattern && (
					question.includes("highest scoring game") ||
					(question.includes("highest scoring") && question.includes("game")) ||
					(question.includes("most goals") && question.includes("game")) ||
					(question.includes("highest total") && question.includes("game"))
				);

			if (isHighestScoringGameQuery) {
				this.lastProcessingSteps.push(`Detected highest scoring game question, routing to FixtureDataQueryHandler`);
				return await FixtureDataQueryHandler.queryFixtureData(entities, metrics, analysis);
			}

			// Check for "how many games have I played and scored where the team won by exactly one goal" questions
			const isGamesScoredWonByOneGoalQuery = 
				(question.includes("how many games") && question.includes("played") && question.includes("scored") && question.includes("won") && question.includes("exactly one goal")) ||
				(question.includes("how many games") && question.includes("scored") && question.includes("won by exactly one"));

			if (isGamesScoredWonByOneGoalQuery) {
				this.lastProcessingSteps.push(`Detected games scored and won by exactly one goal question, routing to FixtureDataQueryHandler`);
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName) {
					return await FixtureDataQueryHandler.queryGamesWherePlayerScoredAndWonByOneGoal(playerName, analysis);
				} else {
					this.lastProcessingSteps.push(`Games scored won by one goal question detected but no player context available`);
				}
			}

			// Check for "how many games have I played where the team scored zero goals" questions
			const isGamesWithZeroGoalsQuery = 
				(question.includes("how many games") && question.includes("played") && 
				 (question.includes("team scored zero goals") || 
				  question.includes("team scored 0 goals") ||
				  (question.includes("team") && question.includes("scored") && question.includes("zero")) ||
				  (question.includes("team") && question.includes("scored") && question.includes("0")))) ||
				(question.includes("how many games") && question.includes("I") && 
				 (question.includes("zero goals") || question.includes("0 goals")));

			if (isGamesWithZeroGoalsQuery) {
				this.lastProcessingSteps.push(`Detected games with zero goals question, routing to FixtureDataQueryHandler`);
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName) {
					return await FixtureDataQueryHandler.queryGamesWherePlayerPlayedAndTeamScoredZero(playerName, analysis);
				} else {
					this.lastProcessingSteps.push(`Games with zero goals question detected but no player context available`);
				}
			}

			// Check for "which month across my career has the highest total goal involvements" questions
			const isMonthHighestGoalInvolvementsQuestion = 
				(question.includes("which month") || question.includes("what month")) &&
				(question.includes("highest") || question.includes("most")) &&
				(question.includes("goal involvement") || question.includes("goal involvements")) &&
				(question.includes("career") || question.includes("my") || question.includes("i"));

			if (isMonthHighestGoalInvolvementsQuestion) {
				this.lastProcessingSteps.push(`Detected month with highest goal involvements question, routing to TemporalQueryHandler`);
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName) {
					return await TemporalQueryHandler.queryMonthlyGoalInvolvements(playerName);
				} else {
					this.lastProcessingSteps.push(`Month goal involvements question detected but no player context available`);
				}
			}

			// Check for "how many times have I scored or assisted in a game where the team kept a clean sheet" questions
			const isCleanSheetGoalInvolvementsQuestion = 
				(question.includes("how many times") || question.includes("how many")) &&
				(question.includes("scored") || question.includes("assisted")) &&
				(question.includes("clean sheet") || question.includes("kept a clean sheet")) &&
				(question.includes("game") || question.includes("games"));

			if (isCleanSheetGoalInvolvementsQuestion) {
				this.lastProcessingSteps.push(`Detected scored/assisted in clean sheet games question, routing to FixtureDataQueryHandler`);
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName) {
					return await FixtureDataQueryHandler.queryCleanSheetGoalInvolvements(playerName);
				} else {
					this.lastProcessingSteps.push(`Clean sheet goal involvements question detected but no player context available`);
				}
			}

			// Check for "which season did [team] concede the most goals" - route to league table handler BEFORE player handler
			const isTeamSeasonConcedeQuery = 
				analysis.teamEntities && analysis.teamEntities.length > 0 &&
				(question.includes("which season") || question.includes("what season")) &&
				question.includes("concede") &&
				(question.includes("most goals") || (question.includes("most") && question.includes("goals")));
			
			if (isTeamSeasonConcedeQuery) {
				this.lastProcessingSteps.push(`Detected team season concede query, routing to LeagueTableQueryHandler`);
				return await LeagueTableQueryHandler.queryLeagueTableData(analysis.teamEntities || [], [], analysis, userContext);
			}

			// Check for "most prolific season", "highest scoring season", or "season I scored the most goals" questions - route to player handler - This check must happen before the switch statement to ensure proper routing
			const questionLower = question.toLowerCase();
			// Helper function to detect various patterns
			const detectMostGoalsSeasonPattern = (q: string): boolean => {
				const lower = q.toLowerCase();
				// Exclude "game" questions - these should be handled by fixture handler
				if (lower.includes("game") && (lower.includes("highest scoring") || lower.includes("most goals"))) {
					return false;
				}
				// Exclude "concede" questions - these should be handled by league table handler
				if (lower.includes("concede") && (lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
					return false;
				}
				// Pattern 1: "most prolific season" or "highest scoring season"
				if ((lower.includes("most prolific season") || 
					 lower.includes("prolific season") ||
					 lower.includes("highest scoring season") ||
					 (lower.includes("highest") && lower.includes("scoring") && lower.includes("season") && !lower.includes("game")))) {
					return true;
				}
				// Pattern 2: "season I scored the most goals" / "season I scored most goals"
				if (lower.includes("season") && lower.includes("scored") && 
					(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
					return true;
				}
				// Pattern 3: "season did I score the most goals" / "season did I score most goals"
				if (lower.includes("season") && lower.includes("did") && lower.includes("score") && 
					(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
					return true;
				}
				// Pattern 4: "when did I score the most goals" / "when did I score most goals"
				if (lower.includes("when") && lower.includes("did") && lower.includes("score") && 
					(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
					return true;
				}
				// Pattern 5: "season with the most goals" / "season with most goals"
				if (lower.includes("season") && lower.includes("with") && 
					(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
					return true;
				}
				// Pattern 6: "which season" + "most goals" / "what season" + "most goals"
				if ((lower.includes("which season") || lower.includes("what season")) && 
					(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
					return true;
				}
				return false;
			};
			
			const isMostProlificSeasonQuestion = 
				detectMostGoalsSeasonPattern(question) &&
				(questionLower.includes("what") || questionLower.includes("which") || questionLower.includes("when") || questionLower.includes("my") || questionLower.includes("your") || questionLower.includes("i ") || questionLower.includes(" did"));

			if (isMostProlificSeasonQuestion) {
				// Ensure this is routed to player handler with proper context
				// Prioritize explicit player entities from question over userContext
				// Filter out all first-person pronouns (I, my, me, myself, i've)
				// Also filter out invalid player names that contain "season", "scoring", etc.
				const firstPersonPronouns = ["i", "my", "me", "myself", "i've"];
				const invalidPlayerNamePatterns = ["season", "scoring", "prolific", "highest", "most"];
				const playerEntitiesFromQuestion = analysis.extractionResult?.entities?.filter(e => {
					if (e.type !== "player") return false;
					const lowerValue = e.value.toLowerCase();
					// Filter out first-person pronouns
					if (firstPersonPronouns.includes(lowerValue)) return false;
					// Filter out invalid player names that contain season/scoring related words
					if (invalidPlayerNamePatterns.some(pattern => lowerValue.includes(pattern))) return false;
					return true;
				}) || [];
				let playerName = "";
				if (playerEntitiesFromQuestion.length > 0) {
					// Explicit player name mentioned in question takes priority
					playerName = playerEntitiesFromQuestion[0].value;
				} else {
					// Skip regex extraction for most prolific season questions - they use first-person pronouns
					// and should rely on userContext instead of trying to extract names from question text
					// The regex patterns can incorrectly match parts of the question like "scoring season"
					// For most prolific season questions, we should never extract player names from question text
					// when using first-person pronouns - just skip to using entities/userContext
					
					// Only fall back to entities/userContext if no name extracted from question
					if (!playerName) {
						if (entities.length > 0) {
							playerName = entities[0];
							// Fix: If entity is "I" or "my" (from "my", "I", etc.), use userContext instead
							if ((playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my") && userContext) {
								playerName = userContext;
							}
						} else if (userContext) {
							playerName = userContext;
						}
					}
				}
				
				if (playerName || userContext) {
					// Force route to player handler by ensuring entities array has the player
					const playerEntities = playerName ? [playerName] : (userContext ? [userContext] : []);
					this.lastProcessingSteps.push(`Detected most prolific season question, routing to PlayerDataQueryHandler with player: ${playerEntities[0] || userContext}`);
					return await PlayerDataQueryHandler.queryPlayerData(playerEntities, ["MostProlificSeason"], analysis, userContext);
				} else {
					this.lastProcessingSteps.push(`Most prolific season question detected but no player context available`);
				}
			}

			// Check for "best season for [stat]" questions - route to player handler
			const detectBestSeasonForStatPattern = (q: string): boolean => {
				const lower = q.toLowerCase();
				// Pattern: "best season for [stat]" or "my best season for [stat]"
				if ((lower.includes("best season for") || lower.includes("worst season for")) &&
					(lower.includes("what") || lower.includes("which") || lower.includes("my") || lower.includes("your") || lower.includes("i ") || lower.includes(" did"))) {
					return true;
				}
				// Pattern: "best season [stat]" (without "for") - check for any stat keywords
				if ((lower.includes("best season") || lower.includes("worst season")) &&
					(lower.includes("goals") || lower.includes("assists") || lower.includes("saves") || 
					 lower.includes("yellow card") || lower.includes("red card") || lower.includes("clean sheet") ||
					 lower.includes("appearance") || lower.includes("minute") || lower.includes("mom") ||
					 lower.includes("man of the match") || lower.includes("own goal") || lower.includes("penalt") ||
					 lower.includes("conceded")) &&
					(lower.includes("what") || lower.includes("which") || lower.includes("my") || lower.includes("your") || lower.includes("i ") || lower.includes(" did"))) {
					return true;
				}
				return false;
			};

			const patternMatch = detectBestSeasonForStatPattern(question);
			const hasRequiredWords = (questionLower.includes("what") || questionLower.includes("which") || questionLower.includes("my") || questionLower.includes("your") || questionLower.includes("i ") || questionLower.includes(" did"));
			const isBestSeasonForStatQuestion = patternMatch && hasRequiredWords;

			if (isBestSeasonForStatQuestion) {
				const firstPersonPronouns = ["i", "my", "me", "myself", "i've"];
				const invalidPlayerNamePatterns = [
					"season", "best", "worst", 
					"goals", "goal", "assists", "assist",
					"saves", "save", "sheets", "sheet", "clean",
					"cards", "card", "yellow", "red",
					"mom", "match", "man", "of", "the",
					"own", "conceded", "penalt", "penalties",
					"appearances", "appearance", "minutes", "minute"
				];
				const playerEntitiesFromQuestion = analysis.extractionResult?.entities?.filter(e => {
					if (e.type !== "player") return false;
					const lowerValue = e.value.toLowerCase();
					if (firstPersonPronouns.includes(lowerValue)) return false;
					if (invalidPlayerNamePatterns.some(pattern => lowerValue.includes(pattern))) return false;
					return true;
				}) || [];
				let playerName = "";
				if (playerEntitiesFromQuestion.length > 0) {
					playerName = playerEntitiesFromQuestion[0].value;
				} else {
					// Filter entities to exclude stat-related words before using them
					const filteredEntities = entities.filter(entity => {
						const lowerEntity = entity.toLowerCase();
						return !invalidPlayerNamePatterns.some(pattern => lowerEntity.includes(pattern));
					});
					if (filteredEntities.length > 0) {
						playerName = filteredEntities[0];
						if ((playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my") && userContext) {
							playerName = userContext;
						}
					} else if (userContext) {
						playerName = userContext;
					}
				}
				if (playerName || userContext) {
					const playerEntities = playerName ? [playerName] : (userContext ? [userContext] : []);
					this.lastProcessingSteps.push(`Detected best season for stat question, routing to PlayerDataQueryHandler with player: ${playerEntities[0] || userContext}`);
					// Pass the stat type from analysis if available
					const bestSeasonStatType = (analysis.extractionResult as any)?.bestSeasonStatType;
					if (bestSeasonStatType) {
						(analysis as any).bestSeasonStatType = bestSeasonStatType;
					}
					return await PlayerDataQueryHandler.queryPlayerData(playerEntities, ["BestSeasonForStat"], analysis, userContext);
				} else {
					this.lastProcessingSteps.push(`Best season for stat question detected but no player context available`);
				}
			} else {
				this.lastProcessingSteps.push(`Best season for stat question not detected`);
			}

			// Check for "which season did I play the most minutes" questions - route to player handler
			const detectMostMinutesSeasonPattern = (q: string): boolean => {
				const lower = q.toLowerCase();
				if ((lower.includes("which season") || lower.includes("what season")) && 
					lower.includes("play") && 
					(lower.includes("most minutes") || (lower.includes("most") && lower.includes("minutes")))) {
					return true;
				}
				if (lower.includes("season") && lower.includes("play") && 
					(lower.includes("most minutes") || (lower.includes("most") && lower.includes("minutes")))) {
					return true;
				}
				return false;
			};

			const isMostMinutesSeasonQuestion = 
				detectMostMinutesSeasonPattern(question) &&
				(questionLower.includes("what") || questionLower.includes("which") || questionLower.includes("my") || questionLower.includes("your") || questionLower.includes("i ") || questionLower.includes(" did"));

			if (isMostMinutesSeasonQuestion) {
				const firstPersonPronouns = ["i", "my", "me", "myself", "i've"];
				const invalidPlayerNamePatterns = ["season", "minutes", "most", "play"];
				const playerEntitiesFromQuestion = analysis.extractionResult?.entities?.filter(e => {
					if (e.type !== "player") return false;
					const lowerValue = e.value.toLowerCase();
					if (firstPersonPronouns.includes(lowerValue)) return false;
					if (invalidPlayerNamePatterns.some(pattern => lowerValue.includes(pattern))) return false;
					return true;
				}) || [];
				let playerName = "";
				if (playerEntitiesFromQuestion.length > 0) {
					playerName = playerEntitiesFromQuestion[0].value;
				} else {
					if (entities.length > 0) {
						playerName = entities[0];
						if ((playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my") && userContext) {
							playerName = userContext;
						}
					} else if (userContext) {
						playerName = userContext;
					}
				}
				
				if (playerName || userContext) {
					const playerEntities = playerName ? [playerName] : (userContext ? [userContext] : []);
					this.lastProcessingSteps.push(`Detected most minutes season question, routing to PlayerDataQueryHandler with player: ${playerEntities[0] || userContext}`);
					return await PlayerDataQueryHandler.queryPlayerData(playerEntities, ["MostMinutesSeason"], analysis, userContext);
				} else {
					this.lastProcessingSteps.push(`Most minutes season question detected but no player context available`);
				}
			}

			// Check for "which season did I appear in the most matches" questions - route to player handler
			const detectMostAppearancesSeasonPattern = (q: string): boolean => {
				const lower = q.toLowerCase();
				if ((lower.includes("which season") || lower.includes("what season")) && 
					lower.includes("appear") && 
					(lower.includes("most matches") || lower.includes("most appearances") || 
					 (lower.includes("most") && (lower.includes("matches") || lower.includes("appearances"))))) {
					return true;
				}
				if (lower.includes("season") && lower.includes("appear") && 
					(lower.includes("most matches") || lower.includes("most appearances") || 
					 (lower.includes("most") && (lower.includes("matches") || lower.includes("appearances"))))) {
					return true;
				}
				return false;
			};

			const isMostAppearancesSeasonQuestion = 
				detectMostAppearancesSeasonPattern(questionLower) &&
				(questionLower.includes("what") || questionLower.includes("which") || questionLower.includes("my") || questionLower.includes("your") || questionLower.includes("i ") || questionLower.includes(" did"));

			if (isMostAppearancesSeasonQuestion) {
				const firstPersonPronouns = ["i", "my", "me", "myself", "i've"];
				const invalidPlayerNamePatterns = ["season", "matches", "appearances", "most", "appear"];
				const playerEntitiesFromQuestion = analysis.extractionResult?.entities?.filter(e => {
					if (e.type !== "player") return false;
					const lowerValue = e.value.toLowerCase();
					if (firstPersonPronouns.includes(lowerValue)) return false;
					if (invalidPlayerNamePatterns.some(pattern => lowerValue.includes(pattern))) return false;
					return true;
				}) || [];
				let playerName = "";
				if (playerEntitiesFromQuestion.length > 0) {
					playerName = playerEntitiesFromQuestion[0].value;
				} else {
					if (entities.length > 0) {
						playerName = entities[0];
						if ((playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my") && userContext) {
							playerName = userContext;
						}
					} else if (userContext) {
						playerName = userContext;
					}
				}
				
				if (playerName || userContext) {
					const playerEntities = playerName ? [playerName] : (userContext ? [userContext] : []);
					this.lastProcessingSteps.push(`Detected most appearances season question, routing to PlayerDataQueryHandler with player: ${playerEntities[0] || userContext}`);
					return await PlayerDataQueryHandler.queryPlayerData(playerEntities, ["MostAppearancesSeason"], analysis, userContext);
				} else {
					this.lastProcessingSteps.push(`Most appearances season question detected but no player context available`);
				}
			}

			// Check for "which player appeared in the most games in [season]" questions
			const isMostAppearancesBySeasonQuestion = 
				(question.includes("which player") || question.includes("what player") || question.includes("who")) &&
				(question.includes("appeared") || question.includes("appearances") || question.includes("appear")) &&
				(question.includes("most games") || question.includes("most matches")) &&
				/\d{4}[\/\-]\d{2}/.test(question) &&
				!question.includes("my") && !question.includes("your") && !question.includes("i ") && !question.includes("you ");

			if (isMostAppearancesBySeasonQuestion) {
				// Extract season from question
				let season: string | null = null;
				const seasonMatch = question.match(/(\d{4})[\/\-](\d{2})/);
				if (seasonMatch) {
					season = `${seasonMatch[1]}/${seasonMatch[2]}`;
				} else if (analysis.timeRange) {
					const timeFrameMatch = analysis.timeRange.match(/(\d{4})[\/\-](\d{2})/);
					if (timeFrameMatch) {
						season = `${timeFrameMatch[1]}/${timeFrameMatch[2]}`;
					}
				}
				
				if (season) {
					this.lastProcessingSteps.push(`Detected most appearances by season question, routing to ClubDataQueryHandler with season: ${season}`);
					return await ClubDataQueryHandler.queryMostAppearancesBySeason(season);
				}
			}

			// Check for "which player had the most clean sheet appearances in [season]" questions
			const isCleanSheetAppearancesBySeasonQuestion = 
				(question.includes("which player") || question.includes("what player") || question.includes("who")) &&
				(question.includes("most") || question.includes("highest")) &&
				(question.includes("clean sheet") || question.includes("clean sheets")) &&
				(question.includes("appearances") || question.includes("appearance")) &&
				/\d{4}[\/\-]\d{2}/.test(question) &&
				!question.includes("my") && !question.includes("your") && !question.includes("i ") && !question.includes("you ");

			if (isCleanSheetAppearancesBySeasonQuestion) {
				// Extract season from question
				let season: string | null = null;
				const seasonMatch = question.match(/(\d{4})[\/\-](\d{2})/);
				if (seasonMatch) {
					season = `${seasonMatch[1]}/${seasonMatch[2]}`;
				} else if (analysis.timeRange) {
					const timeFrameMatch = analysis.timeRange.match(/(\d{4})[\/\-](\d{2})/);
					if (timeFrameMatch) {
						season = `${timeFrameMatch[1]}/${timeFrameMatch[2]}`;
					}
				}
				
				if (season) {
					this.lastProcessingSteps.push(`Detected clean sheet appearances by season question, routing to PlayerDataQueryHandler with season: ${season}`);
					return await PlayerDataQueryHandler.queryCleanSheetAppearancesBySeason(season);
				}
			}

			// Check for "which season did I record my highest combined goals + assists total" questions - route to player handler
			const detectHighestGoalsAssistsSeasonPattern = (q: string): boolean => {
				const lower = q.toLowerCase();
				if ((lower.includes("which season") || lower.includes("what season")) && 
					lower.includes("record") && 
					lower.includes("highest") && 
					(lower.includes("combined") || (lower.includes("goals") && lower.includes("assists"))) &&
					(lower.includes("total") || (lower.includes("goals") && lower.includes("assists")))) {
					return true;
				}
				if (lower.includes("season") && lower.includes("record") && 
					lower.includes("highest") && 
					(lower.includes("combined") || (lower.includes("goals") && lower.includes("assists")))) {
					return true;
				}
				return false;
			};

			const isHighestGoalsAssistsSeasonQuestion = 
				detectHighestGoalsAssistsSeasonPattern(question) &&
				(questionLower.includes("what") || questionLower.includes("which") || questionLower.includes("my") || questionLower.includes("your") || questionLower.includes("i ") || questionLower.includes(" did"));

			if (isHighestGoalsAssistsSeasonQuestion) {
				const firstPersonPronouns = ["i", "my", "me", "myself", "i've"];
				const invalidPlayerNamePatterns = ["season", "goals", "assists", "combined", "highest", "record", "total"];
				const playerEntitiesFromQuestion = analysis.extractionResult?.entities?.filter(e => {
					if (e.type !== "player") return false;
					const lowerValue = e.value.toLowerCase();
					if (firstPersonPronouns.includes(lowerValue)) return false;
					if (invalidPlayerNamePatterns.some(pattern => lowerValue.includes(pattern))) return false;
					return true;
				}) || [];
				let playerName = "";
				if (playerEntitiesFromQuestion.length > 0) {
					playerName = playerEntitiesFromQuestion[0].value;
				} else {
					if (entities.length > 0) {
						playerName = entities[0];
						if ((playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my") && userContext) {
							playerName = userContext;
						}
					} else if (userContext) {
						playerName = userContext;
					}
				}
				
				if (playerName || userContext) {
					const playerEntities = playerName ? [playerName] : (userContext ? [userContext] : []);
					this.lastProcessingSteps.push(`Detected highest goals+assists season question, routing to PlayerDataQueryHandler with player: ${playerEntities[0] || userContext}`);
					return await PlayerDataQueryHandler.queryPlayerData(playerEntities, ["HighestGoalsAssistsSeason"], analysis, userContext);
				} else {
					this.lastProcessingSteps.push(`Highest goals+assists season question detected but no player context available`);
				}
			}

			// Check for "how many seasons have I played where I didn't score any goals" questions
			// Use flexible regex to handle any apostrophe character and word variations
			// Match "didn't" or "didnt" (with any character or none between 'n' and 't') followed by "score" or "scored"
			// Try Unicode punctuation class first, fallback to simple character match
			const didntScoreRegex1 = /didn\p{P}?t\s+scored?/iu;
			const didntScoreRegex2 = /didn.t\s+scored?/i; // . matches any character including apostrophes
			const hasDidntScore = didntScoreRegex1.test(question) || didntScoreRegex2.test(question);
			// Match "any goals", "no goals", "zero goals", "0 goals", "a goal", or "many goals" (user might type this)
			const hasNoGoalsPhrase = /\b(any|no|zero|0|many)\s+goals?\b|\ba\s+goal\b/i.test(question);
			const isSeasonsNoGoalsQuestion = 
				(question.includes("how many seasons") || question.includes("how many season")) &&
				hasDidntScore && hasNoGoalsPhrase &&
				(question.includes("played") || question.includes("play"));

			if (isSeasonsNoGoalsQuestion) {
				// Use entities first, fallback to userContext
				let playerName = "";
				if (entities.length > 0) {
					playerName = entities[0];
					// Fix: If entity is "I" or "my" (from "my", "I", etc.), use userContext instead
					if ((playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my") && userContext) {
						playerName = userContext;
					}
				} else if (userContext) {
					playerName = userContext;
				}

				if (playerName) {
					this.lastProcessingSteps.push(`Detected seasons no goals question, routing to PlayerDataQueryHandler with player: ${playerName}`);
					return await PlayerDataQueryHandler.querySeasonsWithGoalCounts(playerName);
				} else {
					this.lastProcessingSteps.push(`Seasons no goals question detected but no player context available`);
				}
			}

			// Check for "how many goals did I get last season" questions
			const hasGoalsPhrase = question.includes("how many goals") || question.includes("how many goal") || 
				(question.includes("goals") && (question.includes("get") || question.includes("got") || question.includes("score") || question.includes("scored")));
			// More robust detection: check for "last season" in both normalized and original question
			// Also check if question contains "season" and "last" separately (handles spacing variations)
			// Handle common typo "least season" as "last season" when in goals context
			// Check original question before normalization to catch "last" before any text processing
			const originalQuestion = originalQuestionBeforeNormalization || analysis.question?.toLowerCase() || "";
			const hasLastSeasonDirect = question.includes("last season") || originalQuestion.includes("last season");
			const hasLastAndSeason = (question.includes("season") && question.includes("last")) || 
				(originalQuestion.includes("season") && originalQuestion.includes("last"));
			const hasLeastSeasonTypo = (question.includes("least season") || originalQuestion.includes("least season")) && hasGoalsPhrase;
			const hasLastSeason = hasLastSeasonDirect || hasLastAndSeason || hasLeastSeasonTypo ||
				question.match(/\blast\s+season\b/i) || 
				(question.includes("season") && question.match(/\b(?:previous|prior|before)\s+season\b/i));
			// Check if this is a team question - if teamEntities exist, this is NOT a player question
			const hasTeamEntities = analysis.teamEntities && analysis.teamEntities.length > 0;
			const hasExplicitPlayerMention = question.includes("i ") || question.includes(" i") || question.includes("my ") || 
				(entities.length > 0 && !hasTeamEntities && entities.some(e => e.toLowerCase() !== "i" && e.toLowerCase() !== "my"));
			const hasPlayerContext = hasExplicitPlayerMention || (userContext && !hasTeamEntities);
			const isPlayerGoalsLastSeasonQuestion = hasGoalsPhrase && hasLastSeason && hasPlayerContext && !hasTeamEntities;

			if (isPlayerGoalsLastSeasonQuestion) {
				// Use entities first, fallback to userContext
				let playerName = "";
				if (entities.length > 0) {
					playerName = entities[0];
					// Fix: If entity is "I" or "my" (from "my", "I", etc.), use userContext instead
					if ((playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my") && userContext) {
						playerName = userContext;
					}
				} else if (userContext) {
					playerName = userContext;
				}

				if (playerName) {
					this.lastProcessingSteps.push(`Detected player goals last season question, routing to PlayerDataQueryHandler with player: ${playerName}`);
					return await PlayerDataQueryHandler.queryPlayerGoalsLastSeason(playerName);
				} else {
					this.lastProcessingSteps.push(`Player goals last season question detected but no player context available`);
				}
			}

			// Check for "top player in [month] [year]" questions
			const isTopPlayerInMonthQuestion = 
				(question.includes("top player") || question.includes("who was") || question.includes("who is")) &&
				(question.includes("january") || question.includes("february") || question.includes("march") || 
				 question.includes("april") || question.includes("may") || question.includes("june") ||
				 question.includes("july") || question.includes("august") || question.includes("september") ||
				 question.includes("october") || question.includes("november") || question.includes("december")) &&
				question.match(/\d{4}/); // Contains a 4-digit year

			if (isTopPlayerInMonthQuestion) {
				const monthNames = [
					"january", "february", "march", "april", "may", "june",
					"july", "august", "september", "october", "november", "december"
				];
				
				let month = "";
				for (const monthName of monthNames) {
					if (question.includes(monthName)) {
						month = monthName.charAt(0).toUpperCase() + monthName.slice(1);
						break;
					}
				}
				
				const yearMatch = question.match(/\b(\d{4})\b/);
				const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
				
				if (month && year) {
					this.lastProcessingSteps.push(`Detected top player in month question, routing to AwardsQueryHandler with month: ${month}, year: ${year}`);
					return await AwardsQueryHandler.queryPlayersOfTheMonthByDate(month, year);
				}
			}

			// Check for "TOTW in [week] of [month] [year]" questions
			const isTOTWInWeekQuestion = 
				(question.includes("totw") || question.includes("team of the week")) &&
				(question.includes("first week") || question.includes("week") || question.includes("made totw")) &&
				(question.includes("january") || question.includes("february") || question.includes("march") || 
				 question.includes("april") || question.includes("may") || question.includes("june") ||
				 question.includes("july") || question.includes("august") || question.includes("september") ||
				 question.includes("october") || question.includes("november") || question.includes("december")) &&
				question.match(/\d{4}/); // Contains a 4-digit year

			if (isTOTWInWeekQuestion) {
				const monthNames = [
					"january", "february", "march", "april", "may", "june",
					"july", "august", "september", "october", "november", "december"
				];
				
				let month = "";
				for (const monthName of monthNames) {
					if (question.includes(monthName)) {
						month = monthName.charAt(0).toUpperCase() + monthName.slice(1);
						break;
					}
				}
				
				const yearMatch = question.match(/\b(\d{4})\b/);
				const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
				
				// Extract week number if specified, otherwise default to first week
				let weekNumber: number | undefined = undefined;
				if (question.includes("first week")) {
					weekNumber = 1;
				} else {
					const weekMatch = question.match(/\b(\d+)(?:st|nd|rd|th)?\s+week/i);
					if (weekMatch) {
						weekNumber = parseInt(weekMatch[1], 10);
					}
				}
				
				if (month && year) {
					this.lastProcessingSteps.push(`Detected TOTW in week question, routing to AwardsQueryHandler with month: ${month}, year: ${year}, week: ${weekNumber || "first"}`);
					return await AwardsQueryHandler.queryWeeklyTOTWByDate(month, year, weekNumber);
				}
			}

			// Check for winning run queries (wins only)
			const isWinningRunQuestion = 
				(question.includes("winning run") || question.includes("longest winning")) &&
				(analysis.teamEntities && analysis.teamEntities.length > 0 || entities.some(e => /^\d+(?:st|nd|rd|th|s)?$/i.test(e)));

			// Check for unbeaten run queries (wins and draws)
			const isUnbeatenRunQuestion = 
				(question.includes("unbeaten run") || question.includes("longest unbeaten")) &&
				(analysis.teamEntities && analysis.teamEntities.length > 0 || entities.some(e => /^\d+(?:st|nd|rd|th|s)?$/i.test(e)));

			// Check for "which team" winning run questions (e.g., "Which team had the longest winning run in 2022?")
			const isWhichTeamWinningRunQuestion = 
				(question.includes("winning run") || question.includes("longest winning")) &&
				(question.includes("which team") || question.includes("what team")) &&
				!(analysis.teamEntities && analysis.teamEntities.length > 0) &&
				!entities.some(e => /^\d+(?:st|nd|rd|th|s)?$/i.test(e));

			// Check for "which team" unbeaten run questions (e.g., "Which team had the longest unbeaten run in 2022?")
			const isWhichTeamUnbeatenRunQuestion = 
				(question.includes("unbeaten run") || question.includes("longest unbeaten")) &&
				(question.includes("which team") || question.includes("what team")) &&
				!(analysis.teamEntities && analysis.teamEntities.length > 0) &&
				!entities.some(e => /^\d+(?:st|nd|rd|th|s)?$/i.test(e));

			if (isWhichTeamWinningRunQuestion && analysis) {
				this.lastProcessingSteps.push(`Detected which team winning run question, routing to TeamDataQueryHandler`);
				return await TeamDataQueryHandler.queryLongestUnbeatenRunAllTeams(entities, metrics, analysis, false);
			}

			if (isWhichTeamUnbeatenRunQuestion && analysis) {
				this.lastProcessingSteps.push(`Detected which team unbeaten run question, routing to TeamDataQueryHandler`);
				return await TeamDataQueryHandler.queryLongestUnbeatenRunAllTeams(entities, metrics, analysis, true);
			}

			if (isWinningRunQuestion && analysis) {
				this.lastProcessingSteps.push(`Detected winning run question, routing to TeamDataQueryHandler`);
				return await TeamDataQueryHandler.queryLongestUnbeatenRun(entities, metrics, analysis, false);
			}

			if (isUnbeatenRunQuestion && analysis) {
				this.lastProcessingSteps.push(`Detected unbeaten run question, routing to TeamDataQueryHandler`);
				return await TeamDataQueryHandler.queryLongestUnbeatenRun(entities, metrics, analysis, true);
			}

			// Check if this is a player-specific question that was misclassified as team query
			// Pattern: "How many goals has [player] scored for the [team]?"
			// This check must happen BEFORE team goals check to catch misclassified questions
			// First, check for the explicit pattern: "has [name] scored/got for the [team]"
			// This is a strong indicator of a player query, even if type is "team"
			const originalQuestionLower = originalQuestionWithCasing.toLowerCase();
			const hasPlayerScoredForTeamPattern = 
				(question.includes("has") || originalQuestionLower.includes("has")) &&
				(question.includes("scored") || question.includes("got") || originalQuestionLower.includes("scored") || originalQuestionLower.includes("got")) &&
				(question.includes("for the") || question.includes("for") || originalQuestionLower.includes("for the") || originalQuestionLower.includes("for"));
			
			// Extract player name from original question (with casing preserved)
			const extractionResultForRouting = analysis.extractionResult;
			const playerEntitiesFromExtraction = (extractionResultForRouting?.entities?.filter(e => e.type === "player").map(e => e.value) || []);
			const allEntities = [...entities, ...playerEntitiesFromExtraction];
			const potentialPlayerNames = allEntities.filter(e => !/^\d+(?:st|nd|rd|th|s)?$/i.test(e));
			
			// Detect capitalized names in original question
			const originalQuestionForNameDetection = originalQuestionWithCasing;
			const questionWords = originalQuestionForNameDetection.split(/\s+/);
			const commonWords = ["how", "many", "goals", "has", "have", "scored", "got", "for", "the", "1s", "2s", "3s", "4s", "5s", "6s", "7s", "8s", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "xi", "team", "teams"];
			const capitalizedWords = questionWords.filter(w => {
				const cleaned = w.replace(/[?!.,;:]$/, ''); // Remove trailing punctuation
				return /^[A-Z][a-z]+$/.test(cleaned) && !commonWords.includes(cleaned.toLowerCase());
			});
			const hasPlayerNameInQuestion = capitalizedWords.length >= 2; // At least first and last name
			
			// Check for team entity
			const teamEntities = analysis.teamEntities || [];
			const hasTeamEntity = teamEntities.length > 0 || question.match(/\b(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th)\b/i);
			
			// Determine if this is a player goals for team question
			const hasPlayerEntityForTeamCheck = playerEntitiesFromExtraction.length > 0 || potentialPlayerNames.length > 0 || hasPlayerNameInQuestion;
			
			const isPlayerGoalsForTeamQuestion = 
				type === "team" && 
				hasPlayerScoredForTeamPattern &&
				hasPlayerEntityForTeamCheck && 
				hasTeamEntity;
			
			if (isPlayerGoalsForTeamQuestion) {
				// Use player entities from extraction if available, otherwise use potential player names from entities or question
				let playerEntitiesToUse: string[] = [];
				if (playerEntitiesFromExtraction.length > 0) {
					playerEntitiesToUse = playerEntitiesFromExtraction;
				} else if (potentialPlayerNames.length > 0) {
					playerEntitiesToUse = potentialPlayerNames;
				} else if (hasPlayerNameInQuestion && capitalizedWords.length >= 2) {
					// Extract player name from capitalized words (first two words are likely the name)
					playerEntitiesToUse = [capitalizedWords.slice(0, 2).join(" ")];
				} else {
					playerEntitiesToUse = entities;
				}
				
				this.lastProcessingSteps.push(`Detected player goals for team question (was misclassified as team query), routing to PlayerDataQueryHandler with player: ${playerEntitiesToUse[0]}`);
				return await PlayerDataQueryHandler.queryPlayerData(playerEntitiesToUse, metrics, analysis, userContext);
			}

			// Check for team goals questions (including with colloquial terms like "bang in")
			// This must be checked before the switch statement to ensure proper routing
			// BUT: Exclude player-specific questions (e.g., "how many goals has [player] scored for the 1s?")
			const hasPlayerEntityForTeamGoalsCheck = analysis.extractionResult?.entities?.some(e => e.type === "player") || 
				entities.some(e => {
					const lower = e.toLowerCase();
					return !/^\d+(?:st|nd|rd|th|s)?$/i.test(e) && 
						!["i", "me", "my", "myself", "i've", "you", "your", "player", "players"].includes(lower);
				});
			const hasPlayerNamePattern = originalQuestionWithCasing.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+/); // Two capitalized words (likely a name)
			const isPlayerSpecificQuestion = hasPlayerEntityForTeamGoalsCheck || hasPlayerNamePattern || 
				(question.includes("has") && (question.includes("scored") || question.includes("got"))) ||
				(question.includes("have") && (question.includes("scored") || question.includes("got")));
			
			const isTeamGoalsQuestion = 
				!isPlayerSpecificQuestion && // CRITICAL: Exclude player-specific questions
				(question.includes("how many goals") || question.includes("how many goal")) &&
				(question.includes("did") || question.includes("does") || question.includes("do")) &&
				(question.includes("score") || question.includes("scored") || question.includes("bang") || question.includes("put away") || question.includes("net") || question.includes("bag")) &&
				(analysis.teamEntities && analysis.teamEntities.length > 0 || 
				 entities.some(e => /^\d+(?:st|nd|rd|th|s)?$/i.test(e)) ||
				 question.match(/\b(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th)\b/i));

			if (isTeamGoalsQuestion && analysis) {
				this.lastProcessingSteps.push(`Detected team goals question (possibly with colloquial terms), routing to TeamDataQueryHandler`);
				return await TeamDataQueryHandler.queryTeamData(entities, metrics, analysis);
			}

			// Check for "highest win percentage with" questions BEFORE switch statement
			// This must be checked before routing to avoid misclassification as "ranking" type
			const isWinPercentageQuestion = 
				(question.includes("highest win percentage") && question.includes("with")) ||
				(question.includes("win percentage") && question.includes("highest") && question.includes("with")) ||
				(question.includes("best win percentage") && question.includes("with"));
			
			if (isWinPercentageQuestion) {
				this.lastProcessingSteps.push(`Detected win percentage question, routing to PlayerDataQueryHandler`);
				return await PlayerDataQueryHandler.queryPlayerData(entities, metrics, analysis, userContext);
			}

		// Delegate to query handlers
		switch (type) {
			case "player":
				return await PlayerDataQueryHandler.queryPlayerData(entities, metrics, analysis, userContext);
			case "team":
				return await TeamDataQueryHandler.queryTeamData(entities, metrics, analysis);
			case "club":
				return await ClubDataQueryHandler.queryClubData(entities, metrics, analysis);
			case "fixture":
				return await FixtureDataQueryHandler.queryFixtureData(entities, metrics, analysis);
			case "comparison":
				return await this.queryComparisonData(entities, metrics);
			case "streak":
				return await TemporalQueryHandler.queryStreakData(entities, metrics, analysis);
			case "temporal":
				return await TemporalQueryHandler.queryTemporalData(entities, metrics, analysis.timeRange);
			case "double_game":
				return await this.queryDoubleGameData(entities, metrics);
			case "milestone":
				return await this.queryMilestoneData(entities, metrics, analysis);
			case "ranking":
				return await RankingQueryHandler.queryRankingData(entities, metrics, analysis);
			case "league_table":
				return await LeagueTableQueryHandler.queryLeagueTableData(entities, metrics, analysis, userContext);
			case "season_totw":
				// Extract season from timeRange or question text
				let season = analysis.timeRange || "";
				if (!season && analysis.question) {
					// Try to extract season from question (e.g., "2023/24", "22/23")
					const seasonMatch = analysis.question.match(/\b(20\d{2}[/-]20\d{2}|20\d{2}[/-]\d{2}|\d{2}[/-]\d{2})\b/);
					if (seasonMatch) {
						season = seasonMatch[1].replace("-", "/");
						// Normalize "22/23" to "2022/23"
						if (season.match(/^\d{2}\/\d{2}$/)) {
							const parts = season.split("/");
							season = `20${parts[0]}/${parts[1]}`;
						}
					}
				}
				return await AwardsQueryHandler.querySeasonTOTW(season || undefined);
			case "general":
				return await this.queryGeneralData();
			default:
				this.logToBoth(`🔍 Unknown question type: ${type}`, null, "warn");
				return { type: "unknown", data: [], message: "Unknown question type" };
			}
		} catch (error) {
			this.logToBoth(`❌ Error in queryRelevantData:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}


	// queryTeamData removed - now handled by TeamDataQueryHandler
	private async queryTeamData_DELETED(entities: string[], metrics: string[], analysis: EnhancedQuestionAnalysis): Promise<Record<string, unknown>> {
		this.logToBoth(`🔍 queryTeamData called with entities: ${entities}, metrics: ${metrics}`, null, "log");

		const question = analysis.question?.toLowerCase() || "";
		const teamEntities = analysis.teamEntities || [];
		const extractedMetrics = metrics || [];
		
		// Extract team name from entities or question
		let teamName = "";
		if (teamEntities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
		} else if (entities.length > 0) {
			// Try to extract from entities (might be team names)
			teamName = TeamMappingUtils.mapTeamName(entities[0]);
		} else {
			// Try to extract from question text
			const teamMatch = question.match(/(\d+)(?:st|nd|rd|th)?\s*(?:team|s|xi)/i);
			if (teamMatch) {
				const teamNum = teamMatch[1];
				teamName = TeamMappingUtils.mapTeamName(`${teamNum}s`);
			}
		}

		if (!teamName) {
			this.logToBoth(`⚠️ No team name found in queryTeamData`, null, "warn");
			return { type: "team_not_found", data: [], message: "Could not identify team from question" };
		}

		// Map metric keys to MatchDetail field names
		const metricToFieldMap: { [key: string]: string } = {
			"G": "goals",
			"A": "assists",
			"R": "redCards",
			"Y": "yellowCards",
			"APP": "appearances", // Special case - count
			"MOM": "mom",
			"SAVES": "saves",
			"CLS": "cleanSheets",
			"OG": "ownGoals",
			"C": "conceded",
			"MIN": "minutes",
			"PSC": "penaltiesScored",
			"PM": "penaltiesMissed",
			"PCO": "penaltiesConceded",
			"PSV": "penaltiesSaved",
		};

		// Find the primary metric from question text keywords FIRST (most reliable) - Then fall back to extracted metrics if no keywords found
		let detectedMetric: string | null = null;
		let metricField: string | null = null;
		
		// Check question text for explicit metric keywords first (highest priority) - This ensures "red cards" is detected even if extraction incorrectly identifies "G"
		const questionLower = question.toLowerCase();
		if (questionLower.includes("red card") || questionLower.includes("reds")) {
			detectedMetric = "R";
			metricField = "redCards";
			this.logToBoth(`✅ Detected metric from question text: R (redCards)`, null, "log");
		} else if (questionLower.includes("yellow card") || questionLower.includes("booking") || questionLower.includes("yellows")) {
			detectedMetric = "Y";
			metricField = "yellowCards";
			this.logToBoth(`✅ Detected metric from question text: Y (yellowCards)`, null, "log");
		} else if (questionLower.includes("assist")) {
			detectedMetric = "A";
			metricField = "assists";
			this.logToBoth(`✅ Detected metric from question text: A (assists)`, null, "log");
		} else if (questionLower.includes("clean sheet")) {
			detectedMetric = "CLS";
			metricField = "cleanSheets";
			this.logToBoth(`✅ Detected metric from question text: CLS (cleanSheets)`, null, "log");
		} else if (questionLower.includes("save")) {
			detectedMetric = "SAVES";
			metricField = "saves";
			this.logToBoth(`✅ Detected metric from question text: SAVES (saves)`, null, "log");
		} else if (questionLower.includes("man of the match") || questionLower.includes("mom")) {
			detectedMetric = "MOM";
			metricField = "mom";
			this.logToBoth(`✅ Detected metric from question text: MOM (mom)`, null, "log");
		} else if (questionLower.includes("appearance") || questionLower.includes("app") || questionLower.includes("game")) {
			detectedMetric = "APP";
			metricField = "appearances";
			this.logToBoth(`✅ Detected metric from question text: APP (appearances)`, null, "log");
		}
		
		// If no metric found from question text, check extracted metrics
		if (!detectedMetric && extractedMetrics.length > 0) {
			const primaryMetric = extractedMetrics[0].toUpperCase();
			if (metricToFieldMap[primaryMetric]) {
				detectedMetric = primaryMetric;
				metricField = metricToFieldMap[primaryMetric];
				this.logToBoth(`✅ Detected metric from extracted metrics: ${detectedMetric} (${metricField})`, null, "log");
			}
		}
		
		// Determine goals-specific flags (only if no other metric detected)
		const isGoalsConceded = !detectedMetric && question.includes("conceded");
		const isOpenPlayGoals = question.includes("open play") || question.includes("openplay") || extractedMetrics.some(m => m.toUpperCase() === "OPENPLAYGOALS" || m.toUpperCase() === "OPENPLAY");
		const isGoalsScored = !detectedMetric && (question.includes("scored") || (question.includes("goals") && !isGoalsConceded));

		// Extract season and date range filters
		const timeRange = analysis.timeRange;
		const timeFrames = analysis.extractionResult?.timeFrames || [];
		
		// Extract season from timeFrames or question
		let season: string | null = null;
		const seasonFrame = timeFrames.find(tf => tf.type === "season");
		if (seasonFrame) {
			season = seasonFrame.value;
			// Normalize season format (2016-17 -> 2016/17)
			season = season.replace("-", "/");
		} else {
			// Try to extract from question directly
			const seasonMatch = question.match(/(\d{4})[\/\-](\d{2})/);
			if (seasonMatch) {
				season = `${seasonMatch[1]}/${seasonMatch[2]}`;
			}
		}
		
		// Extract date range from timeRange or question
		let startDate: string | null = null;
		let endDate: string | null = null;
		
		// First, try to extract from timeRange
		if (timeRange && timeRange.includes(" to ")) {
			const dateRange = timeRange.split(" to ");
			if (dateRange.length === 2) {
				startDate = DateUtils.convertDateFormat(dateRange[0].trim());
				endDate = DateUtils.convertDateFormat(dateRange[1].trim());
			}
		}
		
		// If no date range found, check question for "between X and Y" patterns
		if (!startDate || !endDate) {
			// Check for full date format: "between DD/MM/YYYY and DD/MM/YYYY"
			const betweenDateMatch = question.match(/between\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+and\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
			if (betweenDateMatch) {
				startDate = DateUtils.convertDateFormat(betweenDateMatch[1]);
				endDate = DateUtils.convertDateFormat(betweenDateMatch[2]);
			} else {
				// Check for year-only format: "between YYYY and YYYY"
				const betweenYearMatch = question.match(/between\s+(\d{4})\s+and\s+(\d{4})/i);
				if (betweenYearMatch) {
					const startYear = parseInt(betweenYearMatch[1], 10);
					const endYear = parseInt(betweenYearMatch[2], 10);
					// Convert to full date range: 01/01/YYYY to 31/12/YYYY
					startDate = `${startYear}-01-01`;
					endDate = `${endYear}-12-31`;
					this.logToBoth(`✅ Extracted year range: ${startYear} to ${endYear} -> ${startDate} to ${endDate}`, null, "log");
				}
			}
		}
		
		// Also check timeFrames for range type
		if (!startDate || !endDate) {
			const rangeFrame = timeFrames.find(tf => tf.type === "range");
			if (rangeFrame && rangeFrame.value.includes(" to ")) {
				const dateRange = rangeFrame.value.split(" to ");
				if (dateRange.length === 2) {
					// Check if it's year-only format
					const startYearMatch = dateRange[0].trim().match(/^(\d{4})$/);
					const endYearMatch = dateRange[1].trim().match(/^(\d{4})$/);
					if (startYearMatch && endYearMatch) {
						const startYear = parseInt(startYearMatch[1], 10);
						const endYear = parseInt(endYearMatch[1], 10);
						startDate = `${startYear}-01-01`;
						endDate = `${endYear}-12-31`;
						this.logToBoth(`✅ Extracted year range from timeFrames: ${startYear} to ${endYear} -> ${startDate} to ${endDate}`, null, "log");
					} else {
						// Try to convert as full dates
						startDate = DateUtils.convertDateFormat(dateRange[0].trim());
						endDate = DateUtils.convertDateFormat(dateRange[1].trim());
					}
				}
			}
		}

		const graphLabel = neo4jService.getGraphLabel();
		const params: Record<string, unknown> = { graphLabel, teamName };
		
		// Build WHERE conditions for filters
		const whereConditions: string[] = [`f.team = $teamName`];
		
		// Add season filter
		if (season) {
			params.season = season;
			// Also try normalized version (hyphen format)
			const normalizedSeason = season.replace("/", "-");
			params.normalizedSeason = normalizedSeason;
			whereConditions.push(`(f.season = $season OR f.season = $normalizedSeason)`);
		}
		
		// Add date range filter
		if (startDate && endDate) {
			params.startDate = startDate;
			params.endDate = endDate;
			whereConditions.push(`f.date >= $startDate AND f.date <= $endDate`);
		}

		// Build query based on what metric is being asked about - Prioritize detected metric over goals
		let query = "";
		if (detectedMetric && metricField) {
			// Query MatchDetail for the detected metric
			if (metricField === "appearances") {
				// Appearances is a count, not a sum
				query = `
					MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md:MatchDetail {graphLabel: $graphLabel})
					WHERE ${whereConditions.join(" AND ")} AND md.team = $teamName
					RETURN 
						count(md) as value,
						count(DISTINCT f) as gamesPlayed
				`;
			} else {
				// Other stats are sums
				query = `
					MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md:MatchDetail {graphLabel: $graphLabel})
					WHERE ${whereConditions.join(" AND ")} AND md.team = $teamName
					RETURN 
						coalesce(sum(md.${metricField}), 0) as value,
						count(DISTINCT f) as gamesPlayed
				`;
			}
		} else {
			// Default: Query fixtures for team goals
			query = `
				MATCH (f:Fixture {graphLabel: $graphLabel})
				WHERE ${whereConditions.join(" AND ")}
				RETURN 
					coalesce(sum(f.dorkiniansGoals), 0) as goalsScored,
					coalesce(sum(f.conceded), 0) as goalsConceded,
					count(f) as gamesPlayed
			`;
		}

		this.lastExecutedQueries.push(`TEAM_DATA: ${query}`);
		this.lastExecutedQueries.push(`TEAM_DATA_PARAMS: ${JSON.stringify(params)}`);

		try {
			const result = await neo4jService.executeQuery(query, params);
			this.logToBoth(`🔍 Team data query result:`, result, "log");

			if (result && result.length > 0) {
				const teamStats = result[0];
				if (detectedMetric && metricField) {
					return {
						type: "team_stats",
						teamName,
						value: teamStats.value || 0,
						gamesPlayed: teamStats.gamesPlayed || 0,
						metric: detectedMetric,
						metricField: metricField,
						season: season || undefined,
						startDate: startDate || undefined,
						endDate: endDate || undefined,
					};
				} else {
					return {
						type: "team_stats",
						teamName,
						goalsScored: teamStats.goalsScored || 0,
						goalsConceded: teamStats.goalsConceded || 0,
						gamesPlayed: teamStats.gamesPlayed || 0,
						isGoalsScored,
						isGoalsConceded,
						isOpenPlayGoals,
					};
				}
			}

			if (detectedMetric && metricField) {
				return { 
					type: "team_stats", 
					teamName, 
					value: 0, 
					gamesPlayed: 0, 
					metric: detectedMetric, 
					metricField: metricField,
					season: season || undefined,
					startDate: startDate || undefined,
					endDate: endDate || undefined,
				};
			} else {
				return { type: "team_stats", teamName, goalsScored: 0, goalsConceded: 0, gamesPlayed: 0, isGoalsScored, isGoalsConceded, isOpenPlayGoals };
			}
		} catch (error) {
			this.logToBoth(`❌ Error in queryTeamData:`, error, "error");
			return { type: "error", data: [], error: "Error querying team data" };
		}
	}

	private async queryClubData(entities: string[], metrics: string[], analysis: EnhancedQuestionAnalysis): Promise<Record<string, unknown>> {
		this.logToBoth(`🔍 queryClubData called with entities: ${entities}, metrics: ${metrics}`, null, "log");

		const question = analysis.question?.toLowerCase() || "";
		
		// Determine what metric is being asked about - Check for "conceded" first to avoid false positives
		const isGoalsConceded = question.includes("conceded");
		const isGoalsScored = question.includes("scored") || (question.includes("goals") && !isGoalsConceded);
		const isPlayerCount = question.includes("players") || question.includes("played for");

		const graphLabel = neo4jService.getGraphLabel();
		const params: any = {
			graphLabel,
		};

		try {
			// Query fixtures for club-wide goals
			const goalsQuery = `
				MATCH (f:Fixture {graphLabel: $graphLabel})
				RETURN 
					coalesce(sum(f.dorkiniansGoals), 0) as goalsScored,
					coalesce(sum(f.conceded), 0) as goalsConceded,
					count(f) as gamesPlayed
			`;

			this.lastExecutedQueries.push(`CLUB_GOALS_DATA: ${goalsQuery}`);
			this.lastExecutedQueries.push(`CLUB_GOALS_PARAMS: ${JSON.stringify(params)}`);

			const goalsResult = await neo4jService.executeQuery(goalsQuery, params);
			this.logToBoth(`🔍 Club goals query result:`, goalsResult, "log");

			let goalsScored = 0;
			let goalsConceded = 0;
			let gamesPlayed = 0;

			if (goalsResult && goalsResult.length > 0) {
				goalsScored = goalsResult[0].goalsScored || 0;
				goalsConceded = goalsResult[0].goalsConceded || 0;
				gamesPlayed = goalsResult[0].gamesPlayed || 0;
			}

			// Query players count if needed
			let numberOfPlayers = 0;
			if (isPlayerCount) {
				const playersQuery = `
					MATCH (p:Player {graphLabel: $graphLabel})
					WHERE p.allowOnSite = true
					RETURN count(DISTINCT p.playerName) as numberOfPlayers
				`;

				this.lastExecutedQueries.push(`CLUB_PLAYERS_DATA: ${playersQuery}`);
				this.lastExecutedQueries.push(`CLUB_PLAYERS_PARAMS: ${JSON.stringify(params)}`);

				const playersResult = await neo4jService.executeQuery(playersQuery, params);
				this.logToBoth(`🔍 Club players query result:`, playersResult, "log");

				if (playersResult && playersResult.length > 0) {
					numberOfPlayers = playersResult[0].numberOfPlayers || 0;
				}
			}

			return {
				type: "club_stats",
				goalsScored,
				goalsConceded,
				gamesPlayed,
				numberOfPlayers,
				isGoalsScored,
				isGoalsConceded,
				isPlayerCount,
			};
		} catch (error) {
			this.logToBoth(`❌ Error in queryClubData:`, error, "error");
			return { type: "error", data: [], error: "Error querying club data" };
		}
	}

	private async queryFixtureData(
		entities: string[],
		_metrics: string[],
		analysis?: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		
		// Extract team name from entities or analysis
		let teamName = "";
		if (analysis?.teamEntities && analysis.teamEntities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(analysis.teamEntities[0]);
		} else if (entities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(entities[0]);
		}
		
		if (!teamName) {
			this.logToBoth(`⚠️ No team name found in queryFixtureData`, null, "warn");
			return { type: "team_not_found", data: [], message: "Could not identify team from question" };
		}
		
		// Extract date range from time frames
		let startDate: string | null = null;
		let endDate: string | null = null;
		
		if (analysis?.extractionResult?.timeFrames) {
			const timeFrames = analysis.extractionResult.timeFrames;
			
			// Check for ordinal weekend pattern
			const ordinalWeekendFrame = timeFrames.find(tf => tf.type === "ordinal_weekend");
			if (ordinalWeekendFrame) {
				// Parse "weekend_1_2023" format
				const match = ordinalWeekendFrame.value.match(/weekend_(\d+)_(\d{4})/);
				if (match) {
					const ordinal = parseInt(match[1], 10);
					const year = parseInt(match[2], 10);
					const dates = this.calculateWeekendDates(year, ordinal);
					startDate = dates.startDate;
					endDate = dates.endDate;
				}
			} else {
				// Check for date range
				const rangeFrame = timeFrames.find(tf => tf.type === "range");
				if (rangeFrame && rangeFrame.value.includes(" to ")) {
					const dateRange = rangeFrame.value.split(" to ");
					if (dateRange.length === 2) {
						startDate = DateUtils.convertDateFormat(dateRange[0].trim());
						endDate = DateUtils.convertDateFormat(dateRange[1].trim());
					}
				} else {
					// Check for single date
					const dateFrame = timeFrames.find(tf => tf.type === "date");
					if (dateFrame) {
						const convertedDate = DateUtils.convertDateFormat(dateFrame.value);
						startDate = convertedDate;
						endDate = convertedDate;
					}
				}
			}
		}
		
		// Build query
		const params: Record<string, unknown> = {
			graphLabel,
			teamName,
		};
		
		let query = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
			WHERE f.team = $teamName
		`;
		
		if (startDate && endDate) {
			// Log calculated dates for debugging
			this.logToBoth(`🔍 Calculated weekend dates - startDate: ${startDate}, endDate: ${endDate}, teamName: ${teamName}`, null, "log");
			query += ` AND f.date >= $startDate AND f.date <= $endDate`;
			params.startDate = startDate;
			params.endDate = endDate;
		}
		
		query += `
			RETURN f.opposition as opposition, f.date as date, f.homeOrAway as homeOrAway
			ORDER BY f.date ASC
		`;
		
		this.lastExecutedQueries.push(`FIXTURE_QUERY: ${query}`);
		this.lastExecutedQueries.push(`FIXTURE_PARAMS: ${JSON.stringify(params)}`);
		
		try {
			const result = await neo4jService.executeQuery(query, params);
			this.logToBoth(`🔍 Fixture query result count: ${result?.length || 0}`, null, "log");
			
			if (!result || result.length === 0) {
				this.logToBoth(`⚠️ No fixtures found for ${teamName}${startDate && endDate ? ` between ${startDate} and ${endDate}` : ""}`, null, "warn");
				return {
					type: "opposition_query",
					teamName,
					oppositions: [],
					dates: startDate && endDate ? { start: startDate, end: endDate } : undefined,
					message: `No fixtures found for ${teamName}${startDate && endDate ? ` between ${startDate} and ${endDate}` : ""}`,
				};
			}
			
			this.logToBoth(`✅ Found ${result.length} fixture(s) for ${teamName}`, null, "log");
			
			const oppositions = result.map((r: { opposition: string; date: string; homeOrAway?: string }) => ({
				name: r.opposition,
				date: r.date,
				homeOrAway: r.homeOrAway,
			}));
			
			return {
				type: "opposition_query",
				teamName,
				oppositions,
				dates: startDate && endDate ? { start: startDate, end: endDate } : undefined,
			};
		} catch (error) {
			this.logToBoth(`❌ Error in queryFixtureData:`, error, "error");
			return {
				type: "error",
				data: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private async queryDoubleGameData(entities: string[], _metrics: string[]): Promise<Record<string, unknown>> {
		if (entities.length === 0) {
			return { type: "no_context", data: [], message: "No player context provided" };
		}

		const playerName = entities[0];
		const graphLabel = neo4jService.getGraphLabel();
		const params = { playerName, graphLabel };
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.seasonWeek IS NOT NULL AND md.seasonWeek <> ""
			WITH md.seasonWeek as seasonWeek, collect(md) as matches
			WITH seasonWeek, size(matches) as matchCount
			WHERE matchCount > 1
			RETURN count(seasonWeek) as doubleGameWeekCount
		`;

		// Log query for debug info
		this.lastExecutedQueries.push(`DOUBLE_GAME_WEEKS: ${query}`);
		this.lastExecutedQueries.push(`DOUBLE_GAME_WEEKS_PARAMS: ${JSON.stringify(params)}`);

		try {
			const result = await neo4jService.executeQuery(query, params);
			const count = result && result.length > 0 && result[0].doubleGameWeekCount !== undefined 
				? (typeof result[0].doubleGameWeekCount === 'number' 
					? result[0].doubleGameWeekCount 
					: (result[0].doubleGameWeekCount?.low || 0) + (result[0].doubleGameWeekCount?.high || 0) * 4294967296)
				: 0;
			return { type: "double_game", data: [{ value: count }], count, playerName };
		} catch (error) {
			this.logToBoth(`❌ Error in double game query:`, error, "error");
			return { type: "error", data: [], error: "Error querying double game data" };
		}
	}

	private async queryMilestoneData(entities: string[], _metrics: string[], analysis: EnhancedQuestionAnalysis): Promise<Record<string, unknown>> {
		const lowerQuestion = (analysis.question || "").toLowerCase();
		
		// Determine stat type from question first (before extracting milestone number)
		let statType: string | null = null;
		if (lowerQuestion.includes("goal")) {
			statType = "Goals";
		} else if (lowerQuestion.includes("app") || lowerQuestion.includes("appearance")) {
			statType = "Apps";
		} else if (lowerQuestion.includes("assist")) {
			statType = "Assists";
		} else if (lowerQuestion.includes("mom")) {
			statType = "MoMs";
		}
		
		// Extract milestone number from question (e.g., "100", "50", "25") - Try pattern: digit followed by stat type keyword
		const milestoneMatch = lowerQuestion.match(/\b(\d+)\s*(?:goal|app|appearance|assist|mom|milestone)/);
		let milestoneNumber = milestoneMatch ? parseInt(milestoneMatch[1], 10) : null;
		
		// If milestone number not found, try to extract from "next X" pattern (X can be before or after "next")
		if (!milestoneNumber) {
			// Try "next X" pattern
			const nextMilestoneMatch = lowerQuestion.match(/next\s+(\d+)/);
			if (nextMilestoneMatch) {
				milestoneNumber = parseInt(nextMilestoneMatch[1], 10);
			} else {
				// Try "X milestone next" pattern (number before "milestone" with "next" at end)
				const milestoneNextMatch = lowerQuestion.match(/\b(\d+)\s*(?:goal|app|appearance|assist|mom|milestone).*next/);
				if (milestoneNextMatch) {
					milestoneNumber = parseInt(milestoneNextMatch[1], 10);
				}
			}
		}
		
		// If we have both milestone and stat type, fetch the data
		if (milestoneNumber && statType) {
			return await this.fetchMilestoneData(milestoneNumber, statType);
		}
		
		// If we have milestone but no stat type, try to infer from context or default to Goals
		if (milestoneNumber && !statType) {
			statType = "Goals"; // Default to Goals if not specified
			return await this.fetchMilestoneData(milestoneNumber, statType);
		}
		
		// Fallback: try to find closest to any milestone for the detected stat type
		if (statType) {
			// Try common milestones: 10, 25, 50, 100, 150, 200, 250, 300
			const commonMilestones = [300, 250, 200, 150, 100, 50, 25, 10];
			for (const milestone of commonMilestones) {
				const result = await this.fetchMilestoneData(milestone, statType);
				if (result && result.type === "milestone" && result.players && Array.isArray(result.players) && result.players.length > 0) {
					return result;
				}
			}
		}
		
		return { type: "error", data: [], error: "Could not determine milestone or stat type from question" };
	}
	
	private async fetchMilestoneData(milestone: number, statType: string): Promise<Record<string, unknown>> {
		try {
			// Map stat type label to database field name
			const statTypeToField: { [key: string]: string } = {
				"Goals": "goals",
				"Assists": "assists",
				"Apps": "appearances",
				"MoMs": "mom",
			};
			
			const statField = statTypeToField[statType];
			if (!statField) {
				return { type: "error", data: [], error: `Invalid stat type: ${statType}` };
			}
			
			// Connect to Neo4j
			const connected = await neo4jService.connect();
			if (!connected) {
				return { type: "error", data: [], error: "Database connection failed" };
			}
			
			const graphLabel = neo4jService.getGraphLabel();
			
			// Build query based on stat type (Cypher doesn't support parameterized CASE values)
			let aggregationExpression: string;
			if (statField === "goals") {
				aggregationExpression = "reduce(total = 0, md in matchDetails | total + coalesce(md.goals, 0))";
			} else if (statField === "assists") {
				aggregationExpression = "reduce(total = 0, md in matchDetails | total + coalesce(md.assists, 0))";
			} else if (statField === "appearances") {
				aggregationExpression = "size(matchDetails)";
			} else if (statField === "mom") {
				aggregationExpression = "reduce(total = 0, md in matchDetails | total + coalesce(md.mom, 0))";
			} else {
				return { type: "error", data: [], error: `Unsupported stat field: ${statField}` };
			}
			
			// Query all players with their stats, filter for those close to the milestone - We want players who haven't reached the milestone yet and are within a reasonable distance
			const query = `
				MATCH (p:Player {graphLabel: $graphLabel})
				WHERE p.allowOnSite = true
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				WITH p, md
				ORDER BY md.date ASC
				WITH p,
					collect(md) as matchDetails
				WITH p,
					${aggregationExpression} as currentValue
				WHERE currentValue < $milestone
				WITH p.playerName as playerName, currentValue, ($milestone - currentValue) as distanceFromMilestone
				ORDER BY distanceFromMilestone ASC, currentValue DESC
				LIMIT 5
				RETURN playerName, currentValue, distanceFromMilestone
			`;
			
			const params = {
				graphLabel,
				milestone,
			};
			
			this.lastExecutedQueries.push(`MILESTONE_QUERY: ${query}`);
			this.lastExecutedQueries.push(`MILESTONE_PARAMS: ${JSON.stringify(params)}`);
			
			const result = await neo4jService.runQuery(query, params);
			
			// Convert Neo4j Integer to JavaScript number
			const toNumber = (value: any): number => {
				if (value === null || value === undefined) return 0;
				if (typeof value === "number") return value;
				if (typeof value === "object" && "toNumber" in value) {
					return (value as { toNumber: () => number }).toNumber();
				}
				const num = parseInt(String(value), 10);
				return isNaN(num) ? 0 : num;
			};
			
			const players: Array<{
				playerName: string;
				statType: string;
				milestone: number;
				currentValue: number;
				distanceFromMilestone: number;
			}> = [];
			
			for (const record of result.records) {
				const playerName = String(record.get("playerName") || "");
				if (!playerName || playerName.trim() === "") continue;
				
				const currentValue = toNumber(record.get("currentValue"));
				const distanceFromMilestone = toNumber(record.get("distanceFromMilestone"));
				
				players.push({
					playerName,
					statType,
					milestone,
					currentValue,
					distanceFromMilestone,
				});
			}
			
			if (players.length === 0) {
				return { type: "error", data: [], error: `No player found close to ${milestone} ${statType} milestone` };
			}
			
			return {
				type: "milestone",
				players: players,
				statType: statType,
				milestone: milestone,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logToBoth(`❌ Error in milestone query: ${errorMessage}`, error, "error");
			this.logToBoth(`❌ Error stack: ${error instanceof Error ? error.stack : "No stack trace"}`, null, "error");
			return { type: "error", data: [], error: `Error querying milestone data: ${errorMessage}` };
		}
	}

	private async queryGeneralData(): Promise<Record<string, unknown>> {
		// Query for general information about the database
		const query = `
      MATCH (p:Player)
      RETURN count(p) as totalPlayers
    `;

		const result = await neo4jService.executeQuery(query);
		return result as unknown as Record<string, unknown>;
	}

	private async queryLeagueTableData(
		entities: string[],
		_metrics: string[],
		analysis: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		this.logToBoth(`🔍 queryLeagueTableData called with entities: ${entities}`, null, "log");

		try {
			// Extract team name and season from entities and question
			const question = analysis.question?.toLowerCase() || "";
			const teamEntities = analysis.teamEntities || [];
			
			// Check for team-specific highest/lowest position queries
			const isTeamHighestQuery = 
				teamEntities.length > 0 &&
				(question.includes("highest position") ||
				question.includes("best position") ||
				question.includes("best finish") ||
				(question.includes("highest") && (question.includes("position") || question.includes("finish"))));
			
			const isTeamLowestQuery = 
				teamEntities.length > 0 &&
				(question.includes("lowest position") ||
				question.includes("worst position") ||
				question.includes("worst finish") ||
				(question.includes("lowest") && (question.includes("position") || question.includes("finish"))));
			
			// Handle team-specific highest position query
			if (isTeamHighestQuery) {
				const teamName = teamEntities[0];
				const { getTeamHighestPosition } = await import("../services/leagueTableService");
				const result = await getTeamHighestPosition(teamName);
				
				if (!result) {
					return {
						type: "not_found",
						data: [],
						message: `I couldn't find any historical league position data for the ${teamName}.`,
					};
				}
				
				const positionSuffix = result.position.position === 1 ? "st" : result.position.position === 2 ? "nd" : result.position.position === 3 ? "rd" : "th";
				
				return {
					type: "league_table",
					data: [result.position],
					fullTable: result.fullTable,
					season: result.position.season,
					division: result.division,
					answer: `The ${teamName}'s highest league finish was ${result.position.position}${positionSuffix} position in ${result.position.season} (${result.division}). They finished with ${result.position.points} points from ${result.position.played} games (${result.position.won} wins, ${result.position.drawn} draws, ${result.position.lost} losses).`,
				};
			}
			
			// Handle team-specific lowest position query
			if (isTeamLowestQuery) {
				const teamName = teamEntities[0];
				const { getTeamLowestPosition } = await import("../services/leagueTableService");
				const result = await getTeamLowestPosition(teamName);
				
				if (!result) {
					return {
						type: "not_found",
						data: [],
						message: `I couldn't find any historical league position data for the ${teamName}.`,
					};
				}
				
				const positionSuffix = result.position.position === 1 ? "st" : result.position.position === 2 ? "nd" : result.position.position === 3 ? "rd" : "th";
				
				return {
					type: "league_table",
					data: [result.position],
					fullTable: result.fullTable,
					season: result.position.season,
					division: result.division,
					answer: `The ${teamName}'s lowest league finish was ${result.position.position}${positionSuffix} position in ${result.position.season} (${result.division}). They finished with ${result.position.points} points from ${result.position.played} games (${result.position.won} wins, ${result.position.drawn} draws, ${result.position.lost} losses).`,
				};
			}
			
			// Check for "highest league finish" queries (no team name required)
			const isHighestFinishQuery = 
				question.includes("highest league finish") ||
				question.includes("best league position") ||
				question.includes("best league finish") ||
				(question.includes("highest") && question.includes("league") && question.includes("finish")) ||
				(question.includes("my") && question.includes("highest") && (question.includes("finish") || question.includes("position")));
			
			if (isHighestFinishQuery) {
				// Import league table service
				const { getHighestLeagueFinish, getSeasonDataFromJSON, getCurrentSeasonDataFromNeo4j, normalizeSeasonFormat } = await import("../services/leagueTableService");
				const bestFinish = await getHighestLeagueFinish();
				
				if (!bestFinish) {
					return {
						type: "not_found",
						data: [],
						message: "I couldn't find any historical league position data.",
					};
				}
				
				// Get full league table for this season
				const normalizedSeason = normalizeSeasonFormat(bestFinish.season, 'hyphen');
				const seasonData = await getSeasonDataFromJSON(normalizedSeason);
				let fullTable = seasonData?.teams[bestFinish.team]?.table || [];
				
				// If not found in JSON, try current season from Neo4j
				if (fullTable.length === 0) {
					const currentSeasonData = await getCurrentSeasonDataFromNeo4j();
					if (currentSeasonData && normalizeSeasonFormat(currentSeasonData.season, 'slash') === normalizeSeasonFormat(bestFinish.season, 'slash')) {
						fullTable = currentSeasonData.teams[bestFinish.team]?.table || [];
					}
				}
				
				const positionSuffix = bestFinish.position === 1 ? "st" : bestFinish.position === 2 ? "nd" : bestFinish.position === 3 ? "rd" : "th";
				
				return {
					type: "league_table",
					data: [bestFinish],
					fullTable: fullTable,
					season: bestFinish.season,
					division: bestFinish.division,
					answer: `Your highest league finish was ${bestFinish.position}${positionSuffix} position with the ${bestFinish.team} in ${bestFinish.season} (${bestFinish.division}). They finished with ${bestFinish.points} points from ${bestFinish.played} games (${bestFinish.won} wins, ${bestFinish.drawn} draws, ${bestFinish.lost} losses).`,
				};
			}
			
			// Find team entity (1s, 2s, 3s, etc.)
			let teamName = "";
			if (teamEntities.length > 0) {
				teamName = teamEntities[0];
			} else {
				// Try to extract from question
				const teamMatch = question.match(/\b(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th)\b/);
				if (teamMatch) {
					const teamStr = teamMatch[1];
					// Convert to standard format
					if (teamStr.includes("st") || teamStr.includes("nd") || teamStr.includes("rd") || teamStr.includes("th")) {
						const num = teamStr.match(/\d+/)?.[0];
						if (num) {
							teamName = `${num}s`;
						}
					} else {
						teamName = teamStr;
					}
				}
			}

			// Check for "currently" or "current season" keywords
			const isCurrentSeasonQuery = 
				question.includes("currently") ||
				question.includes("current season") ||
				question.includes("current") && (question.includes("position") || question.includes("table"));

			// Extract season from question or timeRange
			let season = analysis.timeRange || "";
			if (!season && !isCurrentSeasonQuery) {
				// Try to extract season from question (e.g., "2019/20", "2019-20", "2019/2020")
				const seasonMatch = question.match(/\b(20\d{2}[/-]20\d{2}|20\d{2}[/-]\d{2})\b/);
				if (seasonMatch) {
					// Normalize to slash format
					season = seasonMatch[1].replace("-", "/");
				}
			}

			if (!teamName && !isHighestFinishQuery) {
				return {
					type: "no_team",
					data: [],
					message: "I need to know which team you're asking about. Please specify (e.g., 1s, 2s, 3s, etc.)",
				};
			}

			// Import league table service
			const { getTeamSeasonData, getCurrentSeasonDataFromNeo4j, normalizeSeasonFormat } = await import("../services/leagueTableService");
			
			// Normalize season format if present (ensure slash format for consistency)
			if (season) {
				season = normalizeSeasonFormat(season, 'slash');
			}

			// If season specified and not current season query, get that season's data
			if (season && !isCurrentSeasonQuery) {
				// Normalize season format before querying
				const normalizedSeason = normalizeSeasonFormat(season, 'slash');
				const teamData = await getTeamSeasonData(teamName, normalizedSeason);
				
				if (!teamData) {
					return {
						type: "not_found",
						data: [],
						message: `I couldn't find league table data for the ${teamName} in ${season}.`,
					};
				}

				// Get full league table for this season and team
				const { getSeasonDataFromJSON } = await import("../services/leagueTableService");
				const seasonData = await getSeasonDataFromJSON(normalizedSeason);
				const fullTable = seasonData?.teams[teamName]?.table || [];

				const positionSuffix = teamData.position === 1 ? "st" : teamData.position === 2 ? "nd" : teamData.position === 3 ? "rd" : "th";
				const division = seasonData?.teams[teamName]?.division || "";
				
				return {
					type: "league_table",
					data: [teamData],
					fullTable: fullTable,
					season: normalizedSeason,
					division: division,
					answer: `The ${teamName} finished in ${teamData.position}${positionSuffix} position in the league in ${season}, with ${teamData.points} points from ${teamData.played} games (${teamData.won} wins, ${teamData.drawn} draws, ${teamData.lost} losses).`,
				};
			}

			// No season specified or current season query - get current season
			const currentSeasonData = await getCurrentSeasonDataFromNeo4j(teamName);
			if (!currentSeasonData || !currentSeasonData.teams[teamName]) {
				return {
					type: "not_found",
					data: [],
					message: `I couldn't find current season league table data for the ${teamName}.`,
				};
			}

			const teamData = currentSeasonData.teams[teamName];
			if (!teamData || !teamData.table) {
				return {
					type: "not_found",
					data: [],
					message: `I couldn't find current season league table data for the ${teamName}.`,
				};
			}

			const dorkiniansEntry = teamData.table.find((entry) => entry.team.toLowerCase().includes("dorkinians"));
			
			if (!dorkiniansEntry) {
				return {
					type: "not_found",
					data: [],
					message: `I couldn't find Dorkinians' position in the ${teamName} league table for the current season.`,
				};
			}

			const positionSuffix = dorkiniansEntry.position === 1 ? "st" : dorkiniansEntry.position === 2 ? "nd" : dorkiniansEntry.position === 3 ? "rd" : "th";
			const fullTable = teamData.table || [];
			const division = teamData.division || "";
			
			return {
				type: "league_table",
				data: [dorkiniansEntry],
				fullTable: fullTable,
				season: currentSeasonData.season,
				division: division,
				answer: `The ${teamName} are currently in ${dorkiniansEntry.position}${positionSuffix} position in the league for ${currentSeasonData.season}, with ${dorkiniansEntry.points} points from ${dorkiniansEntry.played} games (${dorkiniansEntry.won} wins, ${dorkiniansEntry.drawn} draws, ${dorkiniansEntry.lost} losses).`,
			};
		} catch (error) {
			this.logToBoth(`❌ Error in queryLeagueTableData:`, error, "error");
			return {
				type: "error",
				data: [],
				error: "Error querying league table data",
			};
		}
	}

	// Duplicate query builder methods removed - now handled by PlayerQueryBuilder

	// Helper function to map metric key to statObject key
	private mapMetricToStatObjectKey(metric: string): string {
		// Map PENALTY_CONVERSION_RATE to PenConversionRate (statObject key)
		if (metric.toUpperCase() === "PENALTY_CONVERSION_RATE") {
			return "PenConversionRate";
		}
		// Map OPENPLAYGOALS to G (statObject key) to get correct wordedText
		if (metric.toUpperCase() === "OPENPLAYGOALS") {
			return "G";
		}
		return findMetricByAlias(metric)?.key || metric;
	}

	// Helper function to round a value based on statObject configuration
	private roundValueByMetric(metric: string, value: number): number {
		const statObjectKey = this.mapMetricToStatObjectKey(metric);
		const metricConfig = statObject[statObjectKey as keyof typeof statObject];
		
		if (metricConfig && typeof metricConfig === "object" && "numberDecimalPlaces" in metricConfig) {
			const decimalPlaces = metricConfig.numberDecimalPlaces || 0;
			// Round to specified decimal places
			const multiplier = Math.pow(10, decimalPlaces);
			return Math.round(value * multiplier) / multiplier;
		}
		
		// Default to integer rounding if no config found
		return Math.round(value);
	}

	// Helper function to get icon name with fallback to goals scored icon
	private getIconNameForMetric(metric: string, defaultIcon?: string): string {
		// Check if this is a team-specific appearance metric (e.g., "4th XI Apps", "4sApps")
		const isTeamSpecificAppearanceMetric = !!(metric.match(/^\d+sApps$/i) || metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i));
		if (isTeamSpecificAppearanceMetric) {
			// Use appearance icon for team-specific appearance metrics
			return statObject.APP?.iconName || "Appearance-Icon";
		}
		
		const statObjectKey = this.mapMetricToStatObjectKey(metric);
		const metricConfig = statObject[statObjectKey as keyof typeof statObject];
		
		if (metricConfig && typeof metricConfig === "object" && metricConfig.iconName) {
			return metricConfig.iconName;
		}
		
		// Fallback to provided default or goals scored icon
		return defaultIcon || statObject.G?.iconName || "Goals-Icon";
	}

	private async generateResponse(
		question: string,
		data: Record<string, unknown> | null,
		analysis: EnhancedQuestionAnalysis,
		userContext?: string,
		sessionId?: string,
	): Promise<ChatbotResponse> {
		// Calculate dataLength for use throughout the function
		const dataLength = Array.isArray(data?.data) ? data.data.length : (data?.data ? 1 : 0);
		
		this.logToBoth(`🔍 generateResponse called with:`, {
			question,
			dataType: data?.type,
			dataLength: Array.isArray(data?.data) ? data.data.length : "not array",
			analysisType: analysis?.type,
		});

		let answer = "I couldn't find relevant information for your question.";
		let visualization: ChatbotResponse['visualization'] = undefined;
		let answerValue: number | string | null = null;
		const sources = ResponseBuilder.extractSources(data, analysis);

		// Helper function to check if answer indicates no data/failure
		const isNoDataAnswer = (ans: string): boolean => {
			const noDataPatterns = [
				"I couldn't find relevant information",
				"No data found",
				"couldn't find any",
				"no information",
				"no data",
				"doesn't exist",
				"couldn't find any matches"
			];
			return noDataPatterns.some(pattern => ans.toLowerCase().includes(pattern.toLowerCase()));
		};

		// Check if data is empty or indicates no results
		const hasNoData = !data || 
			data.type === "error" ||
			(Array.isArray(data.data) && data.data.length === 0) ||
			(data.data === null || data.data === undefined);

		// Enhanced error handling with specific error messages
		if (!data) {
			answer = "I'm unable to access the club's records at the moment. Please try again later.";
		} else if (data.type === "error") {
			answer = `I encountered an issue while retrieving the information. ${data.error || "Please try again or rephrase your question."}`;
		} else if (data.type === "player_not_found") {
			answer =
				(data.message as string) ||
				`I couldn't find a player named "${data.playerName}". Please check the spelling or try a different player name.`;
		} else if (data.type === "team_not_found") {
			const availableTeams = (data.availableTeams as string[]) || [];
			answer =
				(data.message as string) ||
				`I couldn't find the team "${data.teamName}". Available teams are: ${availableTeams.join(", ")}.`;
		} else if (data.type === "no_context") {
			answer = "Please specify which player or team you're asking about.";
		} else if (data.type === "clarification_needed") {
			answer = (data.message as string) || "Could you provide more details to help me answer your question?";
			// Set answerValue if not already set
			if (data.answerValue) {
				answerValue = data.answerValue as string;
			} else {
				answerValue = "Clarification needed";
			}
		} else if (data.type === "not_found" || data.type === "no_team") {
			// Handle league table error cases
			answer = (data.message as string) || "I couldn't find league table data for your query.";
		} else if (data && data.type === "opposition_query") {
			// Handle opposition name queries
			const teamName = (data.teamName as string) || "";
			const oppositions = (data.oppositions as Array<{ name: string; date: string; homeOrAway?: string }>) || [];
			const dates = data.dates as { start: string; end: string } | undefined;
			
			if (oppositions.length === 0) {
				answer = (data.message as string) || `I couldn't find any fixtures for the ${teamName}${dates ? ` between ${DateUtils.formatDate(dates.start)} and ${DateUtils.formatDate(dates.end)}` : ""}.`;
			} else if (oppositions.length === 1) {
				const opp = oppositions[0];
				const formattedDate = DateUtils.formatDate(opp.date);
				const location = opp.homeOrAway === "Home" ? "at home" : opp.homeOrAway === "Away" ? "away" : "";
				answer = `The ${teamName} played ${opp.name}${location ? ` ${location}` : ""} on ${formattedDate}.`;
				answerValue = opp.name;
			} else {
				// Multiple fixtures
				const oppositionNames = oppositions.map(opp => opp.name);
				const uniqueOppositions = [...new Set(oppositionNames)];
				
				if (uniqueOppositions.length === 1) {
					// Same opposition, multiple dates
					const opp = uniqueOppositions[0];
					const dateList = oppositions.map(opp => DateUtils.formatDate(opp.date)).join(" and ");
					answer = `The ${teamName} played ${opp} on ${dateList}.`;
					answerValue = opp;
				} else {
					// Different oppositions
					const oppList = uniqueOppositions.join(" and ");
					const dateRange = dates ? ` between ${DateUtils.formatDate(dates.start)} and ${DateUtils.formatDate(dates.end)}` : "";
					answer = `The ${teamName} played ${oppList}${dateRange}.`;
					answerValue = uniqueOppositions.length === 1 ? uniqueOppositions[0] : oppList;
				}
			}
		} else if (data && data.isHatTrickQuery === true) {
			// Handle hat-trick queries
			const year = data.year as number | undefined;
			const playerName = data.playerName as string | undefined;
			const isYearWide = data.isYearWideHatTrickQuery === true;
			
			if (playerName) {
				// Player-specific hat-trick query
				const count = Array.isArray(data.data) && data.data.length > 0 
					? (data.data[0] as any).value 
					: 0;
				answer = `${playerName} has scored ${count} hat-trick${count === 1 ? '' : 's'}.`;
				answerValue = count;
				visualization = {
					type: "NumberCard",
					data: [{ 
						name: "hattricks", 
						wordedText: "hattricks",
						value: count,
						iconName: this.getIconNameForMetric("G")
					}],
					config: {
						title: `${playerName}'s Hat-tricks`,
						type: "bar",
					},
				};
			} else if (isYearWide) {
				// Year-wide or filtered hat-trick query - show table of players
				const playerData = Array.isArray(data.data) ? data.data : [];
				const totalCount = (data.totalCount as number) || playerData.reduce((sum: number, p: any) => sum + (p.hatTrickCount || 0), 0);
				const year = data.year as number | undefined;
				const teamName = data.teamName as string | undefined;
				const startDate = data.startDate as string | undefined;
				const endDate = data.endDate as string | undefined;
				
				// Build answer text based on filters
				let answerText = "";
				if (playerData.length === 0) {
					if (teamName) {
						answerText = `There were no hat-tricks scored by the ${teamName}`;
					} else if (year) {
						answerText = `There were no hat-tricks scored in ${year}`;
					} else {
						answerText = `There were no hat-tricks scored`;
					}
					if (startDate || endDate) {
						if (startDate && endDate) {
							answerText += ` between ${DateUtils.formatDate(startDate)} and ${DateUtils.formatDate(endDate)}`;
						} else if (startDate) {
							answerText += ` after ${DateUtils.formatDate(startDate)}`;
						} else if (endDate) {
							answerText += ` before ${DateUtils.formatDate(endDate)}`;
						}
					} else if (year) {
						answerText += `.`;
					} else {
						answerText += `.`;
					}
					answer = answerText;
					answerValue = 0;
				} else {
					if (teamName) {
						answerText = `There ${totalCount === 1 ? 'was' : 'were'} ${totalCount} hat-trick${totalCount === 1 ? '' : 's'} scored by the ${teamName}`;
					} else if (year) {
						answerText = `There ${totalCount === 1 ? 'was' : 'were'} ${totalCount} hat-trick${totalCount === 1 ? '' : 's'} scored across all teams in ${year}`;
					} else {
						answerText = `There ${totalCount === 1 ? 'was' : 'were'} ${totalCount} hat-trick${totalCount === 1 ? '' : 's'} scored`;
					}
					if (startDate || endDate) {
						if (startDate && endDate) {
							answerText += ` between ${DateUtils.formatDate(startDate)} and ${DateUtils.formatDate(endDate)}`;
						} else if (startDate) {
							answerText += ` after ${DateUtils.formatDate(startDate)}`;
						} else if (endDate) {
							answerText += ` before ${DateUtils.formatDate(endDate)}`;
						}
					}
					answerText += `.`;
					answer = answerText;
					answerValue = totalCount;
					
					// Create table visualization
					const tableData = playerData.map((player: any) => ({
						Player: player.playerName || "Unknown",
						"Hat-tricks": player.hatTrickCount || 0,
					}));
					
					visualization = {
						type: "Table",
						data: tableData,
						config: {
							columns: [
								{ key: "Player", label: "Player" },
								{ key: "Hat-tricks", label: "Hat-tricks" },
							],
							initialDisplayLimit: Math.min(playerData.length, 10),
							expandableLimit: playerData.length,
							isExpandable: playerData.length > 10,
						},
					};
				}
			} else if (year) {
				// Fallback for year-wide without player data
				const count = Array.isArray(data.data) && data.data.length > 0 
					? (data.data[0] as any).value 
					: 0;
				answer = `There ${count === 1 ? 'was' : 'were'} ${count} hat-trick${count === 1 ? '' : 's'} in ${year}.`;
				answerValue = count;
				visualization = {
					type: "NumberCard",
					data: [{ 
						name: "hattricks", 
						wordedText: "hattricks",
						value: count,
						iconName: this.getIconNameForMetric("G")
					}],
					config: {
						title: `Hat-tricks in ${year}`,
						type: "bar",
					},
				};
			} else {
				// Generic hat-trick query
				const count = Array.isArray(data.data) && data.data.length > 0 
					? (data.data[0] as any).value 
					: 0;
				answer = `There ${count === 1 ? 'was' : 'were'} ${count} hat-trick${count === 1 ? '' : 's'}.`;
				answerValue = count;
				visualization = {
					type: "NumberCard",
					data: [{ 
						name: "hattricks", 
						wordedText: "hattricks",
						value: count,
						iconName: this.getIconNameForMetric("G")
					}],
					config: {
						title: "Hat-tricks",
						type: "bar",
					},
				};
			}
		} else if (data && data.type === "player_opposition_appearances") {
			// Handle opposition appearance queries (e.g., "How many times have I played Old Hamptonians?")
			const playerName = (data.playerName as string) || "";
			const oppositionName = (data.oppositionName as string) || "";
			const appearances = (data.appearances as number) || 0;
			
			// If oppositionName is empty or looks like a date/competition keyword, this was incorrectly routed
			// Fall back to regular appearance query handling
			const isCompetitionKeyword = ["cup", "league", "friendly", "competition", "competitions"].includes(oppositionName.toLowerCase());
			if (!oppositionName || oppositionName.trim() === "" || ["since", "before", "after", "until", "from"].includes(oppositionName.toLowerCase()) || isCompetitionKeyword) {
				// This should have been a regular appearance query, not opposition
				// Re-route to specific_player handling
				const metric = analysis.metrics[0] || "APP";
				const value = appearances;
				answerValue = value;
				answer = ResponseBuilder.buildContextualResponse(playerName, metric, value, analysis);
				
				visualization = {
					type: "NumberCard",
					data: [{ 
						name: "Appearances", 
						value: value,
						iconName: this.getIconNameForMetric("APP")
					}],
					config: {
						title: `${playerName} - Appearances`,
						type: "bar",
					},
				};
			} else {
				answerValue = appearances;
				answer = `${playerName} has played against ${oppositionName} ${appearances} ${appearances === 1 ? "time" : "times"}.`;
				
				visualization = {
					type: "NumberCard",
					data: [{ 
						name: "Appearances", 
						value: appearances,
						iconName: this.getIconNameForMetric("APP")
					}],
					config: {
						title: `${playerName} - Appearances vs ${oppositionName}`,
						type: "bar",
					},
				};
			}
		} else if (data && data.type === "home_away_comparison") {
			// Handle home/away games comparison queries (e.g., "Have I played more home or away games?")
			const playerName = (data.playerName as string) || "";
			const homeGames = (data.homeGames as number) || 0;
			const awayGames = (data.awayGames as number) || 0;
			const totalGames = homeGames + awayGames;

			if (totalGames === 0) {
				answer = `${playerName} has not played any games.`;
				answerValue = 0;
			} else {
				// Generate natural language answer comparing the counts
				if (homeGames > awayGames) {
					answer = `${playerName} has played more home games (${homeGames}) than away games (${awayGames}).`;
					answerValue = "Home";
				} else if (awayGames > homeGames) {
					answer = `${playerName} has played more away games (${awayGames}) than home games (${homeGames}).`;
					answerValue = "Away";
				} else {
					answer = `${playerName} has played an equal number of home games (${homeGames}) and away games (${awayGames}).`;
					answerValue = "Equal";
				}
			}

			// Create table visualization
			const tableData = [
				{ Location: "Home", Games: homeGames },
				{ Location: "Away", Games: awayGames },
			];

			visualization = {
				type: "Table",
				data: tableData,
				config: {
					columns: [
						{ key: "Location", label: "Location" },
						{ key: "Games", label: "Games" },
					],
				},
			};
		} else if (data && data.type === "games_played_together") {
			// Handle games played together data (specific player pair) - check early before other data.data checks
			console.log(`🔍 [RESPONSE_GEN] games_played_together data:`, data);
			console.log(`🔍 [RESPONSE_GEN] data.data:`, data.data, `Type:`, typeof data.data);
			
			const playerName1 = data.playerName1 as string;
			const playerName2 = data.playerName2 as string;
			const teamName = (data.teamName as string) || undefined;
			const season = (data.season as string) || undefined;
			const startDate = (data.startDate as string) || undefined;
			const endDate = (data.endDate as string) || undefined;
			
			// Check if this is a "since" query (endDate is placeholder or sinceFrame exists)
			const isSinceQuery = endDate === "2099-12-31" || 
				analysis.extractionResult?.timeFrames?.some(tf => tf.type === "since");
			
			let gamesTogether = 0;
			if (typeof data.data === "number") {
				gamesTogether = data.data;
				console.log(`🔍 [RESPONSE_GEN] Extracted number directly:`, gamesTogether);
			} else if (data.data !== null && data.data !== undefined) {
				if (typeof data.data === "object") {
					// Handle Neo4j Integer objects
					if ("toNumber" in data.data && typeof data.data.toNumber === "function") {
						gamesTogether = (data.data as { toNumber: () => number }).toNumber();
						console.log(`🔍 [RESPONSE_GEN] Extracted via toNumber():`, gamesTogether);
					} else if ("low" in data.data && "high" in data.data) {
						const neo4jInt = data.data as { low?: number; high?: number };
						gamesTogether = (neo4jInt.low || 0) + (neo4jInt.high || 0) * 4294967296;
						console.log(`🔍 [RESPONSE_GEN] Extracted via low/high:`, gamesTogether);
					} else {
						gamesTogether = Number(data.data) || 0;
						console.log(`🔍 [RESPONSE_GEN] Extracted via Number():`, gamesTogether);
					}
				} else {
					gamesTogether = Number(data.data) || 0;
					console.log(`🔍 [RESPONSE_GEN] Extracted via Number() (non-object):`, gamesTogether);
				}
			}

			if (gamesTogether === 0) {
				let contextMessage = "";
				if (teamName) {
					contextMessage = ` for the ${teamName}`;
				}
				if (season) {
					contextMessage += season ? ` in ${season}` : "";
				}
				if (startDate && endDate) {
					if (isSinceQuery && startDate) {
						contextMessage += ` since ${DateUtils.formatDate(startDate)}`;
					} else {
						contextMessage += ` between ${DateUtils.formatDate(startDate)} and ${DateUtils.formatDate(endDate)}`;
					}
				}
				answer = `${playerName1} and ${playerName2} have not played together${contextMessage}.`;
			} else {
				let contextMessage = "";
				if (teamName) {
					contextMessage = ` for the ${teamName}`;
				}
				if (season) {
					contextMessage += season ? ` in ${season}` : "";
				}
				if (startDate && endDate) {
					if (isSinceQuery && startDate) {
						contextMessage += ` since ${DateUtils.formatDate(startDate)}`;
					} else {
						contextMessage += ` between ${DateUtils.formatDate(startDate)} and ${DateUtils.formatDate(endDate)}`;
					}
				}
				answer = `${playerName1} and ${playerName2} have played together ${gamesTogether} ${gamesTogether === 1 ? "time" : "times"}${contextMessage}.`;
				answerValue = gamesTogether;
				
				// Create NumberCard visualization with appearances icon
				const roundedGames = this.roundValueByMetric("APP", gamesTogether);
				visualization = {
					type: "NumberCard",
					data: [{
						name: "Games Together",
						value: roundedGames,
						iconName: this.getIconNameForMetric("APP")
					}],
					config: {
						title: "Games Played Together",
						type: "bar",
					},
				};
			}
		} else if (data && data.type === "clean_sheets_played_together") {
			// Handle clean sheets played together data (specific player pair)
			console.log(`🔍 [RESPONSE_GEN] clean_sheets_played_together data:`, data);
			console.log(`🔍 [RESPONSE_GEN] data.data:`, data.data, `Type:`, typeof data.data);
			
			const playerName1 = data.playerName1 as string;
			const playerName2 = data.playerName2 as string;
			const teamName = (data.teamName as string) || undefined;
			const season = (data.season as string) || undefined;
			const startDate = (data.startDate as string) || undefined;
			const endDate = (data.endDate as string) || undefined;
			
			let cleanSheetsTogether = 0;
			if (typeof data.data === "number") {
				cleanSheetsTogether = data.data;
				console.log(`🔍 [RESPONSE_GEN] Extracted number directly:`, cleanSheetsTogether);
			} else if (data.data !== null && data.data !== undefined) {
				if (typeof data.data === "object") {
					// Handle Neo4j Integer objects
					if ("toNumber" in data.data && typeof data.data.toNumber === "function") {
						cleanSheetsTogether = (data.data as { toNumber: () => number }).toNumber();
						console.log(`🔍 [RESPONSE_GEN] Extracted via toNumber():`, cleanSheetsTogether);
					} else if ("low" in data.data && "high" in data.data) {
						const neo4jInt = data.data as { low?: number; high?: number };
						cleanSheetsTogether = (neo4jInt.low || 0) + (neo4jInt.high || 0) * 4294967296;
						console.log(`🔍 [RESPONSE_GEN] Extracted via low/high:`, cleanSheetsTogether);
					} else {
						cleanSheetsTogether = Number(data.data) || 0;
						console.log(`🔍 [RESPONSE_GEN] Extracted via Number():`, cleanSheetsTogether);
					}
				} else {
					cleanSheetsTogether = Number(data.data) || 0;
					console.log(`🔍 [RESPONSE_GEN] Extracted via Number() (non-object):`, cleanSheetsTogether);
				}
			}

			if (cleanSheetsTogether === 0) {
				let contextMessage = "";
				if (teamName) {
					contextMessage = ` for the ${teamName}`;
				}
				if (season) {
					contextMessage += season ? ` in ${season}` : "";
				}
				if (startDate && endDate) {
					contextMessage += ` between ${DateUtils.formatDate(startDate)} and ${DateUtils.formatDate(endDate)}`;
				}
				answer = `No clean sheets occurred in games where ${playerName1} played with ${playerName2}${contextMessage}.`;
			} else {
				let contextMessage = "";
				if (teamName) {
					contextMessage = ` for the ${teamName}`;
				}
				if (season) {
					contextMessage += season ? ` in ${season}` : "";
				}
				if (startDate && endDate) {
					contextMessage += ` between ${DateUtils.formatDate(startDate)} and ${DateUtils.formatDate(endDate)}`;
				}
				answer = `${cleanSheetsTogether} clean sheet${cleanSheetsTogether === 1 ? "" : "s"} occurred in game${cleanSheetsTogether === 1 ? "" : "s"} where ${playerName1} played with ${playerName2}${contextMessage}.`;
				answerValue = cleanSheetsTogether;
				
				// Create NumberCard visualization with clean sheet icon
				visualization = {
					type: "NumberCard",
					data: [{
						name: "Clean Sheets",
						value: cleanSheetsTogether,
						wordedText: cleanSheetsTogether === 1 ? "clean sheet" : "clean sheets",
						iconName: this.getIconNameForMetric("CLS")
					}],
					config: {
						title: "Clean Sheets",
						type: "bar",
					},
				};
			}
		} else if (data && data.type === "goals_scored_together") {
			// Handle goals scored together data (specific player pair)
			console.log(`🔍 [RESPONSE_GEN] goals_scored_together data:`, data);
			console.log(`🔍 [RESPONSE_GEN] data.data:`, data.data, `Type:`, typeof data.data);
			
			const playerName1 = data.playerName1 as string;
			const playerName2 = data.playerName2 as string;
			const teamName = (data.teamName as string) || undefined;
			const season = (data.season as string) || undefined;
			const startDate = (data.startDate as string) || undefined;
			const endDate = (data.endDate as string) || undefined;
			
			let totalGoals = 0;
			if (typeof data.data === "number") {
				totalGoals = data.data;
				console.log(`🔍 [RESPONSE_GEN] Extracted number directly:`, totalGoals);
			} else if (data.data !== null && data.data !== undefined) {
				if (typeof data.data === "object") {
					// Handle Neo4j Integer objects
					if ("toNumber" in data.data && typeof data.data.toNumber === "function") {
						totalGoals = (data.data as { toNumber: () => number }).toNumber();
						console.log(`🔍 [RESPONSE_GEN] Extracted via toNumber():`, totalGoals);
					} else if ("low" in data.data && "high" in data.data) {
						const neo4jInt = data.data as { low?: number; high?: number };
						totalGoals = (neo4jInt.low || 0) + (neo4jInt.high || 0) * 4294967296;
						console.log(`🔍 [RESPONSE_GEN] Extracted via low/high:`, totalGoals);
					} else {
						totalGoals = Number(data.data) || 0;
						console.log(`🔍 [RESPONSE_GEN] Extracted via Number():`, totalGoals);
					}
				} else {
					totalGoals = Number(data.data) || 0;
					console.log(`🔍 [RESPONSE_GEN] Extracted via Number() (non-object):`, totalGoals);
				}
			}

			if (totalGoals === 0) {
				let contextMessage = "";
				if (teamName) {
					contextMessage = ` for the ${teamName}`;
				}
				if (season) {
					contextMessage += season ? ` in ${season}` : "";
				}
				if (startDate && endDate) {
					contextMessage += ` between ${DateUtils.formatDate(startDate)} and ${DateUtils.formatDate(endDate)}`;
				}
				answer = `${playerName1} and ${playerName2} have not scored any goals whilst playing together${contextMessage}.`;
			} else {
				let contextMessage = "";
				if (teamName) {
					contextMessage = ` for the ${teamName}`;
				}
				if (season) {
					contextMessage += season ? ` in ${season}` : "";
				}
				if (startDate && endDate) {
					contextMessage += ` between ${DateUtils.formatDate(startDate)} and ${DateUtils.formatDate(endDate)}`;
				}
				answer = `${playerName1} and ${playerName2} have scored ${totalGoals} ${totalGoals === 1 ? "goal" : "goals"} whilst playing together${contextMessage}.`;
				answerValue = totalGoals;
			}
		} else if (data && data.type === "co_players") {
			// Handle co-players data
			const coPlayers = (data.data as CoPlayerData[]) || [];
			if (coPlayers.length === 0) {
				answer = "No co-players found.";
			} else {
				const topCoPlayer = coPlayers[0];
				answer = `${topCoPlayer.coPlayerName} has played with you ${topCoPlayer.gamesPlayedTogether} ${topCoPlayer.gamesPlayedTogether === 1 ? "time" : "times"}.`;
				answerValue = topCoPlayer.gamesPlayedTogether;
			}
		} else if (data && data.type === "opponents") {
			// Handle opponents data
			// Extract opponents array from nested structure: data.data is [{opponents: [...], totalOpponents: ...}]
			const rawData = (data.data as Array<{ opponents?: OpponentData[]; totalOpponents?: number }>) || [];
			const opponents = (rawData[0]?.opponents as OpponentData[]) || [];
			if (opponents.length === 0) {
				answer = "No opponents found.";
			} else {
				const topOpponent = opponents[0];
				answer = `You have played against ${topOpponent.opponent} ${topOpponent.gamesPlayed} ${topOpponent.gamesPlayed === 1 ? "time" : "times"}.`;
				answerValue = topOpponent.opponent;
				
				// Create table visualization with top 5 (expandable to 10)
				const tableData = opponents.slice(0, 10).map((item) => ({
					Opposition: item.opponent,
					"Games Played": item.gamesPlayed,
				}));
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Opposition", label: "Opposition" },
							{ key: "Games Played", label: "Games Played" },
						],
						initialDisplayLimit: 5,
						expandableLimit: 10,
						isExpandable: true,
					},
				};
			}
		} else if (data && data.type === "opposition_goals") {
			// Handle goals against opposition data
			const playerName = (data.playerName as string) || "";
			const oppositionGoals = (data.data as Array<{ opposition: string; goalsScored: number }>) || [];
			
			if (oppositionGoals.length === 0) {
				answer = "You have not scored any goals against any opposition.";
				answerValue = 0;
			} else {
				const topOpposition = oppositionGoals[0];
				answer = `You have scored the most goals against ${topOpposition.opposition} with ${topOpposition.goalsScored} ${topOpposition.goalsScored === 1 ? "goal" : "goals"}.`;
				answerValue = topOpposition.opposition;
				
				// Format data for table visualization
				const tableData = oppositionGoals.map((item) => ({
					Opposition: item.opposition,
					"Goals Scored": item.goalsScored,
				}));
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Opposition", label: "Opposition" },
							{ key: "Goals Scored", label: "Goals Scored" },
						],
						initialDisplayLimit: 5,
						expandableLimit: 10,
						isExpandable: true,
					},
				};
			}
		} else if (data && data.type === "opposition_clean_sheets") {
			// Handle clean sheets against opposition data
			const playerName = (data.playerName as string) || "";
			const oppositionCleanSheets = (data.data as Array<{ opposition: string; cleanSheets: number }>) || [];
			
			if (oppositionCleanSheets.length === 0) {
				answer = "You have not kept any clean sheets against any opposition.";
				answerValue = 0;
			} else {
				const topOpposition = oppositionCleanSheets[0];
				answer = `You have kept the most clean sheets against ${topOpposition.opposition} with ${topOpposition.cleanSheets} ${topOpposition.cleanSheets === 1 ? "clean sheet" : "clean sheets"}.`;
				answerValue = topOpposition.opposition;
				
				// Format data for table visualization
				const tableData = oppositionCleanSheets.map((item) => ({
					Opposition: item.opposition,
					"Clean Sheets": item.cleanSheets,
				}));
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Opposition", label: "Opposition" },
							{ key: "Clean Sheets", label: "Clean Sheets" },
						],
						initialDisplayLimit: 5,
						expandableLimit: 10,
						isExpandable: true,
					},
				};
			}
		} else if (data && data.type && typeof data.type === "string" && data.type.startsWith("opposition_") && data.type !== "opposition_goals" && data.type !== "opposition_clean_sheets") {
			// Handle generic stat types against opposition (assists, saves, cards, mom, appearances, etc.)
			const playerName = (data.playerName as string) || "";
			const statType = (data.statType as string) || "";
			const oppositionData = (data.data as Array<{ opposition: string; [key: string]: any }>) || [];
			
			// Get the stat value from the first item to determine the field name
			const firstItem = oppositionData.length > 0 ? oppositionData[0] : null;
			const statField = firstItem ? Object.keys(firstItem).find(key => key !== "opposition") : null;
			
			// Map stat type to display name
			const statDisplayNames: Record<string, string> = {
				"assists": "Assists",
				"saves": "Saves",
				"yellowCards": "Yellow Cards",
				"redCards": "Red Cards",
				"mom": "Man of the Match",
				"appearances": "Appearances",
				"ownGoals": "Own Goals",
				"penaltiesScored": "Penalties Scored",
				"penaltiesSaved": "Penalties Saved",
				"penaltiesMissed": "Penalties Missed",
			};
			
			const displayName = statDisplayNames[statType] || (statType.charAt(0).toUpperCase() + statType.slice(1).replace(/([A-Z])/g, " $1").trim());
			const singularName = displayName.endsWith("s") ? displayName.slice(0, -1) : displayName;
			
			// Determine verb based on stat type
			const verb = statType === "appearances" ? "made" : 
			            statType === "mom" ? "won" :
			            statType === "yellowCards" || statType === "redCards" ? "received" :
			            "recorded";
			
			if (oppositionData.length === 0) {
				answer = `You have ${verb} no ${displayName.toLowerCase()} against any opposition.`;
				answerValue = 0;
			} else {
				const topOpposition = oppositionData[0];
				const topValue = statField ? topOpposition[statField] : 0;
				answer = `You have ${verb} the most ${displayName.toLowerCase()} against ${topOpposition.opposition} with ${topValue} ${topValue === 1 ? singularName.toLowerCase() : displayName.toLowerCase()}.`;
				answerValue = topOpposition.opposition;
				
				// Format data for table visualization
				const tableData = oppositionData.map((item) => {
					const value = statField ? item[statField] : 0;
					return {
						Opposition: item.opposition,
						[displayName]: value,
					};
				});
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Opposition", label: "Opposition" },
							{ key: displayName, label: displayName },
						],
						initialDisplayLimit: 5,
						expandableLimit: 10,
						isExpandable: true,
					},
				};
			}
		} else if (data && data.type === "most_played_against") {
			// Handle most played against opposition data
			const playerName = (data.playerName as string) || "You";
			const oppositionData = (data.data as Array<{ opposition: string; gamesPlayed: number }>) || [];
			
			if (oppositionData.length === 0) {
				answer = `${playerName} has not played against any opposition.`;
				answerValue = null;
			} else {
				const topOpposition = oppositionData[0];
				answer = `${playerName} has played against ${topOpposition.opposition} the most, with ${topOpposition.gamesPlayed} ${topOpposition.gamesPlayed === 1 ? "game" : "games"}.`;
				answerValue = topOpposition.opposition;
				
				// Format data for table visualization
				const tableData = oppositionData.map((item) => ({
					Opposition: item.opposition,
					"Games Played": item.gamesPlayed,
				}));
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Opposition", label: "Opposition" },
							{ key: "Games Played", label: "Games Played" },
						],
						initialDisplayLimit: 5,
						expandableLimit: 10,
						isExpandable: true,
					},
				};
			}
		} else if (data && data.type === "goals_by_month") {
			// Handle goals by month data
			const month = (data.month as string) || "";
			const year = (data.year as number) || 0;
			const goalsData = (data.data as Array<{ team: string; goals: number }>) || [];
			
			if (goalsData.length === 0) {
				const monthCapitalized = month.charAt(0).toUpperCase() + month.slice(1);
				answer = `No goals were scored across all teams in ${monthCapitalized} ${year}.`;
				answerValue = 0;
			} else {
				const totalGoals = goalsData.reduce((sum, item) => sum + (item.goals || 0), 0);
				const monthCapitalized = month.charAt(0).toUpperCase() + month.slice(1);
				answer = `${totalGoals} ${totalGoals === 1 ? "goal was" : "goals were"} scored across all teams in ${monthCapitalized} ${year}.`;
				answerValue = totalGoals;
				
				// Format data for table visualization
				const tableData = goalsData.map((item) => ({
					Team: item.team,
					Goals: item.goals || 0,
				}));
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Team", label: "Team" },
							{ key: "Goals", label: "Goals" },
						],
					},
				};
			}
		} else if (data && data.type === "most_appearances_season") {
			// Handle most appearances by season data
			const season = (data.season as string) || "";
			const appearancesData = (data.data as Array<{ playerName: string; appearances: number }>) || [];
			
			if (appearancesData.length === 0) {
				answer = `No player appearances found for the ${season} season.`;
				answerValue = null;
			} else {
				const topPlayer = appearancesData[0];
				answer = `${topPlayer.playerName} appeared in the most games in the ${season} season with ${topPlayer.appearances} ${topPlayer.appearances === 1 ? "appearance" : "appearances"}.`;
				answerValue = topPlayer.playerName;
				
				// Format data for table visualization
				const tableData = appearancesData.map((item) => ({
					Player: item.playerName,
					Appearances: item.appearances || 0,
				}));
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Player", label: "Player" },
							{ key: "Appearances", label: "Appearances" },
						],
						initialDisplayLimit: 5,
						expandableLimit: 10,
						isExpandable: true,
					},
				};
			}
		} else if (data && data.type === "season_wins_count") {
			// Handle season wins count data
			const winsData = (data.data as Array<{ season: string; wins: number }>) || [];
			
			if (winsData.length === 0) {
				answer = "No wins data found for any season.";
				answerValue = null;
			} else {
				const topSeason = winsData[0];
				// Normalize season format
				let seasonString = topSeason.season;
				if (seasonString) {
					seasonString = seasonString.replace(/-/g, "/");
				}
				answer = `The club recorded the most total wins across all teams in the ${seasonString} season with ${topSeason.wins} ${topSeason.wins === 1 ? "win" : "wins"}.`;
				answerValue = seasonString;
				
				// Format data for table visualization
				const tableData = winsData.map((item) => {
					let normalizedSeason = item.season;
					if (normalizedSeason) {
						normalizedSeason = normalizedSeason.replace(/-/g, "/");
					}
					return {
						Season: normalizedSeason,
						Wins: item.wins || 0,
					};
				});
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Season", label: "Season" },
							{ key: "Wins", label: "Wins" },
						],
					},
				};
			}
		} else if (data && data.type === "clean_sheet_appearances_season") {
			// Handle clean sheet appearances by season data
			const season = (data.season as string) || "";
			const cleanSheetData = (data.data as Array<{ playerName: string; cleanSheetAppearances: number }>) || [];
			
			if (cleanSheetData.length === 0) {
				answer = `No clean sheet appearances found for the ${season} season.`;
				answerValue = null;
			} else {
				const topPlayer = cleanSheetData[0];
				answer = `${topPlayer.playerName} had the most clean sheet appearances in the ${season} season with ${topPlayer.cleanSheetAppearances} ${topPlayer.cleanSheetAppearances === 1 ? "appearance" : "appearances"}.`;
				answerValue = topPlayer.playerName;
				
				// Format data for table visualization
				const tableData = cleanSheetData.map((item) => ({
					Player: item.playerName,
					"Clean Sheet Appearances": item.cleanSheetAppearances || 0,
				}));
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Player", label: "Player" },
							{ key: "Clean Sheet Appearances", label: "Clean Sheet Appearances" },
						],
						initialDisplayLimit: 5,
						expandableLimit: 10,
						isExpandable: true,
					},
				};
			}
		} else if (data && data.type === "streak") {
			// Handle streak data
			const streakType = (data.streakType as string) || "goals";
			
			// Handle consecutive weekends streak (returns streakCount directly)
			if (streakType === "consecutive_weekends") {
				const streakCount = (data.streakCount as number) || 0;
				const streakSequence = (data.streakSequence as string[]) || [];
				const streakData = (data.data as Array<{ date: string; seasonWeek?: string }>) || [];
				const streakStartDate = (data.streakStartDate as string) || null;
				const streakEndDate = (data.streakEndDate as string) || null;
				const highlightRange = (data.highlightRange as { startWeek: number; startYear: number; endWeek: number; endYear: number }) || undefined;
				const allFixtureDatesFromQuery = (data.allFixtureDates as string[]) || [];
				const streakDates = (data.streakDates as string[]) || [];
				
				if (streakCount === 0) {
					answer = "You haven't played any consecutive weekends.";
				} else {
					// Format dates for display
					let dateRangeText = "";
					if (streakStartDate && streakEndDate) {
						const startDate = new Date(streakStartDate);
						const endDate = new Date(streakEndDate);
						const startFormatted = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
						const endFormatted = endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
						dateRangeText = ` from ${startFormatted} to ${endFormatted}`;
					}
					answer = `Your longest consecutive streak of weekends played is ${streakCount} ${streakCount === 1 ? "weekend" : "weekends"}${dateRangeText}.`;
					answerValue = streakCount;
				}

				// Add streak sequence to query breakdown for client console logging
				if (streakSequence.length > 0) {
					this.lastQueryBreakdown = {
						...this.lastQueryBreakdown,
						consecutiveWeekendsStreak: {
							count: streakCount,
							sequence: streakSequence,
							sequenceFormatted: streakSequence.join(' → '),
						},
					};
					this.lastProcessingSteps.push(`Longest consecutive streak sequence: ${streakSequence.join(' → ')}`);
				}

				// Build Calendar visualization for consecutive weekends - Convert date array to week-based format with highlightRange
				if (streakData.length > 0) {
					// Helper function to calculate week number (matching Calendar.tsx weekNum function)
					const weekNum = (date: Date): number => {
						const year = date.getFullYear();
						const jan1 = new Date(year, 0, 1);
						const jan1Day = jan1.getDay();
						const jan1MondayBased = jan1Day === 0 ? 6 : jan1Day - 1;
						const daysSinceJan1 = Math.floor((date.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
						return Math.floor((daysSinceJan1 + jan1MondayBased) / 7) + 1;
					};

					// Group dates by year and week
					const weekMap = new Map<string, { year: number; weekNumber: number; value: number }>();
					
					for (const item of streakData) {
						if (item.date) {
							const date = new Date(item.date);
							const year = date.getFullYear();
							const week = weekNum(date);
							const key = `${year}-${week}`;
							
							if (!weekMap.has(key)) {
								weekMap.set(key, { year, weekNumber: week, value: 0 });
							}
							weekMap.get(key)!.value += 1;
						}
					}

					// Convert to week-based format
					const weeks = Array.from(weekMap.values()).map(w => ({
						weekNumber: w.weekNumber,
						year: w.year,
						value: w.value,
					}));

					// Calculate full calendar date range from weeks (for filtering fixture dates)
					// This ensures we only show fixtures within the calendar range
					let calendarStartDate: string | null = null;
					let calendarEndDate: string | null = null;
					if (weeks.length > 0) {
						// Helper to get Monday of a week
						const getMondayOfWeek = (year: number, weekNumber: number): Date => {
							const jan1 = new Date(year, 0, 1);
							const jan1Day = jan1.getDay();
							const jan1MondayBased = jan1Day === 0 ? 6 : jan1Day - 1;
							const daysToAdd = (weekNumber - 1) * 7 - jan1MondayBased;
							const monday = new Date(jan1);
							monday.setDate(jan1.getDate() + daysToAdd);
							return monday;
						};

						// Find earliest and latest weeks
						let earliestWeek = weeks[0];
						let latestWeek = weeks[0];
						for (const week of weeks) {
							const weekStart = getMondayOfWeek(week.year, week.weekNumber);
							const earliestStart = getMondayOfWeek(earliestWeek.year, earliestWeek.weekNumber);
							const latestStart = getMondayOfWeek(latestWeek.year, latestWeek.weekNumber);
							if (weekStart < earliestStart) {
								earliestWeek = week;
							}
							if (weekStart > latestStart) {
								latestWeek = week;
							}
						}

						const earliestMonday = getMondayOfWeek(earliestWeek.year, earliestWeek.weekNumber);
						const latestMonday = getMondayOfWeek(latestWeek.year, latestWeek.weekNumber);
						const latestSunday = new Date(latestMonday);
						latestSunday.setDate(latestMonday.getDate() + 6);

						// Format dates as YYYY-MM-DD
						calendarStartDate = earliestMonday.toISOString().split('T')[0];
						calendarEndDate = latestSunday.toISOString().split('T')[0];
					}

					// Use fixture dates from query handler to ensure consistency with streak calculation
					// Filter to only include dates within the calendar date range
					let allFixtureDates: string[] = [];
					if (allFixtureDatesFromQuery.length > 0 && calendarStartDate && calendarEndDate) {
						const startDateObj = new Date(calendarStartDate);
						const endDateObj = new Date(calendarEndDate);
						allFixtureDates = allFixtureDatesFromQuery.filter(dateStr => {
							const date = new Date(dateStr);
							return date >= startDateObj && date <= endDateObj;
						});
					} else if (allFixtureDatesFromQuery.length > 0) {
						// If no calendar date range, use all fixture dates from query
						allFixtureDates = allFixtureDatesFromQuery;
					}

					visualization = {
						type: "Calendar",
						data: {
							weeks: weeks,
							highlightRange: highlightRange,
							allFixtureDates: allFixtureDates,
							streakSequence: streakSequence,
							streakDates: streakDates,
						},
					};
				}
			} else if (streakType === "consecutive_clean_sheets" || streakType === "consecutive_goal_involvement" || streakType === "longest_no_goal_involvement" || streakType === "longest_goal_scoring_streak" || streakType === "longest_assisting_run") {
				// Handle consecutive clean sheets, goal involvement streaks, no goal involvement streaks, goal scoring streaks, and assisting runs with calendar visualization
				const streakCount = (data.streakCount as number) || 0;
				const streakSequence = (data.streakSequence as string[]) || [];
				const streakData = (data.data as Array<{ date: string; [key: string]: any }>) || [];
				const streakStartDate = (data.streakStartDate as string) || null;
				const streakEndDate = (data.streakEndDate as string) || null;
				const highlightRange = (data.highlightRange as { startWeek: number; startYear: number; endWeek: number; endYear: number }) || undefined;
				
				if (streakCount === 0) {
					if (streakType === "consecutive_clean_sheets") {
						answer = "You haven't had any consecutive clean sheets.";
					} else if (streakType === "longest_no_goal_involvement") {
						answer = "You've had goal involvements in all your games.";
					} else if (streakType === "longest_goal_scoring_streak") {
						answer = "You haven't had any consecutive games where you scored.";
					} else if (streakType === "longest_assisting_run") {
						answer = "You haven't had any consecutive games where you assisted.";
					} else {
						answer = "You haven't had any consecutive games with goal involvement.";
					}
				} else {
					// Format dates for display
					let dateRangeText = "";
					if (streakStartDate && streakEndDate) {
						const startDate = new Date(streakStartDate);
						const endDate = new Date(streakEndDate);
						const startFormatted = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
						const endFormatted = endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
						dateRangeText = ` from ${startFormatted} to ${endFormatted}`;
					}
					
					if (streakType === "consecutive_clean_sheets") {
						answer = `Your longest consecutive clean sheet streak is ${streakCount} ${streakCount === 1 ? "game" : "games"}${dateRangeText}.`;
					} else if (streakType === "longest_no_goal_involvement") {
						answer = `Your longest run of games without goal involvements is ${streakCount} ${streakCount === 1 ? "game" : "games"}${dateRangeText}.`;
					} else if (streakType === "longest_goal_scoring_streak") {
						answer = `Your longest goal scoring streak is ${streakCount} ${streakCount === 1 ? "game" : "games"}${dateRangeText}.`;
					} else if (streakType === "longest_assisting_run") {
						answer = `Your longest assisting run of games is ${streakCount} ${streakCount === 1 ? "game" : "games"}${dateRangeText}.`;
					} else {
						answer = `Your longest consecutive goal involvement streak is ${streakCount} ${streakCount === 1 ? "game" : "games"}${dateRangeText}.`;
					}
					answerValue = streakCount;
				}

				// Add streak sequence to query breakdown for client console logging
				if (streakSequence.length > 0) {
					this.lastQueryBreakdown = {
						...this.lastQueryBreakdown,
						[streakType]: {
							count: streakCount,
							sequence: streakSequence,
							sequenceFormatted: streakSequence.join(' → '),
						},
					};
					this.lastProcessingSteps.push(`Longest consecutive streak sequence: ${streakSequence.join(' → ')}`);
				}

				// Build Calendar visualization for consecutive clean sheets/goal involvement/no goal involvement - Convert date array to week-based format with highlightRange
				if (streakData.length > 0) {
					// Helper function to calculate week number (matching Calendar.tsx weekNum function)
					const weekNum = (date: Date): number => {
						const year = date.getFullYear();
						const jan1 = new Date(year, 0, 1);
						const jan1Day = jan1.getDay();
						const jan1MondayBased = jan1Day === 0 ? 6 : jan1Day - 1;
						const daysSinceJan1 = Math.floor((date.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
						return Math.floor((daysSinceJan1 + jan1MondayBased) / 7) + 1;
					};

					// Determine if we should show goal involvements (or goal scoring/assisting)
					const showGoalInvolvements = streakType === "longest_no_goal_involvement" || streakType === "consecutive_goal_involvement" || streakType === "longest_goal_scoring_streak" || streakType === "longest_assisting_run";
					
					// Determine the contribution label based on streak type
					let contributionLabel: string = "Goal Involvements"; // Default
					if (streakType === "longest_goal_scoring_streak") {
						contributionLabel = "Goals";
					} else if (streakType === "longest_assisting_run") {
						contributionLabel = "Assists";
					} else {
						contributionLabel = "Goal Involvements"; // For longest_no_goal_involvement and consecutive_goal_involvement
					}
					
					// Group dates by year and week, tracking goal involvements and game counts
					const weekMap = new Map<string, { 
						year: number; 
						weekNumber: number; 
						value: number; 
						goalInvolvements: number;
						gameCount: number;
					}>();
					
					for (const item of streakData) {
						if (item.date) {
							const date = new Date(item.date);
							const year = date.getFullYear();
							const week = weekNum(date);
							const key = `${year}-${week}`;
							
							if (!weekMap.has(key)) {
								weekMap.set(key, { year, weekNumber: week, value: 0, goalInvolvements: 0, gameCount: 0 });
							}
							
							const weekEntry = weekMap.get(key)!;
							
							// Calculate goal involvements/goal scoring/assisting for this game based on streak type
							const goals = (item.goals as number) || 0;
							const assists = (item.assists as number) || 0;
							const penaltiesScored = (item.penaltiesScored as number) || 0;
							
							let contributionValue = 0;
							if (streakType === "longest_goal_scoring_streak") {
								// For goal scoring streak, only count goals + penalties
								contributionValue = goals + penaltiesScored;
							} else if (streakType === "longest_assisting_run") {
								// For assisting run, only count assists
								contributionValue = assists;
							} else {
								// For goal involvement streaks, count goals + assists + penalties
								contributionValue = goals + assists + penaltiesScored;
							}
							
							// Track goal involvements/goal scoring/assisting and game count
							weekEntry.goalInvolvements += contributionValue;
							weekEntry.gameCount += 1;
							
							// For streak types that show contributions, use contribution count
							// For other streak types (like consecutive_weekends), count number of games
							if (showGoalInvolvements) {
								weekEntry.value = weekEntry.goalInvolvements;
							} else {
								weekEntry.value = weekEntry.gameCount;
							}
						}
					}

					// Convert to week-based format with goal involvement data
					const weeks = Array.from(weekMap.values()).map(w => ({
						weekNumber: w.weekNumber,
						year: w.year,
						value: w.value,
						goalInvolvements: showGoalInvolvements ? w.goalInvolvements : undefined,
						gameCount: w.gameCount,
					}));

					// Calculate full calendar date range from weeks (for fixture query)
					// This ensures we query fixtures for the entire calendar range, not just the streak
					let calendarStartDate: string | null = null;
					let calendarEndDate: string | null = null;
					if (weeks.length > 0) {
						// Helper to get Monday of a week
						const getMondayOfWeek = (year: number, weekNumber: number): Date => {
							const jan1 = new Date(year, 0, 1);
							const jan1Day = jan1.getDay();
							const jan1MondayBased = jan1Day === 0 ? 6 : jan1Day - 1;
							const daysToAdd = (weekNumber - 1) * 7 - jan1MondayBased;
							const monday = new Date(jan1);
							monday.setDate(jan1.getDate() + daysToAdd);
							return monday;
						};

						// Find earliest and latest weeks
						let earliestWeek = weeks[0];
						let latestWeek = weeks[0];
						for (const week of weeks) {
							const weekStart = getMondayOfWeek(week.year, week.weekNumber);
							const earliestStart = getMondayOfWeek(earliestWeek.year, earliestWeek.weekNumber);
							const latestStart = getMondayOfWeek(latestWeek.year, latestWeek.weekNumber);
							if (weekStart < earliestStart) {
								earliestWeek = week;
							}
							if (weekStart > latestStart) {
								latestWeek = week;
							}
						}

						const earliestMonday = getMondayOfWeek(earliestWeek.year, earliestWeek.weekNumber);
						const latestMonday = getMondayOfWeek(latestWeek.year, latestWeek.weekNumber);
						const latestSunday = new Date(latestMonday);
						latestSunday.setDate(latestMonday.getDate() + 6);

						// Format dates as YYYY-MM-DD
						calendarStartDate = earliestMonday.toISOString().split('T')[0];
						calendarEndDate = latestSunday.toISOString().split('T')[0];
					}

					// Query all fixtures for the full calendar date range to determine weekends with no games
					let allFixtureDates: string[] = [];
					if (calendarStartDate && calendarEndDate) {
						try {
							const graphLabel = neo4jService.getGraphLabel();
							const fixtureQuery = `
								MATCH (f:Fixture {graphLabel: $graphLabel})
								WHERE f.date >= $startDate AND f.date <= $endDate
								  AND (f.status IS NULL OR NOT (f.status IN ['Void', 'Postponed', 'Abandoned']))
								RETURN DISTINCT f.date as date
								ORDER BY f.date ASC
							`;
							const fixtureResult = await neo4jService.executeQuery(fixtureQuery, {
								graphLabel,
								startDate: calendarStartDate,
								endDate: calendarEndDate,
							});
							allFixtureDates = (fixtureResult || []).map((record: any) => {
								const date = record?.date;
								if (date) {
									// Normalize date to YYYY-MM-DD format
									const d = new Date(date);
									return d.toISOString().split('T')[0];
								}
								return null;
							}).filter((d: string | null): d is string => d !== null);
						} catch (error) {
							loggingService.log(`⚠️ Error querying fixtures for calendar: ${error}`, null, "warn");
						}
					}

					visualization = {
						type: "Calendar",
						data: {
							weeks: weeks,
							highlightRange: highlightRange,
							allFixtureDates: allFixtureDates,
							streakType: streakType, // Pass streak type for styling (red for negative streaks)
							showGoalInvolvements: showGoalInvolvements, // Flag to show goal involvements vs apps
							contributionLabel: contributionLabel, // Label for contribution metric (Goals, Assists, or Goal Involvements)
						},
					};
				}
			} else {
				// Handle other streak types (goals, assists, etc.)
				const streakData = (data.data as StreakData[]) || [];
				if (streakData.length === 0) {
					answer = "No streak data found.";
				} else {
					const streakLength = streakData.length;
					answer = `Your longest ${streakType} streak is ${streakLength} ${streakLength === 1 ? "game" : "games"}.`;
					answerValue = streakLength;
				}
			}
		} else if (data && data.type === "most_consecutive_games") {
			// Handle most consecutive games played query
			const allData = (data.data as Array<{ playerName: string; streakCount: number }>) || [];
			const top5Data = (data.top5Data as Array<{ playerName: string; streakCount: number }>) || allData.slice(0, 5);
			
			if (allData.length === 0) {
				answer = "No consecutive games data found.";
				answerValue = null;
			} else {
				const topPlayer = allData[0];
				answer = `The player with the most consecutive games played is ${topPlayer.playerName} with ${topPlayer.streakCount} ${topPlayer.streakCount === 1 ? "game" : "games"}.`;
				answerValue = topPlayer.playerName;
				
				// Format data for table visualization
				const tableData = allData.map((item) => ({
					Player: item.playerName,
					"Consecutive Games": item.streakCount,
				}));
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Player", label: "Player" },
							{ key: "Consecutive Games", label: "Consecutive Games" },
						],
						initialDisplayLimit: 5,
						expandableLimit: 10,
						isExpandable: true,
					},
				};
			}
		} else if (data && data.type === "teammates_count") {
			// Handle teammates count query
			const playerName = (data.playerName as string) || "You";
			const countData = (data.data as Array<{ count: number }>) || [];
			const count = countData.length > 0 ? countData[0].count : 0;
			
			answer = `${playerName === "You" ? "You have" : `${playerName} has`} played with ${count} different ${count === 1 ? "player" : "players"}.`;
			answerValue = count;
			
			visualization = {
				type: "NumberCard",
				data: [{
					value: count,
					wordedText: "teammates played with",
					iconName: "Teammates-Icon",
					metric: "TEAM"
				}],
			};
		} else if (data && data.type === "longest_unbeaten_run") {
			// Handle longest unbeaten/winning run query
			const teamName = (data.teamName as string) || "";
			const count = (data.count as number) || 0;
			const includeDraws = (data.includeDraws as boolean) ?? true;
			const dateRange = data.dateRange as { start: string; end: string } | undefined;
			const runType = includeDraws ? "unbeaten run" : "winning run";
			const gameType = includeDraws ? "games" : "wins";
			
			if (count === 0) {
				const dateRangeText = dateRange ? ` between ${DateUtils.formatDate(dateRange.start)} and ${DateUtils.formatDate(dateRange.end)}` : "";
				answer = `The ${teamName} had no ${runType}s${dateRangeText}.`;
				answerValue = 0;
			} else {
				const dateRangeText = dateRange ? ` between ${DateUtils.formatDate(dateRange.start)} and ${DateUtils.formatDate(dateRange.end)}` : "";
				answer = `The ${teamName} had a longest ${runType} of ${count} consecutive ${count === 1 ? gameType.slice(0, -1) : gameType}${dateRangeText}.`;
				answerValue = count;
			}
			
			visualization = {
				type: "NumberCard",
				data: [{
					value: count,
					wordedText: includeDraws ? "consecutive games unbeaten" : "consecutive wins",
					iconName: this.getIconNameForMetric("TeamWins")
				}],
			};
		} else if (data && data.type === "longest_unbeaten_run_all_teams") {
			// Handle longest unbeaten/winning run query for all teams
			const teamName = (data.teamName as string) || "";
			const count = (data.count as number) || 0;
			const year = (data.year as number) || 0;
			const includeDraws = (data.includeDraws as boolean) ?? true;
			const fixtureResults = (data.fixtureResults as Record<string, string>) || {};
			const fixtureScorelines = (data.fixtureScorelines as Record<string, string>) || {};
			const allFixtureDates = (data.allFixtureDates as string[]) || [];
			const streakDates = (data.streakDates as string[]) || [];
			const dateRange = data.dateRange as { start: string; end: string } | undefined;
			const fullDateRange = (data.fullDateRange as { start: string; end: string }) || { start: "2016-01-01", end: "2025-12-31" };
			const runType = includeDraws ? "unbeaten run" : "winning run";
			const gameType = includeDraws ? "games" : "wins";
			
			if (count === 0 || !teamName) {
				const yearText = year ? ` in ${year}` : "";
				answer = `No ${runType}s found${yearText}.`;
				answerValue = "";
			} else {
				const yearText = year ? ` in ${year}` : "";
				answer = `The ${teamName} had the longest ${runType}${yearText} with ${count} consecutive ${count === 1 ? gameType.slice(0, -1) : gameType}.`;
				answerValue = teamName;
			}

			// Build Calendar visualization with fixture results
			if (count > 0 && teamName && allFixtureDates.length > 0) {
				// Helper function to calculate week number (matching Calendar.tsx weekNum function)
				const weekNum = (date: Date): number => {
					const year = date.getFullYear();
					const jan1 = new Date(year, 0, 1);
					const jan1Day = jan1.getDay();
					const jan1MondayBased = jan1Day === 0 ? 6 : jan1Day - 1;
					const daysSinceJan1 = Math.floor((date.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
					return Math.floor((daysSinceJan1 + jan1MondayBased) / 7) + 1;
				};

				// Helper to get Monday of a week
				const getMondayOfWeek = (year: number, weekNumber: number): Date => {
					const jan1 = new Date(year, 0, 1);
					const jan1Day = jan1.getDay();
					const jan1MondayBased = jan1Day === 0 ? 6 : jan1Day - 1;
					const daysToAdd = (weekNumber - 1) * 7 - jan1MondayBased;
					const monday = new Date(jan1);
					monday.setDate(jan1.getDate() + daysToAdd);
					return monday;
				};

				// Group fixtures by year and week, tracking results and scorelines
				const weekMap = new Map<string, { 
					year: number; 
					weekNumber: number; 
					value: number;
					fixtureResult?: string;
					fixtureScoreline?: string;
					hasFixture: boolean;
				}>();

				// Process all fixture dates
				for (const dateStr of allFixtureDates) {
					const date = new Date(dateStr);
					const year = date.getFullYear();
					const week = weekNum(date);
					const key = `${year}-${week}`;
					
					if (!weekMap.has(key)) {
						weekMap.set(key, { year, weekNumber: week, value: 0, hasFixture: false });
					}
					
					const weekEntry = weekMap.get(key)!;
					weekEntry.hasFixture = true;
					weekEntry.value = 1; // Mark that there's a fixture in this week
					
					// Set fixture result if available
					if (fixtureResults[dateStr]) {
						weekEntry.fixtureResult = fixtureResults[dateStr];
					}
					
					// Set fixture scoreline if available
					if (fixtureScorelines[dateStr]) {
						weekEntry.fixtureScoreline = fixtureScorelines[dateStr];
					}
				}

				// Convert to week-based format
				const weeks = Array.from(weekMap.values()).map(w => ({
					weekNumber: w.weekNumber,
					year: w.year,
					value: w.value,
					fixtureResult: w.fixtureResult,
					fixtureScoreline: w.fixtureScoreline,
					gameCount: w.hasFixture ? 1 : 0,
				}));

				// Calculate highlight range from streak dates
				let highlightRange: { startWeek: number; startYear: number; endWeek: number; endYear: number } | undefined = undefined;
				if (streakDates.length > 0) {
					const firstStreakDate = new Date(streakDates[0]);
					const lastStreakDate = new Date(streakDates[streakDates.length - 1]);
					
					const startWeekInfo = { year: firstStreakDate.getFullYear(), week: weekNum(firstStreakDate) };
					const endWeekInfo = { year: lastStreakDate.getFullYear(), week: weekNum(lastStreakDate) };
					
					highlightRange = {
						startWeek: startWeekInfo.week,
						startYear: startWeekInfo.year,
						endWeek: endWeekInfo.week,
						endYear: endWeekInfo.year,
					};
				}

				visualization = {
					type: "Calendar",
					data: {
						weeks: weeks,
						highlightRange: highlightRange,
						allFixtureDates: allFixtureDates,
						fixtureResults: fixtureResults,
						fixtureScorelines: fixtureScorelines,
						fixtureResultType: "team_unbeaten_run",
						streakDates: streakDates,
						fullDateRange: fullDateRange,
					},
				};
			}
		} else if (data && data.type === "comparison") {
			// Handle comparison data
			const comparisonData = (data.data as PlayerData[]) || [];
			if (comparisonData.length === 0) {
				answer = "No comparison data found.";
			} else {
				const topPlayer = comparisonData[0];
				answer = `${topPlayer.playerName} has the highest value with ${FormattingUtils.formatValueByMetric((data.metric as string) || "G", topPlayer.value as number)}.`;
				answerValue = topPlayer.value as number;
			}
		} else if (data && data.type === "temporal") {
			// Handle temporal data
			const temporalData = (data.data as PlayerData[]) || [];
			if (temporalData.length === 0) {
				answer = "No temporal data found.";
			} else {
				const latestData = temporalData[0];
				answer = `The latest value is ${FormattingUtils.formatValueByMetric((data.metric as string) || "G", latestData.value as number)}.`;
				answerValue = latestData.value as number;
			}
		} else if (data && data.type === "ranking") {
			// Handle ranking data
			const rankingData = (data.data as RankingData[]) || [];
			const fullRankingData = (data.fullData as RankingData[]) || rankingData;
			const metric = (data.metric as string) || "G";
			const requestedLimit = (data.requestedLimit as number) || 5;
			const expandableLimit = (data.expandableLimit as number) || requestedLimit;
			const isWorstPenaltyRecord = (data.isWorstPenaltyRecord as boolean) || false;
			const isBestPenaltyRecord = (data.isBestPenaltyRecord as boolean) || false;
			const isPenaltyRecord = isWorstPenaltyRecord || isBestPenaltyRecord;
			
			if (rankingData.length === 0) {
				answer = "No ranking data found.";
			} else {
				const topRanking = rankingData[0];
				const metricDisplayName = isPenaltyRecord ? "Conversion" : getMetricDisplayName(metric, topRanking.value);
				
				// Check if table is expandable (has more data than requestedLimit)
				// Table is expandable if there are more results than the initial display limit
				const isExpandable = fullRankingData.length > requestedLimit;
				
				if (topRanking.playerName) {
					// Check if team filter is present
					const teamEntities = analysis.teamEntities || [];
					const hasTeamFilter = teamEntities.length > 0;
					let teamText = "";
					if (hasTeamFilter) {
						const teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
						const teamDisplayName = teamName
							.replace("1st XI", "1s")
							.replace("2nd XI", "2s")
							.replace("3rd XI", "3s")
							.replace("4th XI", "4s")
							.replace("5th XI", "5s")
							.replace("6th XI", "6s")
							.replace("7th XI", "7s")
							.replace("8th XI", "8s");
						teamText = ` for the ${teamDisplayName}`;
					}
					
					// Show initial limit in answer (for worst/best penalty record, show actual count up to 5)
					const displayCount = isPenaltyRecord ? Math.min(rankingData.length, 5) : Math.min(rankingData.length, requestedLimit);
					answer = `Here are the top ${displayCount} players${teamText}:`;
					answerValue = topRanking.playerName || topRanking.teamName || "";
					
					// Create table visualization with full data (for expansion), but mark initial display limit
					const isGperAPPQuestion = metric.toUpperCase() === "GPERAPP";
					const fullTableData = fullRankingData.map((item, index) => {
						if (isPenaltyRecord) {
							// Format conversion rate as percentage (value is 0-1, convert to 0-100)
							const conversionRate = typeof item.value === "number" ? item.value : parseFloat(String(item.value || 0));
							const percentage = (conversionRate * 100).toFixed(1);
							// Calculate total penalties taken (penaltiesScored + penaltiesMissed)
							const penaltiesScored = (item as any).penaltiesScored || 0;
							const penaltiesMissed = (item as any).penaltiesMissed || 0;
							const totalPenalties = penaltiesScored + penaltiesMissed;
							return {
								Rank: index + 1,
								Player: item.playerName || item.teamName || "Unknown",
								Penalties: totalPenalties,
								Conversion: `${percentage}%`,
							};
						} else if (isGperAPPQuestion) {
							// For GperAPP, include Appearances column
							const appearances = (item as any).appearances || 0;
							return {
								Rank: index + 1,
								Player: item.playerName || item.teamName || "Unknown",
								[metricDisplayName]: FormattingUtils.formatValueByMetric(metric, item.value),
								Appearances: appearances,
							};
						} else {
							return {
								Rank: index + 1,
								Player: item.playerName || item.teamName || "Unknown",
								[metricDisplayName]: FormattingUtils.formatValueByMetric(metric, item.value),
							};
						}
					});
					
					// Format metric display name with proper capitalization for GperAPP
					// Title case with common words (per, of, the, etc.) in lowercase
					const formattedMetricDisplayName = isGperAPPQuestion 
						? (() => {
							const commonWords = ['per', 'of', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by'];
							return metricDisplayName.split(' ').map((word, index) => {
								const lowerWord = word.toLowerCase();
								// Always capitalize first word, otherwise lowercase common words
								if (index === 0 || !commonWords.includes(lowerWord)) {
									return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
								}
								return lowerWord;
							}).join(' ');
						})()
						: metricDisplayName;
					
					visualization = {
						type: "Table",
						data: fullTableData,
						config: {
							columns: isPenaltyRecord ? [
								{ key: "Rank", label: "Rank" },
								{ key: "Player", label: "Player" },
								{ key: "Penalties", label: "Penalties" },
								{ key: "Conversion", label: "Conversion" },
							] : isGperAPPQuestion ? [
								{ key: "Rank", label: "Rank" },
								{ key: "Player", label: "Player" },
								{ key: metricDisplayName, label: formattedMetricDisplayName },
								{ key: "Appearances", label: "Appearances" },
							] : [
								{ key: "Rank", label: "Rank" },
								{ key: "Player", label: "Player" },
								{ key: metricDisplayName, label: metricDisplayName },
							],
							initialDisplayLimit: isPenaltyRecord ? Math.min(requestedLimit, 5) : requestedLimit,
							expandableLimit: expandableLimit,
							isExpandable: isExpandable,
						},
					};
				} else if (topRanking.teamName) {
					answer = `${topRanking.teamName} is ranked #1 with ${FormattingUtils.formatValueByMetric(metric, topRanking.value)}.`;
					answerValue = topRanking.teamName || "";
					
					// Create table visualization for team rankings
					const fullTableData = fullRankingData.map((item, index) => ({
						Rank: index + 1,
						Team: item.teamName || "Unknown",
						[metricDisplayName]: FormattingUtils.formatValueByMetric(metric, item.value),
					}));
					
					visualization = {
						type: "Table",
						data: fullTableData,
						config: {
							columns: [
								{ key: "Rank", label: "Rank" },
								{ key: "Team", label: "Team" },
								{ key: metricDisplayName, label: metricDisplayName },
							],
							initialDisplayLimit: requestedLimit,
							expandableLimit: expandableLimit,
							isExpandable: isExpandable,
						},
					};
				}
			}
		} else if (data && data.type === "league_table") {
			// Handle league table data
			// Check if answer is already provided by query handler
			if (data.answer) {
				answer = data.answer as string;
				// Priority 1: Check if answerValue is explicitly set by query handler
				if (data.answerValue !== undefined && data.answerValue !== null) {
					answerValue = data.answerValue as string | number;
				} else if (data.season !== undefined && data.season !== null && 
					(question.toLowerCase().includes("which season") || question.toLowerCase().includes("what season"))) {
					// Priority 2: For "which season" queries, use the season value
					answerValue = data.season as string;
				} else if (data.goalDifference !== undefined) {
					// Priority 3: For goal difference queries, set answerValue to the goal difference
					answerValue = data.goalDifference as number;
				} else if (data.position !== undefined) {
					// Priority 4: For position queries, set answerValue to the ordinal position string (e.g., "4th")
					const position = data.position as number;
					const positionSuffix = position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th";
					answerValue = `${position}${positionSuffix}`;
				} else {
					// Fallback: try to extract position from data array
					const leagueTableData = (data.data as LeagueTableEntry[]) || [];
					if (leagueTableData.length > 0 && leagueTableData[0].position !== undefined) {
						const position = leagueTableData[0].position;
						const positionSuffix = position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th";
						answerValue = `${position}${positionSuffix}`;
					} else {
						answerValue = null;
					}
				}
			} else {
				// Fallback: generate answer
				const leagueTableData = (data.data as LeagueTableEntry[]) || [];
				if (leagueTableData.length === 0) {
					answer = "No league table data found.";
				} else {
					const topEntry = leagueTableData[0];
					const positionSuffix = topEntry.position === 1 ? "st" : 
					                       topEntry.position === 2 ? "nd" : 
					                       topEntry.position === 3 ? "rd" : "th";
					answer = `${topEntry.team} were ranked ${topEntry.position}${positionSuffix} with ${topEntry.points} points.`;
					// Set answerValue to the ordinal position string (e.g., "4th")
					answerValue = `${topEntry.position}${positionSuffix}`;
				}
			}
			
			// Always display the full league table if available
			const fullTable = (data.fullTable as LeagueTableEntry[] | Array<Record<string, unknown>>) || [];
			if (fullTable.length > 0) {
				// Check if this is a custom table format (e.g., negative goal difference seasons query)
				const firstEntry = fullTable[0] as Record<string, unknown>;
				const isCustomFormat = firstEntry && "Season" in firstEntry && "Pos" in firstEntry;
				
				let tableData: Array<Record<string, unknown>>;
				let columns: Array<{ key: string; label: string }>;
				
				if (isCustomFormat) {
					// Use custom format directly (already has Season, Pos, P, F, A, GD, Pts)
					tableData = fullTable as Array<Record<string, unknown>>;
					columns = [
						{ key: "Season", label: "Season" },
						{ key: "Pos", label: "Pos" },
						{ key: "P", label: "P" },
						{ key: "F", label: "F" },
						{ key: "A", label: "A" },
						{ key: "GD", label: "GD" },
						{ key: "Pts", label: "Pts" },
					];
				} else {
					// Transform standard league table data for visualization
					tableData = (fullTable as LeagueTableEntry[]).map((entry) => ({
						Position: entry.position,
						Team: entry.team,
						Played: entry.played,
						Won: entry.won,
						Drawn: entry.drawn,
						Lost: entry.lost,
						"Goals For": entry.goalsFor,
						"Goals Against": entry.goalsAgainst,
						"Goal Difference": entry.goalDifference,
						Points: entry.points,
					}));
					
					columns = [
						{ key: "Position", label: "Pos" },
						{ key: "Team", label: "Team" },
						{ key: "Played", label: "P" },
						{ key: "Won", label: "W" },
						{ key: "Drawn", label: "D" },
						{ key: "Lost", label: "L" },
						{ key: "Goals For", label: "F" },
						{ key: "Goals Against", label: "A" },
						{ key: "Goal Difference", label: "GD" },
						{ key: "Points", label: "Pts" },
					];
				}
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: columns,
					},
				};
			}
		} else if (data && data.type === "highest_scoring_game") {
			// Handle highest scoring game queries
			const gameData = data.data as {
				date: string;
				opposition: string;
				homeOrAway: string;
				result: string;
				dorkiniansGoals: number;
				conceded: number;
				totalGoals: number;
			} | null;
			
			if (!gameData) {
				answer = (data.message as string) || "No highest scoring game found.";
			} else {
				const location = gameData.homeOrAway === "Home" ? "at home" : gameData.homeOrAway === "Away" ? "away" : "";
				const formattedDate = DateUtils.formatDate(gameData.date);
				answer = `${gameData.dorkiniansGoals}-${gameData.conceded} vs ${gameData.opposition} ${location} on the ${formattedDate}`;
				answerValue = answer;
			}
		} else if (data && data.type === "season_totw") {
			// Handle Team of the Season queries
			const totwData = data.data as {
				season: string;
				players: Array<{
					playerName: string;
					position: string;
					ftpScore: number;
				}>;
			} | null;

			if (!totwData || !totwData.players || totwData.players.length === 0) {
				answer = (data.message as string) || `No Team of the Season data found${totwData?.season ? ` for ${totwData.season}` : ""}.`;
			} else {
				const season = totwData.season || "the current season";
				answer = `The Team of the Season for ${season} consisted of ${totwData.players.length} players.`;
				
				// Create table visualization
				const tableData = totwData.players.map((player) => ({
					Position: player.position,
					"Player Name": player.playerName,
					"FTP Points": player.ftpScore
				}));

				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Position", label: "Pos" },
							{ key: "Player Name", label: "Player" },
							{ key: "FTP Points", label: "FTP" }
						]
					}
				};
			}
		} else if (data && (data.type === "season_totw_not_found" || data.type === "season_totw_no_players")) {
			// Handle Team of the Season error cases
			const season = (data.season as string) || "the specified season";
			answer = (data.message as string) || `No Team of the Season data found for ${season}.`;
		} else if (data && data.type === "highest_team_goals_in_player_game") {
			// Handle highest team goals in games where player was playing queries
			const gameData = data.data as {
				date: string;
				opposition: string;
				homeOrAway: string;
				result: string;
				dorkiniansGoals: number;
				conceded: number;
			} | null;
			const playerName = (data.playerName as string) || "You";
			
			if (!gameData) {
				answer = (data.message as string) || `No games found where ${playerName} was playing.`;
			} else {
				const location = gameData.homeOrAway === "Home" ? "at home" : gameData.homeOrAway === "Away" ? "away" : "";
				const formattedDate = DateUtils.formatDate(gameData.date);
				answer = `${gameData.dorkiniansGoals}-${gameData.conceded} vs ${gameData.opposition} ${location} on the ${formattedDate}`;
				answerValue = gameData.dorkiniansGoals;
				
				// Create NumberCard visualization with goals icon
				const roundedGoals = this.roundValueByMetric("G", gameData.dorkiniansGoals);
				visualization = {
					type: "NumberCard",
					data: [{
						name: "Goals Scored",
						value: roundedGoals,
						iconName: this.getIconNameForMetric("G"),
						wordedText: "goals scored"
					}],
					config: {
						title: "Most Goals in Game When Playing",
						type: "bar",
					},
				};
			}
		} else if (data && data.type === "highest_team_goals_conceded_in_player_game") {
			// Handle highest team goals conceded in games where player was playing queries
			const gameData = data.data as {
				date: string;
				opposition: string;
				homeOrAway: string;
				result: string;
				dorkiniansGoals: number;
				conceded: number;
			} | null;
			const playerName = (data.playerName as string) || "You";
			
			if (!gameData) {
				answer = (data.message as string) || `No games found where ${playerName} was playing.`;
			} else {
				const location = gameData.homeOrAway === "Home" ? "at home" : gameData.homeOrAway === "Away" ? "away" : "";
				const formattedDate = DateUtils.formatDate(gameData.date);
				answer = `${gameData.dorkiniansGoals}-${gameData.conceded} vs ${gameData.opposition} ${location} on the ${formattedDate}`;
				answerValue = gameData.conceded;
				
				// Create NumberCard visualization with goals conceded icon
				const roundedConceded = this.roundValueByMetric("C", gameData.conceded);
				visualization = {
					type: "NumberCard",
					data: [{
						name: "Goals Conceded",
						value: roundedConceded,
						iconName: this.getIconNameForMetric("C"),
						wordedText: "goals conceded"
					}],
					config: {
						title: "Most Goals Conceded in Game When Playing",
						type: "bar",
					},
				};
			}
		} else if (data && data.type === "games_scored_won_by_one") {
			// Handle games where player scored and team won by exactly one goal queries
			const gameDataArray = (data.data as Array<{ gameCount: number }>) || [];
			const playerName = (data.playerName as string) || "You";
			
			if (gameDataArray.length === 0 || !gameDataArray[0]) {
				answer = `You haven't played and scored in any games where the team won by exactly one goal.`;
				answerValue = 0;
			} else {
				const gameCount = gameDataArray[0].gameCount || 0;
				const gameText = gameCount === 1 ? "game" : "games";
				answer = `You've played and scored in ${gameCount} ${gameText} where the team won by exactly one goal.`;
				answerValue = gameCount;
				
				// Create NumberCard visualization with goals icon
				visualization = {
					type: "NumberCard",
					data: [{
						name: "winning goals",
						value: gameCount,
						iconName: this.getIconNameForMetric("G"),
						wordedText: "winning goals"
					}],
					config: {
						title: "Games Scored & Won by One Goal",
						type: "bar",
					},
				};
			}
		} else if (data && data.type === "number_card") {
			// Handle number card queries (e.g., games with zero goals)
			const gameDataArray = (data.data as Array<{ value: number }>) || [];
			const playerName = (data.playerName as string) || "You";
			
			if (gameDataArray.length === 0 || !gameDataArray[0]) {
				answer = `You haven't played in any games where the team scored zero goals.`;
				answerValue = 0;
			} else {
				const gameCount = gameDataArray[0].value || 0;
				const gameText = gameCount === 1 ? "game" : "games";
				answer = `You've played in ${gameCount} ${gameText} where the team scored zero goals.`;
				answerValue = gameCount;
				
				// Create NumberCard visualization
				visualization = {
					type: "NumberCard",
					data: [{
						name: "games",
						value: gameCount,
						iconName: this.getIconNameForMetric("APP"),
						wordedText: "games with zero goals"
					}],
					config: {
						title: `${playerName === "You" ? "Your" : `${playerName}'s`} Games with Zero Goals`,
						type: "bar",
					},
				};
			}
		} else if (data && data.type === "highest_player_goals_in_game") {
			// Handle highest individual player goals in one game queries
			const playerGameDataArray = (data.data as Array<{
				playerName: string;
				goals: number;
				date: string;
				opposition: string;
				team: string;
				homeOrAway: string;
				result: string;
			}>) || [];
			
			if (playerGameDataArray.length === 0) {
				answer = (data.message as string) || "No match data found for highest individual goals in one game.";
			} else {
				const topRecord = playerGameDataArray[0];
				const location = topRecord.homeOrAway === "Home" ? "at home" : topRecord.homeOrAway === "Away" ? "away" : "";
				const formattedDate = DateUtils.formatDate(topRecord.date);
				const goalText = topRecord.goals === 1 ? "goal" : "goals";
				answer = `${topRecord.playerName} scored ${topRecord.goals} ${goalText} for the ${topRecord.team} ${location} against ${topRecord.opposition} on the ${formattedDate}`;
				answerValue = topRecord.goals;
				
				// Create table with top 5 (expandable to 10)
				const tableData = playerGameDataArray.map((item) => ({
					Player: item.playerName,
					Goals: item.goals,
					Team: item.team,
					Opposition: item.opposition,
					Date: DateUtils.formatDate(item.date),
				}));
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Player", label: "Player" },
							{ key: "Goals", label: "Goals" },
							{ key: "Team", label: "Team" },
							{ key: "Opposition", label: "Opposition" },
							{ key: "Date", label: "Date" },
						],
						initialDisplayLimit: 5,
						expandableLimit: 10,
						isExpandable: true,
					},
				};
			}
		} else if (data && data.type === "double_game") {
			// Handle double game weeks queries
			const playerName = (data.playerName as string) || "You";
			const count = (data.count as number) || 0;
			
			if (count === 0) {
				answer = `${playerName} has not played any double game weeks.`;
				answerValue = 0;
			} else {
				answer = `${playerName} has played ${count} ${count === 1 ? "double game week" : "double game weeks"}.`;
				answerValue = count;
			}
			
			visualization = {
				type: "NumberCard",
				data: [{ 
					wordedText: "double gameweeks", 
					value: count,
					iconName: this.getIconNameForMetric("APP")
				}],
				config: {
					title: "double gameweeks",
					type: "bar",
				},
			};
		} else if (data && data.type === "milestone") {
			// Handle milestone queries
			const players = (data.players as Array<{ playerName: string; statType: string; milestone: number; currentValue: number; distanceFromMilestone: number }>) || [];
			const statType = (data.statType as string) || "";
			const milestone = (data.milestone as number) || 0;
			
			if (players.length === 0) {
				answer = "I couldn't find any player close to that milestone.";
			} else {
				// Create table data with top 5 players
				const tableData = players.map((player) => ({
					"Player Name": player.playerName,
					"Current Value": player.currentValue,
					"Milestone": player.milestone,
					"Distance From Milestone": player.distanceFromMilestone,
				}));
				
				// Format answer text
				if (players.length === 1) {
					const player = players[0];
					answer = `${player.playerName} is closest to reaching the ${milestone} ${statType} milestone, currently on ${player.currentValue} ${statType} (${player.distanceFromMilestone} ${player.distanceFromMilestone === 1 ? "away" : "away"}).`;
				} else {
					const topPlayer = players[0];
					answer = `Here are the top ${players.length} players closest to the ${milestone} ${statType} milestone. ${topPlayer.playerName} is closest, currently on ${topPlayer.currentValue} ${statType} (${topPlayer.distanceFromMilestone} ${topPlayer.distanceFromMilestone === 1 ? "away" : "away"}).`;
				}
				
				// Set answerValue to top player's name (ranked 1st)
				answerValue = players[0]?.playerName || "";
				
				// Create Table visualization
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Player Name", label: "Player Name" },
							{ key: "Current Value", label: "Current Value" },
							{ key: "Milestone", label: "Milestone" },
							{ key: "Distance From Milestone", label: "Distance From Milestone" },
						],
					},
				};
			}
		} else if (data && data.type === "totw_count") {
			// Handle TOTW count queries
			const playerName = (data.playerName as string) || "You";
			const count = (data.count as number) || 0;
			const period = (data.period as string) || "weekly";
			const periodLabel = period === "weekly" ? "Team of the Week" : "Team of the Season";
			
			if (count === 0) {
				answer = `${playerName} have not been in ${periodLabel}.`;
				answerValue = 0;
			} else {
				answer = `${playerName} have been in ${periodLabel} ${count} ${count === 1 ? "time" : "times"}.`;
				answerValue = count;
			}
			
			visualization = {
				type: "NumberCard",
				data: [{ 
					name: periodLabel, 
					value: count,
					iconName: this.getIconNameForMetric("TOTW")
				}],
				config: {
					title: periodLabel,
					type: "bar",
				},
			};
		} else if (data && data.type === "highest_weekly_score") {
			// Handle highest weekly score queries
			const playerName = (data.playerName as string) || "You";
			const highestScore = (data.highestScore as number) || 0;
			
			if (highestScore === 0) {
				answer = `${playerName} have not scored any points in a week.`;
				answerValue = 0;
			} else {
				answer = `${playerName}'s highest score in a week is ${Math.round(highestScore)} ${highestScore === 1 ? "point" : "points"}.`;
				answerValue = Math.round(highestScore);
			}
			
			const roundedScore = Math.round(highestScore);
			visualization = {
				type: "NumberCard",
				data: [{ 
					name: "Highest Weekly Score", 
					value: roundedScore,
					iconName: this.getIconNameForMetric("FTP")
				}],
				config: {
					title: "Highest Weekly Score",
					type: "bar",
				},
			};
		} else if (data && data.type === "team_stats") {
			// Handle team statistics queries
			// BUT FIRST: Check if this should actually be a player query that was misrouted
			const teamName = data.teamName as string;
			const value = data.value as number | undefined;
			const goalsScored = data.goalsScored as number | undefined;
			const goalsConceded = data.goalsConceded as number | undefined;
			const gamesPlayed = data.gamesPlayed as number | undefined;
			const isGoalsScored = data.isGoalsScored as boolean | undefined;
			const isGoalsConceded = data.isGoalsConceded as boolean | undefined;
			const isOpenPlayGoals = data.isOpenPlayGoals as boolean | undefined;
			const isLastSeason = data.isLastSeason as boolean | undefined;
			const metric = data.metric as string | undefined;
			const metricField = data.metricField as string | undefined;
			const season = data.season as string | undefined;
			const startDate = data.startDate as string | undefined;
			const endDate = data.endDate as string | undefined;

			// Check if this should be a player query instead of a team query
			// If question has a player entity and asks about player's goals (not team goals), redirect to player query
			const playerEntities = analysis.extractionResult?.entities?.filter(ent => ent.type === "player") || [];
			const hasPlayerEntity = playerEntities.length > 0;
			const questionLower = question.toLowerCase();
			const isPlayerGoalsQuestion = hasPlayerEntity && (
				questionLower.includes("has") && questionLower.includes("scored") ||
				questionLower.includes("have") && questionLower.includes("scored") ||
				questionLower.includes("got") ||
				questionLower.includes("scored for")
			);
			
			if (isPlayerGoalsQuestion && isGoalsScored && goalsScored !== undefined) {
				// This should be a player query, not a team query
				// Extract player name and generate player-specific response
				const playerName = playerEntities[0]?.value || analysis.entities[0] || "the player";
				const teamDisplayName = teamName
					.replace("1st XI", "1s")
					.replace("2nd XI", "2s")
					.replace("3rd XI", "3s")
					.replace("4th XI", "4s")
					.replace("5th XI", "5s")
					.replace("6th XI", "6s")
					.replace("7th XI", "7s")
					.replace("8th XI", "8s");
				
				// This is a player goals query, but we got team_stats data
				// This means the question was misrouted - it should have gone to player handler
				// Return a message indicating we need player data, not team data
				answer = `I couldn't find data for your question. Please check the player name spelling, or try rephrasing your question with more specific details.`;
				answerValue = "Clarification needed";
			} else if (value !== undefined && metric && metricField) {
				// Single metric query (e.g., appearances, assists, etc.)
				answerValue = value;
				const metricDisplayName = getMetricDisplayName(metric, value);
				
				// For games/appearances queries, use gamesPlayed if available, otherwise use value
				if ((metric.toUpperCase() === "APP" || metricField === "appearances") && gamesPlayed !== undefined) {
					answerValue = gamesPlayed;
					const gameText = gamesPlayed === 1 ? "game" : "games";
					const seasonText = season ? ` in the ${season} season` : "";
					answer = `The ${teamName} played ${gamesPlayed} ${gameText}${seasonText}.`;
					
					// Create NumberCard for games count
					visualization = {
						type: "NumberCard",
						data: [{ 
							name: "Games Played",
							wordedText: "games",
							value: gamesPlayed,
							iconName: this.getIconNameForMetric("APP")
						}],
						config: {
							title: `${teamName} - Games Played${season ? ` (${season})` : ""}`,
							type: "bar",
						},
					};
				} else {
					answer = `The ${teamName} have ${metricDisplayName.toLowerCase()} ${FormattingUtils.formatValueByMetric(metric, value)}.`;
				}
			} else if (goalsScored !== undefined || goalsConceded !== undefined) {
				// Goals query
				if (isGoalsScored) {
					answerValue = goalsScored || 0;
					// Use "last season" if it was a "last season" query, otherwise use the actual season value
					const seasonText = isLastSeason ? " last season" : (season ? ` in the ${season} season` : "");
					// Use simpler "scored" instead of "have scored"
					answer = `The ${teamName} scored ${goalsScored || 0} ${(goalsScored || 0) === 1 ? "goal" : "goals"}${seasonText}.`;
					
					// Return NumberCard for team goals in season
					if (season) {
						const roundedGoals = this.roundValueByMetric("G", goalsScored || 0);
						const seasonTitle = isLastSeason ? "last season" : season;
						visualization = {
							type: "NumberCard",
							data: [{ 
								name: "Goals", 
								wordedText: "goals", // Override statObject lookup to ensure "goals" not "open play goals"
								value: roundedGoals,
								iconName: this.getIconNameForMetric("G")
							}],
							config: {
								title: `${teamName} - Goals in ${seasonTitle}`,
								type: "bar",
							},
						};
					}
				} else if (isGoalsConceded) {
					answerValue = goalsConceded || 0;
					
					// Check if this is an away games query with date range
					const hasAwayLocation = question.toLowerCase().includes("away") || question.toLowerCase().includes("away games");
					const hasDateRange = startDate && endDate;
					
					let locationText = "";
					let dateRangeText = "";
					
					if (hasAwayLocation) {
						locationText = " in away games";
					}
					
					if (hasDateRange) {
						// Format dates for display (convert YYYY-MM-DD to readable format)
						const formatDateForDisplay = (dateStr: string): string => {
							const date = new Date(dateStr);
							const year = date.getFullYear();
							const month = date.getMonth() + 1;
							const day = date.getDate();
							return `${day}/${month}/${year}`;
						};
						
						const formattedStartDate = formatDateForDisplay(startDate);
						const formattedEndDate = formatDateForDisplay(endDate);
						dateRangeText = ` between ${formattedStartDate} and ${formattedEndDate}`;
					}
					
					answer = `The ${teamName} have conceded ${goalsConceded || 0} ${(goalsConceded || 0) === 1 ? "goal" : "goals"}${locationText}${dateRangeText}.`;
					
					// Create NumberCard visualization for goals conceded with filters
					if (hasAwayLocation || hasDateRange) {
						const roundedGoalsConceded = this.roundValueByMetric("C", goalsConceded || 0);
						let cardTitle = `${teamName} - Goals Conceded`;
						if (hasAwayLocation) {
							cardTitle += " (Away)";
						}
						if (hasDateRange) {
							const formatDateForTitle = (dateStr: string): string => {
								const date = new Date(dateStr);
								return date.getFullYear().toString();
							};
							const startYear = formatDateForTitle(startDate);
							const endYear = formatDateForTitle(endDate);
							if (startYear === endYear) {
								cardTitle += ` (${startYear})`;
							} else {
								cardTitle += ` (${startYear}-${endYear})`;
							}
						}
						
						visualization = {
							type: "NumberCard",
							data: [{ 
								name: "Goals Conceded", 
								wordedText: "goals conceded",
								value: roundedGoalsConceded,
								iconName: this.getIconNameForMetric("C")
							}],
							config: {
								title: cardTitle,
								type: "bar",
							},
						};
					}
				} else {
					// Both goals scored and conceded
					answerValue = goalsScored || 0;
					const goalLabelPlural = "goals";
					const goalLabelScored = isOpenPlayGoals ? "Open Play Goals" : "Goals Scored";
					answer = `The ${teamName} have scored ${goalsScored} ${goalsScored === 1 ? goalLabelPlural.replace("goals", "goal") : goalLabelPlural} and conceded ${goalsConceded} ${goalsConceded === 1 ? "goal" : "goals"}.`;
					const roundedGoalsScored = this.roundValueByMetric("G", goalsScored ?? 0);
					const roundedGoalsConceded = this.roundValueByMetric("C", goalsConceded ?? 0);
					visualization = {
						type: "NumberCard",
						data: [
							{ 
								name: goalLabelScored, 
								value: roundedGoalsScored,
								iconName: this.getIconNameForMetric("G")
							},
							{ 
								name: "Goals Conceded", 
								value: roundedGoalsConceded,
								iconName: this.getIconNameForMetric("C")
							},
						],
						config: {
							title: `${teamName} - Goals Statistics`,
							type: "bar",
						},
					};
				}
			}
		} else if (data && data.type === "player_goals_last_season") {
			// Handle player goals last season queries
			const playerName = (data.playerName as string) || "You";
			const totalGoals = (data.totalGoals as number) || 0;
			const lastSeason = (data.lastSeason as string) || "";
			
			answerValue = totalGoals;
			answer = `${playerName} scored ${totalGoals} ${totalGoals === 1 ? "goal" : "goals"} last season.`;
			
			// Create NumberCard visualization
			const roundedGoals = this.roundValueByMetric("G", totalGoals);
			visualization = {
				type: "NumberCard",
				data: [{ 
					name: "Goals", 
					wordedText: "goals",
					value: roundedGoals,
					iconName: this.getIconNameForMetric("G")
				}],
				config: {
					title: `${playerName} - Goals Last Season`,
					type: "bar",
				},
			};
		} else if (data && data.type === "team_conceded_ranking") {
			// Handle team conceded goals ranking
			const teamData = (data.data as Array<{ team: string; goalsConceded: number }>) || [];
			const isFewest = data.isFewest as boolean;
			
			if (teamData.length === 0) {
				answer = "No team data found.";
			} else {
				const topTeam = teamData[0];
				const direction = isFewest ? "fewest" : "most";
				answer = `The ${topTeam.team} have conceded the ${direction} goals in history with ${topTeam.goalsConceded} ${topTeam.goalsConceded === 1 ? "goal" : "goals"} conceded.`;
				// Set answerValue to team name for Chart type extraction
				answerValue = topTeam.team;
				
				// Create table with all teams sorted by goals conceded
				const tableData = teamData.map((team) => ({
					Team: team.team,
					"Goals Conceded": team.goalsConceded,
				}));
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Team", label: "Team" },
							{ key: "Goals Conceded", label: "Goals Conceded" },
						],
					},
				};
			}
		} else if (data && data.type === "team_goals_per_game_season") {
			// Handle team goals per game by season queries
			const teamData = (data.data as Array<{ team: string; gamesPlayed: number; goalsScored: number; goalsPerGame: number }>) || [];
			const season = (data.season as string) || "";
			
			if (teamData.length === 0) {
				answer = `No team data found for the ${season} season.`;
				answerValue = null;
			} else {
				const topTeam = teamData[0];
				answer = `The ${topTeam.team} had the highest average goals per game in ${season} with ${topTeam.goalsPerGame.toFixed(2)} goals per game (${topTeam.goalsScored} goals in ${topTeam.gamesPlayed} ${topTeam.gamesPlayed === 1 ? "game" : "games"}).`;
				answerValue = topTeam.team;
				
				// Create table with all teams sorted by goals per game
				const tableData = teamData.map((team) => ({
					Team: team.team,
					"Games Played": team.gamesPlayed,
					"Goals Scored": team.goalsScored,
					"Goals Per Game": team.goalsPerGame.toFixed(2),
				}));
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Team", label: "Team" },
							{ key: "Games Played", label: "Games Played" },
							{ key: "Goals Scored", label: "Goals Scored" },
							{ key: "Goals Per Game", label: "Goals Per Game" },
						],
					},
				};
			}
		} else if (data && data.type === "players_exactly_one_goal") {
			// Handle players with exactly one goal in club history queries
			const playerDataArray = (data.data as Array<{ playerCount: number }>) || [];
			
			if (playerDataArray.length === 0 || !playerDataArray[0]) {
				answer = "No players have scored exactly one goal in club history.";
				answerValue = 0;
			} else {
				const playerCount = playerDataArray[0].playerCount || 0;
				const playerText = playerCount === 1 ? "player has" : "players have";
				answer = `${playerCount} ${playerText} scored exactly one goal in club history.`;
				answerValue = playerCount;
				
				// Create NumberCard visualization with appearances icon
				visualization = {
					type: "NumberCard",
					data: [{
						name: "players",
						value: playerCount,
						iconName: this.getIconNameForMetric("APP"),
						wordedText: "players"
					}],
					config: {
						title: "Players with Exactly One Goal",
						type: "bar",
					},
				};
			}
		} else if (data && data.type === "players_only_one_game_team") {
			// Handle players who have played only one game for a specific team
			const playerDataArray = (data.data as Array<{ playerCount: number }>) || [];
			const teamName = (data.teamName as string) || "";
			
			if (playerDataArray.length === 0 || !playerDataArray[0]) {
				const teamDisplay = teamName || "the team";
				answer = `No players have played only one game for ${teamDisplay}.`;
				answerValue = 0;
			} else {
				const playerCount = playerDataArray[0].playerCount || 0;
				const playerText = playerCount === 1 ? "player has" : "players have";
				const teamDisplay = teamName || "the team";
				answer = `${playerCount} ${playerText} played only one game for ${teamDisplay}.`;
				answerValue = playerCount;
				
				// Create NumberCard visualization with appearances icon
				visualization = {
					type: "NumberCard",
					data: [{
						name: "Players",
						value: playerCount,
						iconName: this.getIconNameForMetric("APP"),
						wordedText: "players"
					}],
					config: {
						title: `Players with Only One Game for ${teamDisplay}`,
						type: "bar",
					},
				};
			}
		} else if (data && data.type === "team_player_count_by_season") {
			// Handle team player count by season queries
			const teamData = (data.data as Array<{ team: string; playerCount: number }>) || [];
			const season = (data.season as string) || "";
			
			if (teamData.length === 0) {
				answer = `No team data found for the ${season} season.`;
				answerValue = null;
			} else {
				const topTeam = teamData[0];
				answer = `The ${topTeam.team} used the most players in the ${season} season with ${topTeam.playerCount} ${topTeam.playerCount === 1 ? "player" : "players"}.`;
				// Set answerValue to full team name (e.g., "1st XI") for test report validation
				answerValue = topTeam.team;
				
				// Create Chart visualization (column chart) with all teams and their player counts
				const chartData = teamData.map((team) => ({
					name: team.team,
					value: team.playerCount,
				}));
				
				visualization = {
					type: "Chart",
					data: chartData,
					config: {
						title: `Player Count by Team - ${season} Season`,
						type: "bar",
						tooltipLabel: "Player Count",
					},
				};
			}
		} else if (data && data.type === "total_goals_by_year") {
			// Handle total goals by year queries
			const goalsDataArray = (data.data as Array<{ totalGoals: number }>) || [];
			const year = (data.year as number) || 0;
			
			if (goalsDataArray.length === 0 || !goalsDataArray[0]) {
				answer = `No goals were scored across all teams in ${year}.`;
				answerValue = 0;
			} else {
				const totalGoals = goalsDataArray[0].totalGoals || 0;
				answer = `${totalGoals} ${totalGoals === 1 ? "goal was" : "goals were"} scored across all teams in ${year}.`;
				answerValue = totalGoals;
				
				// Create NumberCard visualization
				const roundedGoals = this.roundValueByMetric("G", totalGoals);
				visualization = {
					type: "NumberCard",
					data: [{
						name: "Goals",
						wordedText: "goals",
						value: roundedGoals,
						iconName: this.getIconNameForMetric("G")
					}],
					config: {
						title: `Total Goals Scored in ${year}`,
						type: "bar",
					},
				};
			}
		} else if (data && data.type === "seasons_goal_counts") {
			// Handle seasons with goal counts queries (e.g., "How many seasons have I played where I didn't score any goals?")
			const playerName = (data.playerName as string) || "";
			const seasonsWithNoGoals = typeof data.data === "number" ? data.data : 0;
			
			if (seasonsWithNoGoals === 0) {
				answer = `${playerName} has played in all seasons with at least one goal or penalty scored.`;
				answerValue = 0;
			} else {
				const seasonText = seasonsWithNoGoals === 1 ? "season" : "seasons";
				const pronoun = userContext && playerName.toLowerCase() === userContext.toLowerCase() ? "he" : "they";
				answer = `${playerName} has played ${seasonsWithNoGoals} ${seasonText} where ${pronoun} didn't score any goals.`;
				answerValue = seasonsWithNoGoals;
				
				// Create NumberCard visualization
				const iconName = this.getIconNameForMetric("G");
				visualization = {
					type: "NumberCard",
					data: [{ 
						name: "Goal-less Seasons",
						wordedText: "goal-less seasons",
						value: seasonsWithNoGoals,
						iconName: iconName
					}],
					config: {
						title: "Goal-less Seasons",
						type: "bar",
					},
				};
			}
		} else if (data && data.type === "monthly_goal_involvements") {
			// Handle monthly goal involvements queries (e.g., "Which month across my career has the highest total goal involvements?")
			const playerName = (data.playerName as string) || "";
			const monthlyData = (data.data as Array<{ monthName: string; goalInvolvements: number }>) || [];
			
			if (monthlyData.length === 0) {
				answer = `${playerName} has no monthly goal involvement data available.`;
				answerValue = null;
			} else {
				// Find the month with the highest goal involvements
				const highestMonth = monthlyData.reduce((max, item) => 
					(item.goalInvolvements > max.goalInvolvements ? item : max), 
					monthlyData[0]
				);
				
				// Set answerValue to month name (e.g., "May")
				answerValue = highestMonth.monthName;
				
				// Create answer text
				answer = `${playerName} had the highest total goal involvements in ${highestMonth.monthName} with ${highestMonth.goalInvolvements} ${highestMonth.goalInvolvements === 1 ? "goal involvement" : "goal involvements"}.`;
				
				// Find the maximum value for highlighting
				const maxValue = Math.max(...monthlyData.map((item) => item.goalInvolvements));
				
				// Create Chart visualization with all months
				visualization = {
					type: "Chart",
					data: monthlyData.map((item) => ({
						name: item.monthName,
						value: item.goalInvolvements,
						isHighest: item.goalInvolvements === maxValue,
					})),
					config: {
						title: `${playerName} - Goal Involvements per Month`,
						type: "bar",
						tooltipLabel: "Goal Involvements",
					},
				};
			}
		} else if (data && data.type === "clean_sheet_goal_involvements") {
			// Handle clean sheet goal involvements queries (e.g., "How many times have I scored or assisted in a game where the team kept a clean sheet?")
			const playerName = (data.playerName as string) || "";
			const count = (data.count as number) || 0;
			
			if (count === 0) {
				answer = `${playerName} has not scored or assisted in any games where the team kept a clean sheet.`;
				answerValue = 0;
			} else {
				answer = `${playerName} has scored or assisted in ${count} ${count === 1 ? "game" : "games"} where the team kept a clean sheet.`;
				answerValue = count;
			}
			
			// Create NumberCard visualization
			visualization = {
				type: "NumberCard",
				data: [{
					name: "Games",
					value: count,
					iconName: this.getIconNameForMetric("G"),
					wordedText: count === 1 ? "game" : "games"
				}],
				config: {
					title: `${playerName} - Goal Involvements in Clean Sheet Games`,
					type: "bar",
				},
			};
		} else if (data && data.type === "highest_win_percentage_with") {
			// Handle highest win percentage with queries
			const playerName = (data.playerName as string) || "You";
			const requestedLimit = (data.requestedLimit as number) || 5;
			const expandableLimit = (data.expandableLimit as number) || 10;
			const fullData = (data.fullData as Array<{ teammateName: string; gamesTogether: number; wins: number; winPercentage: number }>) || [];
			const resultData = (data.data as Array<{ teammateName: string; gamesTogether: number; wins: number; winPercentage: number }>) || [];
			
			if (resultData.length === 0) {
				answer = `${playerName} haven't played with any teammates.`;
			} else {
				const topPlayer = resultData[0];
				answer = `${playerName} has the highest win percentage with ${topPlayer.teammateName}, winning ${topPlayer.winPercentage.toFixed(1)}% of ${topPlayer.gamesTogether} ${topPlayer.gamesTogether === 1 ? "game" : "games"} together.`;
				answerValue = topPlayer.teammateName;
				
				// Use fullData if available for expandable table, otherwise use resultData
				const tableData = (fullData.length > 0 ? fullData : resultData).map((item) => ({
					Player: item.teammateName,
					"Games Together": item.gamesTogether,
					Wins: item.wins,
					"Win %": `${item.winPercentage.toFixed(1)}%`
				}));
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						title: `Players ${playerName} has highest win percentage with`,
						expandable: fullData.length > requestedLimit,
						initialLimit: requestedLimit,
						maxLimit: expandableLimit
					}
				};
			}
		} else if (data && data.type === "most_played_with" || data && data.type === "most_played_with_cup") {
			// Handle most played with queries (including cup games)
			const playerName = (data.playerName as string) || "You";
			const teamName = data.teamName as string | undefined;
			const season = data.season as string | undefined;
			const compType = data.compType as string | undefined;
			const isCupQuery = data.type === "most_played_with_cup";
			const requestedLimit = (data.requestedLimit as number) || 5;
			const expandableLimit = (data.expandableLimit as number) || 10;
			const fullData = (data.fullData as Array<{ teammateName: string; gamesTogether: number }>) || [];
			const resultData = (data.data as Array<{ teammateName: string; gamesTogether: number }>) || [];
			
			if (resultData.length === 0) {
				const teamContext = teamName ? ` for the ${teamName}` : "";
				const cupContext = isCupQuery ? " in cup games" : "";
				answer = `${playerName} haven't played with any teammates${cupContext}${teamContext}.`;
			} else {
				const topPlayer = resultData[0];
				const seasonContext = season ? ` in the ${season}` : "";
				const teamContext = teamName ? ` whilst playing for the ${teamName}` : "";
				const cupContext = isCupQuery ? " in cup games" : "";
				answer = `${playerName} ${isCupQuery ? "shared the pitch" : "played"} the most ${isCupQuery ? "cup games" : "games"} with ${topPlayer.teammateName}${seasonContext}${teamContext}, in ${topPlayer.gamesTogether} ${topPlayer.gamesTogether === 1 ? "game" : "games"}.`;
				answerValue = topPlayer.teammateName;
				
				// Use fullData if available for expandable table, otherwise use resultData
				const tableData = (fullData.length > 0 ? fullData : resultData).map((item) => ({
					Player: item.teammateName,
					Games: item.gamesTogether,
				}));
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Player", label: "Player" },
							{ key: "Games", label: "Games" },
						],
						initialDisplayLimit: requestedLimit,
						expandableLimit: expandableLimit,
						isExpandable: fullData.length > requestedLimit,
					},
				};
			}
		} else if (data && data.type === "awards_count") {
			// Handle awards count queries
			const playerName = (data.playerName as string) || "You";
			const count = (data.count as number) || 0;
			
			if (count === 0) {
				answer = `${playerName} has not won any club awards.`;
				answerValue = 0;
			} else {
				answer = `${playerName} has won ${count} club ${count === 1 ? "award" : "awards"}.`;
				answerValue = count;
			}
			
			visualization = {
				type: "NumberCard",
				data: [{ 
					name: "awards", 
					value: count, 
					wordedText: "club awards",
					iconName: this.getIconNameForMetric("AWARDS")
				}],
				config: {
					title: "Awards Won",
					type: "bar",
				},
			};
		} else if (data && data.type === "potm_by_date") {
			// Handle PlayersOfTheMonth by date queries
			const month = (data.month as string) || "";
			const year = (data.year as number) || 0;
			const potmData = data.data as {
				player1Name?: string | null;
				player1Score?: number | null;
				player2Name?: string | null;
				player2Score?: number | null;
				player3Name?: string | null;
				player3Score?: number | null;
				player4Name?: string | null;
				player4Score?: number | null;
				player5Name?: string | null;
				player5Score?: number | null;
			} | null;
			
			if (!potmData || !potmData.player1Name) {
				answer = `I couldn't find Players of the Month data for ${month} ${year}.`;
			} else {
				const topPlayer = potmData.player1Name;
				answer = `The top player in ${month} ${year} was ${topPlayer}.`;
				answerValue = topPlayer;
				
				// Create table with top 5 players
				const tableData = [];
				for (let i = 1; i <= 5; i++) {
					const playerName = potmData[`player${i}Name` as keyof typeof potmData] as string | null | undefined;
					const playerScore = potmData[`player${i}Score` as keyof typeof potmData] as number | null | undefined;
					if (playerName) {
						// Handle null/undefined scores - if score is null, try to get it from the data object directly
						let score = playerScore;
						if (score === null || score === undefined) {
							// Score might be 0 or null in database - check if it's actually 0 vs null
							score = 0;
						}
						tableData.push({
							Rank: i,
							Player: playerName,
							Score: score,
						});
					}
				}
				
				if (tableData.length > 0) {
					visualization = {
						type: "Table",
						data: tableData,
						config: {
							columns: [
								{ key: "Rank", label: "Rank" },
								{ key: "Player", label: "Player" },
								{ key: "Score", label: "Score" },
							],
						},
					};
				}
			}
		} else if (data && data.type === "totw_by_date") {
			// Handle WeeklyTOTW by date queries
			const month = (data.month as string) || "";
			const year = (data.year as number) || 0;
			const week = (data.week as number) || 1;
			const totwData = data.data as {
				players?: Array<{ playerName: string; position: string; points: number }>;
				bestFormation?: string;
				season?: string;
			} | null;
			
			if (!totwData || !totwData.players || totwData.players.length === 0) {
				answer = `I couldn't find Team of the Week data for the first week of ${month} ${year}.`;
			} else {
				const weekText = week === 1 ? "first week" : `week ${week}`;
				answer = `The following players made TOTW in the ${weekText} of ${month} ${year}:`;
				
				// Set answerValue to all player names separated by ", "
				const playerNames = totwData.players.map(player => player.playerName);
				answerValue = playerNames.join(", ");
				
				// Create table with players, positions, and points
				const tableData = totwData.players.map((player) => ({
					Player: player.playerName,
					Position: player.position,
					Points: player.points,
				}));
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
							{ key: "Player", label: "Player" },
							{ key: "Position", label: "Position" },
							{ key: "Points", label: "Points" },
						],
					},
				};
			}
		} else if (data && data.type === "league_wins_count") {
			// Handle league wins count queries
			const playerName = (data.playerName as string) || "You";
			const count = (data.count as number) || 0;
			
			if (count === 0) {
				answer = `${playerName} has not won any leagues.`;
				answerValue = 0;
			} else {
				answer = `${playerName} has won ${count} ${count === 1 ? "league" : "leagues"}.`;
				answerValue = count;
			}
			
			visualization = {
				type: "NumberCard",
				data: [{ 
					name: "leagues", 
					value: count, 
					wordedText: "leagues won",
					iconName: this.getIconNameForMetric("LEAGUE_WINS")
				}],
				config: {
					title: "Leagues Won",
					type: "bar",
				},
			};
		} else if (data && data.type === "club_stats") {
			// Handle club-wide statistics queries (check early before data.data checks)
			const goalsScored = data.goalsScored as number || 0;
			const goalsConceded = data.goalsConceded as number || 0;
			const numberOfPlayers = data.numberOfPlayers as number || 0;
			const isGoalsScored = data.isGoalsScored as boolean;
			const isGoalsConceded = data.isGoalsConceded as boolean;
			const isPlayerCount = data.isPlayerCount as boolean;

			if (isPlayerCount) {
				answerValue = numberOfPlayers;
				answer = `${numberOfPlayers} ${numberOfPlayers === 1 ? "player has" : "players have"} played for the club.`;
				visualization = {
					type: "NumberCard",
					data: [{ 
						name: "Total Players", 
						value: numberOfPlayers,
						iconName: this.getIconNameForMetric("APP")
					}],
					config: {
						title: "Club Statistics - Total Players",
						type: "bar",
					},
				};
			} else if (isGoalsScored) {
				answerValue = goalsScored;
				answer = `Dorkinians have scored ${goalsScored} ${goalsScored === 1 ? "goal" : "goals"}.`;
				const roundedGoals = this.roundValueByMetric("G", goalsScored);
				visualization = {
					type: "NumberCard",
					data: [{ 
						name: "Goals Scored", 
						value: roundedGoals,
						iconName: this.getIconNameForMetric("G")
					}],
					config: {
						title: "Club Statistics - Goals Scored",
						type: "bar",
					},
				};
			} else if (isGoalsConceded) {
				answerValue = goalsConceded;
				answer = `Dorkinians have conceded ${goalsConceded} ${goalsConceded === 1 ? "goal" : "goals"}.`;
				const roundedGoals = this.roundValueByMetric("C", goalsConceded);
				visualization = {
					type: "NumberCard",
					data: [{ 
						name: "Goals Conceded", 
						value: roundedGoals,
						iconName: this.getIconNameForMetric("C")
					}],
					config: {
						title: "Club Statistics - Goals Conceded",
						type: "bar",
					},
				};
			} else {
				// Default: show both goals - use goalsScored as primary value
				answerValue = goalsScored;
				answer = `Dorkinians have scored ${goalsScored} ${goalsScored === 1 ? "goal" : "goals"} and conceded ${goalsConceded} ${goalsConceded === 1 ? "goal" : "goals"}.`;
				const roundedGoalsScored = this.roundValueByMetric("G", goalsScored);
				const roundedGoalsConceded = this.roundValueByMetric("C", goalsConceded);
				visualization = {
					type: "NumberCard",
					data: [
						{ 
							name: "Goals Scored", 
							value: roundedGoalsScored,
							iconName: this.getIconNameForMetric("G")
						},
						{ 
							name: "Goals Conceded", 
							value: roundedGoalsConceded,
							iconName: this.getIconNameForMetric("C")
						},
					],
					config: {
						title: "Club Statistics - Goals",
						type: "bar",
					},
				};
			}
		} else if (data && data.data && Array.isArray(data.data) && data.data.length === 0) {
			// Query executed successfully but returned no results
			const metric = data.metric || "data";
			const playerName = data.playerName || "the requested entity";

			// Check if this is a team-specific appearance query - return 0 instead of "No data found"
			if (metric && typeof metric === 'string' && (metric.match(/^\d+sApps$/i) || metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i))) {
				answerValue = 0;
				const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Apps$/i) || metric.match(/^(\d+)sApps$/i);
				if (teamMatch) {
					const teamName = teamMatch[1] + (metric.includes("XI") ? " XI" : "s");
					answer = responseTemplateManager.formatResponse("zero_appearances", { playerName: String(playerName), teamName: String(teamName) });
				} else {
					answer = responseTemplateManager.formatResponse("player_metric", { playerName: String(playerName), value: String(0), metric: "appearances" });
				}
			}
			// Check if this is a season-specific appearance query (e.g., "2017/18 Apps") - explicitly state player did not play
			else if (
				metric &&
				typeof metric === "string" &&
				/(\d{4}\/\d{2})\s*APPS?/i.test(metric)
			) {
				answerValue = 0;
				const seasonMatch = metric.match(/(\d{4}\/\d{2})/);
				if (seasonMatch) {
					const season = seasonMatch[1];
					answer = responseTemplateManager.formatResponse("season_zero_appearances", {
						playerName: String(playerName),
						season,
					});
				} else {
					answer = responseTemplateManager.formatResponse("player_metric", {
						playerName: String(playerName),
						value: String(0),
						metric: "appearances",
					});
				}
			}
			// Check if this is an APP metric query with a season timeFrame (e.g., "How many apps in 2019/20?")
			else if (
				metric &&
				typeof metric === "string" &&
				(metric.toUpperCase() === "APP" || metric.toUpperCase() === "APPS")
			) {
				// Check for season timeFrame in analysis
				const seasonFrame = analysis.extractionResult?.timeFrames?.find((tf) => tf.type === "season");
				if (seasonFrame) {
					answerValue = 0;
					// Normalize season format (handle both slash and dash)
					let season = seasonFrame.value.replace("-", "/");
					answer = `${String(playerName)} did not make an appearance in the ${season} season.`;
				} else {
					// No season filter, use default zero response
					answerValue = 0;
					answer = ResponseBuilder.buildContextualResponse(String(playerName), metric, 0, analysis);
				}
			}
			// Check if this is a season-specific goals query (e.g., "2016/17GOALS") - explicitly state player did not score
			else if (
				metric &&
				typeof metric === "string" &&
				/(\d{4}\/\d{2})GOALS/i.test(metric)
			) {
				answerValue = 0;
				const seasonMatch = metric.match(/(\d{4}\/\d{2})/);
				if (seasonMatch) {
					const season = seasonMatch[1];
					answer = `${String(playerName)} did not score a goal in the ${season} season.`;
				} else {
					answer = `${String(playerName)} did not score any goals.`;
				}
			}
			// Check if this is a team-specific goals query - return 0 instead of "No data found"
			// Also check for variations like "2nd team" or "6s" which might map to "2nd XI Goals" or "6th XI Goals"
			else if (metric && typeof metric === 'string' && (
				metric.match(/^\d+sGoals$/i) || 
				metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i) ||
				metric.match(/^\d+(?:st|nd|rd|th)\s+team.*goals?/i) ||
				metric.match(/^\d+s.*goals?/i)
			)) {
				const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Goals$/i) || 
					metric.match(/^(\d+)sGoals$/i) ||
					metric.match(/^(\d+(?:st|nd|rd|th))\s+team/i) ||
					metric.match(/^(\d+)s/i);
				if (teamMatch) {
					const teamNumber = teamMatch[1];
					// Map team number to proper team name
					let teamName = "";
					if (metric.includes("XI") || metric.includes("team")) {
						// For "2nd team" or "2nd XI", use the full name
						if (teamNumber.match(/^\d+(?:st|nd|rd|th)$/)) {
							teamName = teamNumber + " XI";
							// Convert to display format (e.g., "2nd XI" -> "2s")
							const teamDisplayName = teamName
								.replace("1st XI", "1s")
								.replace("2nd XI", "2s")
								.replace("3rd XI", "3s")
								.replace("4th XI", "4s")
								.replace("5th XI", "5s")
								.replace("6th XI", "6s")
								.replace("7th XI", "7s")
								.replace("8th XI", "8s");
							answer = `${playerName} has not scored any goals for the ${teamDisplayName}.`;
						} else {
							teamName = TeamMappingUtils.mapTeamName(`${teamNumber}s`);
							answer = `${playerName} has not scored any goals for the ${teamName}.`;
						}
					} else {
						teamName = TeamMappingUtils.mapTeamName(`${teamNumber}s`);
						answer = `${playerName} has not scored any goals for the ${teamName}.`;
					}
				} else {
					answerValue = 0;
					answer = `${playerName} has scored 0 goals.`;
				}
			}
			// Handle position metrics with zero results
			else if (metric && typeof metric === 'string' && ["GK", "DEF", "MID", "FWD"].includes(metric.toUpperCase())) {
				answerValue = 0;
				const positionDisplayNames: Record<string, string> = {
					"GK": "goalkeeper",
					"DEF": "defender",
					"MID": "midfielder",
					"FWD": "forward",
				};
				const positionDisplayName = positionDisplayNames[metric.toUpperCase()] || metric.toLowerCase();
				answer = `${playerName} has never played as a ${positionDisplayName}.`;
			}
			// Check if this is a "MostScoredForTeam" query that returned empty results
			else if (metric === "MostScoredForTeam") {
				// If player hasn't scored for any team
				const statDisplayName = (analysis as any).mostScoredForTeamStatDisplayName || "goals";
				const verb = statDisplayName === "goals" ? "scored" : statDisplayName === "assists" ? "got" : "got";
				if (statDisplayName === "goals") {
					answer = `${playerName} has not scored any goals for a team`;
				} else {
					answer = `${playerName} has not ${verb} any ${statDisplayName} for a team`;
				}
			}
			// Check if this is a HomeWins or AwayWins query that returned empty results
			else if (metric && typeof metric === "string") {
				const metricStr = metric as string;
				const playerNameStr = String(playerName);
				if (metricStr.toUpperCase() === "HOMEWINS" || metricStr === "HomeWins") {
					const zeroResponse = getZeroStatResponse(metricStr, playerNameStr);
					if (zeroResponse) {
						answer = zeroResponse;
					} else {
						answer = `${playerNameStr} has not played a home game`;
					}
				} else if (metricStr.toUpperCase() === "HOME" || metricStr === "HomeGames" || metricStr === "Home Games") {
					// For home games count queries
					answerValue = 0;
					// Check if there's a result filter (e.g., "won") and if player has any home games
					const hasResultFilter = analysis.results && analysis.results.length > 0;
					const playerData = data.data as PlayerData[];
					const totalGames = (playerData[0] as any)?.totalGames;
					if (hasResultFilter && totalGames !== undefined && totalGames > 0) {
						// Player has games but didn't win/lose/draw (depending on filter)
						const resultType = analysis.results?.[0]?.toLowerCase();
						if (resultType === "win" || resultType === "w") {
							answer = `${playerNameStr} has not won a home game.`;
						} else if (resultType === "loss" || resultType === "l") {
							answer = `${playerNameStr} has not lost a home game.`;
						} else if (resultType === "draw" || resultType === "d") {
							answer = `${playerNameStr} has not drawn a home game.`;
						} else {
							answer = `${playerNameStr} has not played a home game.`;
						}
					} else {
						answer = `${playerNameStr} has not played a home game.`;
					}
				} else if (metricStr.toUpperCase() === "HOMEGAMES%WON" || metricStr === "HomeGames%Won" || metricStr === "Home Games % Won") {
					// For home games percentage won queries
					const zeroResponse = getZeroStatResponse(metricStr, playerNameStr);
					if (zeroResponse) {
						answer = zeroResponse;
					} else {
						answer = `${playerNameStr} has not played a home game`;
					}
				} else if (metricStr.toUpperCase() === "AWAYWINS" || metricStr === "AwayWins") {
					const zeroResponse = getZeroStatResponse(metricStr, playerNameStr);
					if (zeroResponse) {
						answer = zeroResponse;
					} else {
						answer = `${playerNameStr} has not played an away game`;
					}
				} else if (metricStr.toUpperCase() === "AWAY" || metricStr === "AwayGames" || metricStr === "Away Games") {
					// For away games count queries
					answerValue = 0;
					// Check if there's a result filter (e.g., "won") and if player has any away games
					const hasResultFilter = analysis.results && analysis.results.length > 0;
					const playerData = data.data as PlayerData[];
					const totalGames = (playerData[0] as any)?.totalGames;
					if (hasResultFilter && totalGames !== undefined && totalGames > 0) {
						// Player has games but didn't win/lose/draw (depending on filter)
						const resultType = analysis.results?.[0]?.toLowerCase();
						if (resultType === "win" || resultType === "w") {
							answer = `${playerNameStr} has not won an away game.`;
						} else if (resultType === "loss" || resultType === "l") {
							answer = `${playerNameStr} has not lost an away game.`;
						} else if (resultType === "draw" || resultType === "d") {
							answer = `${playerNameStr} has not drawn an away game.`;
						} else {
							answer = `${playerNameStr} has not played an away game.`;
						}
					} else {
						answer = `${playerNameStr} has not played an away game.`;
					}
				} else if (metricStr.toUpperCase() === "AWAYGAMES%WON" || metricStr === "AwayGames%Won" || metricStr === "Away Games % Won") {
					// For away games percentage won queries
					const zeroResponse = getZeroStatResponse(metricStr, playerNameStr);
					if (zeroResponse) {
						answer = zeroResponse;
					} else {
						answer = `${playerNameStr} has not played an away game`;
					}
				} else if (metricStr.toUpperCase() === "HOMEGAMES%LOST" || metricStr === "HomeGames%Lost" || metricStr === "Home Games % Lost") {
					// For home games percentage lost queries
					const zeroResponse = getZeroStatResponse(metricStr, playerNameStr);
					if (zeroResponse) {
						answer = zeroResponse;
					} else {
						answer = `${playerNameStr} has not played a home game`;
					}
				} else if (metricStr.toUpperCase() === "AWAYGAMES%LOST" || metricStr === "AwayGames%Lost" || metricStr === "Away Games % Lost") {
					// For away games percentage lost queries
					const zeroResponse = getZeroStatResponse(metricStr, playerNameStr);
					if (zeroResponse) {
						answer = zeroResponse;
					} else {
						answer = `${playerNameStr} has not played an away game`;
					}
				} else if (metricStr.toUpperCase() === "GAMES%LOST" || metricStr === "Games%Lost" || metricStr === "Games % Lost") {
					// For games percentage lost queries
					const zeroResponse = getZeroStatResponse(metricStr, playerNameStr);
					if (zeroResponse) {
						answer = zeroResponse;
					} else {
						answer = `${playerNameStr} has not played any games`;
					}
				} else if (metricStr.toUpperCase() === "HOMEGAMES%DRAWN" || metricStr === "HomeGames%Drawn" || metricStr === "Home Games % Drawn") {
					// For home games percentage drawn queries
					const zeroResponse = getZeroStatResponse(metricStr, playerNameStr);
					if (zeroResponse) {
						answer = zeroResponse;
					} else {
						answer = `${playerNameStr} has not played a home game`;
					}
				} else if (metricStr.toUpperCase() === "AWAYGAMES%DRAWN" || metricStr === "AwayGames%Drawn" || metricStr === "Away Games % Drawn") {
					// For away games percentage drawn queries
					const zeroResponse = getZeroStatResponse(metricStr, playerNameStr);
					if (zeroResponse) {
						answer = zeroResponse;
					} else {
						answer = `${playerNameStr} has not played an away game`;
					}
				} else if (metricStr.toUpperCase() === "GAMES%DRAWN" || metricStr === "Games%Drawn" || metricStr === "Games % Drawn") {
					// For games percentage drawn queries
					const zeroResponse = getZeroStatResponse(metricStr, playerNameStr);
					if (zeroResponse) {
						answer = zeroResponse;
					} else {
						answer = `${playerNameStr} has not played any games`;
					}
				}
			}
			// Check if this is a MatchDetail query that failed - try Player node fallback
			else if (metric && ["CPERAPP", "FTPPERAPP", "GPERAPP", "MPERG", "MPERCLS"].includes((metric as string).toUpperCase())) {
				answer = `I don't have the detailed match information needed to calculate ${metric}. This stat requires individual match records which aren't available.`;
			} else {
				const resolvedMetricKey =
					typeof metric === "string" ? findMetricByAlias(metric)?.key || (metric as string) : "";
				const metricDisplayName =
					resolvedMetricKey && typeof resolvedMetricKey === "string"
						? getMetricDisplayName(resolvedMetricKey, 0)
						: metric && typeof metric === "string"
							? getMetricDisplayName(metric, 0)
							: "this stat";
				const zeroResponse =
					resolvedMetricKey && typeof resolvedMetricKey === "string"
						? getZeroStatResponse(resolvedMetricKey, String(playerName), { metricDisplayName })
						: null;
				if (zeroResponse) {
					answer = zeroResponse;
				} else {
					answer = `I couldn't find any ${metric} information for ${playerName}. This stat may not be available for this player.`;
				}
			}
		} else if (data && data.type === "distance_traveled") {
			// Handle distance traveled query
			const playerName = (data.playerName as string) || "";
			const distanceData = data.data as { playerName?: string; totalDistance?: number; awayGames?: number; averageDistance?: number } | undefined;
			const totalDistance = distanceData?.totalDistance || 0;
			const awayGames = distanceData?.awayGames || 0;
			const averageDistance = distanceData?.averageDistance || 0;
			
			if (totalDistance > 0) {
				const roundedDistance = parseFloat(totalDistance.toFixed(1));
				answer = `${playerName} has travelled ${roundedDistance.toFixed(1)} miles to get to games${awayGames > 0 ? ` across ${awayGames} ${awayGames === 1 ? "away game" : "away games"}` : ""}.`;
				if (awayGames > 0 && averageDistance > 0) {
					answer += ` That's an average of ${averageDistance.toFixed(1)} miles per away game.`;
				}
				answerValue = roundedDistance;
				
				visualization = {
					type: "NumberCard",
					data: [{
						name: "Distance Travelled",
						wordedText: "miles travelled",
						value: roundedDistance,
						iconName: "DistanceTravelled-Icon"
					}],
					config: {
						title: `${playerName} - Distance Travelled`,
						type: "bar",
					},
				};
			} else {
				answer = `${playerName} has not travelled to any away games.`;
				answerValue = 0;
			}
		} else if (data && data.type === "penalties_taken") {
			// Handle penalties taken query
			const playerName = data.playerName as string;
			const totalPenalties = (data.data as Array<{ value: number }>)[0]?.value || 0;
			answer = `${playerName} has taken ${totalPenalties} ${totalPenalties === 1 ? "penalty" : "penalties"}.`;
			answerValue = totalPenalties;
		} else if (data && data.type === "penalty_record") {
			// Handle penalty record query - format as "X has taken N penalties, scoring M"
			const playerName = data.playerName as string;
			const totalPenalties = (data.totalPenalties as number) || 0;
			const penaltiesScored = (data.penaltiesScored as number) || 0;
			answer = `${playerName} has taken ${totalPenalties} ${totalPenalties === 1 ? "penalty" : "penalties"}, scoring ${penaltiesScored}.`;
			answerValue = totalPenalties;
		} else if (data && data.type === "penalty_shootout_scored_total") {
			// Handle penalty shootout scored total query
			const total = Array.isArray(data.data) && data.data.length > 0 
				? (data.data[0] as any).value || 0
				: 0;
			answer = `${total} ${total === 1 ? "penalty has" : "penalties have"} been scored in penalty shootouts.`;
			answerValue = total;
			const psPscStat = statObject['PS-PSC'];
			visualization = {
				type: "NumberCard",
				data: [{ 
					name: "Penalties Scored in Penalty Shootouts", 
					wordedText: "penalties scored in penalty shootouts",
					value: total,
					iconName: psPscStat?.iconName || "PenaltiesScored-Icon"
				}],
				config: {
					title: "Penalties Scored in Penalty Shootouts",
					type: "bar",
				},
			};
		} else if (data && data.type === "penalty_shootout_missed_total") {
			// Handle penalty shootout missed total query
			const total = Array.isArray(data.data) && data.data.length > 0 
				? (data.data[0] as any).value || 0
				: 0;
			answer = `${total} ${total === 1 ? "penalty has" : "penalties have"} been missed in shootouts.`;
			answerValue = total;
			const psPmStat = statObject['PS-PM'];
			visualization = {
				type: "NumberCard",
				data: [{ 
					name: "Penalties Missed in Penalty Shootouts", 
					wordedText: "penalties missed in penalty shootouts",
					value: total,
					iconName: psPmStat?.iconName || "PenaltyShootoutPenaltiesMissed-Icon"
				}],
				config: {
					title: "Penalties Missed in Penalty Shootouts",
					type: "bar",
				},
			};
		} else if (data && data.type === "penalty_shootout_saved_total") {
			// Handle penalty shootout saved total query
			const total = Array.isArray(data.data) && data.data.length > 0 
				? (data.data[0] as any).value || 0
				: 0;
			answer = `${total} ${total === 1 ? "penalty has" : "penalties have"} been saved in shootouts.`;
			answerValue = total;
			const psPsvStat = statObject['PS-PSV'];
			visualization = {
				type: "NumberCard",
				data: [{ 
					name: "Penalties Saved in Penalty Shootouts", 
					wordedText: "penalties saved in penalty shootouts",
					value: total,
					iconName: psPsvStat?.iconName || "PenaltyShootoutPenaltiesSaved-Icon"
				}],
				config: {
					title: "Penalties Saved in Penalty Shootouts",
					type: "bar",
				},
			};
		} else if (data && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
			if (data.type === "specific_player") {
				const playerName = data.playerName as string;
				const metric = data.metric as string;
				
				// Check for "each season" pattern BEFORE extracting first data item (needs full array)
				const questionLower = question.toLowerCase();
				if (questionLower.includes("each season") || questionLower.includes("per season") || questionLower.includes("every season")) {
					// Check if we have array data (multiple seasons) from the query
					if (data && data.type === "specific_player" && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
						const seasonsData = data.data as Array<{ season?: string; value: number | string; [key: string]: unknown }>;
						
						// Transform data to ensure we have season and value
						const transformedData = seasonsData
							.map((item) => {
								const season = item.season || "";
								const statValue = typeof item.value === "number" ? item.value : 0;
								return { season, value: statValue };
							})
							.filter((item) => item.season && item.value !== undefined);
						
						if (transformedData.length > 0) {
							// Get metric display name
							const metricName = getMetricDisplayName(metric, transformedData[0].value);
							
							// Find the highest value for highlighting
							const maxValue = Math.max(...transformedData.map((item) => item.value));
							
							// Create answer text
							const totalValue = transformedData.reduce((sum, item) => sum + item.value, 0);
							answer = `${playerName} has ${totalValue} ${metricName} across ${transformedData.length} ${transformedData.length === 1 ? "season" : "seasons"}.`;
							
							// Create Chart visualization with all seasons
							visualization = {
								type: "Chart",
								data: transformedData.map((item) => ({
									name: item.season,
									value: item.value,
									isHighest: item.value === maxValue,
								})),
								config: {
									title: `${playerName} - ${metricName} per Season`,
									type: "bar",
								},
							};
						}
					}
				}
				// Handle MOSTPROLIFICSEASON BEFORE extracting first data item (needs full array)
				else if (metric && metric.toUpperCase() === "MOSTPROLIFICSEASON") {
					// Helper function to detect various patterns for most goals season questions
					const detectMostGoalsSeasonPattern = (q: string): boolean => {
						const lower = q.toLowerCase();
						// Pattern 1: "most prolific season" or "highest scoring season"
						if ((lower.includes("most prolific season") || 
							 lower.includes("prolific season") ||
							 lower.includes("highest scoring season") ||
							 (lower.includes("highest") && lower.includes("scoring") && lower.includes("season")))) {
							return true;
						}
						// Pattern 2: "season I scored the most goals" / "season I scored most goals"
						if (lower.includes("season") && lower.includes("scored") && 
							(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
							return true;
						}
						// Pattern 3: "season did I score the most goals" / "season did I score most goals"
						if (lower.includes("season") && lower.includes("did") && lower.includes("score") && 
							(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
							return true;
						}
						// Pattern 4: "when did I score the most goals" / "when did I score most goals"
						if (lower.includes("when") && lower.includes("did") && lower.includes("score") && 
							(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
							return true;
						}
						// Pattern 5: "season with the most goals" / "season with most goals"
						if (lower.includes("season") && lower.includes("with") && 
							(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
							return true;
						}
						// Pattern 6: "which season" + "most goals" / "what season" + "most goals"
						if ((lower.includes("which season") || lower.includes("what season")) && 
							(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
							return true;
						}
						return false;
					};
					
					if (detectMostGoalsSeasonPattern(questionLower)) {
						// Check if we have array data (multiple seasons) from the query
						if (data && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
							const seasonsData = data.data as Array<{ season?: string; value: number | string; [key: string]: unknown }>;
							
							// Transform data to ensure we have season and value
							const transformedData = seasonsData
								.map((item) => {
									// Handle both { season: "2019/20", value: 15 } and { value: "2019/20" } formats
									let season = item.season || (typeof item.value === "string" ? item.value : "");
									// Ensure season is in full format (e.g., "2018/19" not just "2018")
									// If season is just a year (4 digits), we need to get the full season string from the data
									if (season && /^\d{4}$/.test(season)) {
										// If season is just a year, try to find the full season string in the original data
										const fullSeasonItem = seasonsData.find(s => s.season && s.season.includes("/") && s.season.startsWith(season));
										if (fullSeasonItem && fullSeasonItem.season) {
											season = fullSeasonItem.season;
										}
									}
									const goals = typeof item.value === "number" ? item.value : (item.goals as number) || 0;
									return { season, goals };
								})
								.filter((item) => item.season && item.goals !== undefined);
							
							if (transformedData.length > 0) {
							// Find the season with the most goals
							const mostProlific = transformedData.reduce((max, item) => (item.goals > max.goals ? item : max), transformedData[0]);
							
							// Check if player has never scored any goals (all seasons have 0 goals)
							const totalGoals = transformedData.reduce((sum, item) => sum + item.goals, 0);
							if (totalGoals === 0 || mostProlific.goals === 0) {
								answer = `${playerName} has never scored a goal.`;
								answerValue = 0;
							} else {
								// Ensure we have the full season string format (e.g., "2018/19")
								// Extract from season string if it's in the format "YYYY/YY" or "YYYY-YY"
								let seasonString = mostProlific.season;
								if (seasonString) {
									// If season is just a year, try to construct the full season string
									if (/^\d{4}$/.test(seasonString)) {
										const year = parseInt(seasonString, 10);
										const nextYear = (year + 1).toString().substring(2);
										seasonString = `${year}/${nextYear}`;
									}
									// Normalize season format (handle both "2018/19" and "2018-19")
									seasonString = seasonString.replace(/-/g, "/");
								}
								
								// Check if team filter is present (team-specific season goals query)
								const hasTeamFilter = analysis.teamEntities && analysis.teamEntities.length > 0;
								let teamName = "";
								if (hasTeamFilter && analysis.teamEntities && analysis.teamEntities.length > 0) {
									teamName = TeamMappingUtils.mapTeamName(analysis.teamEntities[0]);
								}
								
								// Format response as: "[PlayerName] scored the most goals for the [team] in [season] ([goals] goals)."
								if (hasTeamFilter && teamName) {
									answer = `${playerName} scored the most goals for the ${teamName} in ${seasonString} (${mostProlific.goals} ${mostProlific.goals === 1 ? "goal" : "goals"}).`;
								} else {
									answer = `${playerName} scored the most goals in ${seasonString} (${mostProlific.goals} ${mostProlific.goals === 1 ? "goal" : "goals"}).`;
								}
								
								// Extract full season format from answer text to ensure answerValue matches the answer
								// This handles cases where database returns just "2018" instead of "2018/19"
								let extractedSeason = seasonString;
								if (answer) {
									const seasonMatch = answer.match(/\b(\d{4}\/\d{2})\b/);
									if (seasonMatch) {
										extractedSeason = seasonMatch[1];
									}
								}
								
								// Set answerValue to extracted season string (e.g., "2018/19") for test report validation
								answerValue = extractedSeason;
								
								// Sort by season ascending for chronological display
								const sortedData = [...transformedData].sort((a, b) => {
									return a.season.localeCompare(b.season);
								});
								
								// Find the maximum goals for highlighting
								const maxGoals = Math.max(...sortedData.map((item) => item.goals));
								
								// If team filter is present, show Table visualization; otherwise show Record (bar chart)
								if (hasTeamFilter) {
									// Create Table visualization with all seasons for team-specific queries
									const tableData = sortedData.map((item) => ({
										Season: item.season,
										Goals: item.goals,
									}));
									
									visualization = {
										type: "Table",
										data: tableData,
										config: {
											columns: [
												{ key: "Season", label: "Season" },
												{ key: "Goals", label: "Goals" },
											],
										},
									};
								} else {
									// Create Chart visualization (bar chart) with all seasons
									visualization = {
										type: "Chart",
										data: sortedData.map((item) => ({
											name: item.season,
											value: item.goals,
											isHighest: item.goals === maxGoals,
										})),
										config: {
											title: `${playerName} - Goals per Season`,
											type: "bar",
										},
									};
								}
							}
							} else {
								answer = `${playerName} has no season data available.`;
							}
						} else {
							answer = `${playerName} has no season data available.`;
						}
					}
				}
				// Handle BEST_SEASON_FOR_STAT - best season for any stat type
				else if (metric && (metric.toUpperCase() === "BEST_SEASON_FOR_STAT" || metric.toUpperCase() === "BESTSEASONFORSTAT")) {
					// Check if we have array data (multiple seasons) from the query
					if (data && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
						const seasonsData = data.data as Array<{ season?: string; value: number | string; [key: string]: unknown }>;
						
						// Get stat display name from analysis or default to "Goals"
						const statDisplayName = (analysis as any)?.bestSeasonStatDisplayName || "Goals";
						
						// Transform data to ensure we have season and value
						const transformedData = seasonsData
							.map((item) => {
								let season = item.season || (typeof item.value === "string" ? item.value : "");
								// Normalize season format
								if (season && /^\d{4}$/.test(season)) {
									const year = parseInt(season, 10);
									const nextYear = (year + 1).toString().substring(2);
									season = `${year}/${nextYear}`;
								}
								const statValue = typeof item.value === "number" ? item.value : 0;
								return { season, value: statValue };
							})
							.filter((item) => item.season && item.value !== undefined);
						
						if (transformedData.length > 0) {
							// Find the season with the highest stat value
							const bestSeason = transformedData.reduce((max, item) => (item.value > max.value ? item : max), transformedData[0]);
							
							// Normalize season format
							let seasonString = bestSeason.season;
							if (seasonString) {
								if (/^\d{4}$/.test(seasonString)) {
									const year = parseInt(seasonString, 10);
									const nextYear = (year + 1).toString().substring(2);
									seasonString = `${year}/${nextYear}`;
								}
								seasonString = seasonString.replace(/-/g, "/");
							}
							
							// Check if team filter is present
							const hasTeamFilter = analysis.teamEntities && analysis.teamEntities.length > 0;
							let teamName = "";
							if (hasTeamFilter && analysis.teamEntities && analysis.teamEntities.length > 0) {
								teamName = TeamMappingUtils.mapTeamName(analysis.teamEntities[0]);
							}
							
							// Format answer based on stat type
							const statValueText = bestSeason.value === 1 
								? statDisplayName.toLowerCase().slice(0, -1) // Remove 's' for singular
								: statDisplayName.toLowerCase();
							
							if (hasTeamFilter && teamName) {
								answer = `${playerName}'s best season for ${statDisplayName.toLowerCase()} for the ${teamName} was ${seasonString} (${bestSeason.value} ${statValueText}).`;
							} else {
								answer = `${playerName}'s best season for ${statDisplayName.toLowerCase()} was ${seasonString} (${bestSeason.value} ${statValueText}).`;
							}
							
							// Set answerValue to the season string
							answerValue = seasonString;
							
							// Sort by season ascending for chronological display
							const sortedData = [...transformedData].sort((a, b) => {
								return a.season.localeCompare(b.season);
							});
							
							// Find the maximum value for highlighting
							const maxValue = Math.max(...sortedData.map((item) => item.value));
							
							// Create Chart visualization with all seasons
							visualization = {
								type: "Chart",
								data: sortedData.map((item) => ({
									name: item.season,
									value: item.value,
									isHighest: item.value === maxValue,
								})),
								config: {
									title: `${playerName} - ${statDisplayName} per Season`,
									type: "bar",
									tooltipLabel: statDisplayName, // Dynamic tooltip label
								},
							};
						} else {
							answer = `${playerName} has no season data available.`;
						}
					} else {
						answer = `${playerName} has no season data available.`;
					}
				}
				// Handle MostPlayedForTeam/TEAM_ANALYSIS - create table with all teams
				else if (metric && (metric === "MostPlayedForTeam" || metric === "MOSTPLAYEDFORTEAM" || metric === "TEAM_ANALYSIS")) {
					const teamData = data.data as Array<{ playerName: string; value: string; appearances?: number; teamOrder?: number }>;
					if (teamData && teamData.length > 0) {
						// Get the most played team (first in the sorted list)
						const mostPlayedTeam = teamData[0].value;
						// Convert team name to short format (e.g., "5th XI" -> "5s")
						const shortTeamName = TeamMappingUtils.getShortTeamName(mostPlayedTeam);
						answer = `${playerName} has played for the ${shortTeamName} the most.`;
						answerValue = shortTeamName;
						
						// Create table visualization with all teams
						const tableData = teamData.map((item) => ({
							Team: item.value,
							Games: item.appearances || 0,
						}));
						
						visualization = {
							type: "Table",
							data: tableData,
							config: {
								columns: [
									{ key: "Team", label: "Team" },
									{ key: "Games", label: "Games" },
								],
							},
						};
					} else {
						answer = `${playerName} has no team data available.`;
					}
				}
				// Handle MostScoredForTeam - find team with most goals
				else if (metric && (metric === "MostScoredForTeam" || metric.toUpperCase() === "MOSTSCOREDFORTEAM")) {
					const playerData = data.data as PlayerData[];
					if (playerData && playerData.length > 0) {
						const teamName = playerData[0].value as string;
						if (teamName) {
							// Convert team name to short format (e.g., "5th XI" -> "5s")
							const shortTeamName = TeamMappingUtils.getShortTeamName(teamName);
							const statDisplayName = (analysis as any).mostScoredForTeamStatDisplayName || "goals";
							answer = `${playerName} has scored the most ${statDisplayName} for the ${shortTeamName}.`;
							answerValue = shortTeamName;
						} else {
							answer = `${playerName} has no team data available.`;
						}
					} else {
						answer = `${playerName} has no team data available.`;
					}
				}
				// Handle MOSTMINUTESSEASON - find season with most minutes
				else if (metric && metric.toUpperCase() === "MOSTMINUTESSEASON") {
					// Check if we have array data (multiple seasons) from the query
					if (data && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
						const seasonsData = data.data as Array<{ season?: string; value: number | string; [key: string]: unknown }>;
						
						// Transform data to ensure we have season and value
						const transformedData = seasonsData
							.map((item) => {
								const season = item.season || (typeof item.value === "string" ? item.value : "");
								const minutes = typeof item.value === "number" ? item.value : (item.minutes as number) || 0;
								return { season, minutes };
							})
							.filter((item) => item.season && item.minutes !== undefined);
						
						if (transformedData.length > 0) {
							// Find the season with the most minutes
							const mostMinutesSeason = transformedData.reduce((max, item) => (item.minutes > max.minutes ? item : max), transformedData[0]);
							
							// Normalize season format (handle both "2018/19" and "2018-19")
							let seasonString = mostMinutesSeason.season;
							if (seasonString) {
								// If season is just a year, try to construct the full season string
								if (/^\d{4}$/.test(seasonString)) {
									const year = parseInt(seasonString, 10);
									const nextYear = (year + 1).toString().substring(2);
									seasonString = `${year}/${nextYear}`;
								}
								// Normalize season format (handle both "2018/19" and "2018-19")
								seasonString = seasonString.replace(/-/g, "/");
							}
							
							answer = `${playerName} played the most minutes in ${seasonString} (${mostMinutesSeason.minutes} ${mostMinutesSeason.minutes === 1 ? "minute" : "minutes"}).`;
							
							// Extract full season format from answer text to ensure answerValue matches the answer
							// This handles cases where database returns just "2017" instead of "2017/18"
							let extractedSeason = seasonString;
							if (answer) {
								const seasonMatch = answer.match(/\b(\d{4}\/\d{2})\b/);
								if (seasonMatch) {
									extractedSeason = seasonMatch[1];
								}
							}
							
							// Set answerValue to extracted season string (e.g., "2018/19") for test report validation
							answerValue = extractedSeason;
							
							// Sort by season ascending for chronological display
							const sortedData = [...transformedData].sort((a, b) => {
								return a.season.localeCompare(b.season);
							});
							
							// Create Chart visualization with all seasons and their minutes
							const chartData = sortedData.map((item) => ({
								name: item.season,
								value: item.minutes,
								isHighest: item.season === mostMinutesSeason.season,
							}));
							
							visualization = {
								type: "Chart",
								data: chartData,
								config: {
									type: "bar",
								},
							};
						} else {
							answer = `${playerName} has no season minutes data available.`;
						}
					} else {
						answer = `${playerName} has no season minutes data available.`;
					}
				}
				// Handle MOSTAPPEARANCESSEASON - find season with most appearances
				else if (metric && metric.toUpperCase() === "MOSTAPPEARANCESSEASON") {
					// Check if we have array data (multiple seasons) from the query
					if (data && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
						const seasonsData = data.data as Array<{ season?: string; value: number | string; [key: string]: unknown }>;
						
						// Transform data to ensure we have season and value
						const transformedData = seasonsData
							.map((item) => {
								const season = item.season || (typeof item.value === "string" ? item.value : "");
								const appearances = typeof item.value === "number" ? item.value : (item.appearances as number) || 0;
								return { season, appearances };
							})
							.filter((item) => item.season && item.appearances !== undefined);
						
						if (transformedData.length > 0) {
							// Find the season with the most appearances
							const mostAppearancesSeason = transformedData.reduce((max, item) => (item.appearances > max.appearances ? item : max), transformedData[0]);
							
							// Normalize season format (handle both "2018/19" and "2018-19")
							let seasonString = mostAppearancesSeason.season;
							if (seasonString) {
								// If season is just a year, try to construct the full season string
								if (/^\d{4}$/.test(seasonString)) {
									const year = parseInt(seasonString, 10);
									const nextYear = (year + 1).toString().substring(2);
									seasonString = `${year}/${nextYear}`;
								}
								// Normalize season format (handle both "2018/19" and "2018-19")
								seasonString = seasonString.replace(/-/g, "/");
							}
							
							answer = `${playerName} appeared in the most matches in ${seasonString} (${mostAppearancesSeason.appearances} ${mostAppearancesSeason.appearances === 1 ? "appearance" : "appearances"}).`;
							
							// Extract full season format from answer text to ensure answerValue matches the answer
							// This handles cases where database returns just "2017" instead of "2017/18"
							let extractedSeason = seasonString;
							if (answer) {
								const seasonMatch = answer.match(/\b(\d{4}\/\d{2})\b/);
								if (seasonMatch) {
									extractedSeason = seasonMatch[1];
								}
							}
							
							// Set answerValue to extracted season string (e.g., "2018/19") for test report validation
							answerValue = extractedSeason;
							
							// Sort by season ascending for chronological display
							const sortedData = [...transformedData].sort((a, b) => {
								return a.season.localeCompare(b.season);
							});
							
							// Find the maximum appearances for highlighting
							const maxAppearances = Math.max(...sortedData.map((item) => item.appearances));
							
							// Create Chart visualization with all seasons and their appearances
							visualization = {
								type: "Chart",
								data: sortedData.map((item) => ({
									name: item.season,
									value: item.appearances,
									isHighest: item.appearances === maxAppearances,
								})),
								config: {
									title: `${playerName} - Appearances per Season`,
									type: "bar",
									tooltipLabel: "Apps",
								},
							};
						} else {
							answer = `${playerName} has no season appearances data available.`;
						}
					} else {
						answer = `${playerName} has no season appearances data available.`;
					}
				}
				// Handle SUNDAYGOALS - goals scored in matches played on Sundays
				else if (metric && metric.toUpperCase() === "SUNDAYGOALS") {
					// Check if we have data from the query
					if (data && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
						const sundayGoalsData = data.data as Array<{ totalGoals?: number; [key: string]: unknown }>;
						const totalGoals = sundayGoalsData[0]?.totalGoals || 0;
						
						// Format answer based on whether it's first person or third person
						const isFirstPerson = question.toLowerCase().includes("i ") || question.toLowerCase().includes("my ") || question.toLowerCase().includes("have i");
						if (isFirstPerson) {
							answer = `You have scored ${totalGoals} ${totalGoals === 1 ? "goal" : "goals"} in matches played on Sundays.`;
						} else {
							answer = `${playerName} has scored ${totalGoals} ${totalGoals === 1 ? "goal" : "goals"} in matches played on Sundays.`;
						}
						
						answerValue = totalGoals;
						
						// Create NumberCard visualization
						const roundedGoals = this.roundValueByMetric("G", totalGoals);
						visualization = {
							type: "NumberCard",
							data: [{ 
								name: "Goals", 
								wordedText: "goals",
								value: roundedGoals,
								iconName: this.getIconNameForMetric("G")
							}],
							config: {
								title: `${playerName} - Goals on Sundays`,
								type: "bar",
							},
						};
					} else {
						// No data found
						const isFirstPerson = question.toLowerCase().includes("i ") || question.toLowerCase().includes("my ") || question.toLowerCase().includes("have i");
						if (isFirstPerson) {
							answer = `You have not scored any goals in matches played on Sundays.`;
						} else {
							answer = `${playerName} has not scored any goals in matches played on Sundays.`;
						}
						answerValue = 0;
					}
				}
				// Handle SATURDAYAPPEARANCES2022 - appearances on Saturdays in 2022
				else if (metric && metric.toUpperCase() === "SATURDAYAPPEARANCES2022") {
					// Check if we have data from the query
					if (data && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
						const saturdayAppearancesData = data.data as Array<{ appearances?: number; [key: string]: unknown }>;
						const appearances = saturdayAppearancesData[0]?.appearances || 0;
						
						// Format answer based on whether it's first person or third person
						const isFirstPerson = question.toLowerCase().includes("i ") || question.toLowerCase().includes("my ") || question.toLowerCase().includes("have i");
						if (isFirstPerson) {
							answer = `You made ${appearances} ${appearances === 1 ? "appearance" : "appearances"} on Saturdays in 2022.`;
						} else {
							answer = `${playerName} made ${appearances} ${appearances === 1 ? "appearance" : "appearances"} on Saturdays in 2022.`;
						}
						
						answerValue = appearances;
						
						// Create NumberCard visualization
						const roundedAppearances = this.roundValueByMetric("APP", appearances);
						visualization = {
							type: "NumberCard",
							data: [{ 
								name: "Appearances", 
								wordedText: "appearances",
								value: roundedAppearances,
								iconName: this.getIconNameForMetric("APP")
							}],
							config: {
								title: `${playerName} - Appearances on Saturdays in 2022`,
								type: "bar",
							},
						};
					} else {
						// No data found
						const isFirstPerson = question.toLowerCase().includes("i ") || question.toLowerCase().includes("my ") || question.toLowerCase().includes("have i");
						if (isFirstPerson) {
							answer = `You did not make any appearances on Saturdays in 2022.`;
						} else {
							answer = `${playerName} did not make any appearances on Saturdays in 2022.`;
						}
						answerValue = 0;
					}
				}
				// Handle HIGHESTGOALSASSISTSSEASON - find season with highest goals + assists total
				else if (metric && metric.toUpperCase() === "HIGHESTGOALSASSISTSSEASON") {
					// Check if we have array data (multiple seasons) from the query
					if (data && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
						const seasonsData = data.data as Array<{ 
							season?: string; 
							value: number | string; 
							goals?: number;
							penaltiesScored?: number;
							assists?: number;
							[key: string]: unknown 
						}>;
						
						// Transform data to ensure we have season, goals, penaltiesScored, assists, and total
						const transformedData = seasonsData
							.map((item) => {
								const season = item.season || (typeof item.value === "string" ? item.value : "");
								const goals = item.goals || 0;
								const penaltiesScored = item.penaltiesScored || 0;
								const assists = item.assists || 0;
								const total = typeof item.value === "number" ? item.value : (goals + penaltiesScored + assists);
								return { season, goals, penaltiesScored, assists, total };
							})
							.filter((item) => item.season && item.total !== undefined);
						
						if (transformedData.length > 0) {
							// Find the season with the highest total (goals + penaltiesScored + assists)
							const highestSeason = transformedData.reduce((max, item) => (item.total > max.total ? item : max), transformedData[0]);
							
							// Normalize season format (handle both "2018/19" and "2018-19")
							let seasonString = highestSeason.season;
							if (seasonString) {
								// If season is just a year, try to construct the full season string
								if (/^\d{4}$/.test(seasonString)) {
									const year = parseInt(seasonString, 10);
									const nextYear = (year + 1).toString().substring(2);
									seasonString = `${year}/${nextYear}`;
								}
								// Normalize season format (handle both "2018/19" and "2018-19")
								seasonString = seasonString.replace(/-/g, "/");
							}
							
							answer = `${playerName} recorded the highest combined goals + assists total in ${seasonString} (${highestSeason.total} total: ${highestSeason.goals} ${highestSeason.goals === 1 ? "goal" : "goals"}, ${highestSeason.penaltiesScored} ${highestSeason.penaltiesScored === 1 ? "penalty" : "penalties"}, ${highestSeason.assists} ${highestSeason.assists === 1 ? "assist" : "assists"}).`;
							
							// Extract full season format from answer text to ensure answerValue matches the answer
							// This handles cases where database returns just "2016" instead of "2016/17"
							let extractedSeason = seasonString;
							if (answer) {
								const seasonMatch = answer.match(/\b(\d{4}\/\d{2})\b/);
								if (seasonMatch) {
									extractedSeason = seasonMatch[1];
								}
							}
							
							// Set answerValue to extracted season string (e.g., "2018/19") for test report validation
							answerValue = extractedSeason;
							
							// Sort by season ascending for chronological display
							const sortedData = [...transformedData].sort((a, b) => {
								return a.season.localeCompare(b.season);
							});
							
							// Create Table visualization with all seasons showing goals, penalties, assists, and total
							const tableData = sortedData.map((item) => ({
								Season: item.season,
								Goals: item.goals,
								"Penalties Scored": item.penaltiesScored,
								Assists: item.assists,
								Total: item.total,
							}));
							
							visualization = {
								type: "Table",
								data: tableData,
								config: {
									columns: [
										{ key: "Season", label: "Season" },
										{ key: "Goals", label: "Goals" },
										{ key: "Penalties Scored", label: "Penalties Scored" },
										{ key: "Assists", label: "Assists" },
										{ key: "Total", label: "Total" },
									],
								},
							};
						} else {
							answer = `${playerName} has no season goals+assists data available.`;
						}
					} else {
						answer = `${playerName} has no season goals+assists data available.`;
					}
				}
				
				// Handle regular single-value queries
				} else {
					const playerData = data.data as PlayerData[];
					const playerName = data.playerName as string;
					const metric = data.metric as string;
					// For SEASON_COUNT_SIMPLE, value might be in playerSeasonCount field instead of value field
					const value = playerData[0]?.value ?? (playerData[0] as any)?.playerSeasonCount;
					const totalGames = (playerData[0] as any)?.totalGames;

					// Define competition filter variables at higher scope for use in multiple branches
					const competitions = analysis.competitions || [];
					const hasCompetitionFilter = competitions.length > 0;
					const competitionTypes = analysis.competitionTypes || [];
					const hasCompetitionTypeFilter = competitionTypes.length > 0;

					if (value !== undefined && value !== null) {
						// Special handling for NumberTeamsPlayedFor - format as "X of the clubs Y teams"
						if (metric && (metric === "NUMBERTEAMSPLAYEDFOR" || metric === "NumberTeamsPlayedFor")) {
							const playerTeamCount = typeof value === "number" ? value : 0;
							const totalTeamCount = (playerData[0] as any)?.totalTeamCount || 9; // Default to 9 if not provided
							answer = `${playerName} has played for ${playerTeamCount} of the clubs ${totalTeamCount} teams.`;
							answerValue = `${playerTeamCount}/${totalTeamCount}`;
						} else if (metric && (metric === "NUMBERSEASONSPLAYEDFOR" || metric === "NumberSeasonsPlayedFor" || metric.toUpperCase().includes("NUMBERSEASONSPLAYEDFOR") || metric === "Season Count Simple" || metric.toUpperCase() === "SEASON COUNT SIMPLE" || metric === "SEASON_COUNT_SIMPLE" || metric.toUpperCase() === "SEASON_COUNT_SIMPLE")) {
							// Special handling for NumberSeasonsPlayedFor and SEASON_COUNT_SIMPLE - format as "X out of Y" where Y is total seasons
							const playerSeasonCount = typeof value === "number" ? value : (playerData[0] as any)?.playerSeasonCount || (playerData[0] as any)?.value || 0;
							const totalSeasonCount = (playerData[0] as any)?.totalSeasonCount || 0;
							if (totalSeasonCount > 0) {
								answer = `${playerName} has played in ${playerSeasonCount} out of the ${totalSeasonCount} recorded seasons.`;
								answerValue = `${playerSeasonCount}/${totalSeasonCount}`;
							} else {
								answer = `${playerName} has played in ${playerSeasonCount} seasons.`;
								answerValue = playerSeasonCount;
							}
						} else {
							// Check if this is a percentage query (Home/Away/Games % Won/Lost/Drawn)
							const isPercentageQuery = metric && (
								metric.toUpperCase().includes("HOMEGAMES%") ||
								metric.toUpperCase().includes("AWAYGAMES%") ||
								metric.toUpperCase().includes("GAMES%")
							);

							if (isPercentageQuery && totalGames !== undefined) {
								// Format percentage with 1 decimal place
								const percentageValue = typeof value === "number" ? value : Number(value);
								const formattedPercentage = percentageValue.toFixed(1);
								answerValue = percentageValue;

								// Determine the result type and location
								const metricUpper = metric.toUpperCase();
								const isHome = metricUpper.includes("HOMEGAMES");
								const isAway = metricUpper.includes("AWAYGAMES");
								const isWon = metricUpper.includes("%WON");
								const isLost = metricUpper.includes("%LOST");
								const isDrawn = metricUpper.includes("%DRAWN");

								const location = isHome ? "home" : isAway ? "away" : "";
								const result = isWon ? "won" : isLost ? "lost" : isDrawn ? "drawn" : "";
								const gameText = totalGames === 1 ? "game" : "games";

								// Build response text: "Luke Bangs has won 40.5% of the 78 away games he has played"
								const pronoun = userContext && playerName.toLowerCase() === userContext.toLowerCase() ? "he" : "they";
								if (location) {
									answer = `${playerName} has ${result} ${formattedPercentage}% of the ${totalGames} ${location} ${gameText} ${pronoun} has played.`;
								} else {
									answer = `${playerName} has ${result} ${formattedPercentage}% of the ${totalGames} ${gameText} ${pronoun} has played.`;
								}

								// Create NumberCard visualization
								// Determine icon name based on location (use same icon for all result types for home/away)
								let iconName: string;
								if (isAway) {
									// Use PercentageAwayGamesWon-Icon for all away games percentage queries (won/lost/drawn)
									iconName = "PercentageAwayGamesWon-Icon";
								} else if (isHome) {
									// Use PercentageHomeGamesWon-Icon for all home games percentage queries (won/lost/drawn)
									iconName = "PercentageHomeGamesWon-Icon";
								} else {
									// General games percentage - use result-specific icons
									if (isWon) {
										iconName = "PercentageGamesWon-Icon";
									} else if (isLost) {
										iconName = "PercentageGamesLost-Icon";
									} else {
										iconName = "PercentageGamesDrawn-Icon";
									}
								}
								// Format display name as "% of [location] games [result]" for NumberCard
								const displayName = isAway 
									? (isWon ? "% of away games won" : isLost ? "% of away games lost" : "% of away games drawn")
									: isHome
									? (isWon ? "% of home games won" : isLost ? "% of home games lost" : "% of home games drawn")
									: (isWon ? "% of games won" : isLost ? "% of games lost" : "% of games drawn");

								// Format value to 1 decimal place for NumberCard display
								const formattedValue = parseFloat(percentageValue.toFixed(1));

								visualization = {
									type: "NumberCard",
									data: [{
										name: displayName,
										value: formattedValue,
										metric: metric,
										iconName: iconName
									}],
									config: {
										title: displayName,
										type: "bar",
									},
								};
							// Round answerValue for penalty conversion rate to 1 decimal place
							} else if (metric && metric.toUpperCase() === "PENALTY_CONVERSION_RATE") {
								answerValue = this.roundValueByMetric(metric, value as number);
								answer = ResponseBuilder.buildContextualResponse(playerName, metric, value, analysis);
							} else {
								answerValue = value as number;
							
								// Special handling for APP metric with 0 value and season timeFrame
								const numericValue = typeof value === "number" ? value : Number(value);
								const isAppMetric = metric && (metric.toUpperCase() === "APP" || metric.toUpperCase() === "APPS");
								const isZeroValue = !Number.isNaN(numericValue) && numericValue === 0;
								const seasonFrame = analysis.extractionResult?.timeFrames?.find((tf) => tf.type === "season");
								
								// Check for team filter with goals/assists/other stats queries
								const teamEntities = analysis.teamEntities || [];
								const hasTeamFilter = teamEntities.length > 0;
								const isGoalsQuery = metric && metric.toUpperCase() === "G";
								const isAssistsQuery = metric && metric.toUpperCase() === "A";
								const locations = analysis.extractionResult?.locations || [];
								const hasHomeLocation = locations.some((loc) => loc.type === "home");
								const hasAwayLocation = locations.some((loc) => loc.type === "away");
								const timeFrames = analysis.extractionResult?.timeFrames || [];
								const timeRange = analysis.timeRange;
								
								// Handle APP metric with 0 value and season timeFrame BEFORE other logic
								if (isAppMetric && isZeroValue && seasonFrame) {
									
									// Normalize season format (handle both slash and dash)
									let season = seasonFrame.value.replace("-", "/");
									answer = `${playerName} did not make an appearance in the ${season} season.`;
									answerValue = 0;
									
								}
								
								// Extract date range or "since"/"after" date from timeFrames or timeRange
								// Only build normal answer if special case wasn't handled
								let dateRangeText = "";
								const lowerQuestion = analysis.question?.toLowerCase() || "";
								
								// Check for "since" or "after" patterns first
								const sinceFrame = timeFrames.find(tf => tf.type === "since");
								if (sinceFrame) {
									// Handle "since [YEAR]" patterns
									const sinceValue = sinceFrame.value;
									// Check if it's a year (4 digits) or a date
									if (/^\d{4}$/.test(sinceValue)) {
									// It's a year, format as "after [YEAR]" or "since [YEAR]" based on question
									if (lowerQuestion.includes("after")) {
										dateRangeText = `after ${sinceValue}`;
									} else {
										dateRangeText = `since ${sinceValue}`;
									}
								} else {
									// It's a date, format it
									const formattedDate = DateUtils.formatDate(sinceValue);
									if (lowerQuestion.includes("after")) {
										dateRangeText = `after ${formattedDate}`;
									} else {
										dateRangeText = `since ${formattedDate}`;
									}
								}
							} else if (timeRange && timeRange.includes(" to ")) {
								const [startDate, endDate] = timeRange.split(" to ");
								dateRangeText = `between the dates ${DateUtils.formatDate(startDate.trim())} and ${DateUtils.formatDate(endDate.trim())}`;
							} else {
								const rangeFrame = timeFrames.find(tf => tf.type === "range");
								if (rangeFrame && rangeFrame.value && rangeFrame.value.includes(" to ")) {
									// Extract from value property
									const [startDate, endDate] = rangeFrame.value.split(" to ");
									dateRangeText = `between the dates ${DateUtils.formatDate(startDate.trim())} and ${DateUtils.formatDate(endDate.trim())}`;
								} else if (timeRange && !timeRange.includes(" to ")) {
									// Single date (could be from "since"/"after" pattern that was converted)
									// Check if question mentions "after" or "since"
									const formattedDate = DateUtils.formatDate(timeRange);
									if (lowerQuestion.includes("after")) {
										dateRangeText = `after ${formattedDate}`;
									} else if (lowerQuestion.includes("since")) {
										dateRangeText = `since ${formattedDate}`;
									}
								} else {
									// Check for date frames that might be "after" dates
									const dateFrame = timeFrames.find(tf => tf.type === "date");
									if (dateFrame && (lowerQuestion.includes("after") || lowerQuestion.includes("since"))) {
										const formattedDate = DateUtils.formatDate(dateFrame.value);
										if (lowerQuestion.includes("after")) {
											dateRangeText = `after ${formattedDate}`;
										} else {
											dateRangeText = `since ${formattedDate}`;
										}
									}
								}
							}
							
							// Build answer text for goals queries with filters
							if (hasTeamFilter && isGoalsQuery) {
								// Build answer text with all applicable filters (team, location, date range)
								const teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
								const teamDisplayName = teamName
									.replace("1st XI", "1s")
									.replace("2nd XI", "2s")
									.replace("3rd XI", "3s")
									.replace("4th XI", "4s")
									.replace("5th XI", "5s")
									.replace("6th XI", "6s")
									.replace("7th XI", "7s")
									.replace("8th XI", "8s");
								
								const goalCount = value as number;
								
								// If goal count is 0, use "has not scored" format
								if (goalCount === 0) {
									answer = `${playerName} has not scored for the ${teamDisplayName}.`;
								} else {
									const goalText = goalCount === 1 ? "goal" : "goals";
									
									// Build answer parts
									let answerParts: string[] = [];
									
									// Start with player name and goal count
									answerParts.push(`${playerName} scored ${goalCount} ${goalText}`);
									
									// Add team filter
									answerParts.push(`for the ${teamDisplayName}`);
								
									// Add location filter if present
									if (hasHomeLocation) {
										answerParts.push("whilst playing at home");
									} else if (hasAwayLocation) {
										answerParts.push("whilst playing away");
									}
									
									// Add date range filter if present
									if (dateRangeText) {
										answerParts.push(dateRangeText);
									}
									
									// Join parts and add period
									answer = answerParts.join(" ") + ".";
								}
							} else if (hasTeamFilter && isAssistsQuery) {
								// Build answer text for assists queries with filters (team, location, date range)
								const teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
								const teamDisplayName = teamName
									.replace("1st XI", "1s")
									.replace("2nd XI", "2s")
									.replace("3rd XI", "3s")
									.replace("4th XI", "4s")
									.replace("5th XI", "5s")
									.replace("6th XI", "6s")
									.replace("7th XI", "7s")
									.replace("8th XI", "8s");
								
								const assistCount = value as number;
								const assistText = assistCount === 1 ? "assist" : "assists";
								
								// Build answer parts
								let answerParts: string[] = [];
								
								// Start with player name and assist count
								answerParts.push(`${playerName} provided ${assistCount} ${assistText}`);
								
								// Add team filter
								answerParts.push(`for the ${teamDisplayName}`);
								
								// Add location filter if present
								if (hasHomeLocation) {
									answerParts.push("whilst playing at home");
								} else if (hasAwayLocation) {
									answerParts.push("whilst playing away");
								}
								
								// Add date range filter if present
								let finalDateRangeText = dateRangeText;
								if (!finalDateRangeText) {
									// Check if question contains "during [YEAR]" pattern
									const duringYearMatch = lowerQuestion.match(/\bduring\s+(\d{4})\b/);
									if (duringYearMatch) {
										finalDateRangeText = `in ${duringYearMatch[1]}`;
									}
								} else {
									// Check if dateRangeText contains a year (e.g., "in 2023" or "during 2023")
									// If it's a year, format it as "in 2023"
									const yearMatch = dateRangeText.match(/\b(20\d{2})\b/);
									if (yearMatch && (dateRangeText.includes("during") || lowerQuestion.includes("during"))) {
										finalDateRangeText = `in ${yearMatch[1]}`;
									}
								}
								
								if (finalDateRangeText) {
									answerParts.push(finalDateRangeText);
								}
								
								// Join parts and add period
								answer = answerParts.join(" ") + ".";
							} else if (hasTeamFilter || hasHomeLocation || hasAwayLocation || dateRangeText) {
								// Check if this is a team-specific appearance metric FIRST (before general fallback)
								// Check multiple patterns to catch all variations
								const metricMatch1 = metric.match(/^\d+sApps$/i);
								const metricMatch2 = metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i);
								// Also check if metric contains "Apps" and team reference (more lenient check)
								// This catches variations like "4th XI Apps", "4sApps", etc.
								const hasAppsAndTeam = metric && typeof metric === "string" && metric.includes("Apps") && (
									metric.includes("XI") || 
									metric.match(/\d+s/i) ||
									metric.match(/\d+(?:st|nd|rd|th)/i)
								);
								// Also check analysis.metrics for team-specific appearance patterns
								const analysisHasTeamApps = analysis.metrics && analysis.metrics.some((m: string) => 
									m.match(/^\d+sApps$/i) || m.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i)
								);
								// Check if the metric display name indicates team-specific appearances
								const statObjectKey = this.mapMetricToStatObjectKey(metric);
								const metricConfig = statObject[statObjectKey as keyof typeof statObject];
								const statDisplayName = metricConfig?.displayText || getMetricDisplayName(metric, value as number);
								const displayNameHasTeamApps = statDisplayName && typeof statDisplayName === "string" && 
									statDisplayName.toLowerCase().includes("team appearances");
								const isTeamSpecificAppearanceMetric = !!(metricMatch1 || metricMatch2 || hasAppsAndTeam || analysisHasTeamApps || displayNameHasTeamApps);
								const isTeamSpecificGoalsMetric = !!(metric && (metric.match(/^\d+sGoals$/i) || metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i)));
								if (isTeamSpecificAppearanceMetric && hasTeamFilter) {
									// Use "has X appearances for the Ys" format
									const teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
									const teamDisplayName = teamName
										.replace("1st XI", "1s")
										.replace("2nd XI", "2s")
										.replace("3rd XI", "3s")
										.replace("4th XI", "4s")
										.replace("5th XI", "5s")
										.replace("6th XI", "6s")
										.replace("7th XI", "7s")
										.replace("8th XI", "8s");
									const appearanceCount = value as number;
									answer = `${playerName} has ${appearanceCount} ${appearanceCount === 1 ? "appearance" : "appearances"} for the ${teamDisplayName}.`;
								} else if (isTeamSpecificGoalsMetric) {
									// Use "has X goals for the Ys" format for team-specific goals metrics
									let teamDisplayName = "";
									if (metric.match(/^\d+sGoals$/i)) {
										const teamNumber = metric.match(/^(\d+)sGoals$/i)?.[1];
										if (teamNumber) {
											teamDisplayName = `${teamNumber}s`;
										}
									} else if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i)) {
										const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Goals$/i);
										if (teamMatch) {
											const teamName = TeamMappingUtils.mapTeamName(teamMatch[1] + " XI");
											teamDisplayName = teamName
												.replace("1st XI", "1s")
												.replace("2nd XI", "2s")
												.replace("3rd XI", "3s")
												.replace("4th XI", "4s")
												.replace("5th XI", "5s")
												.replace("6th XI", "6s")
												.replace("7th XI", "7s")
												.replace("8th XI", "8s");
										}
									}
									if (teamDisplayName) {
										const goalCount = value as number;
										if (goalCount === 0) {
											answer = `${playerName} has not scored for the ${teamDisplayName}.`;
										} else {
											const goalText = goalCount === 1 ? "goal" : "goals";
											answer = `${playerName} has ${goalCount} ${goalText} for the ${teamDisplayName}.`;
										}
									} else {
										// Fallback to general handler
										const statObjectKey = this.mapMetricToStatObjectKey(metric);
										const metricConfig = statObject[statObjectKey as keyof typeof statObject];
										const statDisplayName = metricConfig?.displayText || getMetricDisplayName(metric, value as number);
										const statCount = value as number;
										
										// Build answer parts
										let answerParts: string[] = [];
										answerParts.push(`${playerName} got ${statCount} ${statDisplayName.toLowerCase()}`);
										
										// Add team filter if present
										if (hasTeamFilter) {
											const teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
											const teamDisplayName = teamName
												.replace("1st XI", "1s")
												.replace("2nd XI", "2s")
												.replace("3rd XI", "3s")
												.replace("4th XI", "4s")
												.replace("5th XI", "5s")
												.replace("6th XI", "6s")
												.replace("7th XI", "7s")
												.replace("8th XI", "8s");
											answerParts.push(`for the ${teamDisplayName}`);
										}
										
										// Join parts and add period
										answer = answerParts.join(" ") + ".";
									}
								} else if (isAssistsQuery && (hasHomeLocation || hasAwayLocation || dateRangeText)) {
									// Build answer text for assists queries with location/date filters (but no team filter)
									const assistCount = value as number;
									const assistText = assistCount === 1 ? "assist" : "assists";
									
									// Build answer parts
									let answerParts: string[] = [];
									
									// Start with player name and assist count
									answerParts.push(`${playerName} provided ${assistCount} ${assistText}`);
									
									// Add location filter if present
									if (hasHomeLocation) {
										answerParts.push("whilst playing at home");
									} else if (hasAwayLocation) {
										answerParts.push("whilst playing away");
									}
									
									// Add date range filter if present
									let finalDateRangeText = dateRangeText;
									if (!finalDateRangeText) {
										// Check if question contains "during [YEAR]" pattern
										const duringYearMatch = lowerQuestion.match(/\bduring\s+(\d{4})\b/);
										if (duringYearMatch) {
											finalDateRangeText = `in ${duringYearMatch[1]}`;
										}
									} else {
										// Check if dateRangeText contains a year (e.g., "in 2023" or "during 2023")
										// If it's a year, format it as "in 2023"
										const yearMatch = dateRangeText.match(/\b(20\d{2})\b/);
										if (yearMatch && (dateRangeText.includes("during") || lowerQuestion.includes("during"))) {
											finalDateRangeText = `in ${yearMatch[1]}`;
										}
									}
									
									if (finalDateRangeText) {
										answerParts.push(finalDateRangeText);
									}
									
									// Join parts and add period
									answer = answerParts.join(" ") + ".";
								} else if (metric && (metric.toUpperCase() === "HOMEGAMES" || metric.toUpperCase() === "HOME" || metric === "Home Games") && (value === 0 || value === "0" || (typeof value === "number" && value === 0))) {
									// Special handling for home games with zero value
									// Check if there's a result filter and if player has any home games
									const hasResultFilter = analysis.results && analysis.results.length > 0;
									if (hasResultFilter && totalGames !== undefined && totalGames > 0) {
										const resultType = analysis.results?.[0]?.toLowerCase();
										if (resultType === "win" || resultType === "w") {
											answer = `${playerName} has not won a home game.`;
										} else if (resultType === "loss" || resultType === "l") {
											answer = `${playerName} has not lost a home game.`;
										} else if (resultType === "draw" || resultType === "d") {
											answer = `${playerName} has not drawn a home game.`;
										} else {
											answer = `${playerName} has not played a home game.`;
										}
									} else {
										answer = `${playerName} has not played a home game.`;
									}
								} else if (metric && (metric.toUpperCase() === "AWAYGAMES" || metric.toUpperCase() === "AWAY" || metric === "Away Games") && (value === 0 || value === "0" || (typeof value === "number" && value === 0))) {
									// Special handling for away games with zero value
									// Check if there's a result filter and if player has any away games
									const hasResultFilter = analysis.results && analysis.results.length > 0;
									if (hasResultFilter && totalGames !== undefined && totalGames > 0) {
										const resultType = analysis.results?.[0]?.toLowerCase();
										if (resultType === "win" || resultType === "w") {
											answer = `${playerName} has not won an away game.`;
										} else if (resultType === "loss" || resultType === "l") {
											answer = `${playerName} has not lost an away game.`;
										} else if (resultType === "draw" || resultType === "d") {
											answer = `${playerName} has not drawn an away game.`;
										} else {
											answer = `${playerName} has not played an away game.`;
										}
									} else {
										answer = `${playerName} has not played an away game.`;
									}
								} else {
									// General fallback: Build answer text for any stat query with filters (team, location, or date range)
									// This handles yellow cards, MoMs, and other stats with filters
									const statObjectKey = this.mapMetricToStatObjectKey(metric);
									const metricConfig = statObject[statObjectKey as keyof typeof statObject];
									const statDisplayName = metricConfig?.displayText || getMetricDisplayName(metric, value as number);
									const statCount = value as number;
									
									// Build answer parts
									let answerParts: string[] = [];
									
									// Start with player name and stat count
									answerParts.push(`${playerName} got ${statCount} ${statDisplayName.toLowerCase()}`);
									
									// Add team filter if present
									if (hasTeamFilter) {
										const teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
										const teamDisplayName = teamName
											.replace("1st XI", "1s")
											.replace("2nd XI", "2s")
											.replace("3rd XI", "3s")
											.replace("4th XI", "4s")
											.replace("5th XI", "5s")
											.replace("6th XI", "6s")
											.replace("7th XI", "7s")
											.replace("8th XI", "8s");
										answerParts.push(`for the ${teamDisplayName}`);
									}
									
									// Add location filter if present
									if (hasHomeLocation) {
										answerParts.push("whilst playing at home");
									} else if (hasAwayLocation) {
										answerParts.push("whilst playing away");
									}
									
									// Add date range filter if present
									if (dateRangeText) {
										answerParts.push(dateRangeText);
									}
									
									// Join parts and add period
									answer = answerParts.join(" ") + ".";
								}
							} else if (hasCompetitionTypeFilter && metric && metric.toUpperCase() === "APP") {
								// Custom answer format for games/appearances with competition type: "Luke Bangs has played 4 games in cup competitions."
								const competitionType = competitionTypes[0];
								const competitionTypeDisplay = competitionType.charAt(0).toUpperCase() + competitionType.slice(1).toLowerCase();
								const gameCount = value as number;
								const gameText = gameCount === 1 ? "game" : "games";
								answer = `${playerName} has played ${gameCount} ${gameText} in ${competitionTypeDisplay} competitions.`;
							} else if (hasCompetitionTypeFilter && metric && metric.toUpperCase() === "G") {
								// Custom answer format for goals with competition type: "Luke Bangs has scored 4 goals in cup competitions."
								const competitionType = competitionTypes[0];
								const competitionTypeDisplay = competitionType.charAt(0).toUpperCase() + competitionType.slice(1).toLowerCase();
								const goalCount = value as number;
								const goalText = goalCount === 1 ? "goal" : "goals";
								answer = `${playerName} has scored ${goalCount} ${goalText} in ${competitionTypeDisplay} competitions.`;
							} else if (hasCompetitionFilter && metric && metric.toUpperCase() === "G") {
								// Custom answer format for goals with competition: "Oli Goddard has scored 5 goals in the Premier"
								const competitionName = competitions[0];
								const goalCount = value as number;
								const goalText = goalCount === 1 ? "goal" : "goals";
								answer = `${playerName} has scored ${goalCount} ${goalText} in the ${competitionName}.`;
							} else {
								answer = ResponseBuilder.buildContextualResponse(playerName, metric, value, analysis);
							}
								}
							}
						
						// Create NumberCard visualization for penalty conversion rate
						if (metric && metric.toUpperCase() === "PENALTY_CONVERSION_RATE") {
							const statObjectKey = this.mapMetricToStatObjectKey(metric);
							const metricConfig = statObject[statObjectKey as keyof typeof statObject];
							// Use penalty conversion rate icon (PenaltyConversionRate-Icon)
							const iconName = metricConfig?.iconName || this.getIconNameForMetric(metric);
							const displayName = metricConfig?.displayText || "Penalty Conversion Rate";
							const roundedValue = this.roundValueByMetric(metric, value as number);
							
							visualization = {
								type: "NumberCard",
								data: [{ 
									name: displayName, 
									value: roundedValue,
									iconName: iconName
								}],
								config: {
									title: displayName,
									type: "bar",
								},
							};
						}
						// Create NumberCard visualization for goals queries with competition, location, or team filters
						// Also handle OPENPLAYGOALS (open play goals)
						if (metric && (metric.toUpperCase() === "G" || metric.toUpperCase() === "OPENPLAYGOALS")) {
							const locations = analysis.extractionResult?.locations || [];
							const hasAwayLocation = locations.some((loc) => loc.type === "away");
							const hasHomeLocation = locations.some((loc) => loc.type === "home");
							const teamEntities = analysis.teamEntities || [];
							const hasTeamFilter = teamEntities.length > 0;
							const timeFrames = analysis.extractionResult?.timeFrames || [];
							const hasDateFilter = timeFrames.some((tf) => tf.type === "range" || tf.type === "since") || analysis.timeRange;
							const competitions = analysis.competitions || [];
							const hasCompetitionFilter = competitions.length > 0;
							const competitionTypes = analysis.competitionTypes || [];
							const hasCompetitionTypeFilter = competitionTypes.length > 0;
							
							const iconName = this.getIconNameForMetric(metric);
							const roundedValue = this.roundValueByMetric(metric, value as number);
							// Use "open play goals" for OPENPLAYGOALS, "goals" for G
							const isOpenPlayGoals = metric.toUpperCase() === "OPENPLAYGOALS";
							const wordedTextForGoals = isOpenPlayGoals ? "open play goals" : "goals";
							
							// Handle combinations of filters first (priority: location + team + date > location + team > location + date > team + date)
							if ((hasHomeLocation || hasAwayLocation) && hasTeamFilter && hasDateFilter) {
								// Home/Away + Team + Date Range
								const locationText = hasHomeLocation ? "Home" : "Away";
								const teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
								const teamDisplayName = teamName
									.replace("1st XI", "1s")
									.replace("2nd XI", "2s")
									.replace("3rd XI", "3s")
									.replace("4th XI", "4s")
									.replace("5th XI", "5s")
									.replace("6th XI", "6s")
									.replace("7th XI", "7s")
									.replace("8th XI", "8s");
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: "goals",
										wordedText: wordedTextForGoals, 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - Goals for the ${teamDisplayName} (${locationText})`,
										type: "bar",
									},
								};
							} else if ((hasHomeLocation || hasAwayLocation) && hasTeamFilter) {
								// Home/Away + Team
								const locationText = hasHomeLocation ? "Home" : "Away";
								const teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
								const teamDisplayName = teamName
									.replace("1st XI", "1s")
									.replace("2nd XI", "2s")
									.replace("3rd XI", "3s")
									.replace("4th XI", "4s")
									.replace("5th XI", "5s")
									.replace("6th XI", "6s")
									.replace("7th XI", "7s")
									.replace("8th XI", "8s");
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: "goals",
										wordedText: wordedTextForGoals, 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - Goals for the ${teamDisplayName} (${locationText})`,
										type: "bar",
									},
								};
							} else if ((hasHomeLocation || hasAwayLocation) && hasDateFilter) {
								// Home/Away + Date Range
								const displayName = hasHomeLocation ? "Home Goals" : "Away Goals";
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: displayName, 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: displayName,
										type: "bar",
									},
								};
							} else if (hasTeamFilter && hasDateFilter) {
								// Team + Date Range
								const teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
								const teamDisplayName = teamName
									.replace("1st XI", "1s")
									.replace("2nd XI", "2s")
									.replace("3rd XI", "3s")
									.replace("4th XI", "4s")
									.replace("5th XI", "5s")
									.replace("6th XI", "6s")
									.replace("7th XI", "7s")
									.replace("8th XI", "8s");
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: "goals",
										wordedText: wordedTextForGoals, 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - Goals for the ${teamDisplayName}`,
										type: "bar",
									},
								};
							} else if (hasAwayLocation) {
								// Away only
								const displayName = "Away Goals";
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: displayName, 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: displayName,
										type: "bar",
									},
								};
							} else if (hasHomeLocation) {
								// Home only
								const displayName = "Home Goals";
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: displayName, 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: displayName,
										type: "bar",
									},
								};
							} else if (hasTeamFilter) {
								// Team only
								const teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
								const teamDisplayName = teamName
									.replace("1st XI", "1s")
									.replace("2nd XI", "2s")
									.replace("3rd XI", "3s")
									.replace("4th XI", "4s")
									.replace("5th XI", "5s")
									.replace("6th XI", "6s")
									.replace("7th XI", "7s")
									.replace("8th XI", "8s");
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: "goals",
										wordedText: wordedTextForGoals, 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - Goals for the ${teamDisplayName}`,
										type: "bar",
									},
								};
							} else if (hasCompetitionTypeFilter) {
								// Generate NumberCard for goals in competition type (e.g., "Cup", "League")
								const competitionType = competitionTypes[0];
								const competitionTypeDisplay = competitionType.charAt(0).toUpperCase() + competitionType.slice(1).toLowerCase();
								const iconName = this.getIconNameForMetric(metric);
								const roundedValue = this.roundValueByMetric(metric, value as number);
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: "goals",
										wordedText: wordedTextForGoals, 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - Goals in ${competitionTypeDisplay} Competitions`,
										type: "bar",
									},
								};
							} else if (hasCompetitionFilter) {
								// Generate NumberCard for goals in specific competition (e.g., "Premier")
								// NumberCard should show just "goals" as the name
								const iconName = this.getIconNameForMetric(metric);
								const roundedValue = this.roundValueByMetric(metric, value as number);
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: "goals",
										wordedText: wordedTextForGoals, 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - Goals in ${competitions[0]}`,
										type: "bar",
									},
								};
							} else if (!hasHomeLocation && !hasAwayLocation && !hasTeamFilter && !hasDateFilter && !hasCompetitionTypeFilter && !hasCompetitionFilter) {
								// No filters - create NumberCard for simple open play goals query
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: isOpenPlayGoals ? "Open Play Goals" : "Goals",
										wordedText: wordedTextForGoals, 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - ${isOpenPlayGoals ? "Open Play Goals" : "Goals"}`,
										type: "bar",
									},
								};
							}
						}
						// Create NumberCard visualization for games/appearances queries with competition type filters
						else if (metric && metric.toUpperCase() === "APP" && hasCompetitionTypeFilter) {
							const competitionType = competitionTypes[0];
							const competitionTypeDisplay = competitionType.charAt(0).toUpperCase() + competitionType.slice(1).toLowerCase();
							const iconName = this.getIconNameForMetric(metric);
							const roundedValue = this.roundValueByMetric(metric, value as number);
							
							visualization = {
								type: "NumberCard",
								data: [{ 
									name: "Games",
									wordedText: "games", 
									value: roundedValue,
									iconName: iconName
								}],
								config: {
									title: `${playerName} - Games in ${competitionTypeDisplay} Competitions`,
									type: "bar",
								},
							};
						}
						// Create NumberCard visualization for assists queries with team exclusions
						else if (metric && metric.toUpperCase() === "A" && analysis.teamExclusions && analysis.teamExclusions.length > 0) {
							const iconName = this.getIconNameForMetric(metric);
							const roundedValue = this.roundValueByMetric(metric, value as number);
							const excludedTeam = TeamMappingUtils.mapTeamName(analysis.teamExclusions[0]);
							// Convert to display format (e.g., "3rd XI -> 3s")
							const excludedTeamDisplay = excludedTeam
								.replace("1st XI", "1s")
								.replace("2nd XI", "2s")
								.replace("3rd XI", "3s")
								.replace("4th XI", "4s")
								.replace("5th XI", "5s")
								.replace("6th XI", "6s")
								.replace("7th XI", "7s")
								.replace("8th XI", "8s");
							
							visualization = {
								type: "NumberCard",
								data: [{ 
									name: "Assists",
									wordedText: "assists", 
									value: roundedValue,
									iconName: iconName
								}],
								config: {
									title: `${playerName} - Assists (excluding ${excludedTeamDisplay})`,
									type: "bar",
								},
							};
						}
						// Create NumberCard visualization for assists queries with competition, location, or team filters
						else if (metric && metric.toUpperCase() === "A") {
							const locations = analysis.extractionResult?.locations || [];
							const hasAwayLocation = locations.some((loc) => loc.type === "away");
							const hasHomeLocation = locations.some((loc) => loc.type === "home");
							const teamEntities = analysis.teamEntities || [];
							const hasTeamFilter = teamEntities.length > 0;
							const timeFrames = analysis.extractionResult?.timeFrames || [];
							const hasDateFilter = timeFrames.some((tf) => tf.type === "range" || tf.type === "since") || analysis.timeRange;
							
							const iconName = this.getIconNameForMetric(metric);
							const roundedValue = this.roundValueByMetric(metric, value as number);
							
							// Handle combinations of filters first (priority: location + team + date > location + team > location + date > team + date)
							if ((hasHomeLocation || hasAwayLocation) && hasTeamFilter && hasDateFilter) {
								// Home/Away + Team + Date Range
								const locationText = hasHomeLocation ? "Home" : "Away";
								const teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
								const teamDisplayName = teamName
									.replace("1st XI", "1s")
									.replace("2nd XI", "2s")
									.replace("3rd XI", "3s")
									.replace("4th XI", "4s")
									.replace("5th XI", "5s")
									.replace("6th XI", "6s")
									.replace("7th XI", "7s")
									.replace("8th XI", "8s");
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: "assists",
										wordedText: "assists", 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - Assists for the ${teamDisplayName} (${locationText})`,
										type: "bar",
									},
								};
							} else if ((hasHomeLocation || hasAwayLocation) && hasTeamFilter) {
								// Home/Away + Team
								const locationText = hasHomeLocation ? "Home" : "Away";
								const teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
								const teamDisplayName = teamName
									.replace("1st XI", "1s")
									.replace("2nd XI", "2s")
									.replace("3rd XI", "3s")
									.replace("4th XI", "4s")
									.replace("5th XI", "5s")
									.replace("6th XI", "6s")
									.replace("7th XI", "7s")
									.replace("8th XI", "8s");
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: "assists",
										wordedText: "assists", 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - Assists for the ${teamDisplayName} (${locationText})`,
										type: "bar",
									},
								};
							} else if ((hasHomeLocation || hasAwayLocation) && hasDateFilter) {
								// Home/Away + Date Range
								const displayName = hasHomeLocation ? "Home Assists" : "Away Assists";
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: displayName, 
										wordedText: "assists",
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: displayName,
										type: "bar",
									},
								};
							} else if (hasTeamFilter && hasDateFilter) {
								// Team + Date Range
								const teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
								const teamDisplayName = teamName
									.replace("1st XI", "1s")
									.replace("2nd XI", "2s")
									.replace("3rd XI", "3s")
									.replace("4th XI", "4s")
									.replace("5th XI", "5s")
									.replace("6th XI", "6s")
									.replace("7th XI", "7s")
									.replace("8th XI", "8s");
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: "assists",
										wordedText: "assists", 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - Assists for the ${teamDisplayName}`,
										type: "bar",
									},
								};
							} else if (hasAwayLocation) {
								// Away only
								const displayName = "Away Assists";
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: displayName, 
										wordedText: "assists",
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: displayName,
										type: "bar",
									},
								};
							} else if (hasHomeLocation) {
								// Home only
								const displayName = "Home Assists";
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: displayName, 
										wordedText: "assists",
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: displayName,
										type: "bar",
									},
								};
							} else if (hasTeamFilter) {
								// Team only
								const teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
								const teamDisplayName = teamName
									.replace("1st XI", "1s")
									.replace("2nd XI", "2s")
									.replace("3rd XI", "3s")
									.replace("4th XI", "4s")
									.replace("5th XI", "5s")
									.replace("6th XI", "6s")
									.replace("7th XI", "7s")
									.replace("8th XI", "8s");
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: "assists",
										wordedText: "assists", 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - Assists for the ${teamDisplayName}`,
										type: "bar",
									},
								};
							} else if (hasDateFilter) {
								// Date Range only
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: "assists",
										wordedText: "assists", 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - Assists`,
										type: "bar",
									},
								};
							}
						}
						// Create NumberCard visualization for appearance queries (APP) with date filters
						if (metric && metric.toUpperCase() === "APP") {
							const timeFrames = analysis.extractionResult?.timeFrames || [];
							const hasDateFilter = timeFrames.some((tf) => tf.type === "since" || tf.type === "range");
							
							if (hasDateFilter || analysis.timeRange) {
								const iconName = this.getIconNameForMetric(metric);
								const displayName = "Appearances";
								const roundedValue = this.roundValueByMetric(metric, value as number);
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: displayName, 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - ${displayName}`,
										type: "bar",
									},
								};
							}
						}
						// General fallback: Create NumberCard for any single-value query with filters (team, location, or date range)
						// This handles stats like yellow cards, MoMs, etc. with filters (assists are handled above)
						if (!visualization && dataLength === 1) {
							const locations = analysis.extractionResult?.locations || [];
							const teamEntities = analysis.teamEntities || [];
							const timeFrames = analysis.extractionResult?.timeFrames || [];
							const hasLocationFilter = locations.length > 0;
							const hasTeamFilter = teamEntities.length > 0;
							const hasDateFilter = timeFrames.some((tf) => tf.type === "range" || tf.type === "since") || analysis.timeRange;
							
							// Create NumberCard if any filter is present
							if (hasLocationFilter || hasTeamFilter || hasDateFilter) {
								const iconName = this.getIconNameForMetric(metric);
								const statObjectKey = this.mapMetricToStatObjectKey(metric);
								const metricConfig = statObject[statObjectKey as keyof typeof statObject];
								
								// Use wordedText from statObject if available, otherwise use displayText, otherwise use getMetricDisplayName
								// This ensures we get the correct word (e.g., "assists" not "open play goals")
								const wordedText = metricConfig?.wordedText || metricConfig?.displayText?.toLowerCase() || getMetricDisplayName(metric, value as number).toLowerCase();
								const displayName = metricConfig?.displayText || getMetricDisplayName(metric, value as number);
								const roundedValue = this.roundValueByMetric(metric, value as number);
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: displayName,
										wordedText: wordedText,
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - ${displayName}`,
										type: "bar",
									},
								};
							}
						}
					} else {
						answer = "No data found for your query.";

						// Handle other data types
						const playerData = data.data as PlayerData[];
						const playerName = playerData[0]?.playerName || analysis.entities[0] || "Unknown";
						const value = playerData[0]?.value;
						const metric = (data.metric as string) || analysis.metrics[0] || "G";

						// Special handling for NumberTeamsPlayedFor - format as "X of the clubs Y teams"
						if (metric && (metric === "NUMBERTEAMSPLAYEDFOR" || metric === "NumberTeamsPlayedFor")) {
							const playerTeamCount = typeof value === "number" ? value : 0;
							const totalTeamCount = (playerData[0] as any)?.totalTeamCount || 9; // Default to 9 if not provided
							answer = `${playerName} has played for ${playerTeamCount} of the clubs ${totalTeamCount} teams.`;
							answerValue = `${playerTeamCount}/${totalTeamCount}`;
						} else if (value !== undefined && value !== null) {
							answerValue = value as number;
							answer = ResponseBuilder.buildContextualResponse(playerName, metric, value, analysis);
						} else {
							answer = "No data found for your query.";
						}
					}
				}
				} else {
			// Fallback for unknown data types
			// Don't check for clarification if we have streak data (it should have been handled above)
			if (data && data.type === "streak") {
				answer = "I couldn't process the streak data for your question.";
			} else {
				answer = "I couldn't find relevant information for your question.";
				
				// Check if clarification might help (e.g., player name mismatch)
				// This is done post-query to allow queries to attempt first
				const clarificationMessage = this.checkPostQueryClarificationNeeded(analysis, userContext);
				if (clarificationMessage) {
					answer = clarificationMessage;
					answerValue = "Clarification needed";
					
					// Set pending clarification if we have a session ID
					if (sessionId) {
						// Extract partial name from clarification message if it's a partial name clarification
						let partialName: string | undefined = undefined;
						if (clarificationMessage.includes("Please provide clarification on who") || clarificationMessage.includes("Please clarify which")) {
							const match = clarificationMessage.match(/(?:who|which) (\w+) (?:is|you are asking)/);
							if (match) {
								partialName = match[1];
							}
						}
						conversationContextManager.setPendingClarification(sessionId, question, clarificationMessage, analysis, partialName, userContext);
					}
				}
			}
		}

		// UNIVERSAL CLARIFICATION CHECK: Always request clarification when a failed answer is detected
		// This applies to ALL question types, not just specific ones
		// Exclude specific error types that have their own messages (player_not_found, team_not_found, database errors, etc.)
		const isFailedAnswer = isNoDataAnswer(answer);
		const shouldAskForClarification = isFailedAnswer &&
			data?.type !== "player_not_found" &&
			data?.type !== "team_not_found" &&
			data?.type !== "no_context" &&
			data?.type !== "error" &&
			!answer.includes("unable to access") &&
			!answer.includes("encountered an issue");

		if (shouldAskForClarification) {
			// Generate a contextual clarification message based on question type and extracted entities
			// Check what's missing from the question
			const playerEntities = analysis.extractionResult?.entities?.filter(ent => ent.type === "player") || [];
			const hasPlayerEntity = playerEntities.length > 0;
			const hasTeamEntity = analysis.teamEntities && analysis.teamEntities.length > 0;
			const hasMetric = analysis.metrics.length > 0;
			const hasOppositionEntity = analysis.oppositionEntities && analysis.oppositionEntities.length > 0;
			const hasSeasonEntity = analysis.extractionResult?.timeFrames?.some(tf => tf.type === "season") || false;
			const hasLocationEntity = (analysis.extractionResult?.locations && analysis.extractionResult.locations.length > 0) || false;
			const hasCompetitionEntity = (analysis.extractionResult?.competitions && analysis.extractionResult.competitions.length > 0) || false;

			// Determine question type from analysis
			const questionType = analysis.type || "";
			const questionLower = (analysis.question || "").toLowerCase();

			// Build specific clarification message based on what's missing
			let clarificationMessage = "";

			// If we have entities but still failed, provide specific guidance
			if (hasPlayerEntity && hasMetric) {
				clarificationMessage = "I couldn't find data for your question. Please check the player name spelling, or try rephrasing your question with more specific details.";
			} else if (hasTeamEntity && hasMetric) {
				clarificationMessage = "I couldn't find data for your question. Please check the team name (e.g., '1st XI', '2nd XI', '3rd XI') or try rephrasing your question.";
			} else if (hasOppositionEntity && hasMetric) {
				clarificationMessage = "I couldn't find data for your question. Please check the opposition name spelling or try rephrasing your question.";
			} else {
				// Build message based on what's missing
				const missingParts: string[] = [];

				// Check for missing entity types based on question context
				if (questionType === "player" || questionLower.includes("player") || questionLower.includes("i ") || questionLower.includes("i've") || questionLower.includes("my ")) {
					if (!hasPlayerEntity) {
						missingParts.push("Which player are you asking about? Please provide a player name.");
					}
				} else if (questionType === "team" || questionLower.includes("team") || questionLower.includes("xi") || questionLower.match(/\b(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th)\b/i)) {
					if (!hasTeamEntity) {
						missingParts.push("Which team are you asking about? (e.g., '1st XI', '2nd XI', '3rd XI', or '1s', '2s', '3s')");
					}
				} else if (questionLower.includes("against") || questionLower.includes("versus") || questionLower.includes("vs")) {
					if (!hasOppositionEntity) {
						missingParts.push("Which opposition team are you asking about?");
					}
				} else {
					// Generic entity check
					if (!hasPlayerEntity && !hasTeamEntity && !hasOppositionEntity) {
						missingParts.push("Please specify who or what you're asking about (e.g., a player name, team, or opposition).");
					}
				}

				// Check for missing metric
				if (!hasMetric) {
					missingParts.push("What statistic would you like to know? (e.g., goals, appearances, assists, wins, losses)");
				}

				// Check for missing season if question seems season-specific
				if ((questionLower.includes("season") || questionLower.match(/\d{4}[\-\/]\d{2,4}/)) && !hasSeasonEntity) {
					missingParts.push("Which season are you asking about? (e.g., '2020-2021' or '2020/21')");
				}

				// Check for missing location if question seems location-specific
				if ((questionLower.includes("home") || questionLower.includes("away") || questionLower.includes("location")) && !hasLocationEntity) {
					missingParts.push("Are you asking about home or away games?");
				}

				// Check for missing competition if question seems competition-specific
				if ((questionLower.includes("league") || questionLower.includes("cup") || questionLower.includes("competition")) && !hasCompetitionEntity) {
					missingParts.push("Which competition are you asking about? (e.g., League, Cup, Friendly)");
				}

				// Build final message
				if (missingParts.length > 0) {
					clarificationMessage = "I need more information to help you. " + missingParts.join(" ");
				} else {
					// Fallback generic message
					clarificationMessage = "I couldn't find data for your question. Please try rephrasing with more specific details. For example: 'How many goals has Luke Bangs scored?' or 'What are the 3rd XI stats?'";
				}
			}

			answer = clarificationMessage;
			answerValue = "Clarification needed";
			
			// Set pending clarification if we have a session ID
			if (sessionId) {
				// Extract partial name from clarification message if it's a partial name clarification
				let partialName: string | undefined = undefined;
				if (clarificationMessage.includes("Please provide clarification on who")) {
					const match = clarificationMessage.match(/who (\w+) is/);
					if (match) {
						partialName = match[1];
					}
				}
				conversationContextManager.setPendingClarification(sessionId, question, clarificationMessage, analysis, partialName, userContext);
			}
		} else {
			// Clear pending clarification if we successfully answered
			if (sessionId && !isFailedAnswer) {
				conversationContextManager.clearPendingClarification(sessionId);
			}
		}

		// Extract Cypher query: prefer data?.cypherQuery, fallback to lastExecutedQueries
		const cypherQuery = this.extractCypherQuery(data?.cypherQuery as string | undefined, question);

		// Add suggestions if answer indicates failure
		let suggestions: string[] | undefined = undefined;
		if (isNoDataAnswer(answer) || hasNoData) {
			suggestions = errorHandler.getSimilarQuestions(question);
		}

		return {
			answer,
			data: data?.data,
			visualization,
			sources,
			answerValue,
			cypherQuery,
			suggestions,
			debug: {
				question,
				timestamp: new Date().toISOString(),
				serverLogs: this.lastExecutedQueries.join("\n"),
				processingDetails: {
					questionAnalysis: analysis,
					cypherQueries: this.lastExecutedQueries,
					processingSteps: this.lastProcessingSteps,
					queryBreakdown: this.lastQueryBreakdown,
				},
			},
		};
	}

	/**
	 * Extract Cypher query from data or lastExecutedQueries array
	 * Priority: data?.cypherQuery > READY_TO_EXECUTE pattern > other query type patterns > generic Cypher patterns
	 */
	private extractCypherQuery(dataCypherQuery?: string, question?: string): string | undefined {
		// Priority 1: Use cypherQuery from data if available
		if (dataCypherQuery && dataCypherQuery !== "N/A" && dataCypherQuery.trim() !== "") {
			return dataCypherQuery;
		}

		// Priority 2: Search lastExecutedQueries for READY_TO_EXECUTE pattern (most reliable)
		// Look for entries like "READY_TO_EXECUTE: <query>" or "*_READY_TO_EXECUTE: <query>"
		for (let i = this.lastExecutedQueries.length - 1; i >= 0; i--) {
			const entry = this.lastExecutedQueries[i];
			if (entry && typeof entry === "string" && entry.includes("READY_TO_EXECUTE:")) {
				const match = entry.match(/READY_TO_EXECUTE:\s*(.+)/s);
				if (match && match[1]) {
					const query = match[1].trim();
					// Verify it looks like a Cypher query
					if (query.includes("MATCH") || query.includes("RETURN")) {
						return query;
					}
				}
			}
		}

		// Priority 3: Look for specific query type patterns (FIXTURE_QUERY, STREAK_DATA, TEAM_DATA, etc.)
		// These patterns are more reliable than generic patterns
		const queryTypePatterns = [
			/FIXTURE_QUERY:\s*(.+)/s,
			/STREAK_DATA:\s*(.+)/s,
			/TEAM_DATA:\s*(.+)/s,
			/RANKING_DATA:\s*(.+)/s,
			/TEMPORAL_DATA:\s*(.+)/s,
			/COMPARISON_DATA:\s*(.+)/s,
			/CLUB_GOALS_DATA:\s*(.+)/s,
			/CLUB_PLAYERS_DATA:\s*(.+)/s,
			/MILESTONE_QUERY:\s*(.+)/s,
			/DOUBLE_GAME_WEEKS:\s*(.+)/s,
			/TOTW_DATA:\s*(.+)/s,
			/HOME_AWAY_COMPARISON:\s*(.+)/s,
			/MOST_PROLIFIC_SEASON:\s*(.+)/s,
			/CO_PLAYERS_QUERY:\s*(.+)/s,
			/CO_PLAYERS_READY_TO_EXECUTE:\s*(.+)/s,
			/GAMES_PLAYED_TOGETHER_QUERY:\s*(.+)/s,
			/GAMES_PLAYED_TOGETHER_READY_TO_EXECUTE:\s*(.+)/s,
			/LEAGUE_TABLE_QUERY:\s*(.+)/s,
			/LEAGUE_TABLE_READY_TO_EXECUTE:\s*(.+)/s,
			/CONSECUTIVE_WEEKENDS_PLAYER_PLAYED:\s*(.+)/s,
			/CONSECUTIVE_WEEKENDS_READY_TO_EXECUTE:\s*(.+)/s,
			/FIXTURE_READY_TO_EXECUTE:\s*(.+)/s,
			/CLEAN_SHEETS_STREAK_QUERY:\s*(.+)/s,
			/CLEAN_SHEETS_STREAK_READY_TO_EXECUTE:\s*(.+)/s,
			/AWARDS_COUNT_QUERY:\s*(.+)/s,
			/AWARDS_COUNT_READY_TO_EXECUTE:\s*(.+)/s,
			/TOTW_COUNT_QUERY:\s*(.+)/s,
			/TOTW_COUNT_READY_TO_EXECUTE:\s*(.+)/s,
			/HIGHEST_WEEKLY_SCORE_QUERY:\s*(.+)/s,
			/HIGHEST_WEEKLY_SCORE_READY_TO_EXECUTE:\s*(.+)/s,
			/LEAGUE_WINS_COUNT_QUERY:\s*(.+)/s,
			/LEAGUE_WINS_COUNT_READY_TO_EXECUTE:\s*(.+)/s,
			/TEAM_DATA_QUERY:\s*(.+)/s,
			/TEAM_DATA_READY_TO_EXECUTE:\s*(.+)/s,
			/CLUB_TEAM_CONCEDED_QUERY:\s*(.+)/s,
			/CLUB_TEAM_CONCEDED_READY_TO_EXECUTE:\s*(.+)/s,
			/HIGHEST_SCORING_GAME_QUERY:\s*(.+)/s,
			/HIGHEST_SCORING_GAME_READY_TO_EXECUTE:\s*(.+)/s,
			/BIGGEST_WIN_QUERY:\s*(.+)/s,
			/BIGGEST_WIN_READY_TO_EXECUTE:\s*(.+)/s,
			/GAMES_WHERE_SCORED_QUERY:\s*(.+)/s,
			/GAMES_WHERE_SCORED_READY_TO_EXECUTE:\s*(.+)/s,
			/CONSECUTIVE_GOAL_INVOLVEMENT_QUERY:\s*(.+)/s,
			/CONSECUTIVE_GOAL_INVOLVEMENT_READY_TO_EXECUTE:\s*(.+)/s,
			/PENALTIES_TAKEN_QUERY:\s*(.+)/s,
			/PENALTIES_TAKEN_READY_TO_EXECUTE:\s*(.+)/s,
			/MOST_PLAYED_AGAINST_QUERY:\s*(.+)/s,
			/MOST_PLAYED_AGAINST_READY_TO_EXECUTE:\s*(.+)/s,
			/PLAYERS_OF_THE_MONTH_QUERY:\s*(.+)/s,
			/PLAYERS_OF_THE_MONTH_READY_TO_EXECUTE:\s*(.+)/s,
			/PLAYER_HATTRICKS_QUERY:\s*(.+)/s,
			/PLAYER_HATTRICKS_READY_TO_EXECUTE:\s*(.+)/s,
			/TOTW_BY_DATE_QUERY:\s*(.+)/s,
			/TOTW_BY_DATE_READY_TO_EXECUTE:\s*(.+)/s,
			/OPPOSITION_STATS_QUERY:\s*(.+)/s,
			/OPPOSITION_STATS_READY_TO_EXECUTE:\s*(.+)/s,
			/OPPOSITION_GOALS_QUERY:\s*(.+)/s,
			/OPPOSITION_GOALS_READY_TO_EXECUTE:\s*(.+)/s,
			/MOST_PLAYED_WITH_QUERY:\s*(.+)/s,
			/MOST_PLAYED_WITH_READY_TO_EXECUTE:\s*(.+)/s,
			/GAMES_PLAYED_TOGETHER_QUERY:\s*(.+)/s,
			/HATTRICKS_QUERY:\s*(.+)/s,
			/HATTRICKS_READY_TO_EXECUTE:\s*(.+)/s,
			/GOAL_SCORING_STREAK_QUERY:\s*(.+)/s,
			/GOAL_SCORING_STREAK_READY_TO_EXECUTE:\s*(.+)/s,
			/ASSISTING_RUN_QUERY:\s*(.+)/s,
			/ASSISTING_RUN_READY_TO_EXECUTE:\s*(.+)/s,
			/NO_GOAL_INVOLVEMENT_STREAK_QUERY:\s*(.+)/s,
			/NO_GOAL_INVOLVEMENT_STREAK_READY_TO_EXECUTE:\s*(.+)/s,
			/HIGHEST_PLAYER_GOALS_IN_GAME_QUERY:\s*(.+)/s,
			/HIGHEST_PLAYER_GOALS_IN_GAME_READY_TO_EXECUTE:\s*(.+)/s,
			/UNBEATEN_RUN_QUERY:\s*(.+)/s,
			/UNBEATEN_RUN_READY_TO_EXECUTE:\s*(.+)/s,
			/OPPONENTS_QUERY:\s*(.+)/s,
			/OPPONENTS_READY_TO_EXECUTE:\s*(.+)/s,
			/MOST_DIFFERENT_TEAMMATES_QUERY:\s*(.+)/s,
			/MOST_DIFFERENT_TEAMMATES_READY_TO_EXECUTE:\s*(.+)/s,
			/RELATIONSHIP_MOST_PLAYED_WITH_QUERY:\s*(.+)/s,
			/RELATIONSHIP_MOST_PLAYED_WITH_READY_TO_EXECUTE:\s*(.+)/s,
			/GOALS_SCORED_TOGETHER_QUERY:\s*(.+)/s,
			/GOALS_SCORED_TOGETHER_READY_TO_EXECUTE:\s*(.+)/s,
			/TEAMMATES_COUNT_QUERY:\s*(.+)/s,
			/TEAMMATES_COUNT_READY_TO_EXECUTE:\s*(.+)/s,
			/TEAM_SEASON_MOST_CONCEDED_QUERY:\s*(.+)/s,
			/TEAM_SEASON_MOST_CONCEDED_READY_TO_EXECUTE:\s*(.+)/s,
			/PLAYER_HIGHEST_LEAGUE_FINISH_QUERY:\s*(.+)/s,
			/PLAYER_HIGHEST_LEAGUE_FINISH_READY_TO_EXECUTE:\s*(.+)/s,
			/CURRENT_SEASON_QUERY:\s*(.+)/s,
			/CURRENT_SEASON_READY_TO_EXECUTE:\s*(.+)/s,
			/RANKING_QUERY:\s*(.+)/s,
			/RANKING_READY_TO_EXECUTE:\s*(.+)/s,
		];

		for (let i = this.lastExecutedQueries.length - 1; i >= 0; i--) {
			const entry = this.lastExecutedQueries[i];
			if (entry && typeof entry === "string") {
				for (const pattern of queryTypePatterns) {
					const match = entry.match(pattern);
					if (match && match[1]) {
						const query = match[1].trim();
						// Verify it looks like a Cypher query
						if (query.includes("MATCH") || query.includes("RETURN")) {
							return query;
						}
					}
				}
			}
		}

		// Priority 4: Look for entries that contain Cypher query keywords (MATCH, RETURN, etc.)
		// These are typically stored as "TYPE: <query>" or just "<query>"
		const cypherKeywords = ["MATCH", "RETURN", "WITH", "WHERE"];
		for (let i = this.lastExecutedQueries.length - 1; i >= 0; i--) {
			const entry = this.lastExecutedQueries[i];
			if (entry && typeof entry === "string") {
				// Skip parameter entries (contain JSON patterns, but allow queries with $params)
				if (entry.includes("PARAMS:") || (entry.startsWith("{") && entry.includes("}") && !entry.includes("MATCH"))) {
					continue;
				}
				// Check if entry looks like a Cypher query
				const hasCypherKeywords = cypherKeywords.some(keyword => entry.includes(keyword));
				if (hasCypherKeywords) {
					// Extract query from patterns like "TYPE: <query>"
					const colonIndex = entry.indexOf(":");
					if (colonIndex > 0 && colonIndex < entry.length - 1) {
						// Check if it's a type prefix (like "TOTW_DATA:", "TEAM_DATA:", etc.)
						const prefix = entry.substring(0, colonIndex).trim();
						// If prefix is all caps or contains underscore, it's likely a type prefix
						if ((prefix === prefix.toUpperCase() || prefix.includes("_")) && prefix.length > 0) {
							const query = entry.substring(colonIndex + 1).trim();
							// Verify it looks like a Cypher query
							if (query.includes("MATCH") || query.includes("RETURN")) {
								return query;
							}
						}
					}
					// If no colon pattern or colon pattern didn't match, check if entry itself is a query
					// (queries might be stored directly without prefix)
					if (entry.includes("MATCH") && entry.includes("RETURN")) {
						return entry.trim();
					}
				}
			}
		}

		// No query found
		return undefined;
	}

	// Enhanced query methods for new relationship properties
	private async queryPlayerTOTWData(playerName: string, period: "weekly" | "season"): Promise<Record<string, unknown>> {
		console.log(`🔍 Querying for TOTW awards for player: ${playerName}, period: ${period}`);
		const relationshipType = period === "weekly" ? "IN_WEEKLY_TOTW" : "IN_SEASON_TOTW";

		const query = `
			MATCH (p:Player {playerName: $playerName})-[r:${relationshipType}]->(totw)
			RETURN p.playerName as playerName, 
			       totw.week as week, 
			       totw.season as season,
			       totw.date as date
			ORDER BY totw.date DESC
		`;

		// Store query for debugging
		this.lastExecutedQueries.push(`TOTW_DATA: ${query}`);
		this.lastExecutedQueries.push(`TOTW_PARAMS: ${JSON.stringify({ playerName, period })}`);

		// Log copyable queries for debugging
		const readyToExecuteQuery = query.replace(/\$playerName/g, `'${playerName}'`);
		this.lastExecutedQueries.push(`TOTW_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		this.logToBoth(`🔍 TOTW CYPHER QUERY (with parameters):`, query, "log");
		this.logToBoth(`🔍 TOTW CYPHER QUERY (ready to execute):`, readyToExecuteQuery, "log");

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "totw_awards", data: result, playerName, period };
		} catch (error) {
			this.logToBoth(`❌ Error in TOTW query:`, error, "error");
			return { type: "error", data: [], error: "Error querying TOTW data" };
		}
	}

	private async queryPlayersOfTheMonthData(playerName: string): Promise<Record<string, unknown>> {
		console.log(`🔍 Querying for Player of the Month awards for player: ${playerName}`);
		const query = `
			MATCH (p:Player {playerName: $playerName})-[r:PLAYER_OF_THE_MONTH]->(potm)
			RETURN p.playerName as playerName, 
			       potm.month as month, 
			       potm.year as year,
			       potm.season as season
			ORDER BY potm.year DESC, potm.month DESC
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "potm_awards", data: result, playerName };
		} catch (error) {
			this.logToBoth(`❌ Error in POTM query:`, error, "error");
			return { type: "error", data: [], error: "Error querying POTM data" };
		}
	}

	private async queryPlayerCaptainAwardsData(playerName: string): Promise<Record<string, unknown>> {
		console.log(`🔍 Querying for Captain awards for player: ${playerName}`);
		const query = `
			MATCH (p:Player {playerName: $playerName})-[r:CAPTAIN]->(cap)
			RETURN p.playerName as playerName, 
			       cap.date as date,
			       cap.season as season
			ORDER BY cap.date DESC
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "captain_awards", data: result, playerName };
		} catch (error) {
			this.logToBoth(`❌ Error in Captain query:`, error, "error");
			return { type: "error", data: [], error: "Error querying Captain data" };
		}
	}

	private async queryPlayerCoPlayersData(playerName: string): Promise<Record<string, unknown>> {
		console.log(`🔍 Querying for co-players for player: ${playerName}`);
		const query = `
			MATCH (p1:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)<-[:PLAYED_IN]-(p2:Player)
			WHERE p1 <> p2
			RETURN p2.playerName as coPlayerName, count(md) as gamesPlayedTogether
			ORDER BY gamesPlayedTogether DESC
			LIMIT 20
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "co_players", data: result, playerName };
		} catch (error) {
			this.logToBoth(`❌ Error in co-players query:`, error, "error");
			return { type: "error", data: [], error: "Error querying co-players data" };
		}
	}

	private async queryMostPlayedWith(
		playerName: string, 
		teamName?: string, 
		season?: string | null, 
		startDate?: string | null, 
		endDate?: string | null
	): Promise<Record<string, unknown>> {
		const timeContext = [
			teamName ? `team: ${teamName}` : null,
			season ? `season: ${season}` : null,
			startDate && endDate ? `dates: ${startDate} to ${endDate}` : null
		].filter(Boolean).join(", ");
		
		this.logToBoth(`🔍 Querying most played with for player: ${playerName}${timeContext ? ` (${timeContext})` : ""}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		// Find players who played together by matching MatchDetail nodes that share the same Fixture
		// Each MatchDetail represents one player's performance in one match
		// Multiple MatchDetails can belong to the same Fixture (same game, different players)
		// If teamName is provided, filter to only games where both players played for that team
		// If season is provided, filter to only games in that season
		// If startDate/endDate are provided, filter to only games within that date range
		const whereConditions: string[] = ["other.playerName <> p.playerName"];
		
		if (teamName) {
			whereConditions.push("md1.team = $teamName", "md2.team = $teamName");
		}
		
		if (season) {
			whereConditions.push("f.season = $season", "md1.season = $season", "md2.season = $season");
		}
		
		if (startDate && endDate) {
			whereConditions.push("f.date >= $startDate", "f.date <= $endDate");
		}
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md1:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md1)
			MATCH (f)-[:HAS_MATCH_DETAILS]->(md2:MatchDetail {graphLabel: $graphLabel})
			MATCH (other:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(md2)
			WHERE ${whereConditions.join(" AND ")}
			WITH other.playerName as teammateName, count(DISTINCT f) as gamesTogether
			ORDER BY gamesTogether DESC
			LIMIT 10
			RETURN teammateName, gamesTogether
		`;

		// Log copyable query for debugging
		const queryParams: Record<string, string> = { 
			playerName,
			graphLabel 
		};
		if (teamName) {
			queryParams.teamName = teamName;
		}
		if (season) {
			queryParams.season = season;
		}
		if (startDate && endDate) {
			queryParams.startDate = startDate;
			queryParams.endDate = endDate;
		}
		
		const readyToExecuteQuery = query
			.replace(/\$playerName/g, `'${playerName}'`)
			.replace(/\$graphLabel/g, `'${graphLabel}'`)
			.replace(/\$teamName/g, teamName ? `'${teamName}'` : "")
			.replace(/\$season/g, season ? `'${season}'` : "")
			.replace(/\$startDate/g, startDate ? `'${startDate}'` : "")
			.replace(/\$endDate/g, endDate ? `'${endDate}'` : "");
		
		console.log(`🔍 [MOST_PLAYED_WITH] COPY-PASTE QUERY FOR MANUAL TESTING:`);
		console.log(readyToExecuteQuery);
		this.lastExecutedQueries.push(`MOST_PLAYED_WITH_QUERY: ${query}`);
		this.lastExecutedQueries.push(`MOST_PLAYED_WITH_READY_TO_EXECUTE: ${readyToExecuteQuery}`);

		try {
			const result = await neo4jService.executeQuery(query, queryParams);
			return { type: "most_played_with", data: result, playerName, teamName, season, startDate, endDate };
		} catch (error) {
			this.logToBoth(`❌ Error in most played with query:`, error, "error");
			return { type: "error", data: [], error: "Error querying most played with data" };
		}
	}

	private async queryGamesPlayedTogether(
		playerName1: string,
		playerName2: string,
		teamName?: string,
		season?: string | null,
		startDate?: string | null,
		endDate?: string | null
	): Promise<Record<string, unknown>> {
		const timeContext = [
			teamName ? `team: ${teamName}` : null,
			season ? `season: ${season}` : null,
			startDate && endDate ? `dates: ${startDate} to ${endDate}` : null
		].filter(Boolean).join(", ");
		
		this.logToBoth(`🔍 Querying games played together for players: ${playerName1} and ${playerName2}${timeContext ? ` (${timeContext})` : ""}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		// Find fixtures where both players have MatchDetail nodes
		// Match both players, find their MatchDetail nodes, and find Fixtures that contain MatchDetails for both players
		const whereConditions: string[] = [
			"p1.playerName = $playerName1",
			"p2.playerName = $playerName2",
			"p1 <> p2"
		];
		
		if (teamName) {
			whereConditions.push("md1.team = $teamName", "md2.team = $teamName");
		}
		
		if (season) {
			whereConditions.push("f.season = $season");
		}
		
		if (startDate && endDate) {
			whereConditions.push("f.date >= $startDate", "f.date <= $endDate");
		}
		
		const query = `
			MATCH (p1:Player {graphLabel: $graphLabel, playerName: $playerName1})-[:PLAYED_IN]->(md1:MatchDetail {graphLabel: $graphLabel})
			MATCH (p2:Player {graphLabel: $graphLabel, playerName: $playerName2})-[:PLAYED_IN]->(md2:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md1)
			MATCH (f)-[:HAS_MATCH_DETAILS]->(md2)
			WHERE ${whereConditions.join(" AND ")}
			RETURN count(DISTINCT f) as gamesTogether
		`;

		// Log copyable query for debugging
		const queryParams: Record<string, string> = {
			playerName1,
			playerName2,
			graphLabel
		};
		if (teamName) {
			queryParams.teamName = teamName;
		}
		if (season) {
			queryParams.season = season;
		}
		if (startDate && endDate) {
			queryParams.startDate = startDate;
			queryParams.endDate = endDate;
		}
		
		const readyToExecuteQuery = query
			.replace(/\$playerName1/g, `'${playerName1}'`)
			.replace(/\$playerName2/g, `'${playerName2}'`)
			.replace(/\$graphLabel/g, `'${graphLabel}'`)
			.replace(/\$teamName/g, teamName ? `'${teamName}'` : "")
			.replace(/\$season/g, season ? `'${season}'` : "")
			.replace(/\$startDate/g, startDate ? `'${startDate}'` : "")
			.replace(/\$endDate/g, endDate ? `'${endDate}'` : "");
		
		console.log(`🔍 [GAMES_PLAYED_TOGETHER] COPY-PASTE QUERY FOR MANUAL TESTING:`);
		console.log(readyToExecuteQuery);
		this.lastExecutedQueries.push(`GAMES_PLAYED_TOGETHER_READY_TO_EXECUTE: ${readyToExecuteQuery}`);

		try {
			const result = await neo4jService.executeQuery(query, queryParams);
			console.log(`🔍 [GAMES_PLAYED_TOGETHER] Query result:`, result);
			console.log(`🔍 [GAMES_PLAYED_TOGETHER] Result type:`, typeof result, `Is array:`, Array.isArray(result));
			
			// Extract the count from the result
			let gamesTogether = 0;
			if (result && Array.isArray(result) && result.length > 0) {
				const record = result[0];
				console.log(`🔍 [GAMES_PLAYED_TOGETHER] First record:`, record);
				if (record && typeof record === "object" && "gamesTogether" in record) {
					let count = record.gamesTogether;
					console.log(`🔍 [GAMES_PLAYED_TOGETHER] Count value:`, count, `Type:`, typeof count);
					
					// Handle Neo4j Integer objects
					if (count !== null && count !== undefined) {
						if (typeof count === "number") {
							gamesTogether = count;
						} else if (typeof count === "object") {
							if ("toNumber" in count && typeof count.toNumber === "function") {
								gamesTogether = (count as { toNumber: () => number }).toNumber();
							} else if ("low" in count && "high" in count) {
								const neo4jInt = count as { low?: number; high?: number };
								gamesTogether = (neo4jInt.low || 0) + (neo4jInt.high || 0) * 4294967296;
							} else {
								gamesTogether = Number(count) || 0;
							}
						} else {
							gamesTogether = Number(count) || 0;
						}
					}
				} else {
					console.log(`🔍 [GAMES_PLAYED_TOGETHER] Record structure issue:`, record);
				}
			} else {
				console.log(`🔍 [GAMES_PLAYED_TOGETHER] Result structure issue:`, result);
			}
			
			console.log(`🔍 [GAMES_PLAYED_TOGETHER] Final gamesTogether value:`, gamesTogether);
			
			return {
				type: "games_played_together",
				data: gamesTogether,
				playerName1,
				playerName2,
				teamName,
				season,
				startDate,
				endDate
			};
		} catch (error) {
			this.logToBoth(`❌ Error in games played together query:`, error, "error");
			return { type: "error", data: [], error: "Error querying games played together data" };
		}
	}

	private async queryPlayerOpponentsData(playerName: string): Promise<Record<string, unknown>> {
		console.log(`🔍 Querying for opponents for player: ${playerName}`);
		const graphLabel = neo4jService.getGraphLabel();
		const query = `
			MATCH (p:Player {playerName: $playerName, graphLabel: $graphLabel})-[r:PLAYED_AGAINST_OPPONENT]->(od:OppositionDetails {graphLabel: $graphLabel})
			WHERE r.timesPlayed > 0
			WITH od.opposition as opponent, 
			     r.timesPlayed as gamesPlayed,
			     r.goalsScored as goalsScored,
			     r.assists as assists,
			     r.lastPlayed as lastPlayed
			ORDER BY r.timesPlayed DESC, r.goalsScored DESC, r.assists DESC
			WITH collect({opponent: opponent, gamesPlayed: gamesPlayed, goalsScored: goalsScored, assists: assists, lastPlayed: lastPlayed}) as opponents
			RETURN opponents, size(opponents) as totalOpponents
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			return { type: "opponents", data: result, playerName };
		} catch (error) {
			this.logToBoth(`❌ Error in opponents query:`, error, "error");
			return { type: "error", data: [], error: "Error querying opponents data" };
		}
	}

	// Enhanced query methods for streaks and temporal analysis
	private async queryStreakData(entities: string[], metrics: string[]): Promise<Record<string, unknown>> {
		console.log(`🔍 Querying streak data for entities: ${entities}, metrics: ${metrics}`);

		if (entities.length === 0) {
			return { type: "no_context", data: [], message: "No player context provided" };
		}

		const playerName = entities[0];
		const metric = metrics[0] || "goals";

		// Determine streak type based on metric
		let streakType = "goals";
		let streakField = "goals";
		let streakCondition = "md.goals > 0";

		switch (metric.toLowerCase()) {
			case "assists":
			case "a":
				streakType = "assists";
				streakField = "assists";
				streakCondition = "md.assists > 0";
				break;
			case "clean_sheets":
			case "cls":
				streakType = "clean_sheets";
				streakField = "cleanSheets";
				streakCondition = "md.cleanSheets > 0";
				break;
			case "appearances":
			case "app":
				streakType = "appearances";
				streakField = "appearances";
				streakCondition = "md.minutes > 0";
				break;
			default:
				streakType = "goals";
				streakField = "goals";
				streakCondition = "md.goals > 0";
		}

		const query = `
			MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
			WHERE ${streakCondition}
			RETURN md.date as date, md.${streakField} as ${streakField}, md.team as team, md.opposition as opposition
			ORDER BY md.date DESC
		`;

		this.lastExecutedQueries.push(`STREAK_DATA: ${query}`);
		this.lastExecutedQueries.push(`STREAK_PARAMS: ${JSON.stringify({ playerName, metric, streakType })}`);

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "streak", data: result, playerName, streakType };
		} catch (error) {
			this.logToBoth(`❌ Error in streak query:`, error, "error");
			return { type: "error", data: [], error: "Error querying streak data" };
		}
	}

	private async queryComparisonData(entities: string[], metrics: string[]): Promise<Record<string, unknown>> {
		console.log(`🔍 Querying comparison data for entities: ${entities}, metrics: ${metrics}`);

		if (metrics.length === 0) {
			return { type: "no_context", data: [], message: "No metric specified for comparison" };
		}

		const metric = metrics[0];
		let returnClause = "coalesce(sum(md.goals), 0) as value";

		// Map metric to database field
		switch (metric.toLowerCase()) {
			case "appearances":
			case "app":
				returnClause = "count(md) as value";
				break;
			case "goals":
			case "g":
				returnClause = "coalesce(sum(md.goals), 0) as value";
				break;
			case "assists":
			case "a":
				returnClause = "coalesce(sum(md.assists), 0) as value";
				break;
			case "fantasy_points":
			case "ftp":
				returnClause = "coalesce(p.fantasyPoints, 0) as value";
				break;
			case "clean_sheets":
			case "cls":
				returnClause = "coalesce(p.cleanSheets, 0) as value";
				break;
			case "penalties_scored":
			case "psc":
				returnClause = "coalesce(p.penaltiesScored, 0) as value";
				break;
			default:
				returnClause = "coalesce(sum(md.goals), 0) as value";
		}

		// Determine if we need MatchDetail join based on metric
		const needsMatchDetail = !["penalties_scored", "psc", "fantasy_points", "ftp", "clean_sheets", "cls"].includes(metric.toLowerCase());

		const query = needsMatchDetail
			? `
			MATCH (p:Player)-[:PLAYED_IN]->(md:MatchDetail)
			WHERE p.allowOnSite = true
			RETURN p.playerName as playerName, ${returnClause}
			ORDER BY value DESC
			LIMIT 20
		`
			: `
			MATCH (p:Player)
			WHERE p.allowOnSite = true
			RETURN p.playerName as playerName, ${returnClause}
			ORDER BY value DESC
			LIMIT 20
		`;

		this.lastExecutedQueries.push(`COMPARISON_DATA: ${query}`);
		this.lastExecutedQueries.push(`COMPARISON_PARAMS: ${JSON.stringify({ metric })}`);

		try {
			const result = await neo4jService.executeQuery(query, {});
			return { type: "comparison", data: result, metric };
		} catch (error) {
			this.logToBoth(`❌ Error in comparison query:`, error, "error");
			return { type: "error", data: [], error: "Error querying comparison data" };
		}
	}

	private async queryTemporalData(entities: string[], metrics: string[], timeRange?: string): Promise<Record<string, unknown>> {
		console.log(`🔍 Querying temporal data for entities: ${entities}, metrics: ${metrics}, timeRange: ${timeRange}`);

		if (entities.length === 0) {
			return { type: "no_context", data: [], message: "No player context provided" };
		}

		const playerName = entities[0];
		const metric = metrics[0] || "goals";

		// Parse time range
		let dateFilter = "";
		let params: Record<string, string> = { playerName };

		if (timeRange) {
			// Handle various time range formats
			if (timeRange.includes("since")) {
				const year = timeRange.match(/\d{4}/)?.[0];
				if (year) {
					dateFilter = "AND md.date >= $startDate";
					params.startDate = `${year}-01-01`;
				}
			} else if (timeRange.includes("between")) {
				// Handle "between X and Y" format
				const years = timeRange.match(/\d{4}/g);
				if (years && years.length === 2) {
					dateFilter = "AND md.date >= $startDate AND md.date <= $endDate";
					params.startDate = `${years[0]}-01-01`;
					params.endDate = `${years[1]}-12-31`;
				}
			} else if (timeRange.includes("before")) {
				const year = timeRange.match(/\d{4}/)?.[0];
				if (year) {
					dateFilter = "AND md.date < $endDate";
					params.endDate = `${year}-01-01`;
				}
			}
		}

		let returnClause = "coalesce(sum(md.goals), 0) as value";

		switch (metric.toLowerCase()) {
			case "appearances":
			case "app":
				returnClause = "count(md) as value";
				break;
			case "goals":
			case "g":
				returnClause = "coalesce(sum(md.goals), 0) as value";
				break;
			case "assists":
			case "a":
				returnClause = "coalesce(sum(md.assists), 0) as value";
				break;
			default:
				returnClause = "coalesce(sum(md.goals), 0) as value";
		}

		const query = `
			MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
			WHERE 1=1 ${dateFilter}
			RETURN p.playerName as playerName, ${returnClause}
		`;

		this.lastExecutedQueries.push(`TEMPORAL_DATA: ${query}`);
		this.lastExecutedQueries.push(`TEMPORAL_PARAMS: ${JSON.stringify(params)}`);

		try {
			const result = await neo4jService.executeQuery(query, params);
			return { type: "temporal", data: result, playerName, metric, timeRange };
		} catch (error) {
			this.logToBoth(`❌ Error in temporal query:`, error, "error");
			return { type: "error", data: [], error: "Error querying temporal data" };
		}
	}

	private async queryTeamSpecificPlayerData(teamName: string, metric: string): Promise<Record<string, unknown>> {
		console.log(`🔍 Querying team-specific data for team: ${teamName}, metric: ${metric}`);

		// Normalize team name
		const normalizedTeam = teamName.replace(/(\d+)(st|nd|rd|th)?/, "$1s");

		let returnClause = "coalesce(sum(md.goals), 0) as value";

		switch (metric.toLowerCase()) {
			case "appearances":
			case "app":
				returnClause = "count(md) as value";
				break;
			case "goals":
			case "g":
				returnClause = "coalesce(sum(md.goals), 0) as value";
				break;
			case "assists":
			case "a":
				returnClause = "coalesce(sum(md.assists), 0) as value";
				break;
			case "fantasy_points":
			case "ftp":
				returnClause = "coalesce(sum(md.fantasyPoints), 0) as value";
				break;
			default:
				returnClause = "coalesce(sum(md.goals), 0) as value";
		}

		const query = `
			MATCH (p:Player)-[:PLAYED_IN]->(md:MatchDetail)
			WHERE p.allowOnSite = true AND md.team = $teamName
			RETURN p.playerName as playerName, ${returnClause}
			ORDER BY value DESC
			LIMIT 20
		`;

		this.lastExecutedQueries.push(`TEAM_SPECIFIC_DATA: ${query}`);
		this.lastExecutedQueries.push(`TEAM_SPECIFIC_PARAMS: ${JSON.stringify({ teamName: normalizedTeam, metric })}`);

		try {
			const result = await neo4jService.executeQuery(query, { teamName: normalizedTeam });
			return { type: "team_specific", data: result, teamName: normalizedTeam, metric };
		} catch (error) {
			this.logToBoth(`❌ Error in team-specific query:`, error, "error");
			return { type: "error", data: [], error: "Error querying team-specific data" };
		}
	}


	// Query ranking data for "which" questions (top players/teams)
	private async queryRankingData(
		entities: string[],
		metrics: string[],
		analysis: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		this.logToBoth(`🔍 queryRankingData called with entities: ${entities}, metrics: ${metrics}`, null, "log");

		if (metrics.length === 0) {
			return { type: "no_metrics", data: [], message: "No metrics specified for ranking" };
		}

		const metric = metrics[0];
		const lowerQuestion = analysis.question?.toLowerCase() || "";

		// Determine if this is asking about players or teams
		const isPlayerQuestion = lowerQuestion.includes("player") || lowerQuestion.includes("who");
		const isTeamQuestion = lowerQuestion.includes("team");

		// Determine result quantity (singular vs plural)
		const resultQuantity = analysis.resultQuantity || "plural";
		
		// Check if user asked for a specific number (e.g., "top 3", "top 5")
		const topNumberMatch = lowerQuestion.match(/top\s+(\d+)/);
		const requestedLimit = resultQuantity === "singular" ? 1 : (topNumberMatch ? parseInt(topNumberMatch[1]) : 10);

		// Get the metric configuration
		const metricConfig = findMetricByAlias(metric);
		if (!metricConfig) {
			return { type: "unknown_metric", data: [], message: `Unknown metric: ${metric}` };
		}

		let query: string;
		let returnClause: string;

		// Build the appropriate query based on metric
		switch (metric) {
			case "G":
			case "goals":
				returnClause = "coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = '' THEN 0 ELSE md.goals END), 0) as value";
				break;
			case "A":
			case "assists":
				returnClause = "coalesce(sum(CASE WHEN md.assists IS NULL OR md.assists = '' THEN 0 ELSE md.assists END), 0) as value";
				break;
			case "AP":
			case "appearances":
				returnClause = "count(md) as value";
				break;
			case "CS":
			case "clean_sheets":
				returnClause = "coalesce(sum(CASE WHEN md.cleanSheets = true THEN 1 ELSE 0 END), 0) as value";
				break;
			case "TOTW":
			case "team_of_the_week":
				returnClause = "coalesce(sum(CASE WHEN md.totw = true THEN 1 ELSE 0 END), 0) as value";
				break;
			default:
				return { type: "unsupported_metric", data: [], message: `Ranking not supported for metric: ${metric}` };
		}

		// Use a higher limit to ensure we get all available results, then trim to requested count
		const maxLimit = Math.max(requestedLimit * 2, 50); // Ensure we get enough results

		if (isPlayerQuestion) {
			// Query for top players
			query = `
				MATCH (p:Player)-[:PLAYED_IN]->(md:MatchDetail)
				WHERE p.allowOnSite = true
				RETURN p.playerName as playerName, ${returnClause}
				ORDER BY value DESC
				LIMIT ${maxLimit}
			`;
		} else if (isTeamQuestion) {
			// Query for top teams
			query = `
				MATCH (p:Player)-[:PLAYED_IN]->(md:MatchDetail)
				WHERE p.allowOnSite = true AND md.team IS NOT NULL
				RETURN md.team as teamName, ${returnClause}
				ORDER BY value DESC
				LIMIT ${maxLimit}
			`;
		} else {
			// Default to players if unclear
			query = `
				MATCH (p:Player)-[:PLAYED_IN]->(md:MatchDetail)
				WHERE p.allowOnSite = true
				RETURN p.playerName as playerName, ${returnClause}
				ORDER BY value DESC
				LIMIT ${maxLimit}
			`;
		}

		this.lastExecutedQueries.push(`RANKING_DATA: ${query}`);

		try {
			const result = await neo4jService.executeQuery(query);
			this.logToBoth(`🔍 Ranking query result:`, result, "log");

			if (!result || result.length === 0) {
				return { type: "no_data", data: [], message: "No ranking data found" };
			}

			// Limit results to the requested number (or all available if fewer)
			const limitedResult = result.slice(0, requestedLimit);

			return {
				type: "ranking",
				data: limitedResult,
				metric: metric,
				isPlayerQuestion: isPlayerQuestion,
				isTeamQuestion: isTeamQuestion,
				requestedLimit: requestedLimit,
				cypherQuery: query,
			};
		} catch (error) {
			this.logToBoth(`❌ Error in queryRankingData:`, error, "error");
			return { type: "error", data: [], error: "Error querying ranking data" };
		}
	}

	public getProcessingDetails(): ProcessingDetails {
		return {
			questionAnalysis: this.lastQuestionAnalysis,
			cypherQueries: this.lastExecutedQueries,
			processingSteps: this.lastProcessingSteps,
			queryBreakdown: this.lastQueryBreakdown,
		};
	}
}

export const chatbotService = ChatbotService.getInstance();
