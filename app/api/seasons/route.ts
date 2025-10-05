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

		// Fetch all seasons from Fixture data
		const query = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
			WHERE f.season IS NOT NULL AND f.season <> ''
			WITH DISTINCT f.season as seasonName, 
			     min(f.date) as seasonStartDate, 
			     max(f.date) as seasonEndDate
			RETURN seasonName, seasonStartDate, seasonEndDate
			ORDER BY seasonStartDate DESC
		`;
		const params = { graphLabel: neo4jService.getGraphLabel() };

		const result = await neo4jService.runQuery(query, params);

		const seasons = result.records.map((record) => ({
			season: String(record.get("seasonName") || ""),
			startDate: String(record.get("seasonStartDate") || ""),
			endDate: String(record.get("seasonEndDate") || ""),
		}));

		return NextResponse.json({ seasons }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching seasons:", error);
		return NextResponse.json({ error: "Failed to fetch seasons" }, { status: 500, headers: corsHeaders });
	}
}
