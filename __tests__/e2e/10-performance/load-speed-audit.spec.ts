import { test, expect } from "@playwright/test";
import { navigateToMainPage, selectPlayer } from "../utils/testHelpers";
import {
	type AuditReport,
	type ScenarioResult,
	collectNavigationMetrics,
	collectResourceApiSummary,
	countUmami,
	resolvePlayerSlug,
	setCacheDisabled,
	trackRequests,
	waitForUsefulHome,
	writeAuditOutputs,
} from "./loadSpeedAuditHelpers";

const SCENARIO_TIMEOUT_MS = 120_000;

test.describe.configure({ mode: "serial" });

test.describe("Load speed audit (agent track B)", () => {
	test("collect cold/warm/SPA/route metrics and write AGENT_REPORT", async ({ page, context, baseURL }, testInfo) => {
		test.setTimeout(SCENARIO_TIMEOUT_MS * 8);

		const origin = baseURL || process.env.WEBSITE_URL || "https://dorkinians-website-v3.netlify.app";
		const { playerName, playerSlug } = await resolvePlayerSlug(origin);
		const scenarios: ScenarioResult[] = [];
		const cdp = await context.newCDPSession(page);

		const runScenario = async (
			id: string,
			fn: () => Promise<Partial<Pick<ScenarioResult, "clickToUsefulMs" | "notes">> | void>,
		): Promise<void> => {
			const startedAt = new Date().toISOString();
			const t0 = Date.now();
			const tracker = trackRequests(page);
			let status: ScenarioResult["status"] = "ok";
			let error: string | undefined;
			let clickToUsefulMs: number | null | undefined;
			let notes: string[] | undefined;
			let navigation: ScenarioResult["navigation"] = {
				ttfbMs: null,
				domContentLoadedMs: null,
				loadEventMs: null,
				fcpMs: null,
				lcpMs: null,
			};
			let api: ScenarioResult["api"] = { count: 0, uniquePaths: 0, duplicates: [], slowest: [] };

			try {
				const extra = await fn();
				clickToUsefulMs = extra?.clickToUsefulMs ?? null;
				notes = extra?.notes;
				// Allow LCP / late API resources to settle
				await page.waitForTimeout(1500);
				navigation = await collectNavigationMetrics(page);
				api = await collectResourceApiSummary(page);
			} catch (e) {
				status = "failed";
				error = e instanceof Error ? e.message : String(e);
			} finally {
				tracker.dispose();
			}

			scenarios.push({
				id,
				status,
				error,
				startedAt,
				finishedAt: new Date().toISOString(),
				durationMs: Date.now() - t0,
				clickToUsefulMs,
				navigation,
				api,
				umamiRequests: countUmami(tracker.urls),
				notes,
			});
		};

		// --- cold-home ---
		await runScenario("cold-home", async () => {
			await setCacheDisabled(cdp, true);
			await page.goto("/", { waitUntil: "domcontentloaded", timeout: SCENARIO_TIMEOUT_MS });
			await waitForUsefulHome(page, 60_000);
			return { notes: ["Cache disabled via CDP Network.setCacheDisabled"] };
		});

		// --- warm-home ---
		await runScenario("warm-home", async () => {
			await setCacheDisabled(cdp, false);
			await page.reload({ waitUntil: "domcontentloaded", timeout: SCENARIO_TIMEOUT_MS });
			await waitForUsefulHome(page, 60_000);
			return { notes: ["Cache enabled; soft reload"] };
		});

		// Ensure a player for Stats useful content
		await selectPlayer(page, playerName).catch(() => {
			/* continue; spa-stats may still measure shell */
		});

		// --- spa-stats ---
		await runScenario("spa-stats", async () => {
			await setCacheDisabled(cdp, false);
			const tClick = Date.now();
			await navigateToMainPage(page, "stats");
			const useful = page.getByTestId("stats-page-heading").or(page.getByRole("heading", { name: /Player Stats|Stats/i }));
			await useful.first().waitFor({ state: "visible", timeout: 60_000 });
			return { clickToUsefulMs: Date.now() - tClick };
		});

		// --- spa-totw ---
		await runScenario("spa-totw", async () => {
			const tClick = Date.now();
			await navigateToMainPage(page, "totw");
			const useful = page.getByRole("heading", { level: 1, name: /Team of (the Week|the Season|All Time)/i });
			await useful.waitFor({ state: "visible", timeout: 60_000 });
			return { clickToUsefulMs: Date.now() - tClick };
		});

		// --- spa-club ---
		await runScenario("spa-club", async () => {
			const tClick = Date.now();
			await navigateToMainPage(page, "club-info");
			const useful = page.getByRole("heading", { name: /Club Information/i });
			await useful.waitFor({ state: "visible", timeout: 60_000 });
			return { clickToUsefulMs: Date.now() - tClick };
		});

		// --- route-profile ---
		await runScenario("route-profile", async () => {
			await setCacheDisabled(cdp, true);
			await page.goto(`/profile/${playerSlug}`, { waitUntil: "domcontentloaded", timeout: SCENARIO_TIMEOUT_MS });
			await page
				.getByRole("heading")
				.first()
				.waitFor({ state: "visible", timeout: 60_000 })
				.catch(() => page.waitForLoadState("networkidle", { timeout: 30_000 }));
			return { notes: [`Navigated to /profile/${playerSlug} with cache disabled`] };
		});

		// --- route-wrapped ---
		await runScenario("route-wrapped", async () => {
			await setCacheDisabled(cdp, true);
			await page.goto(`/wrapped/${playerSlug}`, { waitUntil: "domcontentloaded", timeout: SCENARIO_TIMEOUT_MS });
			await page.waitForTimeout(2000);
			const marks = await page.evaluate(() =>
				performance
					.getEntriesByType("mark")
					.filter((m) => m.name.startsWith("wrapped:"))
					.map((m) => ({ name: m.name, startTime: Math.round(m.startTime) })),
			);
			return {
				notes: [
					`Navigated to /wrapped/${playerSlug}`,
					marks.length ? `Marks: ${marks.map((m) => `${m.name}=${m.startTime}ms`).join(", ")}` : "No wrapped:* performance marks observed yet",
				],
			};
		});

		const report: AuditReport = {
			generatedAt: new Date().toISOString(),
			baseURL: origin,
			playerSlug,
			playerName,
			projectName: testInfo.project.name,
			umamiAnalyticsFlagExpectedOff: true,
			scenarios,
		};

		const { jsonPath, mdPath } = writeAuditOutputs(report);
		testInfo.annotations.push({ type: "load-speed-json", description: jsonPath });
		testInfo.annotations.push({ type: "load-speed-md", description: mdPath });

		// Soft assertion: audit always writes; fail the test only if every scenario failed.
		const anyOk = scenarios.some((s) => s.status === "ok");
		expect(anyOk, `All scenarios failed. See ${mdPath}`).toBe(true);
	});
});
