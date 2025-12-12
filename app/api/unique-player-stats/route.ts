import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { buildFilterConditions } from "../player-data/route";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { teamName, filters } = body;

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const params: any = {
			graphLabel,
		};

		// Build base query
		let query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		`;

		// Filter by team if provided and not "Whole Club"
		if (teamName && teamName !== "Whole Club") {
			params.teamName = teamName;
			query += ` WHERE f.team = $teamName`;
		}

		// Build filter conditions
		const conditions = buildFilterConditions(filters || null, params);
		if (conditions.length > 0) {
			const hasWhereClause = query.includes("WHERE");
			query += hasWhereClause ? ` AND ${conditions.join(" AND ")}` : ` WHERE ${conditions.join(" AND ")}`;
		}

		// Aggregate unique players per stat type
		query += `
			WITH p, md
			WHERE p.playerName IS NOT NULL
			WITH 
				count(DISTINCT CASE WHEN md.goals > 0 THEN p.playerName END) as playersWhoScored,
				count(DISTINCT CASE WHEN md.assists > 0 THEN p.playerName END) as playersWhoAssisted,
				count(DISTINCT CASE WHEN md.ownGoals > 0 THEN p.playerName END) as playersWithOwnGoals,
				count(DISTINCT CASE WHEN md.cleanSheets > 0 THEN p.playerName END) as playersWithCleanSheets,
				count(DISTINCT CASE WHEN md.mom > 0 THEN p.playerName END) as playersWithMoM,
				count(DISTINCT CASE WHEN md.saves > 0 THEN p.playerName END) as playersWithSaves,
				count(DISTINCT CASE WHEN md.yellowCards > 0 THEN p.playerName END) as playersWithYellowCards,
				count(DISTINCT CASE WHEN md.redCards > 0 THEN p.playerName END) as playersWithRedCards,
				count(DISTINCT CASE WHEN md.penaltiesScored > 0 THEN p.playerName END) as playersWhoScoredPenalties,
				count(DISTINCT CASE WHEN md.penaltiesSaved > 0 THEN p.playerName END) as playersWhoSavedPenalties,
				count(DISTINCT CASE WHEN md.penaltiesConceded > 0 THEN p.playerName END) as playersWhoConcededPenalties
			RETURN 
				coalesce(playersWhoScored, 0) as playersWhoScored,
				coalesce(playersWhoAssisted, 0) as playersWhoAssisted,
				coalesce(playersWithOwnGoals, 0) as playersWithOwnGoals,
				coalesce(playersWithCleanSheets, 0) as playersWithCleanSheets,
				coalesce(playersWithMoM, 0) as playersWithMoM,
				coalesce(playersWithSaves, 0) as playersWithSaves,
				coalesce(playersWithYellowCards, 0) as playersWithYellowCards,
				coalesce(playersWithRedCards, 0) as playersWithRedCards,
				coalesce(playersWhoScoredPenalties, 0) as playersWhoScoredPenalties,
				coalesce(playersWhoSavedPenalties, 0) as playersWhoSavedPenalties,
				coalesce(playersWhoConcededPenalties, 0) as playersWhoConcededPenalties
		`;

		const result = await neo4jService.runQuery(query, params);
		
		const toNumber = (value: any): number => {
			if (value === null || value === undefined) return 0;
			if (typeof value === "number") return isNaN(value) ? 0 : value;
			if (typeof value === "object" && "toNumber" in value) return value.toNumber();
			if (typeof value === "object" && "low" in value) {
				return (value.low || 0) + (value.high || 0) * 4294967296;
			}
			const num = Number(value);
			return isNaN(num) ? 0 : num;
		};

		if (result.records.length === 0) {
			return NextResponse.json({
				playersWhoScored: 0,
				playersWhoAssisted: 0,
				playersWithOwnGoals: 0,
				playersWithCleanSheets: 0,
				playersWithMoM: 0,
				playersWithSaves: 0,
				playersWithYellowCards: 0,
				playersWithRedCards: 0,
				playersWhoScoredPenalties: 0,
				playersWhoSavedPenalties: 0,
				playersWhoConcededPenalties: 0,
			}, { headers: corsHeaders });
		}

		const record = result.records[0];

		return NextResponse.json({
			playersWhoScored: toNumber(record.get("playersWhoScored")),
			playersWhoAssisted: toNumber(record.get("playersWhoAssisted")),
			playersWithOwnGoals: toNumber(record.get("playersWithOwnGoals")),
			playersWithCleanSheets: toNumber(record.get("playersWithCleanSheets")),
			playersWithMoM: toNumber(record.get("playersWithMoM")),
			playersWithSaves: toNumber(record.get("playersWithSaves")),
			playersWithYellowCards: toNumber(record.get("playersWithYellowCards")),
			playersWithRedCards: toNumber(record.get("playersWithRedCards")),
			playersWhoScoredPenalties: toNumber(record.get("playersWhoScoredPenalties")),
			playersWhoSavedPenalties: toNumber(record.get("playersWhoSavedPenalties")),
			playersWhoConcededPenalties: toNumber(record.get("playersWhoConcededPenalties")),
		}, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching unique player stats:", error);
		return NextResponse.json({ error: "Failed to fetch unique player stats" }, { status: 500, headers: corsHeaders });
	}
}
