import { test, expect } from "@playwright/test";
import { getVisibleNavButton } from "../utils/testHelpers";

async function expectMainPageReady(page: import("@playwright/test").Page) {
	await page.waitForLoadState("domcontentloaded");
	await expect(page.locator("body")).toBeVisible();
}

test.describe("Navigation Tests", () => {
	test("1. should navigate to Home page", async ({ page }) => {
		await page.goto("/");
		await expectMainPageReady(page);
		await expect(page).toHaveURL(/\/?$/);
		await expect(page.getByTestId("player-selection-button").or(page.getByRole("button", { name: /Choose a player/i }))).toBeVisible({
			timeout: 15000,
		});
	});

	test("2. should navigate to Stats page", async ({ page }) => {
		await page.goto("/");
		await expectMainPageReady(page);
		const statsBtn = await getVisibleNavButton(page, "stats");
		await statsBtn.click({ timeout: 15000 });
		await expect(page.getByTestId("stats-page-heading").first()).toBeVisible({ timeout: 20000 });
	});

	test("3. should navigate to TOTW page", async ({ page }) => {
		await page.goto("/");
		await expectMainPageReady(page);
		const totwBtn = await getVisibleNavButton(page, "totw");
		await totwBtn.click({ timeout: 15000 });
		await page.waitForTimeout(500);
		await expect(page.locator("body")).toBeVisible();
	});

	test("4. should navigate to Club Info page", async ({ page }) => {
		await page.goto("/");
		await expectMainPageReady(page);
		const clubBtn = await getVisibleNavButton(page, "club-info");
		await clubBtn.click({ timeout: 15000 });
		await page.waitForTimeout(500);
		await expect(page.locator("body")).toBeVisible();
	});

	test.describe("Settings Navigation - Desktop", () => {
		test.use({ viewport: { width: 1280, height: 720 } });
		test("5. should navigate to Settings page on desktop", async ({ page }) => {
			await page.goto("/");
			await expectMainPageReady(page);
			await page.getByTestId("nav-sidebar-settings").click({ timeout: 15000 });
			await expect(page).toHaveURL(/\/settings/, { timeout: 15000 });
			await expect(page.locator("body")).toBeVisible();
		});
	});

	test.describe("Settings Navigation - Mobile", () => {
		test.use({ viewport: { width: 390, height: 844 } });
		test("6. should navigate to Settings page on mobile", async ({ page }) => {
			await page.goto("/");
			await expectMainPageReady(page);
			await page.getByTestId("header-settings").click({ timeout: 15000 });
			await expect(page).toHaveURL(/\/settings/, { timeout: 15000 });
			await expect(page.locator("body")).toBeVisible();
		});
	});

	test("7. should navigate between Stats sub-pages", async ({ page }) => {
		await page.goto("/");
		await expectMainPageReady(page);
		const statsBtn = await getVisibleNavButton(page, "stats");
		await statsBtn.click({ timeout: 15000 });
		await expect(page.getByTestId("stats-page-heading").first()).toBeVisible({ timeout: 20000 });

		await page.getByTestId("nav-sidebar-team-stats").click({ timeout: 15000 });
		await page.waitForTimeout(800);
		await expect(page.locator("body")).toBeVisible();

		await page.getByTestId("nav-sidebar-club-stats").click({ timeout: 15000 });
		await page.waitForTimeout(800);

		await page.getByTestId("nav-sidebar-comparison").click({ timeout: 15000 });
		await page.waitForTimeout(800);

		await page.getByTestId("nav-sidebar-player-stats").click({ timeout: 15000 });
		await expect(page.getByTestId("stats-page-heading").first()).toBeVisible({ timeout: 20000 });
	});

	test("8. should navigate between TOTW sub-pages", async ({ page }, testInfo) => {
		await page.goto("/");
		await expectMainPageReady(page);
		const totwBtn = await getVisibleNavButton(page, "totw");
		await totwBtn.click({ timeout: 15000 });
		await page.waitForTimeout(500);

		const mobile = testInfo.project.name.includes("Mobile");

		if (mobile) {
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
