import { isStandardFormation, STANDARD_FORMATIONS } from "@/lib/utils/isStandardFormation";

describe("isStandardFormation", () => {
	it("accepts the named standard shapes", () => {
		for (const formation of STANDARD_FORMATIONS) {
			expect(isStandardFormation(formation)).toBe(true);
		}
	});

	it("rejects non-standard and malformed shapes", () => {
		expect(isStandardFormation("4-2-4")).toBe(false);
		expect(isStandardFormation("4-4-1")).toBe(false);
		expect(isStandardFormation("3-2-2")).toBe(false);
		expect(isStandardFormation("0-0-0")).toBe(false);
		expect(isStandardFormation("4-4")).toBe(false);
		expect(isStandardFormation("")).toBe(false);
		expect(isStandardFormation(null)).toBe(false);
		expect(isStandardFormation(undefined)).toBe(false);
		expect(isStandardFormation("abc")).toBe(false);
	});
});
