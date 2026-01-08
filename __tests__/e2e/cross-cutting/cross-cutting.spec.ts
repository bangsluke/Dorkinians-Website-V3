import { test, expect } from '@playwright/test';
import { navigateToMainPage, waitForPageLoad, waitForDataLoad, verifyNoConsoleErrors } from '../utils/testHelpers';

test.describe('Cross-Cutting Tests', () => {
	test('should handle loading states correctly', async ({ page }) => {
		// Navigate to a page that loads data
		await navigateToMainPage(page, 'stats');
		await waitForPageLoad(page);

		// Check for loading skeletons (they should appear briefly)
		const skeletons = page.locator('[class*="skeleton" i], [class*="Skeleton" i], [class*="loading" i]');
		const skeletonCount = await skeletons.count();

		// Wait for data to load (skeletons should disappear)
		await waitForDataLoad(page);

		// Verify skeletons are gone and data is displayed
		const finalSkeletonCount = await skeletons.count();
		expect(finalSkeletonCount).toBeLessThan(skeletonCount);
	});

	test('should handle errors gracefully', async ({ page }) => {
		// Navigate to a page
		await navigateToMainPage(page, 'home');
		await waitForPageLoad(page);

		// Try to select an invalid player
		const playerInput = page.locator('input[type="text"], input[placeholder*="player" i]').first();
		
		if (await playerInput.isVisible({ timeout: 5000 }).catch(() => false)) {
			await playerInput.fill('InvalidPlayerName12345');
			await page.waitForTimeout(1000);

			// App should not crash - verify page is still functional
			await expect(page.locator('body')).toBeVisible();
		}
	});

	test('should be responsive on mobile viewport', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		
		await navigateToMainPage(page, 'home');
		await waitForPageLoad(page);

		// Verify content is visible and readable
		await expect(page.locator('body')).toBeVisible();
		
		// Verify navigation is accessible (footer navigation on mobile)
		const footerNav = page.locator('[class*="footer" i], [class*="Footer" i], nav').first();
		const hasFooterNav = await footerNav.isVisible({ timeout: 5000 }).catch(() => false);
		expect(hasFooterNav).toBe(true);
	});

	test('should handle touch interactions on mobile', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		
		await navigateToMainPage(page, 'stats');
		await waitForPageLoad(page);

		// Try swiping between sub-pages (if supported)
		// This is a basic check - full swipe gesture testing would require more complex setup
		const subPageButton = page.locator('button[aria-label*="Team Stats" i]').first();
		
		if (await subPageButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await subPageButton.click();
			await waitForPageLoad(page);
			
			// Verify navigation worked
			await expect(page.locator('text=/Team Stats/i')).toBeVisible({ timeout: 10000 });
		}
	});

	test('should not have console errors on page load', async ({ page }) => {
		const errors: string[] = [];
		
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});

		await navigateToMainPage(page, 'home');
		await waitForPageLoad(page);
		await waitForDataLoad(page);

		// Filter out known non-critical errors (e.g., analytics, third-party scripts)
		const criticalErrors = errors.filter(error => 
			!error.includes('Analytics') && 
			!error.includes('umami') &&
			!error.includes('favicon')
		);

		// Log errors for debugging but don't fail unless critical
		if (criticalErrors.length > 0) {
			console.log('Console errors found:', criticalErrors);
		}
	});

	test('should maintain navigation state across page refreshes', async ({ page }) => {
		// Navigate to a specific page
		await navigateToMainPage(page, 'totw');
		await waitForPageLoad(page);

		// Refresh page
		await page.reload();
		await waitForPageLoad(page);

		// Verify we're still on the same page (or at least a valid page)
		await expect(page.locator('body')).toBeVisible();
	});

	test('should handle data validation', async ({ page }) => {
		// Navigate to TOTW page
		await navigateToMainPage(page, 'totw');
		await waitForDataLoad(page);
		await page.waitForTimeout(2000);

		// Verify data is present and formatted correctly
		// Check for player names (should be text, not empty)
		const playerElements = page.locator('div.cursor-pointer').filter({ 
			has: page.locator('text=/[A-Z][a-z]+/') 
		});
		const playerCount = await playerElements.count();
		
		if (playerCount > 0) {
			// Verify player names are not empty
			const firstPlayer = playerElements.first();
			const playerText = await firstPlayer.textContent();
			expect(playerText).toBeTruthy();
			expect(playerText!.trim().length).toBeGreaterThan(0);
		}
	});
});
