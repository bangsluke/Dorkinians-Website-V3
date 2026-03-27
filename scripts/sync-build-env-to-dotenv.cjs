/**
 * Netlify OpenNext copies `.env.production` into the Next server handler bundle, but site env vars
 * are not always injected into that Lambda's process.env (classic functions still see them).
 * During a Netlify build, `DEPLOY_ID` is set and UI env vars are on process.env — write them to
 * `.env.production` so dotenv in `ensurePackageEnvLoaded()` can load them at runtime in /var/task.
 * Does not run locally (no DEPLOY_ID). File is gitignored.
 */
const fs = require("fs");
const path = require("path");

const KEYS = [
	"PROD_NEO4J_URI",
	"PROD_NEO4J_USER",
	"PROD_NEO4J_PASSWORD",
	"SEED_API_KEY",
	"ALLOWED_ORIGIN",
	"SMTP_SERVER",
	"SMTP_PORT",
	"SMTP_USERNAME",
	"SMTP_PASSWORD",
	"SMTP_FROM_EMAIL",
	"SMTP_TO_EMAIL",
	"SMTP_EMAIL_SECURE",
	"NEXT_PUBLIC_UMAMI_SCRIPT_URL",
	"NEXT_PUBLIC_UMAMI_WEBSITE_ID",
	"NEXT_PUBLIC_APP_VERSION",
	"HEROKU_SEEDER_URL",
	"AUTH_SECRET",
	"AUTH_GOOGLE_ID",
	"AUTH_GOOGLE_SECRET",
	"AUTH_URL",
	"NEXTAUTH_URL",
];

function encodeLine(key, value) {
	const s = String(value);
	if (/[\r\n]/.test(s)) {
		console.warn(`[sync-build-env-to-dotenv] Skip ${key}: multiline values not supported`);
		return null;
	}
	return `${key}="${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function main() {
	if (!process.env.DEPLOY_ID) {
		console.log("[sync-build-env-to-dotenv] Skip: DEPLOY_ID unset (not a Netlify build)");
		return;
	}

	const root = path.resolve(__dirname, "..");
	const outPath = path.join(root, ".env.production");
	const lines = [];
	for (const key of KEYS) {
		const raw = process.env[key];
		if (raw === undefined || raw === "") continue;
		const line = encodeLine(key, raw);
		if (line) lines.push(line);
	}

	if (lines.length === 0) {
		console.warn("[sync-build-env-to-dotenv] No matching env keys set; not writing .env.production");
		return;
	}

	fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
	console.log(`[sync-build-env-to-dotenv] Wrote ${lines.length} keys to .env.production for server bundle`);
}

main();
