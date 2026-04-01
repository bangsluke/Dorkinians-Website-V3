import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

// ChatbotService integration with Neo4j mocked end-to-end-deterministic executeQuery payloads, no real graph.
// Validates answer strings, optional processing metadata, and paraphrased question stability for common intents.
// Flakes are uncommon unless mock wiring or ChatbotService internals change response shape.

describe("Chatbot Integration Tests", () => {
	let chatbotService: ChatbotService;

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
		jest.clearAllMocks();
	});

	test("processes a standard player goals query with valid response shape", async () => {
		// Arrange: canonical goals question
		const context: QuestionContext = {
			question: "How many goals has Luke Bangs scored?",
			userContext: "Luke Bangs",
		};

		// Act & assert: structured response with sources array
		const response = await chatbotService.processQuestion(context);
		expect(response).toBeDefined();
		expect(typeof response.answer).toBe("string");
		expect(response.answer.length).toBeGreaterThan(0);
		expect(Array.isArray(response.sources)).toBe(true);
	});

	test("handles team-context query without crashing", async () => {
		// Arrange: team-scoped phrasing
		const context: QuestionContext = {
			question: "How many goals have I scored for the 3rd team?",
			userContext: "Luke Bangs",
		};

		// Act & assert: still returns non-empty guidance
		const response = await chatbotService.processQuestion(context);
		expect(response).toBeDefined();
		expect(typeof response.answer).toBe("string");
		expect(response.answer.length).toBeGreaterThan(0);
	});

	test("returns stable non-empty responses for equivalent formats", async () => {
		// Arrange: multiple surface forms for the same stat ask
		const questions = [
			"How many goals has Luke Bangs scored?",
			"What is Luke Bangs total goals?",
			"Luke Bangs goals",
		];

		for (const question of questions) {
			// Act & assert: each variant answers
			const response = await chatbotService.processQuestion({
				question,
				userContext: "Luke Bangs",
			});
			expect(typeof response.answer).toBe("string");
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});

	test("keeps processing details structure available after query", async () => {
		// Act: run a query to populate internal diagnostics
		await chatbotService.processQuestion({
			question: "How many assists does Luke Bangs have?",
			userContext: "Luke Bangs",
		});

		// Assert: processing snapshot exposes analysis + query breakdown keys
		const processingDetails = chatbotService.getProcessingDetails();
		expect(processingDetails).toBeDefined();
		expect(processingDetails).toHaveProperty("questionAnalysis");
		expect(processingDetails).toHaveProperty("queryBreakdown");
	});
});
