import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import {
	clickStatsSubPage,
	goToClubInfoSubPage,
	navigateToMainPage,
	setupPlayerStatsPage,
	toggleDataTable,
} from "../utils/testHelpers";

/**
 * Hard sign-off for the 17 production-hidden feature flags.
 * These tests fail when a gated surface is missing. Do not convert failures into skips.
 * Local / develop / Jest already enable the develop preset (all user flags on).
 */

const DEFAULT_PLAYER = process.env.E2E_PLAYER_NAME || "Luke Bangs";

const DEFAULT_FILTERS = {
	timeRange: {
		type: "allTime",
		seasons: [] as string[],
		beforeDate: "",
		afterDate: "",
		startDate: "",
		endDate: "",
	},
	teams: [] as string[],
	location: ["Home", "Away"],
	opposition: { mode: "all", searchTerm: "" },
	competition: { mode: "types", types: ["League", "Cup", "Friendly"], searchTerm: "" },
	result: ["Win", "Draw", "Loss"],
	position: ["GK", "DEF", "MID", "FWD"],
};

async function openStatsReady(page: Page): Promise<void> {
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await page.evaluate(() => {
		// Drop stale player payload so GET /api/player-data (with live impact fill) is used.
		localStorage.removeItem("dorkinians-cached-player-data");
	});
	await setupPlayerStatsPage(page, DEFAULT_PLAYER);
	for (let attempt = 0; attempt < 3; attempt++) {
		const transient404 = page.getByRole("heading", { name: /404 error/i }).first();
		if (await transient404.isVisible({ timeout: 1000 }).catch(() => false)) {
			await page.goto("/", { waitUntil: "domcontentloaded" });
			await setupPlayerStatsPage(page, DEFAULT_PLAYER);
			continue;
		}
		break;
	}
	const ready =
		(await page.getByTestId("stats-page-heading").first().isVisible({ timeout: 20000 }).catch(() => false)) ||
		(await page.getByRole("heading", { name: /No player data available/i }).first().isVisible({ timeout: 2000 }).catch(() => false));
	expect(ready, "Stats page did not become ready (heading or empty state).").toBe(true);
	const noData = await page
		.getByRole("heading", { name: /No player data available/i })
		.first()
		.isVisible({ timeout: 1500 })
		.catch(() => false);
	expect(
		noData,
		`No player data for "${DEFAULT_PLAYER}". Set E2E_PLAYER_NAME to a seeded player and ensure Neo4j is reachable.`,
	).toBe(false);
}

async function expectSectionVisible(page: Page, sectionId: string, timeout = 20000): Promise<void> {
	const section = page.locator(`#${sectionId}`);
	await section.scrollIntoViewIfNeeded().catch(() => {});
	await expect(section, `Expected #${sectionId} to be visible (gated feature must render).`).toBeVisible({
		timeout,
	});
}

async function postJson(
	request: APIRequestContext,
	path: string,
	body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
	const res = await request.post(path, {
		data: body,
		headers: { "Content-Type": "application/json" },
	});
	const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
	return { ok: res.ok(), status: res.status(), json };
}

async function recordingCount(
	request: APIRequestContext,
	kind: "player" | "team",
	name: string,
): Promise<number> {
	if (kind === "player") {
		const { ok, status, json } = await postJson(request, "/api/player-recordings", {
			playerName: name,
			filters: DEFAULT_FILTERS,
		});
		expect(ok, `POST /api/player-recordings failed (${status}): ${JSON.stringify(json)}`).toBe(true);
		const fixtures = Array.isArray(json.fixtures) ? json.fixtures : [];
		return fixtures.length;
	}
	const { ok, status, json } = await postJson(request, "/api/team-recordings", {
		teamName: name,
		filters: DEFAULT_FILTERS,
	});
	expect(ok, `POST /api/team-recordings failed (${status}): ${JSON.stringify(json)}`).toBe(true);
	const fixtures = Array.isArray(json.fixtures) ? json.fixtures : [];
	return fixtures.length;
}

async function readImpactDelta(request: APIRequestContext, playerName: string): Promise<number | null> {
	const res = await request.get(`/api/player-data?playerName=${encodeURIComponent(playerName)}`);
	const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
	expect(res.ok(), `GET /api/player-data failed (${res.status()}): ${JSON.stringify(json)}`).toBe(true);
	const playerData = (json.playerData ?? json) as Record<string, unknown>;
	const delta = playerData.impactDelta;
	if (delta == null || typeof delta !== "number" || Number.isNaN(delta)) return null;
	return delta;
}

async function selectedTeamLabel(page: Page): Promise<string> {
	const teamButton = page
		.locator("button")
		.filter({ hasText: /XI|Whole Club|1s|2s|3s|4s|5s|6s|7s|8s|team/i })
		.first();
	if (await teamButton.isVisible({ timeout: 5000 }).catch(() => false)) {
		const text = (await teamButton.innerText()).trim();
		if (text.length > 0) return text.split("\n")[0]!.trim();
	}
	return "1st XI";
}

test.describe("Gated feature sign-off (production-hidden flags)", () => {
	test("playerStatsKeyPerformance: Key Performance Stats section renders", async ({ page }) => {
		await openStatsReady(page);
		await expectSectionVisible(page, "key-performance-stats");
		await expect(page.getByRole("heading", { name: /Key Performance Stats/i }).first()).toBeVisible();
	});

	test("playerStatsForm: Form section shows summary or fallback", async ({ page }) => {
		await openStatsReady(page);
		await expectSectionVisible(page, "form-section");
		await expect(page.getByRole("heading", { name: /^Form$/i })).toBeVisible();
		const formSection = page.locator("#form-section");
		// Avoid the info tooltip (it also contains the words "current form"). Wait for the card label or empty copy.
		const formReady = formSection
			.getByText("Current form", { exact: true })
			.or(formSection.getByText("No form data available for the current filters.", { exact: true }));
		await expect(
			formReady.first(),
			"Form section must finish loading and show Current form or the No form data available fallback.",
		).toBeVisible({ timeout: 45000 });
	});

	test("playerStatsStreaks: Streaks section with season-best row", async ({ page }) => {
		await openStatsReady(page);
		await expectSectionVisible(page, "streaks-section");
		await expect(page.getByRole("heading", { name: /^Streaks$/i })).toBeVisible();
		await expect(page.locator("#streaks-section").getByText(/Season best/i).first()).toBeVisible({
			timeout: 15000,
		});
	});

	test("playerStatsStartingImpact: Starting impact for player with appearances", async ({ page }) => {
		await openStatsReady(page);
		await expectSectionVisible(page, "starting-impact");
		await expect(page.getByRole("heading", { name: /^Starting impact$/i })).toBeVisible();
		await expect(page.getByTestId("starting-impact-grid")).toBeVisible();
	});

	test("playerStatsPartnerships: Partnerships section renders", async ({ page }) => {
		await openStatsReady(page);
		await expectSectionVisible(page, "partnerships-section");
		await expect(page.getByRole("heading", { name: /^Partnerships$/i })).toBeVisible();
	});

	test("playerStatsImpact: Impact section when impactDelta > 0", async ({ page, request }) => {
		const delta = await readImpactDelta(request, DEFAULT_PLAYER);
		expect(
			delta != null && delta > 0,
			`Player "${DEFAULT_PLAYER}" has impactDelta=${String(delta)} (need > 0). Set E2E_PLAYER_NAME to a player with positive impact.`,
		).toBe(true);
		await openStatsReady(page);
		await expectSectionVisible(page, "impact-section");
		await expect(page.getByRole("heading", { name: /^Impact$/i })).toBeVisible();
	});

	test("playerStatsDataTablePer90: Per 90 table tab works", async ({ page }) => {
		await openStatsReady(page);
		await toggleDataTable(page, "table");
		const table = page.locator("table").first();
		await expect(table, "Player Stats data table must render after toggle.").toBeVisible({ timeout: 15000 });
		const per90Button = page.getByRole("button", { name: /^Per 90$/ }).first();
		await expect(per90Button, "Per 90 tab must be present when playerStatsDataTablePer90 is on.").toBeVisible({
			timeout: 10000,
		});
		await per90Button.click();
		await expect(page.getByText(/min\. 360 minutes required/i).first()).toBeVisible({ timeout: 10000 });
		await expect(page.getByRole("cell", { name: /per 90/i }).first()).toBeVisible({ timeout: 10000 });
	});

	test("playerStatsPlayerRecordings: section matches API fixture count", async ({ page, request }) => {
		const count = await recordingCount(request, "player", DEFAULT_PLAYER);
		await openStatsReady(page);
		const section = page.locator("#player-recordings");
		if (count > 0) {
			await section.scrollIntoViewIfNeeded().catch(() => {});
			await expect(
				section,
				`API returned ${count} player recording(s); #player-recordings must be visible.`,
			).toBeVisible({ timeout: 20000 });
			await expect(page.getByRole("heading", { name: /Player Recordings/i })).toBeVisible();
		} else {
			await expect(
				section,
				"API returned 0 player recordings; #player-recordings must stay hidden. Click-through of a real Veo link still needs a person when data exists.",
			).toHaveCount(0);
		}
	});

	test("teamStatsFormationsUsed: Formations Used section on Team Stats", async ({ page }) => {
		await openStatsReady(page);
		const opened = await clickStatsSubPage(page, "team-stats");
		expect(opened, "Could not open Team Stats sub-page.").toBe(true);
		const noTeam = await page
			.getByText(/No team data available/i)
			.first()
			.isVisible({ timeout: 3000 })
			.catch(() => false);
		expect(noTeam, "Team Stats has no team data for the selected player/team.").toBe(false);
		await expectSectionVisible(page, "team-formation-breakdown");
		await expect(page.getByRole("heading", { name: /Formations used/i })).toBeVisible();
	});

	test("teamStatsXiStreakCards: Team XI streak cards section", async ({ page }) => {
		await openStatsReady(page);
		const opened = await clickStatsSubPage(page, "team-stats");
		expect(opened, "Could not open Team Stats sub-page.").toBe(true);
		await expectSectionVisible(page, "team-streaks-section");
	});

	test("teamStatsStreakAndForm: streak leaders and Best current form option", async ({ page }) => {
		await openStatsReady(page);
		const opened = await clickStatsSubPage(page, "team-stats");
		expect(opened, "Could not open Team Stats sub-page.").toBe(true);
		await expectSectionVisible(page, "team-streak-leaders");
		await expect(page.getByRole("heading", { name: /Team Streaks/i })).toBeVisible();

		const topPlayers = page.locator("#team-top-players");
		await topPlayers.scrollIntoViewIfNeeded().catch(() => {});
		await expect(topPlayers).toBeVisible({ timeout: 15000 });
		const listboxButton = topPlayers.getByRole("button").first();
		await listboxButton.click();
		await expect(page.getByRole("option", { name: /Best current form/i })).toBeVisible({ timeout: 10000 });
		await page.keyboard.press("Escape");
	});

	test("teamStatsTeamRecordings: section matches API fixture count", async ({ page, request }) => {
		await openStatsReady(page);
		const opened = await clickStatsSubPage(page, "team-stats");
		expect(opened, "Could not open Team Stats sub-page.").toBe(true);
		const teamName = await selectedTeamLabel(page);
		const count = await recordingCount(request, "team", teamName);
		const section = page.locator("#team-recordings");
		if (count > 0) {
			await section.scrollIntoViewIfNeeded().catch(() => {});
			await expect(
				section,
				`API returned ${count} team recording(s) for "${teamName}"; #team-recordings must be visible.`,
			).toBeVisible({ timeout: 20000 });
		} else {
			await expect(
				section,
				`API returned 0 team recordings for "${teamName}"; #team-recordings must stay hidden.`,
			).toHaveCount(0);
		}
	});

	test("clubStatsLongestActiveStreaks: Club streak leaders", async ({ page }) => {
		await openStatsReady(page);
		const opened = await clickStatsSubPage(page, "club-stats");
		expect(opened, "Could not open Club Stats sub-page.").toBe(true);
		await expectSectionVisible(page, "club-streak-leaders");
	});

	test("clubStatsClubRecordings: section matches API fixture count", async ({ page, request }) => {
		const count = await recordingCount(request, "team", "Whole Club");
		await openStatsReady(page);
		const opened = await clickStatsSubPage(page, "club-stats");
		expect(opened, "Could not open Club Stats sub-page.").toBe(true);
		const section = page.locator("#club-recordings");
		if (count > 0) {
			await section.scrollIntoViewIfNeeded().catch(() => {});
			await expect(
				section,
				`API returned ${count} club recording(s); #club-recordings must be visible.`,
			).toBeVisible({ timeout: 20000 });
		} else {
			await expect(
				section,
				"API returned 0 club recordings; #club-recordings must stay hidden.",
			).toHaveCount(0);
		}
	});

	test("statsTopPlayersShowAll: Show all opens modal on Team and Club Stats", async ({ page }) => {
		await openStatsReady(page);

		expect(await clickStatsSubPage(page, "team-stats"), "Could not open Team Stats.").toBe(true);
		const teamShowAll = page.locator("#team-top-players").getByRole("button", { name: /^Show all$/i });
		await teamShowAll.scrollIntoViewIfNeeded().catch(() => {});
		await expect(teamShowAll, "Team Stats Show all must be visible when statsTopPlayersShowAll is on.").toBeVisible({
			timeout: 15000,
		});
		await teamShowAll.click();
		await expect(page.getByRole("heading", { name: /Top 25/i }).first()).toBeVisible({ timeout: 10000 });
		await page.getByRole("button", { name: /Close Top 25/i }).click();

		expect(await clickStatsSubPage(page, "club-stats"), "Could not open Club Stats.").toBe(true);
		const clubShowAll = page.locator("#club-top-players").getByRole("button", { name: /^Show all$/i });
		await clubShowAll.scrollIntoViewIfNeeded().catch(() => {});
		await expect(clubShowAll, "Club Stats Show all must be visible when statsTopPlayersShowAll is on.").toBeVisible({
			timeout: 15000,
		});
		await clubShowAll.click();
		await expect(page.getByRole("heading", { name: /Top 25/i }).first()).toBeVisible({ timeout: 10000 });
	});

	test("clubInfoRecords: Records heading above Milestones on Club Information", async ({ page }) => {
		await navigateToMainPage(page, "club-info");
		await goToClubInfoSubPage(page, "club-information");
		await expect(page.getByRole("heading", { name: /Club Information/i })).toBeVisible({ timeout: 20000 });
		const section = page.getByTestId("records-section");
		await expect(section, "Records section must be visible when clubInfoRecords is on.").toBeVisible({
			timeout: 20000,
		});
		await section.scrollIntoViewIfNeeded();
		await expect(page.getByRole("heading", { name: /^Records$/ })).toBeVisible();
		await expect(page.getByRole("heading", { name: /^Milestones$/i }).first()).toBeVisible();
	});

	test("leagueInfoLatestResult: Latest Result panel on League Information", async ({ page }) => {
		await navigateToMainPage(page, "club-info");
		await goToClubInfoSubPage(page, "league-information");
		await expect(page.getByRole("heading", { name: "League Information" })).toBeVisible({ timeout: 25000 });

		const seasonBtn = page.getByRole("heading", { name: "League Information" }).locator("..").getByRole("button").first();
		if (await seasonBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
			await seasonBtn.click();
			const opts = page.getByRole("option");
			if (await opts.first().isVisible({ timeout: 8000 }).catch(() => false)) {
				const n = await opts.count();
				for (let i = 0; i < n; i++) {
					const t = (await opts.nth(i).innerText()).trim();
					if (t === "Season Progress" || t === "My Seasons" || t.includes("2019-20")) continue;
					if (/\d/.test(t)) {
						await opts.nth(i).click();
						await page.waitForTimeout(1500);
						break;
					}
				}
			}
		}

		const latestPanel = page.locator("[data-testid^='latest-result-']").first();
		await expect(
			latestPanel,
			"Latest Result panel must be visible when leagueInfoLatestResult is on (pick a season with fixtures).",
		).toBeVisible({ timeout: 30000 });
		await expect(latestPanel.getByRole("heading", { name: "Latest Result" })).toBeVisible();
	});
});
