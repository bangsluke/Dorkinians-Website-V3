import { calculateMatchRatingFromDetail, buildMatchRatingBreakdown } from "@/lib/utils/matchRatingBreakdown";

describe("matchRatingBreakdown (mirrors database-dorkinians calculateMatchRating)", () => {
	it("forward 2 goals 90m → 8.9", () => {
		expect(
			calculateMatchRatingFromDetail({
				class: "FWD",
				minutes: 90,
				goals: 2,
				assists: 0,
				mom: 0,
				cleanSheets: 0,
				saves: 0,
				yellowCards: 0,
				redCards: 0,
				ownGoals: 0,
				conceded: 0,
				penaltiesMissed: 0,
				penaltiesSaved: 0,
			})
		).toBe(8.9);
	});

	it("forward 1 penalty scored (no open-play goals) 90m → 7.7 (same as 1 open-play goal)", () => {
		expect(
			calculateMatchRatingFromDetail({
				class: "FWD",
				minutes: 90,
				goals: 0,
				assists: 0,
				mom: 0,
				cleanSheets: 0,
				saves: 0,
				yellowCards: 0,
				redCards: 0,
				ownGoals: 0,
				conceded: 0,
				penaltiesScored: 1,
				penaltiesMissed: 0,
				penaltiesSaved: 0,
			})
		).toBe(7.7);
	});

	it("buildMatchRatingBreakdown final matches calculateMatchRatingFromDetail", () => {
		const detail = {
			class: "MID",
			minutes: 90,
			goals: 1,
			assists: 1,
			mom: 1,
			cleanSheets: 0,
			saves: 0,
			yellowCards: 0,
			redCards: 0,
			ownGoals: 0,
			conceded: 0,
			penaltiesMissed: 0,
			penaltiesSaved: 0,
		};
		const { final } = buildMatchRatingBreakdown(detail);
		expect(final).toBe(calculateMatchRatingFromDetail(detail));
		expect(final).toBe(10.0);
	});

	it("buildMatchRatingBreakdown includes penalty scored in Goals line", () => {
		const detail = {
			class: "FWD",
			minutes: 90,
			goals: 1,
			assists: 0,
			mom: 0,
			cleanSheets: 0,
			saves: 0,
			yellowCards: 0,
			redCards: 0,
			ownGoals: 0,
			conceded: 0,
			penaltiesScored: 1,
			penaltiesMissed: 0,
			penaltiesSaved: 0,
		};
		const { lines, final } = buildMatchRatingBreakdown(detail);
		expect(final).toBe(8.9);
		expect(lines.some((l) => l.label.includes("Goals") && l.label.includes("(2)"))).toBe(true);
	});
});
