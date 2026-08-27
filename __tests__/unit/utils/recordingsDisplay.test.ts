import type { RecordingFixture } from "@/lib/utils/recordingsDisplay";
import {
	buildRecordingYearOptions,
	filterRecordingsByYear,
	formatRecordingYearOptionLabel,
	recordingCalendarYear,
} from "@/lib/utils/recordingsDisplay";

function fx(date: string, opposition = "Opp"): RecordingFixture {
	return {
		fixtureId: `${date}-${opposition}`,
		season: "2025/2026",
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

describe("recordingCalendarYear", () => {
	it("parses ISO YYYY prefix without timezone shift", () => {
		expect(recordingCalendarYear("2026-01-01")).toBe(2026);
		expect(recordingCalendarYear("2025-12-31T23:00:00.000Z")).toBe(2025);
	});

	it("returns null for empty or invalid dates", () => {
		expect(recordingCalendarYear("")).toBeNull();
		expect(recordingCalendarYear("not-a-date")).toBeNull();
	});
});

describe("buildRecordingYearOptions", () => {
	it("groups by calendar year with counts, newest first", () => {
		const fixtures = [
			fx("2024-03-01", "A"),
			fx("2026-01-10", "B"),
			fx("2025-08-01", "C"),
			fx("2026-02-01", "D"),
			fx("2025-09-01", "E"),
		];
		expect(buildRecordingYearOptions(fixtures)).toEqual([
			{ year: 2026, count: 2 },
			{ year: 2025, count: 2 },
			{ year: 2024, count: 1 },
		]);
	});

	it("ignores fixtures without a parseable year", () => {
		expect(buildRecordingYearOptions([fx(""), fx("2026-01-01")])).toEqual([{ year: 2026, count: 1 }]);
	});
});

describe("filterRecordingsByYear", () => {
	it("returns only fixtures for the selected calendar year", () => {
		const fixtures = [fx("2026-01-01", "A"), fx("2025-06-01", "B"), fx("2026-11-01", "C")];
		expect(filterRecordingsByYear(fixtures, 2026).map((f) => f.opposition)).toEqual(["A", "C"]);
	});
});

describe("formatRecordingYearOptionLabel", () => {
	it("formats year and count", () => {
		expect(formatRecordingYearOptionLabel({ year: 2026, count: 12 })).toBe("2026 (12)");
	});
});
