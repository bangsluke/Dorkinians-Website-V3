import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { loggingService } from "../loggingService";

export class AwardsQueryHandler {
	/**
	 * Query TOTW (Team of the Week) data for a player
	 */
	static async queryPlayerTOTWData(playerName: string, period: "weekly" | "season"): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying for TOTW awards for player: ${playerName}, period: ${period}`, null, "log");
		const relationshipType = period === "weekly" ? "IN_WEEKLY_TOTW" : "IN_SEASON_TOTW";

		const query = `
			MATCH (p:Player {playerName: $playerName})-[r:${relationshipType}]->(totw)
			RETURN p.playerName as playerName, 
			       totw.week as week, 
			       totw.season as season,
			       totw.date as date
			ORDER BY totw.date DESC
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
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
}

export const awardsQueryHandler = new AwardsQueryHandler();
