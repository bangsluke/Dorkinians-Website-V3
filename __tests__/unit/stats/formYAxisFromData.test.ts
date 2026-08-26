import { formYAxisFromData } from "@/lib/stats/formYAxis";

describe("formYAxisFromData", () => {
	it("uses floor/ceil of all series values", () => {
		const data = [
			{ week: "1", date: "2024-01-01", rawScore: 4.2, ewmaReactive: 5.1, ewmaBaseline: 6.8 },
			{ week: "2", date: "2024-01-08", rawScore: 9.9, ewmaReactive: 7.0, ewmaBaseline: 6.5 },
		];
		const { domain, ticks } = formYAxisFromData(data);
		expect(domain).toEqual([4, 10]);
		expect(ticks[0]).toBe(4);
		expect(ticks[ticks.length - 1]).toBe(10);
	});

	it("expands when min equals max", () => {
		const data = [{ rawScore: 7, ewmaReactive: 7, ewmaBaseline: 7 }];
		const { domain } = formYAxisFromData(data);
		expect(domain[0]).toBeLessThan(domain[1]);
		expect(domain).toEqual([6, 8]);
	});
});
