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

		// Fetch opposition teams with optional search
		let query = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
			WHERE f.opposition IS NOT NULL AND f.opposition <> ''
			WITH DISTINCT f.opposition as oppositionName
		`;

		const params: any = { graphLabel: neo4jService.getGraphLabel() };

		if (search && search.trim()) {
			query += ` AND f.opposition CONTAINS $search`;
			params.search = search.trim();
		}

		query += `
			RETURN oppositionName
			ORDER BY oppositionName
		`;

		const result = await neo4jService.runQuery(query, params);

		const opposition = result.records.map((record) => ({
			name: String(record.get("oppositionName") || ""),
		}));

		return NextResponse.json({ opposition }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching opposition:", error);
		return NextResponse.json({ error: "Failed to fetch opposition" }, { status: 500, headers: corsHeaders });
	}
}
