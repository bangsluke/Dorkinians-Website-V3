import { calculateCurrentSeason, includeCurrentSeason } from "@/lib/utils/leagueSeasonList";

describe("includeCurrentSeason", () => {
	const savedSeasons = ["2025-26", "2024-25", "2023-24"];

	it("adds the configured current season in front of saved seasons", () => {
		expect(includeCurrentSeason(savedSeasons, "2026/27")).toEqual(["2026-27", "2025-26", "2024-25", "2023-24"]);
	});

	it("keeps a saved season that is already the current season", () => {
		expect(includeCurrentSeason(["2026-27", "2025-26"], "2026/27")).toEqual(["2026-27", "2025-26"]);
	});

	it("returns saved seasons when the current season is missing", () => {
		expect(includeCurrentSeason(savedSeasons, null)).toEqual(savedSeasons);
	});
});

describe("calculateCurrentSeason", () => {
	it("uses the previous season before August", () => {
		expect(calculateCurrentSeason(new Date(2026, 6, 31))).toBe("2025/26");
	});

	it("uses the new season from 1 August", () => {
		expect(calculateCurrentSeason(new Date(2026, 7, 1))).toBe("2026/27");
	});
});
