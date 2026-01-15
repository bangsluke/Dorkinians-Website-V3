import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { logError } from "@/lib/utils/logger";
import type { Record } from "neo4j-driver";

const corsHeaders = getCorsHeadersWithSecurity();

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
		const params: any = { graphLabel: neo4jService.getGraphLabel() };
		
		let query = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
			WHERE f.opposition IS NOT NULL AND f.opposition <> ''
		`;

		if (search && search.trim()) {
			query += ` AND toLower(f.opposition) CONTAINS toLower($search)`;
			params.search = search.trim();
		}

		query += `
			WITH DISTINCT f.opposition as oppositionName
			RETURN oppositionName
			ORDER BY oppositionName
		`;

		const result = await neo4jService.runQuery(query, params);

		const opposition = result.records.map((record: Record) => ({
			name: String(record.get("oppositionName") || ""),
		}));

		return NextResponse.json({ opposition }, { headers: corsHeaders });
	} catch (error) {
		logError("Error fetching opposition", error);
		return NextResponse.json({ error: "Failed to fetch opposition" }, { status: 500, headers: corsHeaders });
	}
}
