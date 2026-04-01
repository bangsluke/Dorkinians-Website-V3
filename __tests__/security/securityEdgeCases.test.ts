import { ChatbotService } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

// Feeds suspicious strings into ChatbotService with Neo4j mocked-validates the bot never crashes and returns text.
// Not a substitute for dedicated security review; ensures basic prompt injection/HTML snippets degrade gracefully.
// Assertions are presence/length only.

describe("Security edge-case contracts", () => {
	test("handles malformed and suspicious input safely", async () => {
		// Arrange: empty, ambiguous, SQL-ish, and HTML-laden prompts
		const service = ChatbotService.getInstance();
		const inputs = ["", "???", "' OR 1=1 --", "<script>alert(1)</script>"];
		for (const question of inputs) {
			// Act & assert: each hostile prompt yields a non-empty safe-ish answer string
			const response = await service.processQuestion({ question, userContext: "Luke Bangs" });
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});
});
