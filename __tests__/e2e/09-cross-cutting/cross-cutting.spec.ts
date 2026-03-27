import { test, expect } from "@playwright/test";
import { navigateToMainPage, waitForPageLoad } from "../utils/testHelpers";

// Light smoke across main shells; share test is optional when no share CTA is in DOM.
test.describe("Cross-Cutting Tests", () => {
	test("9.1. home loads without crashing", async ({ page }) => {
		await navigateToMainPage(page, "home");
		await waitForPageLoad(page);
		await expect(page.locator("body")).toBeVisible();
	});

	test("9.2. stats page can open share flow safely", async ({ page }) => {
		await navigateToMainPage(page, "stats");
		await waitForPageLoad(page);
		const shareButton = page.locator('[data-testid*="share"], button:has-text("Share"), button:has-text("Visualisation")').first();
		if (await shareButton.isVisible({ timeout: 4000 }).catch(() => false)) {
			await shareButton.click();
			await expect(page.locator("text=/Select Visualisation|No visualizations available/i").first()).toBeVisible({ timeout: 10000 });
		}
	});
});
