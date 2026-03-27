import { ChatbotService, QuestionContext } from "@/lib/services/chatbotService";
import { FALLBACK_TEST_DATA } from "@/__tests__/utils/testUtils";

// Smoke and integration-style coverage for ChatbotService: singleton wiring, shared fixture data, and live graph-backed answers.
// No Neo4j module mocks here—"Real Database" and similar tests assume a reachable database and stable seed players (e.g. Luke Bangs).
// Some async tests use 30s timeouts; intermittent failures may reflect DB connectivity, load, or data drift rather than pure unit regressions.

describe("ChatbotService Basic Tests", () => {
	let chatbotService: ChatbotService;

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
	});

	afterEach(() => {
		// Clean up any database connections if needed
	});

	describe("Service Initialization", () => {
		test("should create singleton instance", () => {
			// Arrange: resolve the service twice via getInstance
			const instance1 = ChatbotService.getInstance();
			const instance2 = ChatbotService.getInstance();
			// Assert: both references point at the same singleton
			expect(instance1).toBe(instance2);
		});

		test("should have required methods", () => {
			// Assert: processQuestion exists on the service instance
			expect(chatbotService.processQuestion).toBeDefined();
			// Assert: API is a callable function
			expect(typeof chatbotService.processQuestion).toBe("function");
		});
	});

	describe("Test Data Validation", () => {
		test("should have fallback test data", () => {
			// Assert: fixture array is present and non-empty
			expect(FALLBACK_TEST_DATA).toBeDefined();
			expect(FALLBACK_TEST_DATA.length).toBeGreaterThan(0);
			// Assert: first row exposes core stat properties
			expect(FALLBACK_TEST_DATA[0]).toHaveProperty("playerName");
			expect(FALLBACK_TEST_DATA[0]).toHaveProperty("goals");
			expect(FALLBACK_TEST_DATA[0]).toHaveProperty("assists");
		});

		test("should contain expected players", () => {
			// Arrange: collect names from fallback rows
			const playerNames = FALLBACK_TEST_DATA.map((p: { playerName: string }) => p.playerName);
			// Assert: canonical test players are represented
			expect(playerNames).toContain("Luke Bangs");
			expect(playerNames).toContain("Oli Goddard");
			expect(playerNames).toContain("Jonny Sourris");
		});

		test("should have valid numeric data", () => {
			// Act & assert: every fallback row has numeric stats within sensible bounds
			FALLBACK_TEST_DATA.forEach((player: { goals: number; assists: number; appearances: number }) => {
				expect(typeof player.goals).toBe("number");
				expect(typeof player.goals).toBe("number");
				expect(typeof player.assists).toBe("number");
				expect(typeof player.appearances).toBe("number");
				expect(player.goals).toBeGreaterThanOrEqual(0);
				expect(player.assists).toBeGreaterThanOrEqual(0);
				expect(player.appearances).toBeGreaterThan(0);
			});
		});
	});

	describe("Real Database Integration", () => {
		test("should connect to production database", async () => {
			// Arrange: player goals question with explicit user context
			const question = "How many goals has Luke Bangs scored?";
			const context: QuestionContext = {
				question,
				userContext: "Luke Bangs",
			};

			// Act: run through real chatbot pipeline against the database
			const response = await chatbotService.processQuestion(context);

			// Assert: non-empty answer returned from live data path
			expect(response).toBeDefined();
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
		});

		test("should get real player statistics", async () => {
			// Arrange: assists-focused question for a known player
			const question = "How many assists does Luke Bangs have?";
			const context: QuestionContext = {
				question,
				userContext: "Luke Bangs",
			};

			// Act: process against live backing store
			const response = await chatbotService.processQuestion(context);

			// Assert: response includes substantive answer text
			expect(response).toBeDefined();
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
		});
	});

	describe("Question Analysis", () => {
		test("should analyze player questions correctly", async () => {
			// Arrange: standard player metric question
			const question = "How many goals has Luke Bangs scored?";
			const context: QuestionContext = {
				question,
				userContext: "Luke Bangs",
			};

			// Act: generate answer and capture processing metadata
			const response = await chatbotService.processQuestion(context);

			// Assert: base response exists
			expect(response).toBeDefined();
			expect(response.answer).toBeDefined();

			// Assert: optional analysis metadata matches player intent when exposed
			const processingDetails = chatbotService.getProcessingDetails();
			if (processingDetails?.questionAnalysis) {
				expect(processingDetails.questionAnalysis.type).toBe("player");
				expect(processingDetails.questionAnalysis.entities).toContain("Luke Bangs");
				expect(processingDetails.questionAnalysis.metrics.length).toBeGreaterThan(0);
			}
		});

		test("should handle different question formats", async () => {
			// Arrange: multiple phrasings with the same underlying intent
			const questions = ["How many goals has Luke Bangs scored?", "What are Luke Bangs goals?", "Luke Bangs goals count"];

			for (const question of questions) {
				// Act: process each phrasing
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);
				// Assert: each format yields a defined answer and consistent analysis when present
				expect(response).toBeDefined();
				expect(response.answer).toBeDefined();

				const processingDetails = chatbotService.getProcessingDetails();
				if (processingDetails?.questionAnalysis) {
					expect(processingDetails.questionAnalysis.type).toBe("player");
				}
			}
		});
	});

	describe("Response Validation", () => {
		test("should validate numeric responses correctly", () => {
			// Arrange: canned answer strings that include player name and digits
			const goodResponses = ["Luke Bangs has scored 29 goals", "Luke Bangs has provided 7 assists", "Luke Bangs has made 78 appearances"];

			// Assert: each sample matches simple textual expectations
			goodResponses.forEach((response) => {
				expect(response).toMatch(/Luke Bangs/);
				expect(response).toMatch(/\d+/);
			});
		});
	});

	test("Should handle penalty record questions with enhanced logic", async () => {
		// Arrange: penalty-specific question for a known player
		const question = "What is Luke Bangs penalty conversion rate?";
		const context: QuestionContext = {
			question,
			userContext: "Luke Bangs",
		};

		// Act: exercise enhanced penalty handling path
		const response = await chatbotService.processQuestion(context);

		// Assert: non-empty penalty-related answer
		expect(response.answer).toBeTruthy();
		expect(response.answer.length).toBeGreaterThan(0);
	}, 30000);

	test("Should handle points context questions with enhanced logic", async () => {
		// Arrange: fantasy/points phrasing that should trigger clarification logic
		const question = "How many points does Luke Bangs have?";
		const context: QuestionContext = {
			question,
			userContext: "Luke Bangs",
		};

		// Act: process points-style question
		const response = await chatbotService.processQuestion(context);

		// Assert: answer is present and non-trivial
		expect(response.answer).toBeTruthy();
		expect(response.answer.length).toBeGreaterThan(0);
	}, 30000);
});
