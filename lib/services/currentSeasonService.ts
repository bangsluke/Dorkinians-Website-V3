const CURRENT_SEASON_KEY = "dorkinians-current-season";

/**
 * Fetch currentSeason from SiteDetails API and store in localStorage
 */
export async function fetchAndCacheCurrentSeason(): Promise<string | null> {
	try {
		const response = await fetch("/api/site-details");
		if (!response.ok) {
			throw new Error("Failed to fetch site details");
		}
		const data = await response.json();
		const currentSeason = data.currentSeason || null;

		if (currentSeason && typeof window !== "undefined") {
			localStorage.setItem(CURRENT_SEASON_KEY, currentSeason);
		}

		return currentSeason;
	} catch (error) {
		console.error("Error fetching current season:", error);
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
