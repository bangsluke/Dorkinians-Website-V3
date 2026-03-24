import { test, expect } from "@playwright/test";
import { navigateToMainPage, waitForPageLoad } from "../utils/testHelpers";

test.describe("Cross-Cutting Tests", () => {
	test("home loads without crashing", async ({ page }) => {
		await navigateToMainPage(page, "home");
		await waitForPageLoad(page);
		await expect(page.locator("body")).toBeVisible();
	});

	test("stats page can open share flow safely", async ({ page }) => {
		await navigateToMainPage(page, "stats");
		await waitForPageLoad(page);
		const shareButton = page.locator('[data-testid*="share"], button:has-text("Share"), button:has-text("Visualisation")').first();
		if (await shareButton.isVisible({ timeout: 4000 }).catch(() => false)) {
			await shareButton.click();
			await expect(page.locator("text=/Select Visualisation|No visualizations available/i").first()).toBeVisible({ timeout: 10000 });
		}
	});
});
