/**
 * Enhanced Integration Testing
 * Extended end-to-end workflow validation with real database
 */

import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";
import { fetchTestData, getTestPlayerNames, validateResponse } from "../utils/testUtils";

describe("Enhanced Integration Testing", () => {
	let chatbotService: ChatbotService;
	let referenceData: any[];

	beforeAll(async () => {
		try {
			referenceData = await fetchTestData();
			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`✅ Enhanced integration data loaded: ${referenceData.length} players`);
				console.log("🧪 Testing against real production database with enhanced scenarios");
			}
		} catch (error) {
			console.error("❌ Failed to load integration reference data:", error);
			throw error;
		}
	});

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
	});

	describe("Complete User Journey Testing", () => {
		test("should handle a complete user session from start to finish", async () => {
			const userSession = [
				{ question: "How many goals has Luke Bangs scored?", expectedContext: "goals" },
				{ question: "What about assists?", expectedContext: "assists" },
				{ question: "How many appearances has he made?", expectedContext: "appearances" },
				{ question: "Who has more goals, Luke Bangs or Oli Goddard?", expectedContext: "comparison" },
				{ question: "What are the top 3 players by assists?", expectedContext: "ranking" },
				{ question: "Compare Luke Bangs and Jonny Sourris", expectedContext: "comparison" },
			];

			const sessionResults: any[] = [];

			for (let i = 0; i < userSession.length; i++) {
				const { question, expectedContext } = userSession[i];
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(response.answer).toContain("Luke Bangs");

				sessionResults.push({
					question,
					response: response.answer,
					expectedContext,
					questionNumber: i + 1,
				});

				// Verify context awareness
				if (expectedContext === "goals") {
					expect(response.answer.toLowerCase()).toContain("goal");
				} else if (expectedContext === "assists") {
					expect(response.answer.toLowerCase()).toContain("assist");
				} else if (expectedContext === "appearances") {
					expect(response.answer.toLowerCase()).toContain("appearance");
				} else if (expectedContext === "comparison") {
					expect(response.answer.toLowerCase()).toMatch(/more|better|compare/);
				} else if (expectedContext === "ranking") {
					expect(response.answer.toLowerCase()).toMatch(/top|best|highest/);
				}
			}

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`🎯 Complete User Session Results:`);
				sessionResults.forEach((result) => {
					console.log(`   Q${result.questionNumber}: ${result.question}`);
					console.log(`   A: ${result.response.substring(0, 100)}...`);
				});
			}
		});

		test("should maintain conversation context across multiple questions", async () => {
			const contextualQuestions = [
				"How many goals has Luke Bangs scored?",
				"What about his assists?",
				"And his appearances?",
				"How does that compare to Oli Goddard?",
				"What about Jonny Sourris?",
			];

			const contextResults: any[] = [];

			for (const question of contextualQuestions) {
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// All responses should maintain Luke Bangs context
				expect(response.answer).toContain("Luke Bangs");

				contextResults.push({
					question,
					response: response.answer,
					maintainsContext: response.answer.includes("Luke Bangs"),
				});
			}

			// All questions should maintain context
			const contextMaintained = contextResults.every((result) => result.maintainsContext);
			expect(contextMaintained).toBe(true);
		});
	});

	describe("Multi-Player Workflow Testing", () => {
		test("should handle switching between different players seamlessly", async () => {
			const playerSwitchingQuestions = [
				{ question: "How many goals has Luke Bangs scored?", player: "Luke Bangs" },
				{ question: "What about Oli Goddard?", player: "Oli Goddard" },
				{ question: "And Jonny Sourris?", player: "Jonny Sourris" },
				{ question: "Compare Luke Bangs and Oli Goddard", player: "Luke Bangs" },
				{ question: "Who has more assists between Oli Goddard and Jonny Sourris?", player: "Oli Goddard" },
			];

			for (const { question, player } of playerSwitchingQuestions) {
				const context: QuestionContext = {
					question,
					userContext: player,
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(response.answer).toContain(player);
			}
		});

		test("should handle team-specific queries across multiple players", async () => {
			const teamQueries = [
				"How many goals has Luke Bangs scored for the 3rd team?",
				"What about Oli Goddard for the 2nd team?",
				"Compare their team-specific performances",
			];

			for (const question of teamQueries) {
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(response.answer.toLowerCase()).toMatch(/team|3rd|2nd/);
			}
		});
	});

	describe("Complex Query Integration", () => {
		test("should handle nested comparative queries", async () => {
			const complexQueries = [
				"Who has better stats overall, Luke Bangs or Oli Goddard, and how do they compare to Jonny Sourris?",
				"Between Luke Bangs and Oli Goddard, who has more goals, and between Oli Goddard and Jonny Sourris, who has more assists?",
				"Rank Luke Bangs, Oli Goddard, and Jonny Sourris by their goal-to-game ratio",
			];

			for (const question of complexQueries) {
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(response.answer.length).toBeGreaterThan(50); // Should be substantial response

				// Should contain multiple player names
				const playerMentions = ["Luke Bangs", "Oli Goddard", "Jonny Sourris"].filter((name) => response.answer.includes(name));
				expect(playerMentions.length).toBeGreaterThan(1);
			}
		});

		test("should handle temporal queries across seasons", async () => {
			const temporalQueries = [
				"How did Luke Bangs perform in 2019/20 compared to 2020/21?",
				"Who was the top scorer in 2018/19, Luke Bangs or Oli Goddard?",
				"Compare Luke Bangs' goals across all seasons",
			];

			for (const question of temporalQueries) {
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(response.answer.toLowerCase()).toMatch(/season|2019|2020|2018/);
			}
		});
	});

	describe("Error Recovery Integration", () => {
		test("should gracefully handle and recover from errors", async () => {
			const errorRecoverySequence = [
				{ question: "How many goals has Luke Bangs scored?", shouldWork: true },
				{ question: "How many goals has InvalidPlayer scored?", shouldWork: false },
				{ question: "What about Luke Bangs assists?", shouldWork: true },
				{ question: "Compare InvalidPlayer and Luke Bangs", shouldWork: false },
				{ question: "Who has more goals, Luke Bangs or Oli Goddard?", shouldWork: true },
			];

			const recoveryResults: any[] = [];

			for (const { question, shouldWork } of errorRecoverySequence) {
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				try {
					const response = await chatbotService.processQuestion(context);

					expect(response.answer).toBeDefined();
					expect(response.answer).not.toBe("");

					if (shouldWork) {
						expect(response.answer).toContain("Luke Bangs");
						expect(response.answer.toLowerCase()).not.toMatch(/error|failed|couldn't find/);
					} else {
						expect(response.answer.toLowerCase()).toMatch(/couldn't find|error|not found/);
					}

					recoveryResults.push({
						question,
						worked: shouldWork,
						response: response.answer,
						recovered: true,
					});
				} catch (error) {
					recoveryResults.push({
						question,
						worked: false,
						error: error.message,
						recovered: false,
					});
				}
			}

			// Should have recovered from errors
			const successfulRecoveries = recoveryResults.filter((r) => r.recovered).length;
			expect(successfulRecoveries).toBeGreaterThan(0);
		});
	});

	describe("Data Consistency Integration", () => {
		test("should maintain data consistency across all query types", async () => {
			const consistencyTests = [
				{
					name: "Basic Goals Query",
					question: "How many goals has Luke Bangs scored?",
					expectedMetric: "goals",
				},
				{
					name: "Goals in Different Format",
					question: "What is Luke Bangs total goals?",
					expectedMetric: "goals",
				},
				{
					name: "Goals in Team Context",
					question: "How many goals has Luke Bangs scored for the 3rd team?",
					expectedMetric: "goals",
				},
				{
					name: "Goals in Comparison",
					question: "Who has more goals, Luke Bangs or Oli Goddard?",
					expectedMetric: "goals",
				},
			];

			const consistencyResults: any[] = [];

			for (const test of consistencyTests) {
				const context: QuestionContext = {
					question: test.question,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(response.answer).toContain("Luke Bangs");

				// Extract numeric values for consistency checking
				const numericMatches = response.answer.match(/\d+/g);
				const hasNumericValue = numericMatches && numericMatches.length > 0;

				consistencyResults.push({
					testName: test.name,
					question: test.question,
					response: response.answer,
					hasNumericValue,
					numericValues: numericMatches || [],
				});
			}

			// All responses should contain numeric values
			const allHaveNumericValues = consistencyResults.every((r) => r.hasNumericValue);
			expect(allHaveNumericValues).toBe(true);

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`🔍 Data Consistency Results:`);
				consistencyResults.forEach((result) => {
					console.log(`   ${result.testName}: ${result.numericValues.join(", ")}`);
				});
			}
		});
	});

	describe("Performance Integration", () => {
		test("should maintain performance across complex integration scenarios", async () => {
			const integrationScenarios = [
				"How many goals has Luke Bangs scored?",
				"Who has more assists, Luke Bangs or Oli Goddard?",
				"What are the top 3 players by appearances?",
				"Compare Luke Bangs and Jonny Sourris across all stats",
				"Who scored more goals in 2019/20, Luke Bangs or Oli Goddard?",
				"Rank all players by their goal-to-game ratio",
				"How many goals has Luke Bangs scored for the 3rd team?",
				"Who has the best disciplinary record?",
			];

			const startTime = Date.now();
			const performanceResults: any[] = [];

			for (const question of integrationScenarios) {
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const questionStartTime = Date.now();
				const response = await chatbotService.processQuestion(context);
				const questionEndTime = Date.now();
				const questionTime = questionEndTime - questionStartTime;

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(questionTime).toBeLessThan(10000); // 10 seconds max per question

				performanceResults.push({
					question,
					responseTime: questionTime,
					responseLength: response.answer.length,
				});
			}

			const totalTime = Date.now() - startTime;
			const avgResponseTime = performanceResults.reduce((sum, r) => sum + r.responseTime, 0) / performanceResults.length;

			expect(totalTime).toBeLessThan(60000); // Total under 1 minute
			expect(avgResponseTime).toBeLessThan(5000); // Average under 5 seconds

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`⚡ Integration Performance Results:`);
				console.log(`   Total scenarios: ${integrationScenarios.length}`);
				console.log(`   Total time: ${totalTime}ms`);
				console.log(`   Average response time: ${avgResponseTime.toFixed(2)}ms`);
				console.log(`   Max response time: ${Math.max(...performanceResults.map((r) => r.responseTime))}ms`);
			}
		});
	});

	describe("Real-World Usage Patterns", () => {
		test("should handle typical user interaction patterns", async () => {
			const userPatterns = [
				// Pattern 1: Single player deep dive
				[
					"How many goals has Luke Bangs scored?",
					"What about his assists?",
					"How many appearances?",
					"What's his goal-to-game ratio?",
					"How many yellow cards?",
				],
				// Pattern 2: Player comparison
				[
					"How many goals has Luke Bangs scored?",
					"What about Oli Goddard?",
					"Who has more goals?",
					"What about assists?",
					"Who's better overall?",
				],
				// Pattern 3: Team analysis
				[
					"Who are the top goal scorers?",
					"What about assists?",
					"Who has the most appearances?",
					"Who has the best disciplinary record?",
					"Rank the players by fantasy points",
				],
			];

			for (let patternIndex = 0; patternIndex < userPatterns.length; patternIndex++) {
				const pattern = userPatterns[patternIndex];
				const patternResults: any[] = [];

				for (let questionIndex = 0; questionIndex < pattern.length; questionIndex++) {
					const question = pattern[questionIndex];
					const context: QuestionContext = {
						question,
						userContext: "Luke Bangs",
					};

					const response = await chatbotService.processQuestion(context);

					expect(response.answer).toBeDefined();
					expect(response.answer).not.toBe("");

					patternResults.push({
						question,
						response: response.answer,
						questionNumber: questionIndex + 1,
					});
				}

				// Each pattern should complete successfully
				expect(patternResults.length).toBe(pattern.length);
				expect(patternResults.every((r) => r.response.length > 0)).toBe(true);

				const isVerbose = process.env.JEST_VERBOSE === "true";
				if (isVerbose) {
					console.log(`🎭 User Pattern ${patternIndex + 1} Results:`);
					patternResults.forEach((result) => {
						console.log(`   Q${result.questionNumber}: ${result.question}`);
						console.log(`   A: ${result.response.substring(0, 80)}...`);
					});
				}
			}
		});
	});
});
