import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { loggingService } from "../loggingService";
import { ChatbotService } from "../chatbotService";

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

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`CO_PLAYERS_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`CO_PLAYERS_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

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

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`OPPONENTS_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`OPPONENTS_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			return { type: "opponents", data: result, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in opponents query:`, error, "error");
			return { type: "error", data: [], error: "Error querying opponents data" };
		}
	}

	/**
	 * Query goals scored against each opposition for a player
	 */
	static async queryPlayerGoalsAgainstOpposition(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying goals against opposition for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		const query = `
			MATCH (p:Player {playerName: $playerName, graphLabel: $graphLabel})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE f.opposition IS NOT NULL AND f.opposition <> ""
			WITH f.opposition as opposition,
			     sum(coalesce(md.goals, 0) + coalesce(md.penaltiesScored, 0)) as goalsScored
			WHERE goalsScored > 0
			ORDER BY goalsScored DESC
			LIMIT 10
			RETURN opposition, goalsScored
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`OPPOSITION_GOALS_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`OPPOSITION_GOALS_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			return { type: "opposition_goals", data: result, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in goals against opposition query:`, error, "error");
			return { type: "error", data: [], error: "Error querying goals against opposition data" };
		}
	}

	/**
	 * Query players who have played with the most different teammates
	 */
	static async queryMostDifferentTeammates(limit: number = 10): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying players with most different teammates`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (p1:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(md1:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md1)
			MATCH (f)-[:HAS_MATCH_DETAILS]->(md2:MatchDetail {graphLabel: $graphLabel})
			MATCH (p2:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(md2)
			WHERE p1 <> p2
			WITH p1, collect(DISTINCT p2.playerName) as teammates
			RETURN p1.playerName as playerName, size(teammates) as teammateCount
			ORDER BY teammateCount DESC
			LIMIT $limit
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$limit/g, `${limit}`);
			chatbotService.lastExecutedQueries.push(`MOST_DIFFERENT_TEAMMATES_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`MOST_DIFFERENT_TEAMMATES_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel, limit });
			return { type: "most_different_teammates", data: result };
		} catch (error) {
			loggingService.log(`❌ Error in most different teammates query:`, error, "error");
			return { type: "error", data: [], error: "Error querying most different teammates data" };
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
			whereConditions.push("f.season = $season", "md1.season = $season", "md2.season = $season");
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
			LIMIT 10
			RETURN teammateName, gamesTogether
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			let readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			if (teamName) readyToExecuteQuery = readyToExecuteQuery.replace(/\$teamName/g, `'${teamName}'`);
			if (season) readyToExecuteQuery = readyToExecuteQuery.replace(/\$season/g, `'${season}'`);
			if (startDate) readyToExecuteQuery = readyToExecuteQuery.replace(/\$startDate/g, `'${startDate}'`);
			if (endDate) readyToExecuteQuery = readyToExecuteQuery.replace(/\$endDate/g, `'${endDate}'`);
			chatbotService.lastExecutedQueries.push(`RELATIONSHIP_MOST_PLAYED_WITH_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`RELATIONSHIP_MOST_PLAYED_WITH_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

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
	 * Query player stats against a specific opposition
	 */
	static async queryPlayerStatsAgainstOpposition(
		playerName: string,
		oppositionName: string,
		metric?: string
	): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying player stats against opposition: ${playerName} vs ${oppositionName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		// Build query based on metric
		let returnClause = "";
		if (metric === "goals" || metric === "G") {
			returnClause = `
				coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
				coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as goals,
				count(md) as appearances,
				count(DISTINCT f) as gamesPlayed
			`;
		} else if (metric === "assists" || metric === "A") {
			returnClause = `
				coalesce(sum(CASE WHEN md.assists IS NULL OR md.assists = "" THEN 0 ELSE md.assists END), 0) as assists,
				count(md) as appearances,
				count(DISTINCT f) as gamesPlayed
			`;
		} else if (metric === "appearances" || metric === "APP") {
			returnClause = `
				count(md) as appearances,
				count(DISTINCT f) as gamesPlayed
			`;
		} else {
			// Default: return comprehensive stats
			returnClause = `
				coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
				coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as goals,
				coalesce(sum(CASE WHEN md.assists IS NULL OR md.assists = "" THEN 0 ELSE md.assists END), 0) as assists,
				count(md) as appearances,
				count(DISTINCT f) as gamesPlayed,
				sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as wins,
				sum(CASE WHEN f.result = 'D' THEN 1 ELSE 0 END) as draws,
				sum(CASE WHEN f.result = 'L' THEN 1 ELSE 0 END) as losses
			`;
		}

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE toLower(trim(f.opposition)) = toLower(trim($oppositionName))
			RETURN ${returnClause}
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`)
				.replace(/\$oppositionName/g, `'${oppositionName}'`);
			chatbotService.lastExecutedQueries.push(`OPPOSITION_STATS_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`OPPOSITION_STATS_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { playerName, oppositionName, graphLabel });
			if (result && result.length > 0) {
				return { type: "opposition_stats", data: result[0], playerName, oppositionName, metric };
			}
			return { type: "opposition_stats", data: null, playerName, oppositionName, metric };
		} catch (error) {
			loggingService.log(`❌ Error in player stats against opposition query:`, error, "error");
			return { type: "error", data: [], error: "Error querying player stats against opposition" };
		}
	}

	/**
	 * Query distance traveled to play against an opposition
	 */
	static async queryDistanceToOpposition(oppositionName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying distance to opposition: ${oppositionName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (od:OppositionDetails {graphLabel: $graphLabel, opposition: $oppositionName})
			RETURN od.opposition as opposition,
			       od.distanceMiles as distanceMiles,
			       od.address as address,
			       od.latitude as latitude,
			       od.longitude as longitude
		`;

		try {
			const result = await neo4jService.executeQuery(query, { oppositionName, graphLabel });
			if (result && result.length > 0) {
				return { type: "opposition_distance", data: result[0] };
			}
			return { type: "opposition_distance", data: null };
		} catch (error) {
			loggingService.log(`❌ Error in distance to opposition query:`, error, "error");
			return { type: "error", data: [], error: "Error querying distance to opposition" };
		}
	}

	/**
	 * Query most played against opposition
	 */
	static async queryMostPlayedAgainstOpposition(playerName?: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying most played against opposition${playerName ? ` for player: ${playerName}` : ""}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		let query = "";
		if (playerName) {
			query = `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
				WHERE f.opposition IS NOT NULL AND f.opposition <> ""
				WITH f.opposition as opposition, count(DISTINCT f) as gamesPlayed
				ORDER BY gamesPlayed DESC
				LIMIT 10
				RETURN opposition, gamesPlayed
			`;
		} else {
			query = `
				MATCH (f:Fixture {graphLabel: $graphLabel})
				WHERE f.opposition IS NOT NULL AND f.opposition <> ""
				WITH f.opposition as opposition, count(DISTINCT f) as gamesPlayed
				ORDER BY gamesPlayed DESC
				LIMIT 10
				RETURN opposition, gamesPlayed
			`;
		}

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			let readyToExecuteQuery = query.replace(/\$graphLabel/g, `'${graphLabel}'`);
			if (playerName) {
				readyToExecuteQuery = readyToExecuteQuery.replace(/\$playerName/g, `'${playerName}'`);
			}
			chatbotService.lastExecutedQueries.push(`MOST_PLAYED_AGAINST_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`MOST_PLAYED_AGAINST_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, playerName ? { playerName, graphLabel } : { graphLabel });
			return { type: "most_played_against", data: result, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in most played against opposition query:`, error, "error");
			return { type: "error", data: [], error: "Error querying most played against opposition" };
		}
	}

	/**
	 * Query win rate against an opposition
	 */
	static async queryWinRateAgainstOpposition(oppositionName: string, playerName?: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying win rate against opposition: ${oppositionName}${playerName ? ` for player: ${playerName}` : ""}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		let query = "";
		if (playerName) {
			query = `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
				WHERE toLower(trim(f.opposition)) = toLower(trim($oppositionName))
				WITH count(DISTINCT f) as totalGames,
				     sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as wins,
				     sum(CASE WHEN f.result = 'D' THEN 1 ELSE 0 END) as draws,
				     sum(CASE WHEN f.result = 'L' THEN 1 ELSE 0 END) as losses
				RETURN totalGames, wins, draws, losses,
				       CASE WHEN totalGames > 0 THEN round(100.0 * wins / totalGames * 100) / 100 ELSE 0.0 END as winRate
			`;
		} else {
			query = `
				MATCH (f:Fixture {graphLabel: $graphLabel})
				WHERE toLower(trim(f.opposition)) = toLower(trim($oppositionName))
				WITH count(DISTINCT f) as totalGames,
				     sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as wins,
				     sum(CASE WHEN f.result = 'D' THEN 1 ELSE 0 END) as draws,
				     sum(CASE WHEN f.result = 'L' THEN 1 ELSE 0 END) as losses
				RETURN totalGames, wins, draws, losses,
				       CASE WHEN totalGames > 0 THEN round(100.0 * wins / totalGames * 100) / 100 ELSE 0.0 END as winRate
			`;
		}

		try {
			const result = await neo4jService.executeQuery(query, playerName ? { playerName, oppositionName, graphLabel } : { oppositionName, graphLabel });
			if (result && result.length > 0) {
				return { type: "win_rate_against", data: result[0], oppositionName, playerName };
			}
			return { type: "win_rate_against", data: null, oppositionName, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in win rate against opposition query:`, error, "error");
			return { type: "error", data: [], error: "Error querying win rate against opposition" };
		}
	}

	/**
	 * Query distance traveled by a player
	 */
	static async queryPlayerDistanceTraveled(playerName: string, season?: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying distance traveled for player: ${playerName}${season ? ` in season ${season}` : ""}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		let query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			MATCH (od:OppositionDetails {graphLabel: $graphLabel})
			WHERE f.opposition = od.opposition AND f.homeOrAway = 'Away'
		`;
		
		if (season) {
			query += ` AND f.season = $season`;
		}
		
		query += `
			WITH p, sum(coalesce(od.distanceMiles, 0)) as totalDistance, count(DISTINCT f) as awayGames
			RETURN p.playerName as playerName, totalDistance, awayGames,
			       CASE WHEN awayGames > 0 THEN round(100.0 * totalDistance / awayGames) / 100.0 ELSE 0.0 END as averageDistance
		`;

		try {
			const result = await neo4jService.executeQuery(query, season ? { playerName, season, graphLabel } : { playerName, graphLabel });
			if (result && result.length > 0) {
				return { type: "distance_traveled", data: result[0], playerName, season };
			}
			return { type: "distance_traveled", data: { totalDistance: 0, awayGames: 0, averageDistance: 0 }, playerName, season };
		} catch (error) {
			loggingService.log(`❌ Error in distance traveled query:`, error, "error");
			return { type: "error", data: [], error: "Error querying distance traveled data" };
		}
	}

	/**
	 * Query furthest opposition
	 */
	static async queryFurthestOpposition(): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying furthest opposition`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (od:OppositionDetails {graphLabel: $graphLabel})
			WHERE od.distanceMiles IS NOT NULL AND od.distanceMiles > 0
			RETURN od.opposition as opposition,
			       od.distanceMiles as distanceMiles,
			       od.address as address
			ORDER BY od.distanceMiles DESC
			LIMIT 10
		`;

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel });
			return { type: "furthest_opposition", data: result };
		} catch (error) {
			loggingService.log(`❌ Error in furthest opposition query:`, error, "error");
			return { type: "error", data: [], error: "Error querying furthest opposition data" };
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

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			let readyToExecuteQuery = query
				.replace(/\$playerName1/g, `'${playerName1}'`)
				.replace(/\$playerName2/g, `'${playerName2}'`)
				.replace(/\$graphLabel/g, `'${graphLabel}'`);
			if (teamName) {
				readyToExecuteQuery = readyToExecuteQuery.replace(/\$teamName/g, `'${teamName}'`);
			}
			if (season) {
				readyToExecuteQuery = readyToExecuteQuery.replace(/\$season/g, `'${season}'`);
			}
			if (startDate && endDate) {
				readyToExecuteQuery = readyToExecuteQuery.replace(/\$startDate/g, `'${startDate}'`).replace(/\$endDate/g, `'${endDate}'`);
			}
			chatbotService.lastExecutedQueries.push(`GAMES_PLAYED_TOGETHER_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`GAMES_PLAYED_TOGETHER_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
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

	/**
	 * Query clean sheets (games with 0 conceded) where two specific players played together
	 */
	static async queryCleanSheetsPlayedTogether(
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
		
		loggingService.log(`🔍 Querying clean sheets played together for players: ${playerName1} and ${playerName2}${timeContext ? ` (${timeContext})` : ""}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		const whereConditions: string[] = [
			"p1.playerName = $playerName1",
			"p2.playerName = $playerName2",
			"p1 <> p2",
			"coalesce(f.conceded, 0) = 0"
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
			RETURN count(DISTINCT f) as cleanSheetsTogether
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

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			let readyToExecuteQuery = query
				.replace(/\$playerName1/g, `'${playerName1}'`)
				.replace(/\$playerName2/g, `'${playerName2}'`)
				.replace(/\$graphLabel/g, `'${graphLabel}'`);
			if (teamName) {
				readyToExecuteQuery = readyToExecuteQuery.replace(/\$teamName/g, `'${teamName}'`);
			}
			if (season) {
				readyToExecuteQuery = readyToExecuteQuery.replace(/\$season/g, `'${season}'`);
			}
			if (startDate && endDate) {
				readyToExecuteQuery = readyToExecuteQuery.replace(/\$startDate/g, `'${startDate}'`).replace(/\$endDate/g, `'${endDate}'`);
			}
			chatbotService.lastExecutedQueries.push(`CLEAN_SHEETS_PLAYED_TOGETHER_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`CLEAN_SHEETS_PLAYED_TOGETHER_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, queryParams);
			
			// Extract the count from the result
			let cleanSheetsTogether = 0;
			if (result && Array.isArray(result) && result.length > 0) {
				const record = result[0];
				if (record && typeof record === "object" && "cleanSheetsTogether" in record) {
					let count = record.cleanSheetsTogether;
					
					// Handle Neo4j Integer objects
					if (count !== null && count !== undefined) {
						if (typeof count === "number") {
							cleanSheetsTogether = count;
						} else if (typeof count === "object") {
							if ("toNumber" in count && typeof count.toNumber === "function") {
								cleanSheetsTogether = (count as { toNumber: () => number }).toNumber();
							} else if ("low" in count && "high" in count) {
								const neo4jInt = count as { low?: number; high?: number };
								cleanSheetsTogether = (neo4jInt.low || 0) + (neo4jInt.high || 0) * 4294967296;
							} else {
								cleanSheetsTogether = Number(count) || 0;
							}
						} else {
							cleanSheetsTogether = Number(count) || 0;
						}
					}
				}
			}
			
			return {
				type: "clean_sheets_played_together",
				data: cleanSheetsTogether,
				playerName1,
				playerName2,
				teamName,
				season,
				startDate,
				endDate
			};
		} catch (error) {
			loggingService.log(`❌ Error in clean sheets played together query:`, error, "error");
			return { type: "error", data: [], error: "Error querying clean sheets played together data" };
		}
	}

	/**
	 * Query goals scored together for two specific players (sum of goals + penaltiesScored from both players in fixtures where they played together)
	 */
	static async queryGoalsScoredTogether(
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
		
		loggingService.log(`🔍 Querying goals scored together for players: ${playerName1} and ${playerName2}${timeContext ? ` (${timeContext})` : ""}`, null, "log");
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
			RETURN sum(coalesce(md1.goals, 0) + coalesce(md1.penaltiesScored, 0) + coalesce(md2.goals, 0) + coalesce(md2.penaltiesScored, 0)) as totalGoals
		`;
		
		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			let readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName1/g, `'${playerName1}'`)
				.replace(/\$playerName2/g, `'${playerName2}'`);
			if (teamName) readyToExecuteQuery = readyToExecuteQuery.replace(/\$teamName/g, `'${teamName}'`);
			if (season) readyToExecuteQuery = readyToExecuteQuery.replace(/\$season/g, `'${season}'`);
			if (startDate) readyToExecuteQuery = readyToExecuteQuery.replace(/\$startDate/g, `'${startDate}'`);
			if (endDate) readyToExecuteQuery = readyToExecuteQuery.replace(/\$endDate/g, `'${endDate}'`);
			chatbotService.lastExecutedQueries.push(`GOALS_SCORED_TOGETHER_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`GOALS_SCORED_TOGETHER_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}
		
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
			
			// Extract the total goals from the result
			let totalGoals = 0;
			if (result && Array.isArray(result) && result.length > 0) {
				const record = result[0];
				if (record && typeof record === "object" && "totalGoals" in record) {
					let goals = record.totalGoals;
					
					// Handle Neo4j Integer objects
					if (goals !== null && goals !== undefined) {
						if (typeof goals === "number") {
							totalGoals = goals;
						} else if (typeof goals === "object") {
							if ("toNumber" in goals && typeof goals.toNumber === "function") {
								totalGoals = (goals as { toNumber: () => number }).toNumber();
							} else if ("low" in goals && "high" in goals) {
								const neo4jInt = goals as { low?: number; high?: number };
								totalGoals = (neo4jInt.low || 0) + (neo4jInt.high || 0) * 4294967296;
							} else {
								totalGoals = Number(goals) || 0;
							}
						} else {
							totalGoals = Number(goals) || 0;
						}
					}
				}
			}
			
			return {
				type: "goals_scored_together",
				data: totalGoals,
				playerName1,
				playerName2,
				teamName,
				season,
				startDate,
				endDate
			};
		} catch (error) {
			loggingService.log(`❌ Error in goals scored together query:`, error, "error");
			return { type: "error", data: [], error: "Error querying goals scored together data" };
		}
	}

	/**
	 * Query count of unique teammates for a player
	 * Counts distinct players who played in the same fixtures
	 */
	static async queryTeammatesCount(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying teammates count for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md1:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md1)
			MATCH (f)-[:HAS_MATCH_DETAILS]->(md2:MatchDetail {graphLabel: $graphLabel})
			MATCH (other:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(md2)
			WHERE other.playerName <> p.playerName
			RETURN count(DISTINCT other.playerName) as count
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`TEAMMATES_COUNT_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`TEAMMATES_COUNT_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel, playerName });
			const count = result && result.length > 0 ? (result[0]?.count || 0) : 0;
			
			loggingService.log(`✅ Found ${count} unique teammates for player: ${playerName}`, null, "log");
			
			return { 
				type: "teammates_count", 
				data: [{ count }],
				playerName
			};
		} catch (error) {
			loggingService.log(`❌ Error in teammates count query:`, error, "error");
			return { type: "error", data: [], error: "Error querying teammates count data" };
		}
	}
}

export const relationshipQueryHandler = new RelationshipQueryHandler();
