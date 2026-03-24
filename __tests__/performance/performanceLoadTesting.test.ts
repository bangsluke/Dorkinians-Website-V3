import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

describe("Performance and Load Testing", () => {
	let chatbotService: ChatbotService;

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
		jest.clearAllMocks();
	});

	test("responds to basic prompts within a reasonable bound", async () => {
		const prompts = [
			"How many goals has Luke Bangs scored?",
			"How many assists does Luke Bangs have?",
		];

		for (const question of prompts) {
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const start = Date.now();
			const response = await chatbotService.processQuestion(context);
			const elapsed = Date.now() - start;
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
			expect(elapsed).toBeLessThan(7000);
		}
	});

	test("handles concurrent calls without throwing", async () => {
		const context: QuestionContext = {
			question: "How many goals has Luke Bangs scored?",
			userContext: "Luke Bangs",
		};

		const responses = await Promise.all(
			Array.from({ length: 5 }, () => chatbotService.processQuestion(context)),
		);

		for (const response of responses) {
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});
});
