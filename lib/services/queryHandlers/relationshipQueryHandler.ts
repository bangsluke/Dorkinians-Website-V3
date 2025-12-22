import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { loggingService } from "../loggingService";

export class RelationshipQueryHandler {
	/**
	 * Query co-players data for a player
	 */
	static async queryPlayerCoPlayersData(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying for co-players for player: ${playerName}`, null, "log");
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
			loggingService.log(`❌ Error in co-players query:`, error, "error");
			return { type: "error", data: [], error: "Error querying co-players data" };
		}
	}

	/**
	 * Query opponents data for a player
	 */
	static async queryPlayerOpponentsData(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying for opponents for player: ${playerName}`, null, "log");
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
			loggingService.log(`❌ Error in opponents query:`, error, "error");
			return { type: "error", data: [], error: "Error querying opponents data" };
		}
	}

	/**
	 * Query most played with for a player
	 */
	static async queryMostPlayedWith(
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
		
		loggingService.log(`🔍 Querying most played with for player: ${playerName}${timeContext ? ` (${timeContext})` : ""}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
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

		try {
			const result = await neo4jService.executeQuery(query, queryParams);
			return { 
				type: "most_played_with", 
				data: result, 
				playerName, 
				teamName,
				season,
				startDate,
				endDate
			};
		} catch (error) {
			loggingService.log(`❌ Error in most played with query:`, error, "error");
			return { type: "error", data: [], error: "Error querying most played with data" };
		}
	}

	/**
	 * Query games played together for two specific players
	 */
	static async queryGamesPlayedTogether(
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
		
		loggingService.log(`🔍 Querying games played together for players: ${playerName1} and ${playerName2}${timeContext ? ` (${timeContext})` : ""}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
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

		try {
			const result = await neo4jService.executeQuery(query, queryParams);
			
			// Extract the count from the result
			let gamesTogether = 0;
			if (result && Array.isArray(result) && result.length > 0) {
				const record = result[0];
				if (record && typeof record === "object" && "gamesTogether" in record) {
					let count = record.gamesTogether;
					
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
				}
			}
			
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
			loggingService.log(`❌ Error in games played together query:`, error, "error");
			return { type: "error", data: [], error: "Error querying games played together data" };
		}
	}
}

export const relationshipQueryHandler = new RelationshipQueryHandler();
