import { featureFlagPresets } from "@/config/config";

/** User features that were production-gated until Wave 5B. Umami stays off and is not in this list. */
const ROLLED_OUT_USER_FLAGS = [
	"playerStatsKeyPerformance",
	"playerStatsForm",
	"playerStatsStreaks",
	"playerStatsStartingImpact",
	"playerStatsPartnerships",
	"playerStatsImpact",
	"playerStatsPlayerRecordings",
	"playerStatsDataTablePer90",
	"teamStatsFormationsUsed",
	"teamStatsTeamRecordings",
	"teamStatsStreakAndForm",
	"teamStatsXiStreakCards",
	"clubStatsLongestActiveStreaks",
	"clubStatsClubRecordings",
	"clubStatsTopPartnerships",
	"clubInfoRecords",
	"leagueInfoLatestResult",
	"statsTopPlayersShowAll",
] as const;

describe("production feature flag presets", () => {
	it("turns all rolled-out user features on in the develop preset and keeps umami off", () => {
		const develop = featureFlagPresets.develop;
		for (const key of ROLLED_OUT_USER_FLAGS) {
			expect(develop[key]).toBe(true);
		}
		expect(develop.umamiAnalytics).toBe(false);
	});

	it("turns all rolled-out user features on in the production preset and keeps umami off", () => {
		const production = featureFlagPresets.production;
		for (const key of ROLLED_OUT_USER_FLAGS) {
			expect(production[key]).toBe(true);
		}
		expect(production.umamiAnalytics).toBe(false);
	});
});
