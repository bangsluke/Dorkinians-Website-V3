/** Returns true when href is an in-app route (not external, hash-only, mailto, etc.). */
export function isInternalAppHref(href: string): boolean {
	if (!href || href.startsWith("#")) return false;
	if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return false;
	if (href.startsWith("http://") || href.startsWith("https://")) {
		if (typeof window === "undefined") return false;
		try {
			const url = new URL(href);
			return url.origin === window.location.origin;
		} catch {
			return false;
		}
	}
	return href.startsWith("/");
}

export function normalizeAppRouteKey(pathname: string, search: string): string {
	const query = search.startsWith("?") ? search.slice(1) : search;
	return query ? `${pathname}?${query}` : pathname;
}

export function hrefToRouteKey(href: string): string | null {
	if (!isInternalAppHref(href)) return null;
	if (typeof window === "undefined") return href.split("#")[0] || null;
	try {
		const url = new URL(href, window.location.origin);
		return normalizeAppRouteKey(url.pathname, url.search);
	} catch {
		return null;
	}
}

export function isSameAppRoute(currentKey: string, targetKey: string): boolean {
	return currentKey === targetKey;
}
