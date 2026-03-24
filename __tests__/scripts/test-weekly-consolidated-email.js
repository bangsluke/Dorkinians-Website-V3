#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");
const nodemailer = require("nodemailer");
require("dotenv").config();

const ROOT = path.join(__dirname, "..", "..");
const SHOULD_SEND_EMAIL = process.env.SEND_TEST_EMAILS !== "false";

function runCommand(command, timeoutMs = 15 * 60 * 1000, envOverrides = {}) {
	try {
		const output = execSync(command, {
			cwd: ROOT,
			stdio: "pipe",
			encoding: "utf8",
			timeout: timeoutMs,
			env: { ...process.env, ...envOverrides },
		});
		return { passed: true, output };
	} catch (error) {
		const output = `${error?.stdout || ""}\n${error?.stderr || ""}`;
		return { passed: false, output };
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

function toHtml(sections, summary) {
	const rows = sections
		.map((section) => {
			const subRows = section.subsections
				.map(
					(sub) => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #ddd;">${sub.name}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">${renderStatus(sub.passed)}</td>
      </tr>`,
				)
				.join("");

			return `
      <h3>${section.name}</h3>
      <p><code>${section.command}</code> — <strong>${renderStatus(section.passed)}</strong></p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
        <thead>
          <tr>
            <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Subsection</th>
            <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Status</th>
          </tr>
        </thead>
        <tbody>${subRows}</tbody>
      </table>`;
		})
		.join("\n");

	return `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;">
    <h2>Dorkinians Weekly Test Summary</h2>
    <p><strong>Overall:</strong> ${summary.passedSections}/${summary.totalSections} sections passed</p>
    <p><strong>Jest tests passed:</strong> ${summary.jestPassed ?? "n/a"} | <strong>Playwright passed:</strong> ${summary.e2ePassed ?? "n/a"}</p>
    ${rows}
  </body>
</html>`;
}

async function sendMail(subject, html) {
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

	await transporter.sendMail({ from, to, subject, html });
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
	};

	const html = toHtml(sections, summary);
	const subject = `[Weekly] Dorkinians test summary ${summary.passedSections}/${summary.totalSections} sections passed`;
	await sendMail(subject, html);

	const failed = sections.some((s) => !s.passed || s.subsections.some((sub) => !sub.passed));
	process.exit(failed ? 1 : 0);
}

main().catch((error) => {
	console.error("weekly consolidated test email script failed:", error);
	process.exit(1);
});
