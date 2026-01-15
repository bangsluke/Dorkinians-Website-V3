import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { Record } from "neo4j-driver";

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

		if (!season) {
			return NextResponse.json(
				{ error: "Season parameter is required" },
				{ status: 400, headers: corsHeaders },
			);
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Query all players' fantasy scores for the season
		const query = `
			MATCH (md:MatchDetail {graphLabel: $graphLabel, season: $season})
			WITH md.playerName as playerName, sum(COALESCE(md.fantasyPoints, 0)) as totalScore
			WHERE totalScore > 0
			RETURN playerName, totalScore
			ORDER BY totalScore DESC
		`;

		const result = await neo4jService.runQuery(query, {
			graphLabel,
			season,
		});

		// Map results to array with ranks
		const rankings = result.records.map((record: Record, index: number) => {
			const playerName = record.get("playerName");
			const totalScore = record.get("totalScore");
			
			return {
				rank: index + 1,
				playerName: String(playerName),
				score: totalScore !== null && totalScore !== undefined
					? (typeof totalScore.toNumber === 'function' ? totalScore.toNumber() : Number(totalScore))
					: 0,
			};
		});

		return NextResponse.json({ rankings }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching season rankings:", error);
		return NextResponse.json({ error: "Failed to fetch season rankings" }, { status: 500, headers: corsHeaders });
	}
}
