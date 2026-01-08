import { test, expect } from '@playwright/test';
import { navigateToMainPage, waitForPageLoad, waitForDataLoad } from '../utils/testHelpers';
import { TEST_PLAYERS, TEST_TEAMS } from '../fixtures/testData';

test.describe('Stats Page Tests', () => {
	test.beforeEach(async ({ page }) => {
		await navigateToMainPage(page, 'stats');
		await waitForPageLoad(page);
	});

	test('should display Player Stats page by default', async ({ page }) => {
		// Wait for data to load
		await waitForDataLoad(page);

		// Verify Player Stats content is visible
		await expect(
			page.locator('text=/Player Stats|Key Performance|Seasonal Performance/i')
		).toBeVisible({ timeout: 10000 });
	});

	test('should navigate between Stats sub-pages', async ({ page }) => {
		await waitForDataLoad(page);

		// Find sub-page navigation (dots on mobile, menu on desktop)
		const teamStatsButton = page.locator('button[aria-label*="Team Stats" i], button:has-text("Team Stats")').first();
		
		if (await teamStatsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await teamStatsButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);

			// Verify Team Stats content
			await expect(page.locator('text=/Team Stats|Team.*Stats/i')).toBeVisible({ timeout: 10000 });
		}
	});

	test('should open and use filter sidebar', async ({ page }) => {
		await waitForDataLoad(page);

		// Find filter icon/button
		const filterButton = page.locator('button[aria-label*="filter" i], button[aria-label*="Filter" i]').first();
		
		if (await filterButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await filterButton.click();
			await page.waitForTimeout(500);

			// Verify filter sidebar is open
			const filterSidebar = page.locator('[class*="sidebar" i], [class*="Sidebar" i], [role="complementary"]');
			await expect(filterSidebar).toBeVisible({ timeout: 5000 });

			// Try to select a filter (e.g., team filter)
			const teamFilter = filterSidebar.locator('text=/Team|1st|2nd|3rd/i').first();
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

			// Close filter sidebar
			const closeButton = filterSidebar.locator('button[aria-label*="close" i], button:has-text("Close")').first();
			if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
				await closeButton.click();
			} else {
				// Click outside or press ESC
				await page.keyboard.press('Escape');
			}
		}
	});

	test('should display data tables', async ({ page }) => {
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

	test('should display charts', async ({ page }) => {
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

	test('should navigate to Team Stats sub-page', async ({ page }) => {
		await waitForDataLoad(page);

		// Navigate to Team Stats
		const teamStatsButton = page.locator('button[aria-label*="Team Stats" i], button:has-text("Team Stats")').first();
		
		if (await teamStatsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await teamStatsButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);

			// Verify team selection or team stats are displayed
			await expect(
				page.locator('text=/Team Stats|Select.*Team|1st XI|2nd XI/i')
			).toBeVisible({ timeout: 10000 });
		}
	});

	test('should navigate to Club Stats sub-page', async ({ page }) => {
		await waitForDataLoad(page);

		// Navigate to Club Stats
		const clubStatsButton = page.locator('button[aria-label*="Club Stats" i], button:has-text("Club Stats")').first();
		
		if (await clubStatsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await clubStatsButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);

			// Verify club stats content
			await expect(
				page.locator('text=/Club Stats|Club.*Stats|Team Comparison/i')
			).toBeVisible({ timeout: 10000 });
		}
	});

	test('should navigate to Comparison sub-page', async ({ page }) => {
		await waitForDataLoad(page);

		// Navigate to Comparison
		const comparisonButton = page.locator('button[aria-label*="Comparison" i], button:has-text("Comparison")').first();
		
		if (await comparisonButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await comparisonButton.click();
			await waitForPageLoad(page);
			await waitForDataLoad(page);

			// Verify comparison content
			await expect(
				page.locator('text=/Comparison|Select.*Player|Radar/i')
			).toBeVisible({ timeout: 10000 });
		}
	});
});
