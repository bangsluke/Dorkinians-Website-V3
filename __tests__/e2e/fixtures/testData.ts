/**
 * Test data fixtures for E2E tests
 * Contains stable test data that should be available in the database
 */

export const TEST_PLAYERS = {
	primary: 'Luke Bangs',
	secondary: 'Oli Goddard',
	tertiary: 'Jonny Sourris',
} as const;

export const TEST_SEASONS = {
	current: '2024-25',
	previous: '2023-24',
	historical: '2022-23',
} as const;

export const TEST_TEAMS = {
	first: '1st XI',
	second: '2nd XI',
	third: '3rd XI',
	fourth: '4th XI',
} as const;

export const TEST_TOTW_WEEKS = {
	season: '2024-25',
	week: 1,
} as const;

export const TEST_QUERIES = {
	simple: 'How many goals have I scored?',
	withTeam: 'How many goals have I scored for the 3rd team?',
	withTimeframe: 'How many goals have I scored this season?',
} as const;

export const EXPECTED_RESPONSE_TIMES = {
	api: 5000, // 5 seconds
	pageLoad: 10000, // 10 seconds
	interaction: 3000, // 3 seconds
} as const;
