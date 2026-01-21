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
 */

const { execSync } = require("child_process");
const path = require("path");

// Load environment variables
require("dotenv").config();

// Check for debug mode
const isDebugMode = process.argv.includes("--debug");

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

function runCommand(command, description, suppressOutput = false) {
	try {
		printInfo(`Running: ${description}`);
		
		const options = {
			cwd: path.join(__dirname, "..", ".."),
		};
		
		if (suppressOutput && !isDebugMode) {
			// Suppress output by piping to null
			options.stdio = "pipe";
		} else {
			// Show all output in debug mode
			options.stdio = "inherit";
		}
		
		execSync(command, options);
		printSuccess(`${description} completed successfully`);
		return true;
	} catch (error) {
		printError(`${description} failed`);
		// In debug mode, show error details
		if (isDebugMode && error.stdout) {
			console.log(error.stdout.toString());
		}
		if (isDebugMode && error.stderr) {
			console.error(error.stderr.toString());
		}
		return false;
	}
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

// Main execution
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
	? "jest --testPathPatterns=unit"
	: "jest --silent --testPathPatterns=unit";
results.unit = runCommand(jestUnitCommand, "Unit Tests");

if (!results.unit) {
	hasFailures = true;
}

// 2. Integration Tests
printSectionHeader("INTEGRATION TESTS");
const jestIntegrationCommand = isDebugMode
	? "jest --testPathPatterns=integration"
	: "jest --silent --testPathPatterns=integration";
results.integration = runCommand(jestIntegrationCommand, "Integration Tests");

if (!results.integration) {
	hasFailures = true;
}

// 3. Other Jest Tests (comprehensive, advanced, performance, validation, ux, security, monitoring)
printSectionHeader("OTHER JEST TESTS");
printInfo("Running: Comprehensive, Advanced, Performance, Validation, UX, Security, and Monitoring Tests");
const jestOtherCommand = isDebugMode
	? 'jest --testPathPatterns="(comprehensive|advanced|performance|validation|ux|security|monitoring)"'
	: 'jest --silent --testPathPatterns="(comprehensive|advanced|performance|validation|ux|security|monitoring)"';
results.otherJest = runCommand(
	jestOtherCommand,
	"Other Jest Tests (Comprehensive, Advanced, Performance, Validation, UX, Security, Monitoring)"
);

if (!results.otherJest) {
	hasFailures = true;
}

// 4. E2E Tests
printSectionHeader("E2E TESTS (PLAYWRIGHT)");
const playwrightCommand = isDebugMode
	? "playwright test"
	: "playwright test --reporter=dot";
results.e2e = runCommand(playwrightCommand, "E2E Tests (Playwright)");

if (!results.e2e) {
	hasFailures = true;
}

// 5. Chatbot Report
printSectionHeader("CHATBOT REPORT");
results.chatbotReport = runCommand("npm run test:chatbot-players-report", "Chatbot Report", true);

if (!results.chatbotReport) {
	hasFailures = true;
}

// 6. Questions Report
printSectionHeader("QUESTIONS REPORT");
results.questionsReport = runCommand("npm run test:questions-report", "Questions Report", true);

if (!results.questionsReport) {
	hasFailures = true;
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

if (hasFailures) {
	printError("Some test suites failed. Please review the output above.");
	process.exit(1);
} else {
	printSuccess("All test suites passed successfully!");
	process.exit(0);
}
