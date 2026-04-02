/**
 * `/wrapped/[playerSlug]` uses the same human-readable encoding as `/profile/[playerSlug]`
 * (`lib/profile/slug.ts`). Legacy base64url slugs are still accepted for old links.
 */

import { playerNameToProfileSlug, profileSlugToPlayerName } from "@/lib/profile/slug";

/** RFC 4648 base64url - used only to decode legacy bookmarks. */
function bytesToBase64UrlFromStandardBase64(standardBase64: string): string {
	return standardBase64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function utf8ToBase64Url(s: string): string {
	if (typeof Buffer !== "undefined") {
		return bytesToBase64UrlFromStandardBase64(Buffer.from(s, "utf8").toString("base64"));
	}
	const bytes = new TextEncoder().encode(s);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]!);
	}
	return bytesToBase64UrlFromStandardBase64(btoa(binary));
}

function base64UrlToUtf8(slug: string): string {
	const padded = slug.replace(/-/g, "+").replace(/_/g, "/");
	const padLen = (4 - (padded.length % 4)) % 4;
	const b64 = padded + "=".repeat(padLen);
	if (typeof Buffer !== "undefined") {
		return Buffer.from(b64, "base64").toString("utf8");
	}
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new TextDecoder().decode(bytes);
}

/** Human-readable segment, e.g. `George-Warne`, matching `/profile/...`. */
export function playerNameToWrappedSlug(playerName: string): string {
	return playerNameToProfileSlug(playerName);
}

export function wrappedSlugToPlayerName(slug: string): string | null {
	const t = slug.trim();
	if (!t) return null;

	const looksProfileEncoded = t.includes("-") || t.includes("%");

	const tryLegacy = (): string | null => {
		try {
			const legacy = base64UrlToUtf8(t).trim();
			if (legacy && /[\p{L}]/u.test(legacy) && utf8ToBase64Url(legacy) === t) {
				return legacy;
			}
		} catch {
			/* not valid base64 */
		}
		return null;
	};

	/* Compact base64url bookmarks have no `-` (space) or `%` (encoded punctuation) - try those first. */
	if (!looksProfileEncoded) {
		const leg = tryLegacy();
		if (leg) return leg;
	}

	const fromProfile = profileSlugToPlayerName(t);
	if (fromProfile && /[\p{L}]/u.test(fromProfile) && playerNameToProfileSlug(fromProfile) === t) {
		return fromProfile;
	}

	if (looksProfileEncoded) {
		return tryLegacy();
	}

	return null;
}
