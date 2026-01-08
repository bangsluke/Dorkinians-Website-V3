import { test, expect } from '@playwright/test';
import { testChatbotAPI, testPlayerDataAPI, testTOTWAPI } from '../utils/apiHelpers';
import { TEST_PLAYERS, TEST_TOTW_WEEKS, TEST_QUERIES } from '../fixtures/testData';

test.describe('API Endpoint Tests', () => {
	test('should respond to chatbot API query', async ({ request }) => {
		const { response, json, responseTime } = await testChatbotAPI(
			request,
			TEST_QUERIES.simple,
			TEST_PLAYERS.primary
		);

		expect(response.status()).toBe(200);
		expect(json).toHaveProperty('answer');
		expect(typeof json.answer).toBe('string');
		expect(json.answer.length).toBeGreaterThan(0);
		expect(responseTime).toBeLessThan(5000);
	});

	test('should return player data from player data API', async ({ request }) => {
		const { response, json, responseTime } = await testPlayerDataAPI(request, TEST_PLAYERS.primary);

		expect(response.status()).toBe(200);
		expect(json).toHaveProperty('playerName');
		expect(json.playerName).toBe(TEST_PLAYERS.primary);
		expect(responseTime).toBeLessThan(5000);
	});

	test('should return TOTW data from TOTW API', async ({ request }) => {
		const { response, json, responseTime } = await testTOTWAPI(
			request,
			TEST_TOTW_WEEKS.season,
			TEST_TOTW_WEEKS.week
		);

		expect(response.status()).toBe(200);
		expect(json).toHaveProperty('totwData');
		expect(json).toHaveProperty('players');
		expect(Array.isArray(json.players)).toBe(true);
		expect(responseTime).toBeLessThan(5000);
	});

	test('should handle invalid chatbot query gracefully', async ({ request }) => {
		const response = await request.post('/api/chatbot', {
			data: {
				query: 'This is not a valid question about football',
				playerContext: TEST_PLAYERS.primary,
			},
		});

		// Should still return 200, but may have an error message or fallback response
		expect(response.status()).toBeLessThan(500);
	});

	test('should handle invalid player name gracefully', async ({ request }) => {
		const response = await request.get(
			`/api/player-data?playerName=${encodeURIComponent('NonExistentPlayer123')}`
		);

		// Should return 200 or 404, but not 500
		expect(response.status()).toBeLessThan(500);
	});
});
