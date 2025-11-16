const CAPTAINS_DATA_CACHE_KEY = "dorkinians-captains-data-cache";

interface CachedCaptainsData {
	season: string;
	data: Array<{ team: string; captain: string | null }>;
	timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Preload captains data for a given season and cache it
 */
export async function preloadCaptainsData(season: string): Promise<void> {
	try {
		const response = await fetch(`/api/captains/data?season=${encodeURIComponent(season)}`);
		if (!response.ok) {
			throw new Error("Failed to fetch captain data");
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
		console.error("Error preloading captains data:", error);
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
		console.error("Error reading cached captains data:", error);
		return null;
	}
}

