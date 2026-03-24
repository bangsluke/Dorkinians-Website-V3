import { test, expect } from "@playwright/test";
import { navigateToMainPage } from "../utils/testHelpers";

test.describe("TOTW Page Tests", () => {
	test("totw route loads without crashing", async ({ page }) => {
		await navigateToMainPage(page, "totw");
		await expect(page.locator("body")).toBeVisible();
	});
});
