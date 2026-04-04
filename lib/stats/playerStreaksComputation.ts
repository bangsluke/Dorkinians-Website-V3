export type NormalizedMatch = {
	season: string;
	seasonWeek: string;
	seasonWeekObj: { key: string; season: string; week: number } | null;
	team: string;
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

export type NormalizedSeasonFixture = {
	season: string;
	team: string;
	seasonWeek: string;
	seasonWeekObj: { key: string; season: string; week: number } | null;
	dateMs: number;
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

function parseSeasonWeek(v: unknown): { key: string; season: string; week: number } | null {
	if (v === null || v === undefined) return null;
	const raw = String(v).trim();
	if (!raw) return null;
	const m = raw.match(/^(.+)-(\d+)$/);
	if (!m) return null;
	const season = String(m[1]);
	const week = toNum(m[2]);
	if (!season || week <= 0) return null;
	return { key: `${season}-${week}`, season, week };
}

function seasonWeekSortKey(sw: { season: string; week: number }, dateMs: number): string {
	return `${String(sw.season).padStart(20, "0")}::${String(sw.week).padStart(4, "0")}::${String(dateMs).padStart(16, "0")}`;
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
			const seasonWeekParsed = parseSeasonWeek(r.seasonWeek);
			const season = r.season != null ? String(r.season) : seasonWeekParsed ? seasonWeekParsed.season : "";
			return {
				season,
				seasonWeek: seasonWeekParsed ? seasonWeekParsed.key : "",
				seasonWeekObj: seasonWeekParsed,
				team: r.team != null ? String(r.team) : "",
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
		})
		.filter((m) => m.seasonWeekObj !== null);
	rows.sort((a, b) => {
		if (a.dateMs !== b.dateMs) return a.dateMs - b.dateMs;
		return compareSeasonKeys(a.season, b.season);
	});
	const seen = new Set<string>();
	const out: NormalizedMatch[] = [];
	for (const r of rows) {
		const key = `${r.fixtureId}::${r.season}::${r.team}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(r);
	}
	return out;
}

export function normalizeSeasonFixtures(rawSeasonFixtures: unknown[]): NormalizedSeasonFixture[] {
	const rows = (rawSeasonFixtures || [])
		.filter((f): f is Record<string, unknown> => !!f && f != null && (f as Record<string, unknown>).season != null && (f as Record<string, unknown>).team != null && (f as Record<string, unknown>).seasonWeek != null)
		.map((f) => {
			const r = f as Record<string, unknown>;
			const parsed = parseSeasonWeek(r.seasonWeek);
			const season = r.season != null ? String(r.season) : parsed ? parsed.season : "";
			return {
				season,
				team: String(r.team),
				seasonWeek: parsed ? parsed.key : "",
				seasonWeekObj: parsed,
				dateMs: dateToMillis(r.date),
			};
		})
		.filter((f) => f.seasonWeekObj !== null);
	const seen = new Set<string>();
	const out: NormalizedSeasonFixture[] = [];
	for (const r of rows) {
		const key = `${r.seasonWeek}::${r.team}`;
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

function getAnchorTeamsBySeason(matchesOrdered: NormalizedMatch[]): Map<string, string> {
	const seasonStats = new Map<string, Map<string, { count: number; latestDateMs: number }>>();
	for (const m of matchesOrdered) {
		const season = String(m.season || "");
		const team = String(m.team || "");
		if (!season || !team || toNum(m.minutes) <= 0) continue;
		if (!seasonStats.has(season)) seasonStats.set(season, new Map<string, { count: number; latestDateMs: number }>());
		const teamMap = seasonStats.get(season)!;
		const existing = teamMap.get(team) ?? { count: 0, latestDateMs: 0 };
		existing.count += 1;
		existing.latestDateMs = Math.max(existing.latestDateMs, toNum(m.dateMs));
		teamMap.set(team, existing);
	}
	const out = new Map<string, string>();
	for (const [season, teamMap] of seasonStats.entries()) {
		let bestTeam = "";
		let bestCount = -1;
		let bestLatest = -1;
		for (const [team, stat] of teamMap.entries()) {
			if (stat.count > bestCount || (stat.count === bestCount && stat.latestDateMs > bestLatest)) {
				bestTeam = team;
				bestCount = stat.count;
				bestLatest = stat.latestDateMs;
			}
		}
		if (bestTeam) out.set(season, bestTeam);
	}
	return out;
}

function buildWeekIndex(matchesOrdered: NormalizedMatch[], seasonFixtures: NormalizedSeasonFixture[]): Array<{
	key: string;
	season: string;
	week: number;
	sortDateMs: number;
	matches: NormalizedMatch[];
}> {
	const weekMap = new Map<string, { key: string; season: string; week: number; sortDateMs: number; matches: NormalizedMatch[] }>();
	const registerWeek = (seasonWeekObj: { key: string; season: string; week: number }, season: string, dateMs: number) => {
		const key = seasonWeekObj.key;
		const existing = weekMap.get(key);
		if (!existing) {
			weekMap.set(key, { key, season, week: seasonWeekObj.week, sortDateMs: dateMs, matches: [] });
			return;
		}
		if (existing.sortDateMs === 0 || (dateMs > 0 && dateMs < existing.sortDateMs)) {
			existing.sortDateMs = dateMs;
		}
	};
	for (const m of matchesOrdered) {
		if (!m.seasonWeekObj) continue;
		registerWeek(m.seasonWeekObj, m.season, m.dateMs);
		weekMap.get(m.seasonWeekObj.key)?.matches.push(m);
	}
	for (const f of seasonFixtures) {
		if (!f.seasonWeekObj) continue;
		registerWeek(f.seasonWeekObj, f.season, f.dateMs);
	}
	const weeks = [...weekMap.values()];
	weeks.sort((a, b) => {
		if (a.sortDateMs !== b.sortDateMs) return a.sortDateMs - b.sortDateMs;
		return seasonWeekSortKey({ season: a.season, week: a.week }, a.sortDateMs).localeCompare(
			seasonWeekSortKey({ season: b.season, week: b.week }, b.sortDateMs)
		);
	});
	return weeks;
}

function buildAnchorTeamFixtureWeeks(seasonFixtures: NormalizedSeasonFixture[]): Map<string, Set<string>> {
	const map = new Map<string, Set<string>>();
	for (const f of seasonFixtures) {
		const season = String(f.season || "");
		const team = String(f.team || "");
		if (!season || !team || !f.seasonWeek) continue;
		const key = `${season}::${team}`;
		const existing = map.get(key) ?? new Set<string>();
		existing.add(String(f.seasonWeek));
		map.set(key, existing);
	}
	return map;
}

function computeWeeklyStreak(
	weeksOrdered: Array<{ key: string; season: string; matches: NormalizedMatch[] }>,
	anchorBySeason: Map<string, string>,
	anchorTeamFixtureWeeks: Map<string, Set<string>>,
	conditionFn: ((match: NormalizedMatch) => boolean | null) | null
): { current: number; longest: number } {
	let current = 0;
	let longest = 0;
	for (const week of weeksOrdered) {
		const season = String(week.season || "");
		const matches = [...week.matches].sort((a, b) => a.dateMs - b.dateMs);
		if (conditionFn === null) {
			if (matches.length > 0) {
				current += matches.length;
				longest = Math.max(longest, current);
				continue;
			}
			const anchorTeam = anchorBySeason.get(season);
			if (!anchorTeam) continue;
			const fixtureKey = `${season}::${anchorTeam}`;
			const fixtureWeeks = anchorTeamFixtureWeeks.get(fixtureKey);
			const hasAnchorFixture = fixtureWeeks ? fixtureWeeks.has(String(week.key)) : false;
			if (hasAnchorFixture) current = 0;
			continue;
		}
		if (matches.length === 0) continue;
		for (const match of matches) {
			const r = conditionFn(match);
			if (r === null) continue;
			if (r) {
				current += 1;
				longest = Math.max(longest, current);
			} else {
				current = 0;
			}
		}
	}
	return { current, longest };
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

export function computeLiveStreakPayload(rawMatches: unknown[], rawSeasonFixtures: unknown[] | null): LiveStreakPayload {
	const matchesOrdered = normalizePlayerMatches(Array.isArray(rawMatches) ? rawMatches : []);
	const seasonFixtures = normalizeSeasonFixtures(Array.isArray(rawSeasonFixtures) ? rawSeasonFixtures : []);
	const latestSeason = pickLatestSeason(matchesOrdered);
	const anchorBySeason = getAnchorTeamsBySeason(matchesOrdered);
	const anchorTeamFixtureWeeks = buildAnchorTeamFixtureWeeks(seasonFixtures);
	const allWeeks = buildWeekIndex(matchesOrdered, seasonFixtures);
	const latestWeeks = latestSeason ? allWeeks.filter((w) => w.season === latestSeason) : [];

	const appearanceAll = computeWeeklyStreak(allWeeks, anchorBySeason, anchorTeamFixtureWeeks, null);
	const appearanceLatest = computeWeeklyStreak(latestWeeks, anchorBySeason, anchorTeamFixtureWeeks, null);
	const scoringAll = computeWeeklyStreak(allWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionScoring);
	const assistAll = computeWeeklyStreak(allWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionAssists);
	const giAll = computeWeeklyStreak(allWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionGoalInvolvement);
	const csAll = computeWeeklyStreak(allWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionCleanSheet);
	const startAll = computeWeeklyStreak(allWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionStart);
	const fmAll = computeWeeklyStreak(allWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionFullMatch);
	const momAll = computeWeeklyStreak(allWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionMom);
	const discAll = computeWeeklyStreak(allWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionDiscipline);
	const winAll = computeWeeklyStreak(allWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionWin);

	const scoringLatest = computeWeeklyStreak(latestWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionScoring);
	const assistLatest = computeWeeklyStreak(latestWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionAssists);
	const giLatest = computeWeeklyStreak(latestWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionGoalInvolvement);
	const csLatest = computeWeeklyStreak(latestWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionCleanSheet);
	const startLatest = computeWeeklyStreak(latestWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionStart);
	const fmLatest = computeWeeklyStreak(latestWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionFullMatch);
	const momLatest = computeWeeklyStreak(latestWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionMom);
	const discLatest = computeWeeklyStreak(latestWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionDiscipline);
	const winLatest = computeWeeklyStreak(latestWeeks, anchorBySeason, anchorTeamFixtureWeeks, conditionWin);

	return {
		currentScoringStreak: scoringAll.current,
		currentAssistStreak: assistAll.current,
		currentGoalInvolvementStreak: giAll.current,
		currentCleanSheetStreak: csAll.current,
		currentAppearanceStreak: appearanceAll.current,
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
		allTimeBestAppearanceStreak: appearanceAll.longest,
		allTimeBestStartStreak: startAll.longest,
		allTimeBestFullMatchStreak: fmAll.longest,
		allTimeBestMomStreak: momAll.longest,
		allTimeBestDisciplineStreak: discAll.longest,
		allTimeBestWinStreak: winAll.longest,
	};
}
