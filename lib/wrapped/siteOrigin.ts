import type { NextRequest } from "next/server";

/** Public site origin for absolute wrapped URLs (prefer NEXT_PUBLIC_SITE_URL in production). */
export function getSitePublicOrigin(request: NextRequest): string {
	const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
	if (env) {
		return env.replace(/\/+$/, "");
	}
	const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
	const proto = request.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
	return `${proto}://${host}`.replace(/\/+$/, "");
}
