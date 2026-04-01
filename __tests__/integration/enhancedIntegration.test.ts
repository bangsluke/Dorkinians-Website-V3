import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

// Sequenced ChatbotService journeys with Neo4j fully mocked via jest-no real database I/O.
// Covers multi-turn prompts, player context switching, malformed input, and higher-volume call patterns.
// Assertions focus on non-empty string answers and stable shapes; mock data is static so timing flakes are rare.

describe("Enhanced Integration Testing", () => {
	let chatbotService: ChatbotService;

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
		jest.clearAllMocks();
	});

	test("handles a multi-question user journey with non-empty responses", async () => {
		// Arrange: scripted conversation covering comparisons and rankings
		const userSession = [
			"How many goals has Luke Bangs scored?",
			"What about assists?",
			"How many appearances has he made?",
			"Who has more goals, Luke Bangs or Oli Goddard?",
			"What are the top 3 players by assists?",
		];

		for (const question of userSession) {
			// Act & assert: each turn returns substantive text
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const response = await chatbotService.processQuestion(context);
			expect(response).toBeDefined();
			expect(typeof response.answer).toBe("string");
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});

	test("supports switching contexts between players without throwing", async () => {
		// Arrange: same service session with changing userContext values
		const switchingFlow: Array<{ question: string; userContext: string }> = [
			{ question: "How many goals has Luke Bangs scored?", userContext: "Luke Bangs" },
			{ question: "What about Oli Goddard?", userContext: "Oli Goddard" },
			{ question: "And Jonny Sourris?", userContext: "Jonny Sourris" },
		];

		for (const step of switchingFlow) {
			// Act & assert: context swap still yields answers
			const response = await chatbotService.processQuestion(step);
			expect(response).toBeDefined();
			expect(typeof response.answer).toBe("string");
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});

	test("handles error-prone and malformed prompts gracefully", async () => {
		// Arrange: invalid players, empty string, and vague prompts
		const prompts = [
			"How many goals has InvalidPlayer scored?",
			"Compare InvalidPlayer and Luke Bangs",
			"",
			"What is this?",
		];

		for (const question of prompts) {
			// Act & assert: service degrades to safe non-empty guidance
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const response = await chatbotService.processQuestion(context);
			expect(response).toBeDefined();
			expect(typeof response.answer).toBe("string");
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});

	test("maintains response shape under higher-volume sequence", async () => {
		// Arrange: burst of varied analytical questions
		const sequence = [
			"How many goals has Luke Bangs scored?",
			"How many assists does Luke Bangs have?",
			"How many appearances has Luke Bangs made?",
			"Who has more assists, Luke Bangs or Oli Goddard?",
			"Who has the best disciplinary record?",
		];

		for (const question of sequence) {
			// Act & assert: answers and sources array stay well-formed
			const response = await chatbotService.processQuestion({ question, userContext: "Luke Bangs" });
			expect(response).toBeDefined();
			expect(typeof response.answer).toBe("string");
			expect(Array.isArray(response.sources)).toBe(true);
		}
	});
});
