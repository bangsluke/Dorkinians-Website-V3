import { test, expect } from "@playwright/test";
import { navigateToMainPage } from "../utils/testHelpers";

test.describe("TOTW Page Tests", () => {
	test("4.1. totw route loads without crashing", async ({ page }) => {
		await navigateToMainPage(page, "totw");
		await expect(page.locator("body")).toBeVisible();
	});

	test("4.2. should display TOTW page by default", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("4.3. should let user change the season and week on the TOTW page", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("4.4. should display the TOTW for the selected season and week", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("4.5. should display 11 players on the pitch and 1 star man with their name and points", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("4.6. clicking a player should open a modal with their detailed stats", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("4.7. clicking 'Close' or 'X' should close the player detail modal", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("4.8. should display the Players of the Month page when clicking the 'Players of the Month' link or swiping left on the screen", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("4.9. should let the user change the season and week on the Players of the Month page", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("4.10. should display the Players of the Month for the selected season and week", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("4.11. clicking on a player on the Players of the Month page should open a modal with their detailed stats", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("4.12. the currently selected player should appear on both the This Month and This Season rankings table as highlighted", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("4.13. the top scoring player should appear on both the This Month and This Season rankings table", async ({ page }) => {
		// TODO: E2E test to be written
	});
});
