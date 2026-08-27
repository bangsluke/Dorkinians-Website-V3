/** Shared row shape for team / player / club recordings tables. */
export interface RecordingFixture {
	fixtureId: string;
	season: string;
	result: string;
	date: string;
	opposition: string;
	homeOrAway: string;
	goalsScored: number;
	goalsConceded: number;
	compType: string;
	veoLink: string | null;
	/** Fixture squad (e.g. "1st XI"); optional for club-wide queries. */
	team?: string;
}

export type RecordingSeasonOption = {
	season: string;
	count: number;
};

/** Sentinel value for the recordings season dropdown "All" option. */
export const RECORDING_SEASON_ALL = "__all__";

/** Leading year from a season label like `2025/26` or `2025/2026`. */
export function recordingSeasonStartYear(season: string): number {
	const match = /^(\d{4})/.exec((season || "").trim());
	if (!match) return 0;
	const year = Number(match[1]);
	return Number.isFinite(year) ? year : 0;
}

/** Distinct seasons with counts, newest first. */
export function buildRecordingSeasonOptions(fixtures: RecordingFixture[]): RecordingSeasonOption[] {
	const counts = new Map<string, number>();
	for (const fx of fixtures) {
		const season = (fx.season || "").trim();
		if (!season) continue;
		counts.set(season, (counts.get(season) || 0) + 1);
	}
	return Array.from(counts.entries())
		.map(([season, count]) => ({ season, count }))
		.sort((a, b) => {
			const ya = recordingSeasonStartYear(a.season);
			const yb = recordingSeasonStartYear(b.season);
			if (yb !== ya) return yb - ya;
			return b.season.localeCompare(a.season);
		});
}

/** Season options plus a leading All row (count = total fixtures). */
export function buildRecordingSeasonFilterOptions(fixtures: RecordingFixture[]): RecordingSeasonOption[] {
	const seasons = buildRecordingSeasonOptions(fixtures);
	if (seasons.length === 0) return [];
	return [{ season: RECORDING_SEASON_ALL, count: fixtures.length }, ...seasons];
}

/**
 * Default selection: current season when it has recordings, else newest season with recordings.
 * Falls back to All only when there are no season rows.
 */
export function resolveDefaultRecordingSeason(
	options: RecordingSeasonOption[],
	currentSeason: string | null
): string | null {
	const seasons = options.filter((opt) => opt.season !== RECORDING_SEASON_ALL);
	if (seasons.length === 0) {
		return options.some((opt) => opt.season === RECORDING_SEASON_ALL) ? RECORDING_SEASON_ALL : null;
	}
	const current = (currentSeason || "").trim();
	if (current && seasons.some((opt) => opt.season === current)) {
		return current;
	}
	return seasons[0].season;
}

export function filterRecordingsBySeason(fixtures: RecordingFixture[], season: string): RecordingFixture[] {
	if (season === RECORDING_SEASON_ALL) return fixtures;
	const target = (season || "").trim();
	return fixtures.filter((fx) => (fx.season || "").trim() === target);
}

export function formatRecordingSeasonOptionLabel(option: RecordingSeasonOption): string {
	if (option.season === RECORDING_SEASON_ALL) {
		return `All (${option.count})`;
	}
	return `${option.season} (${option.count})`;
}

export function formatRecordingDateDesktop(dateString: string): string {
	if (!dateString) return "-";
	try {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
	} catch {
		return dateString;
	}
}

/** Mobile: dd/mm/yy */
export function formatRecordingDateMobile(dateString: string): string {
	if (!dateString) return "-";
	try {
		const date = new Date(dateString);
		const d = date.getDate().toString().padStart(2, "0");
		const m = (date.getMonth() + 1).toString().padStart(2, "0");
		const y = date.getFullYear() % 100;
		return `${d}/${m}/${y.toString().padStart(2, "0")}`;
	} catch {
		return dateString;
	}
}

export function formatRecordingScore(result: string, goalsFor: number, goalsAgainst: number): string {
	const r = (result || "").trim();
	if (r === "W" || r === "D" || r === "L") {
		return `${r} ${goalsFor}-${goalsAgainst}`;
	}
	if (r) return `${r} ${goalsFor}-${goalsAgainst}`;
	return `${goalsFor}-${goalsAgainst}`;
}

export function recordingCompBadgeClass(compType: string): string {
	const c = (compType || "").trim().toLowerCase();
	if (c === "league") return "bg-blue-600/30 text-blue-300";
	if (c === "cup") return "bg-purple-600/30 text-purple-300";
	return "bg-green-600/30 text-green-300";
}

export function recordingLocBadgeClass(homeOrAway: string): string {
	return homeOrAway?.trim().toLowerCase() === "home"
		? "bg-dorkinians-yellow/20 text-dorkinians-yellow"
		: "bg-gray-700 text-gray-300";
}

export function recordingLocLabelMobile(homeOrAway: string): string {
	const h = homeOrAway?.trim().toLowerCase();
	if (h === "home") return "H";
	if (h === "away") return "A";
	return "-";
}

export function recordingLocLabelDesktop(homeOrAway: string): string {
	const v = (homeOrAway || "").trim();
	return v || "-";
}

export function recordingCompLabelMobile(compType: string): string {
	const c = (compType || "").trim().toLowerCase();
	if (c === "league") return "L";
	if (c === "cup") return "C";
	if (c === "friendly") return "F";
	const raw = (compType || "").trim();
	return raw ? raw.charAt(0).toUpperCase() : "-";
}

export function recordingCompLabelDesktop(compType: string): string {
	return (compType || "").trim() || "-";
}
