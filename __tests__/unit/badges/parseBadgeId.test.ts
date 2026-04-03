import { isFirstXiLabel, parseBadgeId } from "@/app/api/player-badges/route";

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

describe("isFirstXiLabel", () => {
	it("matches 1s and 1st XI labels", () => {
		expect(isFirstXiLabel("1s")).toBe(true);
		expect(isFirstXiLabel("1st XI")).toBe(true);
		expect(isFirstXiLabel(" 1st xi ")).toBe(true);
	});

	it("does not match non-1st-xi labels", () => {
		expect(isFirstXiLabel("2s")).toBe(false);
		expect(isFirstXiLabel("3rd XI")).toBe(false);
	});
});
