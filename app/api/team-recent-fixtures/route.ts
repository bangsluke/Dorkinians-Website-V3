import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { Record } from "neo4j-driver";
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
		const { teamName, filters } = body;

		if (!teamName || typeof teamName !== "string" || teamName.trim() === "") {
			return NextResponse.json({ error: "Valid team name is required" }, { status: 400, headers: corsHeaders });
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

		// Check if team filter is provided via filters.teams
		const hasTeamFilter = filters?.teams && Array.isArray(filters.teams) && filters.teams.length > 0;

		// Base query - match fixtures
		let query = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
		`;

		// Build filter conditions
		const filterConditions = buildFilterConditions(filters, params);
		
		// Filter out position conditions (md.class) since this query doesn't match MatchDetail nodes
		const fixtureConditions = filterConditions.filter((cond) => !cond.includes("md.class"));

		// If teamName is provided and not "Whole Club", use it
		if (teamName && teamName !== "Whole Club" && !hasTeamFilter) {
			params.teamName = teamName;
			query += ` WHERE f.team = $teamName`;
		}

		// Keep team filter from filterConditions if present (filters.teams)
		const conditions = hasTeamFilter || teamName === "Whole Club" || !teamName
			? fixtureConditions
			: fixtureConditions.filter((cond) => !cond.includes("f.team IN $teams"));

		if (conditions.length > 0) {
			const hasWhereClause = query.includes("WHERE");
			query += hasWhereClause ? ` AND ${conditions.join(" AND ")}` : ` WHERE ${conditions.join(" AND ")}`;
		}

		// Order by date DESC and limit to 10
		query += `
			RETURN f.result as result, f.date as date, f.opposition as opposition, 
			       f.homeOrAway as homeOrAway, f.dorkiniansGoals as goalsScored, 
			       f.conceded as goalsConceded, f.compType as compType
			ORDER BY f.date DESC
			LIMIT 10
		`;

		const result = await neo4jService.runQuery(query, params);

		// Extract results with full fixture details
		const fixtures = result.records.map((record: Record) => {
			const resultValue = record.get("result");
			const date = record.get("date");
			const opposition = record.get("opposition");
			const homeOrAway = record.get("homeOrAway");
			const goalsScored = record.get("goalsScored");
			const goalsConceded = record.get("goalsConceded");
			const compType = record.get("compType");

			return {
				result: resultValue ? String(resultValue) : "",
				date: date ? String(date) : "",
				opposition: opposition ? String(opposition) : "",
				homeOrAway: homeOrAway ? String(homeOrAway) : "",
				goalsScored: typeof goalsScored === "number" ? goalsScored : Number(goalsScored) || 0,
				goalsConceded: typeof goalsConceded === "number" ? goalsConceded : Number(goalsConceded) || 0,
				compType: compType ? String(compType) : "",
			};
		});

		return NextResponse.json({ fixtures }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching recent fixtures:", error);
		return NextResponse.json({ error: "Failed to fetch recent fixtures" }, { status: 500, headers: corsHeaders });
	}
}
