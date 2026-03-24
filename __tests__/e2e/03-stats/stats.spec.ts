import { test, expect } from "@playwright/test";

test.describe("Stats smoke", () => {
	test("stats route loads without crash", async ({ page }) => {
		await page.goto("/stats", { waitUntil: "domcontentloaded" });
		await expect(page).toHaveURL(/\/stats/);
		await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
	});
});
