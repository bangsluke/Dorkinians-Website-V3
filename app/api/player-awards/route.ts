import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const playerName = searchParams.get("playerName");

		if (!playerName) {
			return NextResponse.json({ error: "Player name parameter is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Award items - exclude captain items
		const awardItems = [
			"Player of the Season Award",
			"Young Player of the Season Award",
			"Most Improved Player of the Season Award",
			"Golden Boot",
			"Newcomer of the Year Award",
			"Alan Lambert Sportsmanship Award",
			"Chairman's Cup",
			"Peter Mills Volunteers Award",
			"Goalkeeper of the Year Award",
			"1st XI Squad Player of the Season Award",
			"2nd XI Squad Player of the Season Award",
			"3rd XI Squad Player of the Season Award",
			"4th XI Squad Player of the Season Award",
			"5th XI Squad Player of the Season Award",
			"6th XI Squad Player of the Season Award",
			"7th XI Squad Player of the Season Award",
			"8th XI Squad Player of the Season Award",
			"Vets Squad Player of the Season Award",
		];

		// Query CaptainsAndAwards for this player
		const awardsQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:HAS_CAPTAIN_AWARDS]->(ca:CaptainsAndAwards {graphLabel: $graphLabel})
			WHERE ca.itemName IN $awardItems
			RETURN ca.itemName as awardName, r.season as season, r.awardType as awardType
			ORDER BY r.season DESC, ca.itemName ASC
		`;

		const awardsResult = await neo4jService.runQuery(awardsQuery, {
			graphLabel,
			playerName,
			awardItems,
		});

		// Query Player of the Month count
		const potmQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:IN_PLAYER_OF_THE_MONTH]->(pm:PlayersOfTheMonth {graphLabel: $graphLabel})
			RETURN count(DISTINCT pm) as count
		`;

		const potmResult = await neo4jService.runQuery(potmQuery, {
			graphLabel,
			playerName,
		});

		// Query TOTW count (all appearances, not just Star Man)
		const totwQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:IN_WEEKLY_TOTW]->(wt:WeeklyTOTW {graphLabel: $graphLabel})
			RETURN count(DISTINCT wt) as count
		`;

		const totwResult = await neo4jService.runQuery(totwQuery, {
			graphLabel,
			playerName,
		});

		// Query Star Man count
		const starManQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:IN_WEEKLY_TOTW]->(wt:WeeklyTOTW {graphLabel: $graphLabel})
			WHERE r.isStarMan = true
			RETURN count(DISTINCT wt) as count
		`;

		const starManResult = await neo4jService.runQuery(starManQuery, {
			graphLabel,
			playerName,
		});

		// Query SeasonTOTW (TOTS) count
		const totsQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:IN_SEASON_TOTW]->(st:SeasonTOTW {graphLabel: $graphLabel})
			RETURN count(DISTINCT st) as count
		`;

		const totsResult = await neo4jService.runQuery(totsQuery, {
			graphLabel,
			playerName,
		});

		// Query Player of the Month #1 count (when player is ranked first)
		const potmFirstQuery = `
			MATCH (pm:PlayersOfTheMonth {graphLabel: $graphLabel})
			WHERE pm.player1Name = $playerName
			RETURN count(DISTINCT pm) as count
		`;

		const potmFirstResult = await neo4jService.runQuery(potmFirstQuery, {
			graphLabel,
			playerName,
		});

		// Helper function to convert Neo4j Integer to JavaScript number
		const toNumber = (value: any): number => {
			if (value === null || value === undefined) return 0;
			if (typeof value === "number") {
				if (isNaN(value)) return 0;
				return value;
			}
			if (typeof value === "object") {
				if ("toNumber" in value && typeof value.toNumber === "function") {
					return value.toNumber();
				}
				if ("low" in value && "high" in value) {
					const low = value.low || 0;
					const high = value.high || 0;
					return low + high * 4294967296;
				}
				if ("toString" in value) {
					const num = Number(value.toString());
					return isNaN(num) ? 0 : num;
				}
			}
			const num = Number(value);
			return isNaN(num) ? 0 : num;
		};

		const awards = awardsResult.records.map((record) => ({
			awardName: record.get("awardName"),
			season: record.get("season"),
			awardType: record.get("awardType"),
		}));

		const playerOfMonthCount = potmResult.records.length > 0 
			? toNumber(potmResult.records[0].get("count"))
			: 0;

		const totwCount = totwResult.records.length > 0
			? toNumber(totwResult.records[0].get("count"))
			: 0;

		const starManCount = starManResult.records.length > 0
			? toNumber(starManResult.records[0].get("count"))
			: 0;

		const totsCount = totsResult.records.length > 0
			? toNumber(totsResult.records[0].get("count"))
			: 0;

		const playerOfMonthFirstCount = potmFirstResult.records.length > 0
			? toNumber(potmFirstResult.records[0].get("count"))
			: 0;

		return NextResponse.json({
			awards,
			playerOfMonthCount,
			starManCount,
			totwCount,
			totsCount,
			playerOfMonthFirstCount,
		}, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching player awards:", error);
		return NextResponse.json({ error: "Failed to fetch player awards" }, { status: 500, headers: corsHeaders });
	}
}
