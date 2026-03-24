import { test, expect } from "@playwright/test";
import { navigateToMainPage } from "../utils/testHelpers";

test.describe("Club Info Page Tests", () => {
	test("club info route loads without crashing", async ({ page }) => {
		await navigateToMainPage(page, "club-info");
		await expect(page.locator("body")).toBeVisible();
	});
});
