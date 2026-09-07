import {
	formatSaturdayForCalendarWeek,
	formatSaturdayForSeasonWeek,
	getSaturdayOfWeek,
	inferCalendarYearFromSeasonWeek,
	parseSeasonWeek,
	weekNum,
} from "@/lib/utils/weekNumDates";

describe("weekNum", () => {
	it("matches WEEKNUM mode 2 for Sep 2016 fixture week", () => {
		expect(weekNum(new Date(2016, 8, 10))).toBe(37);
	});
});

describe("inferCalendarYearFromSeasonWeek", () => {
	it("uses first calendar year for autumn weeks", () => {
		expect(inferCalendarYearFromSeasonWeek("2016/17", 37)).toBe(2016);
		expect(inferCalendarYearFromSeasonWeek("2016/17", 50)).toBe(2016);
	});

	it("uses second calendar year for spring weeks", () => {
		expect(inferCalendarYearFromSeasonWeek("2023/24", 10)).toBe(2024);
	});
});

describe("formatSaturdayForSeasonWeek", () => {
	it("formats 2016/17 week 37 near 10 Sep 2016", () => {
		const label = formatSaturdayForSeasonWeek("2016/17-37");
		expect(label).toMatch(/Sept? 2016/);
		expect(label).toMatch(/^Sat/);
	});

	it("formats 2016/17 week 50 in December 2016", () => {
		const label = formatSaturdayForSeasonWeek("2016/17-50");
		expect(label).toMatch(/Dec 2016/);
		const sat = getSaturdayOfWeek(2016, 50);
		expect(sat.getDate()).toBe(10);
		expect(sat.getMonth()).toBe(11);
	});

	it("formats 2023/24 week 3 in January 2024 (spring calendar weeks)", () => {
		const label = formatSaturdayForSeasonWeek("2023/24-3");
		expect(label).toMatch(/2024/);
		expect(label).toMatch(/Jan/);
	});

	it("prefers fixture date when provided", () => {
		const fromFixture = formatSaturdayForSeasonWeek("2016/17-50", "2016-12-10");
		expect(fromFixture).toMatch(/10 Dec 2016/);
	});
});

describe("formatSaturdayForCalendarWeek", () => {
	it("returns Sat-prefixed en-GB string", () => {
		expect(formatSaturdayForCalendarWeek(2016, 50)).toMatch(/^Sat,?\s+10 Dec 2016$/);
	});
});

describe("parseSeasonWeek", () => {
	it("parses season week key and calendar year", () => {
		expect(parseSeasonWeek("2016/17-50")).toEqual({
			season: "2016/17",
			week: 50,
			key: "2016/17-50",
			calendarYear: 2016,
		});
	});

	it("returns null for invalid input", () => {
		expect(parseSeasonWeek("")).toBeNull();
		expect(parseSeasonWeek("invalid")).toBeNull();
	});
});
