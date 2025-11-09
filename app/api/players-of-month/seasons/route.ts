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
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Fetch unique seasons from PlayersOfTheMonth nodes
		const seasonsQuery = `
			MATCH (pm:PlayersOfTheMonth {graphLabel: $graphLabel})
			WHERE pm.season IS NOT NULL AND pm.season <> ''
			RETURN DISTINCT pm.season as season
			ORDER BY pm.season DESC
		`;

		const seasonsResult = await neo4jService.runQuery(seasonsQuery, { graphLabel });

		const seasons = seasonsResult.records.map((record) => String(record.get("season") || ""));

		return NextResponse.json({ seasons }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching seasons:", error);
		return NextResponse.json({ error: "Failed to fetch seasons" }, { status: 500, headers: corsHeaders });
	}
}

