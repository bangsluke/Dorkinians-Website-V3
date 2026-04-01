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
