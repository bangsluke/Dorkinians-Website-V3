import type { RecordingFixture } from "@/lib/utils/recordingsDisplay";
import {
	RECORDING_SEASON_ALL,
	buildRecordingSeasonFilterOptions,
	buildRecordingSeasonOptions,
	filterRecordingsBySeason,
	formatRecordingSeasonOptionLabel,
	recordingSeasonStartYear,
	resolveDefaultRecordingSeason,
} from "@/lib/utils/recordingsDisplay";

function fx(season: string, date: string, opposition = "Opp"): RecordingFixture {
	return {
		fixtureId: `${date}-${opposition}`,
		season,
		result: "W",
		date,
		opposition,
		homeOrAway: "Home",
		goalsScored: 1,
		goalsConceded: 0,
		compType: "League",
		veoLink: "https://example.com",
	};
}

describe("recordingSeasonStartYear", () => {
	it("parses leading year from season labels", () => {
		expect(recordingSeasonStartYear("2025/26")).toBe(2025);
		expect(recordingSeasonStartYear("2025/2026")).toBe(2025);
	});

	it("returns 0 for empty or invalid seasons", () => {
		expect(recordingSeasonStartYear("")).toBe(0);
		expect(recordingSeasonStartYear("unknown")).toBe(0);
	});
});

describe("buildRecordingSeasonOptions", () => {
	it("groups by season with counts, newest first", () => {
		const fixtures = [
			fx("2023/24", "2024-03-01", "A"),
			fx("2025/26", "2025-09-01", "B"),
			fx("2024/25", "2024-10-01", "C"),
			fx("2025/26", "2026-02-01", "D"),
			fx("2024/25", "2025-01-01", "E"),
		];
		expect(buildRecordingSeasonOptions(fixtures)).toEqual([
			{ season: "2025/26", count: 2 },
			{ season: "2024/25", count: 2 },
			{ season: "2023/24", count: 1 },
		]);
	});

	it("ignores fixtures without a season", () => {
		expect(buildRecordingSeasonOptions([fx("", "2026-01-01"), fx("2025/26", "2025-09-01")])).toEqual([
			{ season: "2025/26", count: 1 },
		]);
	});
});

describe("buildRecordingSeasonFilterOptions", () => {
	it("prepends All with total count", () => {
		const fixtures = [
			fx("2025/26", "2025-09-01", "A"),
			fx("2024/25", "2025-01-01", "B"),
			fx("2025/26", "2026-02-01", "C"),
		];
		expect(buildRecordingSeasonFilterOptions(fixtures)).toEqual([
			{ season: RECORDING_SEASON_ALL, count: 3 },
			{ season: "2025/26", count: 2 },
			{ season: "2024/25", count: 1 },
		]);
	});
});

describe("resolveDefaultRecordingSeason", () => {
	const options = [
		{ season: RECORDING_SEASON_ALL, count: 3 },
		{ season: "2025/26", count: 2 },
		{ season: "2024/25", count: 1 },
	];

	it("defaults to current season when present", () => {
		expect(resolveDefaultRecordingSeason(options, "2024/25")).toBe("2024/25");
	});

	it("falls back to newest season when current is missing", () => {
		expect(resolveDefaultRecordingSeason(options, "2023/24")).toBe("2025/26");
		expect(resolveDefaultRecordingSeason(options, null)).toBe("2025/26");
	});
});

describe("filterRecordingsBySeason", () => {
	it("returns only fixtures for the selected season", () => {
		const fixtures = [
			fx("2025/26", "2025-09-01", "A"),
			fx("2024/25", "2025-01-01", "B"),
			fx("2025/26", "2026-02-01", "C"),
		];
		expect(filterRecordingsBySeason(fixtures, "2025/26").map((f) => f.opposition)).toEqual(["A", "C"]);
	});

	it("returns all fixtures for All", () => {
		const fixtures = [
			fx("2025/26", "2025-09-01", "A"),
			fx("2024/25", "2025-01-01", "B"),
		];
		expect(filterRecordingsBySeason(fixtures, RECORDING_SEASON_ALL)).toHaveLength(2);
	});
});

describe("formatRecordingSeasonOptionLabel", () => {
	it("formats season and count", () => {
		expect(formatRecordingSeasonOptionLabel({ season: "2025/26", count: 12 })).toBe("2025/26 (12)");
	});

	it("formats All option", () => {
		expect(formatRecordingSeasonOptionLabel({ season: RECORDING_SEASON_ALL, count: 12 })).toBe("All (12)");
	});
});
