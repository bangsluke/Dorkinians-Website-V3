import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { PlayerQueryBuilder } from "../queryBuilders/playerQueryBuilder";
import { EntityResolutionUtils } from "../chatbotUtils/entityResolutionUtils";
import { TeamMappingUtils } from "../chatbotUtils/teamMappingUtils";
import { DateUtils } from "../chatbotUtils/dateUtils";
import { QueryExecutionUtils } from "../chatbotUtils/queryExecutionUtils";
import { loggingService } from "../loggingService";
import { RelationshipQueryHandler } from "./relationshipQueryHandler";
import { AwardsQueryHandler } from "./awardsQueryHandler";
import { ChatbotService } from "../chatbotService";

export class PlayerDataQueryHandler {
	/**
	 * Query player data based on entities, metrics, and analysis
	 */
	static async queryPlayerData(
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
			loggingService.log(
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

		// Check if this is a "how many games/appearances with [specific player]" question (2+ entities)
		const hasHowMany = questionLower.includes("how many") || questionLower.includes("how much");
		const hasWith = questionLower.includes("with");
		const hasGamesOrAppearances = questionLower.includes("games") || questionLower.includes("appearances");
		const hasDirectPattern = questionLower.includes("played with") || 
		                        questionLower.includes("play with") ||
		                        questionLower.includes("have with") || 
		                        questionLower.includes("made with") ||
		                        questionLower.includes("make with");
		const hasGamesAppearancesWithPattern = hasGamesOrAppearances && 
		                                      hasWith && 
		                                      (questionLower.includes("played") || 
		                                       questionLower.includes("play") ||
		                                       questionLower.includes("have") || 
		                                       questionLower.includes("made") ||
		                                       questionLower.includes("make"));
		const isSpecificPlayerPairQuestion = 
			entities.length >= 2 && 
			hasHowMany &&
			hasWith &&
			(hasDirectPattern || hasGamesAppearancesWithPattern);

		loggingService.log(`🔍 Checking for "played with" question. Question: "${questionLower}", isPlayedWithQuestion: ${isPlayedWithQuestion}, isSpecificPlayerPairQuestion: ${isSpecificPlayerPairQuestion}`, null, "log");

		// If this is a specific player pair question ("How many games have I played with [Player]?")
		if (isSpecificPlayerPairQuestion && entities.length >= 2) {
			const playerName1 = entities[0];
			const playerName2 = entities[1];
			const resolvedPlayerName1 = await EntityResolutionUtils.resolvePlayerName(playerName1);
			const resolvedPlayerName2 = await EntityResolutionUtils.resolvePlayerName(playerName2);
			
			if (!resolvedPlayerName1) {
				loggingService.log(`❌ Player not found: ${playerName1}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName1}". Please check the spelling or try a different player name.`,
					playerName: playerName1,
				};
			}
			
			if (!resolvedPlayerName2) {
				loggingService.log(`❌ Player not found: ${playerName2}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName2}". Please check the spelling or try a different player name.`,
					playerName: playerName2,
				};
			}
			
			// Extract team name if present in team entities
			let teamName: string | undefined = undefined;
			if (teamEntities.length > 0) {
				teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
				loggingService.log(`🔍 Team filter detected: ${teamName}`, null, "log");
			}
			
			// Extract season and date range filters
			const timeFrames = analysis.extractionResult?.timeFrames || [];
			const question = analysis.question || "";
			
			// Extract season from timeFrames or question
			let season: string | null = null;
			const seasonFrame = timeFrames.find(tf => tf.type === "season");
			if (seasonFrame) {
				season = seasonFrame.value;
				season = season.replace("-", "/");
			} else {
				const seasonMatch = question.match(/(\d{4})[\/\-](\d{2})/);
				if (seasonMatch) {
					season = `${seasonMatch[1]}/${seasonMatch[2]}`;
				}
			}
			
			// Extract date range from timeRange or question
			let startDate: string | null = null;
			let endDate: string | null = null;
			
			if (timeRange && typeof timeRange === "string" && timeRange.includes(" to ")) {
				const dateRange = timeRange.split(" to ");
				if (dateRange.length === 2) {
					startDate = DateUtils.convertDateFormat(dateRange[0].trim());
					endDate = DateUtils.convertDateFormat(dateRange[1].trim());
				}
			}
			
			if (!startDate || !endDate) {
				const rangeFrame = timeFrames.find(tf => tf.type === "range");
				if (rangeFrame && rangeFrame.value.includes(" to ")) {
					const dateRange = rangeFrame.value.split(" to ");
					if (dateRange.length === 2) {
						startDate = DateUtils.convertDateFormat(dateRange[0].trim());
						endDate = DateUtils.convertDateFormat(dateRange[1].trim());
					}
				}
			}
			
			if (!startDate || !endDate) {
				const betweenDateMatch = question.match(/between\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+and\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
				if (betweenDateMatch) {
					startDate = DateUtils.convertDateFormat(betweenDateMatch[1]);
					endDate = DateUtils.convertDateFormat(betweenDateMatch[2]);
				} else {
					const betweenYearMatch = question.match(/between\s+(\d{4})\s+and\s+(\d{4})/i);
					if (betweenYearMatch) {
						const startYear = parseInt(betweenYearMatch[1], 10);
						const endYear = parseInt(betweenYearMatch[2], 10);
						startDate = `${startYear}-01-01`;
						endDate = `${endYear}-12-31`;
					}
				}
			}
			
			loggingService.log(`🔍 Resolved player names: ${resolvedPlayerName1} and ${resolvedPlayerName2}, calling queryGamesPlayedTogether`, null, "log");
			return await RelationshipQueryHandler.queryGamesPlayedTogether(resolvedPlayerName1, resolvedPlayerName2, teamName, season, startDate, endDate);
		}

		// If this is a "played with" question (but not specific player pair), handle it specially
		if (isPlayedWithQuestion && entities.length > 0) {
			const playerName = entities[0];
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
			
			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}
			
			// Extract team name if present in team entities
			let teamName: string | undefined = undefined;
			if (teamEntities.length > 0) {
				teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
				loggingService.log(`🔍 Team filter detected: ${teamName}`, null, "log");
			}
			
			// Extract season and date range filters
			const timeFrames = analysis.extractionResult?.timeFrames || [];
			const question = analysis.question || "";
			
			let season: string | null = null;
			const seasonFrame = timeFrames.find(tf => tf.type === "season");
			if (seasonFrame) {
				season = seasonFrame.value;
				season = season.replace("-", "/");
			} else {
				const seasonMatch = question.match(/(\d{4})[\/\-](\d{2})/);
				if (seasonMatch) {
					season = `${seasonMatch[1]}/${seasonMatch[2]}`;
				}
			}
			
			let startDate: string | null = null;
			let endDate: string | null = null;
			
			if (timeRange && typeof timeRange === "string" && timeRange.includes(" to ")) {
				const dateRange = timeRange.split(" to ");
				if (dateRange.length === 2) {
					startDate = DateUtils.convertDateFormat(dateRange[0].trim());
					endDate = DateUtils.convertDateFormat(dateRange[1].trim());
				}
			}
			
			if (!startDate || !endDate) {
				const rangeFrame = timeFrames.find(tf => tf.type === "range");
				if (rangeFrame && rangeFrame.value.includes(" to ")) {
					const dateRange = rangeFrame.value.split(" to ");
					if (dateRange.length === 2) {
						startDate = DateUtils.convertDateFormat(dateRange[0].trim());
						endDate = DateUtils.convertDateFormat(dateRange[1].trim());
					}
				}
			}
			
			if (!startDate || !endDate) {
				const betweenDateMatch = question.match(/between\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+and\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
				if (betweenDateMatch) {
					startDate = DateUtils.convertDateFormat(betweenDateMatch[1]);
					endDate = DateUtils.convertDateFormat(betweenDateMatch[2]);
				} else {
					const betweenYearMatch = question.match(/between\s+(\d{4})\s+and\s+(\d{4})/i);
					if (betweenYearMatch) {
						const startYear = parseInt(betweenYearMatch[1], 10);
						const endYear = parseInt(betweenYearMatch[2], 10);
						startDate = `${startYear}-01-01`;
						endDate = `${endYear}-12-31`;
					}
				}
			}
			
			loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryMostPlayedWith`, null, "log");
			return await RelationshipQueryHandler.queryMostPlayedWith(resolvedPlayerName, teamName, season, startDate, endDate);
		}

		// Check for "highest score in a week" questions
		const isHighestWeeklyScoreQuestion = 
			(questionLower.includes("highest score") && questionLower.includes("week")) ||
			(questionLower.includes("highest") && questionLower.includes("score") && questionLower.includes("week")) ||
			(questionLower.includes("best score") && questionLower.includes("week")) ||
			(questionLower.includes("most points") && questionLower.includes("week"));

		loggingService.log(`🔍 Checking for "highest weekly score" question. Question: "${questionLower}", isHighestWeeklyScoreQuestion: ${isHighestWeeklyScoreQuestion}`, null, "log");

		// If this is a "highest weekly score" question, handle it specially
		if (isHighestWeeklyScoreQuestion && entities.length > 0) {
			const playerName = entities[0];
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
			
			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}
			
			loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryHighestWeeklyScore`, null, "log");
			return await PlayerDataQueryHandler.queryHighestWeeklyScore(resolvedPlayerName);
		}

		// Check for "opposition most" or "played against the most" questions
		const isOppositionMostQuestion = 
			(questionLower.includes("opposition") && questionLower.includes("most")) ||
			(questionLower.includes("opposition") && questionLower.includes("played against")) ||
			(questionLower.includes("played against") && questionLower.includes("most")) ||
			(questionLower.includes("what opposition") && questionLower.includes("most"));

		loggingService.log(`🔍 Checking for "opposition most" question. Question: "${questionLower}", isOppositionMostQuestion: ${isOppositionMostQuestion}`, null, "log");

		// If this is an "opposition most" question, handle it specially
		if (isOppositionMostQuestion && entities.length > 0) {
			const playerName = entities[0];
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
			
			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}
			
			loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryPlayerOpponentsData`, null, "log");
			return await RelationshipQueryHandler.queryPlayerOpponentsData(resolvedPlayerName);
		}

		// Check for "penalties taken" questions
		const isPenaltiesTakenQuestion = 
			(questionLower.includes("how many") && questionLower.includes("penalties") && questionLower.includes("taken")) ||
			(questionLower.includes("how many") && questionLower.includes("penalty") && questionLower.includes("taken")) ||
			(questionLower.includes("penalties") && questionLower.includes("taken")) ||
			(questionLower.includes("penalty") && questionLower.includes("taken"));

		loggingService.log(`🔍 Checking for "penalties taken" question. Question: "${questionLower}", isPenaltiesTakenQuestion: ${isPenaltiesTakenQuestion}`, null, "log");

		// If this is a "penalties taken" question, handle it specially
		if (isPenaltiesTakenQuestion && entities.length > 0) {
			const playerName = entities[0];
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
			
			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}
			
			loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryPenaltiesTaken`, null, "log");
			return await PlayerDataQueryHandler.queryPenaltiesTaken(resolvedPlayerName);
		}

		// Check for "penalty record" questions
		const isPenaltyRecordQuestion = 
			questionLower.includes("penalty record") ||
			(questionLower.includes("penalty") && questionLower.includes("record"));

		loggingService.log(`🔍 Checking for "penalty record" question. Question: "${questionLower}", isPenaltyRecordQuestion: ${isPenaltyRecordQuestion}`, null, "log");

		// If this is a "penalty record" question, handle it specially
		if (isPenaltyRecordQuestion && entities.length > 0) {
			const playerName = entities[0];
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
			
			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}
			
			loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryPenaltyRecord`, null, "log");
			return await PlayerDataQueryHandler.queryPenaltyRecord(resolvedPlayerName);
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
			if (playerName.match(/^\d+(?:st|nd|rd|th)?$/)) {
				return await PlayerDataQueryHandler.queryTeamSpecificPlayerData(playerName, metric);
			}

			// Resolve player name with fuzzy matching
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);

			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
					metric,
				};
			}

			const actualPlayerName = resolvedPlayerName;

			// Check for special queries that can use enhanced relationship properties
			if (metric === "TOTW" || metric === "WEEKLY_TOTW") {
				return await AwardsQueryHandler.queryPlayerTOTWData(actualPlayerName, "weekly", analysis.question);
			}

			if (metric === "SEASON_TOTW") {
				return await AwardsQueryHandler.queryPlayerTOTWData(actualPlayerName, "season", analysis.question);
			}

			if (metric === "POTM" || metric === "PLAYER_OF_THE_MONTH") {
				return await AwardsQueryHandler.queryPlayersOfTheMonthData(actualPlayerName);
			}

			if (metric === "CAPTAIN" || metric === "CAPTAIN_AWARDS") {
				return await AwardsQueryHandler.queryPlayerCaptainAwardsData(actualPlayerName);
			}

			if (metric === "CO_PLAYERS" || metric === "PLAYED_WITH") {
				return await RelationshipQueryHandler.queryPlayerCoPlayersData(actualPlayerName);
			}

			if (metric === "OPPONENTS" || metric === "PLAYED_AGAINST") {
				return await RelationshipQueryHandler.queryPlayerOpponentsData(actualPlayerName);
			}

			// Build the optimal query using unified architecture
			const query = PlayerQueryBuilder.buildPlayerQuery(actualPlayerName, metric, analysis);

			try {
				// Store query for debugging - add to chatbotService for client visibility
				const chatbotService = ChatbotService.getInstance();
				chatbotService.lastExecutedQueries.push(`PLAYER_DATA: ${query}`);
				chatbotService.lastExecutedQueries.push(`PARAMS: ${JSON.stringify({ playerName: actualPlayerName, graphLabel: neo4jService.getGraphLabel() })}`);

				// Log copyable queries for debugging
				const readyToExecuteQuery = query
					.replace(/\$playerName/g, `'${actualPlayerName}'`)
					.replace(/\$graphLabel/g, `'${neo4jService.getGraphLabel()}'`);
				chatbotService.lastExecutedQueries.push(`READY_TO_EXECUTE: ${readyToExecuteQuery}`);

				const result = await QueryExecutionUtils.executeQueryWithProfiling(query, {
					playerName: actualPlayerName,
					graphLabel: neo4jService.getGraphLabel(),
				});

				// For team-specific goals queries with OPTIONAL MATCH, if result is empty, return a row with value 0
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
					loggingService.log(`⚠️ No results found for ${actualPlayerName} with metric ${metric} (original: ${originalMetric}), returning 0`, null, "warn");
					return { 
						type: "specific_player", 
						data: [{ playerName: actualPlayerName, value: 0 }], 
						playerName: actualPlayerName, 
						metric: originalMetric, 
						cypherQuery: query 
					};
				}

				if (!result || !Array.isArray(result) || result.length === 0) {
					loggingService.log(`❌ No results found for ${actualPlayerName} with metric ${metric}`, null, "warn");
				}

				return { type: "specific_player", data: result, playerName: actualPlayerName, metric: originalMetric, cypherQuery: query };
			} catch (error) {
				loggingService.log(`❌ Error in player query:`, error, "error");
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
			return { type: "general_player", data: entities, message: "General player query" };
		}

		loggingService.log(`🔍 No specific player query, falling back to general player query`, null, "log");

		// Fallback to general player query
		const query = `
      MATCH (p:Player)
      WHERE p.playerName IS NOT NULL
      RETURN p.playerName as name, p.id as source
      LIMIT 50
    `;

		const result = await neo4jService.executeQuery(query);
		return { type: "general_players", data: result };
	}

	/**
	 * Query highest weekly score for a player
	 */
	static async queryHighestWeeklyScore(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying highest weekly score for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.seasonWeek IS NOT NULL AND md.fantasyPoints IS NOT NULL
			WITH md.seasonWeek as seasonWeek, sum(md.fantasyPoints) as weeklyPoints
			RETURN max(weeklyPoints) as highestWeeklyScore
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			const highestScore = result && result.length > 0 && result[0].highestWeeklyScore !== undefined 
				? (typeof result[0].highestWeeklyScore === 'number' 
					? result[0].highestWeeklyScore 
					: (result[0].highestWeeklyScore?.low || 0) + (result[0].highestWeeklyScore?.high || 0) * 4294967296)
				: 0;
			return { type: "highest_weekly_score", highestScore, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in highest weekly score query:`, error, "error");
			return { type: "error", data: [], error: "Error querying highest weekly score data" };
		}
	}

	/**
	 * Query penalties taken for a player (penaltiesScored + penaltiesMissed)
	 */
	static async queryPenaltiesTaken(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying penalties taken for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WITH p, 
				sum(coalesce(md.penaltiesScored, 0)) as penaltiesScored,
				sum(coalesce(md.penaltiesMissed, 0)) as penaltiesMissed
			RETURN p.playerName as playerName, 
				(penaltiesScored + penaltiesMissed) as value,
				penaltiesScored,
				penaltiesMissed
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			if (result && result.length > 0) {
				const row = result[0];
				return { 
					type: "penalties_taken", 
					data: [{ 
						playerName: row.playerName, 
						value: row.value || 0,
						penaltiesScored: row.penaltiesScored || 0,
						penaltiesMissed: row.penaltiesMissed || 0
					}], 
					playerName,
					penaltiesScored: row.penaltiesScored || 0,
					penaltiesMissed: row.penaltiesMissed || 0
				};
			}
			return { 
				type: "penalties_taken", 
				data: [{ playerName, value: 0, penaltiesScored: 0, penaltiesMissed: 0 }], 
				playerName,
				penaltiesScored: 0,
				penaltiesMissed: 0
			};
		} catch (error) {
			loggingService.log(`❌ Error in penalties taken query:`, error, "error");
			return { type: "error", data: [], error: "Error querying penalties taken data" };
		}
	}

	/**
	 * Query penalty record for a player (returns both penaltiesScored and penaltiesMissed)
	 */
	static async queryPenaltyRecord(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying penalty record for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WITH p, 
				sum(coalesce(md.penaltiesScored, 0)) as penaltiesScored,
				sum(coalesce(md.penaltiesMissed, 0)) as penaltiesMissed
			RETURN p.playerName as playerName, 
				penaltiesScored,
				penaltiesMissed,
				(penaltiesScored + penaltiesMissed) as totalPenalties
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			if (result && result.length > 0) {
				const row = result[0];
				return { 
					type: "penalty_record", 
					data: [{ 
						playerName: row.playerName, 
						penaltiesScored: row.penaltiesScored || 0,
						penaltiesMissed: row.penaltiesMissed || 0,
						totalPenalties: row.totalPenalties || 0
					}], 
					playerName,
					penaltiesScored: row.penaltiesScored || 0,
					penaltiesMissed: row.penaltiesMissed || 0,
					totalPenalties: row.totalPenalties || 0
				};
			}
			return { 
				type: "penalty_record", 
				data: [{ playerName, penaltiesScored: 0, penaltiesMissed: 0, totalPenalties: 0 }], 
				playerName,
				penaltiesScored: 0,
				penaltiesMissed: 0,
				totalPenalties: 0
			};
		} catch (error) {
			loggingService.log(`❌ Error in penalty record query:`, error, "error");
			return { type: "error", data: [], error: "Error querying penalty record data" };
		}
	}

	/**
	 * Query team-specific player data
	 */
	static async queryTeamSpecificPlayerData(teamName: string, metric: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying team-specific data for team: ${teamName}, metric: ${metric}`, null, "log");

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

		try {
			const result = await neo4jService.executeQuery(query, { teamName: normalizedTeam });
			return { type: "team_specific", data: result, teamName: normalizedTeam, metric };
		} catch (error) {
			loggingService.log(`❌ Error in team-specific query:`, error, "error");
			return { type: "error", data: [], error: "Error querying team-specific data" };
		}
	}

	/**
	 * Query how many leagues a player has won (seasons where their team finished 1st)
	 * Uses the same approach as Club Achievements API - gets winning teams from JSON files,
	 * then checks if player played for those teams in those seasons
	 * Excludes current season as it hasn't finished yet
	 */
	static async queryPlayerLeagueWinsCount(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying league wins count for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		try {
			// Import league table service functions
			const { getAvailableSeasons, getSeasonDataFromJSON, normalizeSeasonFormat } = await import("../leagueTableService");
			const { TeamMappingUtils } = await import("../chatbotUtils/teamMappingUtils");

			// Get current season from SiteDetail
			const currentSeasonQuery = `
				MATCH (sd:SiteDetail {graphLabel: $graphLabel})
				RETURN sd.currentSeason as currentSeason
				LIMIT 1
			`;
			const seasonResult = await neo4jService.executeQuery(currentSeasonQuery, { graphLabel });
			const currentSeason = seasonResult && seasonResult.length > 0 ? seasonResult[0].currentSeason : null;

			// Get all club achievements (winning teams/seasons) from JSON files
			const seasons = await getAvailableSeasons();
			const winningTeams: Array<{ team: string; season: string }> = [];

			for (const season of seasons) {
				// Skip current season
				const normalizedSeason = normalizeSeasonFormat(season, 'slash');
				if (currentSeason && normalizedSeason === currentSeason) {
					continue;
				}

				const seasonData = await getSeasonDataFromJSON(season);
				if (!seasonData) continue;

				// Iterate through all teams in this season
				for (const [teamKey, teamData] of Object.entries(seasonData.teams)) {
					if (!teamData || !teamData.table || teamData.table.length === 0) continue;

					// Find Dorkinians entry in this team's table
					const dorkiniansEntry = teamData.table.find((entry) =>
						entry.team.toLowerCase().includes('dorkinians'),
					);

					// Check if Dorkinians finished in 1st place
					if (dorkiniansEntry && dorkiniansEntry.position === 1) {
						winningTeams.push({
							team: teamKey,
							season: normalizedSeason,
						});
					}
				}
			}

			if (winningTeams.length === 0) {
				return { type: "league_wins_count", count: 0, playerName };
			}

			// Check which winning teams/seasons the player participated in
			// Map team keys to database format (e.g., "1s" -> "1st XI")
			const playerWins: string[] = [];
			
			for (const { team, season } of winningTeams) {
				const mappedTeam = TeamMappingUtils.mapTeamName(team);
				
				// Query if player played for this team in this season (League games only)
				const playerQuery = `
					MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
					MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
					WHERE md.team = $team 
						AND f.season = $season 
						AND f.compType = "League"
					RETURN count(md) as appearances
					LIMIT 1
				`;

				const result = await neo4jService.executeQuery(playerQuery, {
					graphLabel,
					playerName,
					team: mappedTeam,
					season,
				});

				const appearances = result && result.length > 0 && result[0].appearances !== undefined
					? (typeof result[0].appearances === 'number'
						? result[0].appearances
						: (result[0].appearances?.low || 0) + (result[0].appearances?.high || 0) * 4294967296)
					: 0;

				// If player made at least one appearance for this winning team, count it
				if (appearances > 0) {
					playerWins.push(`${team} - ${season}`);
				}
			}

			const count = playerWins.length;
			return { type: "league_wins_count", count, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in league wins count query:`, error, "error");
			return { type: "error", data: [], error: "Error querying league wins count data" };
		}
	}
}
