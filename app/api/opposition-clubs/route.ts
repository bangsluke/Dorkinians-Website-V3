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
		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		// Fetch distinct shortTeamName values from OppositionDetails
		const graphLabel = neo4jService.getGraphLabel();
		const query = `
			MATCH (od:OppositionDetails {graphLabel: $graphLabel})
			WHERE od.shortTeamName IS NOT NULL AND od.shortTeamName <> ''
			WITH DISTINCT od.shortTeamName as shortTeamName
			RETURN shortTeamName
			ORDER BY shortTeamName
		`;

		const params: any = { graphLabel };

		const result = await neo4jService.runQuery(query, params);

		const oppositionClubs = result.records.map((record: Record) => ({
			shortTeamName: String(record.get("shortTeamName") || ""),
		}));

		return NextResponse.json({ oppositionClubs }, { headers: corsHeaders });
	} catch (error) {
		logError("Error fetching opposition clubs", error);
		return NextResponse.json({ error: "Failed to fetch opposition clubs" }, { status: 500, headers: corsHeaders });
	}
}
