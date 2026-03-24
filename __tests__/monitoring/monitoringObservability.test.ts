import { ChatbotService } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

describe("Monitoring and Observability contracts", () => {
	test("processing details expose expected monitoring fields", async () => {
		const service = ChatbotService.getInstance();
		await service.processQuestion({ question: "How many goals has Luke Bangs scored?", userContext: "Luke Bangs" });
		const details = service.getProcessingDetails();
		expect(details).toBeDefined();
		expect(details).toHaveProperty("questionAnalysis");
		expect(details).toHaveProperty("queryBreakdown");
	});
});
