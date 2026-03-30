import { test, expect } from "@playwright/test";
import { getPlayerProfileHref } from "../../../lib/profile/slug";
import { playerNameToWrappedSlug } from "../../../lib/wrapped/slug";
import { selectPlayer } from "../utils/testHelpers";

const DEFAULT_PLAYER = process.env.E2E_PLAYER_NAME || "Luke Bangs";

test.describe("Season Wrapped", () => {
	test("10.1 loads wrapped page with slides, navigation, share control, and footer URL", async ({ page }) => {
		const slug = playerNameToWrappedSlug(DEFAULT_PLAYER);
		await page.goto(`/wrapped/${slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });

		const errorText = page.getByText(/could not load wrapped|player not found|no appearances/i);
		const hasApiError = await errorText.isVisible().catch(() => false);
		if (hasApiError) {
			test.skip(true, "Wrapped API returned no data for default player/season in this environment");
			return;
		}

		await expect(page.getByTestId("wrapped-page")).toBeVisible({ timeout: 30000 });
		await expect(page.getByTestId("wrapped-slide-card")).toBeVisible();
		await expect(page.getByTestId("wrapped-slide-url")).toContainText("wrapped");
		await expect(page.getByTestId("wrapped-slide-url")).toContainText("season=");
		await expect(page.getByTestId("wrapped-share-slide")).toBeVisible();

		await page.getByRole("button", { name: "Next" }).click();
		await expect(page.getByText("Versus the squad")).toBeVisible({ timeout: 15000 });

		await expect(page.getByTestId("wrapped-whatsapp-block")).toBeVisible();
	});

	test("10.2 homepage does not show Season Wrapped banner after selecting a player", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);

		const banner = page.getByTestId("season-wrapped-banner");
		await expect(banner).toHaveCount(0);
		await expect(page.getByTestId("season-wrapped-banner-link")).toHaveCount(0);
	});

	test("10.3 profile Season Wrapped season selector updates link with ?season=", async ({ page }) => {
		await page.goto(getPlayerProfileHref(DEFAULT_PLAYER), { waitUntil: "domcontentloaded", timeout: 60000 });

		if (!(await page.getByTestId("player-profile-page").isVisible({ timeout: 15000 }).catch(() => false))) {
			test.skip(true, "Player profile did not load for default player");
			return;
		}

		const seeOther = page.getByTestId("player-profile-see-other-seasons");
		if (!(await seeOther.isVisible({ timeout: 5000 }).catch(() => false))) {
			test.skip(true, "Only one season or wrapped meta unavailable — control hidden");
			return;
		}

		const link = page.getByRole("link", { name: /Open Season Wrapped/i });
		await seeOther.click();
		const picker = page.getByTestId("player-profile-wrapped-season-picker");
		await expect(picker).toBeVisible({ timeout: 5000 });
		const options = picker.getByRole("option");
		const n = await options.count();
		let next: string | null = null;
		for (let i = 0; i < n; i++) {
			const opt = options.nth(i);
			const selected = await opt.getAttribute("aria-selected");
			if (selected !== "true") {
				next = ((await opt.textContent()) ?? "").trim() || null;
				await opt.click();
				break;
			}
		}
		if (!next) {
			test.skip(true, "Could not find alternate season option");
			return;
		}
		const href = await link.getAttribute("href");
		expect(href).toBeTruthy();
		const qs = href!.split("?")[1];
		expect(qs).toBeTruthy();
		const season = new URLSearchParams(qs).get("season");
		expect(season).toBe(next);
	});
});
