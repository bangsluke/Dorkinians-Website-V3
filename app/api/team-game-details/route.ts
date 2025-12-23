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

		if (!teamName || typeof teamName !== "string" || teamName.trim() === "") {
			return NextResponse.json({ error: "Valid team name is required" }, { status: 400, headers: corsHeaders });
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

		// Build base query
		let query = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
		`;

		// Filter by team if not "Whole Club"
		if (teamName !== "Whole Club") {
			params.teamName = teamName;
			query += ` WHERE f.team = $teamName`;
		}

		// Build filter conditions
		const allConditions = buildFilterConditions(filters || null, params);
		// Filter out position conditions (they reference md.class which doesn't exist in this query)
		const conditions = allConditions.filter(cond => !cond.includes("md.class"));
		// Remove position params if they were added
		if (params.positions) {
			delete params.positions;
		}
		if (conditions.length > 0) {
			const hasWhereClause = query.includes("WHERE");
			query += hasWhereClause ? ` AND ${conditions.join(" AND ")}` : ` WHERE ${conditions.join(" AND ")}`;
		}

		query += `
			WITH 
				count(DISTINCT CASE WHEN f.compType = 'League' THEN f.id END) as leagueGames,
				count(DISTINCT CASE WHEN f.compType = 'Cup' THEN f.id END) as cupGames,
				count(DISTINCT CASE WHEN f.compType = 'Friendly' THEN f.id END) as friendlyGames,
				count(DISTINCT CASE WHEN f.compType = 'League' AND f.result = "W" THEN f.id END) as leagueWins,
				count(DISTINCT CASE WHEN f.compType = 'Cup' AND f.result = "W" THEN f.id END) as cupWins,
				count(DISTINCT CASE WHEN f.compType = 'Friendly' AND f.result = "W" THEN f.id END) as friendlyWins,
				count(DISTINCT CASE WHEN f.homeOrAway = 'Home' THEN f.id END) as homeGames,
				count(DISTINCT CASE WHEN f.homeOrAway = 'Home' AND f.result = "W" THEN f.id END) as homeWins,
				count(DISTINCT CASE WHEN f.homeOrAway = 'Away' THEN f.id END) as awayGames,
				count(DISTINCT CASE WHEN f.homeOrAway = 'Away' AND f.result = "W" THEN f.id END) as awayWins,
				count(DISTINCT f.opposition) as uniqueOpponents,
				count(DISTINCT f.competition) as uniqueCompetitions
			RETURN 
				leagueGames,
				cupGames,
				friendlyGames,
				leagueWins,
				cupWins,
				friendlyWins,
				homeGames,
				homeWins,
				awayGames,
				awayWins,
				uniqueOpponents,
				uniqueCompetitions
		`;

		const result = await neo4jService.runQuery(query, params);
		
		if (result.records.length === 0) {
			return NextResponse.json({
				leagueGames: 0,
				cupGames: 0,
				friendlyGames: 0,
				leagueWins: 0,
				cupWins: 0,
				friendlyWins: 0,
				homeGames: 0,
				homeWins: 0,
				awayGames: 0,
				awayWins: 0,
				uniqueOpponents: 0,
				uniqueCompetitions: 0,
			}, { headers: corsHeaders });
		}

		const record = result.records[0];
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

		const leagueGames = toNumber(record.get("leagueGames"));
		const cupGames = toNumber(record.get("cupGames"));
		const friendlyGames = toNumber(record.get("friendlyGames"));
		const leagueWins = toNumber(record.get("leagueWins"));
		const cupWins = toNumber(record.get("cupWins"));
		const friendlyWins = toNumber(record.get("friendlyWins"));
		const homeGames = toNumber(record.get("homeGames"));
		const homeWins = toNumber(record.get("homeWins"));
		const awayGames = toNumber(record.get("awayGames"));
		const awayWins = toNumber(record.get("awayWins"));
		const uniqueOpponents = toNumber(record.get("uniqueOpponents"));
		const uniqueCompetitions = toNumber(record.get("uniqueCompetitions"));

		return NextResponse.json({
			leagueGames,
			cupGames,
			friendlyGames,
			leagueWins,
			cupWins,
			friendlyWins,
			homeGames,
			homeWins,
			awayGames,
			awayWins,
			uniqueOpponents,
			uniqueCompetitions,
		}, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching team game details:", error);
		return NextResponse.json({ error: "Failed to fetch team game details" }, { status: 500, headers: corsHeaders });
	}
}
