import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";

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
		const playerName = searchParams.get("playerName");

		if (!playerName) {
			return NextResponse.json({ error: "Player name is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		// Fetch complete player data from TBL_Players
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.playerName = $playerName
			RETURN p
		`;
		const params = {
			graphLabel: neo4jService.getGraphLabel(),
			playerName: playerName,
		};

		const result = await neo4jService.runQuery(query, params);

		if (result.records.length === 0) {
			return NextResponse.json({ error: "Player not found" }, { status: 404, headers: corsHeaders });
		}

		// Extract all player properties
		const playerNode = result.records[0].get("p");
		const playerData = {
			id: playerNode.properties.id,
			playerName: playerNode.properties.playerName,
			allowOnSite: playerNode.properties.allowOnSite,
			appearances: playerNode.properties.appearances,
			minutes: playerNode.properties.minutes,
			mom: playerNode.properties.mom,
			goals: playerNode.properties.goals,
			assists: playerNode.properties.assists,
			yellowCards: playerNode.properties.yellowCards,
			redCards: playerNode.properties.redCards,
			saves: playerNode.properties.saves,
			ownGoals: playerNode.properties.ownGoals,
			conceded: playerNode.properties.conceded,
			cleanSheets: playerNode.properties.cleanSheets,
			penaltiesScored: playerNode.properties.penaltiesScored,
			penaltiesMissed: playerNode.properties.penaltiesMissed,
			penaltiesConceded: playerNode.properties.penaltiesConceded,
			penaltiesSaved: playerNode.properties.penaltiesSaved,
			fantasyPoints: playerNode.properties.fantasyPoints,
			allGoalsScored: playerNode.properties.allGoalsScored,
			goalsPerApp: playerNode.properties.goalsPerApp,
			concededPerApp: playerNode.properties.concededPerApp,
			minutesPerGoal: playerNode.properties.minutesPerGoal,
			minutesPerCleanSheet: playerNode.properties.minutesPerCleanSheet,
			fantasyPointsPerApp: playerNode.properties.fantasyPointsPerApp,
			distance: playerNode.properties.distance,
			homeGames: playerNode.properties.homeGames,
			homeWins: playerNode.properties.homeWins,
			homeGamesPercentWon: playerNode.properties.homeGamesPercentWon,
			awayGames: playerNode.properties.awayGames,
			awayWins: playerNode.properties.awayWins,
			awayGamesPercentWon: playerNode.properties.awayGamesPercentWon,
			gamesPercentWon: playerNode.properties.gamesPercentWon,
			apps1s: playerNode.properties.apps1s,
			apps2s: playerNode.properties.apps2s,
			apps3s: playerNode.properties.apps3s,
			apps4s: playerNode.properties.apps4s,
			apps5s: playerNode.properties.apps5s,
			apps6s: playerNode.properties.apps6s,
			apps7s: playerNode.properties.apps7s,
			apps8s: playerNode.properties.apps8s,
			mostPlayedForTeam: playerNode.properties.mostPlayedForTeam,
			numberTeamsPlayedFor: playerNode.properties.numberTeamsPlayedFor,
			goals1s: playerNode.properties.goals1s,
			goals2s: playerNode.properties.goals2s,
			goals3s: playerNode.properties.goals3s,
			goals4s: playerNode.properties.goals4s,
			goals5s: playerNode.properties.goals5s,
			goals6s: playerNode.properties.goals6s,
			goals7s: playerNode.properties.goals7s,
			goals8s: playerNode.properties.goals8s,
			mostScoredForTeam: playerNode.properties.mostScoredForTeam,
			numberSeasonsPlayedFor: playerNode.properties.numberSeasonsPlayedFor,
			graphLabel: playerNode.properties.graphLabel,
		};

		return NextResponse.json({ playerData }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching player data:", error);
		return NextResponse.json({ error: "Failed to fetch player data" }, { status: 500, headers: corsHeaders });
	}
}
