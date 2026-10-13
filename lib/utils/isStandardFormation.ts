/** Allowed DEF-MID-FWD shapes shown on Formations Used (GK implied). */
export const STANDARD_FORMATIONS = [
	"4-4-2",
	"4-5-1",
	"4-3-3",
	"5-4-1",
	"5-3-2",
	"3-4-3",
	"3-5-2",
] as const;

const STANDARD_FORMATION_SET = new Set<string>(STANDARD_FORMATIONS);

/**
 * True when the inferred formation is one of the named standard shapes.
 */
export function isStandardFormation(formation: string | null | undefined): boolean {
	if (formation == null) return false;
	return STANDARD_FORMATION_SET.has(String(formation).trim());
}
