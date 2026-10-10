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

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const search = searchParams.get("search");
		const cacheKey = apiCache.generateKey("/api/opposition", { search: search?.trim() || "" });
		const cached = await apiCache.getAsync<{ opposition: { name: string }[] }>(cacheKey);
		if (cached) {
			return NextResponse.json(cached, { headers: withPublicCache(corsHeaders) });
		}

		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: withNoStore(corsHeaders) });
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

		const payload = { opposition };
		await apiCache.setAsync(cacheKey, payload, getCacheTTL("/api/opposition"));
		return NextResponse.json(payload, { headers: withPublicCache(corsHeaders) });
	} catch (error) {
		logError("Error fetching opposition", error);
		return NextResponse.json({ error: "Failed to fetch opposition" }, { status: 500, headers: withNoStore(corsHeaders) });
	}
}
