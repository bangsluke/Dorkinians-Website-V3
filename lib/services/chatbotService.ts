import { neo4jService } from "../../netlify/functions/lib/neo4j.js";
import { metricConfigs, findMetricByAlias, getMetricDisplayName } from "../config/chatbotMetrics";
import { statObject, QuestionType, VisualizationType } from "../../config/config";
import { getAppropriateVerb, getResponseTemplate, formatNaturalResponse } from "../config/naturalLanguageResponses";
import { EnhancedQuestionAnalyzer, EnhancedQuestionAnalysis } from "../config/enhancedQuestionAnalysis";
import { EntityNameResolver, EntityResolutionResult } from "./entityNameResolver";

export interface ChatbotResponse {
	answer: string;
	data?: any;
	visualization?: {
		type: VisualizationType;
		data: any;
		config?: any;
	};
	sources: string[];
	cypherQuery?: string;
}

export interface QuestionContext {
	question: string;
	userContext?: string;
	dataSources?: string[];
}

export class ChatbotService {
	private static instance: ChatbotService;
	private entityResolver: EntityNameResolver;

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
	private formatValueByMetric(metric: string, value: number | bigint): string {
		// Handle BigInt values from Neo4j first
		if (typeof value === 'bigint') {
			return value.toString();
		}
		
		// Find the metric config
		const metricConfig = statObject[metric as keyof typeof statObject];
		if (metricConfig && typeof metricConfig === 'object' && 'numberDecimalPlaces' in metricConfig) {
			const decimalPlaces = metricConfig.numberDecimalPlaces || 0;
			return Number(value).toFixed(decimalPlaces);
		}
		
		// Default to integer if no config found
		return Math.round(Number(value)).toString();
	}

	// Resolve player name using fuzzy matching
	private async resolvePlayerName(playerName: string): Promise<string | null> {
		try {
			const result = await this.entityResolver.resolveEntityName(playerName, 'player');
			
			if (result.exactMatch) {
				this.logToBoth(`✅ Exact match found: ${playerName} → ${result.exactMatch}`);
				return result.exactMatch;
			}
			
			if (result.fuzzyMatches.length > 0) {
				const bestMatch = result.fuzzyMatches[0];
				this.logToBoth(`🔍 Fuzzy match found: ${playerName} → ${bestMatch.entityName} (confidence: ${bestMatch.confidence.toFixed(2)})`);
				return bestMatch.entityName;
			}
			
			this.logToBoth(`❌ No match found for player: ${playerName}`);
			return null;
		} catch (error) {
			this.logToBoth(`❌ Error resolving player name: ${error}`);
			return null;
		}
	}

	// Debug tracking properties
	private lastQuestionAnalysis: any = null;
	private lastExecutedQueries: string[] = [];
	private lastProcessingSteps: string[] = [];
	private lastQueryBreakdown: any = null;
	
	// Query optimization
	private queryCache: Map<string, { data: any; timestamp: number }> = new Map();
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes


	// Helper method to log to both server and client consoles
	private logToBoth(message: string, data?: any, level: "log" | "warn" | "error" = "log") {
		// Server-side logging
		if (level === "log") {
			console.log(message, data);
		} else if (level === "warn") {
			console.warn(message, data);
		} else {
			console.error(message, data);
		}

		// Client-side logging (will show in browser console)
		// Note: This will always log to client console for debugging purposes
		if (level === "log") {
			console.log(`🤖 [CLIENT] ${message}`, data);
		} else if (level === "warn") {
			console.warn(`🤖 [CLIENT] ${message}`, data);
		} else {
			console.error(`🤖 [CLIENT] ${message}`, data);
		}
	}

	private convertDateFormat(dateStr: string): string {
		// Convert DD/MM/YYYY or DD/MM/YY to YYYY-MM-DD
		const parts = dateStr.split('/');
		if (parts.length === 3) {
			let day = parts[0].padStart(2, '0');
			let month = parts[1].padStart(2, '0');
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
		if (dateStr.includes('-') && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
			const parts = dateStr.split('-');
			const year = parts[0];
			const month = parts[1];
			const day = parts[2];
			return `${day}/${month}/${year}`;
		}
		return dateStr;
	}

	private formatTimeRange(timeRange: string): string {
		// Format a time range like "2022-03-20 to 2024-10-21" to "20/03/2022 to 21/10/2024"
		if (timeRange.includes(' to ')) {
			const [startDate, endDate] = timeRange.split(' to ');
			const formattedStart = this.formatDate(startDate.trim());
			const formattedEnd = this.formatDate(endDate.trim());
			return `${formattedStart} to ${formattedEnd}`;
		}
		return timeRange;
	}

	private mapTeamName(teamName: string): string {
		// Map common team name variations to database format
		const teamMapping: { [key: string]: string } = {
			'1s': '1st XI',
			'2s': '2nd XI', 
			'3s': '3rd XI',
			'4s': '4th XI',
			'5s': '5th XI',
			'6s': '6th XI',
			'7s': '7th XI',
			'8s': '8th XI',
			'1st': '1st XI',
			'2nd': '2nd XI',
			'3rd': '3rd XI',
			'4th': '4th XI',
			'5th': '5th XI',
			'6th': '6th XI',
			'7th': '7th XI',
			'8th': '8th XI',
			'first': '1st XI',
			'second': '2nd XI',
			'third': '3rd XI',
			'fourth': '4th XI',
			'fifth': '5th XI',
			'sixth': '6th XI',
			'seventh': '7th XI',
			'eighth': '8th XI'
		};
		
		return teamMapping[teamName.toLowerCase()] || teamName;
	}

	// Cache helper methods
	private getCacheKey(query: string, params: any): string {
		return `${query}:${JSON.stringify(params)}`;
	}

	private getCachedResult(cacheKey: string): any | null {
		const cached = this.queryCache.get(cacheKey);
		if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
			this.logToBoth(`🎯 Cache hit for query: ${cacheKey.substring(0, 50)}...`);
			return cached.data;
		}
		return null;
	}

	private setCachedResult(cacheKey: string, data: any): void {
		this.queryCache.set(cacheKey, {
			data,
			timestamp: Date.now()
		});
		this.logToBoth(`💾 Cached result for query: ${cacheKey.substring(0, 50)}...`);
	}

	async processQuestion(context: QuestionContext): Promise<ChatbotResponse> {
		// Clear debug tracking for new question
		this.lastQuestionAnalysis = null;
		this.lastExecutedQueries = [];
		this.lastProcessingSteps = [];
		this.lastQueryBreakdown = null;

		this.logToBoth(`🤖 Processing question: ${context.question}`);
		this.logToBoth(`👤 User context: ${context.userContext || "None"}`);
		
		// Basic client-side logging
		this.logToBoth("🚀 Starting question processing...");
		this.logToBoth("🚀 Question:", context.question);
		this.logToBoth("🚀 User context:", context.userContext);

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
			this.logToBoth("🔍 About to analyze question...");
			const analysis = await this.analyzeQuestion(context.question, context.userContext);
			this.lastQuestionAnalysis = analysis; // Store for debugging
			this.logToBoth("🔍 Analysis completed, type:", analysis.type);

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

			this.logToBoth(`🔍 Question analysis:`, analysis);
			this.logToBoth(`🔍 Query breakdown:`, this.lastQueryBreakdown);

			// Client-side logging for question analysis
			console.log(`🤖 [CLIENT] 🔍 Question analysis:`, analysis);
			console.log(`🤖 [CLIENT] 🔍 Query breakdown:`, this.lastQueryBreakdown);

			// Query the database
			this.lastProcessingSteps.push(`Building Cypher query for analysis: ${analysis.type}`);
			this.logToBoth("🔍 About to query database...");
			const data = await this.queryRelevantData(analysis);
			this.lastProcessingSteps.push(`Query completed, result type: ${data?.type || "null"}`);
			this.logToBoth(`📊 Query result:`, data);
			this.logToBoth("🔍 Database query completed, result type:", data?.type);

			// Generate the response
			const response = await this.generateResponse(context.question, data, analysis);
			this.logToBoth(`💬 Generated response:`, response);

			return response;
		} catch (error) {
			this.logToBoth("❌ Error processing question:", error, "error");
			this.logToBoth("❌ Error stack trace:", error instanceof Error ? error.stack : "No stack trace available", "error");
			this.logToBoth("❌ Question that failed:", context.question, "error");
			this.logToBoth("❌ User context:", context.userContext, "error");
			
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

	private async analyzeQuestion(
		question: string,
		userContext?: string,
	): Promise<EnhancedQuestionAnalysis> {
		this.logToBoth("🔍 Enhanced analyzeQuestion called with:", { question, userContext });
		this.logToBoth("🔍 Starting question analysis...");
		
		// Use enhanced question analysis
		const analyzer = new EnhancedQuestionAnalyzer(question, userContext);
		const enhancedAnalysis = await analyzer.analyze();
		
		this.logToBoth("🔍 Enhanced analysis result:", enhancedAnalysis);
		this.logToBoth("🔍 Extracted entities:", enhancedAnalysis.entities);
		this.logToBoth("🔍 Extracted metrics:", enhancedAnalysis.metrics);
		this.logToBoth("🔍 Question type:", enhancedAnalysis.type);
		this.logToBoth("🔍 Team entities:", enhancedAnalysis.teamEntities);
		this.logToBoth("🔍 Opposition entities:", enhancedAnalysis.oppositionEntities);
		this.logToBoth("🔍 Time range:", enhancedAnalysis.timeRange);
		this.logToBoth("🔍 Extraction result:", enhancedAnalysis.extractionResult);
		
		// Client-side logging for debugging
		this.logToBoth("🔍 Analysis complete:");
		this.logToBoth("🔍 - Question type:", enhancedAnalysis.type);
		this.logToBoth("🔍 - Entities:", enhancedAnalysis.entities);
		this.logToBoth("🔍 - Metrics:", enhancedAnalysis.metrics);
		this.logToBoth("🔍 - Team entities:", enhancedAnalysis.teamEntities);
		this.logToBoth("🔍 - Time range:", enhancedAnalysis.timeRange);
		this.logToBoth("🔍 - Locations:", enhancedAnalysis.extractionResult?.locations);
		
		return enhancedAnalysis;
	}

	private async queryRelevantData(analysis: EnhancedQuestionAnalysis): Promise<any> {
		this.logToBoth(`🔍 queryRelevantData called with analysis:`, analysis);
		const { type, entities, metrics } = analysis;

		this.logToBoth("🔍 queryRelevantData - type:", type);
		this.logToBoth("🔍 queryRelevantData - entities:", entities);
		this.logToBoth("🔍 queryRelevantData - metrics:", metrics);
		
		// Client-side logging for debugging
		this.logToBoth("🔍 Query routing:");
		this.logToBoth("🔍 - Question type:", type);
		this.logToBoth("🔍 - Entities to query:", entities);
		this.logToBoth("🔍 - Metrics to query:", metrics);

		try {
			// Ensure Neo4j connection before querying
			const connected = await neo4jService.connect();
			if (!connected) {
				this.logToBoth("❌ Neo4j connection failed in queryRelevantData", "error");
				return null;
			}
			this.logToBoth(`🔍 Querying for type: ${type}, entities: ${entities}, metrics: ${metrics}`);

			// 
			switch (type) {
				case "player":
					this.logToBoth(`🔍 Calling queryPlayerData for entities: ${entities}, metrics: ${metrics}`);
					const playerResult = await this.queryPlayerData(entities, metrics, analysis);
					this.logToBoth(`🔍 queryPlayerData returned:`, playerResult);
					return playerResult;
				case "team":
					this.logToBoth(`🔍 Calling queryTeamData...`);
					return await this.queryTeamData(entities, metrics);
				case "club":
					this.logToBoth(`🔍 Calling queryClubData...`);
					return await this.queryClubData(entities, metrics);
				case "fixture":
					this.logToBoth(`🔍 Calling queryFixtureData...`);
					return await this.queryFixtureData(entities, metrics);
				case "comparison":
					this.logToBoth(`🔍 Calling queryComparisonData...`);
					return await this.queryComparisonData(entities, metrics);
				case "streak":
					this.logToBoth(`🔍 Calling queryStreakData...`);
					return await this.queryStreakData(entities, metrics);
				case "temporal":
					this.logToBoth(`🔍 Calling queryTemporalData...`);
					return await this.queryTemporalData(entities, metrics, analysis.timeRange);
				case "double_game":
					this.logToBoth(`🔍 Calling queryDoubleGameData...`);
					return await this.queryDoubleGameData(entities, metrics);
				case "ranking":
					this.logToBoth(`🔍 Calling queryRankingData...`);
					return await this.queryRankingData(entities, metrics, analysis);
				case "general":
					this.logToBoth(`🔍 Calling queryGeneralData...`);
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

	private async queryPlayerData(entities: string[], metrics: string[], analysis: EnhancedQuestionAnalysis): Promise<any> {
		// Use enhanced analysis data directly
		const teamEntities = analysis.teamEntities || [];
		const oppositionEntities = analysis.oppositionEntities || [];
		const timeRange = analysis.timeRange;
		const locations = analysis.extractionResult?.locations || [];
		
		this.logToBoth(`🔍 Enhanced analysis data:`, {
			teamEntities,
			oppositionEntities,
			timeRange,
			locations
		});
		this.logToBoth(`🔍 queryPlayerData called with entities: ${entities}, metrics: ${metrics}`);
		this.logToBoth(`🔍 Full analysis object:`, analysis);
		
		// Client-side logging for debugging
		this.logToBoth("🔍 Player query setup:");
		this.logToBoth("🔍 - Entities:", entities);
		this.logToBoth("🔍 - Metrics:", metrics);
		this.logToBoth("🔍 - Team entities:", teamEntities);
		this.logToBoth("🔍 - Time range:", timeRange);
		this.logToBoth("🔍 - Locations:", locations);

		// Check if we have entities (player names) to query
		if (entities.length === 0) {
			return { type: "no_context", data: [], message: "No player context provided" };
		}

		// If we have a specific player name and metrics, query their stats
		if (entities.length > 0 && metrics.length > 0) {
			const playerName = entities[0];
			const metric = metrics[0];

			this.logToBoth(`🎯 Querying for player: ${playerName}, metric: ${metric}`);

			// Check if this is a team-specific question
			// First check if the player name itself is a team
			if (playerName.match(/^\d+(?:st|nd|rd|th)?$/)) {
				this.logToBoth(`🔍 Detected team-specific question for team: ${playerName}`);
				return await this.queryTeamSpecificPlayerData(playerName, metric);
			}

			// Resolve player name with fuzzy matching
			this.logToBoth("🔍 Player name resolution:");
			this.logToBoth("🔍 - Input entity:", playerName);
			
			const resolvedPlayerName = await this.resolvePlayerName(playerName);
			this.logToBoth("🔍 - Resolved player name:", resolvedPlayerName);
			
			if (!resolvedPlayerName) {
				this.logToBoth("❌ Player not found:", playerName);
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
					metric
				};
			}

			// Use resolved player name for all subsequent queries
			const actualPlayerName = resolvedPlayerName;

			// Check if there are team entities in the analysis
			if (analysis && analysis.teamEntities && analysis.teamEntities.length > 0) {
				const teamEntity = analysis.teamEntities[0];
				this.logToBoth(`🔍 Detected team entity in question: ${teamEntity}`);
				this.logToBoth(`🔍 Will use enhanced query with team filter instead of separate team method`);
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
				const oppositionName = analysis.oppositionEntities[0];
				this.logToBoth(`🔍 Detected opposition entity in question: ${oppositionName}`);
				this.logToBoth(`🔍 Will use enhanced query with all filters instead of separate opposition method`);
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

			// Check if we need Fixture relationship for any filters
			// Optimization: Only include Fixture relationship when filtering by:
			// - Team references (1st XI, 2s, etc.)
			// - Competition types (League, cup, friendly)
			// - Competition names (Premier, Intermediate South, etc.)
			// - Opposition team names
			// - Home/away locations
			// - Results (wins, draws, losses, W, D, L)
			// - Opponent own goals
			// This improves query performance for simple appearance/stat queries that don't need Fixture data
			const needsFixture = teamEntities.length > 0 || 
								locations.length > 0 || 
								timeRange || 
								oppositionEntities.length > 0 || 
								metrics.includes('HOME') || 
								metrics.includes('AWAY') ||
								(analysis.competitionTypes && analysis.competitionTypes.length > 0) ||
								(analysis.competitions && analysis.competitions.length > 0) ||
								(analysis.results && analysis.results.length > 0) ||
								(analysis.opponentOwnGoals === true);
			
			this.logToBoth(`🔍 Query optimization: needsFixture = ${needsFixture}`);
			this.logToBoth(`🔍 - Team filters: ${teamEntities.length > 0 ? teamEntities : 'none'}`);
			this.logToBoth(`🔍 - Location filters: ${locations.length > 0 ? locations : 'none'}`);
			this.logToBoth(`🔍 - Opposition filters: ${oppositionEntities.length > 0 ? oppositionEntities : 'none'}`);
			this.logToBoth(`🔍 - Time range: ${timeRange || 'none'}`);
			this.logToBoth(`🔍 - HOME/AWAY metrics: ${metrics.includes('HOME') || metrics.includes('AWAY') ? metrics.filter(m => m === 'HOME' || m === 'AWAY') : 'none'}`);
			this.logToBoth(`🔍 - Competition types: ${analysis.competitionTypes && analysis.competitionTypes.length > 0 ? analysis.competitionTypes : 'none'}`);
			this.logToBoth(`🔍 - Competitions: ${analysis.competitions && analysis.competitions.length > 0 ? analysis.competitions : 'none'}`);
			this.logToBoth(`🔍 - Results: ${analysis.results && analysis.results.length > 0 ? analysis.results : 'none'}`);
			this.logToBoth(`🔍 - Opponent own goals: ${analysis.opponentOwnGoals || false}`);
			
			// Build query with exact player name matching (dropdown provides exact casing)
			let query = `
				MATCH (p:Player {playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail)
			`;
			
			// Only add Fixture relationship if we need it for filtering
			if (needsFixture) {
				query += `MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)\n`;
				this.logToBoth("🔍 Added Fixture relationship for filtering");
			} else {
				this.logToBoth("🔍 Skipped Fixture relationship - no filters requiring it");
			}

			// Build WHERE conditions for enhanced filters
			const whereConditions = [];
			
			// Add team filter if specified
			if (teamEntities.length > 0) {
				const mappedTeamNames = teamEntities.map(team => this.mapTeamName(team));
				const teamNames = mappedTeamNames.map(team => `'${team}'`).join(', ');
				whereConditions.push(`f.team IN [${teamNames}]`);
				this.logToBoth(`🔍 Team mapping: ${teamEntities} → ${mappedTeamNames}`);
				this.logToBoth("🔍 Team filter:");
				this.logToBoth("🔍 - Original teams:", teamEntities);
				this.logToBoth("🔍 - Mapped teams:", mappedTeamNames);
			}
			
			// Add location filter if specified
			if (locations.length > 0) {
				const locationFilters = locations.map(loc => {
					if (loc.type === 'home') return `f.homeOrAway = 'Home'`;
					if (loc.type === 'away') return `f.homeOrAway = 'Away'`;
					return null;
				}).filter(Boolean);
				if (locationFilters.length > 0) {
					whereConditions.push(`(${locationFilters.join(' OR ')})`);
				}
				this.logToBoth("🔍 Location filter:");
				this.logToBoth("🔍 - Locations:", locations);
				this.logToBoth("🔍 - Location filters:", locationFilters);
			}
			
			// Add opposition filter if specified
			if (oppositionEntities.length > 0) {
				const oppositionName = oppositionEntities[0];
				whereConditions.push(`f.opposition = '${oppositionName}'`);
				this.logToBoth("🔍 Opposition filter:");
				this.logToBoth("🔍 - Opposition:", oppositionName);
			}
			
			// Add time range filter if specified
			if (timeRange) {
				// Parse time range (assuming format like "20/03/2022 to 21/10/24")
				const dateRange = timeRange.split(' to ');
				if (dateRange.length === 2) {
					const startDate = this.convertDateFormat(dateRange[0].trim());
					const endDate = this.convertDateFormat(dateRange[1].trim());
					whereConditions.push(`f.date >= '${startDate}' AND f.date <= '${endDate}'`);
					this.logToBoth("🔍 Date filter:");
					this.logToBoth("🔍 - Original time range:", timeRange);
					this.logToBoth("🔍 - Start date:", `${dateRange[0].trim()} → ${startDate}`);
					this.logToBoth("🔍 - End date:", `${dateRange[1].trim()} → ${endDate}`);
				}
			}

			// Add competition type filter if specified
			if (analysis.competitionTypes && analysis.competitionTypes.length > 0) {
				const compTypeFilters = analysis.competitionTypes.map(compType => {
					switch (compType.toLowerCase()) {
						case 'league': return `f.compType = 'League'`;
						case 'cup': return `f.compType = 'Cup'`;
						case 'friendly': return `f.compType = 'Friendly'`;
						default: return null;
					}
				}).filter(Boolean);
				if (compTypeFilters.length > 0) {
					whereConditions.push(`(${compTypeFilters.join(' OR ')})`);
				}
				this.logToBoth("🔍 Competition type filter:");
				this.logToBoth("🔍 - Competition types:", analysis.competitionTypes);
				this.logToBoth("🔍 - Competition type filters:", compTypeFilters);
			}

			// Add competition filter if specified
			if (analysis.competitions && analysis.competitions.length > 0) {
				const competitionFilters = analysis.competitions.map(comp => `f.competition CONTAINS '${comp}'`);
				whereConditions.push(`(${competitionFilters.join(' OR ')})`);
				this.logToBoth("🔍 Competition filter:");
				this.logToBoth("🔍 - Competitions:", analysis.competitions);
				this.logToBoth("🔍 - Competition filters:", competitionFilters);
			}

			// Add result filter if specified
			if (analysis.results && analysis.results.length > 0) {
				const resultFilters = analysis.results.map(result => {
					switch (result.toLowerCase()) {
						case 'win':
						case 'w':
							return `f.result = 'W'`;
						case 'draw':
						case 'd':
							return `f.result = 'D'`;
						case 'loss':
						case 'l':
							return `f.result = 'L'`;
						default:
							return null;
					}
				}).filter(Boolean);
				if (resultFilters.length > 0) {
					whereConditions.push(`(${resultFilters.join(' OR ')})`);
				}
				this.logToBoth("🔍 Result filter:");
				this.logToBoth("🔍 - Results:", analysis.results);
				this.logToBoth("🔍 - Result filters:", resultFilters);
			}

			// Add opponent own goals filter if specified
			if (analysis.opponentOwnGoals === true) {
				whereConditions.push(`f.oppoOwnGoals > 0`);
				this.logToBoth("🔍 Opponent own goals filter: enabled");
			}

			// Add WHERE clause if we have conditions
			if (whereConditions.length > 0) {
				query += ` WHERE ${whereConditions.join(' AND ')}`;
				this.logToBoth("🔍 WHERE conditions:");
				this.logToBoth("🔍 - Conditions:", whereConditions);
			}

			let returnClause = "";
			switch (metric) {
				case "APP":
					returnClause = "RETURN p.playerName as playerName, count(md) as value";
					break;
				case "MIN":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.minutes IS NULL OR md.minutes = "" THEN 0 ELSE md.minutes END), 0) as value';
					break;
				case "G":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) as value';
					break;
				case "AllGSC":
					// Total goals (open play + penalties)
					returnClause = `
						RETURN p.playerName as playerName, 
						       coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
						       coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as value
					`;
					break;
				case "A":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.assists IS NULL OR md.assists = "" THEN 0 ELSE md.assists END), 0) as value';
					break;
				case "MOM":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.mom IS NULL OR md.mom = "" THEN 0 ELSE md.mom END), 0) as value';
					break;
				case "Y":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.yellowCards IS NULL OR md.yellowCards = "" THEN 0 ELSE md.yellowCards END), 0) as value';
					break;
				case "R":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.redCards IS NULL OR md.redCards = "" THEN 0 ELSE md.redCards END), 0) as value';
					break;
				case "SAVES":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.saves IS NULL OR md.saves = "" THEN 0 ELSE md.saves END), 0) as value';
					break;
				case "OG":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.ownGoals IS NULL OR md.ownGoals = "" THEN 0 ELSE md.ownGoals END), 0) as value';
					break;
				case "C":
					// Goals conceded - get from Player node
					returnClause = "RETURN p.playerName as playerName, coalesce(p.conceded, 0) as value";
					break;
				case "CLS":
					// Clean sheets - get from Player node
					returnClause = "RETURN p.playerName as playerName, coalesce(p.cleanSheets, 0) as value";
					break;
				case "PSC":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as value';
					break;
				case "PM":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.penaltiesMissed IS NULL OR md.penaltiesMissed = "" THEN 0 ELSE md.penaltiesMissed END), 0) as value';
					break;
				case "PCO":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.penaltiesConceded IS NULL OR md.penaltiesConceded = "" THEN 0 ELSE md.penaltiesConceded END), 0) as value';
					break;
				case "PSV":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.penaltiesSaved IS NULL OR md.penaltiesSaved = "" THEN 0 ELSE md.penaltiesSaved END), 0) as value';
					break;
				case "FTP":
					// Fantasy points - get from Player node
					returnClause = "RETURN p.playerName as playerName, coalesce(p.fantasyPoints, 0) as value";
					break;
				case "GI":
					// Goal involvements - sum of goals and assists
					returnClause = `
						RETURN p.playerName as playerName, 
						       coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
						       coalesce(sum(CASE WHEN md.assists IS NULL OR md.assists = "" THEN 0 ELSE md.assists END), 0) as value
					`;
					break;
				case "GperAPP":
					// Goals per appearance - get from Player node (try both property names for compatibility)
					returnClause = "RETURN p.playerName as playerName, coalesce(p.goalsPerApp, p.GperAPP, 0) as value";
					break;
				case "CperAPP":
					// Conceded per appearance - get from Player node (try both property names for compatibility)
					returnClause = "RETURN p.playerName as playerName, coalesce(p.concededPerApp, p.CperAPP, 0) as value";
					break;
				case "MperG":
					// Minutes per goal - get from Player node (try both property names for compatibility)
					// If stored value is 0 or missing, calculate from minutes and goals
					returnClause = `
						RETURN p.playerName as playerName, 
						       CASE 
						         WHEN coalesce(p.minutesPerGoal, p.MperG, 0) > 0 THEN coalesce(p.minutesPerGoal, p.MperG, 0)
						         ELSE CASE 
						           WHEN coalesce(p.goals, 0) > 0 THEN coalesce(p.minutes, 0) / coalesce(p.goals, 1)
						           ELSE 0
						         END
						       END as value
					`;
					break;
				case "DIST":
					// Distance travelled - get from Player node
					returnClause = "RETURN p.playerName as playerName, coalesce(p.distance, 0) as value";
					break;
				case "HOME":
					// Home games - filter by home/away flag
					whereConditions.push(`f.homeOrAway = 'Home'`);
					returnClause = "RETURN p.playerName as playerName, count(md) as value";
					break;
				case "AWAY":
					// Away games - filter by home/away flag
					whereConditions.push(`f.homeOrAway = 'Away'`);
					returnClause = "RETURN p.playerName as playerName, count(md) as value";
					break;
				case "MOST_PROLIFIC_SEASON":
					// Most prolific season - find season with most goals
					query = `
						MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
						WHERE md.season IS NOT NULL
						WITH p, md.season as season, sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END) as goals
						ORDER BY goals DESC
						LIMIT 1
						RETURN p.playerName as playerName, season as value
					`;
					returnClause = "";
					break;
				case "TEAM_ANALYSIS":
					// Team analysis - find team with most appearances or goals
					query = `
						MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
						WHERE md.team IS NOT NULL
						WITH p, md.team as team, count(md) as appearances, sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END) as goals
						ORDER BY appearances DESC, goals DESC
						LIMIT 1
						RETURN p.playerName as playerName, team as value
					`;
					returnClause = "";
					break;
				case "SEASON_ANALYSIS":
					// Season analysis - count unique seasons
					query = `
						MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
						WHERE md.season IS NOT NULL
						WITH p, collect(DISTINCT md.season) as seasons
						RETURN p.playerName as playerName, size(seasons) as value
					`;
					returnClause = "";
					break;
				default:
					returnClause = "RETURN p.playerName as playerName, 0 as value";
						break;
					}

			// Complete the query
			query += ` ${returnClause}`;
			
			this.logToBoth(`🔍 Final Cypher query:`, query);
			this.logToBoth(`🔍 Query parameters:`, { playerName });
			
			this.logToBoth("🔍 Final query:");
			this.logToBoth("🔍 - Cypher query:", query);
			this.logToBoth("🔍 - Parameters:", { playerName });

			try {
				// First check if the player exists
				const playerExistsQuery = `MATCH (p:Player {playerName: $playerName}) RETURN p.playerName as playerName LIMIT 1`;
				this.logToBoth("🔍 Checking if player exists...");
				const playerExistsResult = await neo4jService.executeQuery(playerExistsQuery, { playerName });
				this.logToBoth("🔍 Player exists result:", playerExistsResult);
				
				if (!playerExistsResult || playerExistsResult.length === 0) {
					this.logToBoth(`🔍 Player ${playerName} not found in database`);
					this.logToBoth("❌ Player not found in database:", playerName);
					return { 
						type: "player_not_found", 
						data: [], 
						message: `I couldn't find a player named "${playerName}" in the database. Please check the spelling or try a different player name.`,
						playerName,
						metric
					};
				}
				this.logToBoth(`🔍 Query parameters: playerName=${playerName}`);

			// Special logging for APP metric
			if (metric === "APP") {
					this.logToBoth("🔍 APP metric - About to call neo4jService.executeQuery", "log");
				}

				// Store query for debugging
				this.lastExecutedQueries.push(`PLAYER_DATA: ${query}`);
				this.lastExecutedQueries.push(`PARAMS: ${JSON.stringify({ playerName })}`);
				
				// Create ready-to-execute query for debugging
				const readyToExecuteQuery = query.replace(/\$playerName/g, `'${playerName}'`);
				this.lastExecutedQueries.push(`READY_TO_EXECUTE: ${readyToExecuteQuery}`);
				
				// Log copyable queries for debugging
				this.logToBoth(`🔍 CYPHER QUERY (with parameters):`, query);
				this.logToBoth(`🔍 CYPHER QUERY (ready to execute):`, readyToExecuteQuery);
				this.logToBoth(`🔍 QUERY PARAMETERS:`, { playerName });

				this.logToBoth("🔍 Executing main query...");
				const result = await neo4jService.executeQuery(query, {
					playerName,
				});
				this.logToBoth("🔍 Query result:", result);

				// Special logging for APP metric
				if (metric === "APP") {
					this.logToBoth("🔍 APP metric - Query executed successfully", "log");
					this.logToBoth("🔍 APP metric - Result:", result, "log");
				}

				this.logToBoth(`🔍 Result type: ${typeof result}, length: ${Array.isArray(result) ? result.length : "not array"}`);

				if (result && Array.isArray(result) && result.length > 0) {
					this.logToBoth(`🔍 First result item:`, result[0]);
					this.logToBoth("✅ Query returned results:", `${result.length} items`);
					this.logToBoth("🔍 First result:", result[0]);
				} else {
					this.logToBoth(`🔍 No results found for ${playerName}. Player may not exist or have no match data.`);
					this.logToBoth("❌ No results found for query");
					this.logToBoth("🔍 Result was:", result);
				}

				return { type: "specific_player", data: result, playerName, metric, cypherQuery: query };
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

		this.logToBoth(`🔍 No specific player query, falling back to general player query`);

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



	private async queryTeamData(entities: string[], metrics: string[]): Promise<any> {
		this.logToBoth(`🔍 queryTeamData called with entities: ${entities}, metrics: ${metrics}`);

		const query = `
      MATCH (t:Team)
      RETURN t.name as name, t.id as source
			LIMIT 20
		`;

		const params = { graphLabel: neo4jService.GRAPH_LABEL };
		const result = await neo4jService.executeQuery(query, params);
		this.logToBoth(`🔍 Team data query result:`, result);
		
		return { type: "team", data: result };
	}

	private async queryClubData(entities: string[], metrics: string[]): Promise<any> {
		const query = `
      MATCH (c:Club)
      RETURN c.name as name, c.id as source
      LIMIT 10
    `;

		const result = await neo4jService.executeQuery(query);
		return result;
	}

	private async queryFixtureData(entities: string[], metrics: string[]): Promise<any> {
		const query = `
      MATCH (f:Fixture)
      RETURN f.opponent as opponent, f.date as date
      LIMIT 10
    `;

		const result = await neo4jService.executeQuery(query);
		return result;
	}



	private async queryDoubleGameData(entities: string[], metrics: string[]): Promise<any> {
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

	private async queryGeneralData(): Promise<any> {
		// Query for general information about the database
		const query = `
      MATCH (p:Player)
      RETURN count(p) as totalPlayers
    `;

		const result = await neo4jService.executeQuery(query);
		return result;
	}

	private buildContextualResponse(playerName: string, metric: string, value: any, analysis: any): string {
		// Get the metric display name
		const metricName = getMetricDisplayName(metric, value);
		const formattedValue = this.formatValueByMetric(metric, value);
		const verb = getAppropriateVerb(metric, value);
		
		// Start with the basic response
		let response = `${playerName} has ${verb} ${formattedValue} ${metricName}`;
		
		// Add team context if present
		if (analysis.teamEntities && analysis.teamEntities.length > 0) {
			const teamName = this.mapTeamName(analysis.teamEntities[0]);
			response += ` for the ${teamName}`;
		}
		
		// Add location context if present
		const locations = analysis.locations || (analysis.extractionResult && analysis.extractionResult.locations) || [];
		if (locations && locations.length > 0) {
			const location = locations[0].value;
			if (location === 'home') {
				response += ` whilst playing at home`;
			} else if (location === 'away') {
				response += ` whilst playing away`;
			}
		}
		
		// Add time range context if present
		if (analysis.timeRange && analysis.timeRange.includes(' to ')) {
			const formattedTimeRange = this.formatTimeRange(analysis.timeRange);
			response += ` between ${formattedTimeRange}`;
		} else if (analysis.timeRange) {
			const formattedDate = this.formatDate(analysis.timeRange);
			response += ` on ${formattedDate}`;
		}
		
		// Add period for final sentence
		response += '.';
		
		return response;
	}

	private async generateResponse(question: string, data: any, analysis: any): Promise<ChatbotResponse> {
		this.logToBoth(`🔍 generateResponse called with:`, {
			question,
			dataType: data?.type,
			dataLength: Array.isArray(data?.data) ? data.data.length : "not array",
			analysisType: analysis?.type,
		});

		let answer = "I couldn't find relevant information for your question.";
		let visualization: any = null;
		const sources = ["Neo4j Database"];

		if (data && data.data) {
			if (data.type === "specific_player" && data.data.length > 0) {
				const playerData = data.data[0];
				const playerName = data.playerName;
				const metric = data.metric;
				const value = playerData.value || 0;

				// Get the metric display name
				const metricName = getMetricDisplayName(metric, value);

				// Enhanced handling for special metrics
				if (metric === "AllGSC" || metric === "totalGoals") {
					// Build contextual response and add clarification
					answer = this.buildContextualResponse(playerName, metric, value, analysis);
					answer = answer.replace(".", " (including both open play and penalty goals).");
				} else if (metric === "points") {
					// Build contextual response and add clarification
					answer = this.buildContextualResponse(playerName, metric, value, analysis);
					answer = answer.replace(".", " (Fantasy Points).");
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
						answer = this.buildContextualResponse(playerName, metric, value, analysis);
					}
				}

				// Create visualization for numerical data
				if (typeof value === "number") {
					visualization = {
						type: "stats",
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
				answer = `I couldn't find the team "${data.teamName}". Available teams are: ${data.availableTeams.join(", ")}.`;
			} else if (data && data.type === "player_not_found") {
				// Handle player not found case
				this.logToBoth(`🔍 Handling player_not_found case:`, data);
				answer = data.message || `I couldn't find a player named "${data.playerName}" in the database. Please check the spelling or try a different player name.`;
			} else if (data && data.type === "error") {
				// Error occurred during query
				answer = `I encountered an error while looking up team information: ${data.error}.`;
			} else if (data && data.type === "general_players" && data.data && data.data.length > 0) {
				if (data.data[0].playerCount) {
					// General player count question
					answer = `The club currently has ${data.data[0].playerCount} registered players across all teams.`;
					visualization = {
						type: "stats",
						data: [{ name: "Total Players", value: data.data[0].playerCount }],
						config: { title: "Club Statistics", type: "bar" },
					};
				} else {
					// List of players
					const playerNames = data.data.map((p: any) => p.name || p.playerName).slice(0, 10);
					answer = `Here are some players in the database: ${playerNames.join(", ")}.`;
					}
				} else if (data && data.type === "team_specific" && data.data && data.data.length > 0) {
					// Team-specific query (e.g., "3rd team goals")
					const teamName = data.teamName;
					const metric = data.metric;
					const topPlayer = data.data[0];
					const metricName = getMetricDisplayName(metric, topPlayer.value);

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
							topPlayer.playerName,
							metric,
							topPlayer.value,
							metricName,
							teamName
						);
						} else {
						// Fallback if no template found
						answer = `${topPlayer.playerName} has ${getAppropriateVerb(metric, topPlayer.value)} the most ${metricName} for the ${teamName} with ${topPlayer.value}.`;
						}
					} else {
						// Use team-specific template for regular questions
						const template = getResponseTemplate("team_specific", "Team-specific player statistics");
						if (template) {
						answer = formatNaturalResponse(
							template.template,
							topPlayer.playerName,
							metric,
							topPlayer.value,
							metricName,
							teamName
						);
						} else {
						// Fallback if no template found
						answer = `For the ${teamName}, ${topPlayer.playerName} has ${getAppropriateVerb(metric, topPlayer.value)} ${topPlayer.value} ${metricName}.`;
					}
				}

				// Create visualization for team data
					visualization = {
						type: "table",
					data: data.data.slice(0, 10).map((player: any) => ({
						Player: player.playerName,
						[metricName]: player.value,
					})),
					config: {
						title: `${teamName} - Top ${metricName}`,
						type: "table",
					},
				};
			} else if (data && data.type === "streak" && data.data && data.data.length > 0) {
				// Handle streak data
				const playerName = data.playerName;
				const streakData = data.data;
				answer = `${playerName} has scored in ${streakData.length} games.`;

						visualization = {
					type: "chart",
					data: streakData.map((game: any) => ({
						date: game.date,
						goals: game.goals,
					})),
					config: {
						title: `${playerName} - Goal Scoring Streak`,
						type: "line",
					},
				};
			} else if (data && data.type === "double_game" && data.data && data.data.length > 0) {
				// Handle double game week data
				const playerName = data.playerName;
				const dgwData = data.data;
				const totalGoals = dgwData.reduce((sum: number, game: any) => sum + (game.goals || 0), 0);
				const totalAssists = dgwData.reduce((sum: number, game: any) => sum + (game.assists || 0), 0);

				answer = `${playerName} has played ${dgwData.length} double game weeks, scoring ${totalGoals} goals and providing ${totalAssists} assists.`;

						visualization = {
							type: "table",
					data: dgwData.map((game: any) => ({
						Date: game.date,
						Goals: game.goals || 0,
						Assists: game.assists || 0,
					})),
					config: {
						title: `${playerName} - Double Game Week Performance`,
						type: "table",
					},
				};
				} else if (data && data.type === "totw_awards" && data.data && data.data.length > 0) {
				// Handle TOTW awards
				const playerName = data.playerName;
				const period = data.period;
				const awards = data.data.length;
				const periodText = period === "weekly" ? "weekly" : "season";

				answer = `${playerName} has received ${awards} ${periodText} Team of the Week award${awards === 1 ? "" : "s"}.`;

						visualization = {
					type: "stats",
					data: [{ name: `${periodText.charAt(0).toUpperCase() + periodText.slice(1)} TOTW Awards`, value: awards }],
							config: {
						title: `${playerName} - ${periodText.charAt(0).toUpperCase() + periodText.slice(1)} TOTW Awards`,
						type: "bar",
							},
						};
				} else if (data && data.type === "potm_awards" && data.data && data.data.length > 0) {
				// Handle Player of the Month awards
				const playerName = data.playerName;
				const awards = data.data.length;

				answer = `${playerName} has received ${awards} Player of the Month award${awards === 1 ? "" : "s"}.`;

						visualization = {
					type: "stats",
					data: [{ name: "Player of the Month Awards", value: awards }],
							config: {
						title: `${playerName} - Player of the Month Awards`,
						type: "bar",
							},
						};
				} else if (data && data.type === "captain_awards" && data.data && data.data.length > 0) {
				// Handle Captain awards
				const playerName = data.playerName;
				const awards = data.data.length;

				answer = `${playerName} has been captain ${awards} time${awards === 1 ? "" : "s"}.`;

						visualization = {
					type: "stats",
					data: [{ name: "Captain Awards", value: awards }],
							config: {
						title: `${playerName} - Captain Awards`,
						type: "bar",
							},
						};
				} else if (data && data.type === "co_players" && data.data && data.data.length > 0) {
				// Handle co-players data
				const playerName = data.playerName;
				const coPlayers = data.data.slice(0, 10);

				answer = `${playerName} has played with ${coPlayers.length} different players. Top co-players: ${coPlayers
					.map((p: any) => p.coPlayerName)
					.join(", ")}.`;

						visualization = {
							type: "table",
					data: coPlayers.map((player: any) => ({
						"Co-Player": player.coPlayerName,
						"Games Together": player.gamesPlayedTogether,
					})),
							config: {
						title: `${playerName} - Co-Players`,
						type: "table",
							},
						};
				} else if (data && data.type === "opponents" && data.data && data.data.length > 0) {
				// Handle opponents data
				const playerName = data.playerName;
				const opponents = data.data.slice(0, 10);

				answer = `${playerName} has played against ${opponents.length} different opponents. Top opponents: ${opponents
					.map((o: any) => o.opponent)
					.join(", ")}.`;

						visualization = {
							type: "table",
					data: opponents.map((opponent: any) => ({
						Opponent: opponent.opponent,
						"Games Played": opponent.gamesPlayed,
					})),
							config: {
						title: `${playerName} - Opponents`,
						type: "table",
					},
				};
			} else if (data && data.type === "temporal" && data.data && data.data.length > 0) {
				// Handle temporal data
				const playerName = data.playerName;
				const metric = data.metric;
				const timeRange = data.timeRange;
				const result = data.data[0];

				const metricName = getMetricDisplayName(metric, result.value);
				const timeText = timeRange ? ` ${timeRange}` : "";

				answer = `${playerName} has ${getAppropriateVerb(metric, result.value)} ${result.value} ${metricName}${timeText}.`;

				visualization = {
					type: "stats",
					data: [{ name: metricName, value: result.value }],
					config: {
						title: `${playerName} - ${metricName}${timeText}`,
						type: "bar",
					},
				};
			} else if (data && data.type === "player_team" && data.data && data.data.length > 0) {
				// Handle player-team specific data
				const playerName = data.playerName;
				const teamName = data.teamName;
				const metric = data.metric;
				const result = data.data[0];

				const metricName = getMetricDisplayName(metric, result.value);

				answer = `${playerName} has ${getAppropriateVerb(metric, result.value)} ${result.value} ${metricName} for the ${teamName}.`;

				visualization = {
					type: "stats",
					data: [{ name: metricName, value: result.value }],
					config: {
						title: `${playerName} - ${metricName} (${teamName})`,
						type: "bar",
					},
				};
			} else if (data && data.type === "opposition" && data.data && data.data.length > 0) {
				// Handle opposition-specific data
				const playerName = data.playerName;
				const metric = data.metric;
				const oppositionName = data.oppositionName;
				const result = data.data[0];

				const metricName = getMetricDisplayName(metric, result.value);

				if (oppositionName) {
					// Specific opposition query
					answer = `${playerName} has ${getAppropriateVerb(metric, result.value)} ${result.value} ${metricName} against ${oppositionName}.`;
				} else {
					// All oppositions query (most goals against)
					const topOpposition = data.data[0];
					answer = `${playerName} has scored the most ${metricName} against ${topOpposition.opposition} (${topOpposition.value}).`;
				}

				visualization = {
					type: "stats",
					data: data.data.slice(0, 10).map((opp: any) => ({
						name: opp.opposition || oppositionName,
						value: opp.value,
					})),
					config: {
						title: `${playerName} - ${metricName} vs Opposition`,
						type: "bar",
					},
				};
			} else if (data && data.type === "ranking" && data.data) {
				// Handle ranking data (top players/teams)
				const metric = data.metric;
				const isPlayerQuestion = data.isPlayerQuestion;
				const isTeamQuestion = data.isTeamQuestion;
				const resultCount = data.data.length;
				const requestedLimit = data.requestedLimit || 10;
				
				if (resultCount === 0) {
					const metricName = getMetricDisplayName(metric, 0);
					answer = `No ${isTeamQuestion ? 'teams' : 'players'} found with ${metricName} data.`;
				} else {
					const metricName = getMetricDisplayName(metric, data.data[0].value);
					const topResult = data.data[0];
					const topName = isTeamQuestion ? topResult.teamName : topResult.playerName;
					const topValue = topResult.value;
					
					// Determine the appropriate text based on actual result count and requested limit
					const countText = resultCount === 1 ? "1" : 
									 resultCount < requestedLimit ? `top ${resultCount}` : 
									 requestedLimit === 10 ? "top 10" : `top ${requestedLimit}`;
					
					if (isPlayerQuestion) {
						answer = `The player with the highest ${metricName} is ${topName} with ${topValue}. Here are the ${countText} players:`;
					} else if (isTeamQuestion) {
						answer = `The team with the highest ${metricName} is the ${topName} with ${topValue}. Here are the ${countText} teams:`;
					} else {
						answer = `The highest ${metricName} is ${topName} with ${topValue}. Here are the ${countText}:`;
					}

					visualization = {
						type: "table",
						data: data.data.map((item: any, index: number) => ({
							rank: index + 1,
							name: isTeamQuestion ? item.teamName : item.playerName,
							value: item.value,
						})),
						config: {
							title: `${countText.charAt(0).toUpperCase() + countText.slice(1)} ${isTeamQuestion ? 'Teams' : 'Players'} - ${metricName}`,
							type: "table",
							columns: [
								{ key: "rank", label: "Rank" },
								{ key: "name", label: isTeamQuestion ? "Team" : "Player" },
								{ key: "value", label: metricName }
							]
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
			cypherQuery: data?.cypherQuery || "N/A",
		};
	}

	/**
	 * Get the appropriate metric field for a given metric code
	 */
	private getMetricField(metric: string): string {
		const metricConfig = findMetricByAlias(metric);
		return metricConfig?.key || metric;
	}

	/**
	 * Check if the question is about a specific team
	 */
	private isTeamQuestion(question: string): boolean {
		const lowerQuestion = question.toLowerCase();

		// Team-related keywords
		const teamKeywords = [
			"team",
			"1s",
			"2s",
			"3s",
			"4s",
			"5s",
			"6s",
			"7s",
			"8s",
			"first team",
			"second team",
			"third team",
			"fourth team",
			"fifth team",
			"sixth team",
			"seventh team",
			"eighth team",
		];

		return teamKeywords.some((keyword) => lowerQuestion.includes(keyword));
	}

	/**
	 * Check if the question is asking for a comparison
	 */
	private isComparisonQuestion(question: string): boolean {
		const lowerQuestion = question.toLowerCase();

		// Comparison keywords
		const comparisonKeywords = [
			"most",
			"least",
			"highest",
			"lowest",
			"best",
			"worst",
			"top",
			"bottom",
			"who has",
			"which player",
			"compared to",
			"versus",
			"vs",
		];

		return comparisonKeywords.some((keyword) => lowerQuestion.includes(keyword));
	}

	// Enhanced query methods for new relationship properties
	private async queryPlayerTOTWData(playerName: string, period: "weekly" | "season"): Promise<any> {
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
		this.logToBoth(`🔍 TOTW CYPHER QUERY (with parameters):`, query);
		this.logToBoth(`🔍 TOTW CYPHER QUERY (ready to execute):`, readyToExecuteQuery);

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "totw_awards", data: result, playerName, period };
		} catch (error) {
			this.logToBoth(`❌ Error in TOTW query:`, error, "error");
			return { type: "error", data: [], error: "Error querying TOTW data" };
		}
	}

	private async queryPlayersOfTheMonthData(playerName: string): Promise<any> {
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

	private async queryPlayerCaptainAwardsData(playerName: string): Promise<any> {
		console.log(`🔍 Querying for Captain awards for player: ${playerName}`);
		const query = `
			MATCH (p:Player {playerName: $playerName})-[r:CAPTAIN]->(award)
			RETURN p.playerName as playerName, 
			       award.date as date, 
			       award.team as team,
			       award.season as season
			ORDER BY award.date DESC
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "captain_awards", data: result, playerName };
		} catch (error) {
			this.logToBoth(`❌ Error in Captain query:`, error, "error");
			return { type: "error", data: [], error: "Error querying Captain data" };
		}
	}

	private async queryPlayerCoPlayersData(playerName: string): Promise<any> {
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

	private async queryPlayerOpponentsData(playerName: string): Promise<any> {
		console.log(`🔍 Querying for opponents for player: ${playerName}`);
		const query = `
			MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
			WHERE md.opponent IS NOT NULL
			RETURN md.opponent as opponent, count(md) as gamesPlayed
			ORDER BY gamesPlayed DESC
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
	private async queryStreakData(entities: string[], metrics: string[]): Promise<any> {
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

	private async queryComparisonData(entities: string[], metrics: string[]): Promise<any> {
		console.log(`🔍 Querying comparison data for entities: ${entities}, metrics: ${metrics}`);
		
		if (metrics.length === 0) {
			return { type: "no_context", data: [], message: "No metric specified for comparison" };
		}

		const metric = metrics[0];
		let metricField = "goals";
		let returnClause = "coalesce(sum(md.goals), 0) as value";

		// Map metric to database field
		switch (metric.toLowerCase()) {
			case "appearances":
			case "app":
				metricField = "appearances";
				returnClause = "count(md) as value";
				break;
			case "goals":
			case "g":
				metricField = "goals";
				returnClause = "coalesce(sum(md.goals), 0) as value";
				break;
			case "assists":
			case "a":
				metricField = "assists";
				returnClause = "coalesce(sum(md.assists), 0) as value";
				break;
			case "fantasy_points":
			case "ftp":
				metricField = "fantasyPoints";
				returnClause = "coalesce(p.fantasyPoints, 0) as value";
				break;
			case "clean_sheets":
			case "cls":
				metricField = "cleanSheets";
				returnClause = "coalesce(p.cleanSheets, 0) as value";
				break;
			case "penalties_scored":
			case "psc":
				metricField = "penaltiesScored";
				returnClause = "coalesce(sum(md.penaltiesScored), 0) as value";
				break;
			default:
				metricField = "goals";
				returnClause = "coalesce(sum(md.goals), 0) as value";
		}

		const query = `
			MATCH (p:Player)-[:PLAYED_IN]->(md:MatchDetail)
			WHERE p.allowOnSite = true
			RETURN p.playerName as playerName, ${returnClause}
			ORDER BY value DESC
			LIMIT 20
		`;

		this.lastExecutedQueries.push(`COMPARISON_DATA: ${query}`);
		this.lastExecutedQueries.push(`COMPARISON_PARAMS: ${JSON.stringify({ metric, metricField })}`);

		try {
			const result = await neo4jService.executeQuery(query, {});
			return { type: "comparison", data: result, metric };
		} catch (error) {
			this.logToBoth(`❌ Error in comparison query:`, error, "error");
			return { type: "error", data: [], error: "Error querying comparison data" };
		}
	}

	private async queryTemporalData(entities: string[], metrics: string[], timeRange?: string): Promise<any> {
		console.log(`🔍 Querying temporal data for entities: ${entities}, metrics: ${metrics}, timeRange: ${timeRange}`);
		
		if (entities.length === 0) {
			return { type: "no_context", data: [], message: "No player context provided" };
		}

		const playerName = entities[0];
		const metric = metrics[0] || "goals";
		
		// Parse time range
		let dateFilter = "";
		let params: any = { playerName };
		
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

		let metricField = "goals";
		let returnClause = "coalesce(sum(md.goals), 0) as value";

		switch (metric.toLowerCase()) {
			case "appearances":
			case "app":
				metricField = "appearances";
				returnClause = "count(md) as value";
				break;
			case "goals":
			case "g":
				metricField = "goals";
				returnClause = "coalesce(sum(md.goals), 0) as value";
				break;
			case "assists":
			case "a":
				metricField = "assists";
				returnClause = "coalesce(sum(md.assists), 0) as value";
				break;
			default:
				metricField = "goals";
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

	private async queryTeamSpecificPlayerData(teamName: string, metric: string): Promise<any> {
		console.log(`🔍 Querying team-specific data for team: ${teamName}, metric: ${metric}`);
		
		// Normalize team name
		const normalizedTeam = teamName.replace(/(\d+)(st|nd|rd|th)?/, "$1s");
		
		let metricField = "goals";
		let returnClause = "coalesce(sum(md.goals), 0) as value";

		switch (metric.toLowerCase()) {
			case "appearances":
			case "app":
				metricField = "appearances";
				returnClause = "count(md) as value";
				break;
			case "goals":
			case "g":
				metricField = "goals";
				returnClause = "coalesce(sum(md.goals), 0) as value";
				break;
			case "assists":
			case "a":
				metricField = "assists";
				returnClause = "coalesce(sum(md.assists), 0) as value";
				break;
			case "fantasy_points":
			case "ftp":
				metricField = "fantasyPoints";
				returnClause = "coalesce(sum(md.fantasyPoints), 0) as value";
				break;
			default:
				metricField = "goals";
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

	private async queryPlayerDataForTeam(playerName: string, metric: string, teamEntity: string): Promise<any> {
		console.log(`🔍 Querying player data for team: ${playerName}, metric: ${metric}, team: ${teamEntity}`);
		
		// Normalize team name
		const normalizedTeam = teamEntity.replace(/(\d+)(st|nd|rd|th)?/, "$1s");
		
		let metricField = "goals";
		let returnClause = "coalesce(sum(md.goals), 0) as value";

		switch (metric.toLowerCase()) {
			case "appearances":
			case "app":
				metricField = "appearances";
				returnClause = "count(md) as value";
				break;
			case "goals":
			case "g":
				metricField = "goals";
				returnClause = "coalesce(sum(md.goals), 0) as value";
				break;
			case "assists":
			case "a":
				metricField = "assists";
				returnClause = "coalesce(sum(md.assists), 0) as value";
				break;
			default:
				metricField = "goals";
				returnClause = "coalesce(sum(md.goals), 0) as value";
		}

		const query = `
			MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
			WHERE md.team = $teamName
			RETURN p.playerName as playerName, ${returnClause}
		`;

		this.lastExecutedQueries.push(`PLAYER_TEAM_DATA: ${query}`);
		this.lastExecutedQueries.push(`PLAYER_TEAM_PARAMS: ${JSON.stringify({ playerName, teamName: normalizedTeam, metric })}`);

		try {
			const result = await neo4jService.executeQuery(query, { playerName, teamName: normalizedTeam });
			return { type: "player_team", data: result, playerName, teamName: normalizedTeam, metric };
		} catch (error) {
			this.logToBoth(`❌ Error in player-team query:`, error, "error");
			return { type: "error", data: [], error: "Error querying player-team data" };
		}
	}

	private async queryOppositionData(playerName: string, metric: string, oppositionName?: string): Promise<any> {
		console.log(`🔍 Querying opposition data for player: ${playerName}, metric: ${metric}, opposition: ${oppositionName}`);
		
		let metricField = "goals";
		let returnClause = "coalesce(sum(md.goals), 0) as value";

		switch (metric.toLowerCase()) {
			case "appearances":
			case "app":
				metricField = "appearances";
				returnClause = "count(md) as value";
				break;
			case "goals":
			case "g":
				metricField = "goals";
				returnClause = "coalesce(sum(md.goals), 0) as value";
				break;
			case "assists":
			case "a":
				metricField = "assists";
				returnClause = "coalesce(sum(md.assists), 0) as value";
				break;
			default:
				metricField = "goals";
				returnClause = "coalesce(sum(md.goals), 0) as value";
		}

		let query = "";
		let params: any = { playerName };

		if (oppositionName) {
			// Specific opposition query
			query = `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)-[:HAS_MATCH_DETAILS]->(f:Fixture)
				WHERE f.opposition = $oppositionName
				RETURN p.playerName as playerName, ${returnClause}
			`;
			params.oppositionName = oppositionName;
		} else {
			// All oppositions query (for "most goals against" type questions)
			query = `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)-[:HAS_MATCH_DETAILS]->(f:Fixture)
				RETURN f.opposition as opposition, ${returnClause}
				ORDER BY value DESC
				LIMIT 10
			`;
		}

		this.lastExecutedQueries.push(`OPPOSITION_DATA: ${query}`);
		this.lastExecutedQueries.push(`OPPOSITION_PARAMS: ${JSON.stringify(params)}`);

		try {
			const result = await neo4jService.executeQuery(query, params);
			return { type: "opposition", data: result, playerName, metric, oppositionName };
		} catch (error) {
			this.logToBoth(`❌ Error in opposition query:`, error, "error");
			return { type: "error", data: [], error: "Error querying opposition data" };
		}
	}

	// Query ranking data for "which" questions (top players/teams)
	private async queryRankingData(entities: string[], metrics: string[], analysis: any): Promise<any> {
		this.logToBoth(`🔍 queryRankingData called with entities: ${entities}, metrics: ${metrics}`);
		
		if (metrics.length === 0) {
			return { type: "no_metrics", data: [], message: "No metrics specified for ranking" };
		}

		const metric = metrics[0];
		const lowerQuestion = analysis.question?.toLowerCase() || '';
		
		// Determine if this is asking about players or teams
		const isPlayerQuestion = lowerQuestion.includes('player') || lowerQuestion.includes('who');
		const isTeamQuestion = lowerQuestion.includes('team');
		
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
			this.logToBoth(`🔍 Ranking query result:`, result);

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
				cypherQuery: query
			};
		} catch (error) {
			this.logToBoth(`❌ Error in queryRankingData:`, error, "error");
			return { type: "error", data: [], error: "Error querying ranking data" };
		}
	}

	public getProcessingDetails(): any {
		return {
			questionAnalysis: this.lastQuestionAnalysis,
			cypherQueries: this.lastExecutedQueries,
			processingSteps: this.lastProcessingSteps,
			queryBreakdown: this.lastQueryBreakdown,
		};
	}
}

export const chatbotService = ChatbotService.getInstance();
