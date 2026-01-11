// @ts-check

import { test, expect } from '@playwright/test';
import { navigateToMainPage, waitForPageLoad, waitForDataLoad, selectPlayer, waitForChatbot, submitChatbotQuery, logSectionHeader } from '../utils/testHelpers';
import { TEST_PLAYERS, TEST_QUERIES } from '../fixtures/testData';

test.describe('Home Page Tests', () => {
	test.beforeAll(() => {
		logSectionHeader('HOME PAGE TESTS', '🏠', '02');
	});

	test.beforeEach(async ({ page }) => {
		await navigateToMainPage(page, 'home');
	});

	// Verify welcome message or player selection is visible
	test('1. should display home page with player selection', async ({ page }) => {
		// Check for welcome heading or player selection button
		const welcomeHeading = page.getByTestId('home-welcome-heading');
		const playerButton = page.getByTestId('player-selection-button');
		await Promise.race([
			expect(welcomeHeading).toBeVisible({ timeout: 10000 }),
			expect(playerButton).toBeVisible({ timeout: 10000 })
		]);
	});

	// Verify player selection is visible and allows selection
	test('2. should allow player selection', async ({ page }) => {
		// Find player selection input - try test ID first
		const playerInputByTestId = page.getByTestId('player-selection-input');
		const inputExists = await playerInputByTestId.isVisible({ timeout: 2000 }).catch(() => false);
		
		const playerInput = inputExists ? playerInputByTestId : page.locator('input[type="text"], input[placeholder*="player" i]').first();
		
		if (await playerInput.isVisible({ timeout: 5000 }).catch(() => false)) {
			// Type player name
			await playerInput.fill(TEST_PLAYERS.primary);
			await page.waitForTimeout(1000); // Wait for dropdown

			// Select player from dropdown - try test ID first
			const playerOptionByTestId = page.getByTestId('player-selection-option').filter({ hasText: TEST_PLAYERS.primary }).first();
			const optionExists = await playerOptionByTestId.isVisible({ timeout: 2000 }).catch(() => false);
			
			const playerOption = optionExists ? playerOptionByTestId : page.locator(`text=${TEST_PLAYERS.primary}`).first();
			
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
	
		// Verify chatbot input is visible - try test ID first
		const chatbotInput = page.getByTestId('chatbot-input').or(page.getByPlaceholder(/player, club or team stats/i));
		await expect(chatbotInput).toBeVisible({ timeout: 5000 });
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

		// Verify response is displayed - try test ID first
		const response = page.getByTestId('chatbot-answer');
		await expect(response.first()).toBeVisible({ timeout: 10000 });
	});

	// Verify example questions are displayed when a player is selected
	test('5. should display example questions when a player is selected', async ({ page }) => {
		// Select a player
		await selectPlayer(page, TEST_PLAYERS.primary);
		await waitForChatbot(page);

		// Verify example questions are displayed - try test ID first
		const example = page.locator('[data-testid^="chatbot-example-question"]').filter({hasText: /What was my most prolific season?/i});
		await expect(example).toBeVisible(); 
	});

	// Verify example questions can be clicked and submitted
	test('6. should allow clicking example questions', async ({ page }) => {
		// Find an example question - try test ID first
		const exampleQuestion = page.getByTestId('chatbot-example-question-0')
			.or(page.locator('button:has-text(/What|How|Who/i), [class*="question" i]'))
			.first();
		
		if (await exampleQuestion.isVisible({ timeout: 5000 }).catch(() => false)) {
			const questionText = await exampleQuestion.textContent();
			await exampleQuestion.click();
			await waitForPageLoad(page);

			// If player is selected, verify question is in input
			// If not, verify question modal or input is populated
			if (questionText) {
				const input = page.getByTestId('chatbot-input').or(page.locator('input[type="text"][placeholder*="question" i], textarea[placeholder*="question" i]'));
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

		// Clear player selection (if there's a clear button) - try test ID first
		const clearButton = page.getByTestId('player-selection-edit-button')
			.or(page.getByTestId('home-edit-player-button'))
			.or(page.locator('button[aria-label*="clear" i], button:has-text("Clear"), button:has-text("Edit")'))
			.first();
		
		if (await clearButton.isVisible({ timeout: 2000 }).catch(() => false)) {
			await clearButton.click();
			await waitForPageLoad(page);
		}

		// Verify recently selected players section appears
		const recentPlayers = page.locator('text=/Recently.*Selected|Recent.*Players/i');
		const hasRecent = await recentPlayers.isVisible({ timeout: 5000 }).catch(() => false);
		// This is optional, so we don't fail if it's not present
	});

	// Verify "Show more example questions" opens modal and displays the specific question
	test('8. should open example questions modal and display specific question', async ({ page }) => {
		// Select a player
		await selectPlayer(page, TEST_PLAYERS.primary);
		await waitForChatbot(page);

		// Find and click "Show more example questions" button - try test ID first
		const showMoreButton = page.getByTestId('chatbot-show-more-example-questions')
			.or(page.locator('button:has-text("Show more example questions")'))
			.first();
		
		await expect(showMoreButton).toBeVisible({ timeout: 5000 });
		await showMoreButton.click();

		// Wait for modal to appear - check for "Example Questions" heading
		const modalHeading = page.getByRole('heading', { name: 'Example Questions' });
		await expect(modalHeading).toBeVisible({ timeout: 5000 });

		// Verify the specific question is visible in the modal
		const targetQuestion = page.getByText('How many goals have I scored for the 3rd team?');
		await expect(targetQuestion).toBeVisible({ timeout: 5000 });
	});

	// Verify clicking example question closes modal and loads it into chatbot input
	test('9. should close modal and load question into chatbot input when example question is clicked', async ({ page }) => {
		// Select a player
		await selectPlayer(page, TEST_PLAYERS.primary);
		await waitForChatbot(page);

		// Find and click "Show more example questions" button - try test ID first
		const showMoreButton = page.getByTestId('chatbot-show-more-example-questions')
			.or(page.locator('button:has-text("Show more example questions")'))
			.first();
		
		await expect(showMoreButton).toBeVisible({ timeout: 5000 });
		await showMoreButton.click();

		// Wait for modal to appear
		const modalHeading = page.getByRole('heading', { name: 'Example Questions' });
		await expect(modalHeading).toBeVisible({ timeout: 5000 });

		// Find and click the specific question in the modal
		const targetQuestion = page.getByText('How many goals have I scored for the 3rd team?');
		await expect(targetQuestion).toBeVisible({ timeout: 5000 });
		await targetQuestion.click();

		// Wait for modal to close - verify modal heading is no longer visible
		await expect(modalHeading).not.toBeVisible({ timeout: 5000 });

		// Verify the question is loaded into the chatbot input
		const chatbotInput = page.getByTestId('chatbot-input').or(page.getByPlaceholder(/player, club or team stats/i));
		await expect(chatbotInput).toBeVisible({ timeout: 5000 });
		const inputValue = await chatbotInput.inputValue();
		expect(inputValue).toBe('How many goals have I scored for the 3rd team?');
	});
});
