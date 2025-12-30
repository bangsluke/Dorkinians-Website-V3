import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { loggingService } from "../loggingService";

export class AwardsQueryHandler {
	/**
	 * Query TOTW (Team of the Week) data for a player
	 */
	static async queryPlayerTOTWData(playerName: string, period: "weekly" | "season", question?: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying for TOTW awards for player: ${playerName}, period: ${period}`, null, "log");
		const relationshipType = period === "weekly" ? "IN_WEEKLY_TOTW" : "IN_SEASON_TOTW";
		const graphLabel = neo4jService.getGraphLabel();

		// Check if question is asking for count (e.g., "how many times", "how many")
		const isCountQuestion = question && (
			question.toLowerCase().includes("how many times") ||
			question.toLowerCase().includes("how many") ||
			question.toLowerCase().includes("how much")
		);

		if (isCountQuestion) {
			// Return count query
			const totwNodeType = period === "weekly" ? "WeeklyTOTW" : "SeasonTOTW";
			const countQuery = period === "weekly"
				? `
					MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:IN_WEEKLY_TOTW]->(totw:WeeklyTOTW {graphLabel: $graphLabel})
					RETURN count(r) as totwCount
				`
				: `
					MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:IN_SEASON_TOTW]->(totw:SeasonTOTW {graphLabel: $graphLabel})
					RETURN count(r) as totwCount
				`;

			try {
				const result = await neo4jService.executeQuery(countQuery, { playerName, graphLabel });
				const count = result && result.length > 0 && result[0].totwCount !== undefined 
					? (typeof result[0].totwCount === 'number' 
						? result[0].totwCount 
						: (result[0].totwCount?.low || 0) + (result[0].totwCount?.high || 0) * 4294967296)
					: 0;
				return { type: "totw_count", count, playerName, period };
			} catch (error) {
				loggingService.log(`❌ Error in TOTW count query:`, error, "error");
				return { type: "error", data: [], error: "Error querying TOTW count data" };
			}
		}

		// Return list query (existing behavior)
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:${relationshipType}]->(totw {graphLabel: $graphLabel})
			RETURN p.playerName as playerName, 
			       totw.week as week, 
			       totw.season as season,
			       totw.date as date
			ORDER BY totw.date DESC
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			return { type: "totw_awards", data: result, playerName, period };
		} catch (error) {
			loggingService.log(`❌ Error in TOTW query:`, error, "error");
			return { type: "error", data: [], error: "Error querying TOTW data" };
		}
	}

	/**
	 * Query Player of the Month data for a player
	 */
	static async queryPlayersOfTheMonthData(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying for Player of the Month awards for player: ${playerName}`, null, "log");
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
			loggingService.log(`❌ Error in POTM query:`, error, "error");
			return { type: "error", data: [], error: "Error querying POTM data" };
		}
	}

	/**
	 * Query Captain awards data for a player
	 */
	static async queryPlayerCaptainAwardsData(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying for Captain awards for player: ${playerName}`, null, "log");
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
			loggingService.log(`❌ Error in Captain query:`, error, "error");
			return { type: "error", data: [], error: "Error querying Captain data" };
		}
	}

	/**
	 * Query player awards count (excluding Captain items)
	 */
	static async queryPlayerAwardsCount(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying for awards count (excluding Captain) for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:HAS_CAPTAIN_AWARDS]->(ca:CaptainsAndAwards {graphLabel: $graphLabel})
			WHERE NOT (ca.itemName CONTAINS "Captain")
			RETURN count(r) as awardCount
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			const count = result && result.length > 0 && result[0].awardCount !== undefined 
				? (typeof result[0].awardCount === 'number' 
					? result[0].awardCount 
					: (result[0].awardCount?.low || 0) + (result[0].awardCount?.high || 0) * 4294967296)
				: 0;
			return { type: "awards_count", count, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in awards count query:`, error, "error");
			return { type: "error", data: [], error: "Error querying awards count data" };
		}
	}

	/**
	 * Query historical award winners for a specific award and season
	 */
	static async queryHistoricalAwardWinner(awardName: string, season?: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying historical award winner: ${awardName}${season ? ` for season ${season}` : ""}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		// First, find the award in CaptainsAndAwards
		let query = `
			MATCH (ca:CaptainsAndAwards {graphLabel: $graphLabel})
			WHERE toLower(ca.itemName) CONTAINS toLower($awardName)
		`;
		
		if (season) {
			// Map season to property name (e.g., "2018/19" -> "season201819")
			const seasonProp = season.replace("/", "");
			query += ` AND ca.season${seasonProp} IS NOT NULL AND ca.season${seasonProp} <> ""`;
		}
		
		query += `
			RETURN ca.itemName as awardName,
			       ca.season201617 as season201617,
			       ca.season201718 as season201718,
			       ca.season201819 as season201819,
			       ca.season201920 as season202020,
			       ca.season202021 as season202021,
			       ca.season202122 as season202122,
			       ca.season202223 as season202223,
			       ca.season202324 as season202324,
			       ca.season202425 as season202425,
			       ca.season202526 as season202526,
			       ca.season202627 as season202627
		`;

		try {
			const result = await neo4jService.executeQuery(query, { awardName, graphLabel });
			if (result && result.length > 0) {
				const award = result[0];
				if (season) {
					const seasonProp = `season${season.replace("/", "")}`;
					const winner = award[seasonProp];
					return { type: "historical_award", awardName: award.awardName, season, winner, data: award };
				}
				return { type: "historical_award", awardName: award.awardName, data: award };
			}
			return { type: "historical_award", data: null };
		} catch (error) {
			loggingService.log(`❌ Error in historical award query:`, error, "error");
			return { type: "error", data: [], error: "Error querying historical award data" };
		}
	}

	/**
	 * Query all awards won by a player historically
	 */
	static async queryPlayerHistoricalAwards(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying historical awards for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:HAS_CAPTAIN_AWARDS]->(ca:CaptainsAndAwards {graphLabel: $graphLabel})
			RETURN ca.itemName as awardName,
			       r.season as season,
			       r.awardType as awardType
			ORDER BY r.season DESC, ca.itemName
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			return { type: "player_historical_awards", data: result, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in player historical awards query:`, error, "error");
			return { type: "error", data: [], error: "Error querying player historical awards data" };
		}
	}

	/**
	 * Query all winners of a specific award
	 */
	static async queryAllAwardWinners(awardName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying all winners of award: ${awardName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})-[r:HAS_CAPTAIN_AWARDS]->(ca:CaptainsAndAwards {graphLabel: $graphLabel})
			WHERE toLower(ca.itemName) CONTAINS toLower($awardName)
			RETURN p.playerName as playerName,
			       ca.itemName as awardName,
			       r.season as season,
			       r.awardType as awardType
			ORDER BY r.season DESC, p.playerName
		`;

		try {
			const result = await neo4jService.executeQuery(query, { awardName, graphLabel });
			return { type: "all_award_winners", data: result, awardName };
		} catch (error) {
			loggingService.log(`❌ Error in all award winners query:`, error, "error");
			return { type: "error", data: [], error: "Error querying all award winners data" };
		}
	}
}

export const awardsQueryHandler = new AwardsQueryHandler();
