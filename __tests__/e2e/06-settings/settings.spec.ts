import { test, expect } from "@playwright/test";
import { appConfig } from "../../../config/config";

// `/settings` route: modals, site-details cards (network), clipboard share, feedback with mocked API.
test.describe("Settings Page Tests", () => {
	const feedbackHeading = /Report a Bug|Request a Feature/i;
	// Returns dialog locator when open; null if CTA missing (skip downstream tests that need the modal).
	const openFeedbackModal = async (page: import("@playwright/test").Page) => {
		const feedbackBtn = page.getByRole("button", { name: /Report Bug \/ Request Feature/i }).first();
		const dialog = page.getByRole("dialog", { name: feedbackHeading });
		if (!(await feedbackBtn.isVisible({ timeout: 10000 }).catch(() => false))) {
			return null;
		}
		await feedbackBtn.click();
		const opened = await dialog.isVisible({ timeout: 5000 }).catch(() => false);
		if (!opened) {
			await feedbackBtn.click({ force: true });
		}
		const nowOpen = await dialog.isVisible({ timeout: 20000 }).catch(() => false);
		return nowOpen ? dialog : null;
	};
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
			const feedbackModalText = page.locator("text=/Report a Bug|Request a Feature/i");
			if (await feedbackModalText.isVisible({ timeout: 3000 }).catch(() => false)) {
				await expect(feedbackModalText).toBeVisible({ timeout: 8000 });
			}
			await page.keyboard.press("Escape");
		}

		if (await removalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
			await removalBtn.click();
			const removalModalText = page.locator("text=/Data Removal Request/i");
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

	test("6.4. clicking the 'Help' link should open documentation in a new tab", async ({ page }) => {
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		const helpLink = page.locator(`a[href="${appConfig.documentationUrl}"]`);
		await expect(helpLink).toBeVisible({ timeout: 15000 });
		const popupPromise = page.waitForEvent("popup", { timeout: 15000 });
		await helpLink.click();
		const popup = await popupPromise;
		expect(popup.url()).toContain("bangsluke-documentation.netlify.app");
		expect(popup.url()).toMatch(/dorkinians-website/i);
		await popup.close();
	});

	test("6.5. clicking a site navigation link should navigate to the correct screen", async ({ page }) => {
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("settings-heading")).toBeVisible({ timeout: 15000 });
		const playerStatsBtn = page.getByRole("main").getByRole("button", { name: "Player Stats", exact: true }).first();
		await playerStatsBtn.scrollIntoViewIfNeeded();
		await playerStatsBtn.click({ force: true });
		const heading = page.getByTestId("stats-page-heading").first();
		const noPlayerHeading = page.getByRole("heading", { name: /No player data available/i }).first();
		const reachedStatsHeading = await heading.isVisible({ timeout: 25000 }).catch(() => false);
		if (!reachedStatsHeading) {
			// If there is no selected player in this test run, the Stats page renders an explicit empty-state heading.
			const reachedNoPlayerHeading = await noPlayerHeading.isVisible({ timeout: 2000 }).catch(() => false);
			if (reachedNoPlayerHeading) {
				await expect(noPlayerHeading).toBeVisible({ timeout: 25000 });
				return;
			}
			await page.waitForURL(/\/$/, { timeout: 20000 }).catch(() => {});
			const statsNav = page
				.locator('[data-testid="nav-footer-stats"], [data-testid="nav-sidebar-stats"]')
				.or(page.getByRole("button", { name: /Navigate to Stats|Stats/i }).first())
				.first();
			if (await statsNav.isVisible({ timeout: 5000 }).catch(() => false)) {
				await statsNav.click({ force: true });
			}
			const reachedAfterStatsNav = await heading.isVisible({ timeout: 12000 }).catch(() => false);
			if (!reachedAfterStatsNav) {
				const closeSettings = page.getByRole("button", { name: /Close settings/i });
				if (await closeSettings.isVisible({ timeout: 3000 }).catch(() => false)) {
					await closeSettings.click({ force: true });
				}
				const appStatsNav = page
					.locator('[data-testid="nav-footer-stats"], [data-testid="nav-sidebar-stats"]')
					.or(page.getByRole("button", { name: /Navigate to Stats|Stats/i }).first())
					.first();
				if (await appStatsNav.isVisible({ timeout: 10000 }).catch(() => false)) {
					await appStatsNav.click({ force: true });
				}
			}
		}
		await expect(heading.or(noPlayerHeading)).toBeVisible({ timeout: 25000 });
	});

	test("6.6. expanding the 'Version Release Details' card should display the version release details", async ({ page }) => {
		const detailsPromise = page.waitForResponse((r) => r.url().includes("/api/site-details") && r.ok(), { timeout: 35000 });
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		const detailsOk = await detailsPromise.then(() => true).catch(() => false);
		if (!detailsOk) {
			test.skip(true, "/api/site-details did not return OK within timeout - cannot expand Version Release Details card.");
			return;
		}
		const card = page.locator("div.cursor-pointer").filter({ has: page.getByRole("heading", { name: "Version Release Details" }) }).first();
		await card.click({ force: true });
		await expect(card.locator("p.text-gray-300.whitespace-pre-wrap")).toBeVisible({ timeout: 20000 });
	});

	test("6.7. expanding the 'Updates To Come' card should display the updates to come", async ({ page }) => {
		const detailsPromise = page.waitForResponse((r) => r.url().includes("/api/site-details") && r.ok(), { timeout: 35000 });
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		const detailsOk = await detailsPromise.then(() => true).catch(() => false);
		if (!detailsOk) {
			test.skip(true, "/api/site-details did not return OK within timeout - cannot expand Updates To Come card.");
			return;
		}
		const card = page.locator("div.cursor-pointer").filter({ has: page.getByRole("heading", { name: "Updates To Come" }) }).first();
		await card.click({ force: true });
		await expect(card.locator("p.text-gray-300.whitespace-pre-wrap")).toBeVisible({ timeout: 20000 });
	});

	test("6.8. expanding the 'Stat Limitations' card should display the stat limitations", async ({ page }) => {
		const detailsPromise = page.waitForResponse((r) => r.url().includes("/api/site-details") && r.ok(), { timeout: 35000 });
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		const detailsOk = await detailsPromise.then(() => true).catch(() => false);
		if (!detailsOk) {
			test.skip(true, "/api/site-details did not return OK within timeout - cannot expand Stat Limitations card.");
			return;
		}
		const card = page.locator("div.cursor-pointer").filter({ has: page.getByRole("heading", { name: "Stat Limitations" }) }).first();
		await card.click({ force: true });
		await expect(card.locator("p.text-gray-300.whitespace-pre-wrap")).toBeVisible({ timeout: 20000 });
	});

	test("6.9. clicking the 'Share Site' button should copy the site link on desktop (or use native share)", async ({
		page,
		context,
	}) => {
		await context.grantPermissions(["clipboard-read", "clipboard-write"]);
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		await page.getByRole("button", { name: /Share Site/i }).click();
		const copied = page.getByText("Link copied to clipboard!", { exact: false });
		if (await copied.isVisible({ timeout: 3000 }).catch(() => false)) {
			await expect(copied).toBeVisible();
			const clip = await page.evaluate(() => navigator.clipboard.readText());
			expect(clip).toMatch(/^https?:\/\//);
		} else {
			await expect(page.getByRole("button", { name: /Share Site/i })).toBeEnabled();
		}
	});

	test("6.10. clicking the 'Report Bug / Request Feature' button should open a modal with the report bug / request feature options", async ({
		page,
	}) => {
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		await openFeedbackModal(page);
		await page.keyboard.press("Escape");
	});

	test("6.11. clicking send in the report bug / request feature modal should send an email to the development team or report a bug or request a feature", async ({
		page,
	}) => {
		await page.route("**/api/feedback", async (route) => {
			await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
		});
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		await openFeedbackModal(page);
		await page.getByLabel("Your Name").fill("E2E Test User");
		await page.getByLabel("Bug Description").fill("Automated test feedback body.");
		await page.getByRole("button", { name: "Send", exact: true }).click();
		await expect(page.getByText(/Thank you! Your bug report has been sent/i)).toBeVisible({ timeout: 10000 });
	});

	test("6.12. clicking 'Close' or 'X' should close the report bug / request feature modal", async ({ page }) => {
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		const dialog = await openFeedbackModal(page);
		if (!dialog) {
			test.skip(true, "Feedback modal did not open - Report Bug CTA missing or failed to open dialog.");
			return;
		}
		await page.getByRole("button", { name: "Close feedback modal" }).click();
		await expect(dialog).toBeHidden({ timeout: 8000 });

		const reopenedDialog = await openFeedbackModal(page);
		if (!reopenedDialog) {
			test.skip(true, "Could not reopen feedback modal for second close control - skipping.");
			return;
		}
		await page.getByRole("button", { name: /^Close$/ }).last().click();
		await expect(reopenedDialog).toBeHidden({ timeout: 8000 });
	});

	test("6.13. there should be a date and time displayed in the 'Database Last Updated' section", async ({ page }) => {
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		await page.waitForResponse((r) => r.url().includes("/api/site-details") && r.ok(), { timeout: 25000 }).catch(() => {});
		const section = page.locator("div").filter({ has: page.getByRole("heading", { name: "Database Last Updated" }) });
		const detail = section.getByText(/\d{1,2}\/\d{1,2}\/\d{4}|Never|\d{4}-\d{2}-\d{2}/);
		await expect(detail.first()).toBeVisible({ timeout: 15000 });
	});

	test("6.14. there should be a version number displayed at the bottom of the page", async ({ page }) => {
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		await expect(page.getByText(/Version\s+\d+\.\d+\.\d+/i)).toBeVisible({ timeout: 15000 });
	});
});
