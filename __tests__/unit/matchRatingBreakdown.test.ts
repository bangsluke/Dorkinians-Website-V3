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
});
