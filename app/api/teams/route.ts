import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { Record } from "neo4j-driver";
import { apiCache, getCacheTTL } from "@/lib/utils/apiCache";
import { withNoStore, withPublicCache } from "@/lib/utils/publicCacheHeaders";

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
		const cacheKey = apiCache.generateKey("/api/teams");
		const cached = await apiCache.getAsync<{ teams: { name: string }[] }>(cacheKey);
		if (cached) {
			return NextResponse.json(cached, { headers: withPublicCache(corsHeaders) });
		}

		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: withNoStore(corsHeaders) });
		}

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

		const payload = { teams };
		await apiCache.setAsync(cacheKey, payload, getCacheTTL("/api/teams"));
		return NextResponse.json(payload, { headers: withPublicCache(corsHeaders) });
	} catch (error) {
		console.error("Error fetching teams:", error);
		return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500, headers: withNoStore(corsHeaders) });
	}
}
