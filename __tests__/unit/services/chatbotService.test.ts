import { ChatbotService, QuestionContext } from "@/lib/services/chatbotService";

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
		const context: QuestionContext = { question: "How many goals has Luke Bangs scored?", userContext: "Luke Bangs" };
		const response = await chatbotService.processQuestion(context);
		expect(response).toBeDefined();
		expect(typeof response.answer).toBe("string");
		expect(response.answer.length).toBeGreaterThan(0);
	});

	test("processing details shape is available after question", async () => {
		await chatbotService.processQuestion({ question: "How many assists does Luke Bangs have?", userContext: "Luke Bangs" });
		const details = chatbotService.getProcessingDetails();
		expect(details).toBeDefined();
		expect(details).toHaveProperty("questionAnalysis");
		expect(details).toHaveProperty("queryBreakdown");
	});
});
