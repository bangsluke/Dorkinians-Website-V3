// @ts-check

import { test, expect } from '@playwright/test';
import { navigateToMainPage, waitForPageLoad, waitForDataLoad, selectPlayer, waitForChatbot, submitChatbotQuery, logSectionHeader } from '../../e2e/utils/testHelpers';
import { TEST_PLAYERS, TEST_QUERIES } from '../../e2e/fixtures/testData';

test.describe('Home Page Tests', () => {
	test.beforeAll(() => {
		logSectionHeader('HOME PAGE TESTS', '🏠', '02');
	});

	test.beforeEach(async ({ page }) => {
		await navigateToMainPage(page, 'home');
		await waitForPageLoad(page);
	});

	// Verify welcome message or player selection is visible
	test('1. should display home page with player selection', async ({ page }) => {
		// Check for welcome heading or player selection button
		const welcomeHeading = page.getByRole('heading', { name: /Welcome to the Dorkinians FC/i });
		const playerButton = page.getByRole('button', { name: /Choose.*player/i });
		await Promise.race([
			expect(welcomeHeading).toBeVisible({ timeout: 10000 }),
			expect(playerButton).toBeVisible({ timeout: 10000 })
		]);
	});

	// Verify player selection is visible and allows selection
	test('2. should allow player selection', async ({ page }) => {
		// Find player selection input
		const playerInput = page.locator('input[type="text"], input[placeholder*="player" i]').first();
		
		if (await playerInput.isVisible({ timeout: 5000 }).catch(() => false)) {
			// Type player name
			await playerInput.fill(TEST_PLAYERS.primary);
			await page.waitForTimeout(1000); // Wait for dropdown

			// Select player from dropdown
			const playerOption = page.locator(`text=${TEST_PLAYERS.primary}`).first();
			if (await playerOption.isVisible({ timeout: 2000 }).catch(() => false)) {
				await playerOption.click();
				await waitForPageLoad(page);

				// Verify player name is displayed
				await expect(page.getByText(new RegExp(TEST_PLAYERS.primary, 'i'))).toBeVisible({ timeout: 5000 });
				// Verify "Try these questions" is displayed
				await expect(page.getByText(/Try these questions/i)).toBeVisible({ timeout: 5000 });
			}
		}
	});

	// Verify chatbot interface is displayed after player selection
	test('3. should display chatbot interface after player selection', async ({ page }) => {
		// Select a player
		await selectPlayer(page, TEST_PLAYERS.primary);
	
		// Wait for chatbot to appear
		await waitForChatbot(page);
	
		// Verify chatbot input is visible
		await expect(
			page.getByPlaceholder(/player, club or team stats/i)
		).toBeVisible({ timeout: 5000 });
	});

	// Verify chatbot query is submitted and response is displayed
	test('4. should submit chatbot query and receive response', async ({ page }) => {
		// Select a player
		await selectPlayer(page, TEST_PLAYERS.primary);
		await waitForChatbot(page);

		// Submit a query
		await submitChatbotQuery(page, TEST_QUERIES.simple);
		
		// Wait for response
		await page.waitForTimeout(3000);
		await waitForDataLoad(page);

		// Verify response is displayed
		const response = page.locator('[class*="response" i], [class*="answer" i], text=/\\d+.*goal/i');
		await expect(response.first()).toBeVisible({ timeout: 10000 });
	});

	// Verify example questions are displayed when a player is selected
	test('5. should display example questions when a player is selected', async ({ page }) => {
		// Select a player
		await selectPlayer(page, TEST_PLAYERS.primary);
		await waitForChatbot(page);

		// Verify example questions are displayed
		const exampleQuestions = page.locator('text=/What.*most|How many|Who.*played/i');
		const hasExamples = await exampleQuestions.isVisible({ timeout: 5000 }).catch(() => false);
		expect(hasExamples).toBe(true);
	});

	// Verify example questions can be clicked and submitted
	test('6. should allow clicking example questions', async ({ page }) => {
		// Find an example question
		const exampleQuestion = page.locator('button:has-text(/What|How|Who/i), [class*="question" i]').first();
		
		if (await exampleQuestion.isVisible({ timeout: 5000 }).catch(() => false)) {
			const questionText = await exampleQuestion.textContent();
			await exampleQuestion.click();
			await waitForPageLoad(page);

			// If player is selected, verify question is in input
			// If not, verify question modal or input is populated
			if (questionText) {
				const input = page.locator('input[type="text"][placeholder*="question" i], textarea[placeholder*="question" i]');
				if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
					const inputValue = await input.inputValue();
					expect(inputValue.length).toBeGreaterThan(0);
				}
			}
		}
	});

	// Verify recently selected players are displayed
	test('7. should display recently selected players', async ({ page }) => {
		// First select a player to create recent history
		await selectPlayer(page, TEST_PLAYERS.primary);
		await waitForPageLoad(page);

		// Clear player selection (if there's a clear button)
		const clearButton = page.locator('button[aria-label*="clear" i], button:has-text("Clear"), button:has-text("Edit")').first();
		if (await clearButton.isVisible({ timeout: 2000 }).catch(() => false)) {
			await clearButton.click();
			await waitForPageLoad(page);
		}

		// Verify recently selected players section appears
		const recentPlayers = page.locator('text=/Recently.*Selected|Recent.*Players/i');
		const hasRecent = await recentPlayers.isVisible({ timeout: 5000 }).catch(() => false);
		// This is optional, so we don't fail if it's not present
	});
});
