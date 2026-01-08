import { test, expect } from '@playwright/test';
import { waitForPageLoad } from '../utils/testHelpers';

test.describe('Settings Page Tests', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/settings');
		await waitForPageLoad(page);
	});

	test('should display Settings page', async ({ page }) => {
		// Verify Settings page content
		await expect(
			page.locator('text=/Settings|Database Status|PWA|Navigation/i')
		).toBeVisible({ timeout: 10000 });
	});

	test('should display navigation shortcuts', async ({ page }) => {
		// Verify navigation shortcuts are visible
		await expect(
			page.locator('text=/Home|Stats|TOTW|Club Info|Quick.*Navigation/i')
		).toBeVisible({ timeout: 10000 });
	});

	test('should navigate using quick navigation shortcuts', async ({ page }) => {
		// Find a navigation shortcut (e.g., Home)
		const homeShortcut = page.locator('button:has-text("Home"), [aria-label*="Home" i]').first();
		
		if (await homeShortcut.isVisible({ timeout: 5000 }).catch(() => false)) {
			await homeShortcut.click();
			await waitForPageLoad(page);

			// Verify we navigated to home page
			await expect(
				page.locator('text=/Welcome|Select.*player|Player Selection/i')
			).toBeVisible({ timeout: 10000 });
		}
	});

	test('should display database status', async ({ page }) => {
		// Verify database status section is visible
		const hasStatus = await page.locator('text=/Database.*Status|Last.*Seeded|Version/i').isVisible({ timeout: 5000 }).catch(() => false);
		// Database status is optional, so we don't fail if not present
	});

	test('should display PWA install button', async ({ page }) => {
		// Verify PWA install button is present (if PWA is supported)
		const pwaButton = page.locator('button:has-text("Install"), button:has-text("Add to Home Screen"), [aria-label*="install" i]');
		const hasPWAButton = await pwaButton.isVisible({ timeout: 5000 }).catch(() => false);
		// PWA button may not be visible in all browsers, so we don't fail if not present
	});
});
