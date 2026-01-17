import { useState, useEffect, useCallback } from "react";
import { useNavigationStore } from "@/lib/stores/navigation";
import { generatePageCacheKey } from "@/lib/utils/pageCache";
import type { MainPage, StatsSubPage, TOTWSubPage, ClubInfoSubPage } from "@/lib/stores/navigation";

interface UseCachedFetchOptions {
	endpoint: string;
	method?: "GET" | "POST";
	body?: any;
	headers?: Record<string, string>;
	cacheKey: string; // Full cache key or will be generated from params
	enabled?: boolean; // Whether to fetch (default: true)
}

interface UseCachedFetchResult<T> {
	data: T | null;
	isLoading: boolean;
	error: Error | null;
	refetch: () => Promise<void>;
}

export function useCachedFetch<T = any>(
	options: UseCachedFetchOptions
): UseCachedFetchResult<T> {
	const { endpoint, method = "GET", body, headers, cacheKey, enabled = true } = options;
	const { getCachedPageData, setCachedPageData } = useNavigationStore();
	
	const [data, setData] = useState<T | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<Error | null>(null);

	const fetchData = useCallback(async () => {
		if (!enabled) {
			setIsLoading(false);
			return;
		}

		// Check cache first
		const cached = getCachedPageData(cacheKey);
		if (cached) {
			setData(cached.data as T);
			setIsLoading(false);
			setError(null);
			return;
		}

		// Fetch fresh data
		setIsLoading(true);
		setError(null);
		
		try {
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

			const responseData = await response.json();
			
			// Cache the response
			setCachedPageData(cacheKey, responseData);
			
			setData(responseData);
			setError(null);
		} catch (err) {
			const error = err instanceof Error ? err : new Error("Unknown error");
			setError(error);
			setData(null);
		} finally {
			setIsLoading(false);
		}
	}, [endpoint, method, body, headers, cacheKey, enabled, getCachedPageData, setCachedPageData]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	return {
		data,
		isLoading,
		error,
		refetch: fetchData,
	};
}

// Helper function to generate cache key for a page
export function usePageCacheKey(
	mainPage: MainPage,
	subPage: StatsSubPage | TOTWSubPage | ClubInfoSubPage | null,
	dataType: string,
	params?: Record<string, any>
): string {
	return generatePageCacheKey(mainPage, subPage, dataType, params);
}
