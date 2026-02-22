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

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const playerName = searchParams.get("playerName");
		const season = searchParams.get("season");

		if (!playerName || typeof playerName !== "string" || playerName.trim() === "") {
			return NextResponse.json({ error: "Valid player name is required" }, { status: 400, headers: corsHeaders });
		}
		if (!season || typeof season !== "string" || season.trim() === "") {
			return NextResponse.json({ error: "Season is required" }, { status: 400, headers: corsHeaders });
		}

		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const seasonNorm = season.trim().replace("-", "/");
		const seasonHyphen = season.trim().replace("/", "-");

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE f.season = $seasonNorm OR f.season = $seasonHyphen
			WITH DISTINCT f
			ORDER BY f.date ASC
			RETURN f.id AS fixtureId, f.date AS date, f.opposition AS opposition,
			       f.homeOrAway AS homeOrAway, f.result AS result,
			       f.dorkiniansGoals AS dorkiniansGoals, f.conceded AS conceded,
			       f.compType AS compType, f.competition AS competition,
			       f.homeScore AS homeScore, f.awayScore AS awayScore
		`;

		const result = await neo4jService.runQuery(query, {
			graphLabel,
			playerName: playerName.trim(),
			seasonNorm,
			seasonHyphen,
		});

		const games = result.records.map((r) => {
			const dateVal = r.get("date");
			return {
				fixtureId: r.get("fixtureId") != null ? String(r.get("fixtureId")) : "",
				date: dateVal != null ? (typeof dateVal === "string" ? dateVal : String(dateVal)) : "",
				opposition: r.get("opposition") != null ? String(r.get("opposition")) : "",
				homeOrAway: r.get("homeOrAway") != null ? String(r.get("homeOrAway")) : "",
				result: r.get("result") != null ? String(r.get("result")) : "",
				dorkiniansGoals: toNum(r.get("dorkiniansGoals")),
				conceded: toNum(r.get("conceded")),
				compType: r.get("compType") != null ? String(r.get("compType")) : "",
				competition: r.get("competition") != null ? String(r.get("competition")) : "",
				homeScore: toNum(r.get("homeScore")),
				awayScore: toNum(r.get("awayScore")),
			};
		});

		return NextResponse.json({ games }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching player season games:", error);
		return NextResponse.json({ error: "Failed to fetch season games" }, { status: 500, headers: corsHeaders });
	}
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
