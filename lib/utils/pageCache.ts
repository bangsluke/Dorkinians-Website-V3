// Page data cache utility with 10-minute TTL
import type { MainPage, StatsSubPage, TOTWSubPage, ClubInfoSubPage } from "@/lib/stores/navigation";

export const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

export interface CachedPageData {
	data: any;
	timestamp: number;
	ttl: number;
}

// Simple hash function for parameters
export function hashParams(params: Record<string, any>): string {
	// Sort keys for consistent hashing
	const sortedKeys = Object.keys(params).sort();
	const sortedParams: Record<string, any> = {};
	
	for (const key of sortedKeys) {
		const value = params[key];
		// Handle different value types
		if (value === null || value === undefined) {
			sortedParams[key] = null;
		} else if (typeof value === "object") {
			// Recursively hash nested objects
			sortedParams[key] = hashParams(value);
		} else {
			sortedParams[key] = value;
		}
	}
	
	// Create a simple hash from the stringified params
	const str = JSON.stringify(sortedParams);
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash).toString(36);
}

// Generate cache key for page data
export function generatePageCacheKey(
	mainPage: MainPage,
	subPage: StatsSubPage | TOTWSubPage | ClubInfoSubPage | null,
	dataType: string,
	params?: Record<string, any>
): string {
	const parts: string[] = [mainPage];
	
	if (subPage) {
		parts.push(subPage);
	}
	
	parts.push(dataType);
	
	if (params && Object.keys(params).length > 0) {
		const paramsHash = hashParams(params);
		parts.push(paramsHash);
	}
	
	return parts.join(":");
}

// Check if cached data is still valid
export function isCacheValid(cachedData: CachedPageData | null): boolean {
	if (!cachedData) return false;
	
	const now = Date.now();
	const age = now - cachedData.timestamp;
	
	return age < cachedData.ttl;
}

// Cached fetch helper function
export async function cachedFetch<T = any>(
	endpoint: string,
	options: {
		method?: "GET" | "POST";
		body?: any;
		headers?: Record<string, string>;
		cacheKey: string;
		getCachedPageData: (key: string) => CachedPageData | null;
		setCachedPageData: (key: string, data: any) => void;
	}
): Promise<T> {
	const { method = "GET", body, headers, cacheKey, getCachedPageData, setCachedPageData } = options;
	
	// Check cache first
	const cached = getCachedPageData(cacheKey);
	if (cached) {
		return cached.data as T;
	}
	
	// Fetch fresh data
	const fetchOptions: RequestInit = {
		method,
		headers: {
			"Content-Type": "application/json",
			...headers,
		},
	};
	
	if (body && method === "POST") {
		fetchOptions.body = JSON.stringify(body);
	}
	
	const response = await fetch(endpoint, fetchOptions);
	
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}
	
	const data = await response.json();
	
	// Cache the response
	setCachedPageData(cacheKey, data);
	
	return data as T;
}
