#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");
const nodemailer = require("nodemailer");
require("dotenv").config();

const ROOT = path.join(__dirname, "..", "..");
const SHOULD_SEND_EMAIL = process.env.SEND_TEST_EMAILS !== "false";
const LOGO_URL =
	process.env.WEEKLY_EMAIL_LOGO_URL || "https://bangsluke-assets.netlify.app/images/company-logos/Dorkinians.png";
const E2E_SKIP_REASON_NOTE =
	"Skipped E2E tests are intentional guard skips (for example: missing/slow test data, valid empty states, or project/device-specific conditions).";

function toExcerpt(output, maxLength = 1200) {
	if (!output || typeof output !== "string") return "";
	const trimmed = output.trim();
	if (trimmed.length <= maxLength) return trimmed;
	return `...${trimmed.slice(trimmed.length - maxLength)}`;
}

function runCommand(command, timeoutMs = 15 * 60 * 1000, envOverrides = {}) {
	try {
		const output = execSync(command, {
			cwd: ROOT,
			stdio: "pipe",
			encoding: "utf8",
			timeout: timeoutMs,
			env: { ...process.env, ...envOverrides },
		});
		return { passed: true, output, excerpt: "" };
	} catch (error) {
		const output = `${error?.stdout || ""}\n${error?.stderr || ""}`;
		return { passed: false, output, excerpt: toExcerpt(output) };
	}
}

function parseCount(output, label) {
	const match = output.match(new RegExp(`${label}:\\s+(\\d+)`, "i"));
	return match ? Number(match[1]) : null;
}

function parsePlaywrightPassed(output) {
	const match = output.match(/(\d+)\s+passed/i);
	return match ? Number(match[1]) : null;
}

function parsePlaywrightSkipped(output) {
	const match = output.match(/(\d+)\s+skipped/i);
	return match ? Number(match[1]) : null;
}

function makeSection(name, command, subsections, opts = {}) {
	const sectionResult = runCommand(command, opts.timeoutMs, opts.envOverrides);
	const subResults = subsections.map((sub) => {
		const res = runCommand(sub.command, sub.timeoutMs || opts.timeoutMs, sub.envOverrides || opts.envOverrides || {});
		return { ...sub, ...res };
	});

	return {
		name,
		command,
		...sectionResult,
		subsections: subResults,
	};
}

function renderStatus(passed) {
	return passed ? "PASSED" : "FAILED";
}

function statusColor(passed) {
	return passed ? "#177245" : "#b42318";
}

function statusBg(passed) {
	return passed ? "#ecfdf3" : "#fef3f2";
}

function getRunContextLine() {
	const label = process.env.WORKFLOW_TRIGGER_LABEL;
	return typeof label === "string" && label.trim() ? label.trim() : "";
}

function toHtml(sections, summary) {
	const runContext = getRunContextLine();
	const subtitle = runContext ? "Test summary" : "Weekly Test Summary";
	const contextRow = runContext
		? `<tr>
              <td style="padding:12px 24px 0 24px;background:#f9fafb;">
                <div style="font-size:12px;color:#475467;font-family:Consolas,'Courier New',monospace;">${runContext
									.replace(/&/g, "&amp;")
									.replace(/</g, "&lt;")
									.replace(/>/g, "&gt;")}</div>
              </td>
            </tr>`
		: "";

	const sectionCards = sections
		.map((section) => {
			const sectionPassed = section.passed && section.subsections.every((sub) => sub.passed);
			const borderColor = sectionPassed ? "#b7ebcd" : "#f3c7c1";
			const subRows = section.subsections
				.map(
					(sub) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eaecf0;color:#101828;">${sub.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eaecf0;">
          <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;background:${statusBg(
						sub.passed
					)};color:${statusColor(sub.passed)};">
            ${renderStatus(sub.passed)}
          </span>
        </td>
      </tr>`,
				)
				.join("");

			return `
      <div style="margin:16px 0;border:1px solid ${borderColor};border-radius:12px;overflow:hidden;background:#ffffff;">
        <div style="padding:14px 16px;border-bottom:1px solid #eaecf0;background:#f9fafb;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:17px;font-weight:700;color:#101828;margin-bottom:4px;">${section.name}</div>
            <div style="font-family:Consolas,'Courier New',monospace;font-size:12px;color:#475467;">${section.command}</div>
          </div>
          <span style="display:inline-block;padding:5px 11px;border-radius:999px;font-size:12px;font-weight:700;background:${statusBg(
						sectionPassed
					)};color:${statusColor(sectionPassed)};">
            ${renderStatus(sectionPassed)}
          </span>
        </div>
        <table style="border-collapse:collapse;width:100%;">
        <thead>
          <tr>
            <th style="padding:10px 12px;border-bottom:1px solid #eaecf0;text-align:left;font-size:12px;letter-spacing:.02em;text-transform:uppercase;color:#475467;">Subsection</th>
            <th style="padding:10px 12px;border-bottom:1px solid #eaecf0;text-align:left;font-size:12px;letter-spacing:.02em;text-transform:uppercase;color:#475467;">Status</th>
          </tr>
        </thead>
        <tbody>${subRows}</tbody>
        </table>
      </div>`;
		})
		.join("\n");

	return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f2f4f7;font-family:Arial,sans-serif;color:#101828;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f2f4f7;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="760" style="width:760px;max-width:95%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e4e7ec;">
            <tr>
              <td style="padding:20px 24px;background:#1C8841;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${LOGO_URL}" alt="Dorkinians FC Logo" width="56" height="56" style="display:block;border:0;outline:none;text-decoration:none;background:#ffffff;border-radius:8px;padding:4px;" />
                    </td>
                    <td style="vertical-align:middle;padding-left:12px;">
                      <div style="font-size:22px;line-height:1.2;font-weight:700;color:#ffffff;">Dorkinians Website</div>
                      <div style="font-size:14px;line-height:1.2;color:#ecfdf3;">${subtitle}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${contextRow}
            <tr>
              <td style="padding:18px 24px;background:#f9fafb;border-bottom:1px solid #eaecf0;">
                <div style="font-size:16px;font-weight:700;color:#101828;margin-bottom:6px;">Overall Status: ${summary.passedSections}/${
		summary.totalSections
	} sections passed</div>
                <div style="font-size:13px;color:#344054;">
                  Jest tests passed: <strong>${summary.jestPassed ?? "n/a"}</strong> &nbsp;|&nbsp;
                  Playwright passed: <strong>${summary.e2ePassed ?? "n/a"}</strong>
                </div>
                ${
									summary.e2eSkipped && summary.e2eSkipped > 0
										? `<div style="font-size:13px;color:#344054;margin-top:6px;"><strong>Skip note:</strong> ${E2E_SKIP_REASON_NOTE}</div>`
										: ""
								}
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px 24px 24px;">
                ${sectionCards}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function toText(summary) {
	return [
		"Dorkinians Website - Weekly Test Summary",
		`Overall Status: ${summary.passedSections}/${summary.totalSections} sections passed`,
		`Jest tests passed: ${summary.jestPassed ?? "n/a"}`,
		`Playwright passed: ${summary.e2ePassed ?? "n/a"}`,
		...(summary.e2eSkipped && summary.e2eSkipped > 0 ? [`Skip note: ${E2E_SKIP_REASON_NOTE}`] : []),
	].join("\n");
}

async function sendMail(subject, html, text) {
	if (!SHOULD_SEND_EMAIL) {
		console.log("SEND_TEST_EMAILS=false, skipping consolidated weekly email send");
		return;
	}

	const host = process.env.SMTP_SERVER;
	const user = process.env.SMTP_USERNAME;
	const pass = process.env.SMTP_PASSWORD;
	const to = process.env.SMTP_TO_EMAIL || process.env.SMTP_FROM_EMAIL;
	const from = process.env.SMTP_FROM_EMAIL || user;
	if (!host || !user || !pass || !to || !from) {
		throw new Error("Missing SMTP configuration for consolidated weekly email");
	}

	const transporter = nodemailer.createTransport({
		host,
		port: parseInt(process.env.SMTP_PORT || "587", 10),
		secure: process.env.SMTP_EMAIL_SECURE === "true",
		auth: { user, pass },
		tls: { rejectUnauthorized: false },
	});

	await transporter.sendMail({ from, to, subject, html, text });
}

async function main() {
	const sections = [
		makeSection("Unit", "npm run test:unit", [
			{ name: "Basic", command: "npx jest __tests__/unit/basic/chatbotBasic.test.ts" },
			{ name: "Services", command: "npx jest __tests__/unit/services/chatbotService.test.ts" },
			{ name: "Utils", command: "npx jest __tests__/unit/utils/testUtils.test.ts" },
			{ name: "Stores", command: "npx jest __tests__/unit/stores/navigationStore.test.ts" },
		]),
		makeSection("Integration", "npm run test:integration", [
			{ name: "API Routes", command: "npx jest __tests__/integration/api-routes.integration.test.ts" },
			{ name: "UI Integration", command: "npx jest __tests__/integration/ui-integration.test.ts" },
			{ name: "API Contracts", command: "npx jest __tests__/integration/api-contracts.integration.test.ts" },
			{ name: "Chatbot Integration", command: "npx jest __tests__/integration/chatbotIntegration.test.ts" },
		]),
		makeSection("E2E", "npm run test:e2e", [
			{ name: "Navigation", command: "npm run test:e2e:navigation" },
			{ name: "Home", command: "npm run test:e2e:home" },
			{ name: "Player Stats", command: "npm run test:e2e:stats" },
			{ name: "TOTW", command: "npm run test:e2e:totw" },
			{ name: "Club Info", command: "npm run test:e2e:club-info" },
			{ name: "Settings", command: "npm run test:e2e:settings" },
			{ name: "Admin", command: "npm run test:e2e:admin" },
			{ name: "API", command: "npm run test:e2e:api" },
			{ name: "Cross-Cutting", command: "npm run test:e2e:cross-cutting" },
		], { timeoutMs: 20 * 60 * 1000 }),
		makeSection(
			"Reports",
			"npm run test:chatbot-players-report && npm run test:questions-report",
			[
				{
					name: "Chatbot Report (no email)",
					command: "npm run test:chatbot-players-report",
					envOverrides: { SEND_TEST_EMAILS: "false" },
				},
				{
					name: "Questions Report (no email)",
					command: "npm run test:questions-report",
					envOverrides: { SEND_TEST_EMAILS: "false" },
				},
			],
			{ envOverrides: { SEND_TEST_EMAILS: "false" }, timeoutMs: 25 * 60 * 1000 },
		),
	];

	const summary = {
		totalSections: sections.length,
		passedSections: sections.filter((s) => s.passed).length,
		jestPassed: parseCount(sections[0].output + sections[1].output, "Tests"),
		e2ePassed: parsePlaywrightPassed(sections[2].output),
		e2eSkipped: parsePlaywrightSkipped(sections[2].output),
	};

	const html = toHtml(sections, summary);
	const text = toText(summary);
	const runContext = getRunContextLine();
	const subjectSuffix = runContext ? ` [${runContext}]` : "";
	const subject = `Dorkinians Website - Test summary${subjectSuffix} - ${summary.passedSections}/${summary.totalSections} sections passed`;
	await sendMail(subject, html, text);

	const failed = sections.some((s) => !s.passed || s.subsections.some((sub) => !sub.passed));
	if (failed) {
		console.error("Weekly consolidated test summary detected failing sections/subsections.");
		for (const section of sections) {
			if (!section.passed) {
				console.error(`- Section failed: ${section.name}`);
				console.error(`  Command: ${section.command}`);
				if (section.excerpt) {
					console.error("  Output excerpt:");
					console.error(section.excerpt);
				}
			}
			for (const sub of section.subsections) {
				if (!sub.passed) {
					console.error(`- Subsection failed: ${section.name} / ${sub.name}`);
					console.error(`  Command: ${sub.command}`);
					if (sub.excerpt) {
						console.error("  Output excerpt:");
						console.error(sub.excerpt);
					}
				}
			}
		}
	}
	process.exit(failed ? 1 : 0);
}

main().catch((error) => {
	console.error("weekly consolidated test email script failed:", error);
	process.exit(1);
});
