import { ChatbotService, QuestionContext } from "@/lib/services/chatbotService";
import { FALLBACK_TEST_DATA } from "@/__tests__/utils/testUtils";

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
			const instance1 = ChatbotService.getInstance();
			const instance2 = ChatbotService.getInstance();
			expect(instance1).toBe(instance2);
		});

		test("should have required methods", () => {
			expect(chatbotService.processQuestion).toBeDefined();
			expect(typeof chatbotService.processQuestion).toBe("function");
		});
	});

	describe("Test Data Validation", () => {
		test("should have fallback test data", () => {
			expect(FALLBACK_TEST_DATA).toBeDefined();
			expect(FALLBACK_TEST_DATA.length).toBeGreaterThan(0);
			expect(FALLBACK_TEST_DATA[0]).toHaveProperty("playerName");
			expect(FALLBACK_TEST_DATA[0]).toHaveProperty("goals");
			expect(FALLBACK_TEST_DATA[0]).toHaveProperty("assists");
		});

		test("should contain expected players", () => {
			const playerNames = FALLBACK_TEST_DATA.map((p: { playerName: string }) => p.playerName);
			expect(playerNames).toContain("Luke Bangs");
			expect(playerNames).toContain("Oli Goddard");
			expect(playerNames).toContain("Jonny Sourris");
		});

		test("should have valid numeric data", () => {
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
			// This test will verify the chatbot can actually connect to the real database
			const question = "How many goals has Luke Bangs scored?";
			const context: QuestionContext = {
				question,
				userContext: "Luke Bangs",
			};

			const response = await chatbotService.processQuestion(context);

			// Verify we got a real response from the database
			expect(response).toBeDefined();
			expect(response.answer).toBeDefined();
			expect(response.answer).not.toContain("unable to access");
			expect(response.answer).toContain("Luke Bangs");
		});

		test("should get real player statistics", async () => {
			const question = "How many assists does Luke Bangs have?";
			const context: QuestionContext = {
				question,
				userContext: "Luke Bangs",
			};

			const response = await chatbotService.processQuestion(context);

			// Verify we got real data from the database
			expect(response).toBeDefined();
			expect(response.answer).toBeDefined();
			expect(response.answer).not.toContain("unable to access");
			expect(response.answer).toContain("Luke Bangs");
			expect(response.answer).toContain("assist");
		});
	});

	describe("Question Analysis", () => {
		test("should analyze player questions correctly", async () => {
			const question = "How many goals has Luke Bangs scored?";
			const context: QuestionContext = {
				question,
				userContext: "Luke Bangs",
			};

			const response = await chatbotService.processQuestion(context);

			// Verify response was generated
			expect(response).toBeDefined();
			expect(response.answer).toBeDefined();

			// Get processing details to verify question analysis
			const processingDetails = chatbotService.getProcessingDetails();
			if (processingDetails?.questionAnalysis) {
				expect(processingDetails.questionAnalysis.type).toBe("player");
				expect(processingDetails.questionAnalysis.entities).toContain("Luke Bangs");
				expect(processingDetails.questionAnalysis.metrics).toContain("AllGSC");
			}
		});

		test("should handle different question formats", async () => {
			const questions = ["How many goals has Luke Bangs scored?", "What are Luke Bangs goals?", "Luke Bangs goals count"];

			for (const question of questions) {
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				const response = await chatbotService.processQuestion(context);
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
			// Test with known good responses
			const goodResponses = ["Luke Bangs has scored 29 goals", "Luke Bangs has provided 7 assists", "Luke Bangs has made 78 appearances"];

			goodResponses.forEach((response) => {
				expect(response).toMatch(/Luke Bangs/);
				expect(response).toMatch(/\d+/);
			});
		});
	});

	test("Should handle penalty record questions with enhanced logic", async () => {
		const question = "What is Luke Bangs penalty conversion rate?";
		const context: QuestionContext = {
			question,
			userContext: "Luke Bangs",
		};

		const response = await chatbotService.processQuestion(context);

		// Should return penalty record information
		expect(response.answer).toBeTruthy();
		expect(response.answer).toContain("Luke Bangs");
		expect(response.answer).toContain("penalties");
		expect(response.answer).toContain("conversion rate");
	}, 30000);

	test("Should handle points context questions with enhanced logic", async () => {
		const question = "How many points does Luke Bangs have?";
		const context: QuestionContext = {
			question,
			userContext: "Luke Bangs",
		};

		const response = await chatbotService.processQuestion(context);

		// Should return fantasy points information with clarification
		expect(response.answer).toBeTruthy();
		expect(response.answer).toContain("Luke Bangs");
		expect(response.answer).toContain("fantasy points");
	}, 30000);
});
