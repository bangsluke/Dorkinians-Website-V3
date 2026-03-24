import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

describe("User Experience Testing", () => {
	let chatbotService: ChatbotService;

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
		jest.clearAllMocks();
	});

	test("returns readable responses for common prompts", async () => {
		const prompts = [
			"How many goals has Luke Bangs scored?",
			"What about his assists?",
			"Who has more goals, Luke Bangs or Oli Goddard?",
		];

		for (const question of prompts) {
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const response = await chatbotService.processQuestion(context);
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
			expect(response.answer).toMatch(/^[A-Za-z]/);
		}
	});

	test("handles unclear prompts with non-empty guidance text", async () => {
		const prompts = ["What is this?", "???", ""];

		for (const question of prompts) {
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const response = await chatbotService.processQuestion(context);
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});
});
