/**
 * Runs outside the Next.js server bundle. Use if /api/netlify-env-probe misbehaves.
 * GET https://<site>/.netlify/functions/netlify-env-probe
 * Remove this file after debugging.
 */
const KEYS = [
	"PROD_NEO4J_URI",
	"PROD_NEO4J_USER",
	"PROD_NEO4J_PASSWORD",
	"SEED_API_KEY",
	"AUTH_SECRET",
	"AUTH_GOOGLE_ID",
	"AUTH_GOOGLE_SECRET",
	"AUTH_URL",
];

exports.handler = async () => {
	const check = (key) => typeof process.env[key] === "string" && process.env[key].length > 0;
	const present = Object.fromEntries(KEYS.map((k) => [k, check(k)]));
	const body = JSON.stringify({
		source: "netlify-functions-runtime",
		netlify: process.env.NETLIFY ?? null,
		context: process.env.CONTEXT ?? null,
		deployUrl: process.env.DEPLOY_URL ?? null,
		envKeyCount: Object.keys(process.env).length,
		requiredPresent: present,
		allRequiredOk: KEYS.every((k) => present[k]),
	});
	return {
		statusCode: 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
		},
		body,
	};
};
