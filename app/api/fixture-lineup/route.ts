import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders });
}

function toNum(value: unknown): number {
	if (value === null || value === undefined) return 0;
	if (typeof value === "number") return isNaN(value) ? 0 : value;
	if (typeof value === "object" && value !== null && "toNumber" in value) {
		return (value as { toNumber: () => number }).toNumber();
	}
	if (typeof value === "object" && value !== null && "low" in value) {
		const v = value as { low?: number; high?: number };
		return (v.low || 0) + (v.high || 0) * 4294967296;
	}
	const n = Number(value);
	return isNaN(n) ? 0 : n;
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const fixtureId = searchParams.get("fixtureId");

		if (!fixtureId || typeof fixtureId !== "string" || fixtureId.trim() === "") {
			return NextResponse.json({ error: "fixtureId is required" }, { status: 400, headers: corsHeaders });
		}

		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const query = `
			MATCH (f:Fixture {graphLabel: $graphLabel, id: $fixtureId})-[:HAS_MATCH_DETAILS]->(md:MatchDetail {graphLabel: $graphLabel})
			RETURN md.playerName AS playerName, md.class AS position, md.minutes AS minutes,
			       md.goals AS goals, md.assists AS assists, md.mom AS mom,
			       md.yellowCards AS yellowCards, md.redCards AS redCards,
			       md.saves AS saves, md.cleanSheets AS cleanSheets, md.conceded AS conceded,
			       md.ownGoals AS ownGoals,
			       md.penaltiesScored AS penaltiesScored, md.penaltiesMissed AS penaltiesMissed,
			       md.penaltiesConceded AS penaltiesConceded, md.penaltiesSaved AS penaltiesSaved
			ORDER BY md.playerName ASC
		`;

		const result = await neo4jService.runQuery(query, {
			graphLabel,
			fixtureId: fixtureId.trim(),
		});

		const lineup = result.records.map((r) => ({
			playerName: r.get("playerName") != null ? String(r.get("playerName")) : "",
			position: r.get("position") != null ? String(r.get("position")) : "",
			minutes: toNum(r.get("minutes")),
			goals: toNum(r.get("goals")),
			assists: toNum(r.get("assists")),
			mom: toNum(r.get("mom")),
			yellowCards: toNum(r.get("yellowCards")),
			redCards: toNum(r.get("redCards")),
			saves: toNum(r.get("saves")),
			cleanSheets: toNum(r.get("cleanSheets")),
			conceded: toNum(r.get("conceded")),
			ownGoals: toNum(r.get("ownGoals")),
			penaltiesScored: toNum(r.get("penaltiesScored")),
			penaltiesMissed: toNum(r.get("penaltiesMissed")),
			penaltiesConceded: toNum(r.get("penaltiesConceded")),
			penaltiesSaved: toNum(r.get("penaltiesSaved")),
		}));

		return NextResponse.json({ lineup }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching fixture lineup:", error);
		return NextResponse.json({ error: "Failed to fetch fixture lineup" }, { status: 500, headers: corsHeaders });
	}
}
