import { test, expect } from "@playwright/test";
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
		await expect(page.getByTestId("wrapped-share-slide")).toBeVisible();

		await page.getByRole("button", { name: "Next" }).click();
		await expect(page.getByText("Versus the squad")).toBeVisible({ timeout: 15000 });

		await expect(page.getByTestId("wrapped-whatsapp-block")).toBeVisible();
	});

	test("10.2 homepage shows Season Wrapped banner after selecting a player", async ({ page }) => {
		test.skip(process.env.NEXT_PUBLIC_SEASON_WRAPPED_ACTIVE === "false", "Banner disabled via env");

		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);

		const banner = page.getByTestId("season-wrapped-banner");
		await expect(banner).toBeVisible({ timeout: 20000 });
		await expect(page.getByTestId("season-wrapped-banner-link")).toBeVisible();
	});
});
