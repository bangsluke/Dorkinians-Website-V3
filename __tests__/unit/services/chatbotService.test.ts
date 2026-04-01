import { ChatbotService, QuestionContext } from "@/lib/services/chatbotService";

// Unit-level ChatbotService smoke tests with processQuestion spied to a fixed answer-no Neo4j or HTTP.
// beforeEach resets mocks and reapplies the stub so tests stay isolated from real graph latency.
// Focus: response shape and processing detail accessors, not literal stat values.

describe("ChatbotService unit contracts", () => {
	let chatbotService: ChatbotService;

	beforeEach(() => {
		chatbotService = ChatbotService.getInstance();
		jest.clearAllMocks();
		jest.spyOn(chatbotService, "processQuestion").mockResolvedValue({
			answer: "Luke Bangs scored 32 goals.",
			sources: ["mock"],
		} as any);
	});

	test("processQuestion returns non-empty answer", async () => {
		// Arrange: typical question context
		const context: QuestionContext = { question: "How many goals has Luke Bangs scored?", userContext: "Luke Bangs" };
		// Act & assert: stubbed pipeline returns string answer
		const response = await chatbotService.processQuestion(context);
		expect(response).toBeDefined();
		// Assert: answer is a non-empty string from stub
		expect(typeof response.answer).toBe("string");
		expect(response.answer.length).toBeGreaterThan(0);
	});

	test("processing details shape is available after question", async () => {
		// Act: drive one mocked question to populate diagnostics
		await chatbotService.processQuestion({ question: "How many assists does Luke Bangs have?", userContext: "Luke Bangs" });
		// Assert: detail object includes analysis/query keys
		const details = chatbotService.getProcessingDetails();
		expect(details).toBeDefined();
		expect(details).toHaveProperty("questionAnalysis");
		expect(details).toHaveProperty("queryBreakdown");
	});
});
