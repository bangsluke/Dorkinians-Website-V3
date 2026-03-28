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
	const s = String(v).trim();
	return s === "" ? null : s;
}

function num(v: unknown): number {
	if (v == null) return 0;
	if (typeof v === "number" && !Number.isNaN(v)) return v;
	if (typeof v === "object" && v !== null && "toNumber" in v && typeof (v as { toNumber: () => number }).toNumber === "function") {
		return (v as { toNumber: () => number }).toNumber();
	}
	const n = Number(v);
	return Number.isNaN(n) ? 0 : n;
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

		const qMost = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			WITH p ORDER BY coalesce(p.totalBadges, 0) DESC
			LIMIT 10
			RETURN p.playerName AS playerName,
				coalesce(p.totalBadges, 0) AS totalBadges,
				p.highestBadgeTier AS highestBadgeTier
		`;

		const qTier = (tier: string) => `
			MATCH (p:Player {graphLabel: $graphLabel})-[:HAS_BADGE]->(pb:PlayerBadge {graphLabel: $graphLabel, tier: $tier})
			WHERE p.allowOnSite = true
			WITH p.playerName AS playerName, count(pb) AS cnt
			ORDER BY cnt DESC
			LIMIT 5
			RETURN playerName, cnt
		`;

		const [mostRes, diamondRes, goldRes] = await Promise.all([
			neo4jService.runQuery(qMost, { graphLabel }),
			neo4jService.runQuery(qTier("diamond"), { graphLabel, tier: "diamond" }),
			neo4jService.runQuery(qTier("gold"), { graphLabel, tier: "gold" }),
		]);

		const mostBadges = mostRes.records.map((rec: NeoRecord) => ({
			playerName: str(rec.get("playerName")) ?? "",
			totalBadges: num(rec.get("totalBadges")),
			highestBadgeTier: str(rec.get("highestBadgeTier")),
		}));

		const mapTierRows = (records: typeof diamondRes.records) =>
			records.map((rec: NeoRecord) => ({
				playerName: str(rec.get("playerName")) ?? "",
				count: num(rec.get("cnt")),
			}));

		return NextResponse.json(
			{
				mostBadges,
				mostDiamond: mapTierRows(diamondRes.records),
				mostGold: mapTierRows(goldRes.records),
			},
			{ headers: corsHeaders },
		);
	} catch (error) {
		logError("club-badge-leaderboard GET", error);
		return NextResponse.json(
			{ error: "Failed to load badge leaderboard", mostBadges: [], mostDiamond: [], mostGold: [] },
			{ status: 500, headers: corsHeaders },
		);
	}
}
