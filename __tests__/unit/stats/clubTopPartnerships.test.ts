import {
	buildClubTopPartnershipsQuery,
	sortClubPartnershipPairs,
	type ClubPartnershipPair,
} from "@/lib/stats/clubTopPartnerships";

describe("clubTopPartnerships", () => {
	describe("buildClubTopPartnershipsQuery", () => {
		it("includes season filter and min-match threshold", () => {
			const { query, params } = buildClubTopPartnershipsQuery("prod", {
				timeRange: { type: "season", seasons: ["2024/25"] },
			});
			expect(params.seasons).toEqual(["2024/25"]);
			expect(params.minPartnershipMatches).toBe(5);
			expect(query).toContain("f.season IN $seasons");
			expect(query).toContain("matchesTogether >= $minPartnershipMatches");
			expect(query).toContain("LIMIT 10");
			expect(query).toContain("ORDER BY winRate DESC");
		});

		it("orders by matches when sortMode is mostGames", () => {
			const { query } = buildClubTopPartnershipsQuery("prod", null, "mostGames");
			expect(query).toContain("ORDER BY matches DESC");
		});

		it("applies position filters to both partners", () => {
			const { query, params } = buildClubTopPartnershipsQuery("prod", {
				position: ["MID", "FWD"],
			});
			expect(params.positions).toEqual(["MID", "FWD"]);
			expect(query).toContain("md1.class IN $positions");
			expect(query).toContain("md2.class IN $positions");
			expect(query.includes("md.class")).toBe(false);
		});
	});

	describe("sortClubPartnershipPairs", () => {
		const rows: ClubPartnershipPair[] = [
			{ player1: "A", player2: "B", matches: 8, winRate: 50 },
			{ player1: "C", player2: "D", matches: 12, winRate: 40 },
			{ player1: "E", player2: "F", matches: 6, winRate: 80 },
		];

		it("sorts by best win rate", () => {
			expect(sortClubPartnershipPairs(rows, "bestWinRate").map((r) => r.player1)).toEqual(["E", "A", "C"]);
		});

		it("sorts by most games", () => {
			expect(sortClubPartnershipPairs(rows, "mostGames").map((r) => r.player1)).toEqual(["C", "A", "E"]);
		});
	});
});
