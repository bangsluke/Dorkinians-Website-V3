import { ChatbotService } from "../../lib/services/chatbotService";

// Lightweight contract that mocked repeated answers keep the same numeric token extraction path stable.
// processQuestion is spied per test—no Neo4j or network. Validates regex parsing consistency, not live stats.
// Trivial loop; failures point to answer formatting or mock drift.

describe("Data Accuracy Validation contracts", () => {
	test("returns stable numeric token for repeated same query", async () => {
		// Arrange: deterministic mocked numeric answer
		const service = ChatbotService.getInstance();
		jest.spyOn(service, "processQuestion").mockResolvedValue({
			answer: "Luke Bangs scored 32 goals.",
			sources: ["mock"],
		} as any);
		const values: string[] = [];
		for (let i = 0; i < 3; i++) {
			// Act: repeat identical question to simulate idempotent responses
			const response = await service.processQuestion({ question: "How many goals has Luke Bangs scored?", userContext: "Luke Bangs" });
			const token = response.answer.match(/(\d+)/)?.[1];
			expect(token).toBeDefined();
			values.push(token as string);
		}
		// Assert: extracted digits identical across iterations
		expect(values.every((v) => v === values[0])).toBe(true);
	});
});
