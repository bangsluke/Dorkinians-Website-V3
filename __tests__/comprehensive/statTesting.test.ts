import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";
import { getAllStatConfigs } from "../utils/testUtils";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

// Validates stat config catalog size plus a cross-section of chatbot stat questions with Neo4j mocked.
// Uses shared getAllStatConfigs/testUtils metadata; chatbot answers come from deterministic mock rows.
// Threshold (>50 configs) guards accidental pruning of stat definitions from the test harness.

describe("Comprehensive Stat Testing", () => {
	let chatbotService: ChatbotService;

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
		jest.clearAllMocks();
	});

	test("loads non-empty stat config catalog", () => {
		// Act: load merged stat definitions used by broader suites
		const statConfigs = getAllStatConfigs();
		// Assert: catalog is populated
		expect(Array.isArray(statConfigs)).toBe(true);
		expect(statConfigs.length).toBeGreaterThan(50);
	});

	test("handles a representative cross-section of stat queries", async () => {
		// Arrange: mix of ratio, team, and seasonal phrasings
		const sampleQuestions = [
			"How many goals has Luke Bangs scored?",
			"How many assists does Luke Bangs have?",
			"How many appearances has Luke Bangs made?",
			"What is Luke Bangs goal-to-game ratio?",
			"How many goals has Luke Bangs scored for the 3rd team?",
			"How many goals did Luke Bangs score in 2019/20?",
		];

		for (const question of sampleQuestions) {
			// Act & assert: mocked pipeline still returns answers
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const response = await chatbotService.processQuestion(context);
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});
});
