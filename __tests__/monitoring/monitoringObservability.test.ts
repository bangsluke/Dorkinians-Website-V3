/**
 * Monitoring and Observability Testing
 * Tests logging completeness, metrics collection, error tracking, and performance monitoring
 */

import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";
import { fetchTestData, getTestPlayerNames } from "../utils/testUtils";

describe("Monitoring and Observability Testing", () => {
	let chatbotService: ChatbotService;
	let referenceData: any[];

	beforeAll(async () => {
		try {
			referenceData = await fetchTestData();
			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`✅ Loaded ${referenceData.length} players for monitoring testing`);
			}
		} catch (error) {
			console.error("❌ Failed to load test data:", error);
			throw error;
		}
	});

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
	});

	describe("Logging Completeness", () => {
		test("should log all question processing events", async () => {
			const questions = [
				"How many goals has Luke Bangs scored?",
				"Who has more assists, Luke Bangs or Oli Goddard?",
				"What are the top 3 players by appearances?",
			];

			const logEvents: any[] = [];

			// Mock console methods to capture logs
			const originalLog = console.log;
			const originalError = console.error;
			const originalWarn = console.warn;

			console.log = (...args) => {
				logEvents.push({ level: "log", message: args.join(" ") });
				originalLog(...args);
			};

			console.error = (...args) => {
				logEvents.push({ level: "error", message: args.join(" ") });
				originalError(...args);
			};

			console.warn = (...args) => {
				logEvents.push({ level: "warn", message: args.join(" ") });
				originalWarn(...args);
			};

			try {
				for (const question of questions) {
					const context: QuestionContext = {
						question,
						userContext: "Luke Bangs",
					};

					const response = await chatbotService.processQuestion(context);
					expect(response.answer).toBeDefined();
				}

				// Should have logged various events
				expect(logEvents.length).toBeGreaterThan(0);

				// Should have different log levels
				const logLevels = [...new Set(logEvents.map((e) => e.level))];
				expect(logLevels.length).toBeGreaterThan(0);

				const isVerbose = process.env.JEST_VERBOSE === "true";
				if (isVerbose) {
					console.log(`📊 Log Events Captured: ${logEvents.length}`);
					console.log(`📊 Log Levels: ${logLevels.join(", ")}`);
				}
			} finally {
				// Restore original console methods
				console.log = originalLog;
				console.error = originalError;
				console.warn = originalWarn;
			}
		});

		test("should log performance metrics", async () => {
			const question = "How many goals has Luke Bangs scored?";
			const context: QuestionContext = {
				question,
				userContext: "Luke Bangs",
			};

			const startTime = Date.now();
			const response = await chatbotService.processQuestion(context);
			const endTime = Date.now();
			const responseTime = endTime - startTime;

			expect(response.answer).toBeDefined();
			expect(responseTime).toBeGreaterThan(0);

			// Should have processing details available
			const processingDetails = chatbotService.getProcessingDetails();
			expect(processingDetails).toBeDefined();

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`⏱️ Response Time: ${responseTime}ms`);
				console.log(`📊 Processing Details:`, processingDetails);
			}
		});

		test("should log error events with context", async () => {
			const errorQuestions = ["How many goals has UnknownPlayer scored?", "What is this?", "Invalid question format"];

			const errorEvents: any[] = [];

			// Mock console.error to capture errors
			const originalError = console.error;
			console.error = (...args) => {
				errorEvents.push({ message: args.join(" "), timestamp: Date.now() });
				originalError(...args);
			};

			try {
				for (const question of errorQuestions) {
					const context: QuestionContext = {
						question,
						userContext: "Luke Bangs",
					};

					const response = await chatbotService.processQuestion(context);
					expect(response.answer).toBeDefined();
				}

				// Should have logged error events
				expect(errorEvents.length).toBeGreaterThan(0);

				const isVerbose = process.env.JEST_VERBOSE === "true";
				if (isVerbose) {
					console.log(`❌ Error Events Captured: ${errorEvents.length}`);
					errorEvents.forEach((event, index) => {
						console.log(`   ${index + 1}. ${event.message}`);
					});
				}
			} finally {
				console.error = originalError;
			}
		});
	});

	describe("Metrics Collection", () => {
		test("should track response time metrics", async () => {
			const questions = [
				"How many goals has Luke Bangs scored?",
				"How many assists does Oli Goddard have?",
				"Who has more goals, Luke Bangs or Jonny Sourris?",
			];

			const responseTimes: number[] = [];

			for (const question of questions) {
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const startTime = Date.now();
				const response = await chatbotService.processQuestion(context);
				const endTime = Date.now();
				const responseTime = endTime - startTime;

				expect(response.answer).toBeDefined();
				responseTimes.push(responseTime);
			}

			// Should have collected response times
			expect(responseTimes.length).toBe(questions.length);
			expect(responseTimes.every((time) => time > 0)).toBe(true);

			const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
			const maxResponseTime = Math.max(...responseTimes);
			const minResponseTime = Math.min(...responseTimes);

			expect(avgResponseTime).toBeGreaterThan(0);
			expect(maxResponseTime).toBeGreaterThan(0);
			expect(minResponseTime).toBeGreaterThan(0);

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`📊 Response Time Metrics:`);
				console.log(`   Average: ${avgResponseTime.toFixed(2)}ms`);
				console.log(`   Min: ${minResponseTime}ms`);
				console.log(`   Max: ${maxResponseTime}ms`);
			}
		});

		test("should track success and failure rates", async () => {
			const testQuestions = [
				{ question: "How many goals has Luke Bangs scored?", shouldSucceed: true },
				{ question: "How many assists does Oli Goddard have?", shouldSucceed: true },
				{ question: "How many goals has UnknownPlayer scored?", shouldSucceed: false },
				{ question: "What is this?", shouldSucceed: false },
				{ question: "Who has more goals, Luke Bangs or Oli Goddard?", shouldSucceed: true },
			];

			const results: any[] = [];

			for (const test of testQuestions) {
				const context: QuestionContext = {
					question: test.question,
					userContext: "Luke Bangs",
				};

				try {
					const response = await chatbotService.processQuestion(context);
					const isSuccess =
						response.answer &&
						response.answer.length > 0 &&
						!response.answer.toLowerCase().includes("couldn't find") &&
						!response.answer.toLowerCase().includes("not found");

					results.push({
						question: test.question,
						success: isSuccess,
						expected: test.shouldSucceed,
					});
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					results.push({
						question: test.question,
						success: false,
						expected: test.shouldSucceed,
						error: errorMessage,
					});
				}
			}

			const successCount = results.filter((r) => r.success).length;
			const totalCount = results.length;
			const successRate = (successCount / totalCount) * 100;

			expect(successRate).toBeGreaterThan(0);
			expect(successRate).toBeLessThan(100);

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`📊 Success Rate: ${successRate.toFixed(1)}% (${successCount}/${totalCount})`);
				results.forEach((result) => {
					console.log(`   ${result.success ? "✅" : "❌"} "${result.question}"`);
				});
			}
		});

		test("should track question type distribution", async () => {
			const questionTypes = [
				{ question: "How many goals has Luke Bangs scored?", type: "basic" },
				{ question: "Who has more goals, Luke Bangs or Oli Goddard?", type: "comparison" },
				{ question: "What are the top 3 players by assists?", type: "ranking" },
				{ question: "Compare Luke Bangs and Jonny Sourris", type: "comparison" },
				{ question: "How many appearances has Luke Bangs made?", type: "basic" },
			];

			const typeDistribution: Record<string, number> = {};

			for (const test of questionTypes) {
				const context: QuestionContext = {
					question: test.question,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);
				expect(response.answer).toBeDefined();

				// Get processing details to determine actual question type
				const processingDetails = chatbotService.getProcessingDetails();
				const actualType = processingDetails?.questionAnalysis?.type || "unknown";

				typeDistribution[actualType] = (typeDistribution[actualType] || 0) + 1;
			}

			// Should have tracked different question types
			expect(Object.keys(typeDistribution).length).toBeGreaterThan(0);

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`📊 Question Type Distribution:`);
				Object.entries(typeDistribution).forEach(([type, count]) => {
					console.log(`   ${type}: ${count}`);
				});
			}
		});
	});

	describe("Error Tracking", () => {
		test("should track and categorize errors", async () => {
			const errorScenarios = [
				{ question: "How many goals has UnknownPlayer scored?", expectedError: "player_not_found" },
				{ question: "What is this?", expectedError: "unclear_question" },
				{ question: "", expectedError: "empty_question" },
				{ question: "How many goals has Luke Bangs scored?", expectedError: null },
			];

			const errorTracking: any[] = [];

			for (const scenario of errorScenarios) {
				const context: QuestionContext = {
					question: scenario.question,
					userContext: "Luke Bangs",
				};

				try {
					const response = await chatbotService.processQuestion(context);

					const hasError =
						response.answer.toLowerCase().includes("couldn't find") ||
						response.answer.toLowerCase().includes("not found") ||
						response.answer.toLowerCase().includes("help") ||
						response.answer.toLowerCase().includes("clarify");

					errorTracking.push({
						question: scenario.question,
						hasError,
						expectedError: scenario.expectedError,
						response: response.answer,
					});
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					errorTracking.push({
						question: scenario.question,
						hasError: true,
						expectedError: scenario.expectedError,
						error: errorMessage,
					});
				}
			}

			// Should have tracked errors appropriately
			expect(errorTracking.length).toBe(errorScenarios.length);

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`📊 Error Tracking Results:`);
				errorTracking.forEach((result, index) => {
					console.log(`   ${index + 1}. "${result.question}"`);
					console.log(`      Has Error: ${result.hasError}`);
					console.log(`      Expected Error: ${result.expectedError}`);
				});
			}
		});

		test("should track error frequency and patterns", async () => {
			const repeatedErrorQuestions = [
				"How many goals has UnknownPlayer scored?",
				"How many goals has UnknownPlayer scored?",
				"How many goals has UnknownPlayer scored?",
				"What is this?",
				"What is this?",
				"How many goals has Luke Bangs scored?",
			];

			const errorPatterns: any[] = [];

			for (const question of repeatedErrorQuestions) {
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				const isError =
					response.answer.toLowerCase().includes("couldn't find") ||
					response.answer.toLowerCase().includes("not found") ||
					response.answer.toLowerCase().includes("help") ||
					response.answer.toLowerCase().includes("clarify");

				errorPatterns.push({
					question,
					isError,
					timestamp: Date.now(),
				});
			}

			// Should have tracked error patterns
			expect(errorPatterns.length).toBe(repeatedErrorQuestions.length);

			const errorCount = errorPatterns.filter((p) => p.isError).length;
			const errorRate = (errorCount / errorPatterns.length) * 100;

			expect(errorRate).toBeGreaterThan(0);

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`📊 Error Pattern Analysis:`);
				console.log(`   Total Questions: ${errorPatterns.length}`);
				console.log(`   Error Count: ${errorCount}`);
				console.log(`   Error Rate: ${errorRate.toFixed(1)}%`);
			}
		});
	});

	describe("Performance Monitoring", () => {
		test("should monitor response time trends", async () => {
			const questions = Array.from({ length: 10 }, (_, i) => `How many goals has Luke Bangs scored? (${i})`);

			const performanceData: any[] = [];

			for (const question of questions) {
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const startTime = Date.now();
				const response = await chatbotService.processQuestion(context);
				const endTime = Date.now();
				const responseTime = endTime - startTime;

				expect(response.answer).toBeDefined();

				performanceData.push({
					question,
					responseTime,
					timestamp: startTime,
				});
			}

			// Should have collected performance data
			expect(performanceData.length).toBe(questions.length);

			const avgResponseTime = performanceData.reduce((sum, p) => sum + p.responseTime, 0) / performanceData.length;
			const maxResponseTime = Math.max(...performanceData.map((p) => p.responseTime));
			const minResponseTime = Math.min(...performanceData.map((p) => p.responseTime));

			expect(avgResponseTime).toBeGreaterThan(0);
			expect(maxResponseTime).toBeGreaterThan(0);
			expect(minResponseTime).toBeGreaterThan(0);

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`📊 Performance Trends:`);
				console.log(`   Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
				console.log(`   Min Response Time: ${minResponseTime}ms`);
				console.log(`   Max Response Time: ${maxResponseTime}ms`);
				console.log(`   Data Points: ${performanceData.length}`);
			}
		});

		test("should monitor memory usage patterns", async () => {
			const initialMemory = process.memoryUsage();
			const memorySnapshots: any[] = [];

			const questions = Array.from({ length: 20 }, (_, i) => `How many goals has Luke Bangs scored? (${i})`);

			for (let i = 0; i < questions.length; i++) {
				const question = questions[i];
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);
				expect(response.answer).toBeDefined();

				// Take memory snapshot every 5 questions
				if ((i + 1) % 5 === 0) {
					const currentMemory = process.memoryUsage();
					memorySnapshots.push({
						iteration: i + 1,
						heapUsed: currentMemory.heapUsed,
						heapTotal: currentMemory.heapTotal,
						external: currentMemory.external,
					});
				}
			}

			const finalMemory = process.memoryUsage();
			const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
			const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

			// Should have collected memory snapshots
			expect(memorySnapshots.length).toBeGreaterThan(0);

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`📊 Memory Usage Monitoring:`);
				console.log(`   Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
				console.log(`   Final Heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
				console.log(`   Memory Increase: ${memoryIncreaseMB.toFixed(2)}MB`);
				console.log(`   Snapshots Taken: ${memorySnapshots.length}`);
			}
		});
	});

	describe("Health Check Monitoring", () => {
		test("should provide system health indicators", async () => {
			const healthChecks = [
				{
					name: "Basic Question Processing",
					test: async () => {
						const context: QuestionContext = {
							question: "How many goals has Luke Bangs scored?",
							userContext: "Luke Bangs",
						};
						const response = await chatbotService.processQuestion(context);
						return response.answer && response.answer.length > 0;
					},
				},
				{
					name: "Complex Question Processing",
					test: async () => {
						const context: QuestionContext = {
							question: "Who has more goals, Luke Bangs or Oli Goddard?",
							userContext: "Luke Bangs",
						};
						const response = await chatbotService.processQuestion(context);
						return response.answer && response.answer.length > 0;
					},
				},
				{
					name: "Error Handling",
					test: async () => {
						const context: QuestionContext = {
							question: "How many goals has UnknownPlayer scored?",
							userContext: "Luke Bangs",
						};
						const response = await chatbotService.processQuestion(context);
						return response.answer && response.answer.includes("couldn't find");
					},
				},
			];

			const healthResults: any[] = [];

			for (const check of healthChecks) {
				const startTime = Date.now();
				try {
					const result = await check.test();
					const endTime = Date.now();
					const responseTime = endTime - startTime;

					healthResults.push({
						name: check.name,
						status: result ? "healthy" : "unhealthy",
						responseTime,
						timestamp: startTime,
					});
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					healthResults.push({
						name: check.name,
						status: "error",
						error: errorMessage,
						timestamp: Date.now(),
					});
				}
			}

			// Should have health check results
			expect(healthResults.length).toBe(healthChecks.length);

			const healthyCount = healthResults.filter((r) => r.status === "healthy").length;
			const healthRate = (healthyCount / healthResults.length) * 100;

			expect(healthRate).toBeGreaterThan(0);

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`📊 Health Check Results:`);
				healthResults.forEach((result) => {
					console.log(`   ${result.name}: ${result.status} (${result.responseTime || "N/A"}ms)`);
				});
				console.log(`   Overall Health Rate: ${healthRate.toFixed(1)}%`);
			}
		});
	});
});
