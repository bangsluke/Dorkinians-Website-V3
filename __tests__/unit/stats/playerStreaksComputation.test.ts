import { computeLiveStreakPayload, normalizePlayerMatches } from "@/lib/stats/playerStreaksComputation";

describe("playerStreaksComputation", () => {
	it("dedupes by fixtureId+season and sorts by date", () => {
		const raw = [
			{
				season: "2023/24",
				date: "2024-01-01",
				goals: 1,
				penaltiesScored: 0,
				assists: 0,
				cleanSheets: 0,
				class: "FWD",
				minutes: 90,
				started: true,
				mom: 0,
				yellowCards: 0,
				redCards: 0,
				fixtureResult: "W",
				fixtureId: "fx1",
			},
			{
				season: "2023/24",
				date: "2024-01-01",
				goals: 0,
				penaltiesScored: 0,
				assists: 0,
				cleanSheets: 0,
				class: "FWD",
				minutes: 90,
				started: true,
				mom: 0,
				yellowCards: 0,
				redCards: 0,
				fixtureResult: "W",
				fixtureId: "fx1",
			},
		];
		const norm = normalizePlayerMatches(raw);
		expect(norm).toHaveLength(1);
	});

	it("computes scoring streak current and longest", () => {
		const matches = [
			{
				season: "2023/24",
				date: "2024-01-01",
				goals: 1,
				penaltiesScored: 0,
				assists: 0,
				cleanSheets: 0,
				class: "FWD",
				minutes: 90,
				started: true,
				mom: 0,
				yellowCards: 0,
				redCards: 0,
				fixtureResult: "W",
				fixtureId: "a",
			},
			{
				season: "2023/24",
				date: "2024-01-08",
				goals: 1,
				penaltiesScored: 0,
				assists: 0,
				cleanSheets: 0,
				class: "FWD",
				minutes: 90,
				started: true,
				mom: 0,
				yellowCards: 0,
				redCards: 0,
				fixtureResult: "W",
				fixtureId: "b",
			},
			{
				season: "2023/24",
				date: "2024-01-15",
				goals: 0,
				penaltiesScored: 0,
				assists: 0,
				cleanSheets: 0,
				class: "FWD",
				minutes: 90,
				started: true,
				mom: 0,
				yellowCards: 0,
				redCards: 0,
				fixtureResult: "D",
				fixtureId: "c",
			},
			{
				season: "2023/24",
				date: "2024-01-22",
				goals: 1,
				penaltiesScored: 0,
				assists: 0,
				cleanSheets: 0,
				class: "FWD",
				minutes: 90,
				started: true,
				mom: 0,
				yellowCards: 0,
				redCards: 0,
				fixtureResult: "W",
				fixtureId: "d",
			},
		];
		const p = computeLiveStreakPayload(matches, []);
		expect(p.currentScoringStreak).toBe(1);
		expect(p.allTimeBestScoringStreak).toBe(2);
		expect(p.seasonBestScoringStreak).toBe(2);
		expect(p.allTimeBestAssistStreak).toBeGreaterThanOrEqual(0);
		expect(p.seasonBestGoalInvolvementStreak).toBeGreaterThanOrEqual(0);
	});
});
