import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

// UX-oriented chatbot checks: readable opening characters and graceful handling of vague prompts with mocked Neo4j.
// Complements functional suites by asserting minimal polish heuristics on answer strings.
// Non-empty answers are required even for junk input-signals user-facing fallback copy is present.

describe("User Experience Testing", () => {
	let chatbotService: ChatbotService;

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
		jest.clearAllMocks();
	});

	test("returns readable responses for common prompts", async () => {
		// Arrange: typical follow-up friendly prompts
		const prompts = [
			"How many goals has Luke Bangs scored?",
			"What about his assists?",
			"Who has more goals, Luke Bangs or Oli Goddard?",
		];

		for (const question of prompts) {
			// Act & assert: answers start with letters and are non-empty
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const response = await chatbotService.processQuestion(context);
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
			expect(response.answer).toMatch(/^[A-Za-z]/);
		}
	});

	test("handles unclear prompts with non-empty guidance text", async () => {
		// Arrange: nonsense / empty user text
		const prompts = ["What is this?", "???", ""];

		for (const question of prompts) {
			// Act & assert: still returns helpful non-empty copy
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const response = await chatbotService.processQuestion(context);
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});
});
