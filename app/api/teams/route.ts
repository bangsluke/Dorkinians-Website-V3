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
		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		// Fetch all teams from Fixture data
		const query = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
			WHERE f.team IS NOT NULL AND f.team <> ''
			WITH DISTINCT f.team as teamName
			RETURN teamName
			ORDER BY teamName
		`;
		const params = { graphLabel: neo4jService.getGraphLabel() };

		const result = await neo4jService.runQuery(query, params);

		const teams = result.records.map((record: Record) => ({
			name: String(record.get("teamName") || ""),
		}));

		return NextResponse.json({ teams }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching teams:", error);
		return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500, headers: corsHeaders });
	}
}
