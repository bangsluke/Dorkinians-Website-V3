export type TeamFixtureStreakRow = {
	season: string;
	date: unknown;
	result: string;
	goalsScored: number;
	goalsConceded: number;
	totalCards: number;
};

export type StreakDateRange = {
	startDate: string | null;
	endDate: string | null;
};

export type TeamStreakMetric = {
	current: number;
	seasonBest: number;
	allTimeBest: number;
	currentRange: StreakDateRange;
	seasonBestRange: StreakDateRange;
	allTimeBestRange: StreakDateRange;
};

export type TeamStreakPayload = {
	wins: TeamStreakMetric;
	unbeaten: TeamStreakMetric;
	goalsScored: TeamStreakMetric;
	cleanSheets: TeamStreakMetric;
	noCards: TeamStreakMetric;
};

function toNum(v: unknown): number {
	if (v === null || v === undefined) return 0;
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}

function dateToMillis(dateVal: unknown): number {
	if (dateVal === null || dateVal === undefined) return 0;
	if (typeof dateVal === "string") {
		const t = Date.parse(dateVal);
		return Number.isFinite(t) ? t : 0;
	}
	if (typeof dateVal === "object" && dateVal !== null && "year" in dateVal && "month" in dateVal && "day" in dateVal) {
		const o = dateVal as { year: unknown; month: unknown; day: unknown };
		return new Date(toNum(o.year), toNum(o.month) - 1, toNum(o.day)).getTime();
	}
	if (dateVal instanceof Date) return dateVal.getTime();
	return 0;
}

function dateToIso(dateVal: unknown): string | null {
	const ms = dateToMillis(dateVal);
	if (!ms) return null;
	return new Date(ms).toISOString().slice(0, 10);
}

function compareSeasonKeys(a: string, b: string): number {
	const pa = String(a || "").split("/");
	const pb = String(b || "").split("/");
	const ya = toNum(pa[0]);
	const yb = toNum(pb[0]);
	if (ya !== yb) return ya - yb;
	return String(a).localeCompare(String(b));
}

function pickLatestSeason(rows: Array<{ season: string }>): string | null {
	if (!rows.length) return null;
	return rows[rows.length - 1].season;
}

function normalizeFixtures(rawRows: TeamFixtureStreakRow[]): Array<TeamFixtureStreakRow & { dateMs: number; dateIso: string | null }> {
	const rows = (rawRows || [])
		.map((r) => ({
			season: String(r.season || ""),
			date: r.date,
			dateMs: dateToMillis(r.date),
			dateIso: dateToIso(r.date),
			result: String(r.result || "").toUpperCase(),
			goalsScored: toNum(r.goalsScored),
			goalsConceded: toNum(r.goalsConceded),
			totalCards: toNum(r.totalCards),
		}))
		.filter((r) => r.season && r.dateMs > 0);

	rows.sort((a, b) => {
		if (a.dateMs !== b.dateMs) return a.dateMs - b.dateMs;
		return compareSeasonKeys(a.season, b.season);
	});
	return rows;
}

function computeRun<T extends { dateIso: string | null }>(
	rows: T[],
	condition: (row: T) => boolean
): { current: number; longest: number; currentRange: StreakDateRange; longestRange: StreakDateRange } {
	let current = 0;
	let longest = 0;
	let currentStart: string | null = null;
	let currentEnd: string | null = null;
	let longestStart: string | null = null;
	let longestEnd: string | null = null;

	for (const row of rows) {
		if (condition(row)) {
			if (current === 0) currentStart = row.dateIso;
			current += 1;
			currentEnd = row.dateIso;
			if (current > longest) {
				longest = current;
				longestStart = currentStart;
				longestEnd = currentEnd;
			}
			continue;
		}
		current = 0;
		currentStart = null;
		currentEnd = null;
	}

	return {
		current,
		longest,
		currentRange: { startDate: currentStart, endDate: currentEnd },
		longestRange: { startDate: longestStart, endDate: longestEnd },
	};
}

function toMetric<T extends { season: string; dateIso: string | null }>(
	allRows: T[],
	condition: (row: T) => boolean
): TeamStreakMetric {
	const latestSeason = pickLatestSeason(allRows);
	const seasonRows = latestSeason ? allRows.filter((r) => r.season === latestSeason) : [];
	const allRuns = computeRun(allRows, condition);
	const seasonRuns = computeRun(seasonRows, condition);
	return {
		current: allRuns.current,
		seasonBest: seasonRuns.longest,
		allTimeBest: allRuns.longest,
		currentRange: allRuns.currentRange,
		seasonBestRange: seasonRuns.longestRange,
		allTimeBestRange: allRuns.longestRange,
	};
}

export function computeTeamStreakPayload(rawRows: TeamFixtureStreakRow[]): TeamStreakPayload {
	const rows = normalizeFixtures(rawRows);
	return {
		wins: toMetric(rows, (r) => r.result === "W"),
		unbeaten: toMetric(rows, (r) => r.result !== "L"),
		goalsScored: toMetric(rows, (r) => toNum(r.goalsScored) >= 1),
		cleanSheets: toMetric(rows, (r) => toNum(r.goalsConceded) === 0),
		noCards: toMetric(rows, (r) => toNum(r.totalCards) === 0),
	};
}

