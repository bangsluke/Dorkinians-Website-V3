import { enrichFilteredPartnershipsWithLift } from "@/app/api/player-data/route";

describe("enrichFilteredPartnershipsWithLift", () => {
	it("computes lift as with-mate winRate minus without-mate winRate", () => {
		const rows = [
			{ mateName: "A", matches: 5, winRate: 80 },
			{ mateName: "B", matches: 5, winRate: 50 },
		];
		const fixtures = [
			{ result: "W", mates: ["A", "B"] },
			{ result: "W", mates: ["A", "B"] },
			{ result: "W", mates: ["A", "B"] },
			{ result: "W", mates: ["A", "B"] },
			{ result: "W", mates: ["A", "B"] },
			{ result: "L", mates: ["A"] },
			{ result: "L", mates: ["A"] },
			{ result: "L", mates: ["A"] },
			{ result: "L", mates: ["A"] },
			{ result: "L", mates: ["A"] },
		];
		const enriched = enrichFilteredPartnershipsWithLift(rows, fixtures);
		const a = enriched.find((r) => r.mateName === "A");
		const b = enriched.find((r) => r.mateName === "B");
		expect(a?.lift).toBeDefined();
		expect(b?.lift).toBeDefined();
		// Without A: none (all fixtures include A) → null lift if < 5 without
		// Without B: 5 L → 0% → lift 50 - 0 = 50
		expect(a?.lift).toBeNull();
		expect(b?.lift).toBe(50);
	});
});
