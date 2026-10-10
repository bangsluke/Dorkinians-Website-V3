import * as fs from "fs";
import * as path from "path";
import type { CDPSession, Page, Request } from "@playwright/test";

export type ScenarioStatus = "ok" | "failed";

export type ApiTiming = {
	url: string;
	durationMs: number;
};

export type ScenarioResult = {
	id: string;
	status: ScenarioStatus;
	error?: string;
	startedAt: string;
	finishedAt: string;
	durationMs: number;
	clickToUsefulMs?: number | null;
	navigation?: {
		ttfbMs: number | null;
		domContentLoadedMs: number | null;
		loadEventMs: number | null;
		fcpMs: number | null;
		lcpMs: number | null;
	};
	api: {
		count: number;
		uniquePaths: number;
		duplicates: string[];
		slowest: ApiTiming[];
	};
	umamiRequests: number;
	notes?: string[];
};

export type AuditReport = {
	generatedAt: string;
	baseURL: string;
	playerSlug: string;
	playerName: string;
	projectName: string;
	umamiAnalyticsFlagExpectedOff: true;
	scenarios: ScenarioResult[];
};

const RESULTS_DIR = path.resolve(__dirname, "../../../docs/load-speed-results");

export function playerNameToProfileSlug(playerName: string): string {
	const trimmed = (playerName || "").trim();
	if (!trimmed) return "";
	return encodeURIComponent(trimmed).replace(/-/g, "%2D").replace(/%20/g, "-");
}

export async function resolvePlayerSlug(baseURL: string): Promise<{ playerName: string; playerSlug: string }> {
	const envSlug = process.env.LOAD_SPEED_PLAYER_SLUG?.trim();
	const envName = process.env.E2E_PLAYER_NAME?.trim() || process.env.LOAD_SPEED_PLAYER_NAME?.trim() || "Luke Bangs";

	if (envSlug) {
		return { playerName: envName, playerSlug: envSlug };
	}

	try {
		const res = await fetch(`${baseURL.replace(/\/$/, "")}/api/players`);
		if (res.ok) {
			const data = (await res.json()) as { players?: string[] };
			const players = Array.isArray(data.players) ? data.players : [];
			const match = players.find((p) => p === envName) || players[0];
			if (match) {
				return { playerName: match, playerSlug: playerNameToProfileSlug(match) };
			}
		}
	} catch {
		// fall through to default
	}

	return { playerName: envName, playerSlug: playerNameToProfileSlug(envName) };
}

export async function setCacheDisabled(cdp: CDPSession, disabled: boolean): Promise<void> {
	await cdp.send("Network.enable");
	await cdp.send("Network.setCacheDisabled", { cacheDisabled: disabled });
}

type RequestTracker = {
	urls: string[];
	dispose: () => void;
};

export function trackRequests(page: Page): RequestTracker {
	const urls: string[] = [];
	const onRequest = (req: Request) => {
		urls.push(req.url());
	};
	page.on("request", onRequest);
	return {
		urls,
		dispose: () => page.off("request", onRequest),
	};
}

export async function collectNavigationMetrics(page: Page): Promise<ScenarioResult["navigation"]> {
	return page.evaluate(() => {
		const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
		const paints = performance.getEntriesByType("paint");
		const fcp = paints.find((p) => p.name === "first-contentful-paint")?.startTime ?? null;

		let lcp: number | null = null;
		const lcpEntries = performance.getEntriesByType("largest-contentful-paint") as PerformanceEntry[];
		if (lcpEntries.length > 0) {
			lcp = lcpEntries[lcpEntries.length - 1]?.startTime ?? null;
		}

		return {
			ttfbMs: nav ? Math.round(nav.responseStart) : null,
			domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
			loadEventMs: nav ? Math.round(nav.loadEventEnd) : null,
			fcpMs: fcp != null ? Math.round(fcp) : null,
			lcpMs: lcp != null ? Math.round(lcp) : null,
		};
	});
}

export async function collectResourceApiSummary(page: Page): Promise<ScenarioResult["api"]> {
	return page.evaluate(() => {
		const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
		const api = resources.filter((r) => {
			try {
				return new URL(r.name).pathname.startsWith("/api/");
			} catch {
				return r.name.includes("/api/");
			}
		});

		const pathCounts = new Map<string, number>();
		const timings: { url: string; durationMs: number }[] = [];
		for (const r of api) {
			let pathname = r.name;
			try {
				pathname = new URL(r.name).pathname + new URL(r.name).search;
			} catch {
				// keep full name
			}
			pathCounts.set(pathname, (pathCounts.get(pathname) || 0) + 1);
			timings.push({ url: pathname, durationMs: Math.round(r.duration) });
		}

		const duplicates = [...pathCounts.entries()].filter(([, n]) => n > 1).map(([u]) => u);
		timings.sort((a, b) => b.durationMs - a.durationMs);

		return {
			count: api.length,
			uniquePaths: pathCounts.size,
			duplicates,
			slowest: timings.filter((t) => t.durationMs > 500).slice(0, 8),
		};
	});
}

export function countUmami(urls: string[]): number {
	return urls.filter((u) => /umami\.is/i.test(u)).length;
}

export function ensureResultsDir(): void {
	fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

export function writeAuditOutputs(report: AuditReport): { jsonPath: string; mdPath: string } {
	ensureResultsDir();
	const jsonPath = path.join(RESULTS_DIR, "agent-baseline.json");
	const mdPath = path.join(RESULTS_DIR, "AGENT_REPORT.md");
	fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
	fs.writeFileSync(mdPath, formatAgentReportMarkdown(report), "utf8");
	return { jsonPath, mdPath };
}

function formatAgentReportMarkdown(report: AuditReport): string {
	const lines: string[] = [
		"# Agent load-speed report",
		"",
		`Generated: ${report.generatedAt}`,
		"",
		`Base URL: \`${report.baseURL}\``,
		"",
		`Playwright project: \`${report.projectName}\``,
		"",
		`Player: \`${report.playerName}\` (slug \`${report.playerSlug}\`)`,
		"",
		"**Umami:** `featureFlags.umamiAnalytics` is **`false` in the repo**; layout gates the script. Production only stops loading Umami after that change is deployed. See `umamiRequests` per scenario (expect `0` post-deploy).",
		"",
		"## Scenarios",
		"",
		"| ID | Status | Duration (ms) | TTFB (ms) | FCP (ms) | LCP (ms) | `/api/*` count | Click→useful (ms) | Umami reqs |",
		"|----|--------|---------------|-----------|----------|----------|----------------|-------------------|------------|",
	];

	for (const s of report.scenarios) {
		lines.push(
			`| ${s.id} | ${s.status} | ${s.durationMs} | ${s.navigation?.ttfbMs ?? "—"} | ${s.navigation?.fcpMs ?? "—"} | ${s.navigation?.lcpMs ?? "—"} | ${s.api.count} | ${s.clickToUsefulMs ?? "—"} | ${s.umamiRequests} |`,
		);
	}

	lines.push("", "## Slow APIs (>500ms) and notes", "");

	for (const s of report.scenarios) {
		lines.push(`### ${s.id} (\`${s.status}\`)`, "");
		if (s.error) {
			lines.push(`Error: ${s.error}`, "");
		}
		if (s.api.slowest.length === 0) {
			lines.push("No `/api/*` resources over 500ms recorded in Resource Timing.", "");
		} else {
			lines.push("| API | Duration (ms) |", "|-----|---------------|");
			for (const a of s.api.slowest) {
				lines.push(`| \`${a.url}\` | ${a.durationMs} |`);
			}
			lines.push("");
		}
		if (s.api.duplicates.length > 0) {
			lines.push("Duplicates:", "");
			for (const d of s.api.duplicates.slice(0, 10)) {
				lines.push(`- \`${d}\``);
			}
			lines.push("");
		}
		if (s.notes?.length) {
			for (const n of s.notes) {
				lines.push(`- ${n}`);
			}
			lines.push("");
		}
	}

	lines.push(
		"## How to merge with manual Track A",
		"",
		"1. Fill Lighthouse medians in [LOAD_SPEED_CHECKLIST.md](../LOAD_SPEED_CHECKLIST.md) Tables B/D/E.",
		"2. Compare against this table; flag >20% gaps and re-run `npm run test:e2e:load-speed`.",
		"",
		"Raw JSON: [agent-baseline.json](./agent-baseline.json)",
		"",
	);

	return lines.join("\n");
}

export async function waitForUsefulHome(page: Page, timeoutMs: number): Promise<void> {
	await page.getByTestId("home-welcome-heading").or(page.getByTestId("player-selection-button")).first().waitFor({
		state: "visible",
		timeout: timeoutMs,
	});
}
