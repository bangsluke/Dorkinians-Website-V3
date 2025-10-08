#!/usr/bin/env node

/**
 * Enhanced Chatbot Test with Comprehensive Logging
 * Captures detailed console logs to help debug test failures
 *
 * This script runs the chatbot tests and logs everything to files for analysis
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config();

// Check for debug mode
const isDebugMode = process.env.DEBUG_MODE === "true";

// Set up comprehensive logging
const logDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logDir)) {
	fs.mkdirSync(logDir, { recursive: true });
}

// Create timestamp for this test run
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const logFile = path.join(logDir, `test-execution-${timestamp}.log`);
const errorLogFile = path.join(logDir, `test-errors-${timestamp}.log`);
const debugLogFile = path.join(logDir, `test-debug-${timestamp}.log`);

// Create write streams for different log types
const logStream = fs.createWriteStream(logFile, { flags: "w" });
const errorStream = fs.createWriteStream(errorLogFile, { flags: "w" });
const debugStream = fs.createWriteStream(debugLogFile, { flags: "w" });

// Enhanced logging functions
const logToFile = (message, level = "INFO") => {
	const timestamp = new Date().toISOString();
	const logMessage = `[${timestamp}] ${level}: ${message}\n`;

	// Write to main log
	logStream.write(logMessage);

	// Write to appropriate specialized log
	if (level === "ERROR" || level === "WARN") {
		errorStream.write(logMessage);
	}

	if (isDebugMode || level === "DEBUG") {
		debugStream.write(logMessage);
	}

	// Note: Console output is handled by the overridden console methods
};

// Override console methods to capture everything
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

console.log = (...args) => {
	const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ");
	originalConsoleLog(...args);
	logToFile(message, "INFO");
};

console.error = (...args) => {
	const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ");
	originalConsoleError(...args);
	logToFile(message, "ERROR");
};

console.warn = (...args) => {
	const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ");
	originalConsoleWarn(...args);
	logToFile(message, "WARN");
};

console.info = (...args) => {
	const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ");
	originalConsoleInfo(...args);
	logToFile(message, "INFO");
};

console.debug = (...args) => {
	const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ");
	originalConsoleDebug(...args);
	logToFile(message, "DEBUG");
};

// Capture uncaught exceptions and unhandled rejections
process.on("uncaughtException", (error) => {
	logToFile(`UNCAUGHT EXCEPTION: ${error.message}\n${error.stack}`, "ERROR");
	process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
	logToFile(`UNHANDLED REJECTION: ${reason}\nPromise: ${promise}`, "ERROR");
});

// Clean up function
const cleanup = () => {
	logToFile("Cleaning up log streams...", "INFO");
	logStream.end();
	errorStream.end();
	debugStream.end();
};

process.on("exit", cleanup);
process.on("SIGINT", () => {
	logToFile("Received SIGINT, cleaning up...", "INFO");
	cleanup();
	process.exit(0);
});
process.on("SIGTERM", () => {
	logToFile("Received SIGTERM, cleaning up...", "INFO");
	cleanup();
	process.exit(0);
});

// Enhanced test runner with detailed logging
async function runEnhancedChatbotTest() {
	logToFile("🚀 Starting enhanced chatbot test with comprehensive logging", "INFO");
	logToFile(`📝 Main log file: ${logFile}`, "INFO");
	logToFile(`📝 Error log file: ${errorLogFile}`, "INFO");
	logToFile(`📝 Debug log file: ${debugLogFile}`, "INFO");

	try {
		// Log environment information
		logToFile("🔍 Environment Information:", "INFO");
		logToFile(`  - Node Version: ${process.version}`, "INFO");
		logToFile(`  - Platform: ${process.platform}`, "INFO");
		logToFile(`  - Working Directory: ${process.cwd()}`, "INFO");
		logToFile(`  - Debug Mode: ${isDebugMode}`, "INFO");
		logToFile(`  - NODE_ENV: ${process.env.NODE_ENV || "undefined"}`, "INFO");

		// Log environment variables (without sensitive data)
		logToFile("🔍 Environment Variables:", "DEBUG");
		const envVars = [
			"PROD_NEO4J_URI",
			"PROD_NEO4J_USER",
			"PROD_NEO4J_PASSWORD",
			"SMTP_SERVER",
			"SMTP_PORT",
			"SMTP_USERNAME",
			"SMTP_PASSWORD",
			"DEBUG_MODE",
			"NODE_ENV",
		];
		envVars.forEach((varName) => {
			const value = process.env[varName];
			if (value) {
				// Mask sensitive values
				const maskedValue = varName.includes("PASSWORD") || varName.includes("USER") ? "*".repeat(Math.min(value.length, 8)) : value;
				logToFile(`  - ${varName}: ${maskedValue}`, "DEBUG");
			} else {
				logToFile(`  - ${varName}: undefined`, "DEBUG");
			}
		});

		// Check if the original test script exists
		const originalTestScript = path.join(__dirname, "test-chatbot-email-report.js");
		if (!fs.existsSync(originalTestScript)) {
			throw new Error(`Original test script not found: ${originalTestScript}`);
		}

		logToFile("📋 Running original chatbot test script with enhanced logging...", "INFO");

		// Run the original test script with enhanced environment
		const testCommand = `node "${originalTestScript}"`;
		logToFile(`🔧 Executing command: ${testCommand}`, "DEBUG");

		// Set environment variables for enhanced logging
		const env = {
			...process.env,
			DEBUG_MODE: "true",
			ENHANCED_LOGGING: "true",
		};

		// Execute the test script
		const result = execSync(testCommand, {
			encoding: "utf8",
			env: env,
			stdio: "pipe", // Capture output
		});

		logToFile("✅ Test script execution completed", "INFO");
		logToFile("📊 Test output captured:", "INFO");
		logToFile(result, "INFO");

		// Parse results if possible
		try {
			const resultsLogFile = path.join(__dirname, "..", "logs", "test-chatbot-email-report.log");
			if (fs.existsSync(resultsLogFile)) {
				const resultsContent = fs.readFileSync(resultsLogFile, "utf8");
				const results = JSON.parse(resultsContent);

				logToFile("📊 Parsed test results:", "INFO");
				logToFile(`  - Total Tests: ${results.summary.totalTests}`, "INFO");
				logToFile(`  - Passed: ${results.summary.passedTests}`, "INFO");
				logToFile(`  - Failed: ${results.summary.failedTests}`, "INFO");
				logToFile(`  - Success Rate: ${results.summary.successRate}%`, "INFO");

				// Log failed tests in detail
				if (results.detailedResults) {
					const failedTests = results.detailedResults.filter((test) => test.status === "FAILED");
					if (failedTests.length > 0) {
						logToFile(`❌ ${failedTests.length} tests failed:`, "ERROR");
						failedTests.forEach((test, index) => {
							logToFile(`  ${index + 1}. Player: ${test.playerName}`, "ERROR");
							logToFile(`     Question: ${test.question}`, "ERROR");
							logToFile(`     Expected: ${test.expected}`, "ERROR");
							logToFile(`     Received: ${test.received}`, "ERROR");
							logToFile(`     Cypher Query: ${test.cypherQuery}`, "ERROR");
						});
					}
				}
			}
		} catch (parseError) {
			logToFile(`⚠️ Could not parse test results: ${parseError.message}`, "WARN");
		}

		return { success: true, message: "Test completed successfully" };
	} catch (error) {
		logToFile(`❌ Test execution failed: ${error.message}`, "ERROR");
		logToFile(`Stack trace: ${error.stack}`, "ERROR");
		return { success: false, error: error.message };
	}
}

// Main execution
async function main() {
	console.log("🚀 Enhanced Chatbot Test with Comprehensive Logging");
	console.log(`📝 Logs will be saved to: ${logDir}`);

	const result = await runEnhancedChatbotTest();

	if (result.success) {
		console.log("✅ Enhanced test completed successfully");
		console.log(`📝 Check log files in: ${logDir}`);
		console.log(`📝 Main log: ${logFile}`);
		console.log(`📝 Error log: ${errorLogFile}`);
		console.log(`📝 Debug log: ${debugLogFile}`);
	} else {
		console.log("❌ Enhanced test failed");
		console.log(`📝 Check error log: ${errorLogFile}`);
		process.exit(1);
	}
}

// Run the enhanced test
main().catch((error) => {
	console.error("❌ Enhanced test script failed:", error);
	process.exit(1);
});
