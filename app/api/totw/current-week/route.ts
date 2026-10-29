import { NextResponse } from "next/server";
import { apiCache, getCacheTTL } from "@/lib/utils/apiCache";
import { withNoStore, withPublicCache, PUBLIC_CACHE_TOTW } from "@/lib/utils/publicCacheHeaders";
import { logError } from "@/lib/utils/logger";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

/**
 * One payload for TOTW first paint: seasons + weeks for current season + week-data.
 * Uses existing route handlers via same-origin fetch so Cypher stays in one place.
 */
export async function GET(request: Request) {
	try {
		const cacheKey = apiCache.generateKey("/api/totw/current-week");
		const cached = await apiCache.getAsync<Record<string, unknown>>(cacheKey);
		if (cached) {
			return NextResponse.json(cached, { headers: withPublicCache(corsHeaders, PUBLIC_CACHE_TOTW) });
		}

		const origin = new URL(request.url).origin;
		const seasonsRes = await fetch(`${origin}/api/totw/seasons`, { cache: "no-store" });
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

		const weeksRes = await fetch(`${origin}/api/totw/weeks?season=${encodeURIComponent(currentSeason)}`, {
			cache: "no-store",
		});
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
			const weekDataRes = await fetch(
				`${origin}/api/totw/week-data?season=${encodeURIComponent(currentSeason)}&week=${weekToSelect}`,
				{ cache: "no-store" },
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
