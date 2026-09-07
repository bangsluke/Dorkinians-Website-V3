/**
 * Google Sheets WEEKNUM(date, 2) equivalent.
 * Mode 2: week starts Monday; week 1 is the week containing 1 January.
 */

export type ParsedSeasonWeek = {
	season: string;
	week: number;
	key: string;
	calendarYear: number;
};

/** Monday-based week number for a date in its calendar year. */
export function weekNum(date: Date): number {
	const year = date.getFullYear();
	const jan1 = new Date(year, 0, 1);
	const jan1Day = jan1.getDay();
	const jan1MondayBased = jan1Day === 0 ? 6 : jan1Day - 1;
	const daysSinceJan1 = Math.floor((date.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
	return Math.floor((daysSinceJan1 + jan1MondayBased) / 7) + 1;
}

/** Monday of the given calendar week (WEEKNUM mode 2). */
export function getMondayOfWeek(year: number, weekNumber: number): Date {
	const jan1 = new Date(year, 0, 1);
	const jan1Day = jan1.getDay();
	const jan1MondayBased = jan1Day === 0 ? 6 : jan1Day - 1;
	const daysToAdd = (weekNumber - 1) * 7 - jan1MondayBased;
	const monday = new Date(jan1);
	monday.setDate(jan1.getDate() + daysToAdd);
	return monday;
}

/** Saturday of the given calendar week (Monday + 5 days). */
export function getSaturdayOfWeek(year: number, weekNumber: number): Date {
	const saturday = getMondayOfWeek(year, weekNumber);
	saturday.setDate(saturday.getDate() + 5);
	return saturday;
}

export function getWeeksInYear(year: number): number {
	const dec31 = new Date(year, 11, 31);
	return weekNum(dec31) === 53 ? 53 : 52;
}

function parseSeasonStartYear(season: string): number | null {
	const match = season.match(/^(\d{4})[\/\-]/);
	if (!match) return null;
	const year = Number(match[1]);
	return Number.isFinite(year) ? year : null;
}

/**
 * Infer calendar year for a WEEKNUM week within a football season.
 * Weeks 27+ are treated as the season's first calendar year (autumn/winter);
 * weeks 1–26 as the second year (spring). Boundary weeks near 27–39 are heuristic.
 */
export function inferCalendarYearFromSeasonWeek(season: string, weekNumber: number): number | null {
	const startYear = parseSeasonStartYear(season);
	if (startYear == null) return null;
	return weekNumber >= 27 ? startYear : startYear + 1;
}

export function parseSeasonWeek(value: string | null | undefined): ParsedSeasonWeek | null {
	if (value == null) return null;
	const raw = String(value).trim();
	if (!raw) return null;
	const match = raw.match(/^(.+)-(\d+)$/);
	if (!match) return null;
	const season = match[1];
	const week = Number(match[2]);
	if (!season || !Number.isFinite(week) || week <= 0) return null;
	const calendarYear = inferCalendarYearFromSeasonWeek(season, week);
	if (calendarYear == null) return null;
	return { season, week, key: `${season}-${week}`, calendarYear };
}

function parseFixtureDate(fixtureDate: string): Date | null {
	const trimmed = fixtureDate.trim();
	if (!trimmed) return null;
	const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (iso) {
		const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
		return Number.isNaN(d.getTime()) ? null : d;
	}
	const parsed = Date.parse(trimmed);
	if (!Number.isFinite(parsed)) return null;
	const d = new Date(parsed);
	return Number.isNaN(d.getTime()) ? null : d;
}

/** en-GB short date for tooltips, e.g. "Sat 10 Dec 2016". */
export function formatSaturdayDate(date: Date): string {
	return date.toLocaleDateString("en-GB", {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function formatSaturdayForCalendarWeek(year: number, weekNumber: number): string {
	return formatSaturdayDate(getSaturdayOfWeek(year, weekNumber));
}

/**
 * Saturday for a seasonWeek string (e.g. "2016/17-50").
 * When fixtureDate is provided, uses that date's calendar year and WEEKNUM week.
 */
export function formatSaturdayForSeasonWeek(seasonWeek: string | null | undefined, fixtureDate?: string | null): string | null {
	if (fixtureDate) {
		const d = parseFixtureDate(fixtureDate);
		if (d) {
			const year = d.getFullYear();
			const wn = weekNum(d);
			return formatSaturdayForCalendarWeek(year, wn);
		}
	}
	const parsed = parseSeasonWeek(seasonWeek);
	if (!parsed) return null;
	return formatSaturdayForCalendarWeek(parsed.calendarYear, parsed.week);
}

/** Tooltip title line for a week reference. */
export function weekDateTooltipTitle(
	seasonWeek: string | null | undefined,
	fixtureDate?: string | null,
	calendarWeek?: { year: number; weekNumber: number } | null
): string | null {
	if (calendarWeek) {
		return formatSaturdayForCalendarWeek(calendarWeek.year, calendarWeek.weekNumber);
	}
	return formatSaturdayForSeasonWeek(seasonWeek, fixtureDate);
}

/** Month name from week Monday (Thursday reference), for calendar UI. */
export function getMonthNameFromWeekMonday(weekStartDate: Date): string {
	const thursday = new Date(weekStartDate);
	thursday.setDate(weekStartDate.getDate() + 3);
	const monthNames = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];
	return monthNames[thursday.getMonth()];
}
