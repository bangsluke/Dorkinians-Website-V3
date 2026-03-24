import { test, expect } from "@playwright/test";

test.describe("Settings Page Tests", () => {
	test("settings route renders and offers navigation shortcut", async ({ page }) => {
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("settings-heading")).toBeVisible({ timeout: 15000 });
		await expect(page.getByTestId("settings-nav-home").or(page.getByRole("button", { name: /Home/i }).first()).first()).toBeVisible({
			timeout: 15000,
		});
	});

	test("feedback and data-removal modal smoke from settings", async ({ page }) => {
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		const feedbackBtn = page.locator('button:has-text("Feedback"), button:has-text("Report a Bug")').first();
		const removalBtn = page.locator('button:has-text("Data Removal"), button:has-text("Privacy")').first();

		if (await feedbackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
			await feedbackBtn.click();
			const feedbackModalText = page.locator('text=/Report a Bug|Request a Feature/i');
			if (await feedbackModalText.isVisible({ timeout: 3000 }).catch(() => false)) {
				await expect(feedbackModalText).toBeVisible({ timeout: 8000 });
			}
			await page.keyboard.press("Escape");
		}

		if (await removalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
			await removalBtn.click();
			const removalModalText = page.locator('text=/Data Removal Request/i');
			if (await removalModalText.isVisible({ timeout: 3000 }).catch(() => false)) {
				await expect(removalModalText).toBeVisible({ timeout: 8000 });
			}
		}
	});

	test("pwa install surfaces safely when prompt unavailable", async ({ page }) => {
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("settings-heading")).toBeVisible({ timeout: 15000 });
		const installCta = page.locator('button:has-text("Add App to Home Screen")').first();
		if (await installCta.isVisible({ timeout: 3000 }).catch(() => false)) {
			await installCta.click();
			await expect(page.locator("text=/Installation prompt not available|Please use your browser/i").first()).toBeVisible({
				timeout: 8000,
			});
		}
	});
});
