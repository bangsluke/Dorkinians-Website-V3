/**
 * Individual Question Verification Tests
 * 
 * This file is designed for testing specific chatbot questions during development and verification.
 * Add test cases here to verify fixes for individual questions.
 * 
 * Usage:
 *   npm test -- __tests__/test-individual-questions.test.ts
 *   npm test -- __tests__/test-individual-questions.test.ts -t "specific test name"
 * 
 * To add a new test case:
 *   1. Add a new test() block below
 *   2. Set question, userContext, and expectedAnswer (if known)
 *   3. Add any specific assertions needed
 */

import { ChatbotService, QuestionContext } from "@/lib/services/chatbotService";

interface TestCase {
	question: string;
	userContext?: string;
	expectedAnswer?: string | RegExp;
	expectedAnswerContains?: string[];
	expectedAnswerNotContains?: string[];
	expectedCypherPattern?: RegExp;
	description?: string;
}

describe("Individual Question Verification Tests", () => {
	let chatbotService: ChatbotService;

	beforeAll(() => {
		chatbotService = ChatbotService.getInstance();
	});

	// Helper function to run a test case
	async function runTestCase(testCase: TestCase) {
		const context: QuestionContext = {
			question: testCase.question,
			userContext: testCase.userContext,
		};

		const response = await chatbotService.processQuestion(context);

		// Log the results for debugging
		console.log("\n" + "=".repeat(80));
		console.log(`QUESTION: ${testCase.question}`);
		if (testCase.userContext) {
			console.log(`USER CONTEXT: ${testCase.userContext}`);
		}
		console.log("=".repeat(80));
		console.log(`ANSWER: ${response.answer}`);
		console.log();
		if (response.cypherQuery) {
			console.log("CYPHER QUERY:");
			console.log(response.cypherQuery);
			console.log();
		}
		if (response.sources && response.sources.length > 0) {
			console.log(`SOURCES: ${response.sources.join(", ")}`);
			console.log();
		}
		console.log("=".repeat(80));

		// Basic assertions
		expect(response).toBeDefined();
		expect(response.answer).toBeDefined();
		expect(response.answer).not.toContain("unable to access");
		expect(response.answer).not.toContain("Database error");

		// Custom assertions
		if (testCase.expectedAnswer) {
			if (testCase.expectedAnswer instanceof RegExp) {
				expect(response.answer).toMatch(testCase.expectedAnswer);
			} else {
				expect(response.answer).toBe(testCase.expectedAnswer);
			}
		}

		if (testCase.expectedAnswerContains) {
			testCase.expectedAnswerContains.forEach((text) => {
				expect(response.answer).toContain(text);
			});
		}

		if (testCase.expectedAnswerNotContains) {
			testCase.expectedAnswerNotContains.forEach((text) => {
				expect(response.answer).not.toContain(text);
			});
		}

		if (testCase.expectedCypherPattern && response.cypherQuery) {
			expect(response.cypherQuery).toMatch(testCase.expectedCypherPattern);
		}

		return response;
	}

	// ============================================================================
	// Team-Specific Goals Tests - All Teams for Luke Bangs
	// ============================================================================

	test("How many goals has Luke Bangs scored for the 1s?", async () => {
		const response = await runTestCase({
			question: "How many goals has Luke Bangs scored for the 1s?",
			userContext: "Luke Bangs",
			expectedAnswerContains: ["Luke Bangs", "goals", "1"],
			expectedAnswerNotContains: ["open play", "Database error"],
			expectedCypherPattern: /md\.team.*1st XI/i,
		});
		// Verify penalties are included in the query
		if (response.cypherQuery) {
			expect(response.cypherQuery).toMatch(/penaltiesScored/i);
		}
		// Verify zero-value handling works (should say "has not scored" not "has scored 0")
		if (response.answer.includes("0")) {
			expect(response.answer).toMatch(/has not scored any goals/i);
		}
	});

	test("What is the goal count of Luke Bangs for the 2nd team?", async () => {
		const response = await runTestCase({
			question: "What is the goal count of Luke Bangs for the 2nd team?",
			userContext: "Luke Bangs",
			expectedAnswerContains: ["Luke Bangs", "goals", "2"],
			expectedAnswerNotContains: ["Database error", "couldn't find a player named"],
		});
		// Verify penalties are included in the query
		if (response.cypherQuery) {
			expect(response.cypherQuery).toMatch(/penaltiesScored/i);
		}
		// Verify zero-value handling works
		if (response.answer.includes("0")) {
			expect(response.answer).toMatch(/has not scored any goals/i);
		}
	});

	test("How many goals in total has Luke Bangs scored for the 3s?", async () => {
		const response = await runTestCase({
			question: "How many goals in total has Luke Bangs scored for the 3s?",
			userContext: "Luke Bangs",
			expectedAnswerContains: ["Luke Bangs", "goals", "3"],
			expectedAnswerNotContains: ["open play", "Database error"],
		});
		// Verify penalties are included in the query
		if (response.cypherQuery) {
			expect(response.cypherQuery).toMatch(/penaltiesScored/i);
		}
		// Verify zero-value handling works
		if (response.answer.includes("0")) {
			expect(response.answer).toMatch(/has not scored any goals/i);
		}
	});

	test("How many goals have I scored for the 4s?", async () => {
		const response = await runTestCase({
			question: "How many goals have I scored for the 4s?",
			userContext: "Luke Bangs",
			expectedAnswerContains: ["Luke Bangs", "goals", "4"],
			expectedAnswerNotContains: ["open play", "Database error"],
		});
		// Verify penalties are included in the query
		if (response.cypherQuery) {
			expect(response.cypherQuery).toMatch(/penaltiesScored/i);
		}
		// Verify zero-value handling works
		if (response.answer.includes("0")) {
			expect(response.answer).toMatch(/has not scored any goals/i);
		}
	});

	test("How many goals has Luke Bangs scored for the 5th XI?", async () => {
		const response = await runTestCase({
			question: "How many goals has Luke Bangs scored for the 5th XI?",
			userContext: "Luke Bangs",
			expectedAnswerContains: ["Luke Bangs", "goals", "5"],
			expectedAnswerNotContains: ["open play", "Database error"],
			expectedCypherPattern: /md\.team.*5th XI/i,
		});
		// Verify penalties are included in the query
		if (response.cypherQuery) {
			expect(response.cypherQuery).toMatch(/penaltiesScored/i);
		}
		// Verify zero-value handling works
		if (response.answer.includes("0")) {
			expect(response.answer).toMatch(/has not scored any goals/i);
		}
	});

	test("How many goals have I got for the 5s?", async () => {
		await runTestCase({
			question: "How many goals have I got for the 5s?",
			userContext: "Luke Bangs",
			expectedAnswerContains: ["Luke Bangs", "goals", "5"],
			expectedAnswerNotContains: ["open play", "Database error"],
		});
	});

	test("What are the goal stats for Luke Bangs for the 6s?", async () => {
		const response = await runTestCase({
			question: "What are the goal stats for Luke Bangs for the 6s?",
			userContext: "Luke Bangs",
			expectedAnswerContains: ["Luke Bangs", "goals", "6"],
			expectedAnswerNotContains: ["Database error", "couldn't find a player named"],
		});
		// Verify penalties are included in the query
		if (response.cypherQuery) {
			expect(response.cypherQuery).toMatch(/penaltiesScored/i);
		}
		// Verify zero-value handling works
		if (response.answer.includes("0")) {
			expect(response.answer).toMatch(/has not scored any goals/i);
		}
	});

	test("How many goals have Luke Bangs got for the 7s?", async () => {
		const response = await runTestCase({
			question: "How many goals have Luke Bangs got for the 7s?",
			userContext: "Luke Bangs",
			expectedAnswerContains: ["Luke Bangs", "goals", "7"],
			expectedAnswerNotContains: ["open play", "Database error"],
		});
		// Verify penalties are included in the query
		if (response.cypherQuery) {
			expect(response.cypherQuery).toMatch(/penaltiesScored/i);
		}
		// Verify zero-value handling works
		if (response.answer.includes("0")) {
			expect(response.answer).toMatch(/has not scored any goals/i);
		}
	});

	test("How many goals has Luke Bangs scored for the 8s?", async () => {
		const response = await runTestCase({
			question: "How many goals has Luke Bangs scored for the 8s?",
			userContext: "Luke Bangs",
			expectedAnswerContains: ["Luke Bangs", "goals", "8"],
			expectedAnswerNotContains: ["open play", "Database error"],
		});
		// Verify penalties are included in the query
		if (response.cypherQuery) {
			expect(response.cypherQuery).toMatch(/penaltiesScored/i);
		}
		// Verify zero-value handling works
		if (response.answer.includes("0")) {
			expect(response.answer).toMatch(/has not scored any goals/i);
		}
	});

	// ============================================================================
	// Total Games/Appearances Tests
	// ============================================================================

	test("How many games have I played?", async () => {
		await runTestCase({
			question: "How many games have I played?",
			userContext: "Luke Bangs",
			expectedAnswerContains: ["Luke Bangs", "games"],
			expectedAnswerNotContains: ["home games", "away games"],
			description: "Should return total games, not home games",
		});
	});

	// ============================================================================
	// Most Goals For Team Tests
	// ============================================================================

	test("Which team has Luke Bangs scored the most goals for?", async () => {
		await runTestCase({
			question: "Which team has Luke Bangs scored the most goals for?",
			userContext: "Luke Bangs",
			expectedAnswerContains: ["Luke Bangs", "scored the most goals"],
			expectedAnswerNotContains: ["Database error"],
			expectedCypherPattern: /ORDER BY.*DESC/i,
			description: "Should return team name with goal count in parentheses",
		});
	});

	// ============================================================================
	// Minutes Per Clean Sheet Test
	// ============================================================================

	test("On average, how many minutes does Luke Bangs need to get a clean sheet?", async () => {
		const response = await runTestCase({
			question: "On average, how many minutes does Luke Bangs need to get a clean sheet?",
			userContext: "Luke Bangs",
			expectedAnswerContains: ["Luke Bangs", "minutes", "clean sheet"],
			expectedAnswerNotContains: ["Database error"],
			expectedCypherPattern: /sum\(coalesce\(md\.cleanSheets/i,
			description: "Should return 458 (15,126 minutes / 33 clean sheets)",
		});
		// Verify the query uses MatchDetail cleanSheets, not Fixture conceded
		if (response.cypherQuery) {
			expect(response.cypherQuery).toMatch(/md\.cleanSheets/i);
			expect(response.cypherQuery).not.toMatch(/f\.conceded.*=.*0/i);
		}
	});

	// ============================================================================
	// Fantasy Points Per Appearance Test
	// ============================================================================

	test("How many fantasy points does Luke Bangs score per appearance?", async () => {
		const response = await runTestCase({
			question: "How many fantasy points does Luke Bangs score per appearance?",
			userContext: "Luke Bangs",
			expectedAnswerContains: ["Luke Bangs", "fantasy points", "appearance"],
			expectedAnswerNotContains: ["Database error", "appearances"],
			expectedCypherPattern: /sum\(coalesce\(md\.fantasyPoints/i,
			description: "Should return 3.5 (624.12 fantasy points / 179 appearances)",
		});
		// Verify the query calculates fantasy points per appearance
		if (response.cypherQuery) {
			expect(response.cypherQuery).toMatch(/md\.fantasyPoints/i);
			expect(response.cypherQuery).toMatch(/count\(md\)/i);
		}
	});

	// ============================================================================
	// Add more test cases below as needed
	// ============================================================================
});

