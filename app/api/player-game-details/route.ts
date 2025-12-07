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
		const { playerName, filters } = body;

		if (!playerName || typeof playerName !== "string" || playerName.trim() === "") {
			return NextResponse.json({ error: "Valid player name is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const params: any = {
			graphLabel,
			playerName,
		};

		// Build base query
		let query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		`;

		// Build filter conditions
		const conditions = buildFilterConditions(filters || null, params);
		if (conditions.length > 0) {
			query += ` WHERE ${conditions.join(" AND ")}`;
		}

		query += `
			WITH 
				count(DISTINCT CASE WHEN f.compType = 'League' THEN f.id END) as leagueGames,
				count(DISTINCT CASE WHEN f.compType = 'Cup' THEN f.id END) as cupGames,
				count(DISTINCT CASE WHEN f.compType = 'Friendly' THEN f.id END) as friendlyGames,
				count(DISTINCT f.opposition) as uniqueOpponents,
				count(DISTINCT f.competition) as uniqueCompetitions
			RETURN 
				leagueGames,
				cupGames,
				friendlyGames,
				uniqueOpponents,
				uniqueCompetitions
		`;

		const result = await neo4jService.runQuery(query, params);
		
		if (result.records.length === 0) {
			return NextResponse.json({
				leagueGames: 0,
				cupGames: 0,
				friendlyGames: 0,
				uniqueOpponents: 0,
				uniqueCompetitions: 0,
				uniqueTeammates: 0,
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
		const uniqueOpponents = toNumber(record.get("uniqueOpponents"));
		const uniqueCompetitions = toNumber(record.get("uniqueCompetitions"));

		// Get unique teammates - query separately
		const teammateQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		`;

		const teammateConditions = buildFilterConditions(filters || null, params);
		let finalTeammateQuery = teammateQuery;
		if (teammateConditions.length > 0) {
			finalTeammateQuery += ` WHERE ${teammateConditions.join(" AND ")}`;
		}

		finalTeammateQuery += `
			MATCH (f)-[:HAS_MATCH_DETAILS]->(md2:MatchDetail {graphLabel: $graphLabel})
			MATCH (md2)<-[:PLAYED_IN]-(p2:Player {graphLabel: $graphLabel})
			WHERE p2.playerName <> $playerName
			RETURN count(DISTINCT p2.playerName) as uniqueTeammates
		`;

		let uniqueTeammates = 0;
		try {
			const teammateResult = await neo4jService.runQuery(finalTeammateQuery, params);
			if (teammateResult.records.length > 0) {
				uniqueTeammates = toNumber(teammateResult.records[0].get("uniqueTeammates"));
			}
		} catch (teammateError) {
			console.error("Error fetching teammates:", teammateError);
		}

		return NextResponse.json({
			leagueGames,
			cupGames,
			friendlyGames,
			uniqueOpponents,
			uniqueCompetitions,
			uniqueTeammates,
		}, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching player game details:", error);
		return NextResponse.json({ error: "Failed to fetch player game details" }, { status: 500, headers: corsHeaders });
	}
}
