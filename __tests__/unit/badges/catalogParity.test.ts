import fs from "fs";
import path from "path";
import { BADGE_DEFINITIONS as WEB_BADGE_DEFINITIONS } from "@/lib/badges/catalog";

const TIERS = ["bronze", "silver", "gold", "diamond"] as const;

/** Local monorepo: ../database-dorkinians; CI optional checkout: ./database-dorkinians */
function resolveBadgeDefinitionsPath(): string | null {
	const candidates = [
		path.resolve(process.cwd(), "../database-dorkinians/services/badgeDefinitions.js"),
		path.resolve(process.cwd(), "database-dorkinians/services/badgeDefinitions.js"),
	];
	return candidates.find((p) => fs.existsSync(p)) ?? null;
}

const dbBadgeDefinitionsPath = resolveBadgeDefinitionsPath();

if (!dbBadgeDefinitionsPath) {
	describe.skip("badge definition parity", () => {
		it("requires sibling database-dorkinians (../ or ./database-dorkinians)", () => {
			expect(true).toBe(true);
		});
	});
} else {
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- shared CommonJS module from sibling repo
	const { BADGE_DEFINITIONS: DB_BADGE_DEFINITIONS } = require(dbBadgeDefinitionsPath) as {
		BADGE_DEFINITIONS: Record<string, { tiers?: Record<string, { threshold?: number | null } | undefined> }>;
	};

	describe("badge definition parity", () => {
		it("keeps DB and website badge keys aligned", () => {
			const webKeys = Object.keys(WEB_BADGE_DEFINITIONS).sort();
			const dbKeys = Object.keys(DB_BADGE_DEFINITIONS).sort();
			expect(dbKeys).toEqual(webKeys);
		});

		it("keeps tier thresholds aligned for every badge", () => {
			for (const [badgeKey, webDef] of Object.entries(WEB_BADGE_DEFINITIONS)) {
				const dbDef = DB_BADGE_DEFINITIONS[badgeKey];
				expect(dbDef).toBeDefined();

				for (const tier of TIERS) {
					const webThreshold = webDef.tiers[tier]?.threshold ?? null;
					const dbThreshold = dbDef.tiers?.[tier]?.threshold ?? null;
					expect(dbThreshold).toBe(webThreshold);
				}
			}
		});
	});
}
