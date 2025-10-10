import { neo4jService } from "../../netlify/functions/lib/neo4j.js";
import { findMetricByAlias, getMetricDisplayName } from "../config/chatbotMetrics";
import { statObject, VisualizationType } from "../../config/config";
import { getAppropriateVerb, getResponseTemplate, formatNaturalResponse } from "../config/naturalLanguageResponses";
import { EnhancedQuestionAnalyzer, EnhancedQuestionAnalysis } from "../config/enhancedQuestionAnalysis";
import { EntityNameResolver } from "./entityNameResolver";
import { loggingService } from "./loggingService";

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
}

export interface QuestionContext {
	question: string;
	userContext?: string;
	dataSources?: string[];
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
	private readonly CACHE_TTL: number = 5 * 60 * 1000; // 5 minutes

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

		return teamMapping[teamName.toLowerCase()] || teamName;
	}


	async processQuestion(context: QuestionContext): Promise<ChatbotResponse> {
		// Clear debug tracking for new question
		this.lastQuestionAnalysis = null;
		this.lastExecutedQueries = [];
		this.lastProcessingSteps = [];
		this.lastQueryBreakdown = null;

		// Essential logging for debugging
		this.logMinimal(`🤖 Using chatbot service for: ${context.question}`, null, "log");

		try {
			// Ensure Neo4j connection
			const connected = await neo4jService.connect();
			if (!connected) {
				console.error("❌ Neo4j connection failed in production");
				return {
					answer: "I'm sorry, I'm unable to access the club's database at the moment due to a network issue. Please try again later.",
					sources: [],
				};
			}

			// Analyze the question
			const analysis = await this.analyzeQuestion(context.question, context.userContext);
			this.lastQuestionAnalysis = analysis; // Store for debugging

			// Handle clarification needed case
			if (analysis.type === "clarification_needed") {
				return {
					answer: analysis.message || "Please clarify your question.",
					sources: [],
				};
			}

			// Create detailed breakdown for debugging
			this.lastQueryBreakdown = {
				playerName: context.userContext || "None",
				team: analysis.entities.find((e) => /\d+(?:st|nd|rd|th)?/.test(e)) || "None",
				statEntity: analysis.metrics[0] || "None",
				questionType: analysis.type,
				extractedEntities: analysis.entities,
				extractedMetrics: analysis.metrics,
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

			return response;
		} catch (error) {
			// Essential error logging
			this.logToBoth(`❌ Error: ${error instanceof Error ? error.message : String(error)} | Question: ${context.question}`, null, "error");

			// Provide more detailed error information for debugging
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorType = error instanceof Error ? error.constructor.name : typeof error;

			return {
				answer: `I'm sorry, I encountered an error while processing your question. Error details: ${errorType}: ${errorMessage}. Please try again later.`,
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
				// First check if the player exists
				const playerExistsQuery = `MATCH (p:Player {playerName: $playerName}) RETURN p.playerName as playerName LIMIT 1`;
				const playerExistsResult = await neo4jService.executeQuery(playerExistsQuery, { playerName: actualPlayerName });

				if (!playerExistsResult || playerExistsResult.length === 0) {
					this.logToBoth(`❌ Player not found: ${actualPlayerName}`, null, "error");
					return {
						type: "player_not_found",
						data: [],
						message: `I couldn't find a player named "${actualPlayerName}" in the database. Please check the spelling or try a different player name.`,
						playerName: actualPlayerName,
						metric: originalMetric,
					};
				}

				// Store query for debugging
				this.lastExecutedQueries.push(`PLAYER_DATA: ${query}`);
				this.lastExecutedQueries.push(`PARAMS: ${JSON.stringify({ playerName: actualPlayerName })}`);

				const result = await neo4jService.executeQuery(query, {
					playerName: actualPlayerName,
				});

				if (!result || !Array.isArray(result) || result.length === 0) {
					this.logToBoth(`❌ No results found for ${actualPlayerName} with metric ${metric}`, null, "warn");
				}

				return { type: "specific_player", data: result, playerName: actualPlayerName, metric: originalMetric, cypherQuery: query };
			} catch (error) {
				this.logToBoth(`❌ Error in player query:`, error, "error");
				return { type: "error", data: [], error: "Error querying player data" };
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

	/**
	 * Determines if a metric needs MatchDetail join or can use Player node directly
	 */
	private metricNeedsMatchDetail(metric: string): boolean {
		// Metrics that need MatchDetail join (including complex calculations)
		const matchDetailMetrics = ["ALLGSC", "GI", "HOME", "AWAY", "MPERG", "MPERCLS", "FTPPERAPP", "CPERAPP", "GPERAPP"];

		// Check if it's a team-specific appearance metric (1sApps, 2sApps, etc.)
		if (metric.match(/^\d+sApps$/i)) {
			return true; // Team-specific appearances need MatchDetail join to filter by team
		}

		// Check if it's a team-specific appearance metric (1st XI Apps, 2nd XI Apps, etc.)
		if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i)) {
			return true; // Team-specific appearances need MatchDetail join to filter by team
		}

		// Check if it's a seasonal metric (contains year pattern) - these use Player node directly
		if (metric.match(/\d{4}\/\d{2}(GOALS|APPS)/i)) {
			return false; // Seasonal metrics use Player node directly for now (fallback approach)
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
			case "FTP":
				return "coalesce(p.fantasyPoints, 0)";
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
			// Season-specific goals
			// Dynamic seasonal metrics (any season)
				// Check if it's a seasonal goals metric
				if (metric.match(/\d{4}\/\d{2}GOALS/i)) {
					const seasonMatch = metric.match(/(\d{4}\/\d{2})GOALS/i);
					if (seasonMatch) {
						const season = seasonMatch[1];
						return `coalesce(sum(CASE WHEN f.season = "${season}" AND (md.goals IS NOT NULL AND md.goals <> "") THEN md.goals ELSE 0 END), 0) as value`;
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
	 * Builds the optimal query for player data using unified architecture
	 */
	private buildPlayerQuery(_playerName: string, metric: string, analysis: EnhancedQuestionAnalysis): string {
		const teamEntities = analysis.teamEntities || [];
		const oppositionEntities = analysis.oppositionEntities || [];
		const timeRange = analysis.timeRange;
		const locations = analysis.extractionResult?.locations || [];

		// Determine if this metric needs MatchDetail join or can use Player node directly
		const needsMatchDetail = this.metricNeedsMatchDetail(metric);

		// Check if we need Fixture relationship for any filters
		const needsFixture =
			teamEntities.length > 0 ||
			locations.length > 0 ||
			timeRange ||
			oppositionEntities.length > 0 ||
			metric === "HOME" ||
			metric === "AWAY" ||
			(analysis.competitionTypes && analysis.competitionTypes.length > 0) ||
			(analysis.competitions && analysis.competitions.length > 0) ||
			(analysis.results && analysis.results.length > 0) ||
			analysis.opponentOwnGoals === true;

		// Debug complex queries only
		if (needsFixture || !needsMatchDetail) {
			this.logToBoth(`🔍 Query: ${metric} | MatchDetail: ${needsMatchDetail} | Fixture: ${needsFixture}`, null, "log");
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
				query = `
					MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				`;
			}

			// Build WHERE conditions for enhanced filters
			const whereConditions = [];

			// Add team filter if specified
			if (teamEntities.length > 0) {
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

			// Add location filter if specified (only if not already handled by metric)
			if (locations.length > 0 && metric !== "HOME" && metric !== "AWAY") {
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

			// Add opposition filter if specified
			if (oppositionEntities.length > 0) {
				const oppositionName = oppositionEntities[0];
				whereConditions.push(`f.opposition = '${oppositionName}'`);
			}

			// Add time range filter if specified
			if (timeRange) {
				const dateRange = timeRange.split(" to ");
				if (dateRange.length === 2) {
					const startDate = this.convertDateFormat(dateRange[0].trim());
					const endDate = this.convertDateFormat(dateRange[1].trim());
					whereConditions.push(`f.date >= '${startDate}' AND f.date <= '${endDate}'`);
				}
			}

			// Add competition type filter if specified
			if (analysis.competitionTypes && analysis.competitionTypes.length > 0) {
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

			// Add competition filter if specified (but not for team-specific appearance queries)
			if (analysis.competitions && analysis.competitions.length > 0 && 
				!metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i) && 
				!metric.match(/^\d+sApps$/i)) {
				const competitionFilters = analysis.competitions.map((comp) => `f.competition CONTAINS '${comp}'`);
				whereConditions.push(`(${competitionFilters.join(" OR ")})`);
			}

			// Add result filter if specified
			if (analysis.results && analysis.results.length > 0) {
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

			// Add opponent own goals filter if specified
			if (analysis.opponentOwnGoals === true) {
				whereConditions.push(`f.oppoOwnGoals > 0`);
			}

			// Add special metric filters
			if (metric === "HOME") {
				whereConditions.push(`f.homeOrAway = 'Home'`);
			} else if (metric === "AWAY") {
				whereConditions.push(`f.homeOrAway = 'Away'`);
			}

			// Add seasonal metric filters (dynamic for any season)
			if (metric.match(/\d{4}\/\d{2}(GOALS|APPS)/i)) {
				const seasonMatch = metric.match(/(\d{4}\/\d{2})(GOALS|APPS)/i);
				if (seasonMatch) {
					const season = seasonMatch[1];
					whereConditions.push(`f.season = "${season}"`);
				}
			}

			// Add WHERE clause if we have conditions
			if (whereConditions.length > 0) {
				query += ` WHERE ${whereConditions.join(" AND ")}`;
			}

			// Add return clause
			query += ` RETURN p.playerName as playerName, ${this.getMatchDetailReturnClause(metric)}`;
		}

		// Handle special cases that need custom queries
		if (metric === "MOSTCOMMONPOSITION") {
			query = `
				MATCH (p:Player {playerName: $playerName})
				RETURN p.playerName as playerName, p.mostCommonPosition as value
			`;
		} else if (metric.toUpperCase() === "MPERG" || metric === "MperG") {
			query = `
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
			query = `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.minutes, 0)) as totalMinutes,
					sum(CASE WHEN coalesce(f.conceded, 0) = 0 THEN 1 ELSE 0 END) as totalCleanSheets
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalCleanSheets > 0 THEN toInteger(round(totalMinutes / totalCleanSheets))
						ELSE 0 
					END as value
			`;
		} else if (metric.toUpperCase() === "FTPPERAPP" || metric === "FTPperAPP") {
			query = `
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
			query = `
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
			query = `
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
			query = `
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
			query = `
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
			query = `
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
			query = `
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
			query = `
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
			query = `
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
			query = `
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
			query = `
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
			query = `
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
			query = `
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
			query = `
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
			query = `
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
			query = `
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
			query = `
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
			query = `
				MATCH (p:Player {playerName: $playerName})
				RETURN p.playerName as playerName, p.mostProlificSeason as value
			`;
		} else if (metric === "TEAM_ANALYSIS") {
			query = `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WHERE md.team IS NOT NULL
				WITH p, md.team as team, count(md) as appearances, sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END) as goals
				ORDER BY appearances DESC, goals DESC
				LIMIT 1
				RETURN p.playerName as playerName, team as value
			`;
		} else if (metric === "SEASON_ANALYSIS") {
			query = `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.season IS NOT NULL
				WITH p, collect(DISTINCT f.season) as seasons
				RETURN p.playerName as playerName, size(seasons) as value
			`;
		}

		return query;
	}

	private buildContextualResponse(playerName: string, metric: string, value: unknown, analysis: EnhancedQuestionAnalysis): string {
		// Resolve metric alias to canonical key for display and formatting
		const resolvedMetricForDisplay = findMetricByAlias(metric)?.key || metric;
		// Get the metric display name
		const metricName = getMetricDisplayName(resolvedMetricForDisplay, value as number);
		const formattedValue = this.formatValueByMetric(resolvedMetricForDisplay, value as number);
		const verb = getAppropriateVerb(metric, value as number);

		// Debug logging for percentage issues
		if (metric.includes("HomeGames%Won") || value === 51.764705) {
			this.logToBoth(
				`🔧 buildContextualResponse - metric: ${metric}, value: ${value}, formattedValue: ${formattedValue}, metricName: ${metricName}`,
				null,
				"log",
			);
		}

		// Special handling for specific metrics with custom formatting
		if (metric === "CperAPP") {
			return `${playerName} has averaged ${formattedValue} goals conceded per appearance.`;
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
		const sources = ["Neo4j Database"];

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
					answer = `${playerName} has made 0 appearances for the ${teamName}.`;
				} else {
					answer = `${playerName} has made 0 appearances.`;
				}
			}
			// Check if this is a MatchDetail query that failed - try Player node fallback
			else if (metric && ["CPERAPP", "FTPPERAPP", "GPERAPP", "MPERG", "MPERCLS"].includes((metric as string).toUpperCase())) {
				answer = `MatchDetail data unavailable: The detailed match data needed for ${metric} calculations is not available in the database. This metric requires individual match records which appear to be missing.`;
			} else {
				answer = `No data found: I couldn't find any ${metric} information for ${playerName}. This could mean the data doesn't exist in the database or the query didn't match any records.`;
			}
		} else if (data && "data" in data && Array.isArray(data.data) && data.data.length > 0) {
			if (data.type === "specific_player") {
				const playerData = data.data[0] as PlayerData;
				const playerName = data.playerName as string;
				const metric = data.metric as string;
				const value = playerData.value !== undefined ? playerData.value : 0;
				

				// Get the metric display name
				const metricName = getMetricDisplayName(metric, value as number);

				// Enhanced handling for special metrics
				if (metric === "AllGSC" || metric === "totalGoals") {
					// Build contextual response and add clarification
					answer = this.buildContextualResponse(playerName, metric, value as number, analysis);
					answer = answer.replace(".", " (including both open play and penalty goals).");
				} else if (metric === "OPENPLAYGOALS") {
					// Special handling for open play goals
					answer = `${playerName} has ${value} goals from open play.`;
				} else if (metric === "points") {
					// Build contextual response and add clarification
					answer = this.buildContextualResponse(playerName, metric, value as number, analysis);
					answer = answer.replace(".", " (Fantasy Points).");
				} else if (metric.toUpperCase() === "MOSTPROLIFICSEASON") {
					// For "What was player's most prolific season?" questions
					const questionLower = question.toLowerCase();
					if (questionLower.includes("most prolific season") || questionLower.includes("prolific season")) {
						// Use the actual query results from Cypher
						const season = value; // e.g., "2018/19"
						answer = `${playerName}'s most prolific season was ${season}.`;
					}
				} else if (metric === "MostPlayedForTeam") {
					// For "What team has player made the most appearances for?" questions
					const questionLower = question.toLowerCase();
					if (questionLower.includes("what team has") && questionLower.includes("made the most appearances for")) {
						// Use the actual query results from Cypher
						const teamName = value; // e.g., "3s"
						const appearancesCount = playerData.appearancesCount || 0;
						answer = `${playerName} has made the most appearances for the ${teamName} (${appearancesCount} appearances).`;
					}
				} else if (metric === "MostScoredForTeam") {
					// For "What team has player scored the most goals for?" questions
					const questionLower = question.toLowerCase();
					if (questionLower.includes("what team has") && questionLower.includes("scored the most goals for")) {
						// Use the actual query results from Cypher
						const teamName = value; // e.g., "4s"
						const goalsCount = playerData.goalsCount || 0;
						answer = `${playerName} has scored the most goals for the ${teamName} (${goalsCount} goals).`;
					}
				} else if (metric === "NumberTeamsPlayedFor") {
					// For "How many of the clubs teams has player played for?" questions
					const questionLower = question.toLowerCase();
					if (questionLower.includes("how many of the clubs teams has") && questionLower.includes("played for")) {
						// Use the actual query result from Cypher
						const teamsPlayedFor = value || 0;

						if (teamsPlayedFor === 0) {
							answer = `${playerName} has not played for any of the club's teams yet.`;
						} else if (teamsPlayedFor === 1) {
							answer = `${playerName} has played for 1 of the club's 8 teams.`;
						} else {
							answer = `${playerName} has played for ${teamsPlayedFor} of the club's 8 teams.`;
						}
					}
				} else if (metric === "MOSTCOMMONPOSITION") {
					// For "What is player's most common position played?" questions
					const questionLower = question.toLowerCase();
					if (
						questionLower.includes("most common position") ||
						questionLower.includes("favorite position") ||
						questionLower.includes("main position")
					) {
						// Use the actual query result from Cypher
						const position = value || "Unknown";
						answer = `${playerName}'s most common position is ${position}.`;
					}
				} else if (metric.includes("APPS") && metric.match(/\d{4}\/\d{2}/)) {
					// For season-specific appearance queries (e.g., "2017/18Apps")
					const season = metric.replace("APPS", "");
					const questionLower = question.toLowerCase();
					if (questionLower.includes("appearances") || questionLower.includes("apps") || questionLower.includes("games")) {
						answer = `${playerName} made ${value} ${value === 1 ? "appearance" : "appearances"} in the ${season} season.`;
					}
				} else if (metric.match(/^\d+sApps$/i)) {
					// For team-specific appearance queries (e.g., "1sApps", "2sApps", etc.)
					const teamNumber = metric.match(/^(\d+)sApps$/i)?.[1];
					const teamName = this.mapTeamName(`${teamNumber}s`);
					const questionLower = question.toLowerCase();
					if (questionLower.includes("appearances") || questionLower.includes("apps") || questionLower.includes("games")) {
						answer = `${playerName} has made ${value} ${value === 1 ? "appearance" : "appearances"} for the ${teamName}.`;
					}
				} else if (metric && typeof metric === 'string' && metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i)) {
					// For team-specific appearance queries (e.g., "1st XI Apps", "2nd XI Apps", etc.)
					const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Apps$/i);
					if (teamMatch) {
						const teamName = teamMatch[1] + " XI";
						answer = `${playerName} has made ${value} ${value === 1 ? "appearance" : "appearances"} for the ${teamName}.`;
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
							answer = `${playerName} has made ${value} ${value === 1 ? "appearance" : "appearances"}.`;
						}
					} else {
						// Standard metric handling with contextual response
						answer = this.buildContextualResponse(playerName, metric, value as number, analysis);
					}
				}

				// Create visualization for numerical data
				if (typeof value === "number") {
					visualization = {
						type: "NumberCard",
						data: [{ name: playerName, value: value, metric: metricName }],
						config: {
							title: `${playerName} - ${metricName}`,
							type: "bar",
						},
					};
				}
			} else if (data && data.type === "team_not_found") {
				// Handle team not found case
				this.logToBoth(`🔍 Handling team_not_found case:`, data);
				const availableTeams = (data.availableTeams as string[]) || [];
				answer = `I couldn't find the team "${data.teamName}". Available teams are: ${availableTeams.join(", ")}.`;
			} else if (data && data.type === "player_not_found") {
				// Handle player not found case
				this.logToBoth(`🔍 Handling player_not_found case:`, data);
				answer =
					(data.message as string) ||
					`I couldn't find a player named "${data.playerName}" in the database. Please check the spelling or try a different player name.`;
			} else if (data && data.type === "error") {
				// Error occurred during query
				answer = `I encountered an error while looking up team information: ${data.error}.`;
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

				if (resultCount === 0) {
					const metricName = getMetricDisplayName(metric, 0);
					answer = `No ${isTeamQuestion ? "teams" : "players"} found with ${metricName} data.`;
				} else {
					const firstResult = data.data[0] as Record<string, unknown>;
					const metricName = getMetricDisplayName(metric, firstResult.value as number);
					const topName = isTeamQuestion ? firstResult.teamName : firstResult.playerName;
					const topValue = firstResult.value;

					// Determine the appropriate text based on actual result count and requested limit
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

		// Check if user asked for a specific number (e.g., "top 3", "top 5")
		const topNumberMatch = lowerQuestion.match(/top\s+(\d+)/);
		const requestedLimit = topNumberMatch ? parseInt(topNumberMatch[1]) : 10;

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
