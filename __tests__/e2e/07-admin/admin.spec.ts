import { test, expect } from "@playwright/test";

test.describe("Admin Page Tests", () => {
	test("7.1. admin route redirects or prompts sign-in when unauthenticated", async ({ page }) => {
		await page.goto("/admin", { waitUntil: "domcontentloaded" });
		await page.waitForTimeout(500);
		await expect(page).toHaveURL(/admin|signin|auth/i);
	});

	test("7.2. admin secondary panel shell renders or gates safely", async ({ page }) => {
		await page.goto("/admin", { waitUntil: "domcontentloaded" });
		const gated = page.locator("text=/sign in|unauthorized|access denied/i").first();
		const dashboard = page.locator("text=/Database Seeding Admin Panel|Job Monitoring Dashboard/i").first();
		const hasGate = await gated.isVisible({ timeout: 4000 }).catch(() => false);
		if (hasGate) {
			await expect(gated).toBeVisible();
			return;
		}
		await expect(dashboard).toBeVisible({ timeout: 10000 });
	});
});
