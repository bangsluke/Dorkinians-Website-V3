import { test, expect } from "@playwright/test";
import { isMobileProject, selectPlayer, submitChatbotQuery, waitForChatbot } from "../utils/testHelpers";

const DEFAULT_PLAYER = process.env.E2E_PLAYER_NAME || "Luke Bangs";

// Home: hero + player Listbox, then chatbot panel below once a player is chosen. selectPlayer may use localStorage fallback on flaky mobile dropdowns.
test.describe("Home Page Tests", () => {
	test("2.1. should display home page with player selection", async ({ page }) => {
		await page.goto("/");
		// Welcome strip at top of the landing column.
		await expect(page.getByTestId("home-welcome-heading")).toBeVisible({ timeout: 15000 });
		// Primary CTA is either the Headless UI listbox trigger (test id) or an accessible “Choose a player” button variant.
		await expect(page.getByTestId("player-selection-button").or(page.getByRole("button", { name: /Choose a player/i }))).toBeVisible({
			timeout: 15000,
		});
	});

	test("2.2. should allow player selection", async ({ page }) => {
		await page.goto("/");
		// Opens dropdown, types name, picks option (or falls back to direct localStorage + reload on stubborn mobile).
		await selectPlayer(page, DEFAULT_PLAYER);
		// After selection the UI swaps to “edit player” affordance beside the chatbot header area.
		await expect(page.getByTestId("home-edit-player-button")).toBeVisible({ timeout: 20000 });
	});

	test("2.3. should display chatbot interface after player selection", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		// Waits until edit control exists, then for the chat composer input (shorter timeout on mobile in helper).
		await waitForChatbot(page);
		await expect(page.getByTestId("chatbot-input")).toBeVisible({ timeout: 15000 });
	});

	test("2.4. should submit chatbot query and receive response", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await waitForChatbot(page);
		// Fills input and clicks send; helper waits for answer container with a long ceiling for Neo4j-backed queries.
		await submitChatbotQuery(page, `How many goals has ${DEFAULT_PLAYER} scored?`);
		// Visible answer bubble / region under the composer (same timeout as helper’s expect).
		await expect(page.getByTestId("chatbot-answer")).toBeVisible({ timeout: 120000 });
	});

	test("2.5. should display example questions when a player is selected", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await waitForChatbot(page);
		// Chip row of suggested prompts appears under the input to guide first-time users.
		await expect(page.getByTestId("chatbot-example-question-0")).toBeVisible({ timeout: 20000 });
	});

	test("2.6. should allow clicking example questions", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await waitForChatbot(page);
		const ex = page.getByTestId("chatbot-example-question-0");
		// One tap should populate/send like typing manually (implementation may auto-submit).
		await ex.click({ timeout: 15000 });
		await expect(page.getByTestId("chatbot-answer")).toBeVisible({ timeout: 120000 });
	});

	test("2.7. should display recently selected players", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		// Re-open chooser: listbox shows recents above search results.
		await page.getByTestId("home-edit-player-button").click({ timeout: 10000 });
		await expect(page.getByText("Recently Selected Players")).toBeVisible({ timeout: 15000 });
		await expect(page.getByText(DEFAULT_PLAYER).first()).toBeVisible({ timeout: 10000 });
	});

	test("2.8. should open example questions modal and display specific question", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await waitForChatbot(page);
		// “Show more” expands a dialog with a scrollable library of canned questions.
		await page.getByTestId("chatbot-show-more-example-questions").click({ timeout: 15000 });
		await expect(page.getByRole("heading", { name: "Example Questions" })).toBeVisible({ timeout: 15000 });
		await expect(page.getByRole("button", { name: /Select question:/i }).first()).toBeVisible({ timeout: 10000 });
	});

	test("2.9. when an example question is clicked in the example questions modal, it should close the modal, load the question into the chatbot input and submit the question", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await waitForChatbot(page);
		await page.getByTestId("chatbot-show-more-example-questions").click({ timeout: 15000 });
		// Choosing a row should close modal and pipeline the same path as manual submit.
		await page.getByRole("button", { name: /Select question:/i }).first().click({ timeout: 15000 });
		await waitForChatbot(page);
		await expect(page.getByTestId("chatbot-answer")).toBeVisible({ timeout: 120000 });
	});

	test("2.10. stats filter and stats navigation icons should not be visible", async ({ page }, testInfo) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await waitForChatbot(page);
		const mobile = isMobileProject(testInfo);
		if (mobile) {
			// On Home, top bar must not show stats-only funnel / stats nav menu (those appear after entering Stats).
			await expect(page.getByTestId("header-filter")).toHaveCount(0);
			await expect(page.getByTestId("header-menu")).toHaveCount(0);
		} else {
			// Desktop: left rail is Home nav only — no stats sidebar filter/menu test ids mounted.
			await expect(page.getByTestId("nav-sidebar-filter")).toHaveCount(0);
			await expect(page.getByTestId("nav-sidebar-menu")).toHaveCount(0);
		}
	});
});
