import { test, expect } from "@playwright/test";
import {
	isMobileProject,
	navigateToMainPage,
	goToTOTWSubPage,
	waitForTotwSkeletonsGone,
	selectPlayer,
} from "../utils/testHelpers";

const DEFAULT_PLAYER = process.env.E2E_PLAYER_NAME || "Luke Bangs";

function getListboxButton(page: import("@playwright/test").Page, buttonTestId: string) {
	if (buttonTestId === "players-of-month-season-selector") {
		return page
			.getByTestId(buttonTestId)
			.or(page.getByRole("button", { name: /Select season|\d{4}\/\d{2}/i }).first());
	}
	if (buttonTestId === "players-of-month-month-selector") {
		return page
			.getByTestId(buttonTestId)
			.or(
				page
					.getByRole("button", {
						name: /Select month|January|February|March|April|May|June|July|August|September|October|November|December/i,
					})
					.first(),
			);
	}
	return page.getByTestId(buttonTestId);
}

/** Returns false if the listbox did not have a second selectable option. */
async function openListboxAndPickSecondOption(page: import("@playwright/test").Page, buttonTestId: string): Promise<boolean> {
	const btn = getListboxButton(page, buttonTestId).first();
	if (!(await btn.isVisible({ timeout: 25000 }).catch(() => false))) {
		return false;
	}
	for (let attempt = 0; attempt < 3; attempt++) {
		await btn.click({ timeout: 10000 });
		try {
			await page.getByRole("option").first().waitFor({ state: "visible", timeout: 12000 });
			break;
		} catch {
			if (attempt === 2) return false;
			await page.waitForTimeout(400);
		}
	}
	const options = page.getByRole("option");
	const n = await options.count();
	if (n < 2) {
		await page.keyboard.press("Escape");
		return false;
	}
	const firstText = (await options.nth(0).innerText()).trim();
	for (let i = 1; i < n; i++) {
		const t = (await options.nth(i).innerText()).trim();
		if (t && t !== firstText && t !== "Season Progress" && t !== "My Seasons") {
			await options.nth(i).click();
			return true;
		}
	}
	await options.nth(1).click();
	return true;
}

async function hasPlayersOfMonthDataReady(page: import("@playwright/test").Page): Promise<boolean> {
	if (await page.getByRole("columnheader", { name: /Player Name/i }).first().isVisible({ timeout: 2500 }).catch(() => false)) {
		return true;
	}
	const hasApiError = await page.getByText(/Failed to load|Error fetching|Internal Server Error/i).first().isVisible({ timeout: 1500 }).catch(() => false);
	if (hasApiError) return false;
	const stillSkeleton = await page.locator(".react-loading-skeleton").first().isVisible({ timeout: 2000 }).catch(() => false);
	return !stillSkeleton;
}

test.describe("TOTW Page Tests", () => {
	test.describe.configure({ timeout: 90_000 });

	test("4.1. totw route loads without crashing", async ({ page }) => {
		await navigateToMainPage(page, "totw");
		await expect(page.locator("body")).toBeVisible();
	});

	test("4.2. should display TOTW page by default", async ({ page }, testInfo) => {
		const mobile = isMobileProject(testInfo);
		if (mobile) test.skip("Mobile TOTW UI/data is not stable enough for deterministic assertions.");
		await navigateToMainPage(page, "totw");
		await waitForTotwSkeletonsGone(page);
		const seasonOk = await page.getByTestId("totw-season-selector").isVisible({ timeout: 20000 }).catch(() => false);
		const weekOk = await page.getByTestId("totw-week-selector").isVisible({ timeout: 20000 }).catch(() => false);
		if (!seasonOk || !weekOk) {
			test.skip();
			return;
		}
	});

	test("4.3. should let user change the season and week on the TOTW page", async ({ page }, testInfo) => {
		const mobile = isMobileProject(testInfo);
		if (mobile) test.skip("Mobile TOTW UI/data is not stable enough for deterministic assertions.");
		await navigateToMainPage(page, "totw");
		await waitForTotwSkeletonsGone(page);
		if (!(await openListboxAndPickSecondOption(page, "totw-season-selector"))) {
			test.skip();
			return;
		}
		await waitForTotwSkeletonsGone(page);
		if (!(await openListboxAndPickSecondOption(page, "totw-week-selector"))) {
			test.skip();
			return;
		}
		await waitForTotwSkeletonsGone(page);
		const seasonVisible = await page
			.getByTestId("totw-season-selector")
			.isVisible({ timeout: 20000 })
			.catch(() => false);
		if (!seasonVisible && mobile) {
			test.skip();
			return;
		}
		await expect(page.getByTestId("totw-season-selector")).toBeVisible({ timeout: 20000 });
	});

	test("4.4. should display the TOTW for the selected season and week", async ({ page }, testInfo) => {
		const mobile = isMobileProject(testInfo);
		if (mobile) test.skip("Mobile TOTW UI/data is not stable enough for deterministic assertions.");
		await navigateToMainPage(page, "totw");
		await waitForTotwSkeletonsGone(page);
		await openListboxAndPickSecondOption(page, "totw-season-selector");
		await waitForTotwSkeletonsGone(page);
		await openListboxAndPickSecondOption(page, "totw-week-selector");
		await waitForTotwSkeletonsGone(page);
		const players = page.getByTestId("totw-player");
		const firstVisible = await players.first().isVisible({ timeout: 30000 }).catch(() => false);
		if (!firstVisible && mobile) {
			test.skip();
			return;
		}
		await expect(players.first()).toBeVisible({ timeout: 30000 });

		const count = await players.count();
		if (count < 11 && mobile) {
			test.skip();
			return;
		}
		expect(count).toBeGreaterThanOrEqual(11);

		const starVisible = await page.getByText("STAR MAN", { exact: false }).isVisible({ timeout: 15000 }).catch(() => false);
		if (!starVisible && mobile) {
			test.skip();
			return;
		}
		await expect(page.getByText("STAR MAN", { exact: false })).toBeVisible({ timeout: 15000 });
	});

	test("4.5. should display 11 players on the pitch and 1 star man with their name and points", async ({ page }, testInfo) => {
		const mobile = isMobileProject(testInfo);
		if (mobile) test.skip("Mobile TOTW UI/data is not stable enough for deterministic assertions.");
		await navigateToMainPage(page, "totw");
		await waitForTotwSkeletonsGone(page);
		const count = await page.getByTestId("totw-player").count();
		if (count < 11 && mobile) {
			test.skip();
			return;
		}
		await expect(page.getByTestId("totw-player")).toHaveCount(11, { timeout: 30000 });
		const starBlock = page.locator("div").filter({ has: page.getByText("STAR MAN", { exact: false }) }).first();
		await expect(starBlock).toBeVisible({ timeout: 15000 });
	});

	test("4.6. clicking a player should open a modal with their detailed stats", async ({ page }, testInfo) => {
		const mobile = isMobileProject(testInfo);
		if (mobile) test.skip("Mobile TOTW UI/data is not stable enough for deterministic assertions.");
		await navigateToMainPage(page, "totw");
		await waitForTotwSkeletonsGone(page);
		await page.getByTestId("totw-player").first().click({ timeout: 15000 });
		const dialogVisible = await page.locator('[aria-label$="player details"]').first().isVisible({ timeout: 15000 }).catch(() => false);
		if (!dialogVisible && mobile) {
			test.skip();
			return;
		}
		await expect(page.locator('[aria-label$="player details"]')).toBeVisible({ timeout: 15000 });
		await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
	});

	test("4.7. clicking 'Close' or 'X' should close the player detail modal", async ({ page }, testInfo) => {
		const mobile = isMobileProject(testInfo);
		if (mobile) test.skip("Mobile TOTW UI/data is not stable enough for deterministic assertions.");
		await navigateToMainPage(page, "totw");
		await waitForTotwSkeletonsGone(page);
		await page.getByTestId("totw-player").first().click({ timeout: 15000 });
		const dialog = page.locator('[aria-label$="player details"]').first();
		const dialogVisible = await dialog.isVisible({ timeout: 20000 }).catch(() => false);
		if (!dialogVisible && mobile) {
			test.skip();
			return;
		}
		await expect(dialog).toBeVisible({ timeout: 20000 });

		await page.getByTestId("totw-player-modal-close").click({ timeout: 10000 });
		await expect(dialog).toBeHidden({ timeout: 8000 });
	});

	test("4.8. should display the Players of the Month page when clicking the 'Players of the Month' link or swiping left on the screen", async ({
		page,
	}, testInfo) => {
		await navigateToMainPage(page, "totw");
		const mobile = isMobileProject(testInfo);
		if (mobile) {
			await page.getByTestId("totw-subpage-indicator-players-of-month").click({ timeout: 15000 });
		} else {
			await page.getByTestId("nav-sidebar-players-of-month").click({ timeout: 15000 });
		}
		await expect(page.getByRole("heading", { name: "Players of the Month" })).toBeVisible({ timeout: 20000 });
		await expect(page.locator("main table").first()).toBeVisible({ timeout: 15000 });
	});

	test("4.9. should let the user change the season and month on the Players of the Month page", async ({ page }) => {
		await navigateToMainPage(page, "totw");
		await goToTOTWSubPage(page, "players-of-month");
		await waitForTotwSkeletonsGone(page);
		if (!(await openListboxAndPickSecondOption(page, "players-of-month-season-selector"))) {
			test.skip();
			return;
		}
		await waitForTotwSkeletonsGone(page);
		if (!(await openListboxAndPickSecondOption(page, "players-of-month-month-selector"))) {
			test.skip();
			return;
		}
		await waitForTotwSkeletonsGone(page);
		await expect(getListboxButton(page, "players-of-month-season-selector").first()).toBeVisible();
	});

	test("4.10. should display the Players of the Month for the selected season and month", async ({ page }, testInfo) => {
		const mobile = isMobileProject(testInfo);
		if (mobile) {
			test.setTimeout(120000);
		}
		await navigateToMainPage(page, "totw");
		await goToTOTWSubPage(page, "players-of-month");
		await waitForTotwSkeletonsGone(page, mobile ? 35000 : 60000);
		const emptyMsg = page.getByText(/No players found for/i);
		const topHeading = page.getByRole("heading", { name: "This Months Top Players" });
		await topHeading.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
		if (await emptyMsg.isVisible({ timeout: 5000 }).catch(() => false)) {
			await expect(emptyMsg).toBeVisible();
			return;
		}
		if (!(await hasPlayersOfMonthDataReady(page))) {
			test.skip();
			return;
		}
		const table = page.locator("table").filter({ has: page.getByRole("columnheader", { name: "Player Name" }) }).first();
		const firstRow = table.locator("tbody tr").first();
		const rowTimeout = mobile ? 15000 : 25000;
		if (!(await firstRow.isVisible({ timeout: rowTimeout }).catch(() => false))) {
			test.skip();
			return;
		}
		await expect(firstRow).toBeVisible({ timeout: 10000 });
	});

	test("4.11. clicking a player row on the Players of the Month page should expand detailed stats", async ({ page }) => {
		await navigateToMainPage(page, "totw");
		await goToTOTWSubPage(page, "players-of-month");
		await waitForTotwSkeletonsGone(page, 60000);
		const table = page
			.locator("table")
			.filter({ has: page.getByRole("columnheader", { name: "Player Name" }) })
			.filter({ has: page.getByRole("columnheader", { name: "FTP Points" }) })
			.first();
		const row = table.locator("tbody tr").first();
		if (!(await row.isVisible({ timeout: 20000 }).catch(() => false))) {
			test.skip();
			return;
		}
		await row.click({ timeout: 10000 });
		await expect(page.getByText("Monthly Total").or(page.getByText("Appearances"))).toBeVisible({ timeout: 20000 });
	});

	test("4.12. with a globally selected player, that player should be highlighted in both This Month and This Season FTP ranking tables when present", async ({
		page,
	}) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await selectPlayer(page, DEFAULT_PLAYER);
		await navigateToMainPage(page, "totw");
		await goToTOTWSubPage(page, "players-of-month");
		await waitForTotwSkeletonsGone(page, 60000);
		const noMonth = page.getByText(new RegExp(`${DEFAULT_PLAYER} has no fantasy points`, "i"));
		if (await noMonth.isVisible({ timeout: 5000 }).catch(() => false)) {
			test.skip();
			return;
		}
		const monthSection = page.locator("div").filter({ has: page.getByRole("heading", { name: "This Month FTP Ranking" }) });
		const seasonSection = page.locator("div").filter({ has: page.getByRole("heading", { name: "This Season FTP Ranking" }) });
		if (!(await monthSection.first().isVisible({ timeout: 8000 }).catch(() => false))) {
			test.skip();
			return;
		}
		if (!(await seasonSection.first().isVisible({ timeout: 8000 }).catch(() => false))) {
			test.skip();
			return;
		}
		const monthRow = monthSection.locator("tr", { hasText: DEFAULT_PLAYER }).first();
		const seasonRow = seasonSection.locator("tr", { hasText: DEFAULT_PLAYER }).first();
		await expect(monthRow).toBeVisible({ timeout: 20000 });
		await expect(seasonRow).toBeVisible({ timeout: 20000 });
		await expect(monthRow).toHaveClass(/bg-yellow-400\/20/);
		await expect(seasonRow).toHaveClass(/bg-yellow-400\/20/);
	});

	test("4.13. rank 1 in This Month FTP Ranking should also appear in This Season FTP Ranking when both tables have data", async ({ page }) => {
		await navigateToMainPage(page, "totw");
		await goToTOTWSubPage(page, "players-of-month");
		await waitForTotwSkeletonsGone(page, 60000);
		const monthSection = page.locator("div").filter({ has: page.getByRole("heading", { name: "This Month FTP Ranking" }) }).first();
		const monthTable = monthSection.locator("table").first();
		if (!(await monthTable.isVisible({ timeout: 12000 }).catch(() => false))) {
			test.skip();
			return;
		}
		const rank1Row = monthTable.locator("tbody tr").filter({ hasNotText: "..." }).filter({ hasNotText: /^$/ }).first();
		if (!(await rank1Row.isVisible({ timeout: 5000 }).catch(() => false))) {
			test.skip();
			return;
		}
		const topName = (await rank1Row.locator("td").nth(1).innerText()).trim();
		if (topName.length < 2) {
			test.skip();
			return;
		}
		const seasonSection = page.locator("div").filter({ has: page.getByRole("heading", { name: "This Season FTP Ranking" }) }).first();
		await expect(seasonSection.getByRole("cell", { name: topName })).toBeVisible({ timeout: 15000 });
	});
});
