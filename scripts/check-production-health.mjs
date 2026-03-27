/**
 * Smoke-check production URLs. Set SITE_BASE_URL and DATABASE_API_BASE_URL in the environment.
 * @example
 * SITE_BASE_URL=https://example.netlify.app DATABASE_API_BASE_URL=https://app.herokuapp.com node scripts/check-production-health.mjs
 */

const site = process.env.SITE_BASE_URL?.replace(/\/$/, "");
const db = process.env.DATABASE_API_BASE_URL?.replace(/\/$/, "");

if (!site || !db) {
	console.error(
		"Set SITE_BASE_URL and DATABASE_API_BASE_URL (e.g. https://yoursite.netlify.app and https://yourapp.herokuapp.com)"
	);
	process.exit(1);
}

const checks = [
	{ name: "Homepage", url: `${site}/`, expectJsonHealthy: false },
	{ name: "API health (Neo4j ping)", url: `${site}/api/health`, expectJsonHealthy: true },
	{ name: "Database API /health", url: `${db}/health`, expectJsonHealthy: true },
];

function isHealthyJson(text) {
	try {
		const j = JSON.parse(text);
		return j && j.status === "healthy";
	} catch {
		return false;
	}
}

async function run() {
	let failed = 0;
	for (const { name, url, expectJsonHealthy } of checks) {
		try {
			const res = await fetch(url, { method: "GET", redirect: "follow" });
			const text = await res.text();
			const ok = expectJsonHealthy ? res.ok && isHealthyJson(text) : res.ok;
			if (ok) {
				console.log(`OK   ${name} (${res.status}) ${url}`);
			} else {
				console.error(`FAIL ${name} (${res.status}) ${url}`);
				failed += 1;
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error(`FAIL ${name} ${url}: ${msg}`);
			failed += 1;
		}
	}
	process.exit(failed ? 1 : 0);
}

run();
