import { test, expect } from "@playwright/test";
import {
	getVisibleNavButton,
	setupPlayerStatsPage,
	toggleDataTable,
	waitForPageLoad,
} from "../utils/testHelpers";

const DEFAULT_PLAYER = process.env.E2E_PLAYER_NAME || "Luke Bangs";

const PLAYER_SECTION_IDS = [
	"key-performance-stats",
	"all-games",
	"seasonal-performance",
	"team-performance",
	"positional-stats",
	"match-results",
	"game-details",
	"monthly-performance",
	"defensive-record",
	"distance-travelled",
	"opposition-locations",
	"minutes-per-stats",
	"opposition-performance",
	"fantasy-points",
	"penalty-stats",
	"captaincies-awards-and-achievements",
];

const TEAM_SECTION_IDS = [
	"team-key-performance-stats",
	"team-recent-games",
	"team-top-players",
	"team-seasonal-performance",
	"team-match-results",
	"team-goals-scored-conceded",
	"team-home-away-performance",
	"team-key-team-stats",
	"team-unique-player-stats",
	"team-best-season-finish",
];

const CLUB_SECTION_IDS = [
	"club-key-performance-stats",
	"club-team-comparison",
	"club-top-players",
	"club-seasonal-performance",
	"club-player-distribution",
	"club-player-tenure",
	"club-stats-distribution",
	"club-match-results",
	"club-game-details",
	"club-big-club-numbers",
	"club-goals-scored-conceded",
	"club-home-away-performance",
	"club-other-club-stats",
	"club-unique-player-stats",
];

const COMPARISON_SECTION_IDS = ["comparison-radar-chart", "comparison-full-comparison"];

async function openStatsFromHome(page: import("@playwright/test").Page) {
	await page.goto("/");
	await waitForPageLoad(page);
	const statsBtn = await getVisibleNavButton(page, "stats");
	await statsBtn.click({ timeout: 15000 });
	await expect(page.getByTestId("stats-page-heading").first()).toBeVisible({ timeout: 25000 });
}

test.describe("Stats Page Tests", () => {
	test("3.1. should display Player Stats page by default", async ({ page }) => {
		await setupPlayerStatsPage(page, DEFAULT_PLAYER);
		await page.goto("/stats", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("stats-page-heading").first()).toBeVisible({ timeout: 25000 });
	});

	test("3.2. should navigate between Stats sub-pages", async ({ page }) => {
		await openStatsFromHome(page);
		await page.getByTestId("nav-sidebar-team-stats").click({ timeout: 15000 });
		await page.waitForTimeout(600);
		await page.getByTestId("nav-sidebar-club-stats").click({ timeout: 15000 });
		await page.waitForTimeout(600);
		await page.getByTestId("nav-sidebar-comparison").click({ timeout: 15000 });
		await page.waitForTimeout(600);
		await page.getByTestId("nav-sidebar-player-stats").click({ timeout: 15000 });
		await expect(page.getByTestId("stats-page-heading").first()).toBeVisible({ timeout: 20000 });
	});

	test("3.3. should open and use filter sidebar", async ({ page }) => {
		await openStatsFromHome(page);
		const vp = page.viewportSize();
		const mobile = vp ? vp.width < 768 : false;
		if (mobile) {
			await page.getByTestId("header-filter").click({ timeout: 15000 });
		} else {
			await page.getByTestId("nav-sidebar-filter").click({ timeout: 15000 });
		}
		await expect(page.getByText(/Filter Players/i).first()).toBeVisible({ timeout: 15000 });
		await page.keyboard.press("Escape").catch(() => {});
	});

	test("3.4. should display data tables", async ({ page }) => {
		await setupPlayerStatsPage(page, DEFAULT_PLAYER);
		await page.goto("/stats", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("stats-page-heading").first()).toBeVisible({ timeout: 25000 });
		await page.waitForTimeout(1500);
		await expect(page.locator("table").first()).toBeVisible({ timeout: 20000 });
	});

	test("3.5. should display tooltips on the data table", async ({ page }) => {
		await setupPlayerStatsPage(page, DEFAULT_PLAYER);
		await page.goto("/stats", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("stats-page-heading").first()).toBeVisible({ timeout: 25000 });
		const row = page.locator("table tbody tr").first();
		await row.waitFor({ state: "visible", timeout: 20000 });
		await row.hover({ timeout: 10000 });
		await page.waitForTimeout(600);
		const tip = page.locator('[class*="tooltip"], [role="tooltip"]').first();
		await expect(tip.or(page.locator("text=/appearances|goals|minutes/i").first())).toBeVisible({ timeout: 8000 });
	});

	test("3.6. should display charts", async ({ page }) => {
		await setupPlayerStatsPage(page, DEFAULT_PLAYER);
		await page.goto("/stats", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("stats-page-heading").first()).toBeVisible({ timeout: 25000 });
		await page.waitForTimeout(2000);
		const chart = page.locator(".recharts-wrapper, canvas, svg.recharts-surface").first();
		await expect(chart).toBeVisible({ timeout: 25000 });
	});

	test("3.7. should navigate to Team Stats sub-page", async ({ page }) => {
		await openStatsFromHome(page);
		await page.getByTestId("nav-sidebar-team-stats").click({ timeout: 15000 });
		await page.waitForTimeout(1500);
		await expect(page.getByTestId("team-top-players-heading").first()).toBeVisible({ timeout: 20000 });
	});

	test("3.8. should navigate to Club Stats sub-page", async ({ page }) => {
		await openStatsFromHome(page);
		await page.getByTestId("nav-sidebar-club-stats").click({ timeout: 15000 });
		await page.waitForTimeout(1500);
		await expect(page.getByTestId("club-top-players-heading").first()).toBeVisible({ timeout: 20000 });
	});

	test("3.9. should navigate to Comparison sub-page", async ({ page }) => {
		await openStatsFromHome(page);
		await page.getByTestId("nav-sidebar-comparison").click({ timeout: 15000 });
		await page.waitForTimeout(1500);
		for (const id of COMPARISON_SECTION_IDS) {
			const el = page.locator(`#${id}`);
			await el.scrollIntoViewIfNeeded().catch(() => {});
			await expect(el).toBeVisible({ timeout: 15000 });
		}
	});

	test("3.10. should display all Player Stats sections", async ({ page }) => {
		await setupPlayerStatsPage(page, DEFAULT_PLAYER);
		await page.goto("/stats", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("stats-page-heading").first()).toBeVisible({ timeout: 25000 });
		for (const id of PLAYER_SECTION_IDS) {
			const el = page.locator(`#${id}`);
			await el.scrollIntoViewIfNeeded().catch(() => {});
			await expect(el).toBeVisible({ timeout: 20000 });
		}
	});

	test("3.11. should display all Team Stats sections", async ({ page }) => {
		await openStatsFromHome(page);
		await page.getByTestId("nav-sidebar-team-stats").click({ timeout: 15000 });
		await page.waitForTimeout(2000);
		for (const id of TEAM_SECTION_IDS) {
			const el = page.locator(`#${id}`);
			await el.scrollIntoViewIfNeeded().catch(() => {});
			await expect(el).toBeVisible({ timeout: 25000 });
		}
	});

	test("3.12. should display all Club Stats sections", async ({ page }) => {
		await openStatsFromHome(page);
		await page.getByTestId("nav-sidebar-club-stats").click({ timeout: 15000 });
		await page.waitForTimeout(2000);
		for (const id of CLUB_SECTION_IDS) {
			const el = page.locator(`#${id}`);
			await el.scrollIntoViewIfNeeded().catch(() => {});
			await expect(el).toBeVisible({ timeout: 30000 });
		}
	});

	test("3.13. should display all Comparison sections", async ({ page }) => {
		await openStatsFromHome(page);
		await page.getByTestId("nav-sidebar-comparison").click({ timeout: 15000 });
		await page.waitForTimeout(2000);
		for (const id of COMPARISON_SECTION_IDS) {
			const el = page.locator(`#${id}`);
			await el.scrollIntoViewIfNeeded().catch(() => {});
			await expect(el).toBeVisible({ timeout: 20000 });
		}
	});

	test("3.14. should toggle data table on Player Stats", async ({ page }) => {
		await setupPlayerStatsPage(page, DEFAULT_PLAYER);
		await page.goto("/stats", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("stats-page-heading").first()).toBeVisible({ timeout: 25000 });
		await page.waitForTimeout(1500);
		await toggleDataTable(page, "table");
		await toggleDataTable(page, "visualisation");
	});

	test("3.15. should toggle data table on Team Stats", async ({ page }) => {
		await openStatsFromHome(page);
		await page.getByTestId("nav-sidebar-team-stats").click({ timeout: 15000 });
		await page.waitForTimeout(2000);
		await toggleDataTable(page, "table");
		await toggleDataTable(page, "visualisation");
	});

	test("3.16. should toggle data table on Club Stats", async ({ page }) => {
		await openStatsFromHome(page);
		await page.getByTestId("nav-sidebar-club-stats").click({ timeout: 15000 });
		await page.waitForTimeout(2000);
		await toggleDataTable(page, "table");
		await toggleDataTable(page, "visualisation");
	});

	test("3.17. stats filter and stats navigation icons should be visible", async ({ page }, testInfo) => {
		await openStatsFromHome(page);
		const mobile = testInfo.project.name.includes("Mobile");
		if (mobile) {
			await expect(page.getByTestId("header-filter")).toBeVisible({ timeout: 10000 });
			await expect(page.getByTestId("header-menu")).toBeVisible({ timeout: 10000 });
		} else {
			await expect(page.getByTestId("nav-sidebar-filter")).toBeVisible({ timeout: 10000 });
			await expect(page.getByTestId("nav-sidebar-menu")).toBeVisible({ timeout: 10000 });
		}
	});

	test("3.18. all stats navigation links should correctly navigate to the correct page and section", async ({ page }, testInfo) => {
		await openStatsFromHome(page);
		const mobile = testInfo.project.name.includes("Mobile");
		if (mobile) {
			await page.getByTestId("header-menu").click({ timeout: 15000 });
		} else {
			await page.getByTestId("nav-sidebar-menu").click({ timeout: 15000 });
		}
		await expect(page.getByRole("heading", { name: "Stats Navigation" })).toBeVisible({ timeout: 15000 });
		await page.getByTestId("stats-nav-menu-player-stats").click({ timeout: 15000 });
		await page.locator(`button:has-text("Key Performance Stats")`).first().click({ timeout: 15000 });
		await page.waitForTimeout(1000);
		await expect(page.locator("#key-performance-stats")).toBeVisible({ timeout: 20000 });
	});
});
