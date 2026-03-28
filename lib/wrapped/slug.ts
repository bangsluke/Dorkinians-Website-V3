/**
 * URL-safe slug for `/wrapped/[playerSlug]` — base64url of UTF-8 player name (handles spaces and punctuation).
 */

/** RFC 4648 base64url without relying on `Buffer` encoding `base64url` (unsupported in many browser polyfills). */
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

export function playerNameToWrappedSlug(playerName: string): string {
	return utf8ToBase64Url(playerName.trim());
}

export function wrappedSlugToPlayerName(slug: string): string | null {
	try {
		const t = slug.trim();
		if (!t) return null;
		return base64UrlToUtf8(t).trim() || null;
	} catch {
		return null;
	}
}
