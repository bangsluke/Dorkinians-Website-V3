import { parseBadgeId } from "@/app/api/player-badges/route";

describe("parseBadgeId", () => {
	it("parses simple badge keys", () => {
		expect(parseBadgeId("goalscorer_gold")).toEqual({ badgeKey: "goalscorer", tier: "gold" });
	});

	it("parses multi-segment keys", () => {
		expect(parseBadgeId("potm_winner_silver")).toEqual({ badgeKey: "potm_winner", tier: "silver" });
	});

	it("returns null for invalid tier suffix", () => {
		expect(parseBadgeId("goalscorer_platinum")).toBeNull();
	});
});
