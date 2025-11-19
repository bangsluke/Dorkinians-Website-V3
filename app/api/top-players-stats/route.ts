import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { buildFilterConditions } from "../player-data/route";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { filters, statType } = body;

		const validStatTypes = ["goals", "assists", "cleanSheets", "mom", "saves", "yellowCards", "redCards", "penaltiesScored", "fantasyPoints", "goalInvolvements"];
		if (!statType || !validStatTypes.includes(statType)) {
			return NextResponse.json({ error: `Valid statType is required. Options: ${validStatTypes.join(", ")}` }, { status: 400, headers: corsHeaders });
		}

		if (!filters || typeof filters !== "object") {
			return NextResponse.json({ error: "Filters object is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const params: any = {
			graphLabel,
		};

		// Base query - match all players with allowOnSite = true
		let query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		`;

		// Build filter conditions
		const conditions = buildFilterConditions(filters, params);
		if (conditions.length > 0) {
			query += ` WHERE ${conditions.join(" AND ")}`;
		}

		// Determine which stat to aggregate and sort by
		const statFieldMap: { [key: string]: string } = {
			goals: "goals",
			assists: "assists",
			cleanSheets: "cleanSheets",
			mom: "mom",
			saves: "saves",
			yellowCards: "yellowCards",
			redCards: "redCards",
			penaltiesScored: "penaltiesScored",
			fantasyPoints: "fantasyPoints",
			goalInvolvements: "goalInvolvements",
		};

		const statField = statFieldMap[statType];

		// Aggregate stats per player
		// cleanSheets is stored as integer on MatchDetail, sum it directly like goals/assists
		query += `
			WITH p, md, f
			WITH p,
				count(md) as appearances,
				sum(coalesce(md.goals, 0)) as goals,
				sum(coalesce(md.assists, 0)) as assists,
				sum(coalesce(md.cleanSheets, 0)) as cleanSheets,
				sum(coalesce(md.mom, 0)) as mom,
				sum(coalesce(md.penaltiesScored, 0)) as penaltiesScored,
				sum(coalesce(md.saves, 0)) as saves,
				sum(coalesce(md.yellowCards, 0)) as yellowCards,
				sum(coalesce(md.redCards, 0)) as redCards,
				sum(coalesce(md.fantasyPoints, 0)) as fantasyPoints,
				sum(coalesce(md.goals, 0)) + sum(coalesce(md.assists, 0)) as goalInvolvements
			WHERE ${statField} > 0
			RETURN p.playerName as playerName,
				coalesce(appearances, 0) as appearances,
				coalesce(goals, 0) as goals,
				coalesce(assists, 0) as assists,
				coalesce(cleanSheets, 0) as cleanSheets,
				coalesce(mom, 0) as mom,
				coalesce(penaltiesScored, 0) as penaltiesScored,
				coalesce(saves, 0) as saves,
				coalesce(yellowCards, 0) as yellowCards,
				coalesce(redCards, 0) as redCards,
				coalesce(fantasyPoints, 0) as fantasyPoints,
				coalesce(goalInvolvements, 0) as goalInvolvements
			ORDER BY ${statField} DESC, appearances DESC
			LIMIT 5
		`;

		// Log query for debugging
		console.log(`[TopPlayersStats] StatType: ${statType}, Query:`, query);
		console.log(`[TopPlayersStats] Params:`, JSON.stringify(params, null, 2));

		let result;
		try {
			result = await neo4jService.runQuery(query, params);
			console.log(`[TopPlayersStats] Query executed successfully, records: ${result.records.length}`);
		} catch (queryError: any) {
			console.error("[TopPlayersStats] Cypher query error:", queryError);
			console.error("[TopPlayersStats] Query:", query);
			console.error("[TopPlayersStats] Params:", JSON.stringify(params, null, 2));
			return NextResponse.json(
				{ error: "Query execution failed", details: queryError.message },
				{ status: 500, headers: corsHeaders }
			);
		}

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

		// Extract player stats from results
		const players = result.records.map((record) => {
			const player = {
				playerName: String(record.get("playerName") || ""),
				appearances: toNumber(record.get("appearances")),
				goals: toNumber(record.get("goals")),
				assists: toNumber(record.get("assists")),
				cleanSheets: toNumber(record.get("cleanSheets")),
				mom: toNumber(record.get("mom")),
				penaltiesScored: toNumber(record.get("penaltiesScored")),
				saves: toNumber(record.get("saves")),
				yellowCards: toNumber(record.get("yellowCards")),
				redCards: toNumber(record.get("redCards")),
				fantasyPoints: toNumber(record.get("fantasyPoints")),
				goalInvolvements: toNumber(record.get("goalInvolvements")),
			};
			console.log(`[TopPlayersStats] Player: ${player.playerName}, ${statType}: ${player[statField as keyof typeof player]}, statType: ${statType}`);
			return player;
		});

		console.log(`[TopPlayersStats] Returning ${players.length} players for statType: ${statType}`);
		return NextResponse.json({ players }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching top players stats:", error);
		return NextResponse.json({ error: "Failed to fetch top players stats" }, { status: 500, headers: corsHeaders });
	}
}

