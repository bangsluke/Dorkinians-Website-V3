export type PartnershipSortMode = "bestWinRate" | "mostGames";

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
 * - mostGames: most shared appearances
 */
export function sortPartnershipRows(list: PartnershipRow[], mode: PartnershipSortMode): PartnershipRow[] {
	const copy = [...list];
	if (mode === "mostGames") {
		copy.sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name));
		return copy;
	}
	// bestWinRate
	copy.sort((a, b) => b.winRate - a.winRate || b.matches - a.matches || a.name.localeCompare(b.name));
	return copy;
}
