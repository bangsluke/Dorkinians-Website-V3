/** HTTP Cache-Control for read-mostly public GET API responses. */

export const PUBLIC_CACHE_LONG = "public, max-age=3600, stale-while-revalidate=86400";
export const PUBLIC_CACHE_MEDIUM = "public, max-age=300, stale-while-revalidate=3600";
/** TOTW changes after each seed; keep CDN/browser cache short with no stale-while-revalidate. */
export const PUBLIC_CACHE_TOTW = "public, max-age=60";
export const NO_STORE = "no-cache, no-store, must-revalidate";

export function withPublicCache(
	baseHeaders: Record<string, string>,
	cacheControl: string = PUBLIC_CACHE_LONG,
): Record<string, string> {
	return {
		...baseHeaders,
		"Cache-Control": cacheControl,
	};
}

export function withNoStore(baseHeaders: Record<string, string>): Record<string, string> {
	return withPublicCache(baseHeaders, NO_STORE);
}
