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

			// Check for pending clarification and combine with clarification answer if applicable
			let questionToProcess = context.question;
			if (context.sessionId) {
				const pendingClarification = conversationContextManager.getPendingClarification(context.sessionId);
				if (pendingClarification && this.isClarificationAnswer(context.question)) {
					// Combine the original question with the clarification answer
					// Example: "How many times has Luke played?" + "Luke Bangs" → "How many times has Luke Bangs played?"
					// Example: "How many times has Oli played?" + "Goddard" → "How many times has Oli Goddard played?"
					const originalQuestion = pendingClarification.originalQuestion;
					const clarificationAnswer = context.question.trim();
					
					// Check if the clarification answer is a single word (likely a surname to combine with first name)
					const isSingleWord = !clarificationAnswer.includes(" ") && clarificationAnswer.length > 0;
					
					if (isSingleWord) {
						// Try to find a first name in the original question and combine with the surname - Pattern to find capitalized words that might be first names
						const firstNamePattern = /\b([A-Z][a-z]+)\b/g;
						const firstNameMatches = originalQuestion.match(firstNamePattern);
						
						if (firstNameMatches && firstNameMatches.length > 0) {
							// Find the first name that appears before common question words
							const questionWords = ["has", "have", "did", "does", "is", "are", "was", "were", "played", "scored", "got"];
							let firstNameToReplace = null;
							
							for (const match of firstNameMatches) {
								const matchIndex = originalQuestion.indexOf(match);
								const afterMatch = originalQuestion.substring(matchIndex + match.length).toLowerCase();
								// Check if this name appears before question words (likely the player name)
								if (questionWords.some(word => afterMatch.includes(word))) {
									firstNameToReplace = match;
									break;
								}
							}
							
							if (firstNameToReplace) {
								// Combine first name with surname: "Oli" + "Goddard" = "Oli Goddard"
								const fullName = `${firstNameToReplace} ${clarificationAnswer}`;
								questionToProcess = originalQuestion.replace(firstNameToReplace, fullName);
								this.logToBoth(`🔄 Combined question (first name + surname): "${originalQuestion}" + "${clarificationAnswer}" → "${questionToProcess}"`, null, "log");
							} else {
								// Fallback: try to replace the first capitalized word
								questionToProcess = originalQuestion.replace(firstNameMatches[0], `${firstNameMatches[0]} ${clarificationAnswer}`);
								this.logToBoth(`🔄 Combined question (fallback first name): "${originalQuestion}" + "${clarificationAnswer}" → "${questionToProcess}"`, null, "log");
							}
						} else {
							// No first name found, try standard replacement
							const playerNamePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
							const matches = originalQuestion.match(playerNamePattern);
							if (matches && matches.length > 0) {
								questionToProcess = originalQuestion.replace(matches[0], `${matches[0]} ${clarificationAnswer}`);
								this.logToBoth(`🔄 Combined question (append surname): "${originalQuestion}" + "${clarificationAnswer}" → "${questionToProcess}"`, null, "log");
							}
						}
					} else {
						// Multi-word answer (full name), replace the partial name
						const playerNamePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
						const matches = originalQuestion.match(playerNamePattern);
						
						if (matches && matches.length > 0) {
							// Replace the first player name match with the clarification answer
							questionToProcess = originalQuestion.replace(matches[0], clarificationAnswer);
							this.logToBoth(`🔄 Combined question: "${originalQuestion}" + "${clarificationAnswer}" → "${questionToProcess}"`, null, "log");
						} else {
							// If no clear pattern match, append the clarification answer to the original question
							questionToProcess = `${originalQuestion.replace(/\?$/, "")} ${clarificationAnswer}?`;
							this.logToBoth(`🔄 Combined question (fallback): "${originalQuestion}" + "${clarificationAnswer}" → "${questionToProcess}"`, null, "log");
						}
					}
					
					// Clear the pending clarification
					conversationContextManager.clearPendingClarification(context.sessionId);
				}
			}

			// Analyze the question
			let analysis = await this.analyzeQuestion(questionToProcess, context.userContext);
			
			// Merge conversation context if session ID provided
			if (context.sessionId) {
				analysis = conversationContextManager.mergeContext(context.sessionId, analysis);
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

			// If this is a streak question, override clarification and set type to streak
			if ((isConsecutiveWeekendsQuestion || isConsecutiveGoalInvolvementQuestion) && context.userContext) {
				analysis.type = "streak";
				analysis.requiresClarification = false;
				analysis.entities = [context.userContext];
				this.logToBoth(`🔍 Overriding clarification for streak question, using userContext: ${context.userContext}`, null, "log");
			}

			// Check for "most prolific season" questions - override clarification if userContext exists
			const isMostProlificSeasonQuestion = 
				questionLower.includes("most prolific season") || questionLower.includes("prolific season");
			
			if (isMostProlificSeasonQuestion && context.userContext) {
				analysis.type = "player";
				analysis.requiresClarification = false;
				// Ensure entities array has the userContext
				if (analysis.entities.length === 0) {
					analysis.entities = [context.userContext];
				}
				// Ensure metrics array has MostProlificSeason
				if (!analysis.metrics.includes("MostProlificSeason")) {
					analysis.metrics = ["MostProlificSeason"];
				}
				this.logToBoth(`🔍 Overriding clarification for most prolific season question, using userContext: ${context.userContext}`, null, "log");
			}

			// Handle clarification needed case
			if (analysis.type === "clarification_needed") {
				// Try to provide a better fallback response
				if (analysis.confidence !== undefined && analysis.confidence < 0.5) {
					const fallbackResponse = questionSimilarityMatcher.generateFallbackResponse(context.question, analysis);
					return {
						answer: fallbackResponse,
						sources: [],
						answerValue: "Clarification needed",
					};
				}
				return {
					answer: analysis.message || "Please clarify your question.",
					sources: [],
					answerValue: "Clarification needed",
				};
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

			// Generate the response (use original question for response generation, but processed question was used for analysis) - Pass userContext so it can be used for post-query clarification checks
			const response = await this.generateResponse(questionToProcess, data, analysis, context.userContext);

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

			// Use error handler for better error messages
			const errorObj = error instanceof Error ? error : new Error(String(error));
			const errorMessage = await errorHandler.generateErrorResponse(errorObj, {
				question: context.question,
				analysis: this.lastQuestionAnalysis || undefined,
			});

			return {
				answer: errorMessage,
				sources: [],
				cypherQuery: "N/A",
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
			const playerNames = nonIPlayerEntities.map((e) => {
				const originalText = e.originalText.replace(/\s*\(resolved to:.*?\)$/i, "").trim();
				return originalText;
			}).join(", ");

			// Check if it's a single first name (likely needs surname clarification)
			const isSingleFirstName = nonIPlayerEntities.length === 1 && 
				!playerNames.includes(" ") && 
				playerNames.length > 0 && 
				playerNames.length < 15; // Reasonable first name length

			if (isSingleFirstName) {
				return `Please clarify which ${playerNames} you are asking about.`;
			}

			return `I found a player name "${playerNames}" in your question, but it doesn't match the selected player "${userContext}". Please provide the full player name you're asking about, or confirm if you meant "${userContext}".`;
		}

		return null;
	}

	// Check if a user response is likely answering a clarification request
	private isClarificationAnswer(question: string): boolean {
		const trimmed = question.trim();
		
		// Very short responses (likely just a name or short answer)
		if (trimmed.length < 50) {
			// Check if it looks like a name (contains capitalized words, no question marks, minimal punctuation)
			const hasCapitalizedWords = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/.test(trimmed);
			const hasQuestionMark = trimmed.includes("?");
			const hasMinimalPunctuation = (trimmed.match(/[.,!?;:]/g) || []).length <= 1;
			
			// If it has capitalized words (likely a name), no question mark, and minimal punctuation, it's likely a clarification answer
			if (hasCapitalizedWords && !hasQuestionMark && hasMinimalPunctuation) {
				return true;
			}
			
			// Very short responses without question words are likely answers
			const hasQuestionWords = /\b(what|who|which|when|where|why|how|is|are|can|could|will|would)\b/i.test(trimmed);
			if (!hasQuestionWords && trimmed.length < 30) {
				return true;
			}
		}
		
		return false;
	}

	private async queryRelevantData(analysis: EnhancedQuestionAnalysis, userContext?: string): Promise<Record<string, unknown> | null> {
		const { type, entities, metrics } = analysis;
		const question = analysis.question?.toLowerCase() || "";

		try {
			// Ensure Neo4j connection before querying
			const connected = await neo4jService.connect();
			if (!connected) {
				this.logToBoth("❌ Neo4j connection failed", null, "error");
				return null;
			}

			// Check if this is a "which team has fewest/most goals conceded" question - This needs to be checked before player routing to avoid misclassification
			const isTeamConcededRankingQuestion = 
				(question.includes("which team") || question.includes("what team")) &&
				(question.includes("fewest") || question.includes("most") || question.includes("least") || question.includes("highest")) &&
				(question.includes("conceded") || question.includes("scored") || question.includes("goals"));

			if (isTeamConcededRankingQuestion) {
				return await ClubDataQueryHandler.queryClubData(entities, metrics, analysis);
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
			const isDistanceQuery = 
				question.includes("distance") || question.includes("far") || question.includes("travel") ||
				question.includes("furthest") || question.includes("furthest opposition");

			if (isDistanceQuery) {
				const extractionResult = analysis.extractionResult;
				const playerEntities = extractionResult?.entities?.filter(e => e.type === "player").map(e => e.value) || [];
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

			// Check for "most prolific season" questions - route to player handler - This check must happen before the switch statement to ensure proper routing
			const isMostProlificSeasonQuestion = 
				(question.includes("most prolific season") || question.includes("prolific season")) &&
				(question.includes("what") || question.includes("which") || question.includes("my") || question.includes("your"));

			if (isMostProlificSeasonQuestion) {
				// Ensure this is routed to player handler with proper context
				const playerName = entities.length > 0 ? entities[0] : (userContext || "");
				if (playerName || userContext) {
					// Force route to player handler by ensuring entities array has the player
					const playerEntities = playerName ? [playerName] : (userContext ? [userContext] : []);
					this.lastProcessingSteps.push(`Detected most prolific season question, routing to PlayerDataQueryHandler with player: ${playerEntities[0] || userContext}`);
					return await PlayerDataQueryHandler.queryPlayerData(playerEntities, ["MostProlificSeason"], analysis, userContext);
				} else {
					this.lastProcessingSteps.push(`Most prolific season question detected but no player context available`);
				}
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
				return await LeagueTableQueryHandler.queryLeagueTableData(entities, metrics, analysis);
			case "general":
				return await this.queryGeneralData();
			default:
				this.logToBoth(`🔍 Unknown question type: ${type}`, "warn");
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
		const isOpenPlayGoals = question.includes("open play") || 
		                        question.includes("openplay") ||
		                        extractedMetrics.some(m => m.toUpperCase() === "OPENPLAYGOALS" || m.toUpperCase() === "OPENPLAY");
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
		const params: any = {
			graphLabel,
			teamName,
		};
		
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
	): Promise<ChatbotResponse> {
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

		// Enhanced error handling with specific error messages
		if (!data) {
			answer = "Database connection error: Unable to connect to the club's database. Please try again later.";
		} else if (data.type === "error") {
			answer = `Database error: ${data.error || "An unknown error occurred while querying the database."}`;
		} else if (data.type === "player_not_found") {
			answer =
				(data.message as string) ||
				`Player not found: I couldn't find a player named "${data.playerName}" in the database. Please check the spelling or try a different player name.`;
		} else if (data.type === "team_not_found") {
			const availableTeams = (data.availableTeams as string[]) || [];
			answer =
				(data.message as string) ||
				`Team not found: I couldn't find the team "${data.teamName}". Available teams are: ${availableTeams.join(", ")}.`;
		} else if (data.type === "no_context") {
			answer = "Missing context: Please specify which player or team you're asking about.";
		} else if (data.type === "clarification_needed") {
			answer = (data.message as string) || "Please clarify your question with more specific details.";
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
		} else if (data && data.type === "player_opposition_appearances") {
			// Handle opposition appearance queries (e.g., "How many times have I played Old Hamptonians?")
			const playerName = (data.playerName as string) || "";
			const oppositionName = (data.oppositionName as string) || "";
			const appearances = (data.appearances as number) || 0;
			
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
					contextMessage += ` between ${DateUtils.formatDate(startDate)} and ${DateUtils.formatDate(endDate)}`;
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
					contextMessage += ` between ${DateUtils.formatDate(startDate)} and ${DateUtils.formatDate(endDate)}`;
				}
				answer = `${playerName1} and ${playerName2} have played together ${gamesTogether} ${gamesTogether === 1 ? "time" : "times"}${contextMessage}.`;
				answerValue = gamesTogether;
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
			const opponents = (data.data as OpponentData[]) || [];
			if (opponents.length === 0) {
				answer = "No opponents found.";
			} else {
				const topOpponent = opponents[0];
				answer = `You have played against ${topOpponent.opponent} ${topOpponent.gamesPlayed} ${topOpponent.gamesPlayed === 1 ? "time" : "times"}.`;
				answerValue = topOpponent.gamesPlayed;
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

					visualization = {
						type: "Calendar",
						data: {
							weeks: weeks,
							highlightRange: highlightRange,
						},
					};
				}
			} else if (streakType === "consecutive_clean_sheets" || streakType === "consecutive_goal_involvement") {
				// Handle consecutive clean sheets and goal involvement streaks with calendar visualization
				const streakCount = (data.streakCount as number) || 0;
				const streakSequence = (data.streakSequence as string[]) || [];
				const streakData = (data.data as Array<{ date: string; [key: string]: any }>) || [];
				const streakStartDate = (data.streakStartDate as string) || null;
				const streakEndDate = (data.streakEndDate as string) || null;
				const highlightRange = (data.highlightRange as { startWeek: number; startYear: number; endWeek: number; endYear: number }) || undefined;
				
				if (streakCount === 0) {
					if (streakType === "consecutive_clean_sheets") {
						answer = "You haven't had any consecutive clean sheets.";
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

				// Build Calendar visualization for consecutive clean sheets/goal involvement - Convert date array to week-based format with highlightRange
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

					visualization = {
						type: "Calendar",
						data: {
							weeks: weeks,
							highlightRange: highlightRange,
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
			if (rankingData.length === 0) {
				answer = "No ranking data found.";
			} else {
				const topRanking = rankingData[0];
				if (topRanking.playerName) {
					answer = `${topRanking.playerName} is ranked #1 with ${FormattingUtils.formatValueByMetric((data.metric as string) || "G", topRanking.value)}.`;
					answerValue = topRanking.value;
				} else if (topRanking.teamName) {
					answer = `${topRanking.teamName} is ranked #1 with ${FormattingUtils.formatValueByMetric((data.metric as string) || "G", topRanking.value)}.`;
					answerValue = topRanking.value;
				}
			}
		} else if (data && data.type === "league_table") {
			// Handle league table data
			// Check if answer is already provided by query handler
			if (data.answer) {
				answer = data.answer as string;
				const leagueTableData = (data.data as LeagueTableEntry[]) || [];
				if (leagueTableData.length > 0) {
					answerValue = leagueTableData[0].position;
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
					answerValue = topEntry.position;
				}
			}
			
			// Always display the full league table if available
			const fullTable = (data.fullTable as LeagueTableEntry[]) || [];
			if (fullTable.length > 0) {
				// Transform league table data for visualization
				const tableData = fullTable.map((entry) => ({
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
				
				visualization = {
					type: "Table",
					data: tableData,
					config: {
						columns: [
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
						],
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
			const periodLabel = period === "weekly" ? "Team of the Week" : "Season Team of the Week";
			
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
			const teamName = data.teamName as string;
			const value = data.value as number | undefined;
			const goalsScored = data.goalsScored as number | undefined;
			const goalsConceded = data.goalsConceded as number | undefined;
			const gamesPlayed = data.gamesPlayed as number | undefined;
			const isGoalsScored = data.isGoalsScored as boolean | undefined;
			const isGoalsConceded = data.isGoalsConceded as boolean | undefined;
			const metric = data.metric as string | undefined;
			const metricField = data.metricField as string | undefined;
			const season = data.season as string | undefined;

			if (value !== undefined && metric && metricField) {
				// Single metric query (e.g., appearances, assists, etc.)
				answerValue = value;
				const metricDisplayName = getMetricDisplayName(metric, value);
				answer = `The ${teamName} have ${metricDisplayName.toLowerCase()} ${FormattingUtils.formatValueByMetric(metric, value)}.`;
			} else if (goalsScored !== undefined || goalsConceded !== undefined) {
				// Goals query
				if (isGoalsScored) {
					answerValue = goalsScored || 0;
					const seasonText = season ? ` in the ${season} season` : "";
					answer = `The ${teamName} have scored ${goalsScored || 0} ${(goalsScored || 0) === 1 ? "goal" : "goals"}${seasonText}.`;
					
					// Return NumberCard for team goals in season
					if (season) {
						const roundedGoals = this.roundValueByMetric("G", goalsScored || 0);
						visualization = {
							type: "NumberCard",
							data: [{ 
								name: "Goals Scored", 
								value: roundedGoals,
								iconName: this.getIconNameForMetric("G")
							}],
							config: {
								title: `${teamName} - Goals in ${season}`,
								type: "bar",
							},
						};
					}
				} else if (isGoalsConceded) {
					answerValue = goalsConceded || 0;
					answer = `The ${teamName} have conceded ${goalsConceded || 0} ${(goalsConceded || 0) === 1 ? "goal" : "goals"}.`;
				} else {
					// Both goals scored and conceded
					answerValue = goalsScored || 0;
					const goalLabelPlural = "goals";
					const goalLabelScored = isGoalsScored ? "Open Play Goals" : "Goals Scored";
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
				// Set answerValue to team name for Record type extraction
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
		} else if (data && data.type === "most_played_with") {
			// Handle most played with queries
			const playerName = (data.playerName as string) || "You";
			const teamName = data.teamName as string | undefined;
			const resultData = (data.data as Array<{ teammateName: string; gamesTogether: number }>) || [];
			
			if (resultData.length === 0) {
				const teamContext = teamName ? ` for the ${teamName}` : "";
				answer = `${playerName} haven't played with any teammates${teamContext}.`;
			} else {
				const topPlayer = resultData[0];
				const teamContext = teamName ? ` whilst playing for the ${teamName}` : "";
				answer = `${playerName} have played the most games with ${topPlayer.teammateName}${teamContext}, with ${topPlayer.gamesTogether} ${topPlayer.gamesTogether === 1 ? "game" : "games"}.`;
				answerValue = topPlayer.teammateName;
				
				// Create table with top 3 players
				const tableData = resultData.map((item) => ({
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
					answer = `${playerNameStr} has played 0 home games.`;
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
					answer = `${playerNameStr} has played 0 away games.`;
				} else if (metricStr.toUpperCase() === "AWAYGAMES%WON" || metricStr === "AwayGames%Won" || metricStr === "Away Games % Won") {
					// For away games percentage won queries
					const zeroResponse = getZeroStatResponse(metricStr, playerNameStr);
					if (zeroResponse) {
						answer = zeroResponse;
					} else {
						answer = `${playerNameStr} has not played an away game`;
					}
				}
			}
			// Check if this is a MatchDetail query that failed - try Player node fallback
			else if (metric && ["CPERAPP", "FTPPERAPP", "GPERAPP", "MPERG", "MPERCLS"].includes((metric as string).toUpperCase())) {
				answer = `MatchDetail data unavailable: The detailed match data needed for ${metric} calculations is not available in the database. This metric requires individual match records which appear to be missing.`;
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
					answer = `No data found: I couldn't find any ${metric} information for ${playerName}. This could mean the data doesn't exist in the database or the query didn't match any records.`;
				}
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
							
							// Create Record visualization with all seasons
							visualization = {
								type: "Record",
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
					if (questionLower.includes("most prolific season") || questionLower.includes("prolific season")) {
						// Check if we have array data (multiple seasons) from the query
						if (data && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
							const seasonsData = data.data as Array<{ season?: string; value: number | string; [key: string]: unknown }>;
							
							// Transform data to ensure we have season and value
							const transformedData = seasonsData
								.map((item) => {
									// Handle both { season: "2019/20", value: 15 } and { value: "2019/20" } formats
									const season = item.season || (typeof item.value === "string" ? item.value : "");
									const goals = typeof item.value === "number" ? item.value : (item.goals as number) || 0;
									return { season, goals };
								})
								.filter((item) => item.season && item.goals !== undefined);
							
							if (transformedData.length > 0) {
							// Find the season with the most goals
							const mostProlific = transformedData.reduce((max, item) => (item.goals > max.goals ? item : max), transformedData[0]);
							
							answer = `${playerName}'s most prolific season was ${mostProlific.season} with ${mostProlific.goals} ${mostProlific.goals === 1 ? "goal" : "goals"}.`;
							answerValue = mostProlific.season;
							
							// Sort by season ascending for chronological display
							const sortedData = [...transformedData].sort((a, b) => {
								return a.season.localeCompare(b.season);
							});
							
							// Find the maximum goals for highlighting
							const maxGoals = Math.max(...sortedData.map((item) => item.goals));
							
							// Create Record visualization (bar chart) with all seasons
							visualization = {
								type: "Record",
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
							} else {
								answer = `${playerName} has no season data available.`;
							}
						} else {
							answer = `${playerName} has no season data available.`;
						}
					}
				}
				// Handle MostPlayedForTeam/TEAM_ANALYSIS - create table with all teams
				else if (metric && (metric === "MostPlayedForTeam" || metric === "MOSTPLAYEDFORTEAM" || metric === "TEAM_ANALYSIS")) {
					const teamData = data.data as Array<{ playerName: string; value: string; appearances?: number; teamOrder?: number }>;
					if (teamData && teamData.length > 0) {
						// Get the most played team (first in the sorted list)
						const mostPlayedTeam = teamData[0].value;
						answer = `${playerName} has played for the ${mostPlayedTeam} most.`;
						answerValue = mostPlayedTeam;
						
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
				// Handle regular single-value queries
				else {
					const playerData = data.data as PlayerData[];
					const value = playerData[0]?.value;

					if (value !== undefined && value !== null) {
						// Round answerValue for penalty conversion rate to 1 decimal place
						if (metric && metric.toUpperCase() === "PENALTY_CONVERSION_RATE") {
							answerValue = this.roundValueByMetric(metric, value as number);
						} else {
							answerValue = value as number;
						}
						
						// Check for competition filter to customize answer text
						const competitions = analysis.competitions || [];
						const hasCompetitionFilter = competitions.length > 0;
						
						if (hasCompetitionFilter && metric && metric.toUpperCase() === "G") {
							// Custom answer format for goals with competition: "Oli Goddard has scored 5 goals in the Premier"
							const competitionName = competitions[0];
							const goalCount = value as number;
							const goalText = goalCount === 1 ? "goal" : "goals";
							answer = `${playerName} has scored ${goalCount} ${goalText} in the ${competitionName}.`;
						} else {
							answer = ResponseBuilder.buildContextualResponse(playerName, metric, value, analysis);
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
						// Create NumberCard visualization for goals queries with competition or location filters
						else if (metric && metric.toUpperCase() === "G") {
							const locations = analysis.extractionResult?.locations || [];
							const hasAwayLocation = locations.some((loc) => loc.type === "away");
							
							if (hasAwayLocation) {
								const iconName = this.getIconNameForMetric(metric);
								const displayName = "Away Goals";
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
							} else if (hasCompetitionFilter) {
								// Generate NumberCard for goals in specific competition (e.g., "Premier")
								// NumberCard should show just "goals" as the name
								const iconName = this.getIconNameForMetric(metric);
								const roundedValue = this.roundValueByMetric(metric, value as number);
								
								visualization = {
									type: "NumberCard",
									data: [{ 
										name: "goals",
										wordedText: "goals", 
										value: roundedValue,
										iconName: iconName
									}],
									config: {
										title: `${playerName} - Goals in ${competitions[0]}`,
										type: "bar",
									},
								};
							}
						}
					} else {
						answer = "No data found for your query.";
					}
				}
			} else {
				// Handle other data types
				const playerData = data.data as PlayerData[];
				const playerName = playerData[0]?.playerName || analysis.entities[0] || "Unknown";
				const value = playerData[0]?.value;
				const metric = (data.metric as string) || analysis.metrics[0] || "G";

				if (value !== undefined && value !== null) {
					answerValue = value as number;
					answer = ResponseBuilder.buildContextualResponse(playerName, metric, value, analysis);
				} else {
					answer = "No data found for your query.";
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
				}
			}
		}

		return {
			answer,
			data: data?.data,
			visualization,
			sources,
			answerValue,
			cypherQuery: data?.cypherQuery as string | undefined,
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
			whereConditions.push("f.season = $season");
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
			LIMIT 3
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
