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
 * Initialize currentSeason - check localStorage first, then fetch if needed
 */
export async function initializeCurrentSeason(): Promise<string | null> {
	// Check localStorage first
	const cachedSeason = getCurrentSeasonFromStorage();
	if (cachedSeason) {
		return cachedSeason;
	}

	// If not in localStorage, fetch from API
	return await fetchAndCacheCurrentSeason();
}

/**
 * Set currentSeason in localStorage (for manual updates if needed)
 */
export function setCurrentSeasonInStorage(season: string): void {
	if (typeof window !== "undefined") {
		localStorage.setItem(CURRENT_SEASON_KEY, season);
	}
}

