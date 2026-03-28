import { NextRequest, NextResponse } from "next/server";
import type { Record as NeoRecord } from "neo4j-driver";
import { neo4jService } from "@/lib/neo4j";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { dataApiRateLimiter } from "@/lib/middleware/rateLimiter";
import { logError } from "@/lib/utils/logger";

const corsHeaders = getCorsHeadersWithSecurity();

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function str(v: unknown): string | null {
	if (v == null) return null;
	return String(v);
}

function num(v: unknown): number | null {
	if (v == null) return null;
	if (typeof v === "number" && !Number.isNaN(v)) return v;
	if (typeof v === "object" && v !== null && "toNumber" in v && typeof (v as { toNumber: () => number }).toNumber === "function") {
		return (v as { toNumber: () => number }).toNumber();
	}
	const n = Number(v);
	return Number.isNaN(n) ? null : n;
}

export async function GET(request: NextRequest) {
	const rateLimitResponse = await dataApiRateLimiter(request);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	try {
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true AND p.squadInfluenceRank IS NOT NULL
			RETURN p.playerName AS playerName,
				p.squadInfluence AS squadInfluence,
				p.squadInfluenceRank AS squadInfluenceRank,
				p.communityId AS communityId
			ORDER BY p.squadInfluenceRank ASC
			LIMIT 10
		`;
		const result = await neo4jService.runQuery(query, { graphLabel });

		const players = result.records.map((record: NeoRecord) => ({
			playerName: str(record.get("playerName")) ?? "",
			squadInfluence: num(record.get("squadInfluence")),
			squadInfluenceRank: num(record.get("squadInfluenceRank")),
			communityId: num(record.get("communityId")),
		}));

		return NextResponse.json({ players }, { headers: corsHeaders });
	} catch (error) {
		logError("club-squad-backbone GET", error);
		return NextResponse.json({ error: "Failed to load squad backbone", players: [] }, { status: 500, headers: corsHeaders });
	}
}
