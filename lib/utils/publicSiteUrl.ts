/**
 * Canonical public site URL for links (wrapped “full site”, etc.).
 * Prefer `NEXT_PUBLIC_SITE_URL` at build time; fall back to production host.
 */
export function getPublicSiteRoot(): string {
	const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
	if (env) return env.replace(/\/+$/, "");
	return "https://dorkiniansfcstats.co.uk";
}
