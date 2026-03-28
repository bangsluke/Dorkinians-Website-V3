import { NextRequest, NextResponse } from "next/server";
import type { Record as NeoRecord, Node as Neo4jNode } from "neo4j-driver";
import { neo4jService } from "@/lib/neo4j";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { dataApiRateLimiter } from "@/lib/middleware/rateLimiter";
import { logError } from "@/lib/utils/logger";
import { playerPropsFromNeo4j } from "@/lib/badges/neo4jProps";
import { getBadgeProgress } from "@/lib/badges/evaluate";

const corsHeaders = getCorsHeadersWithSecurity();

const VALID_TIERS = new Set(["bronze", "silver", "gold", "diamond"]);

export function parseBadgeId(badgeId: string): { badgeKey: string; tier: string } | null {
	const parts = String(badgeId).split("_");
	const tier = parts[parts.length - 1] ?? "";
	if (!VALID_TIERS.has(tier)) return null;
	const badgeKey = parts.slice(0, -1).join("_");
	return badgeKey ? { badgeKey, tier } : null;
}

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function str(v: unknown): string {
	if (v == null) return "";
	return String(v);
}

export async function GET(request: NextRequest) {
	const rateLimitResponse = await dataApiRateLimiter(request);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	const { searchParams } = new URL(request.url);
	const playerName = searchParams.get("playerName")?.trim();
	if (!playerName) {
		return NextResponse.json({ error: "playerName is required" }, { status: 400, headers: corsHeaders });
	}

	try {
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			WHERE p.allowOnSite = true
			OPTIONAL MATCH (p)-[:HAS_BADGE]->(pb:PlayerBadge {graphLabel: $graphLabel})
			RETURN properties(p) AS props, collect(DISTINCT pb) AS badgeNodes
		`;
		const result = await neo4jService.runQuery(query, { graphLabel, playerName });

		if (!result.records.length) {
			return NextResponse.json({ error: "Player not found" }, { status: 404, headers: corsHeaders });
		}

		const record = result.records[0] as NeoRecord;
		const rawProps = record.get("props") as Record<string, unknown>;
		const badgeNodes = record.get("badgeNodes") as Array<Neo4jNode | null>;

		const player = playerPropsFromNeo4j(rawProps);

		const earned: Array<{
			badgeId: string;
			badgeKey: string;
			badgeName: string;
			badgeCategory: string;
			tier: string;
			description: string;
			earnedDate: string | null;
		}> = [];

		for (const node of badgeNodes) {
			if (!node || !node.properties) continue;
			const p = node.properties as Record<string, unknown>;
			const badgeId = str(p.badgeId);
			const parsed = parseBadgeId(badgeId);
			if (!parsed) continue;
			earned.push({
				badgeId,
				badgeKey: parsed.badgeKey,
				badgeName: str(p.badgeName),
				badgeCategory: str(p.badgeCategory),
				tier: str(p.tier) || parsed.tier,
				description: str(p.description),
				earnedDate: p.earnedDate != null ? str(p.earnedDate) : null,
			});
		}

		const progress = getBadgeProgress(player);
		const totalBadges = Number(player.totalBadges ?? earned.length) || earned.length;
		const highestBadgeTier = player.highestBadgeTier != null && String(player.highestBadgeTier).trim() !== "" ? String(player.highestBadgeTier) : null;

		return NextResponse.json(
			{
				playerName,
				totalBadges,
				highestBadgeTier,
				earned,
				progress,
			},
			{ headers: corsHeaders },
		);
	} catch (error) {
		logError("player-badges GET", error);
		return NextResponse.json({ error: "Failed to load badges", earned: [], progress: [] }, { status: 500, headers: corsHeaders });
	}
}
