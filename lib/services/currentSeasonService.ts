import { log } from "@/lib/utils/logger";
import { retryFetch } from "@/lib/utils/retryFetch";
import {
	notifyNeo4jColdStart,
	notifyNeo4jColdStartRecovered,
	notifyNeo4jColdStartStillFailing,
} from "@/lib/services/coldStartNotifier";

const CURRENT_SEASON_KEY = "dorkinians-current-season";

/**
 * Fetch currentSeason from SiteDetails API and store in localStorage
 */
export async function fetchAndCacheCurrentSeason(): Promise<string | null> {
	try {
		const response = await retryFetch("/api/site-details", undefined, {
			onRetryableFailure: () => {
				notifyNeo4jColdStart();
			},
			onRecovered: () => {
				notifyNeo4jColdStartRecovered();
			},
		});
		if (!response.ok) {
			log("warn", "Failed to fetch site details:", response.status, response.statusText);
			notifyNeo4jColdStartStillFailing();
			return null;
		}
		const data = await response.json();
		const currentSeason = data.currentSeason || null;

		if (currentSeason && typeof window !== "undefined") {
			localStorage.setItem(CURRENT_SEASON_KEY, currentSeason);
		}

		return currentSeason;
	} catch (error) {
		log("warn", "Error fetching current season:", error);
		notifyNeo4jColdStartStillFailing();
		return null;
	}
}

/**
 * Get currentSeason from localStorage
 */
export function getCurrentSeasonFromStorage(): string | null {
	if (typeof window === "undefined") {
		return null;
	}
	return localStorage.getItem(CURRENT_SEASON_KEY);
}

/**
 * Initialize currentSeason — always refresh from SiteDetails so season rollovers
 * overwrite a stale localStorage value. Fall back to cache only if the fetch fails.
 */
export async function initializeCurrentSeason(): Promise<string | null> {
	const fetchedSeason = await fetchAndCacheCurrentSeason();
	if (fetchedSeason) {
		return fetchedSeason;
	}

	return getCurrentSeasonFromStorage();
}

/**
 * Set currentSeason in localStorage (for manual updates if needed)
 */
export function setCurrentSeasonInStorage(season: string): void {
	if (typeof window !== "undefined") {
		localStorage.setItem(CURRENT_SEASON_KEY, season);
	}
}
