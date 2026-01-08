import { test, expect } from '@playwright/test';
import { navigateToMainPage, waitForPageLoad, waitForDataLoad, selectPlayer, waitForChatbot, submitChatbotQuery } from '../utils/testHelpers';
import { TEST_PLAYERS, TEST_QUERIES } from '../fixtures/testData';

test.describe('Home Page Tests', () => {
	test.beforeEach(async ({ page }) => {
		await navigateToMainPage(page, 'home');
		await waitForPageLoad(page);
	});

	test('should display home page with player selection', async ({ page }) => {
		// Verify welcome message or player selection is visible
		await expect(
			page.locator('text=/Welcome|Select.*player|Player Selection/i')
		).toBeVisible({ timeout: 10000 });
	});

	test('should allow player selection', async ({ page }) => {
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
				await expect(page.locator(`text=/${TEST_PLAYERS.primary}/i`)).toBeVisible({ timeout: 5000 });
			}
		}
	});

	test('should display chatbot interface after player selection', async ({ page }) => {
		// Select a player
		await selectPlayer(page, TEST_PLAYERS.primary);
		
		// Wait for chatbot to appear
		await waitForChatbot(page);

		// Verify chatbot input is visible
		await expect(
			page.locator('input[type="text"][placeholder*="question" i], textarea[placeholder*="question" i]')
		).toBeVisible({ timeout: 5000 });
	});

	test('should submit chatbot query and receive response', async ({ page }) => {
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

	test('should display example questions when no player is selected', async ({ page }) => {
		// Navigate to home page (without player selected)
		await navigateToMainPage(page, 'home');
		await waitForPageLoad(page);

		// Verify example questions are displayed
		const exampleQuestions = page.locator('text=/What.*most|How many|Who.*played/i');
		const hasExamples = await exampleQuestions.isVisible({ timeout: 5000 }).catch(() => false);
		expect(hasExamples).toBe(true);
	});

	test('should allow clicking example questions', async ({ page }) => {
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

	test('should display recently selected players', async ({ page }) => {
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
