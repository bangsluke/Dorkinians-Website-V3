import { buildMostConnectedListFromPartnershipsJson } from "@/lib/stats/mostConnected";

describe("buildMostConnectedListFromPartnershipsJson", () => {
	it("returns at most five entries sorted by timesPlayed desc", () => {
		const raw = JSON.stringify([
			{ name: "B", matches: 7, winRate: 60.1 },
			{ name: "A", matches: 12, winRate: 50 },
			{ name: "D", matches: 4, winRate: 40 },
			{ name: "E", matches: 8, winRate: 55 },
			{ name: "C", matches: 8, winRate: 61 },
			{ name: "F", matches: 9, winRate: 47 },
		]);

		const list = buildMostConnectedListFromPartnershipsJson(raw, 5);

		expect(list).toHaveLength(5);
		expect(list.map((x) => x.name)).toEqual(["A", "F", "C", "E", "B"]);
		expect(list.map((x) => x.timesPlayed)).toEqual([12, 9, 8, 8, 7]);
	});

	it("drops malformed rows and handles invalid json", () => {
		const raw = JSON.stringify([
			{ name: "", matches: 10 },
			{ name: "Valid", matches: 6, winRate: "58.2" },
			{ name: "NoMatches" },
		]);
		expect(buildMostConnectedListFromPartnershipsJson(raw)).toEqual([
			{ name: "Valid", timesPlayed: 6, winRate: 58.2 },
		]);
		expect(buildMostConnectedListFromPartnershipsJson("not json")).toEqual([]);
	});
});
