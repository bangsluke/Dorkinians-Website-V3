import { APIRequestContext, expect } from '@playwright/test';
import { EXPECTED_RESPONSE_TIMES } from '../fixtures/testData';

/**
 * Make API request and verify response
 */
export async function makeAPIRequest(
	request: APIRequestContext,
	method: 'GET' | 'POST',
	url: string,
	body?: any
) {
	const startTime = Date.now();
	
	const response = await request[method.toLowerCase()](url, {
		data: body,
		headers: {
			'Content-Type': 'application/json',
		},
	});
	
	const responseTime = Date.now() - startTime;
	
	// Verify response time
	expect(responseTime).toBeLessThan(EXPECTED_RESPONSE_TIMES.api);
	
	// Verify status
	expect(response.status()).toBeLessThan(400);
	
	return {
		response,
		responseTime,
		json: await response.json(),
	};
}

/**
 * Test chatbot API endpoint
 */
export async function testChatbotAPI(request: APIRequestContext, query: string, playerContext?: string) {
	const { response, json, responseTime } = await makeAPIRequest(request, 'POST', '/api/chatbot', {
		query,
		playerContext,
	});
	
	expect(json).toHaveProperty('answer');
	expect(typeof json.answer).toBe('string');
	expect(json.answer.length).toBeGreaterThan(0);
	
	return { response, json, responseTime };
}

/**
 * Test player data API endpoint
 */
export async function testPlayerDataAPI(request: APIRequestContext, playerName: string) {
	const { response, json, responseTime } = await makeAPIRequest(
		request,
		'GET',
		`/api/player-data?playerName=${encodeURIComponent(playerName)}`
	);
	
	expect(json).toHaveProperty('playerName');
	expect(json.playerName).toBe(playerName);
	
	return { response, json, responseTime };
}

/**
 * Test TOTW API endpoint
 */
export async function testTOTWAPI(request: APIRequestContext, season: string, week: number) {
	const { response, json, responseTime } = await makeAPIRequest(
		request,
		'GET',
		`/api/totw/week-data?season=${encodeURIComponent(season)}&week=${week}`
	);
	
	expect(json).toHaveProperty('totwData');
	expect(json).toHaveProperty('players');
	expect(Array.isArray(json.players)).toBe(true);
	
	return { response, json, responseTime };
}
