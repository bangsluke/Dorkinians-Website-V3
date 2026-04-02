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

/** Fixtures for the team + filters that have at least one Veo/video URL (full library, no row limit). */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { teamName, filters } = body;

		if (!teamName || typeof teamName !== "string" || teamName.trim() === "") {
			return NextResponse.json({ error: "Valid team name is required" }, { status: 400, headers: corsHeaders });
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
		};

		const hasTeamFilter = filters?.teams && Array.isArray(filters.teams) && filters.teams.length > 0;

		let query = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
		`;

		const filterConditions = buildFilterConditions(filters, params);
		const fixtureConditions = filterConditions.filter((cond) => !cond.includes("md.class"));

		if (teamName && teamName !== "Whole Club" && !hasTeamFilter) {
			params.teamName = teamName;
			query += ` WHERE f.team = $teamName`;
		}

		const conditions =
			hasTeamFilter || teamName === "Whole Club" || !teamName
				? fixtureConditions
				: fixtureConditions.filter((cond) => !cond.includes("f.team IN $teams"));

		const veoPredicate = `(${CYPHER_FIXTURE_VEOLINK_COALESCE}) IS NOT NULL`;
		const conditionsWithVeo = [...conditions, veoPredicate];

		if (conditionsWithVeo.length > 0) {
			const hasWhereClause = query.includes("WHERE");
			query += hasWhereClause ? ` AND ${conditionsWithVeo.join(" AND ")}` : ` WHERE ${conditionsWithVeo.join(" AND ")}`;
		}

		query += `
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
		console.error("Error fetching team recordings:", error);
		return NextResponse.json({ error: "Failed to fetch team recordings" }, { status: 500, headers: corsHeaders });
	}
}
