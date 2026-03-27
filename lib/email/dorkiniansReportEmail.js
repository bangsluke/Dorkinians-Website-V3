/**
 * Unified HTML shell + SMTP send for Dorkinians test/report emails.
 * Used by E2E email script, weekly consolidated email, chatbot/questions reports, and Netlify sendTestEmail.
 */

const path = require("path");
const nodemailer = require("nodemailer");

const SUBJECT_PREFIX = "Dorkinians Stats Website - ";

const DEFAULT_LOGO_URL =
	"https://bangsluke-assets.netlify.app/images/company-logos/Dorkinians.png";

function escapeHtml(s) {
	if (s == null) return "";
	return String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * @param {string} detail - suffix after the standard prefix (no leading dash)
 */
function buildSubject(detail) {
	const d = (detail || "Notification").trim();
	return `${SUBJECT_PREFIX}${d}`;
}

function getLogoUrl() {
	const custom =
		process.env.EMAIL_REPORT_LOGO_URL?.trim() ||
		process.env.WEEKLY_EMAIL_LOGO_URL?.trim() ||
		process.env.UMAMI_EMAIL_LOGO_URL?.trim();
	return custom || DEFAULT_LOGO_URL;
}

/**
 * @typedef {Object} ReportContext
 * @property {string} [triggeredBy]
 * @property {string} [npmScript]
 * @property {string} [extra] - WORKFLOW_TRIGGER_LABEL or EMAIL_REPORT_CONTEXT
 * @property {string} [ciWorkflow]
 * @property {string} [ciJob]
 * @property {string} [ciRef]
 * @property {string} [ciRunId]
 */

/**
 * Build context from environment when not explicitly provided.
 * @returns {ReportContext}
 */
function buildDefaultContext(overrides = {}) {
	const ctx = { ...overrides };
	if (!ctx.triggeredBy) {
		ctx.triggeredBy = process.argv.slice(1).join(" ") || "node";
	}
	if (!ctx.extra) {
		ctx.extra =
			process.env.EMAIL_REPORT_CONTEXT?.trim() ||
			process.env.WORKFLOW_TRIGGER_LABEL?.trim() ||
			"";
	}
	if (process.env.GITHUB_ACTIONS === "true") {
		if (!ctx.ciWorkflow) ctx.ciWorkflow = process.env.GITHUB_WORKFLOW || "";
		if (!ctx.ciJob) ctx.ciJob = process.env.GITHUB_JOB || "";
		if (!ctx.ciRef) ctx.ciRef = process.env.GITHUB_REF || "";
		if (!ctx.ciRunId) ctx.ciRunId = process.env.GITHUB_RUN_ID || "";
	}
	return ctx;
}

/**
 * @param {ReportContext} context
 */
function renderContextRowsHtml(context) {
	if (!context || typeof context !== "object") return "";

	const rows = [];
	if (context.triggeredBy) rows.push(["Process", context.triggeredBy]);
	if (context.npmScript) rows.push(["npm script", context.npmScript]);
	if (context.extra) rows.push(["Note", context.extra]);
	if (context.ciWorkflow) rows.push(["CI workflow", context.ciWorkflow]);
	if (context.ciJob) rows.push(["CI job", context.ciJob]);
	if (context.ciRef) rows.push(["CI ref", context.ciRef]);
	if (context.ciRunId) rows.push(["CI run", context.ciRunId]);

	if (rows.length === 0) return "";

	let body = "";
	for (const [k, v] of rows) {
		body += `<tr>
			<td style="padding:4px 8px 4px 0;color:#475467;font-size:11px;font-weight:700;white-space:nowrap;vertical-align:top;">${escapeHtml(k)}</td>
			<td style="padding:4px 0;font-size:11px;color:#101828;font-family:Consolas,'Courier New',monospace;word-break:break-word;">${escapeHtml(v)}</td>
		</tr>`;
	}

	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #eaecf0;border-radius:8px;">
		<tr><td style="padding:10px 12px;">
			<div style="font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#667085;margin-bottom:6px;">Invocation context</div>
			<table role="presentation" width="100%" style="width:100%;border-collapse:collapse;">${body}</table>
		</td></tr>
	</table>`;
}

/**
 * Umami weekly–style gradient header (matches netlify/functions/umami-weekly-report.mjs banner).
 * Omits Umami nav links; keeps accent strip under gradient.
 */
function renderUmamiEmailHeaderHtml(title, subtitle, logoUrl) {
	const customLogo = process.env.UMAMI_EMAIL_LOGO_URL?.trim();
	const logoImgStyle = customLogo
		? "display:block;width:52px;height:52px;"
		: "display:block;width:52px;height:52px;filter:brightness(0) invert(1);-webkit-filter:brightness(0) invert(1);";
	const eyebrow = "Dorkinians Website";
	const subtitleBlock =
		subtitle && String(subtitle).trim()
			? `<div style="font-size:13px;line-height:1.35;color:#ecfdf3;margin-top:6px;opacity:0.95;">${escapeHtml(subtitle.trim())}</div>`
			: "";
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:linear-gradient(135deg,#064e3b 0%,#047857 45%,#059669 100%);border-radius:12px 12px 0 0;">
		<tr><td style="padding:24px 28px;">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr>
				<td style="vertical-align:middle;padding-right:16px;width:64px;">
					<img src="${escapeHtml(logoUrl)}" alt="Dorkinians" width="52" height="52" style="${logoImgStyle}" />
				</td>
				<td style="vertical-align:middle;">
					<div style="font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#d9f99d;margin-bottom:4px;">${escapeHtml(eyebrow)}</div>
					<div style="font-size:20px;font-weight:700;color:#ffffff;line-height:1.2;">${escapeHtml(title)}</div>
					${subtitleBlock}
				</td>
			</tr></table>
		</td></tr>
	</table>
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#065f46;border-bottom:3px solid #facc15;">
		<tr><td style="padding:6px 12px;line-height:0;font-size:0;">&nbsp;</td></tr>
	</table>`;
}

/**
 * Full HTML document: full-width friendly layout, logo header, context strip, main content.
 *
 * @param {Object} opts
 * @param {string} opts.title - main heading next to logo
 * @param {string} [opts.subtitle] - secondary line under title (default header); shown under title for umami variant when set
 * @param {string} [opts.accentColor] - header band background (default green); unused when headerVariant is umami
 * @param {'default'|'umami'} [opts.headerVariant]
 * @param {string} [opts.logoUrl]
 * @param {ReportContext} [opts.context]
 * @param {string} opts.innerHtml - body content (sections); caller supplies escaped or safe HTML
 */
function renderReportEmailHtml(opts) {
	const title = opts.title || "Report";
	const subtitle = opts.subtitle || "";
	const accent = opts.accentColor || "#1C8841";
	const logoUrl = opts.logoUrl || getLogoUrl();
	const contextHtml = renderContextRowsHtml(opts.context || {});
	const inner = opts.innerHtml || "";
	const headerVariant = opts.headerVariant || "default";

	const headerRowHtml =
		headerVariant === "umami"
			? `<tr>
						<td style="padding:0;">
							${renderUmamiEmailHeaderHtml(title, subtitle, logoUrl)}
						</td>
					</tr>`
			: `<tr>
						<td style="padding:16px 12px;background:${accent};">
							<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
								<tr>
									<td style="width:56px;vertical-align:middle;">
										<img src="${escapeHtml(logoUrl)}" alt="Dorkinians FC" width="48" height="48" style="display:block;border:0;border-radius:8px;background:#ffffff;padding:2px;max-width:48px;height:auto;" />
									</td>
									<td style="vertical-align:middle;padding-left:10px;">
										<div style="font-size:20px;line-height:1.2;font-weight:700;color:#ffffff;">${escapeHtml(title)}</div>
										${subtitle ? `<div style="font-size:13px;line-height:1.3;color:#ecfdf3;margin-top:4px;">${escapeHtml(subtitle)}</div>` : ""}
									</td>
								</tr>
							</table>
						</td>
					</tr>`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif;color:#101828;">
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0;padding:0;background:#f2f4f7;">
		<tr>
			<td style="padding:8px 6px;">
				<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:100%;margin:0 auto;background:#ffffff;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden;">
					${headerRowHtml}
					<tr>
						<td style="padding:10px 8px 12px 8px;background:#ffffff;">
							${contextHtml}
						</td>
					</tr>
					<tr>
						<td style="padding:0 8px 16px 8px;background:#ffffff;">
							${inner}
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>`;
}

/**
 * Wrap arbitrary inner HTML in a card block (shared section styling).
 */
function wrapSectionCard(html, opts = {}) {
	const heading = opts.heading ? `<div style="font-size:14px;font-weight:700;color:#101828;margin:0 0 10px 0;padding-bottom:8px;border-bottom:1px solid #eaecf0;">${escapeHtml(opts.heading)}</div>` : "";
	return `<div style="margin:12px 0 0 0;border:1px solid #eaecf0;border-radius:10px;overflow:hidden;background:#ffffff;padding:12px;">
		${heading}
		<div style="font-size:13px;line-height:1.5;color:#344054;">${html}</div>
	</div>`;
}

/**
 * @returns {import('nodemailer').Transporter | null}
 */
function createTransporterFromEnv() {
	const host = process.env.SMTP_SERVER;
	const user = process.env.SMTP_USERNAME;
	const pass = process.env.SMTP_PASSWORD;
	const port = parseInt(process.env.SMTP_PORT || "587", 10);
	const secure = process.env.SMTP_EMAIL_SECURE === "true";
	const from = process.env.SMTP_FROM_EMAIL || user;
	const to = process.env.SMTP_TO_EMAIL || process.env.SMTP_FROM_EMAIL;

	if (!host || !user || !pass || !from || !to) {
		return null;
	}

	return nodemailer.createTransport({
		host,
		port,
		secure,
		auth: { user, pass },
		tls: {
			rejectUnauthorized: false,
			checkServerIdentity: () => undefined,
		},
	});
}

/**
 * Stricter transporter for scripts that require explicit from/to (matches legacy E2E script).
 */
function createTransporterFromEnvStrict() {
	const host = process.env.SMTP_SERVER;
	const port = parseInt(process.env.SMTP_PORT || "587", 10);
	const user = process.env.SMTP_USERNAME;
	const pass = process.env.SMTP_PASSWORD;
	const from = process.env.SMTP_FROM_EMAIL;
	const to = process.env.SMTP_TO_EMAIL;

	if (!host || !port || !user || !pass || !from || !to) {
		return null;
	}

	return nodemailer.createTransport({
		host,
		port,
		secure: process.env.SMTP_EMAIL_SECURE === "true",
		auth: { user, pass },
		tls: {
			rejectUnauthorized: false,
			checkServerIdentity: () => undefined,
		},
	});
}

/**
 * @param {Object} opts
 * @param {string} opts.subjectDetail
 * @param {string} opts.title
 * @param {string} [opts.subtitle]
 * @param {string} [opts.accentColor]
 * @param {ReportContext} [opts.context]
 * @param {string} opts.innerHtml
 * @param {string} opts.textBody
 * @param {boolean} [opts.verify] - call transporter.verify() first (questions report)
 * @param {Array<{filename?:string,path?:string,content?:Buffer}>} [opts.attachments]
 * @param {'default'|'strict'} [opts.smtpMode] - strict requires SMTP_FROM_EMAIL + SMTP_TO_EMAIL + SMTP_PORT
 * @param {'default'|'umami'} [opts.headerVariant] - email banner layout
 */
async function sendReportEmail(opts) {
	const mode = opts.smtpMode || "default";
	const transporter = mode === "strict" ? createTransporterFromEnvStrict() : createTransporterFromEnv();

	if (!transporter) {
		return { ok: false, skipped: true, reason: "missing_smtp_config" };
	}

	if (opts.verify) {
		await transporter.verify();
	}

	const from = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USERNAME;
	const to = process.env.SMTP_TO_EMAIL || process.env.SMTP_FROM_EMAIL;

	const html = renderReportEmailHtml({
		title: opts.title,
		subtitle: opts.subtitle,
		accentColor: opts.accentColor,
		headerVariant: opts.headerVariant,
		context: opts.context,
		innerHtml: opts.innerHtml,
	});

	const mailOptions = {
		from,
		to,
		subject: buildSubject(opts.subjectDetail),
		text: opts.textBody,
		html,
	};
	if (opts.attachments && opts.attachments.length > 0) {
		mailOptions.attachments = opts.attachments;
	}

	const info = await transporter.sendMail(mailOptions);
	return { ok: true, messageId: info.messageId };
}

/**
 * Minimal SMTP connectivity email (Netlify sendTestEmail).
 */
function renderSmtpPingInnerHtml() {
	const ts = new Date().toLocaleString("en-GB", { timeZone: "Europe/London" });
	const env = process.env.NODE_ENV || "unknown";
	return wrapSectionCard(
		`<p style="margin:0 0 8px 0;">This message confirms the configured SMTP credentials can send mail.</p>
		<p style="margin:0;"><strong>Timestamp:</strong> ${escapeHtml(ts)}<br/><strong>Environment:</strong> ${escapeHtml(env)}</p>`,
		{ heading: "SMTP check" },
	);
}

// --- Playwright JSON: skipped tests ---

function errorMessage(err) {
	if (!err) return "";
	if (typeof err === "string") return err;
	return err.message || err.text || JSON.stringify(err);
}

/**
 * Reason for a skipped test entry in Playwright JSON v2.
 * Order: skip annotation description → result errors → result.error → fallback.
 */
function skipReasonFromPlaywrightTest(test) {
	const ann = (test.annotations || []).find((a) => a.type === "skip" && a.description);
	if (ann?.description) return String(ann.description);

	for (const r of test.results || []) {
		if (r.status !== "skipped") continue;
		if (r.errors && r.errors.length > 0) {
			const msg = errorMessage(r.errors[0]);
			if (msg) return cleanSkipMessage(msg);
		}
		if (r.error) {
			const msg = errorMessage(r.error);
			if (msg) return cleanSkipMessage(msg);
		}
	}
	return "No skip message provided";
}

function cleanSkipMessage(msg) {
	const s = String(msg).trim();
	const prefix = /^Test is skipped:\s*/i;
	return s.replace(prefix, "").trim() || "No skip message provided";
}

/**
 * Walk Playwright JSON report (v2) and collect skipped tests.
 * @param {object} report - parsed JSON
 * @returns {Array<{projectName:string,file:string,suitePath:string,title:string,reason:string,line?:number}>}
 */
function extractSkippedTestsFromPlaywrightJson(report) {
	const out = [];
	if (!report || !Array.isArray(report.suites)) return out;

	function walkSuite(suite, parentTitles) {
		const titles = [...parentTitles];
		if (suite.title) titles.push(suite.title);

		for (const spec of suite.specs || []) {
			const specFile = spec.file || suite.file || "";
			const specLine = spec.line;
			for (const test of spec.tests || []) {
				if (test.status !== "skipped") continue;
				const reason = skipReasonFromPlaywrightTest(test);
				const suitePath = titles.filter(Boolean).join(" › ");
				out.push({
					projectName: test.projectName || "",
					file: specFile,
					line: specLine,
					suitePath,
					title: spec.title || "",
					reason,
				});
			}
		}
		for (const child of suite.suites || []) {
			walkSuite(child, titles);
		}
	}

	for (const root of report.suites) {
		walkSuite(root, []);
	}
	return out;
}

/**
 * Merge skipped rows per logical test: same file + title + suitePath.
 * If projects differ or reasons differ, join with " | ".
 */
function mergeSkippedTestsForEmail(rows) {
	const map = new Map();
	for (const row of rows) {
		const key = `${row.file}||${row.title}||${row.suitePath}`;
		const prev = map.get(key);
		if (!prev) {
			map.set(key, {
				...row,
				projects: new Set(row.projectName ? [row.projectName] : []),
			});
			continue;
		}
		if (row.projectName) prev.projects.add(row.projectName);
		if (row.reason && row.reason !== prev.reason) {
			const parts = [prev.reason, row.reason].filter(Boolean);
			prev.reason = [...new Set(parts)].join(" | ");
		}
	}
	return [...map.values()].map((r) => ({
		...r,
		projects: [...r.projects],
		projectName: [...r.projects].join(", "),
	}));
}

/**
 * HTML table for skipped tests (caller wraps in card if desired).
 */
function renderSkippedTestsTableHtml(skippedMerged) {
	if (!skippedMerged.length) {
		return `<p style="margin:0;color:#667085;">No skipped tests in this run.</p>`;
	}

	let body = `<tr style="background:#f9fafb;">
		<th style="text-align:left;padding:8px 6px;font-size:11px;color:#475467;border-bottom:1px solid #eaecf0;">Project(s)</th>
		<th style="text-align:left;padding:8px 6px;font-size:11px;color:#475467;border-bottom:1px solid #eaecf0;">Test</th>
		<th style="text-align:left;padding:8px 6px;font-size:11px;color:#475467;border-bottom:1px solid #eaecf0;">File</th>
		<th style="text-align:left;padding:8px 6px;font-size:11px;color:#475467;border-bottom:1px solid #eaecf0;">Skip reason</th>
	</tr>`;

	for (const s of skippedMerged) {
		const loc = s.line ? `${s.file}:${s.line}` : s.file;
		const projects = (s.projects || [s.projectName]).filter(Boolean).join(", ") || "—";
		body += `<tr>
			<td style="padding:8px 6px;font-size:12px;vertical-align:top;border-bottom:1px solid #f2f4f7;">${escapeHtml(projects)}</td>
			<td style="padding:8px 6px;font-size:12px;vertical-align:top;border-bottom:1px solid #f2f4f7;">${escapeHtml(s.title)}</td>
			<td style="padding:8px 6px;font-size:11px;font-family:Consolas,monospace;vertical-align:top;border-bottom:1px solid #f2f4f7;word-break:break-all;">${escapeHtml(loc)}</td>
			<td style="padding:8px 6px;font-size:12px;vertical-align:top;border-bottom:1px solid #f2f4f7;color:#344054;">${escapeHtml(s.reason)}</td>
		</tr>`;
	}

	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #eaecf0;border-radius:8px;overflow:hidden;">${body}</table>`;
}

/**
 * Resolve path to this module (for Netlify relative requires).
 */
function getModuleDir() {
	return path.dirname(__filename);
}

module.exports = {
	SUBJECT_PREFIX,
	DEFAULT_LOGO_URL,
	escapeHtml,
	buildSubject,
	getLogoUrl,
	buildDefaultContext,
	renderContextRowsHtml,
	renderUmamiEmailHeaderHtml,
	renderReportEmailHtml,
	wrapSectionCard,
	createTransporterFromEnv,
	createTransporterFromEnvStrict,
	sendReportEmail,
	renderSmtpPingInnerHtml,
	extractSkippedTestsFromPlaywrightJson,
	mergeSkippedTestsForEmail,
	renderSkippedTestsTableHtml,
	getModuleDir,
	skipReasonFromPlaywrightTest,
};
