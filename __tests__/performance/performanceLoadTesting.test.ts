import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

// Lightweight timing and concurrency checks around ChatbotService with Neo4j mocked (deterministic latency).
// Uses wall-clock thresholds (<7s) and Promise.all fan-out; not a full load test harness.
// CI machine variance can occasionally borderline-flake strict timing-watch for environmental noise.

describe("Performance and Load Testing", () => {
	let chatbotService: ChatbotService;

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
		jest.clearAllMocks();
	});

	test("responds to basic prompts within a reasonable bound", async () => {
		// Arrange: two simple stat questions to time
		const prompts = [
			"How many goals has Luke Bangs scored?",
			"How many assists does Luke Bangs have?",
		];

		for (const question of prompts) {
			// Act: measure elapsed processing time
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const start = Date.now();
			const response = await chatbotService.processQuestion(context);
			const elapsed = Date.now() - start;
			// Assert: answer quality + coarse performance guard
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
			expect(elapsed).toBeLessThan(7000);
		}
	});

	test("handles concurrent calls without throwing", async () => {
		// Arrange: shared context fired in parallel
		const context: QuestionContext = {
			question: "How many goals has Luke Bangs scored?",
			userContext: "Luke Bangs",
		};

		// Act: five overlapping processQuestion calls
		const responses = await Promise.all(
			Array.from({ length: 5 }, () => chatbotService.processQuestion(context)),
		);

		// Assert: every promise resolves with usable text
		for (const response of responses) {
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});
});
