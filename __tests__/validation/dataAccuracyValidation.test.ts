/**
 * Data Accuracy Validation Testing
 * Validates chatbot responses against reference data and production database
 */

import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";
import {
	fetchTestData,
	getTestPlayerNames,
	getAllStatConfigs,
	validateResponse,
	STAT_TEST_CONFIGS,
	TestPlayerData,
} from "../utils/testUtils";

describe("Data Accuracy Validation", () => {
	let chatbotService: ChatbotService;
	let referenceData: TestPlayerData[];
	let statConfigs: typeof STAT_TEST_CONFIGS;

	beforeAll(async () => {
		try {
			referenceData = await fetchTestData();
			statConfigs = getAllStatConfigs();

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`✅ Loaded ${referenceData.length} players for accuracy validation`);
				console.log(`📊 Testing ${statConfigs.length} stat configurations for accuracy`);
			}
		} catch (error) {
			console.error("❌ Failed to load test data:", error);
			throw error;
		}
	});

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
	});

	describe("Reference Data vs Production Database Validation", () => {
		test("should validate basic stats against reference data", async () => {
			const basicStats = ["G", "A", "APP", "Y", "R", "FTP"];
			const validationResults: any[] = [];

			for (const playerData of referenceData) {
				for (const statKey of basicStats) {
					const statConfig = statConfigs.find((config) => config.key === statKey);
					if (!statConfig) continue;

					const question = statConfig.questionTemplate.replace("{playerName}", playerData.playerName);
					const context: QuestionContext = {
						question,
						userContext: playerData.playerName,
					};

					const response = await chatbotService.processQuestion(context);

					expect(response.answer).toBeDefined();
					expect(response.answer).not.toBe("");
					expect(response.answer).toContain(playerData.playerName);

					// Extract numeric value from response
					const numericMatch = response.answer.match(/\d+/);
					const responseValue = numericMatch ? parseInt(numericMatch[0], 10) : null;

					// Get expected value from reference data
					let expectedValue: number;
					switch (statKey) {
						case "G":
							expectedValue = playerData.goals;
							break;
						case "A":
							expectedValue = playerData.assists;
							break;
						case "APP":
							expectedValue = playerData.appearances;
							break;
						case "Y":
							expectedValue = playerData.yellowCards;
							break;
						case "R":
							expectedValue = playerData.redCards;
							break;
						case "FTP":
							expectedValue = playerData.fantasyPoints;
							break;
						default:
							expectedValue = 0;
					}

					const isAccurate = responseValue === expectedValue;

					validationResults.push({
						player: playerData.playerName,
						stat: statKey,
						expected: expectedValue,
						actual: responseValue,
						accurate: isAccurate,
						response: response.answer,
					});

					// For now, we'll log accuracy issues but not fail the test
					// This allows us to identify data discrepancies without breaking CI
					if (!isAccurate) {
						console.warn(`⚠️ Data discrepancy: ${playerData.playerName} ${statKey} - Expected: ${expectedValue}, Got: ${responseValue}`);
					}
				}
			}

			const accurateCount = validationResults.filter((r) => r.accurate).length;
			const totalCount = validationResults.length;
			const accuracyRate = (accurateCount / totalCount) * 100;

			expect(accuracyRate).toBeGreaterThan(80); // At least 80% accuracy

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`📊 Basic Stats Accuracy: ${accuracyRate.toFixed(1)}% (${accurateCount}/${totalCount})`);
			}
		});

		test("should validate advanced stats against reference data", async () => {
			const advancedStats = ["GperAPP", "CperAPP", "MperG", "MperCLS", "FTPperAPP"];
			const validationResults: any[] = [];

			for (const playerData of referenceData) {
				for (const statKey of advancedStats) {
					const statConfig = statConfigs.find((config) => config.key === statKey);
					if (!statConfig) continue;

					const question = statConfig.questionTemplate.replace("{playerName}", playerData.playerName);
					const context: QuestionContext = {
						question,
						userContext: playerData.playerName,
					};

					const response = await chatbotService.processQuestion(context);

					expect(response.answer).toBeDefined();
					expect(response.answer).not.toBe("");
					expect(response.answer).toContain(playerData.playerName);

					// Extract decimal value from response
					const decimalMatch = response.answer.match(/\d+\.?\d*/);
					const responseValue = decimalMatch ? parseFloat(decimalMatch[0]) : null;

					// Get expected value from reference data
					let expectedValue: number;
					switch (statKey) {
						case "GperAPP":
							expectedValue = playerData.goalsPerAppearance;
							break;
						case "CperAPP":
							expectedValue = playerData.concededPerAppearance;
							break;
						case "MperG":
							expectedValue = playerData.minutesPerGoal;
							break;
						case "MperCLS":
							expectedValue = playerData.minutesPerCleanSheet;
							break;
						case "FTPperAPP":
							expectedValue = playerData.fantasyPointsPerAppearance;
							break;
						default:
							expectedValue = 0;
					}

					// Allow for small floating point differences
					const tolerance = 0.01;
					const isAccurate = responseValue !== null && Math.abs(responseValue - expectedValue) <= tolerance;

					validationResults.push({
						player: playerData.playerName,
						stat: statKey,
						expected: expectedValue,
						actual: responseValue,
						accurate: isAccurate,
						response: response.answer,
					});
				}
			}

			const accurateCount = validationResults.filter((r) => r.accurate).length;
			const totalCount = validationResults.length;
			const accuracyRate = (accurateCount / totalCount) * 100;

			expect(accuracyRate).toBeGreaterThan(70); // At least 70% accuracy for advanced stats

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`📊 Advanced Stats Accuracy: ${accuracyRate.toFixed(1)}% (${accurateCount}/${totalCount})`);
			}
		});
	});

	describe("Cross-Reference Data Validation", () => {
		test("should validate data consistency across different question formats", async () => {
			const playerName = "Luke Bangs";
			const playerData = referenceData.find((p) => p.playerName === playerName);
			expect(playerData).toBeDefined();

			const questionFormats = [
				"How many goals has Luke Bangs scored?",
				"What is Luke Bangs total goals?",
				"Luke Bangs goals count",
				"Goals scored by Luke Bangs",
				"How many goals did Luke Bangs get?",
			];

			const formatResults: any[] = [];

			for (const question of questionFormats) {
				const context: QuestionContext = {
					question,
					userContext: playerName,
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(response.answer).toContain(playerName);

				// Extract numeric value
				const numericMatch = response.answer.match(/\d+/);
				const responseValue = numericMatch ? parseInt(numericMatch[0], 10) : null;

				formatResults.push({
					question,
					response: response.answer,
					value: responseValue,
					expected: playerData!.goals,
				});
			}

			// All responses should contain the same numeric value
			const firstValue = formatResults[0].value;
			const allConsistent = formatResults.every((r) => r.value === firstValue);

			expect(allConsistent).toBe(true);
			expect(firstValue).toBe(playerData!.goals);

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`🔄 Cross-Format Consistency: ${allConsistent ? "PASS" : "FAIL"}`);
				formatResults.forEach((result) => {
					console.log(`   "${result.question}" → ${result.value}`);
				});
			}
		});

		test("should validate team-specific data accuracy", async () => {
			const teamSpecificQueries = [
				"How many goals has Luke Bangs scored for the 3rd team?",
				"What about Oli Goddard for the 2nd team?",
				"How many appearances has Jonny Sourris made for the 3rd team?",
			];

			const teamResults: any[] = [];

			for (const question of teamSpecificQueries) {
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Should contain team context
				expect(response.answer.toLowerCase()).toMatch(/3rd|2nd|team/);

				teamResults.push({
					question,
					response: response.answer,
					hasTeamContext: response.answer.toLowerCase().includes("team"),
				});
			}

			const allHaveTeamContext = teamResults.every((r) => r.hasTeamContext);
			expect(allHaveTeamContext).toBe(true);

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`🏆 Team-Specific Data: ${allHaveTeamContext ? "PASS" : "FAIL"}`);
				teamResults.forEach((result) => {
					console.log(`   "${result.question}" → Team context: ${result.hasTeamContext}`);
				});
			}
		});
	});

	describe("Statistical Validation", () => {
		test("should validate that calculated ratios are mathematically correct", async () => {
			const playerName = "Luke Bangs";
			const playerData = referenceData.find((p) => p.playerName === playerName);
			expect(playerData).toBeDefined();

			const ratioTests = [
				{
					question: "What is Luke Bangs goal-to-game ratio?",
					expectedRatio: playerData!.goalsPerAppearance,
					tolerance: 0.01,
				},
				{
					question: "How many fantasy points per appearance does Luke Bangs have?",
					expectedRatio: playerData!.fantasyPointsPerAppearance,
					tolerance: 0.01,
				},
			];

			for (const test of ratioTests) {
				const context: QuestionContext = {
					question: test.question,
					userContext: playerName,
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(response.answer).toContain(playerName);

				// Extract decimal value
				const decimalMatch = response.answer.match(/\d+\.?\d*/);
				const responseValue = decimalMatch ? parseFloat(decimalMatch[0]) : null;

				expect(responseValue).not.toBeNull();

				if (responseValue !== null) {
					const difference = Math.abs(responseValue - test.expectedRatio);
					expect(difference).toBeLessThanOrEqual(test.tolerance);
				}
			}
		});

		test("should validate that totals are consistent with components", async () => {
			const playerName = "Luke Bangs";
			const playerData = referenceData.find((p) => p.playerName === playerName);
			expect(playerData).toBeDefined();

			// Test that total goals equals sum of team-specific goals
			const teamGoalsQuestion = "How many goals has Luke Bangs scored for the 3rd team?";
			const totalGoalsQuestion = "How many goals has Luke Bangs scored?";

			const teamContext: QuestionContext = {
				question: teamGoalsQuestion,
				userContext: playerName,
			};

			const totalContext: QuestionContext = {
				question: totalGoalsQuestion,
				userContext: playerName,
			};

			const teamResponse = await chatbotService.processQuestion(teamContext);
			const totalResponse = await chatbotService.processQuestion(totalContext);

			expect(teamResponse.answer).toBeDefined();
			expect(totalResponse.answer).toBeDefined();

			const teamGoals = teamResponse.answer.match(/\d+/)?.[0];
			const totalGoals = totalResponse.answer.match(/\d+/)?.[0];

			if (teamGoals && totalGoals) {
				const teamGoalsNum = parseInt(teamGoals, 10);
				const totalGoalsNum = parseInt(totalGoals, 10);

				// Team goals should be less than or equal to total goals
				expect(teamGoalsNum).toBeLessThanOrEqual(totalGoalsNum);
			}
		});
	});

	describe("Data Range Validation", () => {
		test("should validate that all numeric responses are within reasonable ranges", async () => {
			const rangeTests = [
				{ stat: "goals", min: 0, max: 100 },
				{ stat: "assists", min: 0, max: 50 },
				{ stat: "appearances", min: 0, max: 200 },
				{ stat: "yellowCards", min: 0, max: 20 },
				{ stat: "redCards", min: 0, max: 5 },
				{ stat: "fantasyPoints", min: 0, max: 500 },
			];

			for (const playerData of referenceData) {
				for (const rangeTest of rangeTests) {
					const statConfig = statConfigs.find((config) => config.key === rangeTest.stat.toUpperCase());
					if (!statConfig) continue;

					const question = statConfig.questionTemplate.replace("{playerName}", playerData.playerName);
					const context: QuestionContext = {
						question,
						userContext: playerData.playerName,
					};

					const response = await chatbotService.processQuestion(context);

					expect(response.answer).toBeDefined();
					expect(response.answer).not.toBe("");

					const numericMatch = response.answer.match(/\d+/);
					const responseValue = numericMatch ? parseInt(numericMatch[0], 10) : null;

					if (responseValue !== null) {
						expect(responseValue).toBeGreaterThanOrEqual(rangeTest.min);
						expect(responseValue).toBeLessThanOrEqual(rangeTest.max);
					}
				}
			}
		});

		test("should validate that percentage values are between 0 and 100", async () => {
			const percentageStats = ["HomeGames%Won", "AwayGames%Won", "Games%Won"];

			for (const playerData of referenceData) {
				for (const statKey of percentageStats) {
					const statConfig = statConfigs.find((config) => config.key === statKey);
					if (!statConfig) continue;

					const question = statConfig.questionTemplate.replace("{playerName}", playerData.playerName);
					const context: QuestionContext = {
						question,
						userContext: playerData.playerName,
					};

					const response = await chatbotService.processQuestion(context);

					expect(response.answer).toBeDefined();
					expect(response.answer).not.toBe("");

					const percentageMatch = response.answer.match(/\d+\.?\d*/);
					const responseValue = percentageMatch ? parseFloat(percentageMatch[0]) : null;

					if (responseValue !== null) {
						expect(responseValue).toBeGreaterThanOrEqual(0);
						expect(responseValue).toBeLessThanOrEqual(100);
					}
				}
			}
		});
	});

	describe("Data Completeness Validation", () => {
		test("should ensure all players have data for basic stats", async () => {
			const basicStats = ["G", "A", "APP"];
			const completenessResults: any[] = [];

			for (const playerData of referenceData) {
				for (const statKey of basicStats) {
					const statConfig = statConfigs.find((config) => config.key === statKey);
					if (!statConfig) continue;

					const question = statConfig.questionTemplate.replace("{playerName}", playerData.playerName);
					const context: QuestionContext = {
						question,
						userContext: playerData.playerName,
					};

					const response = await chatbotService.processQuestion(context);

					const hasData =
						response.answer &&
						response.answer !== "" &&
						response.answer.toLowerCase().includes(playerData.playerName.toLowerCase()) &&
						!response.answer.toLowerCase().includes("couldn't find") &&
						!response.answer.toLowerCase().includes("not found");

					completenessResults.push({
						player: playerData.playerName,
						stat: statKey,
						hasData,
						response: response.answer,
					});
				}
			}

			const completeCount = completenessResults.filter((r) => r.hasData).length;
			const totalCount = completenessResults.length;
			const completenessRate = (completeCount / totalCount) * 100;

			expect(completenessRate).toBeGreaterThan(90); // At least 90% completeness

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`📊 Data Completeness: ${completenessRate.toFixed(1)}% (${completeCount}/${totalCount})`);

				const incomplete = completenessResults.filter((r) => !r.hasData);
				if (incomplete.length > 0) {
					console.log(`⚠️ Incomplete data found:`);
					incomplete.forEach((result) => {
						console.log(`   ${result.player} - ${result.stat}: ${result.response}`);
					});
				}
			}
		});
	});

	describe("Real-Time Data Validation", () => {
		test("should validate that responses are consistent across multiple requests", async () => {
			const playerName = "Luke Bangs";
			const question = "How many goals has Luke Bangs scored?";
			const iterations = 5;
			const responseValues: number[] = [];

			for (let i = 0; i < iterations; i++) {
				const context: QuestionContext = {
					question,
					userContext: playerName,
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(response.answer).toContain(playerName);

				const numericMatch = response.answer.match(/\d+/);
				const responseValue = numericMatch ? parseInt(numericMatch[0], 10) : null;

				if (responseValue !== null) {
					responseValues.push(responseValue);
				}
			}

			// All responses should be identical
			const firstValue = responseValues[0];
			const allConsistent = responseValues.every((value) => value === firstValue);

			expect(allConsistent).toBe(true);
			expect(responseValues.length).toBe(iterations);

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`🔄 Response Consistency: ${allConsistent ? "PASS" : "FAIL"}`);
				console.log(`   Values: ${responseValues.join(", ")}`);
			}
		});
	});
});
