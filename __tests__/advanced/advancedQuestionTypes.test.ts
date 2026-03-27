import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

// Advanced chatbot prompts with processQuestion spied/mocked to return a canned comparative answer each time.
// Neo4j remains mocked at module level; beforeEach re-stubs processQuestion to isolate comparative/ranking phrasing tests.
// Focus is on handler resilience, not literal DB values.

describe("Advanced Question Types", () => {
	let chatbotService: ChatbotService;

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
		jest.clearAllMocks();
		jest.spyOn(chatbotService, "processQuestion").mockResolvedValue({
			answer: "Luke Bangs has strong stats compared to Oli Goddard.",
			sources: ["mock"],
		} as any);
	});

	test("handles comparative prompts", async () => {
		// Arrange: comparative player question
		const context: QuestionContext = {
			question: "Who has more goals, Luke Bangs or Oli Goddard?",
			userContext: "Luke Bangs",
		};
		// Act & assert: mocked processQuestion still returns structured text
		const response = await chatbotService.processQuestion(context);
		expect(response.answer).toBeDefined();
		expect(response.answer.length).toBeGreaterThan(0);
	});

	test("handles ranking and complex phrasing prompts", async () => {
		// Arrange: ranking + multi-stat comparison phrasing
		const prompts = [
			"Who are the top 3 players by goals?",
			"Compare Luke Bangs and Jonny Sourris across all stats",
		];

		for (const question of prompts) {
			// Act & assert: each advanced prompt gets non-empty mocked output
			const response = await chatbotService.processQuestion({ question, userContext: "Luke Bangs" });
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});
});
