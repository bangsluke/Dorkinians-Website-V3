import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

describe("Enhanced Integration Testing", () => {
	let chatbotService: ChatbotService;

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
		jest.clearAllMocks();
	});

	test("handles a multi-question user journey with non-empty responses", async () => {
		const userSession = [
			"How many goals has Luke Bangs scored?",
			"What about assists?",
			"How many appearances has he made?",
			"Who has more goals, Luke Bangs or Oli Goddard?",
			"What are the top 3 players by assists?",
		];

		for (const question of userSession) {
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const response = await chatbotService.processQuestion(context);
			expect(response).toBeDefined();
			expect(typeof response.answer).toBe("string");
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});

	test("supports switching contexts between players without throwing", async () => {
		const switchingFlow: Array<{ question: string; userContext: string }> = [
			{ question: "How many goals has Luke Bangs scored?", userContext: "Luke Bangs" },
			{ question: "What about Oli Goddard?", userContext: "Oli Goddard" },
			{ question: "And Jonny Sourris?", userContext: "Jonny Sourris" },
		];

		for (const step of switchingFlow) {
			const response = await chatbotService.processQuestion(step);
			expect(response).toBeDefined();
			expect(typeof response.answer).toBe("string");
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});

	test("handles error-prone and malformed prompts gracefully", async () => {
		const prompts = [
			"How many goals has InvalidPlayer scored?",
			"Compare InvalidPlayer and Luke Bangs",
			"",
			"What is this?",
		];

		for (const question of prompts) {
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const response = await chatbotService.processQuestion(context);
			expect(response).toBeDefined();
			expect(typeof response.answer).toBe("string");
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});

	test("maintains response shape under higher-volume sequence", async () => {
		const sequence = [
			"How many goals has Luke Bangs scored?",
			"How many assists does Luke Bangs have?",
			"How many appearances has Luke Bangs made?",
			"Who has more assists, Luke Bangs or Oli Goddard?",
			"Who has the best disciplinary record?",
		];

		for (const question of sequence) {
			const response = await chatbotService.processQuestion({ question, userContext: "Luke Bangs" });
			expect(response).toBeDefined();
			expect(typeof response.answer).toBe("string");
			expect(Array.isArray(response.sources)).toBe(true);
		}
	});
});
