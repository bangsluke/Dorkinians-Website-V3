import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { MatchDetail } from "@/types";

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
		const season = searchParams.get("season");
		const week = searchParams.get("week");
		const playerName = searchParams.get("playerName");

		if (!season || !week || !playerName) {
			return NextResponse.json(
				{ error: "Season, week, and playerName parameters are required" },
				{ status: 400, headers: corsHeaders },
			);
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const weekNumber = parseInt(week, 10);

		// Fetch all MatchDetail nodes for the player in that week
		// Using TOTW_HAS_DETAILS relationship which connects WeeklyTOTW to MatchDetail
		// Also fetch related Fixture for match summary
		const query = `
			MATCH (wt:WeeklyTOTW {graphLabel: $graphLabel, season: $season, week: $weekNumber})-[:TOTW_HAS_DETAILS]-(md:MatchDetail {graphLabel: $graphLabel, playerName: $playerName})
			OPTIONAL MATCH (f:Fixture {graphLabel: $graphLabel})-[r:HAS_MATCH_DETAILS]->(md)
			RETURN md, f.fullResult as matchSummary, f.opposition as opposition
			ORDER BY md.date ASC
		`;

		const result = await neo4jService.runQuery(query, { graphLabel, season, weekNumber, playerName });

		const matchDetails = result.records.map((record) => {
			const mdNode = record.get("md");
			const properties = mdNode.properties;
			const matchSummary = record.get("matchSummary");
			const opposition = record.get("opposition");

			return {
				team: String(properties.team || ""),
				playerName: String(properties.playerName || ""),
				date: String(properties.date || ""),
				min: Number(properties.min || properties.minutes || 0),
				class: String(properties.class || ""),
				mom: Boolean(properties.mom || false),
				goals: Number(properties.goals || 0),
				assists: Number(properties.assists || 0),
				yellowCards: Number(properties.yellowCards || 0),
				redCards: Number(properties.redCards || 0),
				saves: Number(properties.saves || 0),
				ownGoals: Number(properties.ownGoals || 0),
				conceded: Number(properties.conceded || 0),
				cleanSheets: Number(properties.cleanSheets || 0),
				penaltiesScored: Number(properties.penaltiesScored || 0),
				penaltiesMissed: Number(properties.penaltiesMissed || 0),
				penaltiesConceded: Number(properties.penaltiesConceded || 0),
				penaltiesSaved: Number(properties.penaltiesSaved || 0),
				matchSummary: matchSummary ? String(matchSummary) : null,
				opposition: opposition ? String(opposition) : null,
			};
		});

		return NextResponse.json({ matchDetails }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching player details:", error);
		return NextResponse.json({ error: "Failed to fetch player details" }, { status: 500, headers: corsHeaders });
	}
}

