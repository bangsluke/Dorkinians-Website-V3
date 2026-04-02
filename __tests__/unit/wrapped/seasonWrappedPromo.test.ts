import { isSeasonWrappedPromoMonth } from "@/lib/wrapped/seasonWrappedPromo";

describe("isSeasonWrappedPromoMonth", () => {
	test("April through August are promo months", () => {
		expect(isSeasonWrappedPromoMonth(new Date("2026-04-01T12:00:00Z"))).toBe(true);
		expect(isSeasonWrappedPromoMonth(new Date("2026-06-15T12:00:00Z"))).toBe(true);
		expect(isSeasonWrappedPromoMonth(new Date("2026-08-31T12:00:00Z"))).toBe(true);
	});

	test("March and September are outside promo window", () => {
		expect(isSeasonWrappedPromoMonth(new Date("2026-03-31T12:00:00Z"))).toBe(false);
		expect(isSeasonWrappedPromoMonth(new Date("2026-09-01T12:00:00Z"))).toBe(false);
	});
});
