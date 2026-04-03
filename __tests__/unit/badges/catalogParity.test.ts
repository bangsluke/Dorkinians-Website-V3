import path from "path";
import { BADGE_DEFINITIONS as WEB_BADGE_DEFINITIONS } from "@/lib/badges/catalog";

const { BADGE_DEFINITIONS: DB_BADGE_DEFINITIONS } = require(path.resolve(
	process.cwd(),
	"../database-dorkinians/services/badgeDefinitions.js",
));

const TIERS = ["bronze", "silver", "gold", "diamond"] as const;

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
