export function playerNameToProfileSlug(playerName: string): string {
	const trimmed = (playerName || "").trim();
	if (!trimmed) return "";
	// Human-readable URL segment while remaining reversible for names with hyphens/punctuation.
	return encodeURIComponent(trimmed).replace(/-/g, "%2D").replace(/%20/g, "-");
}

export function profileSlugToPlayerName(slug: string): string | null {
	if (!slug) return null;
	try {
		return decodeURIComponent(slug.replace(/-/g, "%20"));
	} catch {
		return null;
	}
}

export function getPlayerProfileHref(playerName: string): string {
	return `/profile/${playerNameToProfileSlug(playerName)}`;
}
