import { featureFlags, featureFlagPresets } from "@/config/config";

describe("umamiAnalytics feature flag", () => {
	it("is off in the resolved featureFlags used by the app", () => {
		expect(featureFlags.umamiAnalytics).toBe(false);
	});

	it("is off in both develop and production presets", () => {
		expect(featureFlagPresets.develop.umamiAnalytics).toBe(false);
		expect(featureFlagPresets.production.umamiAnalytics).toBe(false);
	});
});
