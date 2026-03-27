import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Temporary Netlify diagnostic. Gated on Netlify’s built-in `NETLIFY` flag (not a UI secret),
 * because custom env vars are the ones failing—`NETLIFY_ENV_PROBE` would 404 forever.
 * Remove this route after debugging.
 */
export async function GET() {
	if (process.env.NETLIFY !== "true") {
		return new NextResponse(null, { status: 404 });
	}

	const check = (key: string) => typeof process.env[key] === "string" && process.env[key]!.length > 0;

	const keys = [
		"PROD_NEO4J_URI",
		"PROD_NEO4J_USER",
		"PROD_NEO4J_PASSWORD",
		"SEED_API_KEY",
		"AUTH_SECRET",
		"AUTH_GOOGLE_ID",
		"AUTH_GOOGLE_SECRET",
		"AUTH_URL",
	] as const;

	const present = Object.fromEntries(keys.map((k) => [k, check(k)]));

	return NextResponse.json(
		{
			source: "next-server-handler",
			netlify: process.env.NETLIFY ?? null,
			context: process.env.CONTEXT ?? null,
			deployUrl: process.env.DEPLOY_URL ?? null,
			cwd: process.cwd(),
			dorkiniansWebsiteRoot: process.env.DORKINIANS_WEBSITE_ROOT ? "(set)" : null,
			envKeyCount: Object.keys(process.env).length,
			requiredPresent: present,
			allRequiredOk: keys.every((k) => present[k]),
		},
		{ headers: { "Cache-Control": "no-store" } },
	);
}
