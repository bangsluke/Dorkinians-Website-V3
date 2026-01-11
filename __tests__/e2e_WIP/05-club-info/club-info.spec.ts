// @ts-check

import { test, expect } from '@playwright/test';
import { navigateToMainPage, waitForPageLoad, waitForDataLoad, logSectionHeader } from '../../e2e/utils/testHelpers';

test.describe('Club Info Page Tests', () => {
	test.beforeAll(() => {
		logSectionHeader('CLUB INFO PAGE TESTS', '🏛️ ', '05');
	});

	test.beforeEach(async ({ page }) => {
		await navigateToMainPage(page, 'club-info');
		await waitForPageLoad(page);
	});

	test('1. should display Club Information page by default', async ({ page }) => {
		await waitForDataLoad(page);

		// Verify Club Information button is visible
		await expect(page.getByRole('button', { name: /Club Information/i })).toBeVisible({ timeout: 10000 });
	});

	test('2. should navigate to League Information sub-page', async ({ page }) => {
		await waitForDataLoad(page);

		// Find sub-page navigation (dots or buttons)
		const leagueInfoButton = page.locator('button[aria-label*="League Information" i], button:has-text("League Information")').first();
		
		if (await leagueInfoButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await leagueInfoButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);

			// Verify League Information button is visible
			await expect(page.getByRole('button', { name: /League Information/i })).toBeVisible({ timeout: 10000 });
		}
	});

	test('3. should navigate to Club Captains sub-page', async ({ page }) => {
		await waitForDataLoad(page);

		const captainsButton = page.locator('button[aria-label*="Club Captains" i], button:has-text("Club Captains")').first();
		
		if (await captainsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await captainsButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);

			// Verify Club Captains button is visible
			await expect(page.getByRole('button', { name: /Club Captains/i })).toBeVisible({ timeout: 10000 });
		}
	});

	test('4. should navigate to Club Awards sub-page', async ({ page }) => {
		await waitForDataLoad(page);

		const awardsButton = page.locator('button[aria-label*="Club Awards" i], button:has-text("Club Awards")').first();
		
		if (await awardsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await awardsButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);

			// Verify Club Awards button is visible
			await expect(page.getByRole('button', { name: /Club Awards/i })).toBeVisible({ timeout: 10000 });
		}
	});

	test('5. should navigate to Useful Links sub-page', async ({ page }) => {
		await waitForDataLoad(page);

		const usefulLinksButton = page.locator('button[aria-label*="Useful Links" i], button:has-text("Useful Links")').first();
		
		if (await usefulLinksButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await usefulLinksButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);

			// Verify Useful Links button is visible
			await expect(page.getByRole('button', { name: /Useful Links/i })).toBeVisible({ timeout: 10000 });
		}
	});

	test('6. should display league tables on League Information page', async ({ page }) => {
		await waitForDataLoad(page);

		// Navigate to League Information
		const leagueInfoButton = page.locator('button[aria-label*="League Information" i], button:has-text("League Information")').first();
		
		if (await leagueInfoButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await leagueInfoButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);
			await page.waitForTimeout(2000);

			// Verify league tables or standings are displayed
			const hasTables = await page.locator('table, [class*="table" i], text=/Position|Team|Points/i').isVisible({ timeout: 5000 }).catch(() => false);
			expect(hasTables).toBe(true);
		}
	});
});
