const AWARDS_DATA_CACHE_KEY = "dorkinians-awards-data-cache";

interface CachedAwardsData {
	season: string;
	data: Array<{ awardName: string; receiver: string | null }>;
	timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Preload awards data for a given season and cache it
 */
export async function preloadAwardsData(season: string): Promise<void> {
	try {
		const response = await fetch(`/api/awards/data?season=${encodeURIComponent(season)}`);
		if (!response.ok) {
			throw new Error("Failed to fetch award data");
		}
		const data = await response.json();

		if (typeof window !== "undefined" && data.awardsData) {
			const cacheData: CachedAwardsData = {
				season,
				data: data.awardsData,
				timestamp: Date.now(),
			};
			sessionStorage.setItem(AWARDS_DATA_CACHE_KEY, JSON.stringify(cacheData));
		}
	} catch (error) {
		console.error("Error preloading awards data:", error);
	}
}

/**
 * Get cached awards data if available and not expired
 */
export function getCachedAwardsData(season: string): Array<{ awardName: string; receiver: string | null }> | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const cached = sessionStorage.getItem(AWARDS_DATA_CACHE_KEY);
		if (!cached) {
			return null;
		}

		const cacheData: CachedAwardsData = JSON.parse(cached);

		// Check if cache is for the requested season and not expired
		if (cacheData.season === season && Date.now() - cacheData.timestamp < CACHE_DURATION) {
			return cacheData.data;
		}

		// Cache expired or wrong season, remove it
		sessionStorage.removeItem(AWARDS_DATA_CACHE_KEY);
		return null;
	} catch (error) {
		console.error("Error reading cached awards data:", error);
		return null;
	}
}

