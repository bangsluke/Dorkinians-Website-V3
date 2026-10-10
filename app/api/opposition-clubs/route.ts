import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { logError } from "@/lib/utils/logger";
import type { Record } from "neo4j-driver";
import { apiCache, getCacheTTL } from "@/lib/utils/apiCache";
import { withNoStore, withPublicCache } from "@/lib/utils/publicCacheHeaders";

const corsHeaders = getCorsHeadersWithSecurity();

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(_request: NextRequest) {
	try {
		const cacheKey = apiCache.generateKey("/api/opposition-clubs");
		const cached = apiCache.get<{ oppositionClubs: { shortTeamName: string }[] }>(cacheKey);
		if (cached) {
			return NextResponse.json(cached, { headers: withPublicCache(corsHeaders) });
		}

		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: withNoStore(corsHeaders) });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const query = `
			MATCH (od:OppositionDetails {graphLabel: $graphLabel})
			WHERE od.shortTeamName IS NOT NULL AND od.shortTeamName <> ''
			WITH DISTINCT od.shortTeamName as shortTeamName
			RETURN shortTeamName
			ORDER BY shortTeamName
		`;

		const params = { graphLabel };

		const result = await neo4jService.runQuery(query, params);

		const oppositionClubs = result.records.map((record: Record) => ({
			shortTeamName: String(record.get("shortTeamName") || ""),
		}));

		const payload = { oppositionClubs };
		apiCache.set(cacheKey, payload, getCacheTTL("/api/opposition-clubs"));
		return NextResponse.json(payload, { headers: withPublicCache(corsHeaders) });
	} catch (error) {
		logError("Error fetching opposition clubs", error);
		return NextResponse.json({ error: "Failed to fetch opposition clubs" }, { status: 500, headers: withNoStore(corsHeaders) });
	}
}
