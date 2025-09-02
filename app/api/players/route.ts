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
		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json(
				{ error: "Database connection failed" },
				{ status: 500, headers: corsHeaders }
			);
		}

				// Fetch all players that are allowed on site
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			RETURN p.playerName as playerName, p.mostPlayedForTeam as mostPlayedForTeam
			ORDER BY p.playerName
		`;
		const params = { graphLabel: neo4jService.getGraphLabel() };

		const result = await neo4jService.runQuery(query, params);
		
		const players = result.records
			.map((record) => ({
				playerName: String(record.get("playerName") || ""),
				mostPlayedForTeam: String(record.get("mostPlayedForTeam") || ""),
			}))
			.filter(player => player.playerName && player.playerName.trim() !== "");

		return NextResponse.json({ players }, { headers: corsHeaders });
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to fetch players" },
			{ status: 500, headers: corsHeaders }
		);
	}
}
