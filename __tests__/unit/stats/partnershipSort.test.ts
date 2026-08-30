import { sortPartnershipRows, type PartnershipRow } from "@/lib/stats/partnershipSort";

const rows: PartnershipRow[] = [
	{ name: "High WR", winRate: 80, matches: 8, lift: 2, winRateWithout: 78 },
	{ name: "High lift", winRate: 80, matches: 8, lift: 15, winRateWithout: 65 },
	{ name: "Many games", winRate: 50, matches: 40, lift: 1, winRateWithout: 49 },
	{ name: "No lift", winRate: 90, matches: 6, lift: null, winRateWithout: null },
];

describe("sortPartnershipRows", () => {
	it("bestWinRate ranks by absolute win rate (ties: matches, then name)", () => {
		const sorted = sortPartnershipRows(rows, "bestWinRate");
		expect(sorted.map((r) => r.name)).toEqual(["No lift", "High lift", "High WR", "Many games"]);
	});

	it("mostGames ranks by shared matches", () => {
		const sorted = sortPartnershipRows(rows, "mostGames");
		expect(sorted[0].name).toBe("Many games");
	});
});
