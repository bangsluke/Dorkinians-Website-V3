export type PartnershipSortMode = "bestWinRate" | "mostImprovedWinRate" | "mostGames";

export type PartnershipRow = {
	name: string;
	winRate: number;
	matches: number;
	winRateWithout?: number | null;
	lift?: number | null;
};

/**
 * Sort partnership rows for Player Stats toggles.
 * - bestWinRate: highest absolute win rate
 * - mostImprovedWinRate: highest per-partner lift (with mate vs without mate); rows without lift omitted
 * - mostGames: most shared appearances
 */
export function sortPartnershipRows(list: PartnershipRow[], mode: PartnershipSortMode): PartnershipRow[] {
	const copy = [...list];
	if (mode === "mostGames") {
		copy.sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name));
		return copy;
	}
	if (mode === "mostImprovedWinRate") {
		const withLift = copy.filter((p) => p.lift != null && typeof p.lift === "number" && !Number.isNaN(p.lift));
		withLift.sort(
			(a, b) =>
				(b.lift as number) - (a.lift as number) ||
				b.winRate - a.winRate ||
				b.matches - a.matches ||
				a.name.localeCompare(b.name)
		);
		return withLift;
	}
	// bestWinRate
	copy.sort((a, b) => b.winRate - a.winRate || b.matches - a.matches || a.name.localeCompare(b.name));
	return copy;
}
