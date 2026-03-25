import { test, expect } from "@playwright/test";
import { navigateToMainPage } from "../utils/testHelpers";

test.describe("Club Info Page Tests", () => {
	test("5.1. club info route loads without crashing", async ({ page }) => {
		await navigateToMainPage(page, "club-info");
		await expect(page.locator("body")).toBeVisible();
	});

	test("5.2. should display Club Info page by default", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.3. clicking the 'Navigate to Pixham' should open Google Maps with the club's location", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.4. the club achievements section should display the club's achievements", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.5. clicking the 'Show squad' text below a trophy should open a modal with the squad that won the trophy", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.6. clicking 'Close' or 'X' should close the squad modal on the Club Info page", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.7. the milestones section should display the club player's milestones", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.8. changing the milestone filter should update the displayed milestones", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.9. clicking the 'League Information' link should display the League Information page", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.10. league information should be shown for all 7 Dorkinians FC teams", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.11. changing the season filter should update the displayed league information", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.12. clicking the team number in the quick jump bar should scroll to the corresponding team's league information", async ({ page }) => {
		// TODO: E2E test to be written
	});
	
	test("5.13. clicking the 'League Table Link' button should open a 'https://fulltime.thefa.com/' website in a new tab", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.14. clicking the 'Show results' button should open a modal with the results of the team in the league", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.15. clicking the 'Back to top' button should scroll to the top of the page on the League Information page", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.16. clicking the 'Club Captains' link should display the Club Captains page", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.17. all club captains should be displayed on the Club Captains page for all teams including the Club Captain", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.18. clicking a captain's name should display a modal with the captain's history", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.19. clicking 'Close' or 'X' should close the captain's history modal", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.20. changing the season filter should update the displayed club captains", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.21. clicking the 'Club Awards' link should display the Club Awards page", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.22. all club awards should be displayed on the Club Awards page for all teams including the Club Award", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.23. clicking a player's name on the Club Awards page should display a modal with the award's history", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.24. clicking 'Close' or 'X' should close the award's history modal", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.25. changing the season filter should update the displayed club awards", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.26. clicking the 'Useful Links' link should display the Useful Links page", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.27. all useful links should be displayed on the Useful Links page", async ({ page }) => {
		// TODO: E2E test to be written
	});

	test("5.28. clicking a link should open the link in a new tab", async ({ page }) => {
		// TODO: E2E test to be written
	});
});
