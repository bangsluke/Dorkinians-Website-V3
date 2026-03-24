import { test, expect } from "@playwright/test";

test.describe("Home smoke", () => {
	test("home renders a welcome/player-selection state", async ({ page }) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("player-selection-button")).toBeVisible({ timeout: 10000 });
	});
});
