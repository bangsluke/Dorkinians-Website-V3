import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { loggingService } from "../loggingService";
import { ChatbotService } from "../chatbotService";

export class ClubDataQueryHandler {
	/**
	 * Query club-wide data
	 */
	static async queryClubData(_entities: string[], _metrics: string[], analysis: EnhancedQuestionAnalysis): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 queryClubData called`, null, "log");

		const question = analysis.question?.toLowerCase() || "";
		
		// Check if this is asking about which team has fewest/most goals conceded
		const isFewestConceded = (question.includes("fewest") || question.includes("least")) && question.includes("conceded");
		const isMostConceded = question.includes("most") && question.includes("conceded");
		const isGoalsConceded = question.includes("conceded");
		const isGoalsScored = question.includes("scored") || (question.includes("goals") && !isGoalsConceded);
		const isPlayerCount = question.includes("players") || question.includes("played for");

		const graphLabel = neo4jService.getGraphLabel();
		const params: any = {
			graphLabel,
		};

		try {
			// Handle "which team has conceded the fewest goals" query
			if (isFewestConceded || isMostConceded) {
				const orderDirection = isFewestConceded ? "ASC" : "DESC";
				const teamConcededQuery = `
					MATCH (f:Fixture {graphLabel: $graphLabel})
					WHERE f.team IS NOT NULL 
					  AND (f.status IS NULL OR NOT (f.status IN ['Void', 'Postponed', 'Abandoned']))
					WITH f.team as team, sum(coalesce(f.conceded, 0)) as goalsConceded
					RETURN team, goalsConceded
					ORDER BY goalsConceded ${orderDirection}
				`;

				// Push query to chatbotService for extraction
				try {
					const chatbotService = ChatbotService.getInstance();
					const readyToExecuteQuery = teamConcededQuery.replace(/\$graphLabel/g, `'${graphLabel}'`);
					chatbotService.lastExecutedQueries.push(`CLUB_TEAM_CONCEDED_QUERY: ${teamConcededQuery}`);
					chatbotService.lastExecutedQueries.push(`CLUB_TEAM_CONCEDED_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
				} catch (error) {
					// Ignore if chatbotService not available
				}

				const teamConcededResult = await neo4jService.executeQuery(teamConcededQuery, params);
				loggingService.log(`🔍 Team conceded goals query result:`, teamConcededResult, "log");

				if (teamConcededResult && teamConcededResult.length > 0) {
					return {
						type: "team_conceded_ranking",
						data: teamConcededResult,
						isFewest: isFewestConceded,
					};
				}

				return {
					type: "team_conceded_ranking",
					data: [],
					isFewest: isFewestConceded,
				};
			}

			// Query fixtures for club-wide goals
			const goalsQuery = `
				MATCH (f:Fixture {graphLabel: $graphLabel})
				RETURN 
					coalesce(sum(f.dorkiniansGoals), 0) as goalsScored,
					coalesce(sum(f.conceded), 0) as goalsConceded,
					count(f) as gamesPlayed
			`;

			const goalsResult = await neo4jService.executeQuery(goalsQuery, params);
			loggingService.log(`🔍 Club goals query result:`, goalsResult, "log");

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

				const playersResult = await neo4jService.executeQuery(playersQuery, params);
				loggingService.log(`🔍 Club players query result:`, playersResult, "log");

				if (playersResult && playersResult.length > 0) {
					numberOfPlayers = playersResult[0].numberOfPlayers || 0;
				}
			}

			// Check for team comparison queries
			const isTeamComparisonQuery = 
				question.includes("compare") && question.includes("team") ||
				question.includes("all teams") && (question.includes("record") || question.includes("stats") || question.includes("goals"));

			if (isTeamComparisonQuery) {
				const teamComparisonQuery = `
					MATCH (f:Fixture {graphLabel: $graphLabel})
					WHERE f.team IS NOT NULL 
					  AND (f.status IS NULL OR NOT (f.status IN ['Void', 'Postponed', 'Abandoned']))
					WITH f.team as team,
					     count(DISTINCT f) as gamesPlayed,
					     sum(coalesce(f.dorkiniansGoals, 0)) as goalsScored,
					     sum(coalesce(f.conceded, 0)) as goalsConceded,
					     sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as wins,
					     sum(CASE WHEN f.result = 'D' THEN 1 ELSE 0 END) as draws,
					     sum(CASE WHEN f.result = 'L' THEN 1 ELSE 0 END) as losses
					WITH team, gamesPlayed, goalsScored, goalsConceded, wins, draws, losses,
					     goalsScored - goalsConceded as goalDifference,
					     CASE WHEN gamesPlayed > 0 THEN round(100.0 * wins / gamesPlayed * 100) / 100.0 ELSE 0.0 END as winRate
					RETURN team, gamesPlayed, goalsScored, goalsConceded, wins, draws, losses, goalDifference, winRate
					ORDER BY team
				`;

				const teamComparisonResult = await neo4jService.executeQuery(teamComparisonQuery, params);
				return {
					type: "team_comparison",
					data: teamComparisonResult || [],
				};
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
			loggingService.log(`❌ Error in queryClubData:`, error, "error");
			return { type: "error", data: [], error: "Error querying club data" };
		}
	}

	/**
	 * Query players with exactly one goal in club history
	 */
	static async queryPlayersWithExactlyOneGoal(): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			  AND p.allGoalsScored = 1
			RETURN count(DISTINCT p.playerName) as playerCount
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query.replace(/\$graphLabel/g, `'${graphLabel}'`);
			chatbotService.lastExecutedQueries.push(`PLAYERS_EXACTLY_ONE_GOAL_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`PLAYERS_EXACTLY_ONE_GOAL_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel });
			const playerCount = result && result.length > 0 ? (result[0].playerCount || 0) : 0;
			return { type: "players_exactly_one_goal", data: [{ playerCount }] };
		} catch (error) {
			loggingService.log(`❌ Error in queryPlayersWithExactlyOneGoal:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}

	/**
	 * Query players who have played only one game for a specific team
	 */
	static async queryPlayersWithOnlyOneGameForTeam(teamName: string): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.team = $teamName
			WITH p, count(md) as gameCount
			WHERE gameCount = 1
			RETURN count(DISTINCT p.playerName) as playerCount
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$teamName/g, `'${teamName}'`);
			chatbotService.lastExecutedQueries.push(`PLAYERS_ONLY_ONE_GAME_TEAM_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`PLAYERS_ONLY_ONE_GAME_TEAM_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel, teamName });
			const playerCount = result && result.length > 0 ? (result[0].playerCount || 0) : 0;
			return { type: "players_only_one_game_team", data: [{ playerCount }], teamName };
		} catch (error) {
			loggingService.log(`❌ Error in queryPlayersWithOnlyOneGameForTeam:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}

	/**
	 * Query team player count by season - count unique players per team for a specific season
	 */
	static async queryTeamPlayerCountBySeason(season: string): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		
		// Normalize season format to slash format (e.g., "2018/19")
		const { normalizeSeasonFormat } = await import("../leagueTableService");
		const normalizedSeason = normalizeSeasonFormat(season, 'slash');
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE f.season = $season
			WITH md.team as team, collect(DISTINCT p.playerName) as players
			WHERE team IS NOT NULL
			RETURN team, size(players) as playerCount
			ORDER BY playerCount DESC, team ASC
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$season/g, `'${normalizedSeason}'`);
			chatbotService.lastExecutedQueries.push(`TEAM_PLAYER_COUNT_BY_SEASON_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`TEAM_PLAYER_COUNT_BY_SEASON_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel, season: normalizedSeason });
			return { type: "team_player_count_by_season", data: result || [], season: normalizedSeason };
		} catch (error) {
			loggingService.log(`❌ Error in queryTeamPlayerCountBySeason:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}

	/**
	 * Query total goals scored across all teams in a specific year
	 */
	static async queryTotalGoalsByYear(year: number): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		const yearStr = String(year);
		
		const query = `
			MATCH (md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.date STARTS WITH $year
			RETURN sum(coalesce(md.goals, 0)) + sum(coalesce(md.penaltiesScored, 0)) as totalGoals
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$year/g, `'${yearStr}'`);
			chatbotService.lastExecutedQueries.push(`TOTAL_GOALS_BY_YEAR_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`TOTAL_GOALS_BY_YEAR_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel, year: yearStr });
			const totalGoals = result && result.length > 0 ? (result[0].totalGoals || 0) : 0;
			return { type: "total_goals_by_year", data: [{ totalGoals }], year };
		} catch (error) {
			loggingService.log(`❌ Error in queryTotalGoalsByYear:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}

	/**
	 * Query total penalties scored in penalty shootouts across all MatchDetails
	 */
	static async queryPenaltyShootoutPenaltiesScored(): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (md:MatchDetail {graphLabel: $graphLabel})
			RETURN sum(coalesce(md.penaltyShootoutPenaltiesScored, 0)) as total
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query.replace(/\$graphLabel/g, `'${graphLabel}'`);
			chatbotService.lastExecutedQueries.push(`PENALTY_SHOOTOUT_SCORED_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`PENALTY_SHOOTOUT_SCORED_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel });
			const total = result && result.length > 0 ? (result[0].total || 0) : 0;
			return { type: "penalty_shootout_scored_total", data: [{ value: total }] };
		} catch (error) {
			loggingService.log(`❌ Error in queryPenaltyShootoutPenaltiesScored:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}

	/**
	 * Query total penalties missed in penalty shootouts across all MatchDetails
	 */
	static async queryPenaltyShootoutPenaltiesMissed(): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (md:MatchDetail {graphLabel: $graphLabel})
			RETURN sum(coalesce(md.penaltyShootoutPenaltiesMissed, 0)) as total
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query.replace(/\$graphLabel/g, `'${graphLabel}'`);
			chatbotService.lastExecutedQueries.push(`PENALTY_SHOOTOUT_MISSED_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`PENALTY_SHOOTOUT_MISSED_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel });
			const total = result && result.length > 0 ? (result[0].total || 0) : 0;
			return { type: "penalty_shootout_missed_total", data: [{ value: total }] };
		} catch (error) {
			loggingService.log(`❌ Error in queryPenaltyShootoutPenaltiesMissed:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}

	/**
	 * Query total penalties saved in penalty shootouts across all MatchDetails
	 */
	static async queryPenaltyShootoutPenaltiesSaved(): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (md:MatchDetail {graphLabel: $graphLabel})
			RETURN sum(coalesce(md.penaltyShootoutPenaltiesSaved, 0)) as total
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query.replace(/\$graphLabel/g, `'${graphLabel}'`);
			chatbotService.lastExecutedQueries.push(`PENALTY_SHOOTOUT_SAVED_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`PENALTY_SHOOTOUT_SAVED_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel });
			const total = result && result.length > 0 ? (result[0].total || 0) : 0;
			return { type: "penalty_shootout_saved_total", data: [{ value: total }] };
		} catch (error) {
			loggingService.log(`❌ Error in queryPenaltyShootoutPenaltiesSaved:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}
}
