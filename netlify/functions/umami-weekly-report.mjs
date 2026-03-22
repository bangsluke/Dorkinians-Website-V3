/**
 * Netlify scheduled function: weekly Umami analytics email for Dorkinians V3.
 * Schedule: Friday 00:00 UTC (`0 0 * * 5`).
 *
 * Env (Netlify):
 *   UMAMI_WEBSITE_ID, UMAMI_API_KEY
 *   UMAMI_BASE_URL (optional, default https://api.umami.is/v1)
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

/** Build map section -> total from event-data/values response */
function valuesBySection(rows) {
	const m = {};
	if (!Array.isArray(rows)) return m;
	for (const r of rows) {
		const key = r.value;
		if (!key) continue;
		m[key] = (m[key] || 0) + (Number(r.total) || 0);
	}
	return m;
}

function stripeBg(i) {
	return i % 2 === 0 ? "#f0fdf4" : "#ffffff";
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
	const border = opts.last ? "" : "border-bottom:1px solid #d1fae5;";
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

function recommendBullet(sectionId, rank, currScore, prevScore, pageviews, engagement) {
	const wow =
		prevScore === 0
			? currScore > 0
				? "new activity this period"
				: "flat"
			: ((currScore - prevScore) / prevScore) * 100;
	const parts = [];
	if (rank === "top") {
		if (wow > 15) parts.push("Strong week-over-week momentum—good time to deepen content or CTAs here.");
		else if (pageviews > engagement) parts.push("Traffic-weighted: prioritize clarity and load performance for this area.");
		else parts.push("Interaction-heavy: users are working in this area—protect UX and ship iterative improvements.");
	} else {
		if (wow < -20) parts.push("Notable drop vs last week—investigate regressions, IA, or seasonal effects.");
		else if (pageviews < 3 && engagement < 3) parts.push("Low footprint—validate discovery (nav, SEO, deep links) before retiring features.");
		else parts.push("Below peer sections—consider simplification, merge with higher-traffic flows, or targeted prompts.");
	}
	return parts[0];
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

export default async () => {
	const websiteId = process.env.UMAMI_WEBSITE_ID;
	const apiKey = process.env.UMAMI_API_KEY;
	const base = (process.env.UMAMI_BASE_URL || "https://api.umami.is/v1").replace(/\/$/, "");

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

	const endAt = Date.now();
	const startAt = endAt - 7 * 24 * 60 * 60 * 1000;
	const prevEndAt = startAt;
	const prevStartAt = startAt - 7 * 24 * 60 * 60 * 1000;
	const q = `startAt=${startAt}&endAt=${endAt}`;
	const qPrev = `startAt=${prevStartAt}&endAt=${prevEndAt}`;

	const eventPageViewed = encodeURIComponent("Page Viewed");
	const eventSubpage = encodeURIComponent("Subpage Viewed");

	try {
		const [
			statsRes,
			statsPrevRes,
			eventsRes,
			eventsPrevRes,
			pathRes,
			pathPrevRes,
			pvCurrRes,
			pvPrevRes,
			spCurrRes,
			spPrevRes,
		] = await Promise.all([
			fetch(`${base}/websites/${websiteId}/stats?${q}`, getOpts(apiKey)),
			fetch(`${base}/websites/${websiteId}/stats?${qPrev}`, getOpts(apiKey)),
			fetch(`${base}/websites/${websiteId}/metrics?type=event&${q}`, getOpts(apiKey)),
			fetch(`${base}/websites/${websiteId}/metrics?type=event&${qPrev}`, getOpts(apiKey)),
			fetch(`${base}/websites/${websiteId}/metrics?type=path&${q}`, getOpts(apiKey)),
			fetch(`${base}/websites/${websiteId}/metrics?type=path&${qPrev}`, getOpts(apiKey)),
			fetch(
				`${base}/websites/${websiteId}/event-data/values?event=${eventPageViewed}&propertyName=section&${q}`,
				getOpts(apiKey),
			),
			fetch(
				`${base}/websites/${websiteId}/event-data/values?event=${eventPageViewed}&propertyName=section&${qPrev}`,
				getOpts(apiKey),
			),
			fetch(
				`${base}/websites/${websiteId}/event-data/values?event=${eventSubpage}&propertyName=section&${q}`,
				getOpts(apiKey),
			),
			fetch(
				`${base}/websites/${websiteId}/event-data/values?event=${eventSubpage}&propertyName=section&${qPrev}`,
				getOpts(apiKey),
			),
		]);

		const stats = statsRes.ok ? await statsRes.json() : { pageviews: 0, visitors: 0, visits: 0 };
		const statsPrev = statsPrevRes.ok ? await statsPrevRes.json() : { pageviews: 0, visitors: 0, visits: 0 };
		const events = eventsRes.ok ? await eventsRes.json() : [];
		const eventsPrev = eventsPrevRes.ok ? await eventsPrevRes.json() : [];
		const paths = pathRes.ok ? await pathRes.json() : [];
		const pathsPrev = pathPrevRes.ok ? await pathPrevRes.json() : [];

		const pvCurr = pvCurrRes.ok ? await pvCurrRes.json() : [];
		const pvPrev = pvPrevRes.ok ? await pvPrevRes.json() : [];
		const spCurr = spCurrRes.ok ? await spCurrRes.json() : [];
		const spPrev = spPrevRes.ok ? await spPrevRes.json() : [];

		const pageBySection = valuesBySection(pvCurr);
		const pageBySectionPrev = valuesBySection(pvPrev);
		const subBySection = valuesBySection(spCurr);
		const subBySectionPrev = valuesBySection(spPrev);

		const currModel = buildSectionScores(pageBySection, subBySection, events);
		const prevModel = buildSectionScores(pageBySectionPrev, subBySectionPrev, eventsPrev);

		const sorted = sortSectionsByScore(currModel.scores);
		const top3 = sorted.slice(0, 3);
		const bottom3 = [...sorted].reverse().slice(0, 3);

		const topPath = paths[0];
		const topPathPrev = pathsPrev[0];

		const chatbotQs = getEventCount(events, "Chatbot Question Submitted");
		const chatbotQsPrev = getEventCount(eventsPrev, "Chatbot Question Submitted");
		const filtersApplied = getEventCount(events, "Filters Applied");
		const filtersAppliedPrev = getEventCount(eventsPrev, "Filters Applied");

		let rowsHtml = "";
		let i = 0;
		rowsHtml += metricRow("Pageviews (site)", stats.pageviews ?? 0, statsPrev.pageviews ?? 0, i++);
		rowsHtml += metricRow("Visits", stats.visits ?? 0, statsPrev.visits ?? 0, i++);
		rowsHtml += metricRow("Visitors", stats.visitors ?? 0, statsPrev.visitors ?? 0, i++);
		rowsHtml += metricRow("Chatbot questions", chatbotQs, chatbotQsPrev, i++);
		rowsHtml += metricRow("Filters applied", filtersApplied, filtersAppliedPrev, i++, {
			last: true,
		});

		const topPathLabel = topPath?.x ? String(topPath.x) : "—";
		const topPathPrevLabel = topPathPrev?.x ? String(topPathPrev.x) : "—";

		const investHtml = top3
			.map((sid) => {
				const s = currModel.scores[sid];
				const sp = prevModel.scores[sid];
				const bullet = recommendBullet(sid, "top", s, sp, currModel.pageviews[sid], currModel.engagement[sid]);
				return `<li style="margin:8px 0;"><strong>${sectionLabel(sid)}</strong> (score ${s.toFixed(2)}, was ${sp.toFixed(2)}) — ${bullet}</li>`;
			})
			.join("");

		const retireHtml = bottom3
			.map((sid) => {
				const s = currModel.scores[sid];
				const sp = prevModel.scores[sid];
				const bullet = recommendBullet(sid, "bottom", s, sp, currModel.pageviews[sid], currModel.engagement[sid]);
				return `<li style="margin:8px 0;"><strong>${sectionLabel(sid)}</strong> (score ${s.toFixed(2)}, was ${sp.toFixed(2)}) — ${bullet}</li>`;
			})
			.join("");

		const periodStart = new Date(startAt).toISOString().slice(0, 10);
		const periodEnd = new Date(endAt).toISOString().slice(0, 10);
		const prevStart = new Date(prevStartAt).toISOString().slice(0, 10);
		const prevEnd = new Date(prevEndAt).toISOString().slice(0, 10);

		const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#ecfdf5;font-family:system-ui,Arial,sans-serif;color:#14532d;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(6,78,59,0.12);">
    <tr>
      <td style="padding:24px 28px;background:linear-gradient(135deg,#065f46,#047857);color:#ecfdf5;">
        <h1 style="margin:0 0 8px;font-size:22px;">Dorkinians — Weekly Umami report</h1>
        <p style="margin:0;font-size:13px;opacity:0.95;">Current window: ${periodStart} → ${periodEnd} UTC · vs prior: ${prevStart} → ${prevEnd} UTC</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px;">
        <h2 style="margin:0 0 12px;font-size:16px;color:#065f46;">Headline metrics</h2>
        <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #d1fae5;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#ecfdf5;">
              <th style="text-align:left;padding:10px 14px;font-size:12px;color:#047857;">Metric</th>
              <th style="text-align:right;padding:10px 14px;font-size:12px;color:#047857;">This week</th>
              <th style="text-align:right;padding:10px 14px;font-size:12px;color:#047857;">Prev week</th>
              <th style="text-align:center;padding:10px 14px;font-size:12px;color:#047857;">Δ</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Top path (raw): <strong>${topPathLabel}</strong> (${topPath?.y ?? 0} views) · prior top: <strong>${topPathPrevLabel}</strong> (${topPathPrev?.y ?? 0})</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 24px;">
        <h2 style="margin:0 0 8px;font-size:16px;color:#065f46;">Invest further (top 3 sections)</h2>
        <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Score = ${PAGEWEIGHT}×normalized Page Viewed (by section) + ${EVENTWEIGHT}×normalized engagement (subpages + mapped events).</p>
        <ul style="padding-left:18px;margin:0;font-size:13px;color:#14532d;">${investHtml}</ul>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 28px;">
        <h2 style="margin:0 0 8px;font-size:16px;color:#9a3412;">Improve or retire (bottom 3 sections)</h2>
        <ul style="padding-left:18px;margin:0;font-size:13px;color:#7c2d12;">${retireHtml}</ul>
      </td>
    </tr>
  </table>
  <p style="max-width:720px;margin:16px auto 0;font-size:11px;color:#6b7280;text-align:center;">Automated by Netlify <code>umami-weekly-report</code> · Umami base ${base}</p>
</body>
</html>`;

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
			subject: `Dorkinians weekly analytics (${periodStart} – ${periodEnd} UTC)`,
			html,
		});

		console.log("umami-weekly-report: email sent");
		return new Response(JSON.stringify({ ok: true }), { status: 200 });
	} catch (err) {
		console.error("umami-weekly-report failed", err);
		return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500 });
	}
};
