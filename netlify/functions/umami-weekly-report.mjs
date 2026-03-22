/**
 * Netlify scheduled function: weekly Umami analytics email for Dorkinians V3.
 * Schedule: Friday 00:00 UTC (`0 0 * * 5`).
 *
 * Env (Netlify):
 *   UMAMI_WEBSITE_ID, UMAMI_API_KEY
 *   UMAMI_BASE_URL (optional, default https://api.umami.is/v1)
 *   UMAMI_APP_BASE_URL (optional) — Umami web UI base for this site (email nav links), e.g. https://cloud.umami.is/analytics/eu/websites/<id>
 *   SMTP_SERVER, SMTP_PORT, SMTP_EMAIL_SECURE, SMTP_USERNAME, SMTP_PASSWORD,
 *   SMTP_FROM_EMAIL, SMTP_TO_EMAIL
 */

import nodemailer from "nodemailer";

export const config = {
	schedule: "0 0 * * 5",
};

const PAGEWEIGHT = 0.5;
const EVENTWEIGHT = 0.5;

const PRODUCT_SECTIONS = ["home", "stats", "totw", "club-info", "settings"];

const STATS_SUBSECTIONS = new Set(["player-stats", "team-stats", "club-stats", "comparison"]);
const CLUB_INFO_SUBSECTIONS = new Set([
	"club-information",
	"league-information",
	"club-captains",
	"club-awards",
	"useful-links",
]);

/** Map raw league teamKey → readable label */
const LEAGUE_TEAM_KEY_LABELS = {
	"1s": "1st XI",
	"2s": "2nd XI",
	"3s": "3rd XI",
	"4s": "4th XI",
	"5s": "5th XI",
	"6s": "6th XI",
	"7s": "7th XI",
	"8s": "8th XI",
};

/** Stats Stat Selected leaderboard blocks (prefix must match client statsLeaderKey). */
const STAT_LEADER_PREFIXES = [
	{ prefix: "player-stats/seasonal-performance/", label: "Player — Seasonal Performance" },
	{ prefix: "player-stats/team-performance/", label: "Player — Team Performance" },
	{ prefix: "player-stats/monthly-performance/", label: "Player — Monthly Performance" },
	{ prefix: "team-stats/team-top-players/", label: "Team — Top 5" },
	{ prefix: "team-stats/team-seasonal-performance/", label: "Team — Seasonal Performance" },
	{ prefix: "club-stats/club-top-players/", label: "Club — Top 5" },
	{ prefix: "club-stats/club-seasonal-performance/", label: "Club — Seasonal Performance" },
	{ prefix: "club-stats/club-stats-distribution/", label: "Club — Stats Distribution" },
];

/** Map custom event names (Umami `x`) to a product section for scoring. */
const EVENT_TO_SECTION = {
	"App Version": "global",
	"Web Vital": "global",
	"Page Viewed": null,
	"Subpage Viewed": null,
	"Settings Opened": "settings",
	"Filter Opened": "stats",
	"Stats Menu Opened": "stats",
	"Player Selected": "home",
	"Player Edit Started": "home",
	"Recent Player Selected": "home",
	"Chatbot Question Submitted": "home",
	"Chatbot Response Rendered": "home",
	"Chatbot Error": "home",
	"Example Questions Opened": "home",
	"Example Question Selected": "home",
	"Chatbot CTA Clicked": "home",
	"Stats Subpage Switched": "stats",
	"Stats Stat Selected": "stats",
	"Team Stats Team Selected": "stats",
	"Stats Section Navigated": "stats",
	"Filters Applied": "stats",
	"Filters Reset": "stats",
	"Filter Preset Applied": "stats",
	"All Games Modal Opened": "stats",
	"Data Table Toggled": "stats",
	"Stats Shared": "stats",
	"TOTW Week Changed": "totw",
	"TOTW Player Opened": "totw",
	"TOTW Player Modal Closed": "totw",
	"PlayersOfMonth Month Changed": "totw",
	"PlayersOfMonth Row Expanded": "totw",
	"ClubInfo Subpage Viewed": "club-info",
	"League Team Focused": "club-info",
	"League Results Opened": "club-info",
	"Captain History Opened": "club-info",
	"Award History Opened": "club-info",
	"Useful Link Clicked": "club-info",
	"Share Site Triggered": "settings",
	"Feedback Modal Opened": "settings",
	"Feedback Submitted": "settings",
	"Data Privacy Modal Opened": "settings",
	"Data Removal Submitted": "settings",
};

function getOpts(apiKey) {
	return { headers: { Accept: "application/json", "x-umami-api-key": apiKey } };
}

function getEventCount(events, name) {
	const row = events.find((e) => e.x === name);
	return row ? Number(row.y) || 0 : 0;
}

/** Build map value -> total from event-data/values response */
function valuesByKey(rows) {
	const m = {};
	if (!Array.isArray(rows)) return m;
	for (const r of rows) {
		const key = r.value;
		if (key == null || key === "") continue;
		const k = String(key);
		m[k] = (m[k] || 0) + (Number(r.total) || 0);
	}
	return m;
}

function stripeBg(i) {
	return i % 2 === 0 ? "#ecfdf5" : "#ffffff";
}

function trendArrows(curr, prev) {
	if (curr > prev) return '<span style="color:#15803d;font-size:14px;">&#9650;</span>';
	if (curr < prev) return '<span style="color:#b91c1c;font-size:14px;">&#9660;</span>';
	return '<span style="color:#9ca3af;">&#8212;</span>';
}

function pctChange(curr, prev) {
	if (prev === 0) return curr > 0 ? "+100%" : "0%";
	const p = ((curr - prev) / prev) * 100;
	const sign = p > 0 ? "+" : "";
	return `${sign}${p.toFixed(1)}%`;
}

function trendBadge(curr, prev) {
	const p = prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;
	let color = "#6b7280";
	let label = pctChange(curr, prev);
	if (p > 5) color = "#15803d";
	else if (p < -5) color = "#b91c1c";
	return `<span style="font-size:11px;font-weight:700;color:${color};">${label}</span>`;
}

function metricRow(label, curr, prev, i, opts = {}) {
	const border = opts.last ? "" : "border-bottom:1px solid #bbf7d0;";
	return `<tr style="background-color:${stripeBg(i)};">
		<td style="padding:9px 14px;font-family:system-ui,Arial,sans-serif;font-size:13px;color:#171717;${border}">${label}</td>
		<td style="padding:9px 14px;font-family:system-ui,Arial,sans-serif;font-size:13px;color:#171717;font-weight:700;${border}text-align:right;">${curr}</td>
		<td style="padding:9px 14px;font-family:system-ui,Arial,sans-serif;font-size:13px;color:#6b7280;${border}text-align:right;">${prev}</td>
		<td style="padding:9px 14px;${border}text-align:center;">${opts.trendHtml ?? trendBadge(curr, prev)}</td>
	</tr>`;
}

function sectionLabel(id) {
	const labels = {
		home: "Home",
		stats: "Stats",
		totw: "TOTW / Players of Month",
		"club-info": "Club Info",
		settings: "Settings & trust",
		global: "Global / technical",
	};
	return labels[id] || id;
}

function escapeHtml(s) {
	return String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * Bottom sections: disjoint from top 3 so tied scores cannot list the same section twice.
 * Pick the 3 lowest-scoring sections among those not in top3 (stable: lower score first, then PRODUCT_SECTIONS order).
 */
function disjointBottomThree(sortedByScoreDesc, scores) {
	const top3 = new Set(sortedByScoreDesc.slice(0, 3));
	const candidates = [...PRODUCT_SECTIONS].filter((id) => !top3.has(id));
	candidates.sort((a, b) => {
		const diff = scores[a] - scores[b];
		if (diff !== 0) return diff;
		return PRODUCT_SECTIONS.indexOf(a) - PRODUCT_SECTIONS.indexOf(b);
	});
	return candidates.slice(0, 3);
}

function topEntryInMap(m) {
	let bestK = null;
	let bestV = -1;
	for (const [k, v] of Object.entries(m)) {
		if (v > bestV) {
			bestV = v;
			bestK = k;
		}
	}
	return bestK != null && bestV > 0 ? { key: bestK, total: bestV } : null;
}

function subsectionGranularLine(sectionId, subpageMap) {
	if (sectionId === "stats") {
		const filtered = Object.fromEntries(
			Object.entries(subpageMap).filter(([k]) => STATS_SUBSECTIONS.has(k)),
		);
		const top = topEntryInMap(filtered);
		return top ? ` Busiest stats tab by subpage views: <strong>${escapeHtml(top.key)}</strong> (${top.total}).` : "";
	}
	if (sectionId === "club-info") {
		const filtered = Object.fromEntries(
			Object.entries(subpageMap).filter(([k]) => CLUB_INFO_SUBSECTIONS.has(k)),
		);
		const top = topEntryInMap(filtered);
		return top ? ` Busiest club-info tab: <strong>${escapeHtml(top.key)}</strong> (${top.total}).` : "";
	}
	return "";
}

function recommendBullet(sectionId, rank, currScore, prevScore, pageviews, engagement, subpageMap) {
	const wow =
		prevScore === 0
			? currScore > 0
				? "new activity this period"
				: "flat"
			: ((currScore - prevScore) / prevScore) * 100;
	let base = "";
	if (rank === "top") {
		if (wow > 15) base = "Strong week-over-week momentum—good time to deepen content or CTAs here.";
		else if (pageviews > engagement) base = "Traffic-weighted: prioritize clarity and load performance for this area.";
		else base = "Interaction-heavy: users are working in this area—protect UX and ship iterative improvements.";
	} else {
		if (wow < -20) base = "Notable drop vs last week—investigate regressions, IA, or seasonal effects.";
		else if (pageviews < 3 && engagement < 3)
			base = "Low footprint—validate discovery (nav, SEO, deep links) before retiring features.";
		else base = "Below peer sections—consider simplification, merge with higher-traffic flows, or targeted prompts.";
	}
	return base + subsectionGranularLine(sectionId, subpageMap || {});
}

function buildSectionScores(pageBySection, subpageBySection, eventsRows) {
	const engagement = {};
	for (const s of PRODUCT_SECTIONS) {
		engagement[s] = subpageBySection[s] || 0;
	}
	for (const row of eventsRows) {
		const name = row.x;
		const count = Number(row.y) || 0;
		const sec = EVENT_TO_SECTION[name];
		if (sec && PRODUCT_SECTIONS.includes(sec)) {
			engagement[sec] += count;
		}
	}

	const pageviews = {};
	for (const s of PRODUCT_SECTIONS) {
		pageviews[s] = pageBySection[s] || 0;
	}

	const maxPv = Math.max(1, ...PRODUCT_SECTIONS.map((s) => pageviews[s]));
	const maxEv = Math.max(1, ...PRODUCT_SECTIONS.map((s) => engagement[s]));

	const scores = {};
	for (const s of PRODUCT_SECTIONS) {
		const nPv = pageviews[s] / maxPv;
		const nEv = engagement[s] / maxEv;
		scores[s] = PAGEWEIGHT * nPv + EVENTWEIGHT * nEv;
	}

	return { pageviews, engagement, scores };
}

function sortSectionsByScore(scores) {
	return [...PRODUCT_SECTIONS].sort((a, b) => scores[b] - scores[a]);
}

function eventValuesUrl(base, websiteId, eventName, propertyName, q) {
	const ev = encodeURIComponent(eventName);
	const pn = encodeURIComponent(propertyName);
	return `${base}/websites/${websiteId}/event-data/values?event=${ev}&propertyName=${pn}&${q}`;
}

async function fetchEventValues(base, websiteId, apiKey, eventName, propertyName, q) {
	const url = eventValuesUrl(base, websiteId, eventName, propertyName, q);
	const res = await fetch(url, getOpts(apiKey));
	return res.ok ? await res.json() : [];
}

/** Top N rows where value starts with prefix; stat label = remainder after prefix */
function topStatsForPrefix(rows, prefix, n) {
	if (!Array.isArray(rows)) return [];
	const list = rows
		.filter((r) => r.value && String(r.value).startsWith(prefix))
		.map((r) => ({
			stat: String(r.value).slice(prefix.length) || "(unknown)",
			total: Number(r.total) || 0,
		}))
		.sort((a, b) => b.total - a.total)
		.slice(0, n);
	return list;
}

function mergeLeagueTeamMaps(a, b) {
	const m = { ...a };
	for (const [k, v] of Object.entries(b)) {
		m[k] = (m[k] || 0) + v;
	}
	return m;
}

function formatLeagueKey(key) {
	return LEAGUE_TEAM_KEY_LABELS[key] || key;
}

function formatPeriodDate(ts) {
	const d = new Date(ts);
	const weekday = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
	const day = String(d.getUTCDate()).padStart(2, "0");
	const month = d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
	const year = d.getUTCFullYear();
	return `${weekday} ${day} ${month} ${year}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Last completed UTC week: Sunday 00:00 inclusive start → next Sunday 00:00 exclusive end (7 days).
 * If the current week is still in progress, use the prior completed week.
 */
function getCompletedUtcWeekWindows(nowMs) {
	const d = new Date(nowMs);
	d.setUTCHours(0, 0, 0, 0);
	const dow = d.getUTCDay();
	const thisWeekSunday = d.getTime() - dow * DAY_MS;
	let weekStart;
	let weekEnd;
	if (nowMs >= thisWeekSunday + WEEK_MS) {
		weekStart = thisWeekSunday;
		weekEnd = thisWeekSunday + WEEK_MS;
	} else {
		weekStart = thisWeekSunday - WEEK_MS;
		weekEnd = thisWeekSunday;
	}
	const prevEndAt = weekStart;
	const prevStartAt = weekStart - WEEK_MS;
	return { startAt: weekStart, endAt: weekEnd, prevStartAt, prevEndAt };
}

function buildSecondaryTable(title, rowsHtml) {
	const wrap =
		"width:100%;border:1px solid #bbf7d0;border-radius:8px;overflow:hidden;border-collapse:collapse;";
	return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
		<tr><td style="padding:12px 0 8px;">
			<div style="font-family:system-ui,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#047857;border-bottom:2px solid #bbf7d0;padding-bottom:6px;">${title}</div>
		</td></tr>
		<tr><td style="padding:0 0 16px;">
			<table width="100%" cellpadding="0" cellspacing="0" border="0" style="${wrap}">
				<tbody>${rowsHtml}</tbody>
			</table>
		</td></tr>
	</table>`;
}

function simpleRow(cells, i, last) {
	const border = last ? "" : "border-bottom:1px solid #bbf7d0;";
	const bg = stripeBg(i);
	return `<tr style="background-color:${bg};">
		${cells
			.map(
				(c, j) =>
					`<td style="padding:8px 12px;font-family:system-ui,Arial,sans-serif;font-size:12px;color:#171717;${border}${j > 0 ? "text-align:right;" : ""}">${c}</td>`,
			)
			.join("")}
	</tr>`;
}

export default async () => {
	const websiteId = process.env.UMAMI_WEBSITE_ID;
	const apiKey = process.env.UMAMI_API_KEY;
	const base = (process.env.UMAMI_BASE_URL || "https://api.umami.is/v1").replace(/\/$/, "");
	const appBase = (process.env.UMAMI_APP_BASE_URL || `https://cloud.umami.is/analytics/eu/websites/${websiteId}`).replace(
		/\/$/,
		"",
	);

	const host = process.env.SMTP_SERVER;
	const port = parseInt(process.env.SMTP_PORT || "587", 10);
	const secure = process.env.SMTP_EMAIL_SECURE === "true";
	const user = process.env.SMTP_USERNAME;
	const pass = process.env.SMTP_PASSWORD;
	const from = process.env.SMTP_FROM_EMAIL;
	const to = process.env.SMTP_TO_EMAIL;

	if (!websiteId || !apiKey) {
		console.error("Missing UMAMI_WEBSITE_ID or UMAMI_API_KEY");
		return new Response(JSON.stringify({ error: "Missing Umami configuration" }), { status: 500 });
	}
	if (!host || !user || !pass || !from || !to) {
		console.error("Missing SMTP env vars");
		return new Response(JSON.stringify({ error: "Missing SMTP configuration" }), { status: 500 });
	}

	const { startAt, endAt, prevStartAt, prevEndAt } = getCompletedUtcWeekWindows(Date.now());
	const q = `startAt=${startAt}&endAt=${endAt}`;
	const qPrev = `startAt=${prevStartAt}&endAt=${prevEndAt}`;

	const eventPageViewed = "Page Viewed";
	const eventSubpage = "Subpage Viewed";

	try {
		const f = (ev, prop, qp) => fetchEventValues(base, websiteId, apiKey, ev, prop, qp);

		const [
			statsRes,
			statsPrevRes,
			eventsRes,
			eventsPrevRes,
			pathRes,
			pathPrevRes,
			pvCurr,
			pvPrev,
			spCurr,
			spPrev,
			spSubCurr,
			spSubPrev,
			filtersSpCurr,
			filtersSpPrev,
			filtersTrCurr,
			filtersTrPrev,
			statsSharedMethodCurr,
			statsSharedMethodPrev,
			chatbotLenCurr,
			chatbotLenPrev,
			totwModeCurr,
			totwModePrev,
			usefulCatCurr,
			usefulCatPrev,
			webVitalNameCurr,
			webVitalNamePrev,
			exQCurr,
			exQPrev,
			playerNameCurr,
			playerNamePrev,
			statsLeaderCurr,
			statsLeaderPrev,
			teamLabelCurr,
			teamLabelPrev,
			leagueFocusCurr,
			leagueFocusPrev,
			leagueResCurr,
			leagueResPrev,
		] = await Promise.all([
			fetch(`${base}/websites/${websiteId}/stats?${q}`, getOpts(apiKey)),
			fetch(`${base}/websites/${websiteId}/stats?${qPrev}`, getOpts(apiKey)),
			fetch(`${base}/websites/${websiteId}/metrics?type=event&${q}`, getOpts(apiKey)),
			fetch(`${base}/websites/${websiteId}/metrics?type=event&${qPrev}`, getOpts(apiKey)),
			fetch(`${base}/websites/${websiteId}/metrics?type=path&${q}`, getOpts(apiKey)),
			fetch(`${base}/websites/${websiteId}/metrics?type=path&${qPrev}`, getOpts(apiKey)),
			f(eventPageViewed, "section", q),
			f(eventPageViewed, "section", qPrev),
			f(eventSubpage, "section", q),
			f(eventSubpage, "section", qPrev),
			f(eventSubpage, "subSection", q),
			f(eventSubpage, "subSection", qPrev),
			f("Filters Applied", "statsSubPage", q),
			f("Filters Applied", "statsSubPage", qPrev),
			f("Filters Applied", "timeRangeType", q),
			f("Filters Applied", "timeRangeType", qPrev),
			f("Stats Shared", "method", q),
			f("Stats Shared", "method", qPrev),
			f("Chatbot Question Submitted", "questionLengthBucket", q),
			f("Chatbot Question Submitted", "questionLengthBucket", qPrev),
			f("TOTW Player Opened", "mode", q),
			f("TOTW Player Opened", "mode", qPrev),
			f("Useful Link Clicked", "linkCategory", q),
			f("Useful Link Clicked", "linkCategory", qPrev),
			f("Web Vital", "name", q),
			f("Web Vital", "name", qPrev),
			f("Example Question Selected", "questionId", q),
			f("Example Question Selected", "questionId", qPrev),
			f("Player Selected", "playerName", q),
			f("Player Selected", "playerName", qPrev),
			f("Stats Stat Selected", "statsLeaderKey", q),
			f("Stats Stat Selected", "statsLeaderKey", qPrev),
			f("Team Stats Team Selected", "teamLabel", q),
			f("Team Stats Team Selected", "teamLabel", qPrev),
			f("League Team Focused", "teamKey", q),
			f("League Team Focused", "teamKey", qPrev),
			f("League Results Opened", "teamKey", q),
			f("League Results Opened", "teamKey", qPrev),
		]);

		const stats = statsRes.ok ? await statsRes.json() : { pageviews: 0, visitors: 0, visits: 0 };
		const statsPrev = statsPrevRes.ok ? await statsPrevRes.json() : { pageviews: 0, visitors: 0, visits: 0 };
		const events = eventsRes.ok ? await eventsRes.json() : [];
		const eventsPrev = eventsPrevRes.ok ? await eventsPrevRes.json() : [];
		const paths = pathRes.ok ? await pathRes.json() : [];
		const pathsPrev = pathPrevRes.ok ? await pathPrevRes.json() : [];

		const pageBySection = valuesByKey(pvCurr);
		const pageBySectionPrev = valuesByKey(pvPrev);
		const subBySection = valuesByKey(spCurr);
		const subBySectionPrev = valuesByKey(spPrev);
		const subSectionTotals = valuesByKey(spSubCurr);
		const filtersSpMap = valuesByKey(filtersSpCurr);
		const filtersSpMapPrev = valuesByKey(filtersSpPrev);
		const filtersTrMap = valuesByKey(filtersTrCurr);
		const statsSharedMethodMap = valuesByKey(statsSharedMethodCurr);
		const statsSharedMethodMapPrev = valuesByKey(statsSharedMethodPrev);
		const chatbotLenMap = valuesByKey(chatbotLenCurr);
		const totwModeMap = valuesByKey(totwModeCurr);
		const usefulCatMap = valuesByKey(usefulCatCurr);
		const webVitalNameMap = valuesByKey(webVitalNameCurr);
		const exampleQMap = valuesByKey(exQCurr);
		const exampleQMapPrev = valuesByKey(exQPrev);
		const playerNameMap = valuesByKey(playerNameCurr);
		const playerNameMapPrev = valuesByKey(playerNamePrev);
		const leagueMerged = mergeLeagueTeamMaps(valuesByKey(leagueFocusCurr), valuesByKey(leagueResCurr));
		const leagueMergedPrev = mergeLeagueTeamMaps(valuesByKey(leagueFocusPrev), valuesByKey(leagueResPrev));

		const currModel = buildSectionScores(pageBySection, subBySection, events);
		const prevModel = buildSectionScores(pageBySectionPrev, subBySectionPrev, eventsPrev);

		const sorted = sortSectionsByScore(currModel.scores);
		const top3 = sorted.slice(0, 3);
		const bottom3 = disjointBottomThree(sorted, currModel.scores);

		const topPath = paths[0];
		const topPathPrev = pathsPrev[0];

		const chatbotQs = getEventCount(events, "Chatbot Question Submitted");
		const chatbotQsPrev = getEventCount(eventsPrev, "Chatbot Question Submitted");
		const filtersApplied = getEventCount(events, "Filters Applied");
		const filtersAppliedPrev = getEventCount(eventsPrev, "Filters Applied");

		let rowsHtml = "";
		let i = 0;
		rowsHtml += metricRow("Pageviews (site)", stats.pageviews ?? 0, statsPrev.pageviews ?? 0, i++, {
			trendHtml: trendArrows(stats.pageviews ?? 0, statsPrev.pageviews ?? 0),
		});
		rowsHtml += metricRow("Visits", stats.visits ?? 0, statsPrev.visits ?? 0, i++, {
			trendHtml: trendArrows(stats.visits ?? 0, statsPrev.visits ?? 0),
		});
		rowsHtml += metricRow("Visitors", stats.visitors ?? 0, statsPrev.visitors ?? 0, i++, {
			trendHtml: trendArrows(stats.visitors ?? 0, statsPrev.visitors ?? 0),
		});
		rowsHtml += metricRow("Chatbot questions", chatbotQs, chatbotQsPrev, i++, {
			trendHtml: trendArrows(chatbotQs, chatbotQsPrev),
		});
		rowsHtml += metricRow("Filters applied", filtersApplied, filtersAppliedPrev, i++, {
			last: true,
			trendHtml: trendArrows(filtersApplied, filtersAppliedPrev),
		});

		const topPathLabel = topPath?.x ? String(topPath.x) : "—";
		const topPathPrevLabel = topPathPrev?.x ? String(topPathPrev.x) : "—";

		const investHtml = top3
			.map((sid) => {
				const s = currModel.scores[sid];
				const sp = prevModel.scores[sid];
				const bullet = recommendBullet(
					sid,
					"top",
					s,
					sp,
					currModel.pageviews[sid],
					currModel.engagement[sid],
					subSectionTotals,
				);
				return `<li style="margin:8px 0;"><strong>${sectionLabel(sid)}</strong> (score ${s.toFixed(2)}, was ${sp.toFixed(2)}) — ${bullet}</li>`;
			})
			.join("");

		const retireHtml = bottom3
			.map((sid) => {
				const s = currModel.scores[sid];
				const sp = prevModel.scores[sid];
				const bullet = recommendBullet(
					sid,
					"bottom",
					s,
					sp,
					currModel.pageviews[sid],
					currModel.engagement[sid],
					subSectionTotals,
				);
				return `<li style="margin:8px 0;"><strong>${sectionLabel(sid)}</strong> (score ${s.toFixed(2)}, was ${sp.toFixed(2)}) — ${bullet}</li>`;
			})
			.join("");

		const periodStartLabel = formatPeriodDate(startAt);
		const periodEndLabel = formatPeriodDate(endAt);
		const subject = `Dorkinians Website - Umami Weekly Report (${periodStartLabel} to ${periodEndLabel})`;

		/* —— Secondary blocks —— */
		let statBlockHtml = "";
		for (const { prefix, label } of STAT_LEADER_PREFIXES) {
			const top = topStatsForPrefix(statsLeaderCurr, prefix, 5);
			if (top.length === 0) continue;
			let inner = "";
			top.forEach((row, idx) => {
				const prevT = topStatsForPrefix(statsLeaderPrev, prefix, 50).find((x) => x.stat === row.stat)?.total ?? 0;
				inner += simpleRow(
					[
						escapeHtml(row.stat),
						String(row.total),
						String(prevT),
						trendArrows(row.total, prevT),
					],
					idx,
					idx === top.length - 1,
				);
			});
			statBlockHtml += buildSecondaryTable(
				escapeHtml(label),
				`<tr style="background-color:#d1fae5;"><th style="text-align:left;padding:8px 12px;font-size:11px;color:#065f46;">Stat</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">This week</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">Prev</th><th style="text-align:center;padding:8px 12px;font-size:11px;color:#065f46;">Δ</th></tr>${inner}`,
			);
		}

		const topPlayers = Object.entries(playerNameMap)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);
		let playersRows = "";
		topPlayers.forEach(([name, total], idx) => {
			const prevT = playerNameMapPrev[name] || 0;
			playersRows += simpleRow(
				[escapeHtml(name), String(total), String(prevT), trendArrows(total, prevT)],
				idx,
				idx === topPlayers.length - 1,
			);
		});
		const topPlayersBlock =
			topPlayers.length > 0
				? buildSecondaryTable(
						"Top 10 — Player Selected (playerName)",
						`<tr style="background-color:#d1fae5;"><th style="text-align:left;padding:8px 12px;font-size:11px;color:#065f46;">Player</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">This week</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">Prev</th><th style="text-align:center;padding:8px 12px;font-size:11px;color:#065f46;">Δ</th></tr>${playersRows}`,
					)
				: "";

		const teamLabelMap = valuesByKey(teamLabelCurr);
		const teamLabelMapPrevLocal = valuesByKey(teamLabelPrev);
		const teamXiTop = Object.entries(teamLabelMap)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8);
		let teamRows = "";
		teamXiTop.forEach(([name, total], idx) => {
			const prevT = teamLabelMapPrevLocal[name] || 0;
			teamRows += simpleRow(
				[escapeHtml(name), String(total), String(prevT), trendArrows(total, prevT)],
				idx,
				idx === teamXiTop.length - 1,
			);
		});
		const teamXiBlock =
			teamXiTop.length > 0
				? buildSecondaryTable(
						"Team Stats — XI / team dropdown (teamLabel)",
						`<tr style="background-color:#d1fae5;"><th style="text-align:left;padding:8px 12px;font-size:11px;color:#065f46;">Team</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">This week</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">Prev</th><th style="text-align:center;padding:8px 12px;font-size:11px;color:#065f46;">Δ</th></tr>${teamRows}`,
					)
				: "";

		const leagueTop = Object.entries(leagueMerged)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8);
		let leagueRows = "";
		leagueTop.forEach(([key, total], idx) => {
			const prevT = leagueMergedPrev[key] || 0;
			const label = formatLeagueKey(key);
			leagueRows += simpleRow(
				[escapeHtml(label), String(total), String(prevT), trendArrows(total, prevT)],
				idx,
				idx === leagueTop.length - 1,
			);
		});
		const leagueBlock =
			leagueTop.length > 0
				? buildSecondaryTable(
						"League — team focus + results (merged teamKey)",
						`<tr style="background-color:#d1fae5;"><th style="text-align:left;padding:8px 12px;font-size:11px;color:#065f46;">Team</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">This week</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">Prev</th><th style="text-align:center;padding:8px 12px;font-size:11px;color:#065f46;">Δ</th></tr>${leagueRows}`,
					)
				: "";

		function mapToRows(map, mapPrev, n) {
			const entries = Object.entries(map)
				.sort((a, b) => b[1] - a[1])
				.slice(0, n);
			let r = "";
			entries.forEach(([k, total], idx) => {
				const prevT = mapPrev[k] || 0;
				r += simpleRow(
					[escapeHtml(k), String(total), String(prevT), trendArrows(total, prevT)],
					idx,
					idx === entries.length - 1,
				);
			});
			return { entries, html: r };
		}

		const filtersSp = mapToRows(filtersSpMap, filtersSpMapPrev, 6);
		const filtersSpBlock =
			filtersSp.entries.length > 0
				? buildSecondaryTable(
						"Filters Applied — statsSubPage",
						`<tr style="background-color:#d1fae5;"><th style="text-align:left;padding:8px 12px;font-size:11px;color:#065f46;">Page</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">This week</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">Prev</th><th style="text-align:center;padding:8px 12px;font-size:11px;color:#065f46;">Δ</th></tr>${filtersSp.html}`,
					)
				: "";

		const filtersTr = mapToRows(filtersTrMap, valuesByKey(filtersTrPrev), 8);
		const filtersTrBlock =
			filtersTr.entries.length > 0
				? buildSecondaryTable(
						"Filters Applied — timeRangeType",
						`<tr style="background-color:#d1fae5;"><th style="text-align:left;padding:8px 12px;font-size:11px;color:#065f46;">Range</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">This week</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">Prev</th><th style="text-align:center;padding:8px 12px;font-size:11px;color:#065f46;">Δ</th></tr>${filtersTr.html}`,
					)
				: "";

		const shareM = mapToRows(statsSharedMethodMap, statsSharedMethodMapPrev, 6);
		const shareBlock =
			shareM.entries.length > 0
				? buildSecondaryTable(
						"Stats Shared — method",
						`<tr style="background-color:#d1fae5;"><th style="text-align:left;padding:8px 12px;font-size:11px;color:#065f46;">Method</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">This week</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">Prev</th><th style="text-align:center;padding:8px 12px;font-size:11px;color:#065f46;">Δ</th></tr>${shareM.html}`,
					)
				: "";

		const chatM = mapToRows(chatbotLenMap, valuesByKey(chatbotLenPrev), 8);
		const chatBlock =
			chatM.entries.length > 0
				? buildSecondaryTable(
						"Chatbot questions — questionLengthBucket",
						`<tr style="background-color:#d1fae5;"><th style="text-align:left;padding:8px 12px;font-size:11px;color:#065f46;">Bucket</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">This week</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">Prev</th><th style="text-align:center;padding:8px 12px;font-size:11px;color:#065f46;">Δ</th></tr>${chatM.html}`,
					)
				: "";

		const totwM = mapToRows(totwModeMap, valuesByKey(totwModePrev), 6);
		const totwBlock =
			totwM.entries.length > 0
				? buildSecondaryTable(
						"TOTW Player Opened — mode",
						`<tr style="background-color:#d1fae5;"><th style="text-align:left;padding:8px 12px;font-size:11px;color:#065f46;">Mode</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">This week</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">Prev</th><th style="text-align:center;padding:8px 12px;font-size:11px;color:#065f46;">Δ</th></tr>${totwM.html}`,
					)
				: "";

		const usefulM = mapToRows(usefulCatMap, valuesByKey(usefulCatPrev), 8);
		const usefulBlock =
			usefulM.entries.length > 0
				? buildSecondaryTable(
						"Useful links — linkCategory",
						`<tr style="background-color:#d1fae5;"><th style="text-align:left;padding:8px 12px;font-size:11px;color:#065f46;">Category</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">This week</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">Prev</th><th style="text-align:center;padding:8px 12px;font-size:11px;color:#065f46;">Δ</th></tr>${usefulM.html}`,
					)
				: "";

		const webM = mapToRows(webVitalNameMap, valuesByKey(webVitalNamePrev), 8);
		const webBlock =
			webM.entries.length > 0
				? buildSecondaryTable(
						"Web Vitals — metric name (sample counts)",
						`<tr style="background-color:#d1fae5;"><th style="text-align:left;padding:8px 12px;font-size:11px;color:#065f46;">Metric</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">This week</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">Prev</th><th style="text-align:center;padding:8px 12px;font-size:11px;color:#065f46;">Δ</th></tr>${webM.html}`,
					)
				: "";

		const exM = mapToRows(exampleQMap, exampleQMapPrev, 10);
		const exBlock =
			exM.entries.length > 0
				? buildSecondaryTable(
						"Example questions — questionId",
						`<tr style="background-color:#d1fae5;"><th style="text-align:left;padding:8px 12px;font-size:11px;color:#065f46;">questionId</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">This week</th><th style="text-align:right;padding:8px 12px;font-size:11px;color:#065f46;">Prev</th><th style="text-align:center;padding:8px 12px;font-size:11px;color:#065f46;">Δ</th></tr>${exM.html}`,
					)
				: "";

		const tableWrapStyle =
			"width:100%;border:1px solid #bbf7d0;border-radius:8px;overflow:hidden;border-collapse:collapse;";
		const navSep =
			'<span style="color:#a3e635;padding:0 6px;">|</span>';
		const navStyle =
			'font-family:system-ui,Arial,sans-serif;font-size:11px;font-weight:600;color:#ecfdf5;text-decoration:underline;';
		const navHtml =
			'<a href="' +
			escapeHtml(appBase) +
			'" style="' +
			navStyle +
			'">Umami Overview</a>' +
			navSep +
			'<a href="' +
			escapeHtml(`${appBase}/events`) +
			'" style="' +
			navStyle +
			'">Umami Events</a>' +
			navSep +
			'<a href="' +
			escapeHtml(`${appBase}/goals`) +
			'" style="' +
			navStyle +
			'">Umami Goals</a>';

		const topPathY = topPath ? Number(topPath.y) || 0 : 0;
		const topPathPrevY = topPathPrev ? Number(topPathPrev.y) || 0 : 0;
		const scoreHelp = `Score = ${PAGEWEIGHT}x normalized Page Viewed (by section) + ${EVENTWEIGHT}x normalized engagement. Bottom 3 excludes any section already in top 3 (no duplicate on ties).`;
		const html =
			"<!DOCTYPE html>\n" +
			'<html lang="en">\n' +
			"<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Dorkinians Umami Weekly Report</title></head>\n" +
			'<body style="margin:0;padding:0;background-color:#ecfdf5;font-family:system-ui,Arial,sans-serif;color:#14532d;">\n' +
			'  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ecfdf5;padding:24px 0;">\n' +
			'    <tr><td align="center" style="padding:0 12px;">\n' +
			'      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:720px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #bbf7d0;box-shadow:0 8px 24px rgba(6,78,59,0.12);">\n' +
			'        <tr><td style="padding:0;">\n' +
			'          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:linear-gradient(135deg,#064e3b 0%,#047857 45%,#059669 100%);border-radius:12px 12px 0 0;">\n' +
			'            <tr><td style="padding:24px 28px;">\n' +
			'              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>\n' +
			'                <td style="vertical-align:middle;padding-right:16px;width:64px;">\n' +
			'                  <img src="https://bangsluke-assets.netlify.app/images/company-logos/Dorkinians.png" alt="Dorkinians" width="48" height="48" style="display:block;border-radius:8px;background:#fff;padding:2px;" />\n' +
			"                </td>\n" +
			'                <td style="vertical-align:middle;">\n' +
			'                  <div style="font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#d9f99d;margin-bottom:4px;">Dorkinians Website</div>\n' +
			'                  <div style="font-size:20px;font-weight:700;color:#ffffff;line-height:1.2;">Umami Weekly Report</div>\n' +
			"                </td>\n" +
			"              </tr></table>\n" +
			"            </td></tr>\n" +
			"          </table>\n" +
			'          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#065f46;border-bottom:3px solid #facc15;">\n' +
			'            <tr><td style="padding:10px 12px;text-align:center;white-space:normal;">' +
			navHtml +
			"</td></tr>\n" +
			"          </table>\n" +
			'          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>\n' +
			'            <td style="padding:14px 28px 0;font-size:12px;color:#6b7280;">\n' +
			"              Period: <strong>" +
			escapeHtml(periodStartLabel) +
			"</strong> to <strong>" +
			escapeHtml(periodEndLabel) +
			"</strong> (completed UTC week, Sun 00:00&ndash;Sun 00:00). Prior week uses the same 7-day boundary.\n" +
			"            </td>\n" +
			"          </tr></table>\n" +
			'          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>\n' +
			'            <td style="padding:20px 28px 0;">\n' +
			'              <div style="font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#047857;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #bbf7d0;">Traffic</div>\n' +
			"            </td>\n" +
			"          </tr>\n" +
			'          <tr><td style="padding:0 28px 20px;">\n' +
			'            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="' +
			tableWrapStyle +
			'">\n' +
			"              <thead><tr>\n" +
			'                <th style="background-color:#047857;color:#fff;padding:10px 14px;font-size:12px;font-weight:700;text-align:left;">Metric</th>\n' +
			'                <th style="background-color:#047857;color:#fff;padding:10px 14px;font-size:12px;font-weight:700;text-align:right;">This week</th>\n' +
			'                <th style="background-color:#047857;color:#fff;padding:10px 14px;font-size:12px;font-weight:700;text-align:right;">Prev week</th>\n' +
			'                <th style="background-color:#047857;color:#fff;padding:10px 14px;font-size:12px;font-weight:700;text-align:center;width:48px;">Trend</th>\n' +
			"              </tr></thead>\n" +
			"              <tbody>" +
			rowsHtml +
			"</tbody>\n" +
			"            </table>\n" +
			'            <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Top path: <strong>' +
			escapeHtml(topPathLabel) +
			"</strong> (" +
			topPathY +
			') · prior: <strong>' +
			escapeHtml(topPathPrevLabel) +
			"</strong> (" +
			topPathPrevY +
			")</p>\n" +
			"          </td></tr>\n" +
			'          <tr><td style="padding:0 28px 20px;">\n' +
			'            <div style="font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#047857;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #bbf7d0;">Invest further (top 3)</div>\n' +
			'            <p style="margin:0 0 8px;font-size:11px;color:#6b7280;">' +
			escapeHtml(scoreHelp) +
			"</p>\n" +
			'            <ul style="padding-left:18px;margin:0;font-size:13px;color:#14532d;">' +
			investHtml +
			"</ul>\n" +
			"          </td></tr>\n" +
			'          <tr><td style="padding:0 28px 24px;">\n' +
			'            <div style="font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#9a3412;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #fecaca;">Improve or retire (bottom 3, disjoint)</div>\n' +
			'            <ul style="padding-left:18px;margin:0;font-size:13px;color:#7c2d12;">' +
			retireHtml +
			"</ul>\n" +
			"          </td></tr>\n" +
			'          <tr><td style="padding:0 28px 28px;">\n' +
			'            <div style="font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#047857;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #bbf7d0;">Detail &amp; breakdowns</div>\n' +
			statBlockHtml +
			topPlayersBlock +
			teamXiBlock +
			leagueBlock +
			filtersSpBlock +
			filtersTrBlock +
			shareBlock +
			chatBlock +
			totwBlock +
			usefulBlock +
			webBlock +
			exBlock +
			"          </td></tr>\n" +
			"          </table>\n" +
			"        </td></tr>\n" +
			"      </table>\n" +
			'      <p style="max-width:720px;margin:16px auto 0;font-size:11px;color:#6b7280;text-align:center;">Netlify <code>umami-weekly-report</code> · API ' +
			escapeHtml(base) +
			"</p>\n" +
			"    </td></tr>\n" +
			"  </table>\n" +
			"</body>\n" +
			"</html>\n";

		const transporter = nodemailer.createTransport({
			host,
			port,
			secure,
			auth: { user, pass },
			tls: {
				rejectUnauthorized: false,
				checkServerIdentity: () => undefined,
			},
		});

		await transporter.sendMail({
			from,
			to,
			subject,
			html,
		});

		console.log("umami-weekly-report: email sent");
		return new Response(JSON.stringify({ ok: true }), { status: 200 });
	} catch (err) {
		console.error("umami-weekly-report failed", err);
		return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500 });
	}
};