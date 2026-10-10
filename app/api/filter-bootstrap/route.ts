import { NextResponse } from "next/server";
import type { Record } from "neo4j-driver";
import { neo4jService } from "@/lib/neo4j";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { apiCache, getCacheTTL } from "@/lib/utils/apiCache";
import { PUBLIC_CACHE_MEDIUM, withNoStore, withPublicCache } from "@/lib/utils/publicCacheHeaders";
import { logError } from "@/lib/utils/logger";

const corsHeaders = getCorsHeadersWithSecurity();

type BootstrapPayload = {
	seasons: { season: string; startDate: string; endDate: string }[];
	teams: { name: string }[];
	opposition: { name: string }[];
	oppositionClubs: { shortTeamName: string }[];
	competitions: { name: string; type: string }[];
	players: { playerName: string; mostPlayedForTeam: string }[];
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

/** Single round-trip for homepage filter data — parallel Neo4j reads, shared in-process cache. */
export async function GET() {
	try {
		const cacheKey = apiCache.generateKey("/api/filter-bootstrap");
		const cached = await apiCache.getAsync<BootstrapPayload>(cacheKey);
		// Require players field so pre-wave caches are rebuilt once
		if (cached && Array.isArray(cached.players)) {
			return NextResponse.json(cached, { headers: withPublicCache(corsHeaders, PUBLIC_CACHE_MEDIUM) });
		}

		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: withNoStore(corsHeaders) });
		}

		const graphLabel = neo4jService.getGraphLabel();

		const [seasonsResult, teamsResult, oppositionResult, oppositionClubsResult, competitionsResult, playersResult] =
			await Promise.all([
				neo4jService.runQuery(
					`
				MATCH (f:Fixture {graphLabel: $graphLabel})
				WHERE f.season IS NOT NULL AND f.season <> ''
				WITH DISTINCT f.season as seasonName,
				     min(f.date) as seasonStartDate,
				     max(f.date) as seasonEndDate
				RETURN seasonName, seasonStartDate, seasonEndDate
				ORDER BY seasonStartDate DESC
				`,
					{ graphLabel },
				),
				neo4jService.runQuery(
					`
				MATCH (f:Fixture {graphLabel: $graphLabel})
				WHERE f.team IS NOT NULL AND f.team <> ''
				WITH DISTINCT f.team as teamName
				RETURN teamName
				ORDER BY teamName
				`,
					{ graphLabel },
				),
				neo4jService.runQuery(
					`
				MATCH (f:Fixture {graphLabel: $graphLabel})
				WHERE f.opposition IS NOT NULL AND f.opposition <> ''
				WITH DISTINCT f.opposition as oppositionName
				RETURN oppositionName
				ORDER BY oppositionName
				`,
					{ graphLabel },
				),
				neo4jService.runQuery(
					`
				MATCH (od:OppositionDetails {graphLabel: $graphLabel})
				WHERE od.shortTeamName IS NOT NULL AND od.shortTeamName <> ''
				WITH DISTINCT od.shortTeamName as shortTeamName
				RETURN shortTeamName
				ORDER BY shortTeamName
				`,
					{ graphLabel },
				),
				neo4jService.runQuery(
					`
				MATCH (f:Fixture {graphLabel: $graphLabel})
				WHERE f.competition IS NOT NULL AND f.competition <> ''
				WITH DISTINCT f.competition as competitionName, f.compType as compType
				RETURN competitionName, compType
				ORDER BY competitionName
				`,
					{ graphLabel },
				),
				neo4jService.runQuery(
					`
				MATCH (p:Player {graphLabel: $graphLabel})
				WHERE p.allowOnSite = true
				RETURN p.playerName as playerName, p.mostPlayedForTeam as mostPlayedForTeam
				ORDER BY p.playerName
				`,
					{ graphLabel },
				),
			]);

		const players = playersResult.records
			.map((r: Record) => ({
				playerName: String(r.get("playerName") || ""),
				mostPlayedForTeam: String(r.get("mostPlayedForTeam") || ""),
			}))
			.filter((p) => p.playerName && p.playerName.trim() !== "");

		const payload: BootstrapPayload = {
			seasons: seasonsResult.records.map((r: Record) => ({
				season: String(r.get("seasonName") || ""),
				startDate: String(r.get("seasonStartDate") || ""),
				endDate: String(r.get("seasonEndDate") || ""),
			})),
			teams: teamsResult.records.map((r: Record) => ({ name: String(r.get("teamName") || "") })),
			opposition: oppositionResult.records.map((r: Record) => ({ name: String(r.get("oppositionName") || "") })),
			oppositionClubs: oppositionClubsResult.records.map((r: Record) => ({
				shortTeamName: String(r.get("shortTeamName") || ""),
			})),
			competitions: competitionsResult.records.map((r: Record) => ({
				name: String(r.get("competitionName") || ""),
				type: String(r.get("compType") || ""),
			})),
			players,
		};

		// Write-through so GET /api/players is warm for any other callers
		await Promise.all([
			apiCache.setAsync(cacheKey, payload, getCacheTTL("/api/filter-bootstrap")),
			apiCache.setAsync(apiCache.generateKey("/api/players"), { players }, getCacheTTL("/api/players")),
		]);
		return NextResponse.json(payload, { headers: withPublicCache(corsHeaders, PUBLIC_CACHE_MEDIUM) });
	} catch (error) {
		logError("Error building filter bootstrap", error);
		return NextResponse.json({ error: "Failed to load filter bootstrap" }, { status: 500, headers: withNoStore(corsHeaders) });
	}
}
