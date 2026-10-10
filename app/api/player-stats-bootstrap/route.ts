import { NextRequest, NextResponse } from "next/server";
import { GET as getPlayerData } from "@/app/api/player-data/route";
import { POST as postSeasonalStats } from "@/app/api/player-seasonal-stats/route";
import { POST as postTeamStats } from "@/app/api/player-team-stats/route";
import { GET as getPlayerAwards } from "@/app/api/player-awards/route";
import { GET as getCaptainHistory } from "@/app/api/captains/player-history/route";
import { GET as getAwardHistory } from "@/app/api/awards/player-history/route";
import { apiCache, getCacheTTL } from "@/lib/utils/apiCache";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { PUBLIC_CACHE_MEDIUM, withNoStore, withPublicCache } from "@/lib/utils/publicCacheHeaders";
import { logError } from "@/lib/utils/logger";

const corsHeaders = getCorsHeadersWithSecurity();

export type PlayerStatsBootstrapPayload = {
	playerName: string;
	playerData: unknown | null;
	seasonalStats: unknown[];
	teamStats: unknown[];
	playerAwards: unknown | null;
	captaincies: unknown[];
	totalCaptaincies: number;
	awards: unknown[];
	totalAwards: number;
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
	if (!res.ok) {
		return null;
	}
	try {
		return (await res.json()) as Record<string, unknown>;
	} catch {
		return null;
	}
}

/**
 * One round-trip for Stats above-the-fold (default filters):
 * player-data + seasonal + team + awards/captains histories.
 * Reuses existing route handlers — no duplicated Cypher.
 */
export async function GET(request: NextRequest) {
	try {
		const playerName = request.nextUrl.searchParams.get("playerName")?.trim();
		if (!playerName) {
			return NextResponse.json({ error: "Player name is required" }, { status: 400, headers: withNoStore(corsHeaders) });
		}

		const cacheKey = apiCache.generateKey("/api/player-stats-bootstrap", { playerName });
		const cached = await apiCache.getAsync<PlayerStatsBootstrapPayload>(cacheKey);
		if (cached) {
			return NextResponse.json(cached, { headers: withPublicCache(corsHeaders, PUBLIC_CACHE_MEDIUM) });
		}

		const origin = request.nextUrl.origin || "http://localhost";
		const encoded = encodeURIComponent(playerName);
		const emptyFiltersBody = JSON.stringify({ playerName, filters: null });

		const [playerDataRes, seasonalRes, teamRes, playerAwardsRes, captainRes, awardHistoryRes] = await Promise.all([
			getPlayerData(new NextRequest(`${origin}/api/player-data?playerName=${encoded}`)),
			postSeasonalStats(
				new NextRequest(`${origin}/api/player-seasonal-stats`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: emptyFiltersBody,
				}),
			),
			postTeamStats(
				new NextRequest(`${origin}/api/player-team-stats`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: emptyFiltersBody,
				}),
			),
			getPlayerAwards(new NextRequest(`${origin}/api/player-awards?playerName=${encoded}`)),
			getCaptainHistory(new NextRequest(`${origin}/api/captains/player-history?playerName=${encoded}`)),
			getAwardHistory(new NextRequest(`${origin}/api/awards/player-history?playerName=${encoded}`)),
		]);

		const [playerDataJson, seasonalJson, teamJson, playerAwardsJson, captainJson, awardHistoryJson] = await Promise.all([
			readJson(playerDataRes),
			readJson(seasonalRes),
			readJson(teamRes),
			readJson(playerAwardsRes),
			readJson(captainRes),
			readJson(awardHistoryRes),
		]);

		const payload: PlayerStatsBootstrapPayload = {
			playerName,
			playerData: playerDataJson?.playerData ?? null,
			seasonalStats: Array.isArray(seasonalJson?.seasonalStats) ? seasonalJson.seasonalStats : [],
			teamStats: Array.isArray(teamJson?.teamStats) ? teamJson.teamStats : [],
			playerAwards: playerAwardsJson,
			captaincies: Array.isArray(captainJson?.captaincies) ? captainJson.captaincies : [],
			totalCaptaincies: typeof captainJson?.totalCaptaincies === "number" ? captainJson.totalCaptaincies : 0,
			awards: Array.isArray(awardHistoryJson?.awards) ? awardHistoryJson.awards : [],
			totalAwards: typeof awardHistoryJson?.totalAwards === "number" ? awardHistoryJson.totalAwards : 0,
		};

		if (!payload.playerData) {
			return NextResponse.json(
				{ error: "Failed to load player data" },
				{ status: playerDataRes.status >= 400 ? playerDataRes.status : 502, headers: withNoStore(corsHeaders) },
			);
		}

		await apiCache.setAsync(cacheKey, payload, getCacheTTL("/api/player-stats-bootstrap"));
		return NextResponse.json(payload, { headers: withPublicCache(corsHeaders, PUBLIC_CACHE_MEDIUM) });
	} catch (error) {
		logError("Error building player-stats-bootstrap", error);
		return NextResponse.json({ error: "Failed to load player stats bootstrap" }, { status: 500, headers: withNoStore(corsHeaders) });
	}
}
