import { NextResponse } from "next/server";

/**
 * One-off Netlify debugging: set NETLIFY_ENV_PROBE=true in Netlify UI, deploy, GET this route,
 * then remove the env var and delete this file. Returns only booleans / non-secret metadata.
 */
export async function GET() {
	if (process.env.NETLIFY_ENV_PROBE !== "true") {
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
