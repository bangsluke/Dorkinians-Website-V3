import { getDropdownChartStatValue } from "@/lib/stats/dropdownChartStatValue";

const toNum = (v: unknown): number => {
	if (v === null || v === undefined) return 0;
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
};

describe("getDropdownChartStatValue", () => {
	it("Goals = open-play goals + penalties scored", () => {
		expect(
			getDropdownChartStatValue({ goals: 3, penaltiesScored: 2 }, "goals", toNum),
		).toBe(5);
	});

	it("Goals with only penalties scored", () => {
		expect(
			getDropdownChartStatValue({ goals: 0, penaltiesScored: 1 }, "goals", toNum),
		).toBe(1);
	});

	it("Penalties Scored stays penalties-only", () => {
		expect(
			getDropdownChartStatValue({ goals: 3, penaltiesScored: 2 }, "penaltiesScored", toNum),
		).toBe(2);
	});

	it("other stats use the raw field", () => {
		expect(getDropdownChartStatValue({ assists: 4 }, "assists", toNum)).toBe(4);
	});
});
