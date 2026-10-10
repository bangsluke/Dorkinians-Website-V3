import { NextRequest, NextResponse } from "next/server";
import { fetchLeagueLatestResultsForTeams, type LeagueLatestResultPayload } from "@/lib/league/latestResult";
import { neo4jService } from "@/lib/neo4j";
import { apiCache, getCacheTTL } from "@/lib/utils/apiCache";
import { PUBLIC_CACHE_MEDIUM, withNoStore, withPublicCache } from "@/lib/utils/publicCacheHeaders";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

const DEFAULT_TEAM_KEYS = ["1s", "2s", "3s", "4s", "5s", "6s", "7s", "8s"];

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * Batch latest league results for many teams in one HTTP round-trip.
 * Query: season (required), teams (optional comma-separated keys, default 1s–8s)
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const season = searchParams.get("season");
		const teamsParam = searchParams.get("teams");

		if (!season) {
			return NextResponse.json({ error: "Season parameter is required" }, { status: 400, headers: withNoStore(corsHeaders) });
		}

		const teamKeys = teamsParam
			? teamsParam
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean)
			: DEFAULT_TEAM_KEYS;

		if (teamKeys.length === 0) {
			return NextResponse.json({ error: "At least one team key is required" }, { status: 400, headers: withNoStore(corsHeaders) });
		}

		const cacheKey = apiCache.generateKey("/api/league-latest-results", { season, teams: teamKeys.join(",") });
		const cached = await apiCache.getAsync<{ results: Record<string, LeagueLatestResultPayload> }>(cacheKey);
		if (cached) {
			return NextResponse.json(cached, { headers: withPublicCache(corsHeaders, PUBLIC_CACHE_MEDIUM) });
		}

		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: withNoStore(corsHeaders) });
		}

		const results = await fetchLeagueLatestResultsForTeams(teamKeys, season);
		const payload = { results };
		await apiCache.setAsync(cacheKey, payload, getCacheTTL("/api/league-latest-results"));
		return NextResponse.json(payload, { headers: withPublicCache(corsHeaders, PUBLIC_CACHE_MEDIUM) });
	} catch (error) {
		console.error("Error fetching league latest results batch:", error);
		return NextResponse.json(
			{ error: "Failed to fetch league latest results" },
			{ status: 500, headers: withNoStore(corsHeaders) },
		);
	}
}
