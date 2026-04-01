/**
 * Mirrors `database-dorkinians/services/matchDerivedFields.js` → `calculateMatchRating`.
 * Keep in sync when the DB formula changes.
 */
export type MatchRatingDetail = {
	class?: string | null;
	minutes?: number | null;
	goals?: number | null;
	assists?: number | null;
	mom?: number | null;
	cleanSheets?: number | null;
	saves?: number | null;
	yellowCards?: number | null;
	redCards?: number | null;
	ownGoals?: number | null;
	conceded?: number | null;
	penaltiesMissed?: number | null;
	penaltiesSaved?: number | null;
};

function n(v: unknown, fallback = 0): number {
	if (v === null || v === undefined) return fallback;
	const x = Number(v);
	return Number.isFinite(x) ? x : fallback;
}

export function calculateMatchRatingFromDetail(detail: MatchRatingDetail): number {
	const minutes = n(detail.minutes);
	const goals = n(detail.goals);
	const assists = n(detail.assists);
	const mom = n(detail.mom);
	const cleanSheets = n(detail.cleanSheets);
	const saves = n(detail.saves);
	const yellowCards = n(detail.yellowCards);
	const redCards = n(detail.redCards);
	const ownGoals = n(detail.ownGoals);
	const conceded = n(detail.conceded);
	const penaltiesMissed = n(detail.penaltiesMissed);
	const penaltiesSaved = n(detail.penaltiesSaved);

	const posRaw = detail.class;
	const pos = typeof posRaw === "string" ? posRaw.toUpperCase().trim() : "";

	let rating = 6.0;

	if (minutes >= 60) rating += 0.5;
	else if (minutes > 0) rating += 0.2;

	const goalBonus: Record<string, number> = { GK: 1.8, DEF: 1.8, MID: 1.5, FWD: 1.2 };
	rating += goals * (goalBonus[pos] || 1.2);

	rating += assists * 1.0;
	rating += mom * 2.0;

	const csBonus: Record<string, number> = { GK: 1.5, DEF: 1.2, MID: 0.3, FWD: 0 };
	rating += cleanSheets * (csBonus[pos] || 0);

	if (pos === "GK") {
		rating += saves * 0.3;
		rating += penaltiesSaved * 2.0;
	}

	rating -= yellowCards * 0.5;
	rating -= redCards * 1.5;
	rating -= ownGoals * 1.0;
	rating -= penaltiesMissed * 0.8;

	if (pos === "GK" || pos === "DEF") {
		rating -= Math.floor(conceded / 2) * 0.5;
	}

	const clamped = Math.max(1.0, Math.min(10.0, rating));
	return Math.round(clamped * 10) / 10;
}

export type MatchRatingBreakdownLine = { label: string; delta: number; running: number };

/**
 * Human-readable steps matching the formula (for tooltips).
 */
export function buildMatchRatingBreakdown(detail: MatchRatingDetail): {
	lines: MatchRatingBreakdownLine[];
	final: number;
	position: string;
} {
	const minutes = n(detail.minutes);
	const goals = n(detail.goals);
	const assists = n(detail.assists);
	const mom = n(detail.mom);
	const cleanSheets = n(detail.cleanSheets);
	const saves = n(detail.saves);
	const yellowCards = n(detail.yellowCards);
	const redCards = n(detail.redCards);
	const ownGoals = n(detail.ownGoals);
	const conceded = n(detail.conceded);
	const penaltiesMissed = n(detail.penaltiesMissed);
	const penaltiesSaved = n(detail.penaltiesSaved);

	const posRaw = detail.class;
	const pos = typeof posRaw === "string" ? posRaw.toUpperCase().trim() : "-";

	const lines: MatchRatingBreakdownLine[] = [];
	let running = 6.0;
	lines.push({ label: "Baseline", delta: 0, running });

	let minBonus = 0;
	if (minutes >= 60) minBonus = 0.5;
	else if (minutes > 0) minBonus = 0.2;
	if (minBonus !== 0) {
		running += minBonus;
		lines.push({ label: `Minutes (${minutes}′)`, delta: minBonus, running });
	}

	const goalBonus: Record<string, number> = { GK: 1.8, DEF: 1.8, MID: 1.5, FWD: 1.2 };
	const gb = goalBonus[pos] || 1.2;
	if (goals > 0) {
		const d = goals * gb;
		running += d;
		lines.push({ label: `Goals × ${gb.toFixed(1)} (${goals})`, delta: d, running });
	}

	if (assists > 0) {
		const d = assists * 1.0;
		running += d;
		lines.push({ label: `Assists (${assists})`, delta: d, running });
	}

	if (mom > 0) {
		const d = mom * 2.0;
		running += d;
		lines.push({ label: `MoM (${mom})`, delta: d, running });
	}

	const csBonus: Record<string, number> = { GK: 1.5, DEF: 1.2, MID: 0.3, FWD: 0 };
	const csB = csBonus[pos] || 0;
	if (cleanSheets > 0 && csB > 0) {
		const d = cleanSheets * csB;
		running += d;
		lines.push({ label: `Clean sheets × ${csB.toFixed(1)} (${cleanSheets})`, delta: d, running });
	}

	if (pos === "GK") {
		if (saves > 0) {
			const d = saves * 0.3;
			running += d;
			lines.push({ label: `Saves × 0.3 (${saves})`, delta: d, running });
		}
		if (penaltiesSaved > 0) {
			const d = penaltiesSaved * 2.0;
			running += d;
			lines.push({ label: `Penalties saved × 2 (${penaltiesSaved})`, delta: d, running });
		}
	}

	if (yellowCards > 0) {
		const d = -(yellowCards * 0.5);
		running += d;
		lines.push({ label: `Yellow cards × −0.5 (${yellowCards})`, delta: d, running });
	}
	if (redCards > 0) {
		const d = -(redCards * 1.5);
		running += d;
		lines.push({ label: `Red cards × −1.5 (${redCards})`, delta: d, running });
	}
	if (ownGoals > 0) {
		const d = -(ownGoals * 1.0);
		running += d;
		lines.push({ label: `Own goals (${ownGoals})`, delta: d, running });
	}
	if (penaltiesMissed > 0) {
		const d = -(penaltiesMissed * 0.8);
		running += d;
		lines.push({ label: `Penalties missed × −0.8 (${penaltiesMissed})`, delta: d, running });
	}

	if (pos === "GK" || pos === "DEF") {
		const blocks = Math.floor(conceded / 2);
		if (blocks > 0) {
			const d = -(blocks * 0.5);
			running += d;
			lines.push({ label: `Conceded /2 floor × −0.5 (${conceded} → ${blocks})`, delta: d, running });
		}
	}

	const preClamp = running;
	const clamped = Math.max(1.0, Math.min(10.0, preClamp));
	if (Math.abs(preClamp - clamped) > 1e-9) {
		running = clamped;
		lines.push({ label: "Clamp to 1.0–10.0", delta: clamped - preClamp, running });
	}
	const final = Math.round(clamped * 10) / 10;
	if (Math.abs(clamped - final) > 1e-9) {
		running = final;
		lines.push({ label: "Round to 1 decimal", delta: final - clamped, running: final });
	}

	return { lines, final, position: pos || "-" };
}
