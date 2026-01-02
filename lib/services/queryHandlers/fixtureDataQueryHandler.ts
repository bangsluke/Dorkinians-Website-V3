import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { TeamMappingUtils } from "../chatbotUtils/teamMappingUtils";
import { DateUtils } from "../chatbotUtils/dateUtils";
import { loggingService } from "../loggingService";
import { TeamDataQueryHandler } from "./teamDataQueryHandler";

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
		
		// Check if this is a highest scoring game query
		const isHighestScoringGameQuery = 
			question.includes("highest scoring game") ||
			question.includes("highest scoring") && question.includes("game") ||
			question.includes("most goals") && question.includes("game") ||
			question.includes("highest total") && question.includes("game");
		
		if (isHighestScoringGameQuery) {
			return await this.queryHighestScoringGame(entities, analysis);
		}

		// Check for year-wide hat-trick questions (handles "hattrick", "hat-trick", "hat trick" variations)
		const hatTrickPattern = /hat[- ]?trick/i;
		const hasYear = question.match(/\b(20\d{2})\b/) || analysis?.extractionResult?.timeFrames?.some(tf => {
			// Check if timeFrame value contains a year
			const yearMatch = tf.value?.match(/\b(20\d{2})\b/);
			return yearMatch !== null;
		});
		const hasYearWidePhrases = question.includes("across all teams") || 
			question.includes("across all") ||
			question.includes("all teams");
		const hasPlayerMention = question.includes("has ") || question.includes("have ") || 
			question.includes(" i ") || question.includes(" i?");
		const isYearHatTrickQuestion = hatTrickPattern.test(question) && 
			(question.includes("how many") || question.includes("count")) &&
			hasYear &&
			(hasYearWidePhrases || !hasPlayerMention);

		if (isYearHatTrickQuestion && analysis) {
			// Extract year from timeFrames or question text
			let year: number | null = null;
			const timeFrames = analysis.extractionResult?.timeFrames || [];
			
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

			if (year && !isNaN(year) && year >= 2000 && year <= 2100) {
				loggingService.log(`🔍 Detected year-wide hat-trick question for year: ${year}`, null, "log");
				return await this.queryYearHatTricks(year, analysis);
			} else {
				loggingService.log(`⚠️ Could not extract valid year from hat-trick question`, null, "warn");
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

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			return { type: "games_where_scored", data: result, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in queryGamesWherePlayerScored:`, error, "error");
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
	 * Query year-wide hat-tricks (count distinct matches in a year where any player scored 3+ goals including penalties)
	 */
	static async queryYearHatTricks(
		year: number,
		analysis: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying year-wide hat-tricks for year: ${year}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		const query = `
			MATCH (md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE date(md.date).year = $year
				AND (coalesce(md.goals, 0) + coalesce(md.penaltiesScored, 0)) >= 3
			RETURN count(DISTINCT f) as value
		`;

		try {
			const result = await neo4jService.executeQuery(query, { year, graphLabel });
			const count = result && result.length > 0 && result[0].value !== undefined
				? (typeof result[0].value === 'number' 
					? result[0].value 
					: (result[0].value?.low || 0) + (result[0].value?.high || 0) * 4294967296)
				: 0;
			
			return { 
				type: "hattrick_count", 
				data: [{ value: count }], 
				isHatTrickQuery: true,
				year 
			};
		} catch (error) {
			loggingService.log(`❌ Error in year-wide hat-tricks query:`, error, "error");
			return { type: "error", data: [], error: "Error querying year-wide hat-tricks data" };
		}
	}
}
