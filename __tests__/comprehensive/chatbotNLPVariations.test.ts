import { ChatbotService } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

describe("Chatbot NLP variation contracts", () => {
	test("handles common phrasings for same intent", async () => {
		const service = ChatbotService.getInstance();
		const variants = [
			"How many goals has Luke Bangs scored?",
			"What are Luke Bangs goals?",
			"Luke Bangs goals",
		];
		for (const question of variants) {
			const response = await service.processQuestion({ question, userContext: "Luke Bangs" });
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});
});
