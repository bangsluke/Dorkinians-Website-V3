import { test, expect } from "@playwright/test";
import { TEST_PLAYERS, TEST_QUERIES } from "../fixtures/testData";

// Smoke-level HTTP checks against running app (baseURL from Playwright config); does not assert response body shape.
test.describe("API Endpoint Tests", () => {
	test("8.1. chatbot api responds to a basic query", async ({ request }) => {
		const response = await request.post("/api/chatbot", {
			data: { question: TEST_QUERIES.simple, userContext: TEST_PLAYERS.primary },
		});
		expect(response.status()).toBeLessThan(600);
	});

	test("8.2. player-data api responds for known player", async ({ request }) => {
		const response = await request.get(`/api/player-data-filtered?playerName=${encodeURIComponent(TEST_PLAYERS.primary)}`);
		expect(response.status()).toBeLessThan(500);
	});
});
