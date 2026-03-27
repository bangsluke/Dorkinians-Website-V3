import { test, expect } from "@playwright/test";
import { clickStatsSubPage, getVisibleNavButton, isMobileProject } from "../utils/testHelpers";

// Minimal shell readiness after goto — avoids waiting on networkidle (analytics, etc.).
async function expectMainPageReady(page: import("@playwright/test").Page) {
	await page.waitForLoadState("domcontentloaded");
	await expect(page.locator("body")).toBeVisible();
}

// Footer icons on narrow viewports vs left sidebar on desktop; Stats/TOTW/Club Info keep you on `/` with client state — only Settings uses `/settings`.
test.describe("Navigation Tests", () => {
	test("1.1. should navigate to Home page", async ({ page }) => {
		await page.goto("/");
		await expectMainPageReady(page);
		await expect(page).toHaveURL(/\/?$/);
		// Home is identified by the player picker hero — user has not entered Stats yet.
		await expect(page.getByTestId("player-selection-button").or(page.getByRole("button", { name: /Choose a player/i }))).toBeVisible({
			timeout: 15000,
		});
	});

	test("1.2. should navigate to Stats page", async ({ page }) => {
		await page.goto("/");
		await expectMainPageReady(page);
		const statsBtn = await getVisibleNavButton(page, "stats");
		// Single click switches main pane to Player Stats while URL stays on root.
		await statsBtn.click({ timeout: 15000 });
		await expect(page.getByTestId("stats-page-heading").first()).toBeVisible({ timeout: 20000 });
	});

	test("1.3. should navigate to TOTW page", async ({ page }) => {
		await page.goto("/");
		await expectMainPageReady(page);
		const totwBtn = await getVisibleNavButton(page, "totw");
		await totwBtn.click({ timeout: 15000 });
		await page.waitForTimeout(500);
		// Soft check: route transition should not white-screen; detailed TOTW assertions live in totw.spec.
		await expect(page.locator("body")).toBeVisible();
	});

	test("1.4. should navigate to Club Info page", async ({ page }) => {
		await page.goto("/");
		await expectMainPageReady(page);
		const clubBtn = await getVisibleNavButton(page, "club-info");
		await clubBtn.click({ timeout: 15000 });
		await page.waitForTimeout(500);
		await expect(page.locator("body")).toBeVisible();
	});

	test.describe("Settings Navigation - Desktop", () => {
		test.use({ viewport: { width: 1280, height: 720 } });
		test("1.5. should navigate to Settings page on desktop", async ({ page }) => {
			await page.goto("/");
			await expectMainPageReady(page);
			// Gear at bottom of the persistent left nav — only settings uses a real Next.js route change.
			await page.getByTestId("nav-sidebar-settings").click({ timeout: 15000 });
			await expect(page).toHaveURL(/\/settings/, { timeout: 15000 });
			await expect(page.locator("body")).toBeVisible();
		});
	});

	test.describe("Settings Navigation - Mobile", () => {
		test.use({ viewport: { width: 390, height: 844 } });
		test("1.6. should navigate to Settings page on mobile", async ({ page }) => {
			await page.goto("/");
			await expectMainPageReady(page);
			// Mobile exposes settings from the top app bar instead of the footer strip.
			await page.getByTestId("header-settings").click({ timeout: 15000 });
			await expect(page).toHaveURL(/\/settings/, { timeout: 15000 });
			await expect(page.locator("body")).toBeVisible();
		});
	});

	test("1.7. should navigate between Stats sub-pages", async ({ page }) => {
		await page.goto("/");
		await expectMainPageReady(page);
		const statsBtn = await getVisibleNavButton(page, "stats");
		await statsBtn.click({ timeout: 15000 });
		await expect(page.getByTestId("stats-page-heading").first()).toBeVisible({ timeout: 20000 });

		// Team tab: squad-level dashboards (distinct heading from Player Stats).
		await clickStatsSubPage(page, "team-stats");
		const teamTopPlayersHeading = page.getByTestId("team-top-players-heading").first();
		const teamStatsHeading = page.getByRole("heading", { name: /Team Stats/i }).first();
		try {
			await expect(teamTopPlayersHeading).toBeVisible({ timeout: 20000 });
		} catch {
			await expect(teamStatsHeading).toBeVisible({ timeout: 20000 });
		}

		// Club tab: all-teams aggregates or explicit empty copy.
		await clickStatsSubPage(page, "club-stats");
		await expect(page.getByTestId("club-top-players-heading").first().or(page.getByText(/No team data available/i))).toBeVisible({
			timeout: 20000,
		});

		// Comparison tab: radar placeholder, empty prompt, or “select player” helper text.
		await clickStatsSubPage(page, "comparison");
		await expect(
			page.locator("#comparison-radar-chart").or(page.getByText(/No data available for comparison/i)).or(page.getByText(/Select a player to display data here/i))
		).toBeVisible({ timeout: 20000 });

		// Return to default Player Stats tab for a clean end state.
		await clickStatsSubPage(page, "player-stats");
		await expect(page.getByTestId("stats-page-heading").first()).toBeVisible({ timeout: 20000 });
	});

	test("1.8. should navigate between TOTW sub-pages", async ({ page }, testInfo) => {
		await page.goto("/");
		await expectMainPageReady(page);
		const totwBtn = await getVisibleNavButton(page, "totw");
		await totwBtn.click({ timeout: 15000 });
		await page.waitForTimeout(500);

		const mobile = isMobileProject(testInfo);

		if (mobile) {
			// Mobile: horizontal dot pager under the TOTW header switches “Team of the Week” vs “Players of the Month”.
			await page.getByTestId("totw-subpage-indicator-players-of-month").click({ timeout: 15000 });
			await page.waitForTimeout(800);
			await page.getByTestId("totw-subpage-indicator-totw").click({ timeout: 15000 });
		} else {
			await page.getByTestId("nav-sidebar-players-of-month").click({ timeout: 15000 });
			await page.waitForTimeout(800);
			// Parent TOTW control shares test id with "Team of the Week" sub-link — use the first match (parent).
			await page.getByTestId("nav-sidebar-totw").first().click({ timeout: 15000 });
		}
		await expect(page.locator("body")).toBeVisible();
	});
});
