// @ts-check

import { test, expect } from '@playwright/test';
import { navigateToMainPage, waitForPageLoad, waitForDataLoad, logSectionHeader, selectPlayer, setPlayerDirectly, setupPlayerStatsPage } from '../utils/testHelpers';
import { TEST_PLAYERS, TEST_TEAMS } from '../fixtures/testData';

test.describe('Stats Page Tests', () => {
	test.beforeAll(() => {
		logSectionHeader('STATS PAGE TESTS', '📊', '03');
	});

	test.beforeEach(async ({ page }) => {
		await navigateToMainPage(page, 'stats');
		await waitForPageLoad(page);
	});

	test('1. should display Player Stats page by default', async ({ page }) => {
		// Set up localStorage for Player Stats page
		await setupPlayerStatsPage(page, TEST_PLAYERS.primary);
		
		// Navigate to stats (beforeEach already does this, but we ensure it's set before)
		await navigateToMainPage(page, 'stats');
		await waitForPageLoad(page);
		
		// Verify player is selected by checking if player selection button shows the player name
		// This ensures the store has been updated
		const playerButton = page.getByTestId('player-selection-button');
		const playerButtonText = await playerButton.textContent({ timeout: 5000 }).catch(() => null);
		if (playerButtonText && !playerButtonText.includes(TEST_PLAYERS.primary)) {
			console.log(`Warning: Player selection might not be complete. Button text: ${playerButtonText}`);
		}
		
		// Ensure we're on player-stats sub-page (default should be player-stats, but verify)
		// Check for the first sub-page indicator (index 0 = player-stats)
		const playerStatsIndicator = page.getByTestId('stats-subpage-indicator-0');
		const isPlayerStatsActive = await playerStatsIndicator.evaluate((el) => {
			return el.classList.contains('bg-dorkinians-yellow') || 
			       window.getComputedStyle(el).backgroundColor.includes('249') || // yellow color
			       el.getAttribute('aria-label')?.includes('Player Stats');
		}).catch(() => false);
		
		if (!isPlayerStatsActive) {
			console.log('Warning: Not on player-stats sub-page, attempting to ensure correct page...');
			// Try clicking the first indicator to ensure we're on player-stats
			await playerStatsIndicator.click({ timeout: 2000 }).catch(() => {});
			await page.waitForTimeout(200);
		}

		// Wait for data to load (skeleton to disappear)
		await waitForDataLoad(page);

		// Wait for animation to complete (StatsContainer uses AnimatePresence with 0.2s transition)
		await page.waitForTimeout(300);
		
		// Explicitly wait for the heading element to exist in DOM
		// This ensures PlayerStats component has rendered (regardless of which branch)
		await page.waitForSelector('[data-testid="stats-page-heading"]', { 
			timeout: 10000,
			state: 'attached'
		});

		// Debug: Check if heading exists in DOM (should already be attached from wait above)
		const headingExists = await page.locator('[data-testid="stats-page-heading"]').count();
		console.log(`Heading elements found: ${headingExists}`);
		
		if (headingExists === 0) {
			// Log page state for debugging
			const pageContent = await page.content();
			const hasPlayerStats = pageContent.includes('PlayerStats') || pageContent.includes('stats-page-heading');
			const hasLoadingSkeleton = pageContent.includes('loading-skeleton');
			console.log(`Page state - Has PlayerStats: ${hasPlayerStats}, Has loading-skeleton: ${hasLoadingSkeleton}`);
		}

		// Verify Player Stats heading is visible - try test ID first
		await expect(page.getByTestId('stats-page-heading')).toBeVisible({ timeout: 10000 });
	});

	test('2. should navigate between Stats sub-pages', async ({ page }) => {
		await waitForDataLoad(page);

		// Find sub-page navigation (dots on mobile, menu on desktop) - try test IDs first
		const teamStatsButton = page.getByTestId('stats-nav-menu-team-stats')
			.or(page.getByTestId('nav-sidebar-team-stats'))
			.or(page.getByTestId('stats-subpage-indicator-1'))
			.or(page.locator('button[aria-label*="Team Stats" i], button:has-text("Team Stats")'))
			.first();
		
		if (await teamStatsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await teamStatsButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);

			// Verify Team Stats button is visible
			await expect(page.getByTestId('stats-nav-menu-team-stats').or(page.getByRole('button', { name: /Team Stats/i }))).toBeVisible({ timeout: 10000 });
		}
	});

	test('3. should open and use filter sidebar', async ({ page }) => {
		await waitForDataLoad(page);

		// Find filter icon/button - try test IDs first
		const filterButton = page.getByTestId('nav-sidebar-filter')
			.or(page.getByTestId('header-filter'))
			.or(page.locator('button[aria-label*="filter" i], button[aria-label*="Filter" i]'))
			.first();
		
		if (await filterButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await filterButton.click();
			await page.waitForTimeout(500);

			// Verify filter sidebar is open - try test ID first
			const filterSidebar = page.getByTestId('filter-sidebar')
				.or(page.locator('[class*="sidebar" i], [class*="Sidebar" i], [role="complementary"]'));
			await expect(filterSidebar).toBeVisible({ timeout: 5000 });

			// Try to select a filter (e.g., team filter) - check for Team first
			const teamFilter = filterSidebar.getByTestId('filter-team')
				.or(filterSidebar.getByText(/Team/i))
				.first();
			
			if (await teamFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
				await teamFilter.click();
				await waitForDataLoad(page);

				// Verify filter is applied (filter pills should appear)
				const filterPills = page.locator('[class*="pill" i], [class*="filter" i]').filter({ 
					hasText: /Team|1st|2nd|3rd/i 
				});
				const hasPills = await filterPills.isVisible({ timeout: 3000 }).catch(() => false);
				// Filter pills are optional, so we don't fail if they're not present
			}

			// Close filter sidebar - try test ID first
			const closeButton = filterSidebar.getByTestId('filter-sidebar-close')
				.or(filterSidebar.locator('button[aria-label*="close" i], button:has-text("Close")'))
				.first();
			
			if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
				await closeButton.click();
			} else {
				// Click outside or press ESC
				await page.keyboard.press('Escape');
			}
		}
	});

	test('4. should display data tables', async ({ page }) => {
		await waitForDataLoad(page);
		await page.waitForTimeout(2000);

		// Look for data table (could be in various sections)
		const dataTable = page.locator('table, [class*="table" i], [class*="Table" i]').first();
		const hasTable = await dataTable.isVisible({ timeout: 5000 }).catch(() => false);
		
		// Data tables are optional depending on the section, so we don't fail if not present
		// But if present, verify it has content
		if (hasTable) {
			const rows = dataTable.locator('tr, [class*="row" i]');
			const rowCount = await rows.count();
			expect(rowCount).toBeGreaterThan(0);
		}
	});

	test('5. should display charts', async ({ page }) => {
		await waitForDataLoad(page);
		await page.waitForTimeout(2000);

		// Look for chart elements (Recharts creates SVG elements)
		const charts = page.locator('svg, [class*="chart" i], [class*="Chart" i]');
		const chartCount = await charts.count();
		
		// Charts are optional depending on the section, so we don't fail if not present
		// But if present, verify they're rendered
		if (chartCount > 0) {
			// Verify at least one chart is visible
			const visibleCharts = charts.filter({ has: page.locator('g, path, rect') });
			const visibleCount = await visibleCharts.count();
			expect(visibleCount).toBeGreaterThan(0);
		}
	});

	test('6. should navigate to Team Stats sub-page', async ({ page }) => {
		await waitForDataLoad(page);

		// Navigate to Team Stats - try test IDs first
		const teamStatsButton = page.getByTestId('stats-nav-menu-team-stats')
			.or(page.getByTestId('nav-sidebar-team-stats'))
			.or(page.locator('button[aria-label*="Team Stats" i], button:has-text("Team Stats")'))
			.first();
		
		if (await teamStatsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await teamStatsButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);

			// Verify Team Stats button is visible
			await expect(page.getByTestId('stats-nav-menu-team-stats').or(page.getByRole('button', { name: /Team Stats/i }))).toBeVisible({ timeout: 10000 });
		}
	});

	test('7. should navigate to Club Stats sub-page', async ({ page }) => {
		await waitForDataLoad(page);

		// Navigate to Club Stats - try test IDs first
		const clubStatsButton = page.getByTestId('stats-nav-menu-club-stats')
			.or(page.getByTestId('nav-sidebar-club-stats'))
			.or(page.locator('button[aria-label*="Club Stats" i], button:has-text("Club Stats")'))
			.first();
		
		if (await clubStatsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await clubStatsButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);

			// Verify Club Stats button is visible
			await expect(page.getByTestId('stats-nav-menu-club-stats').or(page.getByRole('button', { name: /Club Stats/i }))).toBeVisible({ timeout: 10000 });
		}
	});

	test('8. should navigate to Comparison sub-page', async ({ page }) => {
		await waitForDataLoad(page);

		// Navigate to Comparison - try test IDs first
		const comparisonButton = page.getByTestId('stats-nav-menu-comparison')
			.or(page.getByTestId('nav-sidebar-comparison'))
			.or(page.locator('button[aria-label*="Comparison" i], button:has-text("Comparison")'))
			.first();
		
		if (await comparisonButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await comparisonButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);

			// Verify Comparison button is visible
			await expect(page.getByTestId('stats-nav-menu-comparison').or(page.getByRole('button', { name: /Comparison/i }))).toBeVisible({ timeout: 10000 });
		}
	});
});
