import { ChatbotService } from "../../lib/services/chatbotService";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockResolvedValue([{ playerName: "Luke Bangs", value: 32, appearances: 78 }]),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

// Observability contract: after a mocked-DB question, processing details include analysis and query breakdown keys.
// ChatbotService runs with Neo4j jest mock—telemetry is local only. Useful when refactoring diagnostics surfaces.

describe("Monitoring and Observability contracts", () => {
	test("processing details expose expected monitoring fields", async () => {
		// Arrange & act: prime service with a representative query
		const service = ChatbotService.getInstance();
		await service.processQuestion({ question: "How many goals has Luke Bangs scored?", userContext: "Luke Bangs" });
		// Assert: diagnostic snapshot contains expected top-level sections
		const details = service.getProcessingDetails();
		expect(details).toBeDefined();
		// Assert: nested diagnostic sections exist for observability consumers
		expect(details).toHaveProperty("questionAnalysis");
		expect(details).toHaveProperty("queryBreakdown");
	});
});
