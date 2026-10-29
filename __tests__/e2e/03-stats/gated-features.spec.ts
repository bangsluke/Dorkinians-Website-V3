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

async function openStatsReady(page: Page, playerName: string = DEFAULT_PLAYER): Promise<void> {
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await page.evaluate(() => {
		// Drop stale player payload so GET /api/player-data (with live impact fill) is used.
		localStorage.removeItem("dorkinians-cached-player-data");
	});
	await setupPlayerStatsPage(page, playerName);
	for (let attempt = 0; attempt < 3; attempt++) {
		const transient404 = page.getByRole("heading", { name: /404 error/i }).first();
		if (await transient404.isVisible({ timeout: 1000 }).catch(() => false)) {
			await page.goto("/", { waitUntil: "domcontentloaded" });
			await setupPlayerStatsPage(page, playerName);
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
		`No player data for "${playerName}". Set E2E_PLAYER_NAME to a seeded player and ensure Neo4j is reachable.`,
	).toBe(false);
}

/** Visibility owns the wait. Scrolling first uses the 60s action timeout and closes the page. */
async function expectSectionVisible(page: Page, sectionId: string, timeout = 20000): Promise<void> {
	const section = page.locator(`#${sectionId}`);
	await expect(section, `Expected #${sectionId} to be visible (gated feature must render).`).toBeVisible({
		timeout,
	});
	await section.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
}

async function scrollIntoViewCapped(locator: ReturnType<Page["locator"]>): Promise<void> {
	await locator.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
}

const DB_RETRY_ATTEMPTS = 3;

function isDbConnectionFailure(status: number, json: Record<string, unknown>): boolean {
	return status === 500 && json.error === "Database connection failed";
}

async function pause(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(
	request: APIRequestContext,
	path: string,
	body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
	let last: { ok: boolean; status: number; json: Record<string, unknown> } = {
		ok: false,
		status: 0,
		json: {},
	};
	for (let attempt = 0; attempt < DB_RETRY_ATTEMPTS; attempt++) {
		const res = await request.post(path, {
			data: body,
			headers: { "Content-Type": "application/json" },
		});
		const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
		last = { ok: res.ok(), status: res.status(), json };
		if (last.ok || !isDbConnectionFailure(last.status, last.json) || attempt === DB_RETRY_ATTEMPTS - 1) {
			return last;
		}
		await pause(1000 * (attempt + 1));
	}
	return last;
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
	let lastStatus = 0;
	let lastJson: Record<string, unknown> = {};
	for (let attempt = 0; attempt < DB_RETRY_ATTEMPTS; attempt++) {
		const res = await request.get(`/api/player-data?playerName=${encodeURIComponent(playerName)}`);
		const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
		lastStatus = res.status();
		lastJson = json;
		if (!res.ok()) {
			if (isDbConnectionFailure(res.status(), json) && attempt < DB_RETRY_ATTEMPTS - 1) {
				await pause(1000 * (attempt + 1));
				continue;
			}
			expect(res.ok(), `GET /api/player-data failed (${res.status()}): ${JSON.stringify(json)}`).toBe(true);
		}
		const playerData = (json.playerData ?? json) as Record<string, unknown>;
		const delta = playerData.impactDelta;
		if (delta == null || typeof delta !== "number" || Number.isNaN(delta)) return null;
		return delta;
	}
	expect(false, `GET /api/player-data failed (${lastStatus}): ${JSON.stringify(lastJson)}`).toBe(true);
	return null;
}

/** Spread a few roster names so the probe is not only surnames at the start of the alphabet. */
function sampleNames(names: string[], count: number): string[] {
	if (names.length <= count) return names;
	const step = names.length / count;
	const picked: string[] = [];
	for (let i = 0; i < count; i++) {
		picked.push(names[Math.floor(i * step)]!);
	}
	return picked;
}

async function findPlayerWithPositiveImpact(request: APIRequestContext): Promise<string> {
	const seen: string[] = [];
	const defaultDelta = await readImpactDelta(request, DEFAULT_PLAYER);
	seen.push(`${DEFAULT_PLAYER}=${String(defaultDelta)}`);
	if (defaultDelta != null && defaultDelta > 0) return DEFAULT_PLAYER;

	let playersJson: Record<string, unknown> = {};
	let playersOk = false;
	let playersStatus = 0;
	for (let attempt = 0; attempt < DB_RETRY_ATTEMPTS; attempt++) {
		const res = await request.get("/api/players");
		playersJson = (await res.json().catch(() => ({}))) as Record<string, unknown>;
		playersOk = res.ok();
		playersStatus = res.status();
		if (playersOk || !isDbConnectionFailure(playersStatus, playersJson) || attempt === DB_RETRY_ATTEMPTS - 1) {
			break;
		}
		await pause(1000 * (attempt + 1));
	}
	expect(playersOk, `GET /api/players failed (${playersStatus}): ${JSON.stringify(playersJson)}`).toBe(true);

	const roster = Array.isArray(playersJson.players) ? playersJson.players : [];
	const names = roster
		.map((player) => {
			if (!player || typeof player !== "object") return "";
			const row = player as { playerName?: unknown; mostPlayedForTeam?: unknown };
			const name = typeof row.playerName === "string" ? row.playerName.trim() : "";
			const team = typeof row.mostPlayedForTeam === "string" ? row.mostPlayedForTeam.trim() : "";
			if (!name || !team || name === DEFAULT_PLAYER) return "";
			return name;
		})
		.filter((name) => name.length > 0);

	for (const name of sampleNames(names, 8)) {
		const delta = await readImpactDelta(request, name);
		seen.push(`${name}=${String(delta)}`);
		if (delta != null && delta > 0) return name;
	}

	expect(
		false,
		`No probed player has impactDelta > 0. Seen: ${seen.join(", ")}`,
	).toBe(true);
	return DEFAULT_PLAYER;
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
		test.setTimeout(90_000);
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
		test.setTimeout(90_000);
		const playerName = await findPlayerWithPositiveImpact(request);
		await openStatsReady(page, playerName);
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
		test.setTimeout(90_000);
		const count = await recordingCount(request, "player", DEFAULT_PLAYER);
		await openStatsReady(page);
		const section = page.locator("#player-recordings");
		if (count > 0) {
			await scrollIntoViewCapped(section);
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
		test.setTimeout(90_000);
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
		await scrollIntoViewCapped(topPlayers);
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
			await scrollIntoViewCapped(section);
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
			await scrollIntoViewCapped(section);
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
		await scrollIntoViewCapped(teamShowAll);
		await expect(teamShowAll, "Team Stats Show all must be visible when statsTopPlayersShowAll is on.").toBeVisible({
			timeout: 15000,
		});
		await teamShowAll.click();
		await expect(page.getByRole("heading", { name: /Top 25/i }).first()).toBeVisible({ timeout: 10000 });
		await page.getByRole("button", { name: /Close Top 25/i }).click();

		expect(await clickStatsSubPage(page, "club-stats"), "Could not open Club Stats.").toBe(true);
		const clubShowAll = page.locator("#club-top-players").getByRole("button", { name: /^Show all$/i });
		await scrollIntoViewCapped(clubShowAll);
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
		await scrollIntoViewCapped(section);
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
