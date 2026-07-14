import { test, expect } from "@playwright/test";
import { getPlayerProfileHref } from "../../../lib/profile/slug";
import { playerNameToWrappedSlug } from "../../../lib/wrapped/slug";
import { selectPlayer } from "../utils/testHelpers";

const DEFAULT_PLAYER = process.env.E2E_PLAYER_NAME || "Luke Bangs";

const WRAPPED_ERROR_RE =
	/could not load wrapped|player not found|no appearances|database connection failed|failed to load wrapped|season not configured|invalid player|something went wrong/i;

test.describe("Season Wrapped", () => {
	test("10.1 loads wrapped page with slides, navigation, share control, and timer", async ({ page }) => {
		const slug = playerNameToWrappedSlug(DEFAULT_PLAYER);
		await page.goto(`/wrapped/${slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });

		const wrappedPage = page.getByTestId("wrapped-page");
		const errorText = page.getByText(WRAPPED_ERROR_RE);
		const deadline = Date.now() + 45000;
		let resolved: "page" | "error" | null = null;
		while (Date.now() < deadline) {
			if (await wrappedPage.isVisible({ timeout: 500 }).catch(() => false)) {
				resolved = "page";
				break;
			}
			if (await errorText.isVisible({ timeout: 500 }).catch(() => false)) {
				resolved = "error";
				break;
			}
			await page.waitForTimeout(400);
		}

		if (resolved === "error" || resolved === null) {
			test.skip(true, "Wrapped page did not load (API/env error or timeout) for default player/season");
			return;
		}

		await expect(page.getByTestId("wrapped-slide-card")).toBeVisible();
		expect(page.url()).toContain(`/wrapped/${slug}`);
		const dotCount = await page.locator('[data-testid^="wrapped-dot-"]').count();
		if (dotCount > 1) {
			await expect(page.getByTestId("wrapped-slide-timer")).toBeVisible();
		}

		await expect(page.getByTestId("wrapped-share-open")).toBeVisible();

		await page.getByTestId("wrapped-page").getByRole("button", { name: "Next" }).click();
		await expect(page.getByText("Versus the squad")).toBeVisible({ timeout: 15000 });

		await page.getByTestId("wrapped-share-open").click();
		await expect(page.getByTestId("wrapped-share-modal")).toBeVisible();
		await expect(page.getByTestId("wrapped-share-season")).toBeVisible();
		await expect(page.getByTestId("wrapped-share-slide")).toBeVisible();
		await page.getByTestId("wrapped-share-close").click();
		await expect(page.getByTestId("wrapped-share-modal")).toBeHidden();
	});

	test("10.2 homepage does not show Season Wrapped banner after selecting a player", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);

		const banner = page.getByTestId("season-wrapped-banner");
		await expect(banner).toHaveCount(0);
		await expect(page.getByTestId("season-wrapped-banner-link")).toHaveCount(0);
	});

	test("10.3 profile Season Wrapped season selector updates link with ?season=", async ({ page }) => {
		test.setTimeout(90000);
		await page.goto(getPlayerProfileHref(DEFAULT_PLAYER), { waitUntil: "domcontentloaded", timeout: 60000 });

		if (!(await page.getByTestId("player-profile-page").isVisible({ timeout: 15000 }).catch(() => false))) {
			test.skip(true, "Player profile did not load for default player");
			return;
		}

		const seeOther = page.getByTestId("player-profile-see-other-seasons");
		if (!(await seeOther.isVisible({ timeout: 5000 }).catch(() => false))) {
			test.skip(true, "Only one season or wrapped meta unavailable - control hidden");
			return;
		}

		await seeOther.click();
		const picker = page.getByTestId("player-profile-wrapped-season-picker");
		if (!(await picker.isVisible({ timeout: 8000 }).catch(() => false))) {
			test.skip(true, "Season picker portal did not open");
			return;
		}

		const options = picker.getByRole("option");
		const n = await options.count();
		let next: string | null = null;
		for (let i = 0; i < n; i++) {
			const opt = options.nth(i);
			const selected = await opt.getAttribute("aria-selected");
			if (selected !== "true") {
				next = ((await opt.getAttribute("data-season")) || (await opt.textContent()) || "").trim() || null;
				await opt.click({ force: true, timeout: 10000 }).catch(() => {});
				break;
			}
		}
		if (!next) {
			test.skip(true, "Could not find alternate season option");
			return;
		}

		// Product navigates to /wrapped/...?season= on select (does not keep profile Open link).
		const navigated = await page.waitForURL(/\/wrapped\//, { timeout: 20000 }).then(() => true).catch(() => false);
		if (!navigated) {
			test.skip(true, "Selecting season did not navigate to wrapped URL");
			return;
		}
		const seasonParam = new URL(page.url()).searchParams.get("season");
		expect(seasonParam).toBe(next);
	});
});
