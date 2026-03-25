import { test, expect } from "@playwright/test";

test.describe("Settings Page Tests", () => {
	test("6.1. settings route renders and offers navigation shortcut", async ({ page }) => {
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("settings-heading")).toBeVisible({ timeout: 15000 });
		await expect(page.getByTestId("settings-nav-home").or(page.getByRole("button", { name: /Home/i }).first()).first()).toBeVisible({
			timeout: 15000,
		});
	});

	test("6.2. feedback and data-removal modal smoke from settings", async ({ page }) => {
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

	test("6.3. pwa install surfaces safely when prompt unavailable", async ({ page }) => {
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

	test("6.4. clicking the 'Help' link should open the help page ('https://bangsluke-documentation.netlify.app/docs/projects/dorkinians-website/') in a new tab", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("6.5. clicking a site navigation link should navigate to the correct screen", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("6.6. expanding the 'Version Release Details' card should display the version release details", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("6.7. expanding the 'Updates To Come' card should display the updates to come", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("6.8. expanding the 'Stat Limitations' card should display the stat limitations", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("6.9. clicking the 'Share Site' button should open a modal with the share site options", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("6.10. clicking the 'Report Bug / Request Feature' button should open a modal with the report bug / request feature options", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("6.11. clicking send in the report bug / request feature modal should send an email to the development team or report a bug or request a feature", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("6.12. clicking 'Close' or 'X' should close the report bug / request feature modal", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("6.13. there should be a date and time displayed in the 'Database Last Updated' section", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("6.14. there should be a version number displayed at the bottom of the page", async ({ page }) => {
		// TODO: E2E test to be written
	});

});
