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

describe("Comprehensive Stat Testing", () => {
	let chatbotService: ChatbotService;

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
		jest.clearAllMocks();
	});

	test("loads non-empty stat config catalog", () => {
		const statConfigs = getAllStatConfigs();
		expect(Array.isArray(statConfigs)).toBe(true);
		expect(statConfigs.length).toBeGreaterThan(50);
	});

	test("handles a representative cross-section of stat queries", async () => {
		const sampleQuestions = [
			"How many goals has Luke Bangs scored?",
			"How many assists does Luke Bangs have?",
			"How many appearances has Luke Bangs made?",
			"What is Luke Bangs goal-to-game ratio?",
			"How many goals has Luke Bangs scored for the 3rd team?",
			"How many goals did Luke Bangs score in 2019/20?",
		];

		for (const question of sampleQuestions) {
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const response = await chatbotService.processQuestion(context);
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});
});
