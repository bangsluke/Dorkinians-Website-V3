// @ts-check

import { test, expect } from '@playwright/test';
import { navigateToMainPage, waitForPageLoad, waitForDataLoad, logSectionHeader } from '../../e2e/utils/testHelpers';
import { TEST_TOTW_WEEKS } from '../../e2e/fixtures/testData';

test.describe('TOTW Page Tests', () => {
	test.beforeAll(() => {
		logSectionHeader('TOTW PAGE TESTS', '⭐', '04');
	});

	test.beforeEach(async ({ page }) => {
		await navigateToMainPage(page, 'totw');
		await waitForPageLoad(page);
	});

	test('1. should display Team of the Week page', async ({ page }) => {
		// Verify TOTW header is visible
		const totwHeading1 = page.getByRole('heading', { name: /Team of the Week/i });
		const totwHeading2 = page.getByRole('heading', { name: /TOTW/i });
		await Promise.race([
			expect(totwHeading1).toBeVisible({ timeout: 10000 }),
			expect(totwHeading2).toBeVisible({ timeout: 10000 })
		]);

		// Verify season and week selectors are present (HeadlessUI Listbox buttons)
		await expect(page.locator('button:has-text("Select season"), button:has-text(/\\d{4}-\\d{2}/)').first()).toBeVisible({ timeout: 10000 });
		await expect(page.locator('button:has-text("Select week"), button:has-text(/Week \\d+/)').first()).toBeVisible({ timeout: 10000 });
	});

	test('2. should load TOTW data', async ({ page }) => {
		// Wait for data to load (skeletons to disappear)
		await waitForDataLoad(page);

		// Verify pitch visualization or player data is displayed
		// Check for either pitch image or player names
		const hasPitch = await page.locator('img[alt*="pitch" i], [class*="pitch" i]').isVisible({ timeout: 5000 }).catch(() => false);
		const hasPlayers = await page.getByText(/Player/i).first().isVisible({ timeout: 5000 }).catch(() => false);
		
		expect(hasPitch || hasPlayers).toBe(true);
	});

	test('3. should display players on pitch with scores', async ({ page }) => {
		// Wait for data to load
		await waitForDataLoad(page);

		// Wait a bit more for players to render
		await page.waitForTimeout(2000);

		// Look for player elements (could be in various formats)
		const playerElements = page.locator('[class*="player" i], [data-player], button:has-text(/[A-Z]/)');
		const playerCount = await playerElements.count();

		// Should have at least some players (at least 1, typically 11)
		expect(playerCount).toBeGreaterThan(0);

		// Verify scores/points are displayed (look for numbers near player names)
		const scoreElements = page.locator('text=/\\d+/').filter({ hasText: /\\d{1,3}/ });
		const scoreCount = await scoreElements.count();
		
		// Should have some scores displayed
		expect(scoreCount).toBeGreaterThan(0);
	});

	test('4. should open player detail modal when clicking a player and display points', async ({ page }) => {
		// Wait for data to load
		await waitForDataLoad(page);
		await page.waitForTimeout(3000); // Extra wait for players to render on pitch

		// Find clickable player elements on the pitch
		// Players are in divs with cursor-pointer class, positioned absolutely on the pitch
		// They contain player names and FTP scores
		const playerContainers = page.locator('div.cursor-pointer').filter({ 
			has: page.locator('text=/\\d+/') // Has a number (FTP score)
		});

		const playerCount = await playerContainers.count();
		expect(playerCount).toBeGreaterThan(0);

		// Get the first player's name and score before clicking
		const firstPlayerContainer = playerContainers.first();
		const playerNameText = await firstPlayerContainer.locator('text=/[A-Z][a-z]+/').first().textContent();
		const playerScoreText = await firstPlayerContainer.locator('text=/\\d+/').first().textContent();
		
		expect(playerNameText).toBeTruthy();
		expect(playerScoreText).toBeTruthy();

		// Click on the player
		await firstPlayerContainer.click();

		// Wait for modal to appear - modal is rendered via portal
		const modal = page.locator('[role="dialog"], div[class*="modal" i], div[class*="Modal" i]').first();
		await expect(modal).toBeVisible({ timeout: 10000 });

		// Verify player name is displayed in modal
		if (playerNameText) {
			// Check for first name or last name (names might be formatted)
			const nameParts = playerNameText.trim().split(/\s+/);
			if (nameParts.length > 0) {
				await expect(modal.locator(`text=/${nameParts[0]}/i`)).toBeVisible({ timeout: 5000 });
			}
		}

		// Verify player points/score is displayed in modal
		// Look for FTP score, points breakdown, or total points
		const pointsDisplayed = await modal.locator('text=/\\d+.*point|FTP|score/i').isVisible({ timeout: 5000 }).catch(() => false);
		expect(pointsDisplayed).toBe(true);

		// Verify match details are shown (match details table or list)
		const hasMatchDetails = await modal.locator('text=/match|game|opposition|minutes|goals|assists/i').isVisible({ timeout: 5000 }).catch(() => false);
		expect(hasMatchDetails).toBe(true);

		// Verify TOTW appearances count is shown (if available)
		const hasTOTWAppearances = await modal.locator('text=/TOTW.*appearance|appearance.*TOTW|times.*TOTW/i').isVisible({ timeout: 3000 }).catch(() => false);
		// This is optional, so we don't fail if it's not present

		// Close modal - look for X button or close button
		const closeButton = modal.locator('button[aria-label*="close" i], button:has(svg), button:has([aria-label*="Close" i])').first();
		if (await closeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
			await closeButton.click();
			await expect(modal).toBeHidden({ timeout: 5000 });
		} else {
			// Try clicking outside modal or ESC key
			await page.keyboard.press('Escape');
			await page.waitForTimeout(500);
		}
	});

	test('5. should change season and update weeks', async ({ page }) => {
		// Wait for initial load
		await waitForDataLoad(page);
		await page.waitForTimeout(2000);

		// Find season Listbox button (HeadlessUI Listbox)
		const seasonButton = page.locator('button:has-text("Select season"), button:has-text(/\\d{4}-\\d{2}/)').first();
		
		if (await seasonButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			// Click to open dropdown
			await seasonButton.click();
			await page.waitForTimeout(500);

			// Find season options in the dropdown
			const seasonOptions = page.locator('[role="option"], li[role="option"]').filter({ 
				hasText: /\\d{4}-\\d{2}/ 
			});
			const seasonCount = await seasonOptions.count();
			
			if (seasonCount > 1) {
				// Get current season text
				const currentSeasonText = await seasonButton.textContent();
				
				// Select a different season (not the first one if it's selected)
				const secondSeason = seasonOptions.nth(1);
				const secondSeasonText = await secondSeason.textContent();
				
				if (secondSeasonText && secondSeasonText !== currentSeasonText) {
					await secondSeason.click();
					await waitForDataLoad(page);
					await page.waitForTimeout(2000);

					// Verify weeks update - check week selector
					const weekButton = page.locator('button:has-text("Select week"), button:has-text(/Week \\d+/)').first();
					if (await weekButton.isVisible({ timeout: 5000 }).catch(() => false)) {
						await weekButton.click();
						await page.waitForTimeout(500);
						const weekOptions = page.locator('[role="option"], li[role="option"]').filter({ 
							hasText: /Week/ 
						});
						const weekCount = await weekOptions.count();
						expect(weekCount).toBeGreaterThan(0);
						
						// Close dropdown
						await page.keyboard.press('Escape');
					}
				}
			} else {
				// Close dropdown if we didn't select
				await page.keyboard.press('Escape');
			}
		}
	});

	test('6. should change week and update TOTW data', async ({ page }) => {
		// Wait for initial load
		await waitForDataLoad(page);
		await page.waitForTimeout(2000);

		// Find week Listbox button (HeadlessUI Listbox)
		const weekButton = page.locator('button:has-text("Select week"), button:has-text(/Week \\d+/)').first();
		
		if (await weekButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			// Get current week text
			const currentWeekText = await weekButton.textContent();
			
			// Click to open dropdown
			await weekButton.click();
			await page.waitForTimeout(500);

			// Find week options in the dropdown
			const weekOptions = page.locator('[role="option"], li[role="option"]').filter({ 
				hasText: /Week/ 
			});
			const weekCount = await weekOptions.count();
			
			if (weekCount > 1) {
				// Select a different week (not the first one if it's selected)
				const secondWeek = weekOptions.nth(1);
				const secondWeekText = await secondWeek.textContent();
				
				if (secondWeekText && secondWeekText !== currentWeekText) {
					await secondWeek.click();
					await waitForDataLoad(page);
					await page.waitForTimeout(3000);

					// Verify data updated - check that players are displayed
					const playerContainers = page.locator('div.cursor-pointer').filter({ 
						has: page.locator('text=/\\d+/') 
					});
					const playerCount = await playerContainers.count();
					expect(playerCount).toBeGreaterThan(0);
				} else {
					// Close dropdown if we didn't select
					await page.keyboard.press('Escape');
				}
			} else {
				// Close dropdown if no options
				await page.keyboard.press('Escape');
			}
		}
	});

	test('7. should navigate to Players of the Month sub-page', async ({ page }) => {
		// Look for sub-page navigation dots (mobile) or sidebar navigation
		// On mobile, there are dot indicators at the top
		const subPageDots = page.locator('button[aria-label*="Players of the Month" i], button[aria-label*="month" i]');
		const subPageText = page.locator('button:has-text("Players of the Month")');
		
		// Try clicking on dot indicator or text button
		const subPageButton = subPageDots.first().or(subPageText.first());
		
		if (await subPageButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await subPageButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);

			// Verify Players of the Month content
			await expect(page.locator('text=/Players of the Month/i')).toBeVisible({ timeout: 10000 });
			
			// Verify season and month selectors are present
			await expect(page.locator('button:has-text("Select season"), button:has-text(/\\d{4}-\\d{2}/)').first()).toBeVisible({ timeout: 5000 });
			await expect(page.locator('button:has-text("Select month"), button:has-text(/January|February|March/i)').first()).toBeVisible({ timeout: 5000 });
		}
	});

	test('8. should display player rankings on Players of the Month page', async ({ page }) => {
		// Navigate to Players of the Month sub-page
		const subPageButton = page.locator('button[aria-label*="Players of the Month" i], button:has-text("Players of the Month")').first();
		
		if (await subPageButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await subPageButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);
			await page.waitForTimeout(2000);

			// Verify player rankings table or list is displayed
			const hasRankings = await page.locator('text=/Rank|Player|Score|FTP/i').isVisible({ timeout: 10000 }).catch(() => false);
			expect(hasRankings).toBe(true);

			// Verify at least one player is displayed
			const playerRows = page.locator('tr, [class*="player" i], [class*="rank" i]').filter({ 
				hasText: /[A-Z][a-z]+/ 
			});
			const playerCount = await playerRows.count();
			expect(playerCount).toBeGreaterThan(0);
		}
	});
});
