import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { Record } from "neo4j-driver";
import { buildFilterConditions } from "../player-data/route";
import { CYPHER_FIXTURE_VEOLINK_COALESCE } from "@/lib/utils/neo4jVeoLink";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

/** Fixtures the player appeared in (MatchDetail) that have a Veo/video URL; respects same filters as player-form. */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { playerName, filters } = body;

		if (!playerName || typeof playerName !== "string" || playerName.trim() === "") {
			return NextResponse.json({ error: "Valid player name is required" }, { status: 400, headers: corsHeaders });
		}

		if (!filters || typeof filters !== "object") {
			return NextResponse.json({ error: "Filters object is required" }, { status: 400, headers: corsHeaders });
		}

		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const params: any = {
			graphLabel,
			playerName: playerName.trim(),
		};

		let query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		`;

		const filterConditions = buildFilterConditions(filters, params);
		const veoPredicate = `(${CYPHER_FIXTURE_VEOLINK_COALESCE}) IS NOT NULL`;
		const allConditions = [...filterConditions, veoPredicate];

		if (allConditions.length > 0) {
			query += ` WHERE ${allConditions.join(" AND ")}`;
		}

		query += `
			WITH DISTINCT f
			RETURN f.id as fixtureId, f.team as team, f.season as season, f.result as result, f.date as date, f.opposition as opposition,
			       f.homeOrAway as homeOrAway, f.dorkiniansGoals as goalsScored,
			       f.conceded as goalsConceded, f.compType as compType, ${CYPHER_FIXTURE_VEOLINK_COALESCE} as veoLink
			ORDER BY f.date DESC
		`;

		const result = await neo4jService.runQuery(query, params);

		const fixtures = result.records.map((record: Record) => {
			const fixtureId = record.get("fixtureId");
			const team = record.get("team");
			const season = record.get("season");
			const resultValue = record.get("result");
			const date = record.get("date");
			const opposition = record.get("opposition");
			const homeOrAway = record.get("homeOrAway");
			const goalsScored = record.get("goalsScored");
			const goalsConceded = record.get("goalsConceded");
			const compType = record.get("compType");
			const veoLink = record.get("veoLink");

			return {
				fixtureId: fixtureId != null ? String(fixtureId) : "",
				team: team != null ? String(team) : "",
				season: season != null ? String(season) : "",
				result: resultValue ? String(resultValue) : "",
				date: date ? String(date) : "",
				opposition: opposition ? String(opposition) : "",
				homeOrAway: homeOrAway ? String(homeOrAway) : "",
				goalsScored: typeof goalsScored === "number" ? goalsScored : Number(goalsScored) || 0,
				goalsConceded: typeof goalsConceded === "number" ? goalsConceded : Number(goalsConceded) || 0,
				compType: compType ? String(compType) : "",
				veoLink: veoLink != null && String(veoLink).trim() !== "" ? String(veoLink) : null,
			};
		});

		return NextResponse.json({ fixtures }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching player recordings:", error);
		return NextResponse.json({ error: "Failed to fetch player recordings" }, { status: 500, headers: corsHeaders });
	}
}
