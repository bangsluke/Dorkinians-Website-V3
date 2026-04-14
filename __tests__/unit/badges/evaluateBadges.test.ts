import { evaluateAllBadges, getBadgeProgress } from "@/lib/badges/evaluate";
import type { BadgePlayer } from "@/lib/badges/neo4jProps";

function tierForBadge(player: BadgePlayer, badgeKey: string): string | null {
	const row = evaluateAllBadges(player).find((badge) => badge.badgeKey === badgeKey);
	return row?.tier ?? null;
}

describe("badge threshold evaluation", () => {
	it("awards Club Stalwart gold at 264 appearances", () => {
		expect(tierForBadge({ appearances: 264 }, "club_stalwart")).toBe("gold");
	});

	it("awards Club Stalwart diamond at 300 appearances", () => {
		expect(tierForBadge({ appearances: 300 }, "club_stalwart")).toBe("diamond");
	});

	it("keeps Club Stalwart earned tier and next progress consistent", () => {
		const player = { appearances: 264 };
		const earnedTier = tierForBadge(player, "club_stalwart");
		const progress = getBadgeProgress(player).find((row) => row.badgeKey === "club_stalwart");
		expect(earnedTier).toBe("gold");
		expect(progress).toBeDefined();
		expect(progress?.nextTier).toBe("diamond");
		expect(progress?.targetValue).toBe(300);
		expect(progress?.remaining).toBe(36);
	});

	it("evaluates representative badges across categories", () => {
		const player: BadgePlayer = {
			gkAppearances: 55,
			penaltyShootoutPenaltiesScored: 6,
			minutes: 450,
			assistsPer90: 0.71,
			cleanSheets: 31,
			penaltyShootoutPenaltiesSaved: 8,
			weekdayGames: 16,
		};

		expect(tierForBadge(player, "goalkeeper_appearances")).toBe("silver");
		expect(tierForBadge(player, "shootout_scorer")).toBe("gold");
		expect(tierForBadge(player, "playmaker")).toBe("diamond");
		expect(tierForBadge(player, "clean_sheet_king")).toBe("gold");
		expect(tierForBadge(player, "shootout_penalty_saver")).toBe("diamond");
		expect(tierForBadge(player, "weekday_warrior")).toBe("gold");
	});

	it("uses winner-only POTM counts", () => {
		const player: BadgePlayer = { potmCount: 10, potmWinnerCount: 1 };
		expect(tierForBadge(player, "potm_winner")).toBe("bronze");
	});

	it("uses peak form for On Fire", () => {
		const player: BadgePlayer = { formCurrent: 7.6, formPeak: 9.1 };
		expect(tierForBadge(player, "on_fire")).toBe("diamond");
	});

	it("uses current streak when all-time appearance streak is missing", () => {
		const player: BadgePlayer = { currentAppearanceStreak: 16 };
		expect(tierForBadge(player, "ever_present")).toBe("silver");
	});

	it("awards Nullifier tiers from defender conceded-per-game thresholds", () => {
		expect(tierForBadge({ defAppearances: 9, defConceded: 0 }, "nullifier")).toBeNull();
		expect(tierForBadge({ defAppearances: 10, defConceded: 19 }, "nullifier")).toBe("bronze");
		expect(tierForBadge({ defAppearances: 10, defConceded: 16.9 }, "nullifier")).toBe("silver");
		expect(tierForBadge({ defAppearances: 10, defConceded: 12.9 }, "nullifier")).toBe("gold");
		expect(tierForBadge({ defAppearances: 10, defConceded: 9.9 }, "nullifier")).toBe("diamond");
		expect(tierForBadge({ defAppearances: 10, defConceded: 20 }, "nullifier")).toBeNull();
	});

	it("awards Goalkeeper Nullifier tiers from keeper conceded-per-game thresholds", () => {
		expect(tierForBadge({ gkAppearances: 9, gkConceded: 0 }, "goalkeeper_nullifier")).toBeNull();
		expect(tierForBadge({ gkAppearances: 10, gkConceded: 19 }, "goalkeeper_nullifier")).toBe("bronze");
		expect(tierForBadge({ gkAppearances: 10, gkConceded: 16.9 }, "goalkeeper_nullifier")).toBe("silver");
		expect(tierForBadge({ gkAppearances: 10, gkConceded: 12.9 }, "goalkeeper_nullifier")).toBe("gold");
		expect(tierForBadge({ gkAppearances: 10, gkConceded: 9.9 }, "goalkeeper_nullifier")).toBe("diamond");
		expect(tierForBadge({ gkAppearances: 10, gkConceded: 20 }, "goalkeeper_nullifier")).toBeNull();
	});

	it("counts Double Provider from games with 2+ assists", () => {
		const player: BadgePlayer = { maxAssistsInGame: 5, assistGames2Plus: 3 };
		expect(tierForBadge(player, "double_provider")).toBe("silver");
	});

	it("counts Mr Versitile from class-derived appearance fields", () => {
		const player: BadgePlayer = { gkAppearances: 2, defAppearances: 6, midAppearances: 3, fwdAppearances: 0 };
		expect(tierForBadge(player, "mr_versitile")).toBe("gold");
	});

	it("uses all-time full match peak for Full-90 Engine", () => {
		const player: BadgePlayer = { currentFullMatchStreak: 2, allTimeBestFullMatchStreak: 9 };
		expect(tierForBadge(player, "full_90_engine")).toBe("gold");
	});

	it("uses weekly multi-game counts for Weekend Warrior", () => {
		const player: BadgePlayer = { weeksWithMultiGames: 10 };
		expect(tierForBadge(player, "weekend_warrior")).toBe("diamond");
	});

	it("uses clean season count rather than discipline streak", () => {
		const player: BadgePlayer = {
			seasonBestDisciplineStreak: 40,
			maxAppsInSeason: 40,
			cleanSeasonCount: 2,
		};
		expect(tierForBadge(player, "clean_season")).toBe("silver");
	});
});
