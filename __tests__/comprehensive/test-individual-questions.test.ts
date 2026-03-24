import { ChatbotService } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

describe("Comprehensive individual question contracts", () => {
	test("handles representative questions without empty response", async () => {
		const service = ChatbotService.getInstance();
		const questions = [
			"How many goals has Luke Bangs scored?",
			"How many assists does Luke Bangs have?",
			"Who has more goals, Luke Bangs or Oli Goddard?",
		];
		for (const question of questions) {
			const response = await service.processQuestion({ question, userContext: "Luke Bangs" });
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});
});
