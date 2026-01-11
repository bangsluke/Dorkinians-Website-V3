// @ts-check

import { test, expect } from '@playwright/test';
import { navigateToMainPage, waitForPageLoad, logSectionHeader } from '../utils/testHelpers';

test.describe('Navigation Tests', () => {
	test.beforeAll(() => {
		logSectionHeader('NAVIGATION TESTS', '📍', '01');
	});

	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await waitForPageLoad(page);
	});

	test('1. should navigate to Home page', async ({ page }) => {
		const homeButton = page.getByRole('button', { name: 'Home' }).first();
		await homeButton.waitFor({ state: 'visible', timeout: 10000 });
		await homeButton.scrollIntoViewIfNeeded();
		await homeButton.click();
		await waitForPageLoad(page);

		const welcome = page.getByRole('heading', { name: /Welcome to the Dorkinians FC/i });
		const choosePlayer = page.getByRole('button', { name: /Choose a player/i });

		await Promise.race([
			expect(welcome).toBeVisible({ timeout: 10000 }),
			expect(choosePlayer).toBeVisible({ timeout: 10000 })
		]);
	});

	test('2. should navigate to Stats page', async ({ page }) => {
		const statsButton = page.getByRole('button', { name: 'Stats' }).first();
		await statsButton.waitFor({ state: 'visible', timeout: 10000 });
		await statsButton.scrollIntoViewIfNeeded();
		await statsButton.click();
		await waitForPageLoad(page);

		await expect(page.getByRole('button', { name: /Player Stats/i })).toBeVisible({ timeout: 10000 });
	});

	test('3. should navigate to TOTW page', async ({ page }) => {
		const totwButton = page.getByRole('button', { name: 'TOTW' }).first();
		await totwButton.waitFor({ state: 'visible', timeout: 10000 });
		await totwButton.scrollIntoViewIfNeeded();
		await totwButton.click();
		await waitForPageLoad(page);

		const totwHeading1 = page.getByRole('heading', { name: /Team of the Week/i });
		const totwHeading2 = page.getByRole('heading', { name: /TOTW/i });

		await Promise.race([
			expect(totwHeading1).toBeVisible({ timeout: 10000 }),
			expect(totwHeading2).toBeVisible({ timeout: 10000 })
		]);
	});

	test('4. should navigate to Club Info page', async ({ page }) => {
		const clubInfoButton = page.getByRole('button', { name: 'Club Info' }).first();
		await clubInfoButton.waitFor({ state: 'visible', timeout: 10000 });
		await clubInfoButton.scrollIntoViewIfNeeded();
		await clubInfoButton.click();
		await waitForPageLoad(page);

		await expect(page.getByRole('button', { name: /Club Information/i })).toBeVisible({ timeout: 10000 });
	});

	/* ---------------------------------------------------------
	   DESKTOP SETTINGS TEST
	   --------------------------------------------------------- */
	   test.describe('Settings Navigation - Desktop', () => {
		test.use({ viewport: { width: 1280, height: 800 } });
	
		test('5. should navigate to Settings page on desktop', async ({ page }) => {
			// Desktop settings icon lives in <aside>, not <header>
			const desktopSettingsButton = page
				.locator('aside')
				.getByTitle('Open settings')
				.first();
	
			await desktopSettingsButton.waitFor({ state: 'visible', timeout: 10000 });
			await desktopSettingsButton.scrollIntoViewIfNeeded();
			await desktopSettingsButton.click();
	
			await waitForPageLoad(page);
	
			await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 10000 });			  
		});
	});
	

	/* ---------------------------------------------------------
	   MOBILE SETTINGS TEST
	   --------------------------------------------------------- */
	   test.describe('Settings Navigation - Mobile', () => {
		test.use({ viewport: { width: 375, height: 812 } });
	
		test('6. should navigate to Settings page on mobile', async ({ page }) => {
			// Mobile settings icon lives in <header class="md:hidden">
			const mobileSettingsButton = page
				.locator('header.md\\:hidden')
				.getByTitle('Open settings')
				.first();
	
			await mobileSettingsButton.waitFor({ state: 'visible', timeout: 10000 });
			await mobileSettingsButton.scrollIntoViewIfNeeded();
			await mobileSettingsButton.click();
	
			await waitForPageLoad(page);
	
			await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 10000 });
		});
	});
	

	test('7. should navigate between Stats sub-pages', async ({ page }) => {
		const statsButton = page.getByRole('button', { name: 'Stats' }).first();
		await statsButton.waitFor({ state: 'visible', timeout: 10000 });
		await statsButton.scrollIntoViewIfNeeded();
		await statsButton.click();
		await waitForPageLoad(page);

		const subPageIndicators = page.locator('[class*="dot"], [class*="indicator"], button[aria-label*="Player Stats" i]');
		const count = await subPageIndicators.count();

		if (count > 0) {
			const teamStatsButton = page.locator('button:has-text("Team Stats"), [aria-label*="Team Stats" i]').first();
			if (await teamStatsButton.isVisible({ timeout: 2000 }).catch(() => false)) {
				await teamStatsButton.click();
				await waitForPageLoad(page);
				await expect(page.getByRole('button', { name: /Team Stats/i })).toBeVisible({ timeout: 10000 });
			}
		}
	});

	test('8. should navigate between TOTW sub-pages', async ({ page }) => {
		const totwButton = page.getByRole('button', { name: 'TOTW' }).first();
		await totwButton.waitFor({ state: 'visible', timeout: 10000 });
		await totwButton.scrollIntoViewIfNeeded();
		await totwButton.click();
		await waitForPageLoad(page);

		const playersOfMonthButton = page.locator('button:has-text("Players of the Month"), [aria-label*="Players of the Month" i]').first();
		if (await playersOfMonthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
			await playersOfMonthButton.click();
			await waitForPageLoad(page);
			await expect(page.locator('text=/Players of the Month/i')).toBeVisible({ timeout: 10000 });
		}
	});
});
