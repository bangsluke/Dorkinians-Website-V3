import { formatFailedTestItemLine, parseFailedTestsDetailJson } from "@/lib/utils/failedTestsDetailFormat";

describe("failedTestsDetailFormat", () => {
	it("parses failed tests JSON and formats fixture lines", () => {
		const detail = parseFailedTestsDetailJson(
			JSON.stringify([
				{
					name: "Fixture MatchDetails",
					type: "fixtureMatchDetails",
					count: 1,
					items: [{ id: "fx1", date: "2024-01-01", season: "2024/2025", relationshipCount: 0 }],
				},
			]),
		);
		expect(detail).toHaveLength(1);
		expect(formatFailedTestItemLine(detail[0].type, detail[0].items[0])).toContain("Fixture fx1");
	});

	it("appends a shortfall reason after the link count", () => {
		const line = formatFailedTestItemLine("fixtureMatchDetails", {
			id: "fx1",
			date: "2024-03-03",
			season: "2023/24",
			relationshipCount: 0,
			reason: "dates differ",
		});
		expect(line).toContain("links: 0 — dates differ");
	});

	it("returns empty array for invalid JSON", () => {
		expect(parseFailedTestsDetailJson("not-json")).toEqual([]);
		expect(parseFailedTestsDetailJson(null)).toEqual([]);
	});
});
