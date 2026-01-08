import { test, expect } from '@playwright/test';
import { navigateToMainPage, waitForPageLoad } from '../utils/testHelpers';

test.describe('Navigation Tests', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await waitForPageLoad(page);
	});

	test('should navigate to Home page', async ({ page }) => {
		// Click home navigation
		const homeButton = page.locator('button:has-text("Home"), [aria-label*="Home" i]').first();
		await homeButton.click();
		await waitForPageLoad(page);

		// Verify we're on home page - check for player selection or welcome message
		await expect(page.locator('text=/Welcome|Player|Select.*player/i')).toBeVisible({ timeout: 10000 });
	});

	test('should navigate to Stats page', async ({ page }) => {
		// Click stats navigation
		const statsButton = page.locator('button:has-text("Stats"), [aria-label*="Stats" i]').first();
		await statsButton.click();
		await waitForPageLoad(page);

		// Verify we're on stats page - check for stats content
		await expect(page.locator('text=/Player Stats|Team Stats|Club Stats/i')).toBeVisible({ timeout: 10000 });
	});

	test('should navigate to TOTW page', async ({ page }) => {
		// Click TOTW navigation
		const totwButton = page.locator('button:has-text("TOTW"), [aria-label*="TOTW" i]').first();
		await totwButton.click();
		await waitForPageLoad(page);

		// Verify we're on TOTW page - check for TOTW header
		await expect(page.locator('text=/Team of the Week|TOTW/i')).toBeVisible({ timeout: 10000 });
	});

	test('should navigate to Club Info page', async ({ page }) => {
		// Click club info navigation
		const clubInfoButton = page.locator('button:has-text("Club Info"), [aria-label*="Club Info" i]').first();
		await clubInfoButton.click();
		await waitForPageLoad(page);

		// Verify we're on club info page
		await expect(page.locator('text=/Club Information|League Information|Club Captains/i')).toBeVisible({ timeout: 10000 });
	});

	test('should navigate to Settings page', async ({ page }) => {
		// Click settings icon (usually in header)
		const settingsButton = page.locator('button[aria-label*="Settings" i], button[aria-label*="settings" i], [data-testid*="settings"]').first();
		await settingsButton.click();
		await waitForPageLoad(page);

		// Verify we're on settings page
		await expect(page.locator('text=/Settings|Database Status|PWA/i')).toBeVisible({ timeout: 10000 });
	});

	test('should navigate between Stats sub-pages', async ({ page }) => {
		// Navigate to Stats page
		const statsButton = page.locator('button:has-text("Stats"), [aria-label*="Stats" i]').first();
		await statsButton.click();
		await waitForPageLoad(page);

		// Check for sub-page navigation (dots or menu)
		const subPageIndicators = page.locator('[class*="dot"], [class*="indicator"], button[aria-label*="Player Stats" i]');
		const count = await subPageIndicators.count();
		
		if (count > 0) {
			// Click on Team Stats if available
			const teamStatsButton = page.locator('button:has-text("Team Stats"), [aria-label*="Team Stats" i]').first();
			if (await teamStatsButton.isVisible({ timeout: 2000 }).catch(() => false)) {
				await teamStatsButton.click();
				await waitForPageLoad(page);
				await expect(page.locator('text=/Team Stats|Team.*Stats/i')).toBeVisible({ timeout: 10000 });
			}
		}
	});

	test('should navigate between TOTW sub-pages', async ({ page }) => {
		// Navigate to TOTW page
		const totwButton = page.locator('button:has-text("TOTW"), [aria-label*="TOTW" i]').first();
		await totwButton.click();
		await waitForPageLoad(page);

		// Check for sub-page navigation
		const playersOfMonthButton = page.locator('button:has-text("Players of the Month"), [aria-label*="Players of the Month" i]').first();
		if (await playersOfMonthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
			await playersOfMonthButton.click();
			await waitForPageLoad(page);
			await expect(page.locator('text=/Players of the Month/i')).toBeVisible({ timeout: 10000 });
		}
	});
});
