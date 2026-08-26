import { log } from "@/lib/utils/logger";
import { retryFetch } from "@/lib/utils/retryFetch";
import {
	notifyNeo4jColdStart,
	notifyNeo4jColdStartRecovered,
	notifyNeo4jColdStartStillFailing,
} from "@/lib/services/coldStartNotifier";

const CAPTAINS_DATA_CACHE_KEY = "dorkinians-captains-data-cache";

interface CachedCaptainsData {
	season: string;
	data: Array<{ team: string; captain: string | null }>;
	timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Preload captains data for a given season and cache it.
 * Best-effort: logs warnings only (no throw/console.error Error) to avoid Next overlays.
 */
export async function preloadCaptainsData(season: string): Promise<void> {
	try {
		const response = await retryFetch(
			`/api/captains/data?season=${encodeURIComponent(season)}`,
			undefined,
			{
				onRetryableFailure: () => {
					notifyNeo4jColdStart();
				},
				onRecovered: () => {
					notifyNeo4jColdStartRecovered();
				},
			},
		);

		if (!response.ok) {
			log("warn", "Captains preload skipped:", response.status, response.statusText);
			notifyNeo4jColdStartStillFailing();
			return;
		}

		const data = await response.json();

		if (typeof window !== "undefined" && data.captainsData) {
			const cacheData: CachedCaptainsData = {
				season,
				data: data.captainsData,
				timestamp: Date.now(),
			};
			sessionStorage.setItem(CAPTAINS_DATA_CACHE_KEY, JSON.stringify(cacheData));
		}
	} catch (error) {
		log("warn", "Captains preload failed:", error);
		notifyNeo4jColdStartStillFailing();
	}
}

/**
 * Get cached captains data if available and not expired
 */
export function getCachedCaptainsData(season: string): Array<{ team: string; captain: string | null }> | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const cached = sessionStorage.getItem(CAPTAINS_DATA_CACHE_KEY);
		if (!cached) {
			return null;
		}

		const cacheData: CachedCaptainsData = JSON.parse(cached);

		// Check if cache is for the requested season and not expired
		if (cacheData.season === season && Date.now() - cacheData.timestamp < CACHE_DURATION) {
			return cacheData.data;
		}

		// Cache expired or wrong season, remove it
		sessionStorage.removeItem(CAPTAINS_DATA_CACHE_KEY);
		return null;
	} catch (error) {
		log("warn", "Error reading cached captains data:", error);
		return null;
	}
}
