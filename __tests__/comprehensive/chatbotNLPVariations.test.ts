import { ChatbotService } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

// Ensures multiple natural-language variants for the same stat intent all return non-empty answers with mocked Neo4j.
// Complements stricter integration suites by focusing on paraphrase tolerance only.
// Failures imply regression in question normalization or intent routing.

describe("Chatbot NLP variation contracts", () => {
	test("handles common phrasings for same intent", async () => {
		// Arrange: synonymous goal-count questions
		const service = ChatbotService.getInstance();
		const variants = [
			"How many goals has Luke Bangs scored?",
			"What are Luke Bangs goals?",
			"Luke Bangs goals",
		];
		for (const question of variants) {
			// Act & assert: each variant answered
			const response = await service.processQuestion({ question, userContext: "Luke Bangs" });
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});
});
