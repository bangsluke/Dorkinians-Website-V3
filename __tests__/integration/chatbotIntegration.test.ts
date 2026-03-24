import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

describe("Chatbot Integration Tests", () => {
	let chatbotService: ChatbotService;

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
		jest.clearAllMocks();
	});

	test("processes a standard player goals query with valid response shape", async () => {
		const context: QuestionContext = {
			question: "How many goals has Luke Bangs scored?",
			userContext: "Luke Bangs",
		};

		const response = await chatbotService.processQuestion(context);
		expect(response).toBeDefined();
		expect(typeof response.answer).toBe("string");
		expect(response.answer.length).toBeGreaterThan(0);
		expect(Array.isArray(response.sources)).toBe(true);
	});

	test("handles team-context query without crashing", async () => {
		const context: QuestionContext = {
			question: "How many goals have I scored for the 3rd team?",
			userContext: "Luke Bangs",
		};

		const response = await chatbotService.processQuestion(context);
		expect(response).toBeDefined();
		expect(typeof response.answer).toBe("string");
		expect(response.answer.length).toBeGreaterThan(0);
	});

	test("returns stable non-empty responses for equivalent formats", async () => {
		const questions = [
			"How many goals has Luke Bangs scored?",
			"What is Luke Bangs total goals?",
			"Luke Bangs goals",
		];

		for (const question of questions) {
			const response = await chatbotService.processQuestion({
				question,
				userContext: "Luke Bangs",
			});
			expect(typeof response.answer).toBe("string");
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});

	test("keeps processing details structure available after query", async () => {
		await chatbotService.processQuestion({
			question: "How many assists does Luke Bangs have?",
			userContext: "Luke Bangs",
		});

		const processingDetails = chatbotService.getProcessingDetails();
		expect(processingDetails).toBeDefined();
		expect(processingDetails).toHaveProperty("questionAnalysis");
		expect(processingDetails).toHaveProperty("queryBreakdown");
	});
});
