import fs from "fs";
import path from "path";

let packageEnvLoaded = false;

const PACKAGE_NAME = "dorkinians-website-v3";

/**
 * Resolves the app root for `.env` loading. Build workers may not inherit
 * `DORKINIANS_WEBSITE_ROOT`; `process.cwd()` may be a parent folder (e.g. monorepo or IDE).
 * Walk upward from cwd until we find this app's `next.config.js` + `package.json`.
 */
function tryResolveRootAt(dir: string): string | null {
	const nextCfg = path.join(dir, "next.config.js");
	const pkgPath = path.join(dir, "package.json");
	if (!fs.existsSync(nextCfg) || !fs.existsSync(pkgPath)) {
		return null;
	}
	try {
		const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { name?: string };
		return pkg.name === PACKAGE_NAME ? dir : null;
	} catch {
		return null;
	}
}

function resolveAppRoot(): string {
	const fromEnv = process.env.DORKINIANS_WEBSITE_ROOT;
	if (fromEnv) {
		const abs = path.resolve(fromEnv);
		if (fs.existsSync(path.join(abs, "next.config.js"))) {
			return abs;
		}
	}

	const cwd = path.resolve(process.cwd());
	const atCwd = tryResolveRootAt(cwd);
	if (atCwd) {
		return atCwd;
	}

	// e.g. cwd is repo root `Dorkinians/` while the Next app lives in `V3-Dorkinians-Website/`
	try {
		for (const ent of fs.readdirSync(cwd, { withFileTypes: true })) {
			if (!ent.isDirectory()) continue;
			const sub = tryResolveRootAt(path.join(cwd, ent.name));
			if (sub) {
				return sub;
			}
		}
	} catch {
		/* ignore */
	}

	let dir = cwd;
	const seen = new Set<string>();
	for (let i = 0; i < 40; i++) {
		if (seen.has(dir)) break;
		seen.add(dir);
		const hit = tryResolveRootAt(dir);
		if (hit) {
			return hit;
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	return fromEnv ? path.resolve(fromEnv) : cwd;
}

/**
 * Applies `.env*` from the app directory with override. `next.config.js` only runs in the
 * main Next process; `next build` workers can still see a stale `SEED_API_KEY` from the OS
 * shell unless we reload from the files next to `next.config.js`.
 */
export function ensurePackageEnvLoaded(): void {
	if (packageEnvLoaded || typeof window !== "undefined") {
		return;
	}
	packageEnvLoaded = true;

	const root = resolveAppRoot();

	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports -- avoid bundling dotenv as ESM edge
		const dotenv = require("dotenv") as typeof import("dotenv");
		const load = (filename: string) => {
			const full = path.join(root, filename);
			if (fs.existsSync(full)) {
				dotenv.config({ path: full, override: true, quiet: true });
			}
		};
		load(".env");
		load(".env.local");
		if (process.env.NODE_ENV === "production") {
			load(".env.production");
			load(".env.production.local");
		} else {
			load(".env.development");
			load(".env.development.local");
		}
	} catch {
		// dotenv is a required dependency; ignore unexpected load errors
	}
}
