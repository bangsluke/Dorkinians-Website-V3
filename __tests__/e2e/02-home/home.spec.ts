import { test, expect } from "@playwright/test";
import { selectPlayer, submitChatbotQuery, waitForChatbot } from "../utils/testHelpers";

const DEFAULT_PLAYER = process.env.E2E_PLAYER_NAME || "Luke Bangs";

test.describe("Home Page Tests", () => {
	test("1. should display home page with player selection", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("home-welcome-heading")).toBeVisible({ timeout: 15000 });
		await expect(page.getByTestId("player-selection-button").or(page.getByRole("button", { name: /Choose a player/i }))).toBeVisible({
			timeout: 15000,
		});
	});

	test("2. should allow player selection", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await expect(page.getByTestId("home-edit-player-button")).toBeVisible({ timeout: 20000 });
	});

	test("3. should display chatbot interface after player selection", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await waitForChatbot(page);
		await expect(page.getByTestId("chatbot-input")).toBeVisible({ timeout: 15000 });
	});

	test("4. should submit chatbot query and receive response", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await waitForChatbot(page);
		await submitChatbotQuery(page, `How many goals has ${DEFAULT_PLAYER} scored?`);
		await expect(page.getByTestId("chatbot-answer")).toBeVisible({ timeout: 120000 });
	});

	test("5. should display example questions when a player is selected", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await waitForChatbot(page);
		await expect(page.getByTestId("chatbot-example-question-0")).toBeVisible({ timeout: 20000 });
	});

	test("6. should allow clicking example questions", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await waitForChatbot(page);
		const ex = page.getByTestId("chatbot-example-question-0");
		await ex.click({ timeout: 15000 });
		await expect(page.getByTestId("chatbot-answer")).toBeVisible({ timeout: 120000 });
	});

	test("7. should display recently selected players", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await page.getByTestId("home-edit-player-button").click({ timeout: 10000 });
		await expect(page.getByText("Recently Selected Players")).toBeVisible({ timeout: 15000 });
		await expect(page.getByText(DEFAULT_PLAYER).first()).toBeVisible({ timeout: 10000 });
	});

	test("8. should open example questions modal and display specific question", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await waitForChatbot(page);
		await page.getByTestId("chatbot-show-more-example-questions").click({ timeout: 15000 });
		await expect(page.getByRole("heading", { name: "Example Questions" })).toBeVisible({ timeout: 15000 });
		await expect(page.getByRole("button", { name: /Select question:/i }).first()).toBeVisible({ timeout: 10000 });
	});

	test("9. should close modal and load question into chatbot input when example question is clicked", async ({ page }) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await waitForChatbot(page);
		await page.getByTestId("chatbot-show-more-example-questions").click({ timeout: 15000 });
		await page.getByRole("button", { name: /Select question:/i }).first().click({ timeout: 15000 });
		const inputVal = await page.getByTestId("chatbot-input").inputValue({ timeout: 15000 });
		expect(inputVal.trim().length).toBeGreaterThan(8);
	});

	test("10. stats filter and stats navigation icons should not be visible", async ({ page }, testInfo) => {
		await page.goto("/");
		await selectPlayer(page, DEFAULT_PLAYER);
		await waitForChatbot(page);
		const mobile = testInfo.project.name.includes("Mobile");
		if (mobile) {
			await expect(page.getByTestId("header-filter")).toHaveCount(0);
			await expect(page.getByTestId("header-menu")).toHaveCount(0);
		} else {
			await expect(page.getByTestId("nav-sidebar-filter")).toHaveCount(0);
			await expect(page.getByTestId("nav-sidebar-menu")).toHaveCount(0);
		}
	});
});
