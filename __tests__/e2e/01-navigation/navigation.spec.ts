import { test, expect } from "@playwright/test";

test.describe("Navigation smoke", () => {
	test("home loads and top-level navigation is present", async ({ page }) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByTestId("player-selection-button")).toBeVisible();
	});
});
