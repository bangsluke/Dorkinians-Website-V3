import { NextRequest, NextResponse } from "next/server";
import { apiCache, getCacheTTL } from "@/lib/utils/apiCache";
import { withNoStore, withPublicCache, PUBLIC_CACHE_TOTW } from "@/lib/utils/publicCacheHeaders";
import { logError } from "@/lib/utils/logger";
import { GET as getSeasons } from "@/app/api/totw/seasons/route";
import { GET as getWeeks } from "@/app/api/totw/weeks/route";
import { GET as getWeekData } from "@/app/api/totw/week-data/route";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Fixed internal base URL for in-process handler calls (never derived from the request). */
const INTERNAL_TOTW_BASE = "http://totw.internal";

function internalTotwRequest(pathname: string, searchParams?: Record<string, string>): NextRequest {
	const url = new URL(pathname, INTERNAL_TOTW_BASE);
	if (searchParams) {
		for (const [key, value] of Object.entries(searchParams)) {
			url.searchParams.set(key, value);
		}
	}
	return new NextRequest(url);
}

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

/**
 * One payload for TOTW first paint: seasons + weeks for current season + week-data.
 * Calls sibling route handlers in-process so Cypher stays in one place without SSRF risk.
 */
export async function GET() {
	try {
		const cacheKey = apiCache.generateKey("/api/totw/current-week");
		const cached = await apiCache.getAsync<Record<string, unknown>>(cacheKey);
		if (cached) {
			return NextResponse.json(cached, { headers: withPublicCache(corsHeaders, PUBLIC_CACHE_TOTW) });
		}

		const seasonsRes = await getSeasons(internalTotwRequest("/api/totw/seasons"));
		if (!seasonsRes.ok) {
			return NextResponse.json({ error: "Failed to fetch TOTW seasons" }, { status: 502, headers: withNoStore(corsHeaders) });
		}
		const seasonsData = (await seasonsRes.json()) as {
			seasons?: string[];
			currentSeason?: string | null;
			latestGameweek?: string | null;
			latestGameweekDate?: string | null;
		};

		const seasons = seasonsData.seasons || [];
		const currentSeason =
			seasonsData.currentSeason && seasons.includes(seasonsData.currentSeason) && seasonsData.currentSeason !== "All Time"
				? seasonsData.currentSeason
				: seasons.find((s) => s !== "All Time") || null;

		if (!currentSeason) {
			const payload = {
				seasons,
				currentSeason: null,
				latestGameweek: seasonsData.latestGameweek ?? null,
				latestGameweekDate: seasonsData.latestGameweekDate ?? null,
				weeks: [],
				currentWeek: null,
				weekData: null,
				players: [],
			};
			await apiCache.setAsync(cacheKey, payload, getCacheTTL("/api/totw/current-week"));
			return NextResponse.json(payload, { headers: withPublicCache(corsHeaders, PUBLIC_CACHE_TOTW) });
		}

		const weeksRes = await getWeeks(internalTotwRequest("/api/totw/weeks", { season: currentSeason }));
		if (!weeksRes.ok) {
			return NextResponse.json({ error: "Failed to fetch TOTW weeks" }, { status: 502, headers: withNoStore(corsHeaders) });
		}
		const weeksData = (await weeksRes.json()) as {
			weeks?: unknown[];
			currentWeek?: number | null;
			latestGameweek?: string | null;
			latestGameweekDate?: string | null;
		};

		let weekToSelect: number | null = null;
		if (weeksData.latestGameweek) {
			const n = Number(weeksData.latestGameweek);
			if (!Number.isNaN(n) && n !== 0) weekToSelect = n;
		}
		if (weekToSelect === null && weeksData.currentWeek != null && weeksData.currentWeek !== 0) {
			weekToSelect = weeksData.currentWeek;
		}

		let weekData: unknown = null;
		let players: unknown[] = [];
		if (weekToSelect != null) {
			const weekDataRes = await getWeekData(
				internalTotwRequest("/api/totw/week-data", {
					season: currentSeason,
					week: String(weekToSelect),
				}),
			);
			if (weekDataRes.ok) {
				const wd = (await weekDataRes.json()) as { totwData?: unknown; players?: unknown[] };
				weekData = wd.totwData ?? null;
				players = Array.isArray(wd.players) ? wd.players : [];
			}
		}

		const payload = {
			seasons,
			currentSeason,
			latestGameweek: weeksData.latestGameweek ?? seasonsData.latestGameweek ?? null,
			latestGameweekDate: weeksData.latestGameweekDate ?? seasonsData.latestGameweekDate ?? null,
			weeks: weeksData.weeks || [],
			currentWeek: weekToSelect,
			weekData,
			players,
		};
		await apiCache.setAsync(cacheKey, payload, getCacheTTL("/api/totw/current-week"));
		return NextResponse.json(payload, { headers: withPublicCache(corsHeaders, PUBLIC_CACHE_TOTW) });
	} catch (error) {
		logError("Error building TOTW current-week payload", error);
		return NextResponse.json({ error: "Failed to load TOTW current week" }, { status: 500, headers: withNoStore(corsHeaders) });
	}
}
