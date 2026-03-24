import { ChatbotService } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

describe("Security edge-case contracts", () => {
	test("handles malformed and suspicious input safely", async () => {
		const service = ChatbotService.getInstance();
		const inputs = ["", "???", "' OR 1=1 --", "<script>alert(1)</script>"];
		for (const question of inputs) {
			const response = await service.processQuestion({ question, userContext: "Luke Bangs" });
			expect(response.answer).toBeDefined();
			expect(response.answer.length).toBeGreaterThan(0);
		}
	});
});
