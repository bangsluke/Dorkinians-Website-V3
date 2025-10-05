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
		const search = searchParams.get("search");

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		// Fetch competitions with optional search
		let query = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
			WHERE f.competition IS NOT NULL AND f.competition <> ''
			WITH DISTINCT f.competition as competitionName, f.compType as compType
		`;
		
		const params: any = { graphLabel: neo4jService.getGraphLabel() };
		
		if (search && search.trim()) {
			query += ` AND f.competition CONTAINS $search`;
			params.search = search.trim();
		}
		
		query += `
			RETURN competitionName, compType
			ORDER BY competitionName
		`;

		const result = await neo4jService.runQuery(query, params);

		const competitions = result.records.map((record) => ({
			name: String(record.get("competitionName") || ""),
			type: String(record.get("compType") || ""),
		}));

		return NextResponse.json({ competitions }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching competitions:", error);
		return NextResponse.json({ error: "Failed to fetch competitions" }, { status: 500, headers: corsHeaders });
	}
}
