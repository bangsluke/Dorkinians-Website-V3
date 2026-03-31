import type { BadgeDefinition } from "@/lib/badges/catalog";

type EarnedRow = {
	tier: string;
	description: string;
};

type Progress = {
	nextTier: string;
	currentValue: number;
	targetValue: number;
	remaining: number;
};

/** Stable display for badge metrics (avoids float junk like 0.09000000000000001). */
export function formatBadgeNumber(n: number): string {
	if (!Number.isFinite(n)) return "—";
	const nearInt = Math.abs(n - Math.round(n)) < 1e-6;
	if (nearInt) return String(Math.round(n));
	const rounded = Math.round(n * 10000) / 10000;
	let s = rounded.toFixed(4);
	s = s.replace(/\.?0+$/, "");
	return s || "0";
}

/**
 * Accessible title/tooltip copy for milestone cells: what it measures, current value, progress to next tier.
 */
export function buildMilestoneBadgeTooltip(
	def: BadgeDefinition,
	got: EarnedRow | undefined,
	prog: Progress | undefined,
): string {
	const measure = `${def.name}: milestone based on your ${def.category} stats.`;
	if (got && prog && prog.remaining > 0) {
		return `${measure} Earned ${got.tier} (${got.description}). Current value ${formatBadgeNumber(prog.currentValue)}. Next tier: ${prog.nextTier} at ${formatBadgeNumber(prog.targetValue)} — ${formatBadgeNumber(prog.remaining)} to go.`;
	}
	if (got) {
		return `${measure} Earned ${got.tier}: ${got.description}. Highest tier achieved.`;
	}
	if (prog && prog.remaining > 0) {
		return `${measure} Current value: ${formatBadgeNumber(prog.currentValue)}. Next: ${prog.nextTier} (target ${formatBadgeNumber(prog.targetValue)}). ${formatBadgeNumber(prog.remaining)} to go.`;
	}
	if (prog) {
		return `${measure} Current value: ${formatBadgeNumber(prog.currentValue)}.`;
	}
	return `${measure} Highest tier achieved.`;
}
