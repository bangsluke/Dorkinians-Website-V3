import { fetchTestData, getAllStatConfigs, validateResponse, TestPlayerData, STAT_TEST_CONFIGS } from "@/__tests__/utils/testUtils";
import { TestConfig } from "@/__tests__/chatbot-tests-config";

// Debug/contract tests for shared test utilities: stat catalog size, config accessors, optional DB fetch, and response validation.
// fetchTestData may hit real backing storage when configured; empty arrays are allowed. Console logging is intentional for local diagnosis.
// Thresholds (e.g. >=60 configs) can fail when stat metadata changes-treat as signal to refresh fixtures or expectations.

describe("TestUtils Debug Tests", () => {
	test("STAT_TEST_CONFIGS should contain a non-trivial set of entries", () => {
		// Arrange: emit diagnostic snapshots of the stat catalog
		console.log("🔍 STAT_TEST_CONFIGS length:", STAT_TEST_CONFIGS.length);
		console.log(
			"🔍 STAT_TEST_CONFIGS keys:",
			STAT_TEST_CONFIGS.map((config: TestConfig) => config.key),
		);

		// Check for any undefined or null entries
		const validEntries = STAT_TEST_CONFIGS.filter((entry: TestConfig) => entry && entry.key);
		console.log("🔍 Valid entries:", validEntries.length);

		// Check for any malformed entries
		const malformedEntries = STAT_TEST_CONFIGS.filter((entry: TestConfig) => !entry || !entry.key || !entry.metric);
		if (malformedEntries.length > 0) {
			console.log("⚠️ Malformed entries:", malformedEntries);
		}

		// Assert: catalog meets minimum breadth for downstream suites
		expect(STAT_TEST_CONFIGS.length).toBeGreaterThanOrEqual(60);
	});

	test("getAllStatConfigs should return all stat entries", () => {
		// Act: pull derived config list from helper
		const configs = getAllStatConfigs();
		console.log("🔍 getAllStatConfigs length:", configs.length);
		console.log(
			"🔍 getAllStatConfigs keys:",
			configs.map((config: TestConfig) => config.key),
		);
		// Assert: helper mirrors static catalog size
		expect(configs.length).toBe(STAT_TEST_CONFIGS.length);
	});

	test("fetchTestData should return an array (db may be empty/unavailable)", async () => {
		// Act: attempt to load backing test rows (may be empty)
		const testData = await fetchTestData();
		console.log("🔍 fetchTestData length:", testData.length);
		console.log(
			"🔍 fetchTestData players:",
			testData.map((p: TestPlayerData) => p.playerName),
		);
		console.log("🔍 First player sample:", testData[0]);
		// Assert: always an array even when remote data missing
		expect(Array.isArray(testData)).toBe(true);
		expect(testData.length).toBeGreaterThanOrEqual(0);
	});

	test("validateResponse should work with valid statConfig", () => {
		// Arrange: pick a representative stat config and matching answer text
		const statConfig = STAT_TEST_CONFIGS[0]; // APP
		const response = "Luke Bangs has made 78 appearances";
		// Act: run validation helper
		const validation = validateResponse(response, 78, statConfig, "Luke Bangs");
		console.log("🔍 Validation result:", validation);
		// Assert: sample passes configured patterns
		expect(validation.isValid).toBe(true);
	});

	test("All stat configs should have required properties", () => {
		// Act & assert: every entry exposes required metadata fields
		STAT_TEST_CONFIGS.forEach((config: TestConfig, index: number) => {
			expect(config).toHaveProperty("key");
			expect(config).toHaveProperty("metric");
			expect(config).toHaveProperty("questionTemplate");
			expect(config).toHaveProperty("responsePattern");
			expect(config).toHaveProperty("description");

			if (!config.key || !config.metric) {
				console.log(`⚠️ Entry ${index} missing required properties:`, config);
			}
		});
	});
});
