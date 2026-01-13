import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";

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

		const graphLabel = neo4jService.getGraphLabel();

		// Fetch SiteDetail node
		const siteDetailQuery = `
			MATCH (sd:SiteDetail {graphLabel: $graphLabel})
			RETURN sd
			LIMIT 1
		`;

		const siteDetailResult = await neo4jService.runQuery(siteDetailQuery, { graphLabel });

		if (siteDetailResult.records.length === 0) {
			return NextResponse.json({ error: "SiteDetail node not found" }, { status: 404, headers: corsHeaders });
		}

		const siteDetailNode = siteDetailResult.records[0].get("sd");
		const properties = siteDetailNode.properties;

		// Extract relevant properties
		const siteDetails = {
			lastSeededStats: properties.lastSeededStats || null,
			versionReleaseDetails: properties.versionReleaseDetails || null,
			updatesToCome: properties.updatesToCome || null,
			statLimitations: properties.statLimitations || null,
			pageDetailsLastRefreshed: properties.pageDetailsLastRefreshed || null,
			versionNumber: properties.versionNumber || null,
			currentSeason: properties.currentSeason || null,
		};

		return NextResponse.json(siteDetails, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching site details:", error);
		return NextResponse.json({ error: "Failed to fetch site details" }, { status: 500, headers: corsHeaders });
	}
}

