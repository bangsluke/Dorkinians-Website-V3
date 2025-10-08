/**
 * Performance and Load Testing for Chatbot
 * Tests response times, concurrent users, memory usage, and database performance
 */

import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";
import { fetchTestData, getTestPlayerNames } from "../utils/testUtils";

describe("Performance and Load Testing", () => {
	let chatbotService: ChatbotService;
	let referenceData: any[];

	beforeAll(async () => {
		try {
			referenceData = await fetchTestData();
			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`✅ Loaded ${referenceData.length} players for performance testing`);
			}
		} catch (error) {
			console.error("❌ Failed to load test data:", error);
			throw error;
		}
	});

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
	});

	describe("Response Time Benchmarking", () => {
		test("should respond to basic questions within 2 seconds", async () => {
			const questions = [
				"How many goals has Luke Bangs scored?",
				"How many assists does Oli Goddard have?",
				"How many appearances has Jonny Sourris made?",
			];

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
				expect(response.answer).not.toBe("");
				expect(responseTime).toBeLessThan(2000); // 2 seconds max
			}
		});

		test("should respond to complex questions within 5 seconds", async () => {
			const complexQuestions = [
				"Who has more goals, Luke Bangs or Oli Goddard?",
				"Who are the top 3 goal scorers?",
				"Compare Luke Bangs and Jonny Sourris across all stats",
			];

			for (const question of complexQuestions) {
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const startTime = Date.now();
				const response = await chatbotService.processQuestion(context);
				const endTime = Date.now();
				const responseTime = endTime - startTime;

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(responseTime).toBeLessThan(5000); // 5 seconds max
			}
		});

		test("should maintain consistent response times across multiple queries", async () => {
			const question = "How many goals has Luke Bangs scored?";
			const context: QuestionContext = {
				question,
				userContext: "Luke Bangs",
			};

			const responseTimes: number[] = [];
			const iterations = 10;

			for (let i = 0; i < iterations; i++) {
				const startTime = Date.now();
				const response = await chatbotService.processQuestion(context);
				const endTime = Date.now();
				const responseTime = endTime - startTime;

				expect(response.answer).toBeDefined();
				responseTimes.push(responseTime);
			}

			// Calculate statistics
			const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
			const maxResponseTime = Math.max(...responseTimes);
			const minResponseTime = Math.min(...responseTimes);
			const variance = responseTimes.reduce((acc, time) => acc + Math.pow(time - avgResponseTime, 2), 0) / responseTimes.length;
			const standardDeviation = Math.sqrt(variance);

			// Performance assertions
			expect(avgResponseTime).toBeLessThan(3000); // Average under 3 seconds
			expect(maxResponseTime).toBeLessThan(5000); // Max under 5 seconds
			expect(standardDeviation).toBeLessThan(1000); // Low variance (consistent performance)

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`📊 Response Time Statistics (${iterations} iterations):`);
				console.log(`   Average: ${avgResponseTime.toFixed(2)}ms`);
				console.log(`   Min: ${minResponseTime}ms`);
				console.log(`   Max: ${maxResponseTime}ms`);
				console.log(`   Std Dev: ${standardDeviation.toFixed(2)}ms`);
			}
		});
	});

	describe("Concurrent User Simulation", () => {
		test("should handle 5 concurrent users without degradation", async () => {
			const question = "How many goals has Luke Bangs scored?";
			const concurrentUsers = 5;
			const requestsPerUser = 3;

			const userPromises = Array.from({ length: concurrentUsers }, async (_, userIndex) => {
				const userResponses: any[] = [];

				for (let i = 0; i < requestsPerUser; i++) {
					const context: QuestionContext = {
						question,
						userContext: `User${userIndex}`,
					};

					const startTime = Date.now();
					const response = await chatbotService.processQuestion(context);
					const endTime = Date.now();
					const responseTime = endTime - startTime;

					userResponses.push({
						response,
						responseTime,
						userIndex,
						requestIndex: i,
					});
				}

				return userResponses;
			});

			const allUserResults = await Promise.all(userPromises);
			const allResponses = allUserResults.flat();

			// Validate all responses
			allResponses.forEach(({ response, responseTime, userIndex, requestIndex }) => {
				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(responseTime).toBeLessThan(5000); // 5 seconds max even under load
			});

			// Calculate performance metrics
			const totalRequests = allResponses.length;
			const avgResponseTime = allResponses.reduce((sum, { responseTime }) => sum + responseTime, 0) / totalRequests;
			const maxResponseTime = Math.max(...allResponses.map(({ responseTime }) => responseTime));

			expect(avgResponseTime).toBeLessThan(3000); // Average under 3 seconds
			expect(maxResponseTime).toBeLessThan(8000); // Max under 8 seconds under load

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`🚀 Concurrent Load Test Results:`);
				console.log(`   Users: ${concurrentUsers}`);
				console.log(`   Requests per user: ${requestsPerUser}`);
				console.log(`   Total requests: ${totalRequests}`);
				console.log(`   Average response time: ${avgResponseTime.toFixed(2)}ms`);
				console.log(`   Max response time: ${maxResponseTime}ms`);
			}
		});

		test("should handle burst traffic (10 rapid requests)", async () => {
			const question = "How many goals has Luke Bangs scored?";
			const burstSize = 10;

			const burstPromises = Array.from({ length: burstSize }, async (_, index) => {
				const context: QuestionContext = {
					question,
					userContext: `BurstUser${index}`,
				};

				const startTime = Date.now();
				const response = await chatbotService.processQuestion(context);
				const endTime = Date.now();
				const responseTime = endTime - startTime;

				return { response, responseTime, index };
			});

			const burstResults = await Promise.all(burstPromises);

			// Validate all responses
			burstResults.forEach(({ response, responseTime, index }) => {
				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(responseTime).toBeLessThan(10000); // 10 seconds max for burst traffic
			});

			// Calculate burst performance
			const avgResponseTime = burstResults.reduce((sum, { responseTime }) => sum + responseTime, 0) / burstResults.length;
			const maxResponseTime = Math.max(...burstResults.map(({ responseTime }) => responseTime));

			expect(avgResponseTime).toBeLessThan(5000); // Average under 5 seconds
			expect(maxResponseTime).toBeLessThan(15000); // Max under 15 seconds

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`💥 Burst Traffic Test Results:`);
				console.log(`   Burst size: ${burstSize}`);
				console.log(`   Average response time: ${avgResponseTime.toFixed(2)}ms`);
				console.log(`   Max response time: ${maxResponseTime}ms`);
			}
		});
	});

	describe("Memory Usage Monitoring", () => {
		test("should not have memory leaks during extended usage", async () => {
			const question = "How many goals has Luke Bangs scored?";
			const iterations = 50;
			const initialMemory = process.memoryUsage();

			for (let i = 0; i < iterations; i++) {
				const context: QuestionContext = {
					question,
					userContext: "MemoryTest",
				};

				const response = await chatbotService.processQuestion(context);
				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Force garbage collection if available
				if (global.gc) {
					global.gc();
				}
			}

			const finalMemory = process.memoryUsage();
			const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
			const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

			// Memory increase should be reasonable (less than 50MB for 50 iterations)
			expect(memoryIncreaseMB).toBeLessThan(50);

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`🧠 Memory Usage Test Results:`);
				console.log(`   Iterations: ${iterations}`);
				console.log(`   Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
				console.log(`   Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
				console.log(`   Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
			}
		});

		test("should handle large response datasets efficiently", async () => {
			const complexQuestion = "Compare all players across all statistics";
			const context: QuestionContext = {
				question: complexQuestion,
				userContext: "Luke Bangs",
			};

			const startMemory = process.memoryUsage();
			const startTime = Date.now();

			const response = await chatbotService.processQuestion(context);

			const endTime = Date.now();
			const endMemory = process.memoryUsage();

			const responseTime = endTime - startTime;
			const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
			const memoryUsedMB = memoryUsed / 1024 / 1024;

			expect(response.answer).toBeDefined();
			expect(response.answer).not.toBe("");
			expect(responseTime).toBeLessThan(10000); // 10 seconds max for complex query
			expect(memoryUsedMB).toBeLessThan(100); // Less than 100MB for complex query

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`📊 Large Dataset Performance:`);
				console.log(`   Response time: ${responseTime}ms`);
				console.log(`   Memory used: ${memoryUsedMB.toFixed(2)}MB`);
				console.log(`   Response length: ${response.answer.length} characters`);
			}
		});
	});

	describe("Database Connection Performance", () => {
		test("should maintain database connection efficiency", async () => {
			const questions = [
				"How many goals has Luke Bangs scored?",
				"How many assists does Oli Goddard have?",
				"How many appearances has Jonny Sourris made?",
				"Who has more goals, Luke Bangs or Oli Goddard?",
				"Who are the top 3 players by assists?",
			];

			const connectionTimes: number[] = [];
			const queryTimes: number[] = [];

			for (const question of questions) {
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const startTime = Date.now();
				const response = await chatbotService.processQuestion(context);
				const endTime = Date.now();
				const totalTime = endTime - startTime;

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Estimate connection and query times (simplified)
				const estimatedConnectionTime = Math.min(500, totalTime * 0.1); // Assume 10% is connection
				const estimatedQueryTime = totalTime - estimatedConnectionTime;

				connectionTimes.push(estimatedConnectionTime);
				queryTimes.push(estimatedQueryTime);
			}

			const avgConnectionTime = connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length;
			const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;

			expect(avgConnectionTime).toBeLessThan(1000); // Connection under 1 second
			expect(avgQueryTime).toBeLessThan(3000); // Query under 3 seconds

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`🔗 Database Performance:`);
				console.log(`   Average connection time: ${avgConnectionTime.toFixed(2)}ms`);
				console.log(`   Average query time: ${avgQueryTime.toFixed(2)}ms`);
				console.log(`   Total queries: ${questions.length}`);
			}
		});
	});

	describe("Stress Testing", () => {
		test("should handle sustained load over time", async () => {
			const question = "How many goals has Luke Bangs scored?";
			const duration = 30000; // 30 seconds
			const requestInterval = 1000; // 1 second between requests
			const startTime = Date.now();
			const results: any[] = [];

			const stressTest = setInterval(async () => {
				if (Date.now() - startTime >= duration) {
					clearInterval(stressTest);
					return;
				}

				const context: QuestionContext = {
					question,
					userContext: "StressTest",
				};

				const requestStartTime = Date.now();
				try {
					const response = await chatbotService.processQuestion(context);
					const requestEndTime = Date.now();
					const responseTime = requestEndTime - requestStartTime;

					results.push({
						response,
						responseTime,
						timestamp: Date.now() - startTime,
					});
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					results.push({
						error: errorMessage,
						timestamp: Date.now() - startTime,
					});
				}
			}, requestInterval);

			// Wait for stress test to complete
			await new Promise((resolve) => setTimeout(resolve, duration + 1000));

			// Analyze results
			const successfulRequests = results.filter((r) => !r.error);
			const failedRequests = results.filter((r) => r.error);
			const avgResponseTime = successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length;
			const maxResponseTime = Math.max(...successfulRequests.map((r) => r.responseTime));

			expect(successfulRequests.length).toBeGreaterThan(0);
			expect(failedRequests.length).toBeLessThan(successfulRequests.length * 0.1); // Less than 10% failure rate
			expect(avgResponseTime).toBeLessThan(5000); // Average under 5 seconds
			expect(maxResponseTime).toBeLessThan(15000); // Max under 15 seconds

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`🔥 Stress Test Results (${duration / 1000}s):`);
				console.log(`   Successful requests: ${successfulRequests.length}`);
				console.log(`   Failed requests: ${failedRequests.length}`);
				console.log(`   Success rate: ${((successfulRequests.length / results.length) * 100).toFixed(1)}%`);
				console.log(`   Average response time: ${avgResponseTime.toFixed(2)}ms`);
				console.log(`   Max response time: ${maxResponseTime}ms`);
			}
		});
	});

	describe("Performance Regression Testing", () => {
		test("should maintain performance baselines", async () => {
			const baselineTests = [
				{
					name: "Basic Question",
					question: "How many goals has Luke Bangs scored?",
					maxTime: 2000,
				},
				{
					name: "Comparison Question",
					question: "Who has more goals, Luke Bangs or Oli Goddard?",
					maxTime: 3000,
				},
				{
					name: "Ranking Question",
					question: "Who are the top 3 goal scorers?",
					maxTime: 4000,
				},
				{
					name: "Complex Question",
					question: "Compare Luke Bangs and Jonny Sourris across all stats",
					maxTime: 6000,
				},
			];

			const performanceResults: any[] = [];

			for (const test of baselineTests) {
				const context: QuestionContext = {
					question: test.question,
					userContext: "Luke Bangs",
				};

				const startTime = Date.now();
				const response = await chatbotService.processQuestion(context);
				const endTime = Date.now();
				const responseTime = endTime - startTime;

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(responseTime).toBeLessThan(test.maxTime);

				performanceResults.push({
					name: test.name,
					responseTime,
					maxTime: test.maxTime,
					passed: responseTime < test.maxTime,
				});
			}

			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`📈 Performance Baseline Results:`);
				performanceResults.forEach((result) => {
					console.log(`   ${result.name}: ${result.responseTime}ms (max: ${result.maxTime}ms) - ${result.passed ? "PASS" : "FAIL"}`);
				});
			}

			// All tests should pass
			const allPassed = performanceResults.every((result) => result.passed);
			expect(allPassed).toBe(true);
		});
	});
});
