import { computeTeamStreakPayload } from "@/lib/stats/teamStreaksComputation";

describe("teamStreaksComputation", () => {
	it("computes wins and unbeaten streaks from fixture results", () => {
		const payload = computeTeamStreakPayload([
			{ season: "2024/25", date: "2024-08-01", result: "W", goalsScored: 2, goalsConceded: 0, totalCards: 0 },
			{ season: "2024/25", date: "2024-08-08", result: "D", goalsScored: 1, goalsConceded: 1, totalCards: 0 },
			{ season: "2024/25", date: "2024-08-15", result: "L", goalsScored: 0, goalsConceded: 2, totalCards: 1 },
			{ season: "2024/25", date: "2024-08-22", result: "W", goalsScored: 3, goalsConceded: 1, totalCards: 0 },
		]);

		expect(payload.wins.current).toBe(1);
		expect(payload.wins.allTimeBest).toBe(1);
		expect(payload.unbeaten.current).toBe(1);
		expect(payload.unbeaten.allTimeBest).toBe(2);
	});

	it("computes goals, clean sheets and no-cards streaks", () => {
		const payload = computeTeamStreakPayload([
			{ season: "2024/25", date: "2024-09-01", result: "W", goalsScored: 1, goalsConceded: 0, totalCards: 0 },
			{ season: "2024/25", date: "2024-09-08", result: "W", goalsScored: 2, goalsConceded: 0, totalCards: 0 },
			{ season: "2024/25", date: "2024-09-15", result: "D", goalsScored: 0, goalsConceded: 0, totalCards: 0 },
			{ season: "2024/25", date: "2024-09-22", result: "W", goalsScored: 1, goalsConceded: 2, totalCards: 2 },
		]);

		expect(payload.goalsScored.current).toBe(1);
		expect(payload.goalsScored.allTimeBest).toBe(2);
		expect(payload.cleanSheets.current).toBe(0);
		expect(payload.cleanSheets.allTimeBest).toBe(3);
		expect(payload.noCards.current).toBe(0);
		expect(payload.noCards.allTimeBest).toBe(3);
	});

	it("uses latest season for season-best and returns date ranges", () => {
		const payload = computeTeamStreakPayload([
			{ season: "2023/24", date: "2024-04-01", result: "W", goalsScored: 1, goalsConceded: 0, totalCards: 0 },
			{ season: "2023/24", date: "2024-04-08", result: "W", goalsScored: 1, goalsConceded: 0, totalCards: 0 },
			{ season: "2024/25", date: "2024-08-01", result: "W", goalsScored: 1, goalsConceded: 0, totalCards: 0 },
			{ season: "2024/25", date: "2024-08-08", result: "L", goalsScored: 0, goalsConceded: 1, totalCards: 1 },
		]);

		expect(payload.wins.allTimeBest).toBe(3);
		expect(payload.wins.seasonBest).toBe(1);
		expect(payload.wins.current).toBe(0);
		expect(payload.wins.allTimeBestRange).toEqual({
			startDate: "2024-04-01",
			endDate: "2024-08-01",
		});
	});
});

