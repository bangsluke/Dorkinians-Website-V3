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
		const month = searchParams.get("month");
		const playerName = searchParams.get("playerName");

		if (!season || !month || !playerName) {
			return NextResponse.json(
				{ error: "Season, month, and playerName parameters are required" },
				{ status: 400, headers: corsHeaders },
			);
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Combine season and month into format "season-month" (e.g., "2025/26-October")
		const seasonMonth = `${season}-${month}`;

		// Fetch all MatchDetail nodes for the player matching the seasonMonth value
		const query = `
			MATCH (md:MatchDetail {graphLabel: $graphLabel, playerName: $playerName, seasonMonth: $seasonMonth})
			OPTIONAL MATCH (f:Fixture {graphLabel: $graphLabel})-[r:HAS_MATCH_DETAILS]->(md)
			RETURN md, f.fullResult as matchSummary, f.opposition as opposition, f.result as result
			ORDER BY md.date ASC
		`;

		const queryResult = await neo4jService.runQuery(query, {
			graphLabel,
			playerName,
			seasonMonth,
		});

		const matchDetails = queryResult.records.map((record) => {
			const mdNode = record.get("md");
			const properties = mdNode.properties;
			const matchSummary = record.get("matchSummary");
			const opposition = record.get("opposition");
			const result = record.get("result");

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
				result: result ? String(result) : null,
			};
		});

		// Calculate aggregated stats
		const appearances = matchDetails.length;
		const goals = matchDetails.reduce((sum, md) => sum + md.goals, 0);
		const assists = matchDetails.reduce((sum, md) => sum + md.assists, 0);
		const cleanSheets = matchDetails.reduce((sum, md) => sum + md.cleanSheets, 0);
		const mom = matchDetails.reduce((sum, md) => sum + (md.mom ? 1 : 0), 0);
		const yellowCards = matchDetails.reduce((sum, md) => sum + md.yellowCards, 0);
		const redCards = matchDetails.reduce((sum, md) => sum + md.redCards, 0);
		const saves = matchDetails.reduce((sum, md) => sum + md.saves, 0);
		const ownGoals = matchDetails.reduce((sum, md) => sum + md.ownGoals, 0);
		const conceded = matchDetails.reduce((sum, md) => sum + md.conceded, 0);
		const penaltiesScored = matchDetails.reduce((sum, md) => sum + md.penaltiesScored, 0);
		const penaltiesMissed = matchDetails.reduce((sum, md) => sum + md.penaltiesMissed, 0);
		const penaltiesSaved = matchDetails.reduce((sum, md) => sum + md.penaltiesSaved, 0);

		return NextResponse.json(
			{
				matchDetails,
				appearances,
				goals,
				assists,
				cleanSheets,
				mom,
				yellowCards,
				redCards,
				saves,
				ownGoals,
				conceded,
				penaltiesScored,
				penaltiesMissed,
				penaltiesSaved,
			},
			{ headers: corsHeaders },
		);
	} catch (error) {
		console.error("Error fetching player stats:", error);
		return NextResponse.json({ error: "Failed to fetch player stats" }, { status: 500, headers: corsHeaders });
	}
}

