import { formatBadgeMetricValue } from "@/lib/badges/badgeTooltip";

describe("badge metric formatting", () => {
	it("rounds fantasy centurion values to whole numbers", () => {
		expect(formatBadgeMetricValue(199.6, "fantasy_centurion")).toBe("200");
	});

	it("formats fines as rounded pounds", () => {
		expect(formatBadgeMetricValue(349.4, "fines_paid")).toBe("£349");
		expect(formatBadgeMetricValue(349.6, "fines_paid")).toBe("£350");
	});
});
