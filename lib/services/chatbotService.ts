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

export interface ChatbotResponse {
	answer: string;
	data?: unknown;
	visualization?: {
		type: VisualizationType;
		data: unknown;
		config?: Record<string, unknown>;
	};
	sources: string[];
	cypherQuery?: string;
	debug?: {
		question?: string;
		userContext?: string;
		timestamp?: string;
		serverLogs?: string;
		processingDetails?: {
			questionAnalysis?: EnhancedQuestionAnalysis | null;
			cypherQueries?: string[];
			processingSteps?: string[];
			queryBreakdown?: Record<string, unknown> | null;
		};
	};
}

export interface QuestionContext {
	question: string;
	userContext?: string;
	dataSources?: string[];
	sessionId?: string;
	conversationHistory?: Array<{
		question: string;
		entities: string[];
		metrics: string[];
		timestamp: string;
	}>;
}

export interface ProcessingDetails {
	questionAnalysis: EnhancedQuestionAnalysis | null;
	cypherQueries: string[];
	processingSteps: string[];
	queryBreakdown: Record<string, unknown> | null;
}

// Specific interfaces for better type safety
export interface PlayerData {
	playerName: string;
	value: number | string;
	[key: string]: unknown;
}

export interface TeamData {
	teamName: string;
	value: number | string;
	[key: string]: unknown;
}

export interface StreakData {
	date: string;
	goals?: number;
	assists?: number;
	[key: string]: unknown;
}

export interface CoPlayerData {
	coPlayerName: string;
	gamesPlayedTogether: number;
	[key: string]: unknown;
}

export interface OpponentData {
	opponent: string;
	gamesPlayed: number;
	[key: string]: unknown;
}

export interface RankingData {
	playerName?: string;
	teamName?: string;
	value: number;
	[key: string]: unknown;
}

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
	private teamNameMappingCache: Map<string, string> = new Map();
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

	// Helper function to format values according to config
	private formatValueByMetric(metric: string, value: number | bigint | string | Record<string, unknown>): string {
		// Debug logging for percentage metrics
		if (
			metric.includes("%") ||
			metric.includes("HomeGames%Won") ||
			(value && typeof value === "object" && value.originalPercentage === 51.8)
		) {
			this.logToBoth(
				`🔧 formatValueByMetric called with metric: "${metric}", value: ${JSON.stringify(value)}, type: ${typeof value}`,
				null,
				"log",
			);
		}

		// Handle BigInt values from Neo4j first
		if (typeof value === "bigint") {
			return value.toString();
		}

		// Handle Neo4j Integer objects (e.g., {low: 445, high: 0})
		if (value && typeof value === "object" && "low" in value && "high" in value) {
			const neo4jInt = value as { low: number; high: number };
			value = neo4jInt.low + neo4jInt.high * 4294967296; // Convert Neo4j Integer to number
		}

		// Handle string values (like position names) - but check if it's a number string first
		if (typeof value === "string") {
			// Check if it's already a percentage string (ends with %)
			if (value.endsWith("%")) {
				// For percentage strings, we need to preserve the original percentage value
				// and mark it as already processed to avoid double conversion
				const numericPart = parseFloat(value.replace("%", ""));
				if (!isNaN(numericPart)) {
					// Store the original percentage value and mark it as already processed
					value = {
						originalPercentage: numericPart,
						isAlreadyPercentage: true,
					};
					if (metric.includes("HomeGames%Won") || value.originalPercentage === 51.8) {
						this.logToBoth(`🔧 Converting percentage string: "${value.originalPercentage}%" -> preserving as percentage value`, null, "log");
					}
				} else {
					// If we can't parse it, return as-is
					return value;
				}
			} else {
				// Check if it's a numeric string that needs formatting
				const numValue = parseFloat(value);
				if (!isNaN(numValue)) {
					// It's a numeric string, continue with formatting logic
					value = numValue;
				} else {
					// It's a non-numeric string, return as-is
					return value;
				}
			}
		}

		// Resolve metric alias to canonical key before looking up config
		const resolvedMetric = (findMetricByAlias(metric)?.key || metric) as keyof typeof statObject;
		// Find the metric config
		const metricConfig = statObject[resolvedMetric];

		// Debug logging for metric config lookup
		if (metric.includes("%")) {
			this.logToBoth(`🔧 Looking up metric config for "${metric}":`, metricConfig, "log");
			this.logToBoth(`🔧 Resolved metric: "${resolvedMetric}"`, null, "log");
			this.logToBoth(
				`🔧 Available statObject keys:`,
				Object.keys(statObject).filter((key) => key.includes("%")),
				"log",
			);
			if (metricConfig) {
				this.logToBoth(`🔧 Metric config numberDecimalPlaces:`, metricConfig.numberDecimalPlaces, "log");
			}
		}

		if (metricConfig && typeof metricConfig === "object") {
			// Handle percentage formatting
			if (metricConfig.statFormat === "Percentage") {
				const decimalPlaces = metricConfig.numberDecimalPlaces || 0;

				// Check if this is already a processed percentage value
				if (value && typeof value === "object" && "isAlreadyPercentage" in value && "originalPercentage" in value) {
					const percentageValue = value as { originalPercentage: number; isAlreadyPercentage: boolean };
					// Use the original percentage value and apply decimal places
					const result = percentageValue.originalPercentage.toFixed(decimalPlaces) + "%";
					if (metric.includes("%")) {
						this.logToBoth(`🔧 Percentage formatting (already processed): ${percentageValue.originalPercentage}% -> ${result}`, null, "log");
						this.logToBoth(`🔧 Final result: "${result}"`, null, "log");
					}
					return result;
				}

				// Check if value is already a percentage (>= 1) or a decimal (< 1)
				const percentageValue = Number(value) >= 1 ? Number(value) : Number(value) * 100;
				const result = percentageValue.toFixed(decimalPlaces) + "%";
				if (metric.includes("%")) {
					this.logToBoth(`🔧 Percentage formatting: ${value} -> ${percentageValue} -> ${result}`, null, "log");
					this.logToBoth(`🔧 Final result: "${result}"`, null, "log");
				}
				return result;
			}

			// Handle other numeric formatting
			if ("numberDecimalPlaces" in metricConfig) {
				const decimalPlaces = metricConfig.numberDecimalPlaces || 0;

				// Check if this is already a processed percentage value
				if (value && typeof value === "object" && "isAlreadyPercentage" in value && "originalPercentage" in value) {
					const percentageValue = value as { originalPercentage: number; isAlreadyPercentage: boolean };
					// Use the original percentage value and apply decimal places
					const result = percentageValue.originalPercentage.toFixed(decimalPlaces);
					if (metric.includes("%")) {
						this.logToBoth(`🔧 Decimal formatting (already processed): ${percentageValue.originalPercentage} -> ${result}`, null, "log");
					}
					return result;
				}

				const result = Number(value).toFixed(decimalPlaces);
				if (metric.includes("%")) {
					this.logToBoth(`🔧 Decimal formatting: ${value} -> ${result}`, null, "log");
				}
				return result;
			}
		}

		// Default to integer if no config found
		// Check if this is already a processed percentage value
		if (value && typeof value === "object" && "isAlreadyPercentage" in value && "originalPercentage" in value) {
			const percentageValue = value as { originalPercentage: number; isAlreadyPercentage: boolean };
			// Use the original percentage value
			const result = percentageValue.originalPercentage.toString();
			if (metric.includes("%")) {
				this.logToBoth(`🔧 Default formatting (already processed): ${percentageValue.originalPercentage} -> ${result}`, null, "log");
			}
			return result;
		}

		const result = Math.round(Number(value)).toString();
		if (metric.includes("%")) {
			this.logToBoth(`🔧 Default formatting (no config found): ${value} -> ${result}`, null, "log");
		}
		return result;
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

	/**
	 * Execute a query with optional profiling for slow queries
	 */
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

	private convertDateFormat(dateStr: string): string {
		// Convert DD/MM/YYYY or DD/MM/YY to YYYY-MM-DD
		const parts = dateStr.split("/");
		if (parts.length === 3) {
			let day = parts[0].padStart(2, "0");
			let month = parts[1].padStart(2, "0");
			let year = parts[2];

			// Handle 2-digit years
			if (year.length === 2) {
				const currentYear = new Date().getFullYear();
				const century = Math.floor(currentYear / 100) * 100;
				const yearNum = parseInt(year);
				year = (century + yearNum).toString();
			}

			return `${year}-${month}-${day}`;
		}
		return dateStr; // Return as-is if format not recognized
	}

	private formatDate(dateStr: string): string {
		// Convert YYYY-MM-DD to DD/MM/YYYY
		if (dateStr.includes("-") && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
			const parts = dateStr.split("-");
			const year = parts[0];
			const month = parts[1];
			const day = parts[2];
			return `${day}/${month}/${year}`;
		}
		return dateStr;
	}

	private formatTimeRange(timeRange: string): string {
		// Format a time range like "2022-03-20 to 2024-10-21" to "20/03/2022 to 21/10/2024"
		if (timeRange.includes(" to ")) {
			const [startDate, endDate] = timeRange.split(" to ");
			const formattedStart = this.formatDate(startDate.trim());
			const formattedEnd = this.formatDate(endDate.trim());
			return `${formattedStart} to ${formattedEnd}`;
		}
		return timeRange;
	}

	private mapTeamName(teamName: string): string {
		// Check cache first
		const cacheKey = teamName.toLowerCase();
		if (this.teamNameMappingCache.has(cacheKey)) {
			return this.teamNameMappingCache.get(cacheKey)!;
		}

		// Map common team name variations to database format
		const teamMapping: { [key: string]: string } = {
			"1s": "1st XI",
			"2s": "2nd XI",
			"3s": "3rd XI",
			"4s": "4th XI",
			"5s": "5th XI",
			"6s": "6th XI",
			"7s": "7th XI",
			"8s": "8th XI",
			"1st": "1st XI",
			"2nd": "2nd XI",
			"3rd": "3rd XI",
			"4th": "4th XI",
			"5th": "5th XI",
			"6th": "6th XI",
			"7th": "7th XI",
			"8th": "8th XI",
			first: "1st XI",
			second: "2nd XI",
			third: "3rd XI",
			fourth: "4th XI",
			fifth: "5th XI",
			sixth: "6th XI",
			seventh: "7th XI",
			eighth: "8th XI",
		};

		const result = teamMapping[cacheKey] || teamName;
		// Cache the result
		this.teamNameMappingCache.set(cacheKey, result);
		return result;
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

			// Analyze the question
			let analysis = await this.analyzeQuestion(context.question, context.userContext);
			
			// Merge conversation context if session ID provided
			if (context.sessionId) {
				analysis = conversationContextManager.mergeContext(context.sessionId, analysis);
			}
			
			this.lastQuestionAnalysis = analysis; // Store for debugging

			// Handle clarification needed case
			if (analysis.type === "clarification_needed") {
				// Log unanswered questions for clarification_needed cases (fire-and-forget, non-blocking)
				// These represent unanswerable questions that should be tracked
				const shouldLogClarification = 
					(analysis.confidence !== undefined && analysis.confidence < 0.5) ||
					analysis.requiresClarification ||
					analysis.entities.length === 0 ||
					analysis.metrics.length === 0;

				if (shouldLogClarification) {
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

				// Try to provide a better fallback response
				if (analysis.confidence !== undefined && analysis.confidence < 0.5) {
					const fallbackResponse = questionSimilarityMatcher.generateFallbackResponse(context.question, analysis);
					return {
						answer: fallbackResponse,
						sources: [],
					};
				}
				return {
					answer: analysis.message || "Please clarify your question.",
					sources: [],
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
			const data = await this.queryRelevantData(analysis);
			this.lastProcessingSteps.push(`Query completed, result type: ${data?.type || "null"}`);

			// Generate the response
			const response = await this.generateResponse(context.question, data, analysis);

			// Store in conversation context if session ID provided
			if (context.sessionId) {
				conversationContextManager.addToHistory(context.sessionId, context.question, analysis);
			}

			// Log unanswered questions (fire-and-forget, non-blocking)
			const shouldLog = 
				response.answer === "I couldn't find relevant information for your question." ||
				(analysis.confidence !== undefined && analysis.confidence < 0.5) ||
				analysis.requiresClarification ||
				analysis.entities.length === 0 ||
				analysis.metrics.length === 0 ||
				(data && ((data as any).type === "error" || ((data as any).data && Array.isArray((data as any).data) && (data as any).data.length === 0)));

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

			// Log unanswered question when error occurs (fire-and-forget, non-blocking)
			unansweredQuestionLogger.log({
				originalQuestion,
				correctedQuestion,
				analysis: this.lastQuestionAnalysis || {
					type: "general",
					entities: [],
					metrics: [],
					extractionResult: {
						entities: [],
						statTypes: [],
						statIndicators: [],
						questionTypes: [],
						negativeClauses: [],
						locations: [],
						timeFrames: [],
						competitionTypes: [],
						competitions: [],
						results: [],
						opponentOwnGoals: false,
						goalInvolvements: false,
					},
					complexity: "simple",
					requiresClarification: false,
					question: context.question,
					confidence: 0,
					message: error instanceof Error ? error.message : String(error),
				},
				confidence: this.lastQuestionAnalysis?.confidence || 0,
				userContext: context.userContext,
			}).catch((err) => {
				console.error("❌ Failed to log unanswered question:", err);
			});

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

	private async queryRelevantData(analysis: EnhancedQuestionAnalysis): Promise<Record<string, unknown> | null> {
		const { type, entities, metrics } = analysis;

		try {
			// Ensure Neo4j connection before querying
			const connected = await neo4jService.connect();
			if (!connected) {
				this.logToBoth("❌ Neo4j connection failed", null, "error");
				return null;
			}

			//
			switch (type) {
				case "player":
					return await this.queryPlayerData(entities, metrics, analysis);
				case "team":
					return await this.queryTeamData(entities, metrics);
				case "club":
					return await this.queryClubData(entities, metrics);
				case "fixture":
					return await this.queryFixtureData(entities, metrics);
				case "comparison":
					return await this.queryComparisonData(entities, metrics);
				case "streak":
					return await this.queryStreakData(entities, metrics);
				case "temporal":
					return await this.queryTemporalData(entities, metrics, analysis.timeRange);
				case "double_game":
					return await this.queryDoubleGameData(entities, metrics);
				case "ranking":
					return await this.queryRankingData(entities, metrics, analysis);
				case "league_table":
					return await this.queryLeagueTableData(entities, metrics, analysis);
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

	private async queryPlayerData(
		entities: string[],
		metrics: string[],
		analysis: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		// Use enhanced analysis data directly
		const teamEntities = analysis.teamEntities || [];
		const oppositionEntities = analysis.oppositionEntities || [];
		const timeRange = analysis.timeRange;
		const locations = analysis.extractionResult?.locations || [];

		// Essential debug info for complex queries
		if (teamEntities.length > 0 || timeRange || locations.length > 0) {
			this.logToBoth(
				`🔍 Complex player query - Teams: ${teamEntities.join(",") || "none"}, Time: ${timeRange || "none"}, Locations: ${locations.length}`,
				null,
				"log",
			);
		}

		// Check if we have entities (player names) to query
		if (entities.length === 0) {
			return { type: "no_context", data: [], message: "No player context provided" };
		}

		// Check for "played with" or "most played with" questions
		// This check must happen BEFORE the normal player query path to prevent incorrect metric extraction
		const questionLower = (analysis.question?.toLowerCase() || "").trim();
		const isPlayedWithQuestion = 
			questionLower.includes("played with") ||
			questionLower.includes("played most") ||
			questionLower.includes("who have i played") ||
			questionLower.includes("who have you played") ||
			(questionLower.includes("who have") && questionLower.includes("played") && questionLower.includes("most")) ||
			(questionLower.includes("who has") && questionLower.includes("played") && (questionLower.includes("most") || questionLower.includes("with"))) ||
			(questionLower.includes("most") && questionLower.includes("games") && (questionLower.includes("with") || questionLower.includes("teammate")));

		this.logToBoth(`🔍 Checking for "played with" question. Question: "${questionLower}", isPlayedWithQuestion: ${isPlayedWithQuestion}`, null, "log");
		console.log(`[MOST_PLAYED_WITH] Checking detection. Question: "${questionLower}", isPlayedWithQuestion: ${isPlayedWithQuestion}, entities: ${entities.length}`);

		// If this is a "played with" question, handle it specially (even if metrics were extracted)
		if (isPlayedWithQuestion && entities.length > 0) {
			console.log(`[MOST_PLAYED_WITH] ✅ DETECTED! Using most played with query for player: ${entities[0]}`);
			this.logToBoth(`🔍 Detected "played with" question, using most played with query for player: ${entities[0]}`, null, "log");
			const playerName = entities[0];
			const resolvedPlayerName = await this.resolvePlayerName(playerName);
			
			if (!resolvedPlayerName) {
				this.logToBoth(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}
			
			this.logToBoth(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryMostPlayedWith`, null, "log");
			return await this.queryMostPlayedWith(resolvedPlayerName);
		}

		// If we have a specific player name and metrics, query their stats
		if (entities.length > 0 && metrics.length > 0) {
			const playerName = entities[0];
			const originalMetric = metrics[0] || "";

			// Normalize metric names before uppercase conversion
			let normalizedMetric = originalMetric;
			if (originalMetric === "Home Games % Won") {
				normalizedMetric = "HomeGames%Won";
			} else if (originalMetric === "Away Games % Won") {
				normalizedMetric = "AwayGames%Won";
			} else if (originalMetric === "Games % Won") {
				normalizedMetric = "Games%Won";
			}

			const metric = normalizedMetric.toUpperCase();

			// Check if this is a team-specific question
			// First check if the player name itself is a team
			if (playerName.match(/^\d+(?:st|nd|rd|th)?$/)) {
				return await this.queryTeamSpecificPlayerData(playerName, metric);
			}

			// Resolve player name with fuzzy matching
			const resolvedPlayerName = await this.resolvePlayerName(playerName);

			if (!resolvedPlayerName) {
				this.logToBoth(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
					metric,
				};
			}

			// Use resolved player name for all subsequent queries
			const actualPlayerName = resolvedPlayerName;

			// Check if there are team entities in the analysis
			if (analysis && analysis.teamEntities && analysis.teamEntities.length > 0) {
				const teamEntity = analysis.teamEntities[0];
				this.logToBoth(`🔍 Detected team entity in question: ${teamEntity}`, null, "log");
				this.logToBoth(`🔍 Will use enhanced query with team filter instead of separate team method`, null, "log");
			}

			// Check for special queries that can use enhanced relationship properties
			if (metric === "TOTW" || metric === "WEEKLY_TOTW") {
				return await this.queryPlayerTOTWData(actualPlayerName, "weekly");
			}

			if (metric === "SEASON_TOTW") {
				return await this.queryPlayerTOTWData(actualPlayerName, "season");
			}

			if (metric === "POTM" || metric === "PLAYER_OF_THE_MONTH") {
				return await this.queryPlayersOfTheMonthData(actualPlayerName);
			}

			// Check for opposition-specific queries
			if (analysis && analysis.oppositionEntities && analysis.oppositionEntities.length > 0) {
				// Opposition queries will be handled by the enhanced query builder
			}

			if (metric === "CAPTAIN" || metric === "CAPTAIN_AWARDS") {
				return await this.queryPlayerCaptainAwardsData(actualPlayerName);
			}

			if (metric === "CO_PLAYERS" || metric === "PLAYED_WITH") {
				return await this.queryPlayerCoPlayersData(actualPlayerName);
			}

			if (metric === "OPPONENTS" || metric === "PLAYED_AGAINST") {
				return await this.queryPlayerOpponentsData(actualPlayerName);
			}

			// Check if we need Fixture relationship for any filters. Optimization: Only include Fixture relationship when filtering by:
			// - Team references (1st XI, 2s, etc.)
			// - Competition types (League, cup, friendly)
			// - Competition names (Premier, Intermediate South, etc.)
			// - Opposition team names
			// - Home/away locations
			// - Results (wins, draws, losses, W, D, L)
			// - Opponent own goals
			// This improves query performance for simple appearance/stat queries that don't need Fixture data
			const needsFixture =
				teamEntities.length > 0 ||
				locations.length > 0 ||
				timeRange ||
				oppositionEntities.length > 0 ||
				metrics.includes("HOME") ||
				metrics.includes("AWAY") ||
				(analysis.competitionTypes && analysis.competitionTypes.length > 0) ||
				(analysis.competitions && analysis.competitions.length > 0) ||
				(analysis.results && analysis.results.length > 0) ||
				analysis.opponentOwnGoals === true;

			// Debug complex queries with filters
			if (needsFixture) {
				const filters = [];
				if (teamEntities.length > 0) filters.push(`Teams: ${teamEntities.join(",")}`);
				if (locations.length > 0) filters.push(`Locations: ${locations.map((l) => l.type).join(",")}`);
				if (timeRange) filters.push(`Time: ${timeRange}`);
				if (oppositionEntities.length > 0) filters.push(`Opposition: ${oppositionEntities.join(",")}`);
				if (filters.length > 0) {
					this.logToBoth(`🔍 Complex query with filters: ${filters.join(" | ")}`, null, "log");
				}
			}

			// Build the optimal query using unified architecture
			const query = this.buildPlayerQuery(actualPlayerName, metric, analysis);

			try {
				// Player existence is validated by the main query - no need for separate check
				// This eliminates one database round-trip

				// Store query for debugging
				this.lastExecutedQueries.push(`PLAYER_DATA: ${query}`);
				this.lastExecutedQueries.push(`PARAMS: ${JSON.stringify({ playerName: actualPlayerName })}`);

				// Log copyable queries for debugging
				const readyToExecuteQuery = query
					.replace(/\$playerName/g, `'${actualPlayerName}'`)
					.replace(/\$graphLabel/g, `'${neo4jService.getGraphLabel()}'`);
				this.lastExecutedQueries.push(`READY_TO_EXECUTE: ${readyToExecuteQuery}`);

				const result = await this.executeQueryWithProfiling(query, {
					playerName: actualPlayerName,
					graphLabel: neo4jService.getGraphLabel(),
				});

			// For team-specific goals queries with OPTIONAL MATCH, if result is empty, return a row with value 0
			// Also check for variations like "2nd team" or "6s" which might map to "2nd XI Goals" or "6th XI Goals"
			// Check both metric (uppercase) and originalMetric (original case) to catch all variations
			// Make patterns more flexible to handle spaces, case variations, and different formats
			const metricStr = metric && typeof metric === 'string' ? metric : '';
			const originalMetricStr = originalMetric && typeof originalMetric === 'string' ? originalMetric : '';
			
			const isTeamSpecificGoalsMetric = 
				(metricStr && (
					/^\d+sGoals?$/i.test(metricStr) || 
					/^\d+(?:st|nd|rd|th)\s+XI\s+Goals?$/i.test(metricStr) ||
					/^\d+(?:st|nd|rd|th)\s+team.*goals?/i.test(metricStr) ||
					/^\d+s.*goals?/i.test(metricStr) ||
					/^\d+(?:st|nd|rd|th)\s+XI\s+Goals?$/i.test(metricStr.replace(/\s+/g, ' '))
				)) ||
				(originalMetricStr && (
					/^\d+sGoals?$/i.test(originalMetricStr) || 
					/^\d+(?:st|nd|rd|th)\s+XI\s+Goals?$/i.test(originalMetricStr) ||
					/^\d+(?:st|nd|rd|th)\s+team.*goals?/i.test(originalMetricStr) ||
					/^\d+s.*goals?/i.test(originalMetricStr) ||
					/^\d+(?:st|nd|rd|th)\s+XI\s+Goals?$/i.test(originalMetricStr.replace(/\s+/g, ' '))
				));
			
			if ((!result || !Array.isArray(result) || result.length === 0) && isTeamSpecificGoalsMetric) {
				this.logToBoth(`⚠️ No results found for ${actualPlayerName} with metric ${metric} (original: ${originalMetric}), returning 0`, null, "warn");
				return { 
					type: "specific_player", 
					data: [{ playerName: actualPlayerName, value: 0 }], 
					playerName: actualPlayerName, 
					metric: originalMetric, 
					cypherQuery: query 
				};
			}

				if (!result || !Array.isArray(result) || result.length === 0) {
					this.logToBoth(`❌ No results found for ${actualPlayerName} with metric ${metric}`, null, "warn");
				}

				return { type: "specific_player", data: result, playerName: actualPlayerName, metric: originalMetric, cypherQuery: query };
			} catch (error) {
				this.logToBoth(`❌ Error in player query:`, error, "error");
				let errorMessage = "Error querying player data";
				if (error instanceof Error) {
					if (error.message.includes("Unknown function")) {
						errorMessage = "Generated query used an unsupported Neo4j function";
					} else {
						errorMessage = error.message;
					}
				}
				return { type: "error", data: [], error: errorMessage };
			}
		}

		// If we have player names but no metrics, return general player info
		if (entities.length > 0 && metrics.length === 0) {
			// Return general player information
			return { type: "general_player", data: entities, message: "General player query" };
		}

		this.logToBoth(`🔍 No specific player query, falling back to general player query`, null, "log");

		// Fallback to general player query
		const query = `
      MATCH (p:Player)
      WHERE p.playerName IS NOT NULL
      RETURN p.playerName as name, p.id as source
      LIMIT 50
    `;

		// Store general player query for debugging
		this.lastExecutedQueries.push(`GENERAL_PLAYERS: ${query}`);

		const result = await neo4jService.executeQuery(query);
		console.log(`🔍 General player query result:`, result);
		return { type: "general_players", data: result };
	}

	private async queryTeamData(_entities: string[], _metrics: string[]): Promise<Record<string, unknown>> {
		this.logToBoth(`🔍 queryTeamData called with entities: ${_entities}, metrics: ${_metrics}`, null, "log");

		const query = `
      MATCH (t:Team)
      RETURN t.name as name, t.id as source
			LIMIT 20
		`;

		const params = { graphLabel: neo4jService.getGraphLabel() };
		const result = await neo4jService.executeQuery(query, params);
		this.logToBoth(`🔍 Team data query result:`, result, "log");

		return { type: "team", data: result } as Record<string, unknown>;
	}

	private async queryClubData(_entities: string[], _metrics: string[]): Promise<Record<string, unknown>> {
		const query = `
      MATCH (c:Club)
      RETURN c.name as name, c.id as source
      LIMIT 10
    `;

		const result = await neo4jService.executeQuery(query);
		return result as unknown as Record<string, unknown>;
	}

	private async queryFixtureData(_entities: string[], _metrics: string[]): Promise<Record<string, unknown>> {
		const query = `
      MATCH (f:Fixture)
      RETURN f.opponent as opponent, f.date as date
      LIMIT 10
    `;

		const result = await neo4jService.executeQuery(query);
		return result as unknown as Record<string, unknown>;
	}

	private async queryDoubleGameData(entities: string[], _metrics: string[]): Promise<Record<string, unknown>> {
		if (entities.length === 0) {
			return { type: "no_context", data: [], message: "No player context provided" };
		}

		const playerName = entities[0];
		const query = `
			MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
			WHERE md.doubleGameWeek = true
			RETURN md.date as date, md.goals as goals, md.assists as assists
			ORDER BY md.date
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "double_game", data: result, playerName };
		} catch (error) {
			this.logToBoth(`❌ Error in double game query:`, error, "error");
			return { type: "error", data: [], error: "Error querying double game data" };
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
			
			// Check for "highest league finish" queries (no team name required)
			const isHighestFinishQuery = 
				question.includes("highest league finish") ||
				question.includes("best league position") ||
				question.includes("best league finish") ||
				(question.includes("highest") && question.includes("league") && question.includes("finish")) ||
				(question.includes("my") && question.includes("highest") && (question.includes("finish") || question.includes("position")));
			
			if (isHighestFinishQuery) {
				// Import league table service
				const { getHighestLeagueFinish } = await import("../services/leagueTableService");
				const bestFinish = await getHighestLeagueFinish();
				
				if (!bestFinish) {
					return {
						type: "not_found",
						data: [],
						message: "I couldn't find any historical league position data.",
					};
				}
				
				const positionSuffix = bestFinish.position === 1 ? "st" : bestFinish.position === 2 ? "nd" : bestFinish.position === 3 ? "rd" : "th";
				
				return {
					type: "league_table",
					data: [bestFinish],
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
			const { getTeamSeasonData, getCurrentSeasonDataFromNeo4j } = await import("../services/leagueTableService");

			// If season specified and not current season query, get that season's data
			if (season && !isCurrentSeasonQuery) {
				// getTeamSeasonData handles season format conversion internally
				const teamData = await getTeamSeasonData(teamName, season);
				
				if (!teamData) {
					return {
						type: "not_found",
						data: [],
						message: `I couldn't find league table data for the ${teamName} in ${season}.`,
					};
				}

				const positionSuffix = teamData.position === 1 ? "st" : teamData.position === 2 ? "nd" : teamData.position === 3 ? "rd" : "th";
				
				return {
					type: "league_table",
					data: [teamData],
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
			
			return {
				type: "league_table",
				data: [dorkiniansEntry],
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

	/**
	 * Determines if a metric needs MatchDetail join or can use Player node directly
	 */
	private metricNeedsMatchDetail(metric: string): boolean {
		// Metrics that need MatchDetail join (including complex calculations)
		const matchDetailMetrics = [
			"ALLGSC",
			"GI",
			"HOME",
			"AWAY",
			"HOMEGAMES",
			"AWAYGAMES",
			"HOMEWINS",
			"AWAYWINS",
			"HOMEGAMES%WON",
			"AWAYGAMES%WON",
			"GAMES%WON",
			"MPERG",
			"MPERCLS",
			"FTPPERAPP",
			"CPERAPP",
			"GPERAPP",
			"GK",
			"DEF",
			"MID",
			"FWD",
			"DIST",
			"MOSTSCOREDFORTEAM",
			"MOSTPLAYEDFORTEAM",
			"FTP",
			"POINTS",
			"FANTASYPOINTS",
		];

		// Check if it's a team-specific appearance metric (1sApps, 2sApps, etc.)
		if (metric.match(/^\d+sApps$/i)) {
			return true; // Team-specific appearances need MatchDetail join to filter by team
		}

		// Check if it's a team-specific appearance metric (1st XI Apps, 2nd XI Apps, etc.)
		if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i)) {
			return true; // Team-specific appearances need MatchDetail join to filter by team
		}

		// Check if it's a team-specific goals metric (1sGoals, 2sGoals, etc.)
		if (metric.match(/^\d+sGoals$/i)) {
			return true; // Team-specific goals need MatchDetail join to filter by team
		}

		// Check if it's a team-specific goals metric (1st XI Goals, 2nd XI Goals, etc.)
		if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i)) {
			return true; // Team-specific goals need MatchDetail join to filter by team
		}

		// Check if it's a seasonal metric (contains year pattern) - these use MatchDetail joins
		if (metric.match(/\d{4}\/\d{2}(GOALS|APPS|ASSISTS|CLEANSHEETS|SAVES|YELLOWCARDS|REDCARDS|MOM|PENALTIESSCORED|PENALTIESMISSED|PENALTIESSAVED|PENALTIESTAKEN|PENALTIESCONCEDED|OWngoals|CONCEDED|FANTASYPOINTS|DISTANCE)/i)) {
			return true; // Seasonal metrics use MatchDetail joins for accurate data
		}

		// Special case metrics that need MatchDetail joins
		const metricUpper = metric.toUpperCase();
		if (metricUpper === "NUMBERSEASONSPLAYEDFOR" || metricUpper === "NUMBERTEAMSPLAYEDFOR") {
			return true; // These need MatchDetail to count distinct seasons/teams
		}

		return matchDetailMetrics.includes(metric.toUpperCase());
	}

	/**
	 * Gets the return clause for Player node queries
	 */
	private getPlayerNodeReturnClause(metric: string): string {
		switch (metric.toUpperCase()) {
			case "MIN":
				return "coalesce(p.minutes, 0)";
			case "MOM":
				return "coalesce(p.mom, 0)";
			case "G":
				return "coalesce(p.allGoalsScored, 0)";
			case "OPENPLAYGOALS":
				return "coalesce(p.goals, 0)";
			case "A":
				return "coalesce(p.assists, 0)";
			case "Y":
				return "coalesce(p.yellowCards, 0)";
			case "R":
				return "coalesce(p.redCards, 0)";
			case "SAVES":
				return "coalesce(p.saves, 0)";
			case "OG":
				return "coalesce(p.ownGoals, 0)";
			case "C":
				return "coalesce(p.conceded, 0)";
			case "CLS":
				return "coalesce(p.cleanSheets, 0)";
			case "PSC":
				return "coalesce(p.penaltiesScored, 0)";
			case "PM":
				return "coalesce(p.penaltiesMissed, 0)";
			case "PCO":
				return "coalesce(p.penaltiesConceded, 0)";
			case "PSV":
				return "coalesce(p.penaltiesSaved, 0)";
			case "DIST":
				return "coalesce(p.distance, 0)";
			case "GK":
				return "coalesce(p.gk, 0)";
			case "DEF":
				return "coalesce(p.def, 0)";
			case "MID":
				return "coalesce(p.mid, 0)";
			case "FWD":
				return "coalesce(p.fwd, 0)";
			case "APP":
				return "coalesce(p.appearances, 0)";
			case "MOSTPROLIFICSEASON":
				return "p.mostProlificSeason";
			// Seasonal metrics - dynamic handling
			default:
				// Check if it's a seasonal metric (contains year pattern)
				if (metric.match(/\d{4}\/\d{2}(GOALS|APPS)/i)) {
					const seasonMatch = metric.match(/(\d{4}\/\d{2})(GOALS|APPS)/i);
					if (seasonMatch) {
						const season = seasonMatch[1];
						const type = seasonMatch[2];
						// Convert season format from 2017/18 to 201718 for database property names
						const dbSeason = season.replace("/", "");
						const playerField = `${type.toLowerCase()}${dbSeason}`;
						return `coalesce(p.${playerField}, 0)`;
					}
				}
				// Complex calculation metrics (MostCommonPosition, MPERG, MPERCLS, FTPPERAPP, GPERAPP, CPERAPP) are handled by custom queries in buildPlayerQuery and don't need return clauses here
				return "0";
		}
	}

	/**
	 * Gets the return clause for MatchDetail join queries
	 */
	private getMatchDetailReturnClause(metric: string): string {
		switch (metric.toUpperCase()) {
			case "APP":
				return "count(md) as value";
			case "G":
				return `
				coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
				coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as value`;
			case "OPENPLAYGOALS":
				return `
				coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) as value`;
			case "ALLGSC":
				return `
				coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
				coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as value`;
			case "GI":
				return `
				coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
				coalesce(sum(CASE WHEN md.assists IS NULL OR md.assists = "" THEN 0 ELSE md.assists END), 0) as value`;
			case "HOME":
				return "count(DISTINCT md) as value";
			case "AWAY":
				return "count(DISTINCT md) as value";
			case "HOMEGAMES":
				return "count(DISTINCT md) as value";
			case "AWAYGAMES":
				return "count(DISTINCT md) as value";
			case "HOMEWINS":
				return "sum(CASE WHEN toUpper(coalesce(f.result, '')) IN ['W', 'WIN'] OR (f.fullResult IS NOT NULL AND toUpper(f.fullResult) STARTS WITH 'W') THEN 1 ELSE 0 END) as value";
			case "AWAYWINS":
				return "sum(CASE WHEN toUpper(coalesce(f.result, '')) IN ['W', 'WIN'] OR (f.fullResult IS NOT NULL AND toUpper(f.fullResult) STARTS WITH 'W') THEN 1 ELSE 0 END) as value";
			case "GK":
				return "coalesce(count(md), 0) as value";
			case "DEF":
				return "coalesce(count(md), 0) as value";
			case "MID":
				return "coalesce(count(md), 0) as value";
			case "FWD":
				return "coalesce(count(md), 0) as value";
			case "DIST":
				return "coalesce(sum(md.distance), 0) as value";
			case "FTP":
			case "POINTS":
			case "FANTASYPOINTS":
				return "coalesce(sum(CASE WHEN md.fantasyPoints IS NULL OR md.fantasyPoints = '' THEN 0 ELSE md.fantasyPoints END), 0) as value";
			// Team-specific appearance metrics (1sApps, 2sApps, etc.)
			default:
				// Check if it's a team-specific appearance metric
				if (metric.match(/^\d+sApps$/i)) {
					return "count(md) as value";
				}

				// Check if it's a team-specific appearance metric (1st XI Apps, 2nd XI Apps, etc.)
				if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i)) {
					return "count(md) as value";
				}

				// Check if it's a team-specific goals metric (1sGoals, 2sGoals, etc.)
				if (metric.match(/^\d+sGoals$/i)) {
					return `
					coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
					coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as value`;
				}

				// Check if it's a team-specific goals metric (1st XI Goals, 2nd XI Goals, etc.)
				if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i)) {
					return `
					coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
					coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as value`;
				}
			// Season-specific goals
			// Dynamic seasonal metrics (any season)
				// Check if it's a seasonal goals metric
				if (metric.match(/\d{4}\/\d{2}GOALS/i)) {
					const seasonMatch = metric.match(/(\d{4}\/\d{2})GOALS/i);
					if (seasonMatch) {
						const season = seasonMatch[1];
						return `coalesce(sum(CASE WHEN f.season = "${season}" AND (md.goals IS NOT NULL AND md.goals <> "") THEN md.goals ELSE 0 END), 0) + 
						coalesce(sum(CASE WHEN f.season = "${season}" AND (md.penaltiesScored IS NOT NULL AND md.penaltiesScored <> "") THEN md.penaltiesScored ELSE 0 END), 0) as value`;
					}
				}

				// Check if it's a seasonal assists metric
				if (metric.match(/\d{4}\/\d{2}ASSISTS/i)) {
					const seasonMatch = metric.match(/(\d{4}\/\d{2})ASSISTS/i);
					if (seasonMatch) {
						const season = seasonMatch[1];
						return `coalesce(sum(CASE WHEN f.season = "${season}" AND (md.assists IS NOT NULL AND md.assists <> "") THEN md.assists ELSE 0 END), 0) as value`;
					}
				}

				// Check if it's a seasonal clean sheets metric
				if (metric.match(/\d{4}\/\d{2}CLEANSHEETS/i)) {
					const seasonMatch = metric.match(/(\d{4}\/\d{2})CLEANSHEETS/i);
					if (seasonMatch) {
						const season = seasonMatch[1];
						return `coalesce(sum(CASE WHEN f.season = "${season}" AND (md.cleanSheets IS NOT NULL AND md.cleanSheets <> "") THEN md.cleanSheets ELSE 0 END), 0) as value`;
					}
				}

				// Check if it's a seasonal saves metric
				if (metric.match(/\d{4}\/\d{2}SAVES/i)) {
					const seasonMatch = metric.match(/(\d{4}\/\d{2})SAVES/i);
					if (seasonMatch) {
						const season = seasonMatch[1];
						return `coalesce(sum(CASE WHEN f.season = "${season}" AND (md.saves IS NOT NULL AND md.saves <> "") THEN md.saves ELSE 0 END), 0) as value`;
					}
				}

				// Check if it's a seasonal appearances metric
				if (metric.match(/\d{4}\/\d{2}APPS/i)) {
					const seasonMatch = metric.match(/(\d{4}\/\d{2})APPS/i);
					if (seasonMatch) {
						const season = seasonMatch[1];
						return `coalesce(count(CASE WHEN f.season = "${season}" THEN 1 END), 0) as value`;
					}
				}
				break;
		}

		// Default fallback for unrecognized metrics
		return "0 as value";
	}

	/**
	 * Build query for "each season" or "per season" questions
	 * Returns data grouped by season for any metric
	 */
	private buildPerSeasonQuery(_playerName: string, metric: string, analysis: EnhancedQuestionAnalysis): string {
		// Get the return clause for the metric
		const returnClause = this.getMatchDetailReturnClause(metric);
		
		// Extract the aggregation part (everything before "as value")
		const aggregationMatch = returnClause.match(/^(.+?)\s+as\s+value$/i);
		if (!aggregationMatch) {
			// Fallback if we can't parse it
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.season IS NOT NULL AND f.season <> ""
				WITH p, f.season as season, count(md) as value
				ORDER BY season ASC
				RETURN p.playerName as playerName, season, value
			`;
		}
		
		const aggregation = aggregationMatch[1];
		
		// Build query that groups by season
		return `
			MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
			MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
			WHERE f.season IS NOT NULL AND f.season <> ""
			WITH p, f.season as season, ${aggregation} as value
			ORDER BY season ASC
			RETURN p.playerName as playerName, season, value
		`;
	}

	/**
	 * Builds the optimal query for player data using unified architecture
	 */
	private buildPlayerQuery(_playerName: string, metric: string, analysis: EnhancedQuestionAnalysis): string {
		// Check for "each season" pattern first
		const questionLower = analysis.question?.toLowerCase() || "";
		if (questionLower.includes("each season") || questionLower.includes("per season") || questionLower.includes("every season")) {
			return this.buildPerSeasonQuery(_playerName, metric, analysis);
		}
		
		// Handle special case queries first (these have custom query structures)
		const specialCaseQuery = this.buildSpecialCaseQuery(_playerName, metric, analysis);
		if (specialCaseQuery) {
			return specialCaseQuery;
		}

		// Determine query structure requirements
		const teamEntities = analysis.teamEntities || [];
		const oppositionEntities = analysis.oppositionEntities || [];
		const timeRange = analysis.timeRange;
		const locations = analysis.extractionResult?.locations || [];
		const needsMatchDetail = this.metricNeedsMatchDetail(metric);
		const isTeamSpecificMetric = !!(metric.match(/^\d+sApps$/i) || 
			metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i) ||
			metric.match(/^\d+sGoals$/i) ||
			metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i));
		const metricUpper = metric.toUpperCase();
		const isPositionMetric = ["GK", "DEF", "MID", "FWD"].includes(metricUpper);
		const fixtureDependentMetrics = new Set([
			"HOME",
			"AWAY",
			"HOMEGAMES",
			"AWAYGAMES",
			"HOMEWINS",
			"AWAYWINS",
			"HOMEGAMES%WON",
			"AWAYGAMES%WON",
			"GAMES%WON",
		]);
		const isSeasonalMetric = metric.match(/\d{4}\/\d{2}(GOALS|APPS|ASSISTS|CLEANSHEETS|SAVES|YELLOWCARDS|REDCARDS|MOM|PENALTIESSCORED|PENALTIESMISSED|PENALTIESSAVED|PENALTIESTAKEN|PENALTIESCONCEDED|OWNGOALS|CONCEDED|FANTASYPOINTS|DISTANCE)/i) !== null;

		// For team-specific metrics (appearances/goals for specific teams), we don't need fixtures
		// Team filtering is done on md.team property, not f.team
		let needsFixture = isTeamSpecificMetric ? false :
			(teamEntities.length > 0) ||
			(locations.length > 0 && !fixtureDependentMetrics.has(metricUpper)) ||
			timeRange ||
			oppositionEntities.length > 0 ||
			fixtureDependentMetrics.has(metricUpper) ||
			(analysis.competitionTypes && analysis.competitionTypes.length > 0) ||
			(analysis.competitions && analysis.competitions.length > 0) ||
			(analysis.results && analysis.results.length > 0) ||
			analysis.opponentOwnGoals === true;
		if (!needsFixture && isSeasonalMetric) {
			needsFixture = true;
		}

		// Build base query structure
		let query: string;
		
		if (!needsMatchDetail) {
			// Use direct Player node query (no MatchDetail join needed)
			query = `
				MATCH (p:Player {playerName: $playerName})
				RETURN p.playerName as playerName, ${this.getPlayerNodeReturnClause(metric)} as value
			`;
		} else {
			// Use MatchDetail join query with simplified path pattern
			if (needsFixture) {
				// Use explicit path pattern to ensure we only count the player's own MatchDetail records
				query = `
					MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
					MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				`;
			} else {
				// Use simple MatchDetail query for queries that don't need fixture data
				// For team-specific or position metrics, use OPTIONAL MATCH to ensure we always return a row
				if (isTeamSpecificMetric || isPositionMetric) {
					query = `
						MATCH (p:Player {playerName: $playerName})
						OPTIONAL MATCH (p)-[:PLAYED_IN]->(md:MatchDetail)
					`;
				} else {
					query = `
						MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
					`;
				}
			}

			// Build WHERE conditions using helper method (pre-computed and optimized)
			let whereConditions = this.buildWhereConditions(metric, analysis, isTeamSpecificMetric, teamEntities, oppositionEntities, timeRange, locations);

			// For team-specific appearances with OPTIONAL MATCH, remove team filter from WHERE conditions
			// (we'll filter in WITH clause instead to ensure we always return a row)
			let teamNameForWithClause = "";
			if ((isTeamSpecificMetric || isPositionMetric) && (metric.match(/^\d+sApps$/i) || metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i))) {
				if (metric.match(/^\d+sApps$/i)) {
					const teamNumber = metric.match(/^(\d+)sApps$/i)?.[1];
					if (teamNumber) {
						teamNameForWithClause = this.mapTeamName(`${teamNumber}s`);
					}
				} else if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i)) {
					const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Apps$/i);
					if (teamMatch) {
						teamNameForWithClause = teamMatch[1] + " XI";
					}
				}
				
				if (teamNameForWithClause) {
					// Remove team filter from WHERE conditions
					const teamFilterPattern = new RegExp(`toUpper\\(md\\.team\\)\\s*=\\s*toUpper\\('${teamNameForWithClause.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\)`, 'i');
					whereConditions = whereConditions.filter(condition => !teamFilterPattern.test(condition));
				}
			}

			// Add WHERE clause if we have conditions
			// Optimize condition order: put most selective conditions first
			if (whereConditions.length > 0) {
				const optimizedConditions = this.optimizeWhereConditionOrder(whereConditions);
				query += ` WHERE ${optimizedConditions.join(" AND ")}`;
			}

			// For team-specific metrics with OPTIONAL MATCH, we need to filter by team in the WHERE clause or WITH clause
			if (isTeamSpecificMetric && (metric.match(/^\d+sGoals$/i) || metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i))) {
				// Extract team name for filtering
				let teamName = "";
				if (metric.match(/^\d+sGoals$/i)) {
					const teamNumber = metric.match(/^(\d+)sGoals$/i)?.[1];
					if (teamNumber) {
						teamName = this.mapTeamName(`${teamNumber}s`);
					}
				} else if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i)) {
					const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Goals$/i);
					if (teamMatch) {
						teamName = teamMatch[1] + " XI";
					}
				}
				
				if (teamName) {
					// Use WITH clause to aggregate and filter by team
					// Ensure we always return a row even when there are no MatchDetail records
					// The key is to use OPTIONAL MATCH and then aggregate, which will always return a row
					query += ` WITH p, collect(md) as matchDetails`;
					query += ` WITH p, CASE WHEN size(matchDetails) = 0 OR matchDetails[0] IS NULL THEN [] ELSE [md IN matchDetails WHERE md IS NOT NULL AND toUpper(md.team) = toUpper('${teamName}')] END as filteredDetails`;
					query += ` WITH p, CASE WHEN size(filteredDetails) = 0 THEN 0 ELSE reduce(total = 0, md IN filteredDetails | total + CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END + CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END) END as totalGoals`;
					query += ` RETURN p.playerName as playerName, totalGoals as value`;
				} else {
					query += ` RETURN p.playerName as playerName, ${this.getMatchDetailReturnClause(metric)}`;
				}
			} else if (isTeamSpecificMetric && (metric.match(/^\d+sApps$/i) || metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i))) {
				if (teamNameForWithClause) {
					// Use WITH clause to aggregate and filter by team
					// Ensure we always return a row even when there are no MatchDetail records
					query += ` WITH p, collect(md) as matchDetails`;
					query += ` WITH p, CASE WHEN size(matchDetails) = 0 OR matchDetails[0] IS NULL THEN [] ELSE [md IN matchDetails WHERE md IS NOT NULL AND toUpper(md.team) = toUpper('${teamNameForWithClause}')] END as filteredDetails`;
					query += ` WITH p, size(filteredDetails) as appearanceCount`;
					query += ` RETURN p.playerName as playerName, appearanceCount as value`;
				} else {
					query += ` RETURN p.playerName as playerName, ${this.getMatchDetailReturnClause(metric)}`;
				}
			} else {
				// Add return clause
				query += ` RETURN p.playerName as playerName, ${this.getMatchDetailReturnClause(metric)}`;
			}
		}

		// Return the built query
		return query;
	}

	/**
	 * Build special case queries that need custom query structures
	 */
	private buildSpecialCaseQuery(_playerName: string, metric: string, analysis: EnhancedQuestionAnalysis): string | null {
		if (metric === "MOSTCOMMONPOSITION" || metric === "MostCommonPosition") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WHERE md.class IS NOT NULL AND md.class <> ""
				WITH p, md.class as position, count(md) as positionCount
				WITH p, position, positionCount,
					CASE 
						WHEN position = 'GK' THEN 1
						WHEN position = 'DEF' THEN 2
						WHEN position = 'MID' THEN 3
						WHEN position = 'FWD' THEN 4
						ELSE 5
					END as priority
				ORDER BY positionCount DESC, priority ASC
				LIMIT 1
				RETURN p.playerName as playerName, position as value
			`;
		} else if (metric.toUpperCase() === "MPERG" || metric === "MperG") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.minutes, 0)) as totalMinutes,
					sum(coalesce(md.goals, 0)) + sum(coalesce(md.penaltiesScored, 0)) as totalGoals
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalGoals > 0 THEN round(100.0 * totalMinutes / totalGoals) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "MPERCLS" || metric === "MperCLS") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				OPTIONAL MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md)
				WITH p,
					sum(coalesce(md.minutes, 0)) as totalMinutes,
					sum(
						CASE 
							WHEN md.cleanSheets IS NOT NULL AND md.cleanSheets <> "" THEN coalesce(md.cleanSheets, 0)
							WHEN f IS NOT NULL AND coalesce(f.conceded, 0) = 0 THEN 1
							ELSE 0
						END
					) as matchDerivedCleanSheets,
					coalesce(p.cleanSheets, 0) as playerCleanSheets
				WITH p, totalMinutes,
					CASE 
						WHEN matchDerivedCleanSheets > 0 THEN matchDerivedCleanSheets
						WHEN playerCleanSheets > 0 THEN playerCleanSheets
						ELSE 0
					END as totalCleanSheets
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalCleanSheets > 0 THEN toInteger(round(toFloat(totalMinutes) / toFloat(totalCleanSheets)))
						ELSE 0 
					END as value
			`;
		} else if (metric.toUpperCase() === "FTPPERAPP" || metric === "FTPperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.fantasyPoints, 0)) as totalFantasyPoints,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalFantasyPoints / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "CPERAPP" || metric === "CperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(f.conceded, 0)) as totalConceded,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(10.0 * totalConceded / totalAppearances) / 10.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "GPERAPP" || metric === "GperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.goals, 0)) + sum(coalesce(md.penaltiesScored, 0)) as totalGoals,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(10.0 * totalGoals / totalAppearances) / 10.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "MINPERAPP" || metric === "MINperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.minutes, 0)) as totalMinutes,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalMinutes / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "MOMPERAPP" || metric === "MOMperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.mom, 0)) as totalMOM,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalMOM / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "YPERAPP" || metric === "YperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.yellowCards, 0)) as totalYellowCards,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalYellowCards / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "RPERAPP" || metric === "RperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.redCards, 0)) as totalRedCards,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalRedCards / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "SAVESPERAPP" || metric === "SAVESperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.saves, 0)) as totalSaves,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalSaves / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "OGPERAPP" || metric === "OGperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.ownGoals, 0)) as totalOwnGoals,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalOwnGoals / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "CLSPERAPP" || metric === "CLSperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WITH p, 
					sum(CASE WHEN coalesce(f.conceded, 0) = 0 THEN 1 ELSE 0 END) as totalCleanSheets,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalCleanSheets / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "PSCPERAPP" || metric === "PSCperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.penaltiesScored, 0)) as totalPenaltiesScored,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalPenaltiesScored / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "PMPERAPP" || metric === "PMperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.penaltiesMissed, 0)) as totalPenaltiesMissed,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalPenaltiesMissed / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "PCOPERAPP" || metric === "PCOperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.penaltiesConceded, 0)) as totalPenaltiesConceded,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalPenaltiesConceded / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "PSVPERAPP" || metric === "PSVperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.penaltiesSaved, 0)) as totalPenaltiesSaved,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalPenaltiesSaved / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "HOMEGAMES%WON") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.homeOrAway = 'Home'
				WITH p, 
					sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as homeWins,
					count(md) as homeGames
				RETURN p.playerName as playerName, 
					CASE 
						WHEN homeGames > 0 THEN 100.0 * homeWins / homeGames
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "AWAYGAMES%WON") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.homeOrAway = 'Away'
				WITH p, 
					sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as awayWins,
					count(md) as awayGames
				RETURN p.playerName as playerName, 
					CASE 
						WHEN awayGames > 0 THEN 100.0 * awayWins / awayGames
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "GAMES%WON") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WITH p, 
					sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as totalWins,
					count(md) as totalGames
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalGames > 0 THEN 100.0 * totalWins / totalGames
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "MOSTPROLIFICSEASON") {
			// Query MatchDetails to get goals per season for chart display
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.season IS NOT NULL AND f.season <> ""
				WITH p, f.season as season, 
					sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END) + 
					sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END) as goals
				ORDER BY season ASC
				RETURN p.playerName as playerName, season, goals as value
			`;
		} else if (metric === "MostPlayedForTeam" || metric === "MOSTPLAYEDFORTEAM" || metric === "TEAM_ANALYSIS") {
			if (this.isTeamCountQuestion(analysis.question)) {
				return `
					MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
					WHERE md.team IS NOT NULL AND md.team <> "Fun XI"
					WITH p, collect(DISTINCT md.team) as teams
					RETURN p.playerName as playerName, size(teams) as value
				`;
			} else {
				// Query for most played for team
				return `
					MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
					WHERE md.team IS NOT NULL
					WITH p, md.team as team, count(md) as appearances, 
						sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END) + 
						sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END) as goals
					WITH p, team, appearances, goals,
						CASE 
							WHEN team = "1st XI" THEN 1
							WHEN team = "2nd XI" THEN 2
							WHEN team = "3rd XI" THEN 3
							WHEN team = "4th XI" THEN 4
							WHEN team = "5th XI" THEN 5
							WHEN team = "6th XI" THEN 6
							WHEN team = "7th XI" THEN 7
							WHEN team = "8th XI" THEN 8
							ELSE 9
						END as teamOrder
					ORDER BY appearances DESC, teamOrder ASC
					LIMIT 1
					RETURN p.playerName as playerName, team as value
				`;
			}
		} else if (metric === "NUMBERTEAMSPLAYEDFOR" || metric === "NumberTeamsPlayedFor") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WHERE md.team IS NOT NULL AND md.team <> "Fun XI"
				WITH p, collect(DISTINCT md.team) as teams
				RETURN p.playerName as playerName, size(teams) as value
			`;
		} else if (metric.toUpperCase() === "NUMBERSEASONSPLAYEDFOR" || metric === "NumberSeasonsPlayedFor" || metric.toUpperCase().includes("NUMBERSEASONSPLAYEDFOR")) {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WHERE md.season IS NOT NULL AND md.season <> ""
				WITH p, collect(DISTINCT md.season) as playerSeasons
				MATCH (allFixtures:Fixture {graphLabel: $graphLabel})
				WHERE allFixtures.season IS NOT NULL AND allFixtures.season <> ""
				WITH p, size(playerSeasons) as playerSeasonCount, collect(DISTINCT allFixtures.season) as allSeasons
				RETURN p.playerName as playerName,
				       playerSeasonCount,
				       size(allSeasons) as totalSeasonCount
			`;
		} else if (metric === "SEASON_ANALYSIS") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.season IS NOT NULL
				WITH p, collect(DISTINCT f.season) as seasons
				RETURN p.playerName as playerName, size(seasons) as value
			`;
		} else if (metric === "SEASON_COUNT_WITH_TOTAL") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.season IS NOT NULL
				WITH p, collect(DISTINCT f.season) as playerSeasons
				MATCH (f2:Fixture {graphLabel: $graphLabel})
				WHERE f2.season IS NOT NULL
				WITH p, playerSeasons, collect(DISTINCT f2.season) as allSeasons
				WITH p, playerSeasons, allSeasons, size(playerSeasons) as playerSeasonCount, size(allSeasons) as totalSeasonCount
				UNWIND playerSeasons as season
				WITH p, playerSeasonCount, totalSeasonCount, season
				ORDER BY season
				WITH p, playerSeasonCount, totalSeasonCount, collect(season)[0] as firstSeason
				RETURN p.playerName as playerName, 
				       playerSeasonCount,
				       totalSeasonCount,
				       firstSeason
			`;
		} else if (metric === "SEASON_COUNT_SIMPLE") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.season IS NOT NULL
				WITH p, collect(DISTINCT f.season) as seasons
				WITH p, seasons, size(seasons) as seasonCount
				UNWIND seasons as season
				WITH p, seasonCount, season
				ORDER BY season
				WITH p, seasonCount, collect(season)[0] as firstSeason
				RETURN p.playerName as playerName, 
				       seasonCount as value,
				       firstSeason
			`;
		} else if (metric.toUpperCase() === "MOSTSCOREDFORTEAM" || metric === "MostScoredForTeam") {
			// Query for team with most of a specific stat (goals, assists, yellow cards, etc.)
			// Determine which stat to aggregate based on extracted metrics
			const statMetrics = analysis.metrics || [];
			let statField = "goals"; // Default to goals
			let statDisplayName = "goals";
			const questionLower = analysis.question?.toLowerCase() || "";
			
			// Map metric keys to MatchDetail property names
			const statFieldMap: Record<string, { field: string; displayName: string }> = {
				"G": { field: "goals", displayName: "goals" },
				"A": { field: "assists", displayName: "assists" },
				"Y": { field: "yellowCards", displayName: "yellow cards" },
				"R": { field: "redCards", displayName: "red cards" },
				"SAVES": { field: "saves", displayName: "saves" },
				"OG": { field: "ownGoals", displayName: "own goals" },
				"C": { field: "conceded", displayName: "goals conceded" },
				"CLS": { field: "cleanSheets", displayName: "clean sheets" },
				"PSC": { field: "penaltiesScored", displayName: "penalties scored" },
				"PM": { field: "penaltiesMissed", displayName: "penalties missed" },
				"PCO": { field: "penaltiesConceded", displayName: "penalties conceded" },
				"PSV": { field: "penaltiesSaved", displayName: "penalties saved" },
				"goals": { field: "goals", displayName: "goals" },
				"assists": { field: "assists", displayName: "assists" },
				"yellow cards": { field: "yellowCards", displayName: "yellow cards" },
				"red cards": { field: "redCards", displayName: "red cards" },
			};
			
			// Find the stat type from extracted metrics
			for (const extractedMetric of statMetrics) {
				const upperMetric = extractedMetric.toUpperCase();
				if (statFieldMap[upperMetric]) {
					statField = statFieldMap[upperMetric].field;
					statDisplayName = statFieldMap[upperMetric].displayName;
					break;
				}
				// Also check for case-insensitive partial matches
				for (const [key, value] of Object.entries(statFieldMap)) {
					if (extractedMetric.toLowerCase().includes(key.toLowerCase()) || 
					    key.toLowerCase().includes(extractedMetric.toLowerCase())) {
						statField = value.field;
						statDisplayName = value.displayName;
						break;
					}
				}
			}
			
			const mentionsGoals = questionLower.includes("goal") || questionLower.includes("scor");
			const mentionsAssists = questionLower.includes("assist");
			if (mentionsGoals && !mentionsAssists) {
				statField = "goals";
				statDisplayName = "goals";
			}

			// Store the stat field and display name in analysis for response generation
			(analysis as any).mostScoredForTeamStatField = statField;
			(analysis as any).mostScoredForTeamStatDisplayName = statDisplayName;

			const statAggregationExpression =
				statField === "goals"
					? `sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END) + sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END)`
					: `sum(CASE WHEN md.${statField} IS NULL OR md.${statField} = "" THEN 0 ELSE md.${statField} END)`;
			
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WHERE md.team IS NOT NULL AND md.team <> "Fun XI"
				WITH p, md.team as team, ${statAggregationExpression} as statValue
				WITH p, team, statValue,
					CASE 
						WHEN team = "1st XI" THEN 1
						WHEN team = "2nd XI" THEN 2
						WHEN team = "3rd XI" THEN 3
						WHEN team = "4th XI" THEN 4
						WHEN team = "5th XI" THEN 5
						WHEN team = "6th XI" THEN 6
						WHEN team = "7th XI" THEN 7
						WHEN team = "8th XI" THEN 8
						ELSE 9
					END as teamOrder
				ORDER BY statValue DESC, teamOrder ASC
				LIMIT 1
				RETURN p.playerName as playerName, team as value, statValue as goalCount
			`;
		}

		return null;
	}

	/**
	 * Build WHERE conditions for query filters
	 */
	private buildWhereConditions(
		metric: string,
		analysis: EnhancedQuestionAnalysis,
		isTeamSpecificMetric: boolean,
		teamEntities: string[],
		oppositionEntities: string[],
		timeRange: string | undefined,
		locations: Array<{ type: string; value: string }>,
	): string[] {
		const whereConditions: string[] = [];
		const metricUpper = metric.toUpperCase();
		const questionLower = (analysis.question || "").toLowerCase();
		const explicitLocationKeywords = [
			"home",
			"at home",
			"home game",
			"home match",
			"away",
			"away game",
			"away match",
			"away from home",
			"on the road",
			"their ground",
			"our ground",
			"pixham",
		];
		const hasExplicitLocation = explicitLocationKeywords.some((keyword) => questionLower.includes(keyword));

		// Add team filter if specified (but skip if we have a team-specific metric - those use md.team instead)
		if (teamEntities.length > 0 && !isTeamSpecificMetric) {
			const mappedTeamNames = teamEntities.map((team) => this.mapTeamName(team));
			const teamNames = mappedTeamNames.map((team) => `toUpper('${team}')`).join(", ");
			whereConditions.push(`toUpper(f.team) IN [${teamNames}]`);
		}

		// Add team-specific appearance filter if metric is team-specific (1sApps, 2sApps, etc.)
		if (metric.match(/^\d+sApps$/i)) {
			const teamNumber = metric.match(/^(\d+)sApps$/i)?.[1];
			if (teamNumber) {
				const teamName = this.mapTeamName(`${teamNumber}s`);
				whereConditions.push(`toUpper(md.team) = toUpper('${teamName}')`);
			}
		}

		// Add team-specific appearance filter if metric is team-specific (1st XI Apps, 2nd XI Apps, etc.)
		if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i)) {
			const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Apps$/i);
			if (teamMatch) {
				const teamName = teamMatch[1] + " XI";
				whereConditions.push(`toUpper(md.team) = toUpper('${teamName}')`);
			}
		}

		// Add team-specific goals filter if metric is team-specific (1sGoals, 2sGoals, etc.)
		if (metric.match(/^\d+sGoals$/i)) {
			const teamNumber = metric.match(/^(\d+)sGoals$/i)?.[1];
			if (teamNumber) {
				const teamName = this.mapTeamName(`${teamNumber}s`);
				if (!isTeamSpecificMetric) {
					whereConditions.push(`toUpper(md.team) = toUpper('${teamName}')`);
				}
			}
		}

		// Add team-specific goals filter if metric is team-specific (1st XI Goals, 2nd XI Goals, etc.)
		if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i)) {
			const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Goals$/i);
			if (teamMatch) {
				const teamName = teamMatch[1] + " XI";
				if (!isTeamSpecificMetric) {
					whereConditions.push(`toUpper(md.team) = toUpper('${teamName}')`);
				}
			}
		}

		const metricHandlesLocation = ["HOME", "AWAY", "HOMEGAMES", "AWAYGAMES", "HOMEWINS", "AWAYWINS"].includes(metricUpper);
		
		// Check if metric is team-specific appearance or goals metric (used in multiple places)
		const isTeamSpecificAppearanceOrGoals = !!(metric.match(/^\d+sApps$/i) || 
			metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i) ||
			metric.match(/^\d+sGoals$/i) ||
			metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i));

		// CRITICAL: Never add location filters for team-specific metrics, even if Home/Away was incorrectly detected
		// This prevents issues where "how" was incorrectly matched to "Home" stat type
		if (!isTeamSpecificMetric && !isTeamSpecificAppearanceOrGoals) {
			// Add location filter if specified (only if not already handled by metric)
			if (locations.length > 0 && hasExplicitLocation && !metricHandlesLocation) {
				const locationFilters = locations
					.map((loc) => {
						if (loc.type === "home") return `f.homeOrAway = 'Home'`;
						if (loc.type === "away") return `f.homeOrAway = 'Away'`;
						return null;
					})
					.filter(Boolean);
				if (locationFilters.length > 0) {
					whereConditions.push(`(${locationFilters.join(" OR ")})`);
				}
			}
		}

		if (metricUpper === "HOMEWINS") {
			whereConditions.push(`f.homeOrAway = 'Home'`);
		} else if (metricUpper === "AWAYWINS") {
			whereConditions.push(`f.homeOrAway = 'Away'`);
		}

		// Note: We don't filter for wins in WHERE clause for HomeWins/AwayWins queries
		// Instead, we count wins in the aggregation to distinguish between:
		// - Player has no games (query returns empty)
		// - Player has games but 0 wins (query returns value=0)

		// Add opposition filter if specified (but not for team-specific metrics - they don't need Fixture)
		if (oppositionEntities.length > 0 && !isTeamSpecificMetric) {
			const oppositionName = oppositionEntities[0];
			whereConditions.push(`f.opposition = '${oppositionName}'`);
		}

		// Add time range filter if specified (but not for team-specific metrics - they don't need Fixture)
		if (timeRange && !isTeamSpecificMetric) {
			const dateRange = timeRange.split(" to ");
			if (dateRange.length === 2) {
				const startDate = this.convertDateFormat(dateRange[0].trim());
				const endDate = this.convertDateFormat(dateRange[1].trim());
				whereConditions.push(`f.date >= '${startDate}' AND f.date <= '${endDate}'`);
			}
		}

		// Add competition type filter if specified (but not for team-specific metrics - they don't need Fixture)
		if (analysis.competitionTypes && analysis.competitionTypes.length > 0 && !isTeamSpecificMetric) {
			const compTypeFilters = analysis.competitionTypes
				.map((compType) => {
					switch (compType.toLowerCase()) {
						case "league":
							return `f.compType = 'League'`;
						case "cup":
							return `f.compType = 'Cup'`;
						case "friendly":
							return `f.compType = 'Friendly'`;
						default:
							return null;
					}
				})
				.filter(Boolean);
			if (compTypeFilters.length > 0) {
				whereConditions.push(`(${compTypeFilters.join(" OR ")})`);
			}
		}

		// Add competition filter if specified (but not for team-specific appearance or goals queries)
		if (analysis.competitions && analysis.competitions.length > 0 && 
			!metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i) && 
			!metric.match(/^\d+sApps$/i) &&
			!metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i) &&
			!metric.match(/^\d+sGoals$/i)) {
			const competitionFilters = analysis.competitions.map((comp) => `f.competition CONTAINS '${comp}'`);
			whereConditions.push(`(${competitionFilters.join(" OR ")})`);
		}

		// Add result filter if specified (but not for team-specific metrics - they don't need Fixture)
		if (analysis.results && analysis.results.length > 0 && !isTeamSpecificMetric) {
			const resultFilters = analysis.results
				.map((result) => {
					switch (result.toLowerCase()) {
						case "win":
						case "w":
							return `f.result = 'W'`;
						case "draw":
						case "d":
							return `f.result = 'D'`;
						case "loss":
						case "l":
							return `f.result = 'L'`;
						default:
							return null;
					}
				})
				.filter(Boolean);
			if (resultFilters.length > 0) {
				whereConditions.push(`(${resultFilters.join(" OR ")})`);
			}
		}

		// Add opponent own goals filter if specified (but not for team-specific metrics - they don't need Fixture)
		if (analysis.opponentOwnGoals === true && !isTeamSpecificMetric) {
			whereConditions.push(`f.oppoOwnGoals > 0`);
		}

		// Add special metric filters
		if (metricUpper === "HOME" || metricUpper === "HOMEGAMES") {
			whereConditions.push(`f.homeOrAway = 'Home'`);
		} else if (metricUpper === "AWAY" || metricUpper === "AWAYGAMES") {
			whereConditions.push(`f.homeOrAway = 'Away'`);
		}

		// Add position filters for position-specific metrics
		if (metricUpper === "GK") {
			whereConditions.push(`md.class = 'GK'`);
		} else if (metricUpper === "DEF") {
			whereConditions.push(`md.class = 'DEF'`);
		} else if (metricUpper === "MID") {
			whereConditions.push(`md.class = 'MID'`);
		} else if (metricUpper === "FWD") {
			whereConditions.push(`md.class = 'FWD'`);
		}

		// Add seasonal metric filters (dynamic for any season)
		if (metric.match(/\d{4}\/\d{2}(GOALS|APPS)/i)) {
			const seasonMatch = metric.match(/(\d{4}\/\d{2})(GOALS|APPS)/i);
			if (seasonMatch) {
				const season = seasonMatch[1];
				whereConditions.push(`f.season = "${season}"`);
			}
		}

		const hasDirectionalLocation = locations.some((loc) => loc.type === "home" || loc.type === "away");
		const shouldKeepLocationFilters = metricHandlesLocation || (hasExplicitLocation && hasDirectionalLocation);
		
		// For team-specific metrics, never keep location filters (isTeamSpecificAppearanceOrGoals already declared above)
		if (!shouldKeepLocationFilters || isTeamSpecificMetric || isTeamSpecificAppearanceOrGoals) {
			return whereConditions.filter((condition) => !condition.includes("f.homeOrAway"));
		}

		return whereConditions;
	}

	/**
	 * Optimize WHERE clause condition order for better query performance
	 * Most selective conditions (equality, indexed fields) should come first
	 */
	private optimizeWhereConditionOrder(conditions: string[]): string[] {
		// Priority order: most selective first
		// 1. Equality conditions on indexed fields (playerName, team, etc.)
		// 2. Range conditions (date ranges)
		// 3. IN clauses
		// 4. Other conditions
		
		const priority1: string[] = []; // Equality on indexed fields
		const priority2: string[] = []; // Date ranges
		const priority3: string[] = []; // IN clauses
		const priority4: string[] = []; // Other conditions
		
		for (const condition of conditions) {
			if (condition.includes("playerName") || condition.includes("md.team") || condition.includes("f.opposition")) {
				priority1.push(condition);
			} else if (condition.includes("date >=") || condition.includes("date <=")) {
				priority2.push(condition);
			} else if (condition.includes(" IN [")) {
				priority3.push(condition);
			} else {
				priority4.push(condition);
			}
		}
		
		return [...priority1, ...priority2, ...priority3, ...priority4];
	}

	/**
	 * Extract sources from query data and analysis
	 */
	private extractSources(data: Record<string, unknown> | null, analysis: EnhancedQuestionAnalysis): string[] {
		const sources: string[] = ["Neo4j Database"];

		if (!data || !("data" in data) || !Array.isArray(data.data) || data.data.length === 0) {
			return sources;
		}

		// Extract season information if available
		const firstRecord = data.data[0] as Record<string, unknown>;
		if (firstRecord && typeof firstRecord === "object") {
			if (firstRecord.season) {
				sources.push(`Season: ${firstRecord.season}`);
			}
			if (firstRecord.dateRange) {
				sources.push(`Date Range: ${firstRecord.dateRange}`);
			}
		}

		// Add time range context if present
		if (analysis.timeRange) {
			sources.push(`Time Period: ${analysis.timeRange}`);
		}

		// Add team context if present
		if (analysis.teamEntities && analysis.teamEntities.length > 0) {
			sources.push(`Team: ${analysis.teamEntities.map(t => this.mapTeamName(t)).join(", ")}`);
		}

		// Add location context if present
		const locations = analysis.extractionResult?.locations || [];
		if (locations.length > 0) {
			const locationTypes = locations.map(l => l.type === "home" ? "Home" : l.type === "away" ? "Away" : l.value).join(", ");
			sources.push(`Location: ${locationTypes}`);
		}

		return sources;
	}

	private buildContextualResponse(playerName: string, metric: string, value: unknown, analysis: EnhancedQuestionAnalysis): string {
		// Resolve metric alias to canonical key for display and formatting
		const resolvedMetricForDisplay = findMetricByAlias(metric)?.key || metric;
		// Get the metric display name
		const metricName = getMetricDisplayName(resolvedMetricForDisplay, value as number);
		const formattedValue = this.formatValueByMetric(resolvedMetricForDisplay, value as number);
		const verb = getAppropriateVerb(metric, value as number);

		// Special handling for GPERAPP - always include numeric value for test extraction
		if (metric === "GperAPP" || metric.toUpperCase() === "GPERAPP") {
			return `${playerName} averages ${formattedValue} goals per appearance.`;
		}

		// Special handling for AwayGames%Won - always include numeric value for test extraction
		if (metric === "AwayGames%Won" || metric.toUpperCase() === "AWAYGAMES%WON") {
			return `${playerName} has won ${formattedValue} of away games.`;
		}

		// Special handling for CperAPP - check for zero and return appropriate zero stat response (must be before general zero check)
		if (metric === "CperAPP" || metric.toUpperCase() === "CPERAPP") {
			const numericValue = typeof value === "number" ? value : Number(value);
			if (!Number.isNaN(numericValue) && (numericValue === 0 || Math.abs(numericValue) < 0.001)) {
				const zeroResponse = getZeroStatResponse(resolvedMetricForDisplay, playerName, { metricDisplayName: metricName });
				if (zeroResponse) {
					return zeroResponse;
				}
				// Fallback: if getZeroStatResponse returns null, return the zero message directly
				return `${playerName} has not conceded a goal.`;
			}
			return `${playerName} has averaged ${formattedValue} goals conceded per appearance.`;
		}

		// Special handling for HomeWins and AwayWins - check for zero and return appropriate zero stat response
		if (metric === "HomeWins" || metric.toUpperCase() === "HOMEWINS") {
			const numericValue = typeof value === "number" ? value : Number(value);
			if (!Number.isNaN(numericValue) && numericValue === 0) {
				const zeroResponse = getZeroStatResponse(resolvedMetricForDisplay, playerName, { metricDisplayName: metricName });
				if (zeroResponse) {
					return zeroResponse;
				}
			}
		}

		if (metric === "AwayWins" || metric.toUpperCase() === "AWAYWINS") {
			const numericValue = typeof value === "number" ? value : Number(value);
			if (!Number.isNaN(numericValue) && numericValue === 0) {
				const zeroResponse = getZeroStatResponse(resolvedMetricForDisplay, playerName, { metricDisplayName: metricName });
				if (zeroResponse) {
					return zeroResponse;
				}
			}
		}

		const numericValue = typeof value === "number" ? value : Number(value);
		if (!Number.isNaN(numericValue) && numericValue === 0) {
			const zeroResponse = getZeroStatResponse(resolvedMetricForDisplay, playerName, { metricDisplayName: metricName });
			if (zeroResponse) {
				return zeroResponse;
			}
		}

		// Debug logging for percentage issues
		if (metric.includes("HomeGames%Won") || value === 51.764705) {
			this.logToBoth(
				`🔧 buildContextualResponse - metric: ${metric}, value: ${value}, formattedValue: ${formattedValue}, metricName: ${metricName}`,
				null,
				"log",
			);
		}

		if (metric === "MperG") {
			return `${playerName} averages ${formattedValue} minutes per goal scored.`;
		}

		if (metric === "MperCLS") {
			return `${playerName} takes on average ${formattedValue} minutes to keep a clean sheet.`;
		}

		if (metric === "FTPperAPP") {
			return `${playerName} averages ${formattedValue} fantasy points per appearance.`;
		}

		// Special handling for season count with total
		if (metric === "SEASON_COUNT_WITH_TOTAL") {
			const data = value as { playerSeasonCount: number; totalSeasonCount: number; firstSeason: string };
			return `${playerName} has played in ${data.playerSeasonCount}/${data.totalSeasonCount} of the club's stat recorded seasons, starting in ${data.firstSeason}`;
		}

		// Special handling for simple season count
		if (metric === "SEASON_COUNT_SIMPLE") {
			const data = value as { value: number; firstSeason: string };
			return `${playerName} has played for ${data.value} seasons, starting in ${data.firstSeason}`;
		}

		// Handle cases where verb and metric name overlap (e.g., "conceded" + "goals conceded")
		let finalMetricName = metricName;
		if (verb && metricName.toLowerCase().includes(verb.toLowerCase())) {
			// Remove the verb from the metric name to avoid duplication
			finalMetricName = metricName.toLowerCase().replace(verb.toLowerCase(), "").trim();
		}

		// Start with the basic response
		let response = `${playerName} has ${verb} ${formattedValue} ${finalMetricName}`;

		// Add team context if present
		if (analysis.teamEntities && analysis.teamEntities.length > 0) {
			const teamName = this.mapTeamName(analysis.teamEntities[0]);
			response += ` for the ${teamName}`;
		}

		// Add location context if present
		const locations = (analysis.extractionResult && analysis.extractionResult.locations) || [];
		if (locations && locations.length > 0) {
			const location = locations[0].value;
			if (location === "home") {
				response += ` whilst playing at home`;
			} else if (location === "away") {
				response += ` whilst playing away`;
			}
		}

		// Add time range context if present (but ignore placeholder values)
		if (analysis.timeRange && analysis.timeRange !== "between_dates" && analysis.timeRange.trim() !== "") {
			if (analysis.timeRange.includes(" to ")) {
				const formattedTimeRange = this.formatTimeRange(analysis.timeRange);
				response += ` between ${formattedTimeRange}`;
			} else {
				const formattedDate = this.formatDate(analysis.timeRange);
				response += ` on ${formattedDate}`;
			}
		}

		// Add period for final sentence
		response += ".";

		return response;
	}

	private async generateResponse(
		question: string,
		data: Record<string, unknown> | null,
		analysis: EnhancedQuestionAnalysis,
	): Promise<ChatbotResponse> {
		this.logToBoth(`🔍 generateResponse called with:`, {
			question,
			dataType: data?.type,
			dataLength: Array.isArray(data?.data) ? data.data.length : "not array",
			analysisType: analysis?.type,
		});

		let answer = "I couldn't find relevant information for your question.";
		let visualization: ChatbotResponse['visualization'] = undefined;
		const sources = this.extractSources(data, analysis);

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
		} else if (data && data.data && Array.isArray(data.data) && data.data.length === 0) {
			// Query executed successfully but returned no results
			const metric = data.metric || "data";
			const playerName = data.playerName || "the requested entity";

			// Check if this is a team-specific appearance query - return 0 instead of "No data found"
			if (metric && typeof metric === 'string' && (metric.match(/^\d+sApps$/i) || metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i))) {
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
							teamName = this.mapTeamName(`${teamNumber}s`);
							answer = `${playerName} has not scored any goals for the ${teamName}.`;
						}
					} else {
						teamName = this.mapTeamName(`${teamNumber}s`);
						answer = `${playerName} has not scored any goals for the ${teamName}.`;
					}
				} else {
					answer = `${playerName} has scored 0 goals.`;
				}
			}
			// Handle position metrics with zero results
			else if (metric && typeof metric === 'string' && ["GK", "DEF", "MID", "FWD"].includes(metric.toUpperCase())) {
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
						const seasonsData = data.data as Array<{ season?: string; value: number | string; [key: string]: unknown }>;
						
						// Transform data to ensure we have season and value
						const transformedData = seasonsData
							.map((item) => {
								// Handle both { season: "2019/20", value: 15 } and { value: "2019/20" } formats
								const season = item.season || (typeof item.value === "string" ? item.value : "");
								const goals = typeof item.value === "number" ? item.value : (item.goals as number) || 0;
								return { season, value: goals };
							})
							.filter((item) => item.season && item.value !== undefined);
						
						if (transformedData.length > 0) {
							// Check if all seasons have 0 goals
							const allGoalsZero = transformedData.every((item) => item.value === 0);
							
							if (allGoalsZero) {
								// Player has not scored in any season
								answer = `${playerName} has not scored in a season`;
							} else {
								// Find the most prolific season
								const mostProlific = transformedData.reduce((max, current) => 
									current.value > max.value ? current : max
								);
								
								answer = `${mostProlific.season} was ${playerName}'s most prolific season with ${mostProlific.value} goals.`;
								
								// Create Record visualization with all seasons
								visualization = {
									type: "Record",
									data: transformedData.map((item) => ({
										name: item.season,
										value: item.value,
										isHighest: item.season === mostProlific.season,
									})),
									config: {
										title: `${playerName} - Goals per Season`,
										type: "bar",
									},
								};
							}
						} else {
							// Fallback if data structure is different
							answer = `Unable to determine ${playerName}'s most prolific season.`;
						}
					}
				} else {
					// Standard processing for other metrics (extract first data item)
					const playerData = data.data[0] as PlayerData;
					let value = playerData.value !== undefined ? playerData.value : 0;
					
					// Round value based on metric's numberDecimalPlaces configuration
					const metricConfig = statObject[metric as keyof typeof statObject];
					if (metricConfig && typeof metricConfig === "object" && "numberDecimalPlaces" in metricConfig) {
						const decimalPlaces = metricConfig.numberDecimalPlaces as number;
						if (typeof value === "number") {
							value = Number(value.toFixed(decimalPlaces));
						}
					}

				// Get the metric display name
				const metricName = getMetricDisplayName(metric, value as number);

					// Enhanced handling for special metrics
					const questionLower = question.toLowerCase();
					const isFantasyPointsQuestion = questionLower.includes("fantasy points") || questionLower.includes("fantasy");
					
					if (metric === "AllGSC" || metric === "totalGoals") {
						// Build contextual response and add clarification
						answer = this.buildContextualResponse(playerName, metric, value as number, analysis);
						answer = answer.replace(".", " (including both open play and penalty goals).");
					} else if (isFantasyPointsQuestion && (metric === "points" || metric.toUpperCase() === "FTP" || metric.toUpperCase() === "FANTASYPOINTS" || metric === "OPENPLAYGOALS")) {
						// Prioritize fantasy points if question mentions fantasy points, even if metric was incorrectly detected as OPENPLAYGOALS
						const formattedValue = this.formatValueByMetric("FTP", value as number);
						answer = `${playerName} has ${formattedValue} fantasy points.`;
					} else if (metric === "OPENPLAYGOALS") {
						// Special handling for open play goals
						answer = `${playerName} has ${value} goals from open play.`;
					} else if (metric === "points" || metric.toUpperCase() === "FTP" || metric.toUpperCase() === "FANTASYPOINTS") {
						// Build contextual response for fantasy points
						if (isFantasyPointsQuestion) {
							const formattedValue = this.formatValueByMetric("FTP", value as number);
							answer = `${playerName} has ${formattedValue} fantasy points.`;
						} else {
							answer = this.buildContextualResponse(playerName, metric, value as number, analysis);
							answer = answer.replace(".", " (Fantasy Points).");
						}
					} else if (metric === "DIST" || metric.toUpperCase() === "DIST") {
						// For "How far has player travelled to get to games?" questions
						if (questionLower.includes("travelled") || questionLower.includes("traveled") || questionLower.includes("distance") || questionLower.includes("how far")) {
							const formattedValue = this.formatValueByMetric("DIST", value as number);
							answer = `${playerName} has travelled ${formattedValue} miles to games.`;
						}
					} else if (metric === "MostPlayedForTeam" || metric === "MOSTPLAYEDFORTEAM" || metric === "TEAM_ANALYSIS") {
						if (this.isTeamCountQuestion(question)) {
							const teamsPlayedFor = value || 0;
							if (teamsPlayedFor === 0) {
								answer = `${playerName} has not played for any of the club's teams yet.`;
							} else if (teamsPlayedFor === 1) {
								answer = `${playerName} has played for 1 of the club's 9 teams.`;
							} else {
								answer = `${playerName} has played for ${teamsPlayedFor} of the club's 9 teams.`;
							}
						} else {
							const questionLower = question.toLowerCase();
							if (questionLower.includes("what team has") || questionLower.includes("which team has")) {
								const teamName = String(value || "");
								if (teamName && teamName !== "0" && teamName !== "") {
									const teamDisplayName = teamName
										.replace("1st XI", "1s")
										.replace("2nd XI", "2s") 
										.replace("3rd XI", "3s")
										.replace("4th XI", "4s")
										.replace("5th XI", "5s")
										.replace("6th XI", "6s")
										.replace("7th XI", "7s")
										.replace("8th XI", "8s");
									answer = `${playerName} has made the most appearances for the ${teamDisplayName}`;
								} else {
									answer = `${playerName} has not made any appearances yet.`;
								}
							}
						}
				} else if (metric === "MostScoredForTeam") {
					// For "What team has player scored the most X for?" questions (goals, assists, yellow cards, etc.)
					const questionLower = question.toLowerCase();
					if ((questionLower.includes("what team has") || questionLower.includes("which team has")) && questionLower.includes("most")) {
						// Use the actual query results from Cypher
						const teamName = String(value); // e.g., "4th XI"
						// Convert team name to expected format (e.g., "4th XI" -> "4s")
						const teamDisplayName = teamName
							.replace("1st XI", "1s")
							.replace("2nd XI", "2s") 
							.replace("3rd XI", "3s")
							.replace("4th XI", "4s")
							.replace("5th XI", "5s")
							.replace("6th XI", "6s")
							.replace("7th XI", "7s")
							.replace("8th XI", "8s");
						
						// Get the stat type from analysis (stored during query building)
						const statDisplayName = (analysis as any).mostScoredForTeamStatDisplayName || "goals";
						const verb = statDisplayName === "goals" ? "scored" : statDisplayName === "assists" ? "got" : "got";
						
						// Get goal count from playerData if available (the query returns it as goalCount)
						const goalCount = (playerData as any)?.goalCount ?? (playerData as any)?.statValue ?? (playerData as any)?.value ?? 0;
						
						// Format: "Luke Bangs has scored the most goals for the 4s (8)"
						if (goalCount > 0) {
							answer = `${playerName} has ${verb} the most ${statDisplayName} for the ${teamDisplayName} (${goalCount})`;
						} else {
							// If player hasn't scored for any team
							if (statDisplayName === "goals") {
								answer = `${playerName} has not scored any goals for a team`;
							} else {
								answer = `${playerName} has not ${verb} any ${statDisplayName} for a team`;
							}
						}
					}
				} else if (metric === "SEASON_COUNT_WITH_TOTAL") {
					// For "How many of the seasons has player played for/in?" questions
					const playerData = data.data[0] as { playerSeasonCount: number; totalSeasonCount: number; firstSeason: string };
					answer = `${playerName} has played in ${playerData.playerSeasonCount}/${playerData.totalSeasonCount} of the club's stat recorded seasons, starting in ${playerData.firstSeason}`;
				} else if (metric === "SEASON_COUNT_SIMPLE") {
					// For "How many seasons has player played?" questions
					const playerData = data.data[0] as { value: number; firstSeason: string };
					answer = `${playerName} has played for ${playerData.value} seasons, starting in ${playerData.firstSeason}`;
				} else if (metric === "NumberSeasonsPlayedFor" || metric.toUpperCase() === "NUMBERSEASONSPLAYEDFOR") {
					// For "How many seasons has player played in?" questions
					const playerData = data.data[0] as { playerSeasonCount?: number; totalSeasonCount?: number };
					const playerSeasonCount = playerData?.playerSeasonCount ?? Number(value) ?? 0;
					const totalSeasonCount = playerData?.totalSeasonCount ?? 0;
					if (totalSeasonCount > 0) {
						answer = `${playerName} has played for ${playerSeasonCount}/${totalSeasonCount} of the club's stat recorded seasons.`;
					} else {
						// Fallback: try to get total seasons from all fixtures
						answer = `${playerName} has played for ${playerSeasonCount} seasons.`;
					}
				} else if (metric === "NumberTeamsPlayedFor") {
					// For "How many of the clubs teams has player played for?" questions
					// Use the actual query result from Cypher
					const teamsPlayedFor = Number(value) || 0;
					const ratioText = `${teamsPlayedFor}/9`;

					if (teamsPlayedFor === 0) {
						answer = `${playerName} has played for ${ratioText} of the club's teams so far.`;
					} else {
						const plural = teamsPlayedFor === 1 ? "team" : "teams";
						answer = `${playerName} has played for ${ratioText} of the club's ${plural}.`;
					}
				} else if (metric === "GK" || metric === "DEF" || metric === "MID" || metric === "FWD") {
					// For position queries (goalkeeper, defender, midfielder, forward)
					const positionValue = value as number || 0;
					const questionLower = question.toLowerCase();
					
					// Map position codes to display names
					const positionDisplayNames: Record<string, string> = {
						"GK": "goalkeeper",
						"DEF": "defender",
						"MID": "midfielder",
						"FWD": "forward"
					};
					
					const positionDisplayName = positionDisplayNames[metric.toUpperCase()] || metric.toLowerCase();
					
					if (positionValue === 0) {
						// Handle zero value - player has never played this position
						answer = `${playerName} has never played as a ${positionDisplayName}.`;
					} else {
						// Use standard contextual response for non-zero values
						answer = this.buildContextualResponse(playerName, metric, positionValue, analysis);
					}
				} else if (metric === "MOSTCOMMONPOSITION" || metric === "MostCommonPosition") {
					// For "What is player's most common position played?" questions
					const questionLower = question.toLowerCase();
					if (
						questionLower.includes("most common position") ||
						questionLower.includes("favorite position") ||
						questionLower.includes("main position") ||
						questionLower.includes("position played most") ||
						questionLower.includes("position has") && questionLower.includes("played most")
					) {
						// Use the actual query result from Cypher and format according to specification
						const position = value || "Unknown";
						let positionText = "";
						switch (position) {
							case "GK":
								positionText = "in goal";
								break;
							case "DEF":
								positionText = "in defence";
								break;
							case "MID":
								positionText = "in midfield";
								break;
							case "FWD":
								positionText = "as a forward";
								break;
							default:
								positionText = `as ${position}`;
						}
						answer = `${playerName} has played ${positionText} the most.`;
					}
				} else if (metric.includes("APPS") && metric.match(/\d{4}\/\d{2}/)) {
					// For season-specific appearance queries (e.g., "2017/18Apps")
					const season = metric.replace("APPS", "");
					const questionLower = question.toLowerCase();
					if (questionLower.includes("appearances") || questionLower.includes("apps") || questionLower.includes("games")) {
						answer = `${playerName} made ${value} ${value === 1 ? "appearance" : "appearances"} in the ${season} season.`;
					}
				} else if (metric.match(/\d{4}\/\d{2}GOALS/i)) {
					// For season-specific goals queries (e.g., "2016/17GOALS", "2016/17Goals")
					const seasonMatch = metric.match(/(\d{4}\/\d{2})GOALS/i);
					if (seasonMatch) {
						const season = seasonMatch[1];
						const questionLower = question.toLowerCase();
						if (questionLower.includes("goals") || questionLower.includes("scored") || questionLower.includes("get")) {
							if (value === 0) {
								answer = `${playerName} did not score a goal in the ${season} season.`;
							} else {
								answer = `${playerName} scored ${value} ${value === 1 ? "goal" : "goals"} in the ${season} season.`;
							}
						}
					}
				} else if (metric.includes("ASSISTS") && metric.match(/\d{4}\/\d{2}/)) {
					// For season-specific assists queries (e.g., "2016/17ASSISTS")
					const season = metric.replace("ASSISTS", "");
					const questionLower = question.toLowerCase();
					if (questionLower.includes("assists") || questionLower.includes("assisted") || questionLower.includes("get")) {
						answer = `${playerName} got ${value} ${value === 1 ? "assist" : "assists"} in the ${season} season.`;
					}
				} else if (metric.includes("CLEANSHEETS") && metric.match(/\d{4}\/\d{2}/)) {
					// For season-specific clean sheets queries (e.g., "2016/17CLEANSHEETS")
					const season = metric.replace("CLEANSHEETS", "");
					const questionLower = question.toLowerCase();
					if (questionLower.includes("clean sheets") || questionLower.includes("clean sheet") || questionLower.includes("clean sheets") || questionLower.includes("kept clean")) {
						answer = `${playerName} kept ${value} clean sheet${value === 1 ? "" : "s"} in the ${season} season.`;
					}
				} else if (metric.includes("SAVES") && metric.match(/\d{4}\/\d{2}/)) {
					// For season-specific saves queries (e.g., "2016/17SAVES")
					const season = metric.replace("SAVES", "");
					const questionLower = question.toLowerCase();
					if (questionLower.includes("saves") || questionLower.includes("saved") || questionLower.includes("get")) {
						answer = `${playerName} made ${value} ${value === 1 ? "save" : "saves"} in the ${season} season.`;
					}
				} else if (metric === "HOME" || metric.toUpperCase() === "HOME") {
					// For home games queries
					const questionLower = question.toLowerCase();
					if (questionLower.includes("home games") || questionLower.includes("home matches") || questionLower.includes("at home")) {
						answer = `${playerName} has played ${value} ${value === 1 ? "home game" : "home games"}.`;
					} else {
						answer = this.buildContextualResponse(playerName, metric, value as number, analysis);
					}
				} else if (metric === "AWAY" || metric.toUpperCase() === "AWAY") {
					// For away games queries
					const questionLower = question.toLowerCase();
					if (questionLower.includes("away games") || questionLower.includes("away matches") || questionLower.includes("away from home") || questionLower.includes("on the road")) {
						answer = `${playerName} has played ${value} ${value === 1 ? "away game" : "away games"}.`;
					} else {
						answer = this.buildContextualResponse(playerName, metric, value as number, analysis);
					}
				} else if (metric.match(/^\d+sApps$/i)) {
					// For team-specific appearance queries (e.g., "1sApps", "2sApps", etc.)
					const teamNumber = metric.match(/^(\d+)sApps$/i)?.[1];
					const teamName = this.mapTeamName(`${teamNumber}s`);
					// Always set answer since metric already confirms it's an appearance query
					answer = `${playerName} has made ${value} ${value === 1 ? "appearance" : "appearances"} for the ${teamName}.`;
				} else if (metric && typeof metric === 'string' && metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i)) {
					// For team-specific appearance queries (e.g., "1st XI Apps", "2nd XI Apps", etc.)
					const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Apps$/i);
					if (teamMatch) {
						const teamName = teamMatch[1] + " XI";
						answer = `${playerName} has made ${value} ${value === 1 ? "appearance" : "appearances"} for the ${teamName}.`;
					}
				} else if (metric.match(/^\d+sGoals$/i)) {
					// For team-specific goals queries (e.g., "1sGoals", "2sGoals", etc.)
					const teamNumber = metric.match(/^(\d+)sGoals$/i)?.[1];
					const teamName = this.mapTeamName(`${teamNumber}s`);
					const questionLower = question.toLowerCase();
					if (questionLower.includes("goals") || questionLower.includes("scored") || questionLower.includes("got")) {
						if (value === 0) {
							answer = `${playerName} has not scored any goals for the ${teamName}.`;
						} else {
							answer = `${playerName} has scored ${value} ${value === 1 ? "goal" : "goals"} for the ${teamName}.`;
						}
					}
				} else if (metric && typeof metric === 'string' && metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i)) {
					// For team-specific goals queries (e.g., "1st XI Goals", "2nd XI Goals", etc.)
					const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Goals$/i);
					if (teamMatch) {
						const teamName = teamMatch[1] + " XI";
						const teamDisplayName = this.mapTeamName(teamName.replace(" XI", "s"));
						if (value === 0) {
							answer = `${playerName} has not scored any goals for the ${teamDisplayName}.`;
						} else {
							answer = `${playerName} has scored ${value} ${value === 1 ? "goal" : "goals"} for the ${teamDisplayName}.`;
						}
					}
				} else if (metric && typeof metric === 'string' && (
					metric.match(/\d+(?:st|nd|rd|th)\s+team.*goals?/i) ||
					metric.match(/\d+s.*goals?/i) ||
					(question.toLowerCase().includes("goal") && (question.toLowerCase().includes("2nd team") || question.toLowerCase().includes("6s") || question.toLowerCase().includes("goal count") || question.toLowerCase().includes("goal stats")))
				)) {
					// Flexible handler for team-specific goals queries with variations like "2nd team", "6s", "goal count", "goal stats"
					const questionLower = question.toLowerCase();
					let teamDisplayName = "";
					
					// Try to extract team from metric first
					const metricTeamMatch = metric.match(/(\d+(?:st|nd|rd|th))\s+team/i) || metric.match(/(\d+)s/i);
					if (metricTeamMatch) {
						const teamNumber = metricTeamMatch[1];
						if (teamNumber.match(/^\d+(?:st|nd|rd|th)$/)) {
							teamDisplayName = this.mapTeamName(teamNumber + " XI".replace(" XI", "s"));
						} else {
							teamDisplayName = this.mapTeamName(`${teamNumber}s`);
						}
					} else {
						// Try to extract from question
						if (questionLower.includes("2nd team") || questionLower.includes("2nd")) {
							teamDisplayName = this.mapTeamName("2nd XI".replace(" XI", "s"));
						} else if (questionLower.includes("6s") || questionLower.includes("6th")) {
							teamDisplayName = this.mapTeamName("6th XI".replace(" XI", "s"));
						} else if (questionLower.includes("3rd team") || questionLower.includes("3rd")) {
							teamDisplayName = this.mapTeamName("3rd XI".replace(" XI", "s"));
						} else if (questionLower.includes("1st team") || questionLower.includes("1st")) {
							teamDisplayName = this.mapTeamName("1st XI".replace(" XI", "s"));
						} else {
							// Default fallback - try to find any team mention
							const teamMatch = questionLower.match(/(\d+)(?:st|nd|rd|th)?\s*(?:team|s)/);
							if (teamMatch) {
								const teamNum = teamMatch[1];
								teamDisplayName = this.mapTeamName(`${teamNum}s`);
							}
						}
					}
					
					if (teamDisplayName && (questionLower.includes("goal") || questionLower.includes("scored") || questionLower.includes("goal count") || questionLower.includes("goal stats"))) {
						if (value === 0) {
							answer = `${playerName} has not scored any goals for the ${teamDisplayName}.`;
						} else {
							answer = `${playerName} has scored ${value} ${value === 1 ? "goal" : "goals"} for the ${teamDisplayName}.`;
						}
					}
				} else {
					// Handle appearances count special case
					if (metric === "APP") {
						// Check if the value is 0 or null and handle it appropriately
						if (value === 0 || value === null) {
							// Check if the player exists in the database
							const appearancesQuery = `
								MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
								RETURN count(md) as appearances
							`;
							const appearancesResult = await neo4jService.executeQuery(appearancesQuery, { playerName });
							if (appearancesResult && appearancesResult.length > 0) {
								const appearances = appearancesResult[0].appearances;
								if (appearances > 0) {
									answer = `${playerName} has made ${appearances} ${appearances === 1 ? "appearance" : "appearances"}.`;
								} else {
									answer = `${playerName} has not made any appearances yet.`;
								}
							} else {
								answer = `I couldn't find any appearance data for ${playerName}.`;
							}
					} else {
						// Use the value from the original query
						// Check if question asks about "games" and include that in the response
						const questionLower = question.toLowerCase();
						if (questionLower.includes("games") && questionLower.includes("played")) {
							answer = `${playerName} has played ${value} ${value === 1 ? "game" : "games"}.`;
						} else {
							answer = `${playerName} has made ${value} ${value === 1 ? "appearance" : "appearances"}.`;
						}
					}
					} else if (metric && (metric.toUpperCase() === "GPERAPP" || metric === "GperAPP")) {
						// Special handling for goals per appearance
						// Use buildContextualResponse which includes the formatted value for test extraction
						// The buildContextualResponse method now has special handling for GPERAPP
						answer = this.buildContextualResponse(playerName, metric, value as number, analysis);
					} else {
						// Standard metric handling with contextual response
						answer = this.buildContextualResponse(playerName, metric, value as number, analysis);
					}
				}

				// Create visualization for numerical data
				if (typeof value === "number") {
					// Value is already rounded above, but ensure it's properly formatted
					visualization = {
						type: "NumberCard",
						data: [{ name: playerName, value: value, metric: metricName }],
						config: {
							title: `${playerName} - ${metricName}`,
							type: "bar",
						},
					};
				}
			}
		} else if (data && data.type === "general_players" && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
			const firstData = data.data[0] as Record<string, unknown>;
			if (firstData.playerCount) {
				// General player count question
				answer = `The club currently has ${firstData.playerCount} registered players across all teams.`;
				visualization = {
					type: "NumberCard",
					data: [{ name: "Total Players", value: firstData.playerCount }],
					config: { title: "Club Statistics", type: "bar" },
				};
			} else {
				// List of players
				const playerNames = data.data.map((p: Record<string, unknown>) => p.name || p.playerName).slice(0, 10);
				answer = `Here are some players in the database: ${playerNames.join(", ")}.`;
			}
		} else if (data && data.type === "team_specific" && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
				// Team-specific query (e.g., "3rd team goals")
				const teamName = data.teamName as string;
				const metric = data.metric as string;
				const topPlayer = data.data[0] as PlayerData;
				const metricName = getMetricDisplayName(metric, topPlayer.value as number);

				// Check if user asked for "the most" or similar superlative terms
				const questionLower = question.toLowerCase();
				const usesSuperlative =
					questionLower.includes("the most") ||
					questionLower.includes("highest") ||
					questionLower.includes("best") ||
					questionLower.includes("top");

				if (usesSuperlative) {
					// Use comparison template for superlative questions
					const template = getResponseTemplate("comparison", "Player comparison (highest)");
					if (template) {
						answer = formatNaturalResponse(
							template.template,
							topPlayer.playerName as string,
							metric,
							topPlayer.value as number,
							metricName,
							teamName,
						);
					} else {
						// Fallback if no template found
						answer = `${topPlayer.playerName} has ${getAppropriateVerb(metric, topPlayer.value as number)} the most ${metricName} for the ${teamName} with ${topPlayer.value}.`;
					}
				} else {
					// Use team-specific template for regular questions
					const template = getResponseTemplate("team_specific", "Team-specific player statistics");
					if (template) {
						answer = formatNaturalResponse(
							template.template,
							topPlayer.playerName as string,
							metric,
							topPlayer.value as number,
							metricName,
							teamName,
						);
					} else {
						// Fallback if no template found
						answer = `For the ${teamName}, ${topPlayer.playerName} has ${getAppropriateVerb(metric, topPlayer.value as number)} ${topPlayer.value} ${metricName}.`;
					}
				}

				// Create visualization for team data
				visualization = {
					type: "Table",
					data: data.data.slice(0, 10).map((player: Record<string, unknown>) => ({
						Player: player.playerName,
						[metricName]: player.value,
					})),
					config: {
						title: `${teamName} - Top ${metricName}`,
						type: "table",
					},
				};
			} else if (data && data.type === "streak" && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
				// Handle streak data
				const playerName = data.playerName as string;
				const streakData = data.data as StreakData[];
				answer = `${playerName} has scored in ${streakData.length} games.`;

				visualization = {
					type: "Calendar",
					data: streakData.map((game: StreakData) => ({
						date: game.date,
						goals: game.goals,
					})),
					config: {
						title: `${playerName} - Goal Scoring Streak`,
						type: "line",
					},
				};
			} else if (data && data.type === "double_game" && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
				// Handle double game week data
				const playerName = data.playerName as string;
				const dgwData = data.data as StreakData[];
				const totalGoals = dgwData.reduce((sum: number, game: StreakData) => sum + (game.goals || 0), 0);
				const totalAssists = dgwData.reduce((sum: number, game: StreakData) => sum + (game.assists || 0), 0);

				answer = `${playerName} has played ${dgwData.length} double game weeks, scoring ${totalGoals} goals and providing ${totalAssists} assists.`;

				visualization = {
					type: "Table",
					data: dgwData.map((game: StreakData) => ({
						Date: game.date,
						Goals: game.goals || 0,
						Assists: game.assists || 0,
					})),
					config: {
						title: `${playerName} - Double Game Week Performance`,
						type: "table",
					},
				};
			} else if (data && data.type === "totw_awards" && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
				// Handle TOTW awards
				const playerName = data.playerName as string;
				const period = data.period as string;
				const awards = data.data.length;
				const periodText = period === "weekly" ? "weekly" : "season";

				answer = `${playerName} has received ${awards} ${periodText} Team of the Week award${awards === 1 ? "" : "s"}.`;

				visualization = {
					type: "NumberCard",
					data: [{ name: `${periodText.charAt(0).toUpperCase() + periodText.slice(1)} TOTW Awards`, value: awards }],
					config: {
						title: `${playerName} - ${periodText.charAt(0).toUpperCase() + periodText.slice(1)} TOTW Awards`,
						type: "bar",
					},
				};
			} else if (data && data.type === "potm_awards" && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
				// Handle Player of the Month awards
				const playerName = data.playerName as string;
				const awards = data.data.length;

				answer = `${playerName} has received ${awards} Player of the Month award${awards === 1 ? "" : "s"}.`;

				visualization = {
					type: "NumberCard",
					data: [{ name: "Player of the Month Awards", value: awards }],
					config: {
						title: `${playerName} - Player of the Month Awards`,
						type: "bar",
					},
				};
			} else if (data && data.type === "captain_awards" && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
				// Handle Captain awards
				const playerName = data.playerName as string;
				const awards = data.data.length;

				answer = `${playerName} has been captain ${awards} time${awards === 1 ? "" : "s"}.`;

				visualization = {
					type: "NumberCard",
					data: [{ name: "Captain Awards", value: awards }],
					config: {
						title: `${playerName} - Captain Awards`,
						type: "bar",
					},
				};
			} else if (data && data.type === "co_players" && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
				// Handle co-players data
				const playerName = data.playerName as string;
				const coPlayers = data.data.slice(0, 10) as CoPlayerData[];

				answer = `${playerName} has played with ${coPlayers.length} different players. Top co-players: ${coPlayers
					.map((p: CoPlayerData) => p.coPlayerName)
					.join(", ")}.`;

				visualization = {
					type: "Table",
					data: coPlayers.map((player: CoPlayerData) => ({
						"Co-Player": player.coPlayerName,
						"Games Together": player.gamesPlayedTogether,
					})),
					config: {
						title: `${playerName} - Co-Players`,
						type: "table",
					},
				};
			} else if (data && data.type === "most_played_with" && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
				// Handle most played with data
				const playerName = data.playerName as string;
				// Convert Neo4j Integer types to JavaScript numbers
				const teammates = (data.data as Array<{ teammateName: string; gamesTogether: number | any }>).map((teammate) => {
					let gamesTogether = teammate.gamesTogether;
					// Handle Neo4j Integer objects
					if (gamesTogether && typeof gamesTogether === "object") {
						if ("toNumber" in gamesTogether && typeof gamesTogether.toNumber === "function") {
							gamesTogether = gamesTogether.toNumber();
						} else if ("low" in gamesTogether && "high" in gamesTogether) {
							gamesTogether = (gamesTogether.low || 0) + (gamesTogether.high || 0) * 4294967296;
						} else {
							gamesTogether = Number(gamesTogether);
						}
					}
					return {
						teammateName: teammate.teammateName,
						gamesTogether: Number(gamesTogether) || 0,
					};
				});

				if (teammates.length > 0) {
					const topTeammate = teammates[0];
					const gamesText = topTeammate.gamesTogether === 1 ? "game" : "games";
					// Check if question is about "I/you" or a specific player
					const questionLower = question.toLowerCase();
					const isAboutUser = questionLower.includes(" i ") || questionLower.includes(" i've ") || questionLower.includes(" i'") || 
						questionLower.startsWith("i ") || questionLower.includes(" who have i ") || questionLower.includes(" who have you ");
					
					if (isAboutUser) {
						answer = `You have played the most games with ${topTeammate.teammateName}, appearing together in ${topTeammate.gamesTogether} ${gamesText}.`;
					} else {
						answer = `${playerName} has played the most games with ${topTeammate.teammateName}, appearing together in ${topTeammate.gamesTogether} ${gamesText}.`;
					}

					visualization = {
						type: "Table",
						data: teammates.map((teammate, index) => ({
							rank: index + 1,
							name: teammate.teammateName,
							value: teammate.gamesTogether,
						})),
						config: {
							title: `Top 3 Players - Games Played Together`,
							type: "table",
							columns: [
								{ key: "rank", label: "Rank" },
								{ key: "name", label: "Player Name" },
								{ key: "value", label: "Games" },
							],
						},
					};
				} else {
					answer = `${playerName} has not played any games with other players yet.`;
				}
			} else if (data && data.type === "opponents" && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
				// Handle opponents data
				const playerName = data.playerName as string;
				const opponents = data.data.slice(0, 10) as OpponentData[];

				answer = `${playerName} has played against ${opponents.length} different opponents. Top opponents: ${opponents
					.map((o: OpponentData) => o.opponent)
					.join(", ")}.`;

				visualization = {
					type: "Table",
					data: opponents.map((opponent: OpponentData) => ({
						Opponent: opponent.opponent,
						"Games Played": opponent.gamesPlayed,
					})),
					config: {
						title: `${playerName} - Opponents`,
						type: "table",
					},
				};
			} else if (data && data.type === "temporal" && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
				// Handle temporal data
				const playerName = data.playerName as string;
				const metric = data.metric as string;
				const timeRange = data.timeRange as string;
				const result = data.data[0] as Record<string, unknown>;

				const metricName = getMetricDisplayName(metric, result.value as number);
				const timeText = timeRange ? ` ${timeRange}` : "";

				answer = `${playerName} has ${getAppropriateVerb(metric, result.value as number)} ${result.value} ${metricName}${timeText}.`;

				visualization = {
					type: "NumberCard",
					data: [{ name: metricName, value: result.value }],
					config: {
						title: `${playerName} - ${metricName}${timeText}`,
						type: "bar",
					},
				};
			} else if (data && data.type === "player_team" && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
				// Handle player-team specific data
				const playerName = data.playerName as string;
				const teamName = data.teamName as string;
				const metric = data.metric as string;
				const result = data.data[0] as Record<string, unknown>;

				const metricName = getMetricDisplayName(metric, result.value as number);

				answer = `${playerName} has ${getAppropriateVerb(metric, result.value as number)} ${result.value} ${metricName} for the ${teamName}.`;

				visualization = {
					type: "NumberCard",
					data: [{ name: metricName, value: result.value }],
					config: {
						title: `${playerName} - ${metricName} (${teamName})`,
						type: "bar",
					},
				};
			} else if (data && data.type === "opposition" && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
				// Handle opposition-specific data
				const playerName = data.playerName as string;
				const metric = data.metric as string;
				const oppositionName = data.oppositionName as string;
				const result = data.data[0] as Record<string, unknown>;

				const metricName = getMetricDisplayName(metric, result.value as number);

				if (oppositionName) {
					// Specific opposition query
					answer = `${playerName} has ${getAppropriateVerb(metric, result.value as number)} ${result.value} ${metricName} against ${oppositionName}.`;
				} else {
					// All oppositions query (most goals against)
					const topOpposition = data.data[0] as Record<string, unknown>;
					answer = `${playerName} has scored the most ${metricName} against ${topOpposition.opposition} (${topOpposition.value}).`;
				}

				visualization = {
					type: "NumberCard",
					data: data.data.slice(0, 10).map((opp: Record<string, unknown>) => ({
						name: opp.opposition || oppositionName,
						value: opp.value,
					})),
					config: {
						title: `${playerName} - ${metricName} vs Opposition`,
						type: "bar",
					},
				};
			} else if (data && data.type === "ranking" && "data" in data && Array.isArray(data.data)) {
				// Handle ranking data (top players/teams)
				const metric = data.metric as string;
				const isPlayerQuestion = data.isPlayerQuestion as boolean;
				const isTeamQuestion = data.isTeamQuestion as boolean;
				const resultCount = data.data.length;
				const requestedLimit = (data.requestedLimit as number) || 10;
				const isSingular = analysis.resultQuantity === "singular";

				if (resultCount === 0) {
					const metricName = getMetricDisplayName(metric, 0);
					answer = `No ${isTeamQuestion ? "teams" : "players"} found with ${metricName} data.`;
				} else {
					const firstResult = data.data[0] as Record<string, unknown>;
					const metricName = getMetricDisplayName(metric, firstResult.value as number);
					const topName = isTeamQuestion ? firstResult.teamName : firstResult.playerName;
					const topValue = firstResult.value;

					if (isSingular) {
						// Singular result - just return the answer without a table
						if (isPlayerQuestion) {
							answer = `${topName} has the highest ${metricName} with ${topValue}.`;
						} else if (isTeamQuestion) {
							answer = `The ${topName} has the highest ${metricName} with ${topValue}.`;
						} else {
							answer = `${topName} has the highest ${metricName} with ${topValue}.`;
						}
						// No visualization for singular results
					} else {
						// Plural result - return table with top 10
						const countText =
							resultCount === 1
								? "1"
								: resultCount < requestedLimit
									? `top ${resultCount}`
									: requestedLimit === 10
										? "top 10"
										: `top ${requestedLimit}`;

						if (isPlayerQuestion) {
							answer = `The player with the highest ${metricName} is ${topName} with ${topValue}. Here are the ${countText} players:`;
						} else if (isTeamQuestion) {
							answer = `The team with the highest ${metricName} is the ${topName} with ${topValue}. Here are the ${countText} teams:`;
						} else {
							answer = `The highest ${metricName} is ${topName} with ${topValue}. Here are the ${countText}:`;
						}

						visualization = {
							type: "Table",
							data: data.data.map((item: Record<string, unknown>, index: number) => ({
								rank: index + 1,
								name: isTeamQuestion ? item.teamName : item.playerName,
								value: item.value,
							})),
							config: {
								title: `${countText.charAt(0).toUpperCase() + countText.slice(1)} ${isTeamQuestion ? "Teams" : "Players"} - ${metricName}`,
								type: "table",
								columns: [
									{ key: "rank", label: "Rank" },
									{ key: "name", label: isTeamQuestion ? "Team" : "Player" },
									{ key: "value", label: metricName },
								],
							},
						};
					}
				}
			}
		}

		return {
			answer,
			data,
			visualization,
			sources,
			cypherQuery: (data?.cypherQuery as string) || "N/A",
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
			MATCH (p:Player {playerName: $playerName})-[r:HAS_CAPTAIN_AWARDS]->(ca:CaptainsAndAwards)
			RETURN p.playerName as playerName, 
			       ca.season as season,
			       r.awardType as awardType,
			       ca.id as nodeId
			ORDER BY ca.season DESC, r.awardType
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

	private async queryMostPlayedWith(playerName: string): Promise<Record<string, unknown>> {
		this.logToBoth(`🔍 Querying most played with for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		// Find players who played together by matching MatchDetail nodes that share the same Fixture
		// Each MatchDetail represents one player's performance in one match
		// Multiple MatchDetails can belong to the same Fixture (same game, different players)
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md1:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md1)
			MATCH (f)-[:HAS_MATCH_DETAILS]->(md2:MatchDetail {graphLabel: $graphLabel})
			MATCH (other:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(md2)
			WHERE other.playerName <> p.playerName
			WITH other.playerName as teammateName, count(DISTINCT f) as gamesTogether
			ORDER BY gamesTogether DESC
			LIMIT 3
			RETURN teammateName, gamesTogether
		`;

		// Log copyable query for debugging
		const readyToExecuteQuery = query
			.replace(/\$playerName/g, `'${playerName}'`)
			.replace(/\$graphLabel/g, `'${graphLabel}'`);
		
		console.log(`🔍 [MOST_PLAYED_WITH] COPY-PASTE QUERY FOR MANUAL TESTING:`);
		console.log(readyToExecuteQuery);
		this.lastExecutedQueries.push(`MOST_PLAYED_WITH_READY_TO_EXECUTE: ${readyToExecuteQuery}`);

		try {
			const result = await neo4jService.executeQuery(query, { 
				playerName,
				graphLabel 
			});
			console.log(`🔍 [MOST_PLAYED_WITH] Query result:`, result);
			return { type: "most_played_with", data: result, playerName };
		} catch (error) {
			this.logToBoth(`❌ Error in most played with query:`, error, "error");
			return { type: "error", data: [], error: "Error querying most played with data" };
		}
	}

	private async queryPlayerOpponentsData(playerName: string): Promise<Record<string, unknown>> {
		console.log(`🔍 Querying for opponents for player: ${playerName}`);
		const query = `
			MATCH (p:Player {playerName: $playerName})-[r:PLAYED_AGAINST_OPPONENT]->(od:OppositionDetails)
			RETURN od.opposition as opponent, 
			       r.timesPlayed as gamesPlayed,
			       r.goalsScored as goalsScored,
			       r.assists as assists,
			       r.lastPlayed as lastPlayed
			ORDER BY r.timesPlayed DESC, r.goalsScored DESC, r.assists DESC
			LIMIT 20
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
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
