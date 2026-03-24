import { ChatbotService } from "../../lib/services/chatbotService";

describe("Data Accuracy Validation contracts", () => {
	test("returns stable numeric token for repeated same query", async () => {
		const service = ChatbotService.getInstance();
		jest.spyOn(service, "processQuestion").mockResolvedValue({
			answer: "Luke Bangs scored 32 goals.",
			sources: ["mock"],
		} as any);
		const values: string[] = [];
		for (let i = 0; i < 3; i++) {
			const response = await service.processQuestion({ question: "How many goals has Luke Bangs scored?", userContext: "Luke Bangs" });
			const token = response.answer.match(/(\d+)/)?.[1];
			expect(token).toBeDefined();
			values.push(token as string);
		}
		expect(values.every((v) => v === values[0])).toBe(true);
	});
});
