#!/usr/bin/env node

/**
 * Comprehensive Test Runner
 * Runs all test suites in sequence with clear differentiation:
 * 1. Unit Tests
 * 2. Integration Tests
 * 3. Other Jest Tests (comprehensive, advanced, performance, validation, ux, security, monitoring)
 * 4. E2E Tests (Playwright)
 * 5. Chatbot Report
 * 6. Questions Report
 *
 * NOTE: database-dorkinians tests run in the database-dorkinians repository pipeline.
 */

const { execSync, spawn } = require("child_process");
const path = require("path");
const { sendReportEmail, buildDefaultContext } = require(path.join(__dirname, "..", "..", "lib", "email", "dorkiniansReportEmail"));
const {
	ensureArtifactDir,
	jestJsonOutputSuffix,
	getTestAllArtifactPaths,
	buildSectionsFromArtifacts,
	buildTestAllEmailInnerHtml,
	buildTestAllEmailPlainText,
} = require(path.join(__dirname, "..", "..", "lib", "email", "testAllSummaryEmail"));

// Load environment variables
require("dotenv").config();

const REPO_ROOT = path.join(__dirname, "..", "..");
const writeTestAllArtifacts = process.env.SEND_CI_TEST_ALL_SUMMARY_EMAIL === "true";
const artifactPaths = getTestAllArtifactPaths(REPO_ROOT);
if (writeTestAllArtifacts) {
	ensureArtifactDir(REPO_ROOT);
}

// Check for debug mode
const isDebugMode = process.argv.includes("--debug");
const sendEmails = process.argv.includes("--emails") || process.env.SEND_TEST_EMAILS === "true";

const jestJsonSuffixUnit = writeTestAllArtifacts ? jestJsonOutputSuffix(artifactPaths.jestUnit) : "";
const jestJsonSuffixIntegration = writeTestAllArtifacts ? jestJsonOutputSuffix(artifactPaths.jestIntegration) : "";
const jestJsonSuffixOther = writeTestAllArtifacts ? jestJsonOutputSuffix(artifactPaths.jestOther) : "";

// Colors for console output (cross-platform compatible)
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	cyan: "\x1b[36m",
};
const E2E_SKIP_REASON_NOTE =
	"Skipped E2E tests are intentional guard skips (for example: missing/slow test data, valid empty states, or project/device-specific conditions).";

function printSectionHeader(title) {
	const separator = "=".repeat(80);
	console.log(`\n${colors.cyan}${separator}${colors.reset}`);
	console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
	console.log(`${colors.cyan}${separator}${colors.reset}\n`);
}

function printSuccess(message) {
	console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function printError(message) {
	console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function printInfo(message) {
	console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function runCommandStreaming(command, description, envOverrides = {}) {
	return new Promise((resolve) => {
		printInfo(`Running: ${description}`);
		const chunks = [];

		const child = spawn(command, {
			shell: true,
			cwd: REPO_ROOT,
			env: { ...process.env, ...envOverrides },
			windowsHide: true,
			stdio: ["ignore", "pipe", "pipe"],
		});

		child.stdout.on("data", (data) => {
			chunks.push(data);
			process.stdout.write(data);
		});
		child.stderr.on("data", (data) => {
			chunks.push(data);
			process.stderr.write(data);
		});

		child.on("error", (err) => {
			printError(`${description} failed`);
			if (isDebugMode) {
				console.error(err);
			}
			runCommand.lastOutput = Buffer.concat(chunks).toString("utf8");
			resolve(false);
		});

		child.on("close", (code) => {
			const output = chunks.length ? Buffer.concat(chunks).toString("utf8") : "";
			runCommand.lastOutput = output;
			if (code === 0) {
				printSuccess(`${description} completed successfully`);
				resolve(true);
			} else {
				printError(`${description} failed`);
				resolve(false);
			}
		});
	});
}

async function runCommand(command, description, suppressOutput = false, envOverrides = {}) {
	if (suppressOutput && !isDebugMode) {
		try {
			printInfo(`Running: ${description}`);

			const options = {
				cwd: REPO_ROOT,
				env: { ...process.env, ...envOverrides },
				encoding: "utf8",
				stdio: "pipe",
			};

			const output = execSync(command, options) || "";
			runCommand.lastOutput = output;
			printSuccess(`${description} completed successfully`);
			return true;
		} catch (error) {
			const stdout = error && error.stdout ? error.stdout.toString() : "";
			const stderr = error && error.stderr ? error.stderr.toString() : "";
			runCommand.lastOutput = `${stdout}${stderr ? `\n${stderr}` : ""}`;
			printError(`${description} failed`);
			if (isDebugMode && error.stdout) {
				console.log(error.stdout.toString());
			}
			if (isDebugMode && error.stderr) {
				console.error(error.stderr.toString());
			}
			return false;
		}
	}

	return runCommandStreaming(command, description, envOverrides);
}

function getWorkflowTriggerLabel() {
	const label = process.env.WORKFLOW_TRIGGER_LABEL;
	return typeof label === "string" && label.trim() ? label.trim() : "";
}

// Track results
const results = {
	unit: false,
	integration: false,
	otherJest: false,
	e2e: false,
	chatbotReport: false,
	questionsReport: false,
};

let hasFailures = false;
let chatbotLogExcerpt = "";
let questionsLogExcerpt = "";

// Main execution
async function runAllSuites() {
	console.log(`${colors.bright}${colors.blue}`);
	console.log("╔════════════════════════════════════════════════════════════════════════════╗");
	console.log("║                    COMPREHENSIVE TEST SUITE RUNNER                         ║");
	if (isDebugMode) {
		console.log("║                            DEBUG MODE ENABLED                              ║");
	}
	console.log("╚════════════════════════════════════════════════════════════════════════════╝");
	console.log(`${colors.reset}`);

	// 1. Unit Tests
	printSectionHeader("UNIT TESTS");
	const jestUnitCommand = isDebugMode
		? `jest --testPathPatterns=unit${jestJsonSuffixUnit}`
		: `jest --silent --testPathPatterns=unit${jestJsonSuffixUnit}`;
	results.unit = await runCommand(jestUnitCommand, "Unit Tests", writeTestAllArtifacts && !isDebugMode);

	if (!results.unit) {
		hasFailures = true;
	}

	// 2. Integration Tests
	printSectionHeader("INTEGRATION TESTS");
	const jestIntegrationCommand = isDebugMode
		? `jest --testPathPatterns=integration${jestJsonSuffixIntegration}`
		: `jest --silent --testPathPatterns=integration${jestJsonSuffixIntegration}`;
	results.integration = await runCommand(jestIntegrationCommand, "Integration Tests", writeTestAllArtifacts && !isDebugMode);

	if (!results.integration) {
		hasFailures = true;
	}

	// 3. Other Jest Tests (comprehensive, advanced, performance, validation, ux, security, monitoring)
	printSectionHeader("OTHER JEST TESTS");
	printInfo("Running: Comprehensive, Advanced, Performance, Validation, UX, Security, and Monitoring Tests");
	const jestOtherCommand = isDebugMode
		? `jest --testPathPatterns="(comprehensive|advanced|performance|validation|ux|security|monitoring)"${jestJsonSuffixOther}`
		: `jest --silent --testPathPatterns="(comprehensive|advanced|performance|validation|ux|security|monitoring)"${jestJsonSuffixOther}`;
	results.otherJest = await runCommand(
		jestOtherCommand,
		"Other Jest Tests (Comprehensive, Advanced, Performance, Validation, UX, Security, Monitoring)",
		writeTestAllArtifacts && !isDebugMode,
	);

	if (!results.otherJest) {
		hasFailures = true;
	}

	// 4. E2E Tests - use playwright.config reporters (list + html); stream stdout so progress is visible live
	printSectionHeader("E2E TESTS (PLAYWRIGHT)");
	const playwrightCommand = "playwright test";
	results.e2e = await runCommand(playwrightCommand, "E2E Tests (Playwright)");
	const e2eSkippedMatch = (runCommand.lastOutput || "").match(/(\d+)\s+skipped/i);
	let e2eSkippedCount = e2eSkippedMatch ? Number(e2eSkippedMatch[1]) : 0;
	if (e2eSkippedCount > 0) {
		printInfo(`${e2eSkippedCount} E2E test(s) were skipped. ${E2E_SKIP_REASON_NOTE}`);
	}

	if (!results.e2e) {
		hasFailures = true;
	}

	// 5. Chatbot Report
	printSectionHeader("CHATBOT REPORT");
	results.chatbotReport = await runCommand(
		"npm run test:chatbot-players-report",
		"Chatbot Report",
		true,
		{ SEND_TEST_EMAILS: sendEmails ? "true" : "false" },
	);

	if (!results.chatbotReport) {
		hasFailures = true;
		chatbotLogExcerpt = runCommand.lastOutput || "";
	}

	// 6. Questions Report
	printSectionHeader("QUESTIONS REPORT");
	results.questionsReport = await runCommand(
		"npm run test:questions-report",
		"Questions Report",
		true,
		{ SEND_TEST_EMAILS: sendEmails ? "true" : "false" },
	);

	if (!results.questionsReport) {
		hasFailures = true;
		questionsLogExcerpt = runCommand.lastOutput || "";
	}

	// Final Summary
	printSectionHeader("TEST SUMMARY");

	const summary = [
		{ name: "Unit Tests", result: results.unit },
		{ name: "Integration Tests", result: results.integration },
		{ name: "Other Jest Tests", result: results.otherJest },
		{ name: "E2E Tests", result: results.e2e },
		{ name: "Chatbot Report", result: results.chatbotReport },
		{ name: "Questions Report", result: results.questionsReport },
	];

	summary.forEach((item) => {
		const status = item.result ? `${colors.green}✅ PASSED${colors.reset}` : `${colors.red}❌ FAILED${colors.reset}`;
		console.log(`  ${item.name.padEnd(25)} ${status}`);
	});

	const passedCount = summary.filter((item) => item.result).length;
	const totalCount = summary.length;

	console.log(`\n${colors.bright}Total: ${passedCount}/${totalCount} test suites passed${colors.reset}\n`);

	await sendSummaryEmailAndExit(summary, passedCount, totalCount, e2eSkippedCount);
}

async function sendSummaryEmailAndExit(summary, passedCount, totalCount, e2eSkippedCount) {
	const sendCiSummary = process.env.SEND_CI_TEST_ALL_SUMMARY_EMAIL === "true";
	if (sendCiSummary) {
		const runContext = getWorkflowTriggerLabel();
		const sections = buildSectionsFromArtifacts({
			artifactsEnabled: writeTestAllArtifacts,
			repoRoot: REPO_ROOT,
			suitePass: {
				unit: results.unit,
				integration: results.integration,
				otherJest: results.otherJest,
				e2e: results.e2e,
				chatbotReport: results.chatbotReport,
				questionsReport: results.questionsReport,
			},
			logs: { chatbot: chatbotLogExcerpt, questions: questionsLogExcerpt },
		});

		const innerHtml = buildTestAllEmailInnerHtml({
			summaryItems: summary,
			passedCount,
			totalCount,
			e2eSkippedCount,
			e2eSkipNote: E2E_SKIP_REASON_NOTE,
			sections,
		});

		const textBody = buildTestAllEmailPlainText({
			summaryItems: summary,
			passedCount,
			totalCount,
			e2eSkippedCount,
			e2eSkipNote: E2E_SKIP_REASON_NOTE,
			sections,
		});

		const emailResult = await sendReportEmail({
			subjectDetail: `Full test suite - ${passedCount}/${totalCount} passed`,
			title: "Full Test Suite",
			subtitle: "",
			headerVariant: "umami",
			context: buildDefaultContext({
				triggeredBy: "node __tests__/scripts/test-all.js",
				npmScript: "npm run test:all",
				extra: runContext || undefined,
			}),
			innerHtml,
			textBody,
			smtpMode: "strict",
		});
		if (!emailResult.ok) {
			throw new Error(
				emailResult.reason === "missing_smtp_config"
					? "Missing SMTP configuration for test-all CI summary email"
					: "Failed to send test-all CI summary email",
			);
		}
		printSuccess("CI summary email sent.");
	}

	if (hasFailures) {
		printError("Some test suites failed. Please review the output above.");
		process.exit(1);
	} else {
		printSuccess("All test suites passed successfully!");
		process.exit(0);
	}
}

runAllSuites().catch((err) => {
	console.error("test-all failed:", err);
	process.exit(1);
});
