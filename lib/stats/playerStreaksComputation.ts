/**
 * Live streak computation for Player Stats (aligned with database-dorkinians/services/streakDetection.js).
 * Pure functions - callers supply match rows and appearance slots from Neo4j (optionally filtered).
 */

export type NormalizedMatch = {
	season: string;
	date: unknown;
	dateMs: number;
	goals: number;
	penaltiesScored: number;
	assists: number;
	cleanSheets: number;
	class: string;
	minutes: number;
	started: boolean;
	mom: number;
	yellowCards: number;
	redCards: number;
	fixtureResult: string;
	fixtureId: string;
};

function toNum(v: unknown): number {
	if (v === null || v === undefined) return 0;
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}

function normalizeClass(cls: unknown): string {
	if (cls === null || cls === undefined) return "";
	return String(cls).toUpperCase().trim();
}

export function dateToMillis(dateVal: unknown): number {
	if (dateVal === null || dateVal === undefined) return 0;
	if (typeof dateVal === "string") {
		const t = Date.parse(dateVal);
		return Number.isFinite(t) ? t : 0;
	}
	if (typeof dateVal === "object" && dateVal !== null && "year" in dateVal && "month" in dateVal && "day" in dateVal) {
		const o = dateVal as { year: unknown; month: unknown; day: unknown };
		const y = toNum(o.year);
		const m = toNum(o.month);
		const d = toNum(o.day);
		return new Date(y, m - 1, d).getTime();
	}
	if (dateVal instanceof Date) return dateVal.getTime();
	return 0;
}

function compareSeasonKeys(a: string, b: string): number {
	const pa = String(a || "").split("/");
	const pb = String(b || "").split("/");
	const ya = toNum(pa[0]);
	const yb = toNum(pb[0]);
	if (ya !== yb) return ya - yb;
	return String(a).localeCompare(String(b));
}

export function detectStreaks<T>(itemsOrdered: T[], conditionFn: (item: T) => boolean | null): { current: number; longest: number } {
	let current = 0;
	let longest = 0;
	if (!itemsOrdered || itemsOrdered.length === 0) {
		return { current: 0, longest: 0 };
	}
	for (const item of itemsOrdered) {
		const r = conditionFn(item);
		if (r === null) continue;
		if (r) {
			current += 1;
			longest = Math.max(longest, current);
		} else {
			current = 0;
		}
	}
	return { current, longest };
}

export function detectAppearanceStreak(slotsOrdered: { minutes: number | null }[]): { current: number; longest: number } {
	let current = 0;
	let longest = 0;
	if (!slotsOrdered || slotsOrdered.length === 0) {
		return { current: 0, longest: 0 };
	}
	for (const s of slotsOrdered) {
		if (s.minutes === null || s.minutes === undefined) {
			current = 0;
			continue;
		}
		if (s.minutes > 0) {
			current += 1;
			longest = Math.max(longest, current);
		} else {
			current = 0;
		}
	}
	return { current, longest };
}

export function normalizePlayerMatches(rawMatches: unknown[]): NormalizedMatch[] {
	const rows = (rawMatches || [])
		.filter((m): m is Record<string, unknown> => !!m && m != null && (m as Record<string, unknown>).season != null && (m as Record<string, unknown>).date != null)
		.map((m) => {
			const r = m as Record<string, unknown>;
			return {
				season: String(r.season),
				date: r.date,
				dateMs: dateToMillis(r.date),
				goals: toNum(r.goals),
				penaltiesScored: toNum(r.penaltiesScored),
				assists: toNum(r.assists),
				cleanSheets: toNum(r.cleanSheets),
				class: String(r.class ?? ""),
				minutes: toNum(r.minutes),
				started: r.started === true,
				mom: toNum(r.mom),
				yellowCards: toNum(r.yellowCards),
				redCards: toNum(r.redCards),
				fixtureResult: r.fixtureResult != null ? String(r.fixtureResult).toUpperCase() : "",
				fixtureId: r.fixtureId != null ? String(r.fixtureId) : "",
			};
		});
	rows.sort((a, b) => {
		if (a.dateMs !== b.dateMs) return a.dateMs - b.dateMs;
		return compareSeasonKeys(a.season, b.season);
	});
	const seen = new Set<string>();
	const out: NormalizedMatch[] = [];
	for (const r of rows) {
		const key = `${r.fixtureId}::${r.season}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(r);
	}
	return out;
}

function conditionScoring(m: NormalizedMatch) {
	return toNum(m.goals) + toNum(m.penaltiesScored) >= 1;
}

function conditionAssists(m: NormalizedMatch) {
	return toNum(m.assists) >= 1;
}

function conditionGoalInvolvement(m: NormalizedMatch) {
	return conditionScoring(m) || conditionAssists(m);
}

function conditionCleanSheet(m: NormalizedMatch): boolean | null {
	if (toNum(m.minutes) <= 0) return null;
	const c = normalizeClass(m.class);
	if (c !== "GK" && c !== "DEF") return null;
	return toNum(m.cleanSheets) >= 1;
}

function conditionStart(m: NormalizedMatch) {
	return m.started === true;
}

function conditionFullMatch(m: NormalizedMatch) {
	return toNum(m.minutes) >= 85;
}

function conditionMom(m: NormalizedMatch) {
	return toNum(m.mom) >= 1;
}

function conditionDiscipline(m: NormalizedMatch): boolean | null {
	if (toNum(m.minutes) <= 0) return null;
	return toNum(m.yellowCards) === 0 && toNum(m.redCards) === 0;
}

function conditionWin(m: NormalizedMatch) {
	return m.fixtureResult === "W";
}

export function pickLatestSeason(matches: Pick<NormalizedMatch, "season" | "dateMs">[]): string | null {
	if (!matches.length) return null;
	let best = matches[0];
	for (const m of matches) {
		if (m.dateMs > best.dateMs) best = m;
	}
	return best.season;
}

export type AppearanceNormalized = { season: string; minutes: number | null };

export function normalizeAppearanceSlots(rawSlots: unknown[], latestSeason: string | null): {
	current: number;
	longest: number;
	slotsForLatestSeason: AppearanceNormalized[];
} {
	const slots: AppearanceNormalized[] = (rawSlots || []).map((s) => {
		const r = s as Record<string, unknown>;
		return {
			season: r.season != null ? String(r.season) : "",
			minutes: r.minutes === null || r.minutes === undefined ? null : toNum(r.minutes),
		};
	});
	const { current, longest } = detectAppearanceStreak(slots);
	const slotsForLatestSeason = latestSeason ? slots.filter((x) => x.season === latestSeason) : [];
	return { current, longest, slotsForLatestSeason };
}

/** All streak fields used by Player Stats UI (live / filter-scoped). */
export type LiveStreakPayload = {
	currentScoringStreak: number;
	currentAssistStreak: number;
	currentGoalInvolvementStreak: number;
	currentCleanSheetStreak: number;
	currentAppearanceStreak: number;
	currentStartStreak: number;
	currentFullMatchStreak: number;
	currentMomStreak: number;
	currentDisciplineStreak: number;
	currentWinStreak: number;
	seasonBestScoringStreak: number;
	seasonBestAssistStreak: number;
	seasonBestGoalInvolvementStreak: number;
	seasonBestCleanSheetStreak: number;
	seasonBestAppearanceStreak: number;
	seasonBestStartStreak: number;
	seasonBestFullMatchStreak: number;
	seasonBestMomStreak: number;
	seasonBestDisciplineStreak: number;
	seasonBestWinStreak: number;
	allTimeBestScoringStreak: number;
	allTimeBestAssistStreak: number;
	allTimeBestGoalInvolvementStreak: number;
	allTimeBestCleanSheetStreak: number;
	allTimeBestAppearanceStreak: number;
	allTimeBestStartStreak: number;
	allTimeBestFullMatchStreak: number;
	allTimeBestMomStreak: number;
	allTimeBestDisciplineStreak: number;
	allTimeBestWinStreak: number;
};

export function computeLiveStreakPayload(rawMatches: unknown[], rawAppearanceSlots: unknown[] | null): LiveStreakPayload {
	const matchesOrdered = normalizePlayerMatches(Array.isArray(rawMatches) ? rawMatches : []);
	const latestSeason = pickLatestSeason(matchesOrdered);
	const appearance = normalizeAppearanceSlots(Array.isArray(rawAppearanceSlots) ? rawAppearanceSlots : [], latestSeason);
	const inLatest = latestSeason ? matchesOrdered.filter((m) => m.season === latestSeason) : [];

	const scoringAll = detectStreaks(matchesOrdered, conditionScoring);
	const assistAll = detectStreaks(matchesOrdered, conditionAssists);
	const giAll = detectStreaks(matchesOrdered, conditionGoalInvolvement);
	const csAll = detectStreaks(matchesOrdered, conditionCleanSheet);
	const startAll = detectStreaks(matchesOrdered, conditionStart);
	const fmAll = detectStreaks(matchesOrdered, conditionFullMatch);
	const momAll = detectStreaks(matchesOrdered, conditionMom);
	const discAll = detectStreaks(matchesOrdered, conditionDiscipline);
	const winAll = detectStreaks(matchesOrdered, conditionWin);

	const scoringLatest = inLatest.length ? detectStreaks(inLatest, conditionScoring) : { current: 0, longest: 0 };
	const assistLatest = inLatest.length ? detectStreaks(inLatest, conditionAssists) : { current: 0, longest: 0 };
	const giLatest = inLatest.length ? detectStreaks(inLatest, conditionGoalInvolvement) : { current: 0, longest: 0 };
	const csLatest = inLatest.length ? detectStreaks(inLatest, conditionCleanSheet) : { current: 0, longest: 0 };
	const startLatest = inLatest.length ? detectStreaks(inLatest, conditionStart) : { current: 0, longest: 0 };
	const fmLatest = inLatest.length ? detectStreaks(inLatest, conditionFullMatch) : { current: 0, longest: 0 };
	const momLatest = inLatest.length ? detectStreaks(inLatest, conditionMom) : { current: 0, longest: 0 };
	const discLatest = inLatest.length ? detectStreaks(inLatest, conditionDiscipline) : { current: 0, longest: 0 };
	const winLatest = inLatest.length ? detectStreaks(inLatest, conditionWin) : { current: 0, longest: 0 };

	const appearanceLatest =
		appearance.slotsForLatestSeason && appearance.slotsForLatestSeason.length
			? detectAppearanceStreak(appearance.slotsForLatestSeason)
			: { current: 0, longest: 0 };

	return {
		currentScoringStreak: scoringAll.current,
		currentAssistStreak: assistAll.current,
		currentGoalInvolvementStreak: giAll.current,
		currentCleanSheetStreak: csAll.current,
		currentAppearanceStreak: appearance.current,
		currentStartStreak: startAll.current,
		currentFullMatchStreak: fmAll.current,
		currentMomStreak: momAll.current,
		currentDisciplineStreak: discAll.current,
		currentWinStreak: winAll.current,

		seasonBestScoringStreak: scoringLatest.longest,
		seasonBestAssistStreak: assistLatest.longest,
		seasonBestGoalInvolvementStreak: giLatest.longest,
		seasonBestCleanSheetStreak: csLatest.longest,
		seasonBestAppearanceStreak: appearanceLatest.longest,
		seasonBestStartStreak: startLatest.longest,
		seasonBestFullMatchStreak: fmLatest.longest,
		seasonBestMomStreak: momLatest.longest,
		seasonBestDisciplineStreak: discLatest.longest,
		seasonBestWinStreak: winLatest.longest,

		allTimeBestScoringStreak: scoringAll.longest,
		allTimeBestAssistStreak: assistAll.longest,
		allTimeBestGoalInvolvementStreak: giAll.longest,
		allTimeBestCleanSheetStreak: csAll.longest,
		allTimeBestAppearanceStreak: appearance.longest,
		allTimeBestStartStreak: startAll.longest,
		allTimeBestFullMatchStreak: fmAll.longest,
		allTimeBestMomStreak: momAll.longest,
		allTimeBestDisciplineStreak: discAll.longest,
		allTimeBestWinStreak: winAll.longest,
	};
}
