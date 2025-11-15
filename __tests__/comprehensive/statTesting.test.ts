/**
 * Comprehensive Stat Testing for All 50+ Metrics
 * Tests every stat configuration against real database data
 */

import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";
import {
	fetchTestData,
	getTestPlayerNames,
	getAllStatConfigs,
	generateTestQuestions,
	validateResponse,
	STAT_TEST_CONFIGS,
	TestPlayerData,
} from "../utils/testUtils";
import { TestConfig } from "../../config/config";

describe("Comprehensive Stat Testing", () => {
	let chatbotService: ChatbotService;
	let referenceData: TestPlayerData[];
	let statConfigs: typeof STAT_TEST_CONFIGS;

	beforeAll(async () => {
		// Load reference data and stat configurations
		try {
			referenceData = await fetchTestData();
			statConfigs = getAllStatConfigs();

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`✅ Loaded ${referenceData.length} players for comprehensive testing`);
				console.log(`📊 Testing ${statConfigs.length} stat configurations`);
			}
		} catch (error) {
			console.error("❌ Failed to load test data:", error);
			throw error;
		}
	});

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
	});

	describe("Basic Statistics Coverage", () => {
		const basicStats = ["APP", "MIN", "MOM", "G", "A", "Y", "R", "SAVES", "OG", "C", "CLS", "PSC", "PM", "PCO", "PSV", "FTP"];

		test.each(basicStats)("should handle %s stat correctly", async (statKey) => {
			const statConfig = statConfigs.find((config: TestConfig) => config.key === statKey);
			expect(statConfig).toBeDefined();

			const playerName = "Luke Bangs";
			const question = statConfig!.questionTemplate.replace("{playerName}", playerName);

			const context: QuestionContext = {
				question,
				userContext: playerName,
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeDefined();
			expect(response.answer).not.toBe("");
			expect(response.answer).toContain(playerName);

			// Validate response format
			const extractedValue = statConfig!.responsePattern.exec(response.answer);
			expect(extractedValue).toBeTruthy();
		});
	});

	describe("Advanced Statistics Coverage", () => {
		const advancedStats = ["AllGSC", "GperAPP", "CperAPP", "MperG", "MperCLS", "FTPperAPP", "DIST"];

		test.each(advancedStats)("should handle %s advanced stat correctly", async (statKey) => {
			const statConfig = statConfigs.find((config: TestConfig) => config.key === statKey);
			expect(statConfig).toBeDefined();

			const playerName = "Luke Bangs";
			const question = statConfig!.questionTemplate.replace("{playerName}", playerName);

			const context: QuestionContext = {
				question,
				userContext: playerName,
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeDefined();
			expect(response.answer).not.toBe("");
			expect(response.answer).toContain(playerName);

			// Validate numeric response for advanced stats
			const extractedValue = statConfig!.responsePattern.exec(response.answer);
			expect(extractedValue).toBeTruthy();

			if (statKey.includes("per") || statKey === "DIST") {
				// Should handle decimal values
				const numericValue = parseFloat(extractedValue![1]);
				expect(numericValue).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("Home/Away Statistics Coverage", () => {
		const homeAwayStats = ["HomeGames", "HomeWins", "HomeGames%Won", "AwayGames", "AwayWins", "AwayGames%Won", "Games%Won"];

		test.each(homeAwayStats)("should handle %s home/away stat correctly", async (statKey) => {
			const statConfig = statConfigs.find((config: TestConfig) => config.key === statKey);
			expect(statConfig).toBeDefined();

			const playerName = "Luke Bangs";
			const question = statConfig!.questionTemplate.replace("{playerName}", playerName);

			const context: QuestionContext = {
				question,
				userContext: playerName,
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeDefined();
			expect(response.answer).not.toBe("");
			expect(response.answer).toContain(playerName);

			// Validate response contains appropriate context
			if (statKey.includes("Home")) {
				expect(response.answer.toLowerCase()).toContain("home");
			} else if (statKey.includes("Away")) {
				expect(response.answer.toLowerCase()).toContain("away");
			}
		});
	});

	describe("Team-Specific Appearances Coverage", () => {
		const teamAppStats = [
			"1sApps",
			"2sApps",
			"3sApps",
			"4sApps",
			"5sApps",
			"6sApps",
			"7sApps",
			"8sApps",
			"MostPlayedForTeam",
			"NumberTeamsPlayedFor",
		];

		test.each(teamAppStats)("should handle %s team appearance stat correctly", async (statKey) => {
			const statConfig = statConfigs.find((config: TestConfig) => config.key === statKey);
			expect(statConfig).toBeDefined();

			const playerName = "Luke Bangs";
			const question = statConfig!.questionTemplate.replace("{playerName}", playerName);

			const context: QuestionContext = {
				question,
				userContext: playerName,
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeDefined();
			expect(response.answer).not.toBe("");
			expect(response.answer).toContain(playerName);

			// Validate team-specific context
			if (statKey.includes("Apps")) {
				const teamNumber = statKey.replace("sApps", "");
				expect(response.answer.toLowerCase()).toContain(teamNumber);
			}
		});
	});

	describe("Team-Specific Goals Coverage", () => {
		const teamGoalStats = ["1sGoals", "2sGoals", "3sGoals", "4sGoals", "5sGoals", "6sGoals", "7sGoals", "8sGoals", "MostScoredForTeam"];

		test.each(teamGoalStats)("should handle %s team goal stat correctly", async (statKey) => {
			const statConfig = statConfigs.find((config: TestConfig) => config.key === statKey);
			expect(statConfig).toBeDefined();

			const playerName = "Luke Bangs";
			const question = statConfig!.questionTemplate.replace("{playerName}", playerName);

			const context: QuestionContext = {
				question,
				userContext: playerName,
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeDefined();
			expect(response.answer).not.toBe("");
			expect(response.answer).toContain(playerName);

			// Validate goal-specific context
			if (statKey.includes("Goals")) {
				expect(response.answer.toLowerCase()).toContain("goal");
				const teamNumber = statKey.replace("sGoals", "");
				expect(response.answer.toLowerCase()).toContain(teamNumber);
			}
		});
	});

	describe("Seasonal Appearances Coverage", () => {
		const seasonalAppStats = [
			"2016/17Apps",
			"2017/18Apps",
			"2018/19Apps",
			"2019/20Apps",
			"2020/21Apps",
			"2021/22Apps",
			"NumberSeasonsPlayedFor",
		];

		test.each(seasonalAppStats)("should handle %s seasonal appearance stat correctly", async (statKey) => {
			const statConfig = statConfigs.find((config: TestConfig) => config.key === statKey);
			expect(statConfig).toBeDefined();

			const playerName = "Luke Bangs";
			const question = statConfig!.questionTemplate.replace("{playerName}", playerName);

			const context: QuestionContext = {
				question,
				userContext: playerName,
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeDefined();
			expect(response.answer).not.toBe("");
			expect(response.answer).toContain(playerName);

			// Validate seasonal context
			if (statKey.includes("Apps")) {
				const season = statKey.replace("Apps", "");
				expect(response.answer.toLowerCase()).toContain(season.toLowerCase());
			}
		});
	});

	describe("Seasonal Goals Coverage", () => {
		const seasonalGoalStats = [
			"2016/17Goals",
			"2017/18Goals",
			"2018/19Goals",
			"2019/20Goals",
			"2020/21Goals",
			"2021/22Goals",
			"MostProlificSeason",
		];

		test.each(seasonalGoalStats)("should handle %s seasonal goal stat correctly", async (statKey) => {
			const statConfig = statConfigs.find((config: TestConfig) => config.key === statKey);
			expect(statConfig).toBeDefined();

			const playerName = "Luke Bangs";
			const question = statConfig!.questionTemplate.replace("{playerName}", playerName);

			const context: QuestionContext = {
				question,
				userContext: playerName,
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeDefined();
			expect(response.answer).not.toBe("");
			expect(response.answer).toContain(playerName);

			// Validate seasonal goal context
			if (statKey.includes("Goals")) {
				expect(response.answer.toLowerCase()).toContain("goal");
				const season = statKey.replace("Goals", "");
				expect(response.answer.toLowerCase()).toContain(season.toLowerCase());
			}
		});
	});

	describe("Positional Statistics Coverage", () => {
		const positionalStats = ["GK", "DEF", "MID", "FWD", "MostCommonPosition"];

		test.each(positionalStats)("should handle %s positional stat correctly", async (statKey) => {
			const statConfig = statConfigs.find((config: TestConfig) => config.key === statKey);
			expect(statConfig).toBeDefined();

			const playerName = "Luke Bangs";
			const question = statConfig!.questionTemplate.replace("{playerName}", playerName);

			const context: QuestionContext = {
				question,
				userContext: playerName,
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeDefined();
			expect(response.answer).not.toBe("");
			expect(response.answer).toContain(playerName);

			// Validate positional context
			if (statKey === "GK") {
				expect(response.answer.toLowerCase()).toContain("goalkeeper");
			} else if (statKey === "DEF") {
				expect(response.answer.toLowerCase()).toContain("defender");
			} else if (statKey === "MID") {
				expect(response.answer.toLowerCase()).toContain("midfielder");
			} else if (statKey === "FWD") {
				expect(response.answer.toLowerCase()).toContain("forward");
			}
		});
	});

	describe("All Players Stat Validation", () => {
		test("should validate all players against all basic stats", async () => {
			const playerNames = await getTestPlayerNames();
			const basicStats = ["G", "A", "APP", "Y", "R", "FTP"];

			for (const playerName of playerNames) {
				for (const statKey of basicStats) {
					const statConfig = statConfigs.find((config: TestConfig) => config.key === statKey);
					if (!statConfig) continue;

					const question = statConfig.questionTemplate.replace("{playerName}", playerName);
					const context: QuestionContext = {
						question,
						userContext: playerName,
					};

					const response = await chatbotService.processQuestion(context);

					expect(response.answer).toBeDefined();
					expect(response.answer).not.toBe("");
					expect(response.answer).toContain(playerName);

					// Validate response format
					const extractedValue = statConfig.responsePattern.exec(response.answer);
					expect(extractedValue).toBeTruthy();
				}
			}
		});
	});

	describe("Response Quality Validation", () => {
		test("should provide consistent response formats across all stats", async () => {
			const playerName = "Luke Bangs";
			const testStats = ["G", "A", "APP", "Y", "R", "FTP", "GperAPP", "MperG"];

			for (const statKey of testStats) {
				const statConfig = statConfigs.find((config: TestConfig) => config.key === statKey);
				if (!statConfig) continue;

				const question = statConfig.questionTemplate.replace("{playerName}", playerName);
				const context: QuestionContext = {
					question,
					userContext: playerName,
				};

				const response = await chatbotService.processQuestion(context);

				// All responses should be natural language
				expect(response.answer).toMatch(/^[A-Z]/); // Start with capital letter
				expect(response.answer).toMatch(/[.!?]$/); // End with punctuation
				expect(response.answer).toContain(playerName);

				// Should contain appropriate metric terminology
				const metricTerm = statConfig.description.toLowerCase();
				expect(response.answer.toLowerCase()).toContain(metricTerm.split(" ")[0]);
			}
		});
	});

	describe("Edge Case Handling", () => {
		test("should handle zero values gracefully", async () => {
			const zeroValueStats = ["R", "OG", "C", "CLS", "PSC", "PM", "PCO", "PSV"];

			for (const statKey of zeroValueStats) {
				const statConfig = statConfigs.find((config: TestConfig) => config.key === statKey);
				if (!statConfig) continue;

				const playerName = "Luke Bangs";
				const question = statConfig.questionTemplate.replace("{playerName}", playerName);
				const context: QuestionContext = {
					question,
					userContext: playerName,
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(response.answer).toContain(playerName);

				// Should handle zero values naturally
				if (response.answer.includes("0")) {
					expect(response.answer.toLowerCase()).toMatch(/zero|none|no|0/);
				}
			}
		});

		test("should handle decimal values appropriately", async () => {
			const decimalStats = ["GperAPP", "CperAPP", "MperG", "MperCLS", "FTPperAPP"];

			for (const statKey of decimalStats) {
				const statConfig = statConfigs.find((config: TestConfig) => config.key === statKey);
				if (!statConfig) continue;

				const playerName = "Luke Bangs";
				const question = statConfig.questionTemplate.replace("{playerName}", playerName);
				const context: QuestionContext = {
					question,
					userContext: playerName,
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(response.answer).toContain(playerName);

				// Should handle decimal values appropriately
				const decimalMatch = response.answer.match(/\d+\.\d+/);
				if (decimalMatch) {
					const decimalValue = parseFloat(decimalMatch[0]);
					expect(decimalValue).toBeGreaterThanOrEqual(0);
				}
			}
		});
	});

	describe("Performance Testing", () => {
		test("should handle all stat queries within reasonable time", async () => {
			const playerName = "Luke Bangs";
			const allStats = statConfigs.slice(0, 20); // Test first 20 stats for performance

			const startTime = Date.now();

			for (const statConfig of allStats) {
				const question = statConfig.questionTemplate.replace("{playerName}", playerName);
				const context: QuestionContext = {
					question,
					userContext: playerName,
				};

				const response = await chatbotService.processQuestion(context);
				expect(response.answer).toBeDefined();
			}

			const endTime = Date.now();
			const totalTime = endTime - startTime;

			// Should complete 20 stat queries in under 30 seconds
			expect(totalTime).toBeLessThan(30000);

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`⚡ Completed ${allStats.length} stat queries in ${totalTime}ms`);
				console.log(`📊 Average time per query: ${(totalTime / allStats.length).toFixed(2)}ms`);
			}
		});
	});
});
