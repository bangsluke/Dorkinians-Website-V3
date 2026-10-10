import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { Record } from "neo4j-driver";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { apiCache, getCacheTTL } from "@/lib/utils/apiCache";
import { withNoStore, withPublicCache } from "@/lib/utils/publicCacheHeaders";

const corsHeaders = getCorsHeadersWithSecurity();

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(_request: NextRequest) {
	try {
		const cacheKey = apiCache.generateKey("/api/players");
		const cached = apiCache.get<{ players: { playerName: string; mostPlayedForTeam: string }[] }>(cacheKey);
		if (cached) {
			return NextResponse.json(cached, { headers: withPublicCache(corsHeaders) });
		}

		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: withNoStore(corsHeaders) });
		}

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			RETURN p.playerName as playerName, p.mostPlayedForTeam as mostPlayedForTeam
			ORDER BY p.playerName
		`;
		const params = { graphLabel: neo4jService.getGraphLabel() };

		const result = await neo4jService.runQuery(query, params);

		const players = result.records
			.map((record: Record) => ({
				playerName: String(record.get("playerName") || ""),
				mostPlayedForTeam: String(record.get("mostPlayedForTeam") || ""),
			}))
			.filter((player: { playerName: string }) => player.playerName && player.playerName.trim() !== "");

		const payload = { players };
		apiCache.set(cacheKey, payload, getCacheTTL("/api/players"));
		return NextResponse.json(payload, { headers: withPublicCache(corsHeaders) });
	} catch {
		return NextResponse.json({ error: "Failed to fetch players" }, { status: 500, headers: withNoStore(corsHeaders) });
	}
}
