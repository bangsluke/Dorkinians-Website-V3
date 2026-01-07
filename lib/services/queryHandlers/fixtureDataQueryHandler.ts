import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { TeamMappingUtils } from "../chatbotUtils/teamMappingUtils";
import { DateUtils } from "../chatbotUtils/dateUtils";
import { loggingService } from "../loggingService";
import { TeamDataQueryHandler } from "./teamDataQueryHandler";
import { ChatbotService } from "../chatbotService";

export class FixtureDataQueryHandler {
	/**
	 * Query fixture data (opposition queries)
	 */
	static async queryFixtureData(
		entities: string[],
		metrics: string[],
		analysis?: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		const question = analysis?.question?.toLowerCase() || "";
		
		// Check if this is a "how many games" query for a team - route to TeamDataQueryHandler
		const isTeamGamesCountQuery = 
			(question.includes("how many games") || question.includes("how many game")) &&
			(question.includes("play") || question.includes("played")) &&
			(analysis?.teamEntities && analysis.teamEntities.length > 0 || entities.some(e => /^\d+(?:st|nd|rd|th|s)?$/i.test(e)));
		
		if (isTeamGamesCountQuery && analysis) {
			loggingService.log(`🔍 Detected team games count query, routing to TeamDataQueryHandler`, null, "log");
			return await TeamDataQueryHandler.queryTeamData(entities, metrics, analysis);
		}
		
		// Check if this is a highest individual player goals in one game query
		// This must be checked BEFORE highest scoring game query to avoid misrouting
		const isHighestPlayerGoalsInGameQuery = 
			(question.includes("highest number of goals") && question.includes("player") && question.includes("scored")) ||
			(question.includes("highest goals") && question.includes("player") && (question.includes("scored") || question.includes("one game"))) ||
			(question.includes("most goals") && question.includes("player") && question.includes("one game")) ||
			(question.includes("most goals") && question.includes("player") && question.includes("scored") && question.includes("game")) ||
			(question.includes("highest goals") && question.includes("one game") && question.includes("player"));
		
		if (isHighestPlayerGoalsInGameQuery) {
			return await this.queryHighestPlayerGoalsInGame(entities, analysis);
		}
		
		// Check if this is a highest scoring game query
		const isHighestScoringGameQuery = 
			question.includes("highest scoring game") ||
			question.includes("highest scoring") && question.includes("game") ||
			question.includes("most goals") && question.includes("game") ||
			question.includes("highest total") && question.includes("game");
		
		if (isHighestScoringGameQuery) {
			return await this.queryHighestScoringGame(entities, analysis);
		}

		// Check for hat-trick questions (handles "hattrick", "hat-trick", "hat trick" variations)
		// Handles various dash characters: regular hyphen (-), non-breaking hyphen (\u2011), en dash (–), em dash (—), and spaces
		const hatTrickPattern = /hat[-\u2011\u2013\u2014 ]?trick/i;
		const isHatTrickQuestion = hatTrickPattern.test(question) && 
			(question.includes("how many") || question.includes("count"));
		
		if (isHatTrickQuestion && analysis) {
			const hasYear = question.match(/\b(20\d{2})\b/) || analysis?.extractionResult?.timeFrames?.some(tf => {
				// Check if timeFrame value contains a year
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
			const isYearHatTrickQuestion = hasYear && (hasYearWidePhrases || !hasPlayerMention) && !hasTeamFilter;
			// Team-specific or date-filtered question: hat-trick question with team filter or date filter
			const isFilteredHatTrickQuestion = (hasTeamFilter || hasDateFilter || hasYear) && !hasPlayerMention;

			if (isYearHatTrickQuestion || isFilteredHatTrickQuestion) {
				// Extract team name if present
				let teamName: string | null = null;
				if (hasTeamFilter) {
					if (analysis.teamEntities && analysis.teamEntities.length > 0) {
						teamName = TeamMappingUtils.mapTeamName(analysis.teamEntities[0]);
					} else {
						// Try to extract from question text
						const teamMatch = question.match(/\b(?:by|for)\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)\b/i);
						if (teamMatch) {
							const teamStr = teamMatch[1];
							// Handle ordinal formats (1st, 2nd, etc.)
							if (teamStr.includes("st") || teamStr.includes("nd") || teamStr.includes("rd") || teamStr.includes("th")) {
								const num = teamStr.match(/\d+/)?.[0];
								if (num) {
									teamName = TeamMappingUtils.mapTeamName(`${num}s`);
								}
							} else if (teamStr.match(/^(first|second|third|fourth|fifth|sixth|seventh|eighth)$/i)) {
								// Handle word formats (first, second, etc.)
								const wordToNum: { [key: string]: string } = {
									first: "1s", second: "2s", third: "3s", fourth: "4s",
									fifth: "5s", sixth: "6s", seventh: "7s", eighth: "8s"
								};
								const numStr = wordToNum[teamStr.toLowerCase()];
								if (numStr) {
									teamName = TeamMappingUtils.mapTeamName(numStr);
								}
							} else {
								// Direct format (1s, 2s, etc.)
								teamName = TeamMappingUtils.mapTeamName(teamStr);
							}
						}
					}
				}

				// Extract date range filters
				let startDate: string | null = null;
				let endDate: string | null = null;
				const timeFrames = analysis.extractionResult?.timeFrames || [];
				
				// Check for "after [YEAR]" or "since [YEAR]"
				const afterFrame = timeFrames.find(tf => tf.type === "since");
				if (afterFrame) {
					const year = parseInt(afterFrame.value, 10);
					if (!isNaN(year) && year >= 2000 && year <= 2100) {
						startDate = `${year + 1}-01-01`; // "since 2023" or "after 2023" means from 2024-01-01 onwards
					}
				}
				
				// Try to extract "after [YEAR]" from question text (if not already found)
				if (!startDate) {
					const afterMatch = question.match(/\bafter\s+(\d{4})\b/i);
					if (afterMatch) {
						const year = parseInt(afterMatch[1], 10);
						if (!isNaN(year) && year >= 2000 && year <= 2100) {
							startDate = `${year + 1}-01-01`; // "after 2023" means from 2024-01-01 onwards
						}
					}
				}
				
				// Check for "before [YEAR]"
				const beforeFrame = timeFrames.find(tf => tf.type === "before");
				if (beforeFrame) {
					// Extract year from beforeFrame value (might be a year or season)
					const yearMatch = beforeFrame.value.match(/\b(20\d{2})\b/);
					if (yearMatch) {
						const year = parseInt(yearMatch[1], 10);
						if (!isNaN(year) && year >= 2000 && year <= 2100) {
							endDate = `${year - 1}-12-31`; // "before 2024" means up to 2023-12-31
						}
					}
				}
				
				// Try to extract "before [YEAR]" from question text (if not already found)
				if (!endDate) {
					const beforeMatch = question.match(/\bbefore\s+(\d{4})\b/i);
					if (beforeMatch) {
						const year = parseInt(beforeMatch[1], 10);
						if (!isNaN(year) && year >= 2000 && year <= 2100) {
							endDate = `${year - 1}-12-31`; // "before 2024" means up to 2023-12-31
						}
					}
				}
				
				// Check for date range (between X and Y)
				const rangeFrame = timeFrames.find(tf => tf.type === "range" && tf.value.includes(" to "));
				if (rangeFrame) {
					const dateRange = rangeFrame.value.split(" to ");
					if (dateRange.length === 2) {
						startDate = DateUtils.convertDateFormat(dateRange[0].trim());
						endDate = DateUtils.convertDateFormat(dateRange[1].trim());
					}
				}
				
				// Extract year if present (for exact year queries)
				let year: number | null = null;
				if (!startDate && !endDate) {
					// Try to extract year from timeFrames (check if any frame value matches a year pattern)
					const yearFrame = timeFrames.find(tf => /^\d{4}$/.test(tf.value) && parseInt(tf.value, 10) >= 2000 && parseInt(tf.value, 10) <= 2100);
					if (yearFrame) {
						year = parseInt(yearFrame.value, 10);
					} else {
						// Try to extract year from question text (e.g., "2022", "in 2022")
						const yearMatch = analysis.question?.match(/\b(20\d{2})\b/);
						if (yearMatch) {
							year = parseInt(yearMatch[1], 10);
						}
					}
				}

				if (year || startDate || endDate || teamName) {
					loggingService.log(`🔍 Detected hat-trick question with filters - year: ${year}, team: ${teamName}, startDate: ${startDate}, endDate: ${endDate}`, null, "log");
					return await this.queryYearHatTricks(year, analysis, teamName, startDate, endDate);
				} else {
					loggingService.log(`⚠️ Could not extract valid filters from hat-trick question`, null, "warn");
				}
			}
		}

		// Check for opponent own goals queries
		const isOpponentOwnGoalsQuery = 
			question.includes("opponent own goals") ||
			question.includes("oppo own goals") ||
			question.includes("own goals") && question.includes("opponent");
		
		if (isOpponentOwnGoalsQuery) {
			return await this.queryGamesWithOpponentOwnGoals(entities, analysis);
		}

		// Check for biggest win queries
		const isBiggestWinQuery = 
			question.includes("biggest win") ||
			question.includes("largest win") ||
			question.includes("biggest margin") ||
			(question.includes("biggest") && question.includes("win"));
		
		if (isBiggestWinQuery) {
			return await this.queryBiggestWin(entities, analysis);
		}

		// Check for games where player scored queries
		const isGamesWhereScoredQuery = 
			(question.includes("games") || question.includes("matches")) &&
			(question.includes("scored") || question.includes("goal")) &&
			analysis?.extractionResult?.entities?.some(e => e.type === "player");
		
		if (isGamesWhereScoredQuery && analysis?.extractionResult?.entities) {
			const playerEntity = analysis.extractionResult.entities.find(e => e.type === "player");
			if (playerEntity) {
				return await this.queryGamesWherePlayerScored(playerEntity.value, analysis);
			}
		}
		
		// Extract team name from entities or analysis
		let teamName = "";
		if (analysis?.teamEntities && analysis.teamEntities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(analysis.teamEntities[0]);
		} else if (entities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(entities[0]);
		}
		
		if (!teamName) {
			loggingService.log(`⚠️ No team name found in queryFixtureData`, null, "warn");
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
				const match = ordinalWeekendFrame.value.match(/weekend_(\d+)_(\d{4})/);
				if (match) {
					const ordinal = parseInt(match[1], 10);
					const year = parseInt(match[2], 10);
					const dates = DateUtils.calculateWeekendDates(year, ordinal);
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
			loggingService.log(`🔍 Calculated weekend dates - startDate: ${startDate}, endDate: ${endDate}, teamName: ${teamName}`, null, "log");
			query += ` AND f.date >= $startDate AND f.date <= $endDate`;
			params.startDate = startDate;
			params.endDate = endDate;
		}
		
		query += `
			RETURN f.opposition as opposition, f.date as date, f.homeOrAway as homeOrAway
			ORDER BY f.date ASC
		`;
		
		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			let readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${params.graphLabel}'`)
				.replace(/\$teamName/g, `'${params.teamName}'`);
			if (params.startDate && params.endDate) {
				readyToExecuteQuery = readyToExecuteQuery
					.replace(/\$startDate/g, `'${params.startDate}'`)
					.replace(/\$endDate/g, `'${params.endDate}'`);
			}
			chatbotService.lastExecutedQueries.push(`FIXTURE_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`FIXTURE_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}
		
		try {
			const result = await neo4jService.executeQuery(query, params);
			loggingService.log(`🔍 Fixture query result count: ${result?.length || 0}`, null, "log");
			
			if (!result || result.length === 0) {
				loggingService.log(`⚠️ No fixtures found for ${teamName}${startDate && endDate ? ` between ${startDate} and ${endDate}` : ""}`, null, "warn");
				return {
					type: "opposition_query",
					teamName,
					oppositions: [],
					dates: startDate && endDate ? { start: startDate, end: endDate } : undefined,
					message: `No fixtures found for ${teamName}${startDate && endDate ? ` between ${startDate} and ${endDate}` : ""}`,
				};
			}
			
			loggingService.log(`✅ Found ${result.length} fixture(s) for ${teamName}`, null, "log");
			
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
			loggingService.log(`❌ Error in queryFixtureData:`, error, "error");
			return {
				type: "error",
				data: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Query games with opponent own goals
	 */
	static async queryGamesWithOpponentOwnGoals(
		entities: string[],
		analysis?: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		const question = analysis?.question?.toLowerCase() || "";
		
		// Extract team name from entities or analysis
		let teamName = "";
		if (analysis?.teamEntities && analysis.teamEntities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(analysis.teamEntities[0]);
		} else if (entities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(entities[0]);
		}

		const params: Record<string, unknown> = { graphLabel };
		if (teamName) {
			params.team = teamName;
		}

		let query = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
			WHERE f.oppoOwnGoals > 0
		`;
		if (teamName) {
			query += ` AND f.team = $team`;
		}
		query += `
			RETURN f.date as date,
			       f.opposition as opposition,
			       f.homeOrAway as homeOrAway,
			       f.result as result,
			       f.dorkiniansGoals as dorkiniansGoals,
			       f.conceded as conceded,
			       f.oppoOwnGoals as oppoOwnGoals
			ORDER BY f.date DESC
			LIMIT 20
		`;

		try {
			const result = await neo4jService.executeQuery(query, params);
			return { type: "opponent_own_goals", data: result, teamName };
		} catch (error) {
			loggingService.log(`❌ Error in queryGamesWithOpponentOwnGoals:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}

	/**
	 * Query biggest win (largest goal difference)
	 */
	static async queryBiggestWin(
		entities: string[],
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

		const params: Record<string, unknown> = { graphLabel };
		if (teamName) {
			params.team = teamName;
		}

		let query = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
			WHERE f.result = 'W' AND f.dorkiniansGoals IS NOT NULL AND f.conceded IS NOT NULL
		`;
		if (teamName) {
			query += ` AND f.team = $team`;
		}
		query += `
			WITH f, f.dorkiniansGoals - f.conceded as goalDifference
			ORDER BY goalDifference DESC, f.dorkiniansGoals DESC
			LIMIT 1
			RETURN f.date as date,
			       f.opposition as opposition,
			       f.homeOrAway as homeOrAway,
			       f.dorkiniansGoals as dorkiniansGoals,
			       f.conceded as conceded,
			       goalDifference
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			let readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`);
			if (teamName) {
				readyToExecuteQuery = readyToExecuteQuery.replace(/\$team/g, `'${teamName}'`);
			}
			chatbotService.lastExecutedQueries.push(`BIGGEST_WIN_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`BIGGEST_WIN_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, params);
			if (result && result.length > 0) {
				return { type: "biggest_win", data: result[0], teamName };
			}
			return { type: "biggest_win", data: null, teamName };
		} catch (error) {
			loggingService.log(`❌ Error in queryBiggestWin:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}

	/**
	 * Query games where a player scored
	 */
	static async queryGamesWherePlayerScored(
		playerName: string,
		analysis?: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE (md.goals > 0 OR md.penaltiesScored > 0)
			RETURN f.date as date,
			       f.opposition as opposition,
			       f.homeOrAway as homeOrAway,
			       f.result as result,
			       f.dorkiniansGoals as dorkiniansGoals,
			       f.conceded as conceded,
			       md.goals as playerGoals,
			       md.penaltiesScored as playerPenaltiesScored
			ORDER BY f.date DESC
			LIMIT 50
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`GAMES_WHERE_SCORED_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`GAMES_WHERE_SCORED_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			return { type: "games_where_scored", data: result, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in queryGamesWherePlayerScored:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}

	/**
	 * Query games where player scored and team won by exactly one goal
	 */
	static async queryGamesWherePlayerScoredAndWonByOneGoal(
		playerName: string,
		analysis?: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE f.result = 'W'
			  AND f.dorkiniansGoals IS NOT NULL
			  AND f.conceded IS NOT NULL
			  AND f.dorkiniansGoals - f.conceded = 1
			  AND (md.goals > 0 OR md.penaltiesScored > 0)
			RETURN count(DISTINCT f) as gameCount
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`GAMES_SCORED_WON_BY_ONE_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`GAMES_SCORED_WON_BY_ONE_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			const gameCount = result && result.length > 0 ? (result[0].gameCount || 0) : 0;
			return { type: "games_scored_won_by_one", data: [{ gameCount }], playerName };
		} catch (error) {
			loggingService.log(`❌ Error in queryGamesWherePlayerScoredAndWonByOneGoal:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}

	/**
	 * Query games where player played and team scored zero goals
	 */
	static async queryGamesWherePlayerPlayedAndTeamScoredZero(
		playerName: string,
		analysis?: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE f.dorkiniansGoals = 0
			RETURN count(DISTINCT f) as gameCount
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`GAMES_ZERO_GOALS_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`GAMES_ZERO_GOALS_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			const gameCount = result && result.length > 0 ? (result[0].gameCount || 0) : 0;
			return { type: "number_card", data: [{ value: gameCount }], playerName };
		} catch (error) {
			loggingService.log(`❌ Error in queryGamesWherePlayerPlayedAndTeamScoredZero:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}

	/**
	 * Query highest scoring game for a team in a season
	 * Returns the fixture with highest combined dorkiniansGoals + conceded
	 */
	private static async queryHighestScoringGame(
		entities: string[],
		analysis?: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		const question = analysis?.question?.toLowerCase() || "";
		
		// Extract team name from entities or analysis
		let teamName = "";
		if (analysis?.teamEntities && analysis.teamEntities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(analysis.teamEntities[0]);
			loggingService.log(`🔍 Found team from teamEntities: ${teamName}`, null, "log");
		} else if (analysis?.extractionResult?.entities) {
			// Check extraction result for team entities
			const teamEntities = analysis.extractionResult.entities.filter(e => e.type === "team");
			if (teamEntities.length > 0) {
				teamName = TeamMappingUtils.mapTeamName(teamEntities[0].value);
				loggingService.log(`🔍 Found team from extractionResult entities: ${teamName}`, null, "log");
			}
		}
		
		if (!teamName && entities.length > 0) {
			// Check if entities contain team references
			for (const entity of entities) {
				const mappedTeam = TeamMappingUtils.mapTeamName(entity);
				if (mappedTeam !== entity) {
					// If mapping changed the value, it's likely a team
					teamName = mappedTeam;
					loggingService.log(`🔍 Found team from entities array: ${teamName}`, null, "log");
					break;
				}
			}
		}
		
		if (!teamName) {
			// Try to extract from question text with improved regex
			// Match team patterns in various contexts: "the 1s", "1s had", "1s'", etc.
			const teamMatch = question.match(/\b(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)(?:\s+(?:team|xi|had|have|has))?\b/i);
			if (teamMatch) {
				const teamStr = teamMatch[1];
				// Handle ordinal formats (1st, 2nd, etc.)
				if (teamStr.includes("st") || teamStr.includes("nd") || teamStr.includes("rd") || teamStr.includes("th")) {
					const num = teamStr.match(/\d+/)?.[0];
					if (num) {
						teamName = TeamMappingUtils.mapTeamName(`${num}s`);
					}
				} else if (teamStr.match(/^(first|second|third|fourth|fifth|sixth|seventh|eighth)$/i)) {
					// Handle word formats (first, second, etc.)
					const wordToNum: { [key: string]: string } = {
						first: "1s", second: "2s", third: "3s", fourth: "4s",
						fifth: "5s", sixth: "6s", seventh: "7s", eighth: "8s"
					};
					const numStr = wordToNum[teamStr.toLowerCase()];
					if (numStr) {
						teamName = TeamMappingUtils.mapTeamName(numStr);
					}
				} else {
					// Direct format (1s, 2s, etc.)
					teamName = TeamMappingUtils.mapTeamName(teamStr);
				}
				loggingService.log(`🔍 Found team from question text: ${teamName}`, null, "log");
			}
		}
		
		if (!teamName) {
			loggingService.log(`⚠️ No team name found in queryHighestScoringGame`, null, "warn");
			return { type: "team_not_found", data: [], message: "Could not identify team from question" };
		}
		
		// Extract season from question or timeRange
		let season: string | null = null;
		const timeFrames = analysis?.extractionResult?.timeFrames || [];
		const seasonFrame = timeFrames.find(tf => tf.type === "season");
		
		if (seasonFrame) {
			season = seasonFrame.value;
			// Normalize season format: 2020-2021 -> 2020/21, 2020/21 -> 2020/21
			if (season.includes("-")) {
				// Handle full year format: 2020-2021 -> 2020/21
				const fullYearMatch = season.match(/(\d{4})-(\d{4})/);
				if (fullYearMatch) {
					const startYear = fullYearMatch[1];
					const endYear = fullYearMatch[2];
					const shortEndYear = endYear.substring(2);
					season = `${startYear}/${shortEndYear}`;
				} else {
					// Handle short format: 2020-21 -> 2020/21
					season = season.replace("-", "/");
				}
			}
		} else if (analysis?.timeRange) {
			// Try to extract from timeRange
			const seasonMatch = analysis.timeRange.match(/(\d{4})[\/\-](\d{2,4})/);
			if (seasonMatch) {
				const startYear = seasonMatch[1];
				const endYear = seasonMatch[2];
				if (endYear.length === 4) {
					// Full year format: 2020-2021 -> 2020/21
					const shortEndYear = endYear.substring(2);
					season = `${startYear}/${shortEndYear}`;
				} else {
					// Short format: 2020-21 -> 2020/21
					season = `${startYear}/${endYear}`;
				}
			}
		} else {
			// Try to extract from question text
			const fullYearFullMatch = question.match(/(\d{4})[\/\-](\d{4})/);
			if (fullYearFullMatch) {
				const startYear = fullYearFullMatch[1];
				const endYear = fullYearFullMatch[2];
				const shortEndYear = endYear.substring(2);
				season = `${startYear}/${shortEndYear}`;
			} else {
				const seasonMatch = question.match(/(\d{4})[\/\-](\d{2})/);
				if (seasonMatch) {
					season = `${seasonMatch[1]}/${seasonMatch[2]}`;
				}
			}
		}
		
		if (!season) {
			loggingService.log(`⚠️ No season found in queryHighestScoringGame`, null, "warn");
			return { type: "season_not_found", data: [], message: "Could not identify season from question" };
		}
		
		// Build Cypher query to find highest scoring game
		const params: Record<string, unknown> = {
			graphLabel,
			team: teamName,
			season: season,
		};
		
		// Also try normalized season format (hyphen)
		const normalizedSeason = season.replace("/", "-");
		params.normalizedSeason = normalizedSeason;
		
		const query = `
			MATCH (f:Fixture {graphLabel: $graphLabel, team: $team})
			WHERE (f.season = $season OR f.season = $normalizedSeason)
			  AND (f.status IS NULL OR NOT (f.status IN ['Void', 'Postponed', 'Abandoned']))
			WITH f, 
			     coalesce(f.dorkiniansGoals, 0) + coalesce(f.conceded, 0) as totalGoals
			ORDER BY totalGoals DESC
			LIMIT 1
			RETURN f.date as date,
			       f.opposition as opposition,
			       f.homeOrAway as homeOrAway,
			       f.result as result,
			       f.dorkiniansGoals as dorkiniansGoals,
			       f.conceded as conceded,
			       totalGoals
		`;
		
		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			let readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$team/g, `'${teamName}'`)
				.replace(/\$season/g, `'${season}'`)
				.replace(/\$normalizedSeason/g, `'${normalizedSeason}'`);
			chatbotService.lastExecutedQueries.push(`HIGHEST_SCORING_GAME_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`HIGHEST_SCORING_GAME_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}
		
		try {
			const result = await neo4jService.executeQuery(query, params);
			loggingService.log(`🔍 Highest scoring game query result count: ${result?.length || 0}`, null, "log");
			
			if (!result || result.length === 0) {
				loggingService.log(`⚠️ No fixtures found for ${teamName} in ${season}`, null, "warn");
				return {
					type: "highest_scoring_game",
					teamName,
					season,
					data: null,
					message: `No fixtures found for ${teamName} in ${season}.`,
				};
			}
			
			const game = result[0];
			loggingService.log(`✅ Found highest scoring game for ${teamName} in ${season}: ${game.totalGoals} total goals`, null, "log");
			
			return {
				type: "highest_scoring_game",
				teamName,
				season,
				data: {
					date: game.date,
					opposition: game.opposition,
					homeOrAway: game.homeOrAway,
					result: game.result,
					dorkiniansGoals: game.dorkiniansGoals,
					conceded: game.conceded,
					totalGoals: game.totalGoals,
				},
			};
		} catch (error) {
			loggingService.log(`❌ Error in queryHighestScoringGame:`, error, "error");
			return {
				type: "error",
				data: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Query highest individual player goals in a single game
	 * Returns the player who scored the most goals in one game
	 */
	private static async queryHighestPlayerGoalsInGame(
		entities: string[],
		analysis?: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		const question = analysis?.question?.toLowerCase() || "";
		
		loggingService.log(`🔍 Querying highest individual player goals in one game`, null, "log");
		
		// Build query to find the top 10 highest goals scored by players in single games
		const query = `
			MATCH (md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.goals IS NOT NULL OR md.penaltiesScored IS NOT NULL
			WITH md,
			     coalesce(md.goals, 0) + coalesce(md.penaltiesScored, 0) as totalGoals
			WHERE totalGoals > 0
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WITH md.playerName as playerName,
			     totalGoals as goals,
			     md.date as date,
			     f.opposition as opposition,
			     md.team as team,
			     f.homeOrAway as homeOrAway,
			     f.result as result
			ORDER BY goals DESC, date DESC
			LIMIT 10
			RETURN playerName,
			       goals,
			       date,
			       opposition,
			       team,
			       homeOrAway,
			       result
		`;
		
		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query.replace(/\$graphLabel/g, `'${graphLabel}'`);
			chatbotService.lastExecutedQueries.push(`HIGHEST_PLAYER_GOALS_IN_GAME_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`HIGHEST_PLAYER_GOALS_IN_GAME_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}
		
		try {
			const result = await neo4jService.executeQuery(query, { graphLabel });
			loggingService.log(`🔍 Highest individual player goals query result count: ${result?.length || 0}`, null, "log");
			
			if (!result || result.length === 0) {
				loggingService.log(`⚠️ No match details found for highest individual goals`, null, "warn");
				return {
					type: "highest_player_goals_in_game",
					data: [],
					message: "No match data found.",
				};
			}
			
			loggingService.log(`✅ Found ${result.length} highest individual player goals records`, null, "log");
			
			return {
				type: "highest_player_goals_in_game",
				data: result,
			};
		} catch (error) {
			loggingService.log(`❌ Error in queryHighestPlayerGoalsInGame:`, error, "error");
			return {
				type: "error",
				data: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Query highest team goals in games where a specific player was playing
	 * Returns the fixture with highest dorkiniansGoals where the player participated
	 */
	static async queryHighestTeamGoalsInPlayerGames(
		playerName: string,
		analysis?: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		
		loggingService.log(`🔍 Querying highest team goals in games where ${playerName} was playing`, null, "log");
		
		// Build query to find fixture with highest dorkiniansGoals where player participated
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE f.dorkiniansGoals IS NOT NULL
			RETURN f.date as date,
			       f.opposition as opposition,
			       f.homeOrAway as homeOrAway,
			       f.result as result,
			       f.dorkiniansGoals as dorkiniansGoals,
			       f.conceded as conceded
			ORDER BY f.dorkiniansGoals DESC, f.date DESC
			LIMIT 1
		`;
		
		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			let readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`HIGHEST_TEAM_GOALS_IN_PLAYER_GAME_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`HIGHEST_TEAM_GOALS_IN_PLAYER_GAME_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}
		
		try {
			const result = await neo4jService.executeQuery(query, { graphLabel, playerName });
			loggingService.log(`🔍 Highest team goals in player games query result count: ${result?.length || 0}`, null, "log");
			
			if (!result || result.length === 0) {
				loggingService.log(`⚠️ No fixtures found for ${playerName}`, null, "warn");
				return {
					type: "highest_team_goals_in_player_game",
					playerName,
					data: null,
					message: `No games found where ${playerName} was playing.`,
				};
			}
			
			const game = result[0];
			loggingService.log(`✅ Found highest team goals game for ${playerName}: ${game.dorkiniansGoals} goals`, null, "log");
			
			return {
				type: "highest_team_goals_in_player_game",
				playerName,
				data: {
					date: game.date,
					opposition: game.opposition,
					homeOrAway: game.homeOrAway,
					result: game.result,
					dorkiniansGoals: game.dorkiniansGoals,
					conceded: game.conceded,
				},
			};
		} catch (error) {
			loggingService.log(`❌ Error in queryHighestTeamGoalsInPlayerGames:`, error, "error");
			return {
				type: "error",
				data: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Query hat-tricks with optional filters (year, team, date range)
	 * Returns player-level data grouped by player
	 */
	static async queryYearHatTricks(
		year: number | null,
		analysis: EnhancedQuestionAnalysis,
		teamName?: string | null,
		startDate?: string | null,
		endDate?: string | null,
	): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying hat-tricks with filters - year: ${year}, team: ${teamName}, startDate: ${startDate}, endDate: ${endDate}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		// Build WHERE conditions dynamically
		const whereConditions: string[] = [];
		const params: Record<string, unknown> = { graphLabel };

		// Date filtering
		if (startDate && endDate) {
			whereConditions.push(`md.date >= $startDate AND md.date <= $endDate`);
			params.startDate = startDate;
			params.endDate = endDate;
		} else if (startDate) {
			whereConditions.push(`md.date >= $startDate`);
			params.startDate = startDate;
		} else if (endDate) {
			whereConditions.push(`md.date <= $endDate`);
			params.endDate = endDate;
		} else if (year) {
			whereConditions.push(`date(md.date).year = $year`);
			params.year = year;
		}

		// Team filtering
		if (teamName) {
			whereConditions.push(`md.team = $teamName`);
			params.teamName = teamName;
		}

		// Hat-trick condition (always required)
		whereConditions.push(`(coalesce(md.goals, 0) + coalesce(md.penaltiesScored, 0)) >= 3`);

		const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

		const query = `
			MATCH (md:MatchDetail {graphLabel: $graphLabel})
			${whereClause}
			WITH md.playerName as playerName, count(md) as hatTrickCount
			ORDER BY hatTrickCount DESC, playerName ASC
			RETURN playerName, hatTrickCount
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			let readyToExecuteQuery = query.replace(/\$graphLabel/g, `'${graphLabel}'`);
			if (params.startDate) readyToExecuteQuery = readyToExecuteQuery.replace(/\$startDate/g, `'${params.startDate}'`);
			if (params.endDate) readyToExecuteQuery = readyToExecuteQuery.replace(/\$endDate/g, `'${params.endDate}'`);
			if (params.year) readyToExecuteQuery = readyToExecuteQuery.replace(/\$year/g, `${params.year}`);
			if (params.teamName) readyToExecuteQuery = readyToExecuteQuery.replace(/\$teamName/g, `'${params.teamName}'`);
			chatbotService.lastExecutedQueries.push(`HATTRICKS_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`HATTRICKS_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, params);
			const playerData = (result || []).map((row: any) => ({
				playerName: row.playerName || "Unknown",
				hatTrickCount: typeof row.hatTrickCount === 'number' 
					? row.hatTrickCount 
					: (row.hatTrickCount?.low || 0) + (row.hatTrickCount?.high || 0) * 4294967296
			}));
			
			const totalCount = playerData.reduce((sum, player) => sum + player.hatTrickCount, 0);
			
			return { 
				type: "hattrick_count", 
				data: playerData,
				totalCount,
				isHatTrickQuery: true,
				isYearWideHatTrickQuery: true,
				year: year || undefined,
				teamName: teamName || undefined,
				startDate: startDate || undefined,
				endDate: endDate || undefined,
			};
		} catch (error) {
			loggingService.log(`❌ Error in hat-tricks query:`, error, "error");
			return { type: "error", data: [], error: "Error querying hat-tricks data" };
		}
	}

	/**
	 * Query count of games where player scored or assisted and team kept a clean sheet
	 * Returns count of MatchDetail nodes where player scored (goals/penaltiesScored) or assisted AND Fixture.conceded = 0
	 */
	static async queryCleanSheetGoalInvolvements(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying clean sheet goal involvements for player: ${playerName}`, null, "log");

		const graphLabel = neo4jService.getGraphLabel();
		const params: Record<string, unknown> = {
			playerName,
			graphLabel
		};

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE (coalesce(md.goals, 0) > 0 OR coalesce(md.penaltiesScored, 0) > 0 OR coalesce(md.assists, 0) > 0)
			  AND coalesce(f.conceded, 0) = 0
			RETURN count(DISTINCT md) as count
		`;

		try {
			const result = await neo4jService.executeQuery(query, params);
			
			if (!result || result.length === 0) {
				return {
					type: "clean_sheet_goal_involvements",
					data: [],
					count: 0,
					playerName
				};
			}

			const count = typeof result[0].count === 'number' 
				? result[0].count 
				: (result[0].count?.low || 0) + (result[0].count?.high || 0) * 4294967296;

			return {
				type: "clean_sheet_goal_involvements",
				data: result,
				count,
				playerName
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			loggingService.log(`❌ Error in clean sheet goal involvements query: ${errorMessage}`, error, "error");
			return { 
				type: "error", 
				data: [], 
				error: `Error querying clean sheet goal involvements: ${errorMessage}` 
			};
		}
	}
}
