import { playerNameToWrappedSlug, wrappedSlugToPlayerName } from "@/lib/wrapped/slug";

/**
 * Profile slugs intentionally mirror wrapped slugs so links remain stable and reversible.
 */
export function playerNameToProfileSlug(playerName: string): string {
	return playerNameToWrappedSlug(playerName);
}

export function profileSlugToPlayerName(slug: string): string | null {
	return wrappedSlugToPlayerName(slug);
}

export function getPlayerProfileHref(playerName: string): string {
	return `/profile/${playerNameToProfileSlug(playerName)}`;
}
