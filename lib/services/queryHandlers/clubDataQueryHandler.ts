import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { loggingService } from "../loggingService";

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
}
