#!/usr/bin/env node

/**
 * Test Questions Report Script
 * Tests questions from TBL_TestQuestions CSV against the chatbot and sends email summary
 */

const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

// Enhanced logging for debugging
const debugLogFile = path.join(__dirname, "..", "logs", "test-questions-debug.log");
const debugLogStream = fs.createWriteStream(debugLogFile, { flags: "w" });

// Override console methods to log to both console and debug file
const originalConsole = {
	log: console.log,
	error: console.error,
	warn: console.warn,
};

function logToBoth(message, level = "log") {
	const timestamp = new Date().toISOString();
	const logMessage = `[${timestamp}] ${message}`;

	// Write to debug file
	debugLogStream.write(logMessage + "\n");

	// Write to console
	originalConsole[level](message);
}

console.log = (message) => logToBoth(message, "log");
console.error = (message) => logToBoth(message, "error");
console.warn = (message) => logToBoth(message, "warn");

// Load environment variables
require("dotenv").config();

// Force ts-node to transpile-only mode (skip type checking)
process.env.TS_NODE_TRANSPILE_ONLY = "true";

// Check for hide passed tests mode
const hidePassedTests = process.argv.includes("--hide-passed") || process.env.HIDE_PASSED_TESTS === "true";

// Set up console logging to file
const logDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logDir)) {
	fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, "test-questions-execution.log");
const logStream = fs.createWriteStream(logFile, { flags: "a" });

// Override console methods to write to both console and file
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
	const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ");
	originalConsoleLog(...args);
	logStream.write(`[${new Date().toISOString()}] LOG: ${message}\n`);
};

console.error = (...args) => {
	const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ");
	originalConsoleError(...args);
	logStream.write(`[${new Date().toISOString()}] ERROR: ${message}\n`);
};

console.warn = (...args) => {
	const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ");
	originalConsoleWarn(...args);
	logStream.write(`[${new Date().toISOString()}] WARN: ${message}\n`);
};

// Clean up function
process.on("exit", () => {
	logStream.end();
});

process.on("SIGINT", () => {
	logStream.end();
	process.exit(0);
});

process.on("SIGTERM", () => {
	logStream.end();
	process.exit(0);
});

// Register ts-node to handle TypeScript imports
require("ts-node").register({
	transpileOnly: true,
	compilerOptions: {
		module: "commonjs",
		target: "es2020",
		esModuleInterop: true,
		allowSyntheticDefaultImports: true,
		skipLibCheck: true,
		moduleResolution: "node",
	},
});

// Import chatbot service (will be loaded dynamically)
let ChatbotService = null;

// Load testDataSources to get TBL_TestQuestions URL
const { testDataSources } = require("../config/dataSources.js");

/**
 * Extract numeric value from chatbot answer for NumberCard responses
 */
function extractNumberFromAnswer(answer) {
	if (!answer) return null;

	// Check for zero-value responses first
	const zeroPatterns = [
		/has not conceded (?:a )?goal/i,  // More specific - check conceded first
		/has not scored (?:any )?goals?/i,
		/has not (?:scored|got|made|conceded) (?:any )?/i,
		/have not (?:scored|got|made|conceded) (?:any )?/i,
		/not scored (?:any )?goals?/i,
		/has not conceded/i,  // Fallback pattern for "has not conceded" in any context
		/no goals?/i,
		/zero goals?/i,
		/0 goals?/i,
	];

	for (const pattern of zeroPatterns) {
		if (pattern.test(answer)) {
			return 0;
		}
	}

	// Try to extract decimal number first (e.g., "0.2", "1.5")
	const decimalPattern = /\b(\d+\.\d+)\b/;
	const decimalMatch = answer.match(decimalPattern);
	if (decimalMatch) {
		const num = parseFloat(decimalMatch[1]);
		if (!isNaN(num)) {
			return num;
		}
	}

	// Try to extract integer number from various formats: "8", "8 goals", "has scored 8", etc.
	const patterns = [
		/\b(\d+)\b/, // Simple number
		/(\d+)\s*(?:goals?|assists?|appearances?|games?|times?|points?)/i, // Number with unit
		/(?:scored|has|have|got|made)\s+(\d+)/i, // "scored 8", "has 8"
		/(\d+)\s*(?:for|in|at|during)/i, // "8 for", "8 in"
	];

	for (const pattern of patterns) {
		const match = answer.match(pattern);
		if (match) {
			const num = parseInt(match[1], 10);
			if (!isNaN(num)) {
				return num;
			}
		}
	}

	return null;
}

/**
 * Extract score format (e.g., "6-1") from answer
 */
function extractScoreFromAnswer(answer) {
	if (!answer) return null;

	// Match score patterns like "6-1", "3-0", etc.
	const scorePattern = /(\d+)\s*[-–]\s*(\d+)/;
	const match = answer.match(scorePattern);
	if (match) {
		return `${match[1]}-${match[2]}`;
	}

	return null;
}

/**
 * Extract value from chatbot response based on Expected_Output_Type
 * Priority: answerValue field (if present) > text extraction
 */
function extractValueFromResponse(response, expectedOutputType, expectedAnswer) {
	if (!response || !response.answer) {
		return null;
	}

	// Priority 1: Use answerValue if present (most reliable)
	if (response.answerValue !== undefined && response.answerValue !== null) {
		// Handle different types of answerValue
		if (typeof response.answerValue === "number") {
			return response.answerValue;
		} else if (typeof response.answerValue === "string") {
			// For Table responses, return "table_data" as-is
			if (response.answerValue === "table_data") {
				return "Table data present";
			}
			// Try to parse as number if it's a numeric string
			const parsed = parseFloat(response.answerValue);
			if (!isNaN(parsed) && isFinite(parsed)) {
				return parsed;
			}
			// Return as string for Record responses (e.g., season names)
			return response.answerValue;
		}
	}

	// Priority 2: Fall back to text extraction for backward compatibility
	const answer = response.answer;

	switch (expectedOutputType) {
		case "NumberCard":
			// Check if expected answer is a score format (e.g., "6-1")
			if (expectedAnswer && /^\d+[-–]\d+$/.test(String(expectedAnswer).trim())) {
				return extractScoreFromAnswer(answer) || extractNumberFromAnswer(answer);
			}
			return extractNumberFromAnswer(answer);
		case "Table":
			// For Table, check if visualization data exists
			if (response.visualization && response.visualization.data) {
				return "Table data present";
			}
			// Try to extract key information from answer text
			return answer;
		case "Record":
			// For Record, return the answer text
			return answer;
		default:
			// Default: return the answer text
			return answer;
	}
}

/**
 * Compare extracted value with expected answer
 */
function compareAnswers(extractedValue, expectedAnswer, expectedOutputType) {
	if (!extractedValue && extractedValue !== 0 && extractedValue !== "Table data present") {
		return false;
	}

	// Normalize expected answer
	const normalizedExpected = String(expectedAnswer).trim().toLowerCase();

	switch (expectedOutputType) {
		case "NumberCard":
			// Check if expected answer is a score format (e.g., "6-1")
			if (/^\d+[-–]\d+$/.test(String(expectedAnswer).trim())) {
				const extractedScore = String(extractedValue).trim();
				const expectedScore = String(expectedAnswer).trim();
				// Compare scores (case insensitive, handle different dash types)
				return extractedScore.replace(/[–—]/g, "-") === expectedScore.replace(/[–—]/g, "-");
			}
			// Compare numeric values (handle both integers and decimals)
			const extractedNum = typeof extractedValue === "number" ? extractedValue : parseFloat(extractedValue);
			const expectedNum = parseFloat(normalizedExpected);
			
			// Special case: if extractedValue is 0 (from zero pattern) and expected is 0 or 0.0, match
			if (extractedValue === 0 && (expectedAnswer === "0" || expectedAnswer === "0.0" || expectedNum === 0)) {
				return true;
			}
			
			if (!isNaN(extractedNum) && !isNaN(expectedNum)) {
				// For decimal values, allow small floating point differences
				// Special case: 0 and 0.0 should always match
				if (extractedNum === 0 && expectedNum === 0) {
					return true;
				}
				return Math.abs(extractedNum - expectedNum) < 0.1;
			}
			return false;
		case "Table":
		case "Record":
			// For Table/Record, check if answer contains expected text or if table data exists
			if (extractedValue === "Table data present") {
				return true; // Table visualization exists
			}
			const extractedText = String(extractedValue).toLowerCase();
			// For ordinal numbers like "1st", check if answer contains the ordinal
			if (/^\d+(st|nd|rd|th)$/i.test(normalizedExpected)) {
				// Extract the number from ordinal (e.g., "1st" -> "1")
				const ordinalNum = normalizedExpected.match(/^(\d+)/);
				if (ordinalNum) {
					return extractedText.includes(ordinalNum[1]) || extractedText.includes(normalizedExpected);
				}
			}
			return extractedText.includes(normalizedExpected) || normalizedExpected.includes(extractedText);
		default:
			// String comparison (case insensitive)
			const extractedStr = String(extractedValue).trim().toLowerCase();
			return extractedStr === normalizedExpected;
	}
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line) {
	const result = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				// Escaped quote
				current += '"';
				i++; // Skip next quote
			} else {
				// Toggle quote state
				inQuotes = !inQuotes;
			}
		} else if (char === "," && !inQuotes) {
			// Field separator
			result.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}

	// Add the last field
	result.push(current.trim());

	return result;
}

/**
 * Fetch test questions from CSV
 */
async function fetchTestQuestions() {
	try {
		// Find TBL_TestQuestions in testDataSources
		const testQuestionsSource = testDataSources.find((source) => source.name === "TBL_TestQuestions");

		if (!testQuestionsSource) {
			throw new Error("TBL_TestQuestions not found in testDataSources");
		}

		console.log("🔍 Fetching test questions from CSV...");
		console.log(`📊 URL: ${testQuestionsSource.url}`);

		const response = await fetch(testQuestionsSource.url);
		if (!response.ok) {
			throw new Error(`Failed to fetch test questions: ${response.statusText}`);
		}

		const csvText = await response.text();
		const csvLength = csvText ? csvText.length : 0;
		originalConsole.log(`📊 CSV content length: ${csvLength}`);

		// Parse CSV
		const lines = csvText.split("\n").filter((line) => line.trim());
		if (lines.length === 0) {
			return [];
		}

		// Parse headers
		const headers = parseCSVLine(lines[0]);
		originalConsole.log(`📊 Headers: ${JSON.stringify(headers)}`);

		const data = [];

		for (let i = 1; i < lines.length; i++) {
			const values = parseCSVLine(lines[i]);
			if (values.length !== headers.length) {
				console.warn(`⚠️ Line ${i + 1} has ${values.length} values but expected ${headers.length}, skipping`);
				continue;
			}

			const row = {};
			headers.forEach((header, index) => {
				row[header] = values[index] || "";
			});

			// Only add rows that have a Question
			if (row.Question && row.Question.trim()) {
				data.push(row);
			}
		}

		console.log(`📊 Parsed ${data.length} test questions from CSV`);
		return data;
	} catch (error) {
		console.error("❌ Error fetching test questions:", error);
		return [];
	}
}

/**
 * Load chatbot service
 */
function loadChatbotService() {
	if (!ChatbotService) {
		try {
			// Clear ALL caches to force fresh compilation
			if (require.cache) {
				Object.keys(require.cache).forEach((key) => {
					delete require.cache[key];
				});
			}

			// Clear ts-node cache specifically
			if (require.extensions[".ts"]) {
				delete require.extensions[".ts"];
			}

			// Register ts-node with minimal configuration
			require("ts-node").register({
				transpileOnly: true,
				skipProject: true,
				compilerOptions: {
					target: "es2020",
					module: "commonjs",
					moduleResolution: "node",
					esModuleInterop: true,
					allowSyntheticDefaultImports: true,
					skipLibCheck: true,
					noEmit: true,
				},
			});

			console.log("✅ ts-node registered with minimal configuration");

			// Load the TypeScript file
			const chatbotPath = path.resolve(__dirname, "../lib/services/chatbotService.ts");
			console.log(`📁 Loading: ${chatbotPath}`);

			const chatbotModule = require(chatbotPath);
			console.log("✅ TypeScript file loaded successfully");

			// Check for ChatbotService
			if (chatbotModule.ChatbotService) {
				ChatbotService = chatbotModule.ChatbotService;
				console.log("✅ ChatbotService loaded successfully");
			} else {
				console.log("❌ ChatbotService not found in module");
				console.log("📝 Available exports:", Object.keys(chatbotModule));
				throw new Error("ChatbotService not found in module");
			}
		} catch (error) {
			console.log("⚠️ Could not load ChatbotService:");
			console.log("⚠️ Error type:", error.constructor.name);
			console.log("⚠️ Error message:", error.message);
			console.log("⚠️ Error stack:", error.stack);
			console.log("⚠️ Falling back to API-based testing");
		}
	}
	return ChatbotService;
}

// Email configuration (using same env vars as existing email service)
const EMAIL_CONFIG = {
	host: process.env.SMTP_SERVER,
	port: parseInt(process.env.SMTP_PORT || "587", 10),
	secure: process.env.SMTP_EMAIL_SECURE === "true",
	auth: {
		user: process.env.SMTP_USERNAME,
		pass: process.env.SMTP_PASSWORD,
	},
	tls: {
		rejectUnauthorized: false,
	},
};

const RECIPIENT_EMAIL = process.env.SMTP_TO_EMAIL || process.env.SMTP_FROM_EMAIL;

/**
 * Check if the development server is running
 */
async function checkServerHealth() {
	try {
		const baseUrl = process.env.NODE_ENV === "production" ? "https://dorkinians-website-v3.netlify.app" : "http://localhost:3000";

		const response = await fetch(`${baseUrl}/api/chatbot`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				question: "How many goals has Luke Bangs scored?",
				userContext: "Luke Bangs",
			}),
		});

		if (!response.ok) {
			console.log(`❌ Server responded with status: ${response.status}`);
			return false;
		}

		const data = await response.json();
		if (!data.answer || data.answer.trim() === "") {
			console.log("❌ Server returned empty response");
			return false;
		}

		console.log("✅ Server is running and responding correctly");
		return true;
	} catch (error) {
		console.log(`❌ Server connection failed: ${error.message}`);
		return false;
	}
}

/**
 * Run tests programmatically
 */
async function runTestsProgrammatically() {
	console.log("🧪 Running test questions programmatically...");

	try {
		// Fetch test questions from CSV
		const testQuestions = await fetchTestQuestions();
		if (testQuestions.length === 0) {
			throw new Error("No test questions found in CSV");
		}

		console.log(`📊 Found ${testQuestions.length} test questions`);

		const results = {
			totalTests: 0,
			passedTests: 0,
			failedTests: 0,
			testDetails: [],
		};

		// Test each question
		for (const testQuestion of testQuestions) {
			const question = testQuestion.Question;
			let expectedAnswer = testQuestion.Answer;
			const expectedOutputType = testQuestion.Expected_Output_Type || "NumberCard";
			const dataSource = testQuestion.Data_Source || "";
			
			// Try multiple possible column names for the Value column
			// Check all keys in the row to find value-related columns
			const availableKeys = Object.keys(testQuestion);
			
			// Log available keys for first test to help debug
			if (results.totalTests === 0) {
				console.log(`ℹ️ Available columns in CSV: ${availableKeys.join(", ")}`);
			}
			
			// Try to find Value column - check multiple variations
			let testDataValue = null;
			const valueColumnNames = [
				"Value",
				"value",
				"TBL_TestData Value",
				"TBL_TestDataValue",
				"TestData Value",
				"TestDataValue"
			];
			
			// First try exact matches
			for (const colName of valueColumnNames) {
				if (testQuestion[colName] !== undefined && testQuestion[colName] !== "" && testQuestion[colName] !== null) {
					testDataValue = testQuestion[colName];
					if (results.totalTests === 0) {
						console.log(`✅ Found Value column: "${colName}" = "${testDataValue}"`);
					}
					break;
				}
			}
			
			// If not found, try case-insensitive search
			if (!testDataValue) {
				for (const key of availableKeys) {
					const keyLower = key.toLowerCase().trim();
					if (keyLower === "value" || keyLower.includes("testdata") && keyLower.includes("value")) {
						testDataValue = testQuestion[key];
						if (results.totalTests === 0) {
							console.log(`✅ Found Value column (case-insensitive): "${key}" = "${testDataValue}"`);
						}
						break;
					}
				}
			}

			if (!question || !expectedAnswer) {
				console.warn(`⚠️ Skipping test question with missing Question or Answer`);
				continue;
			}

			// Handle "#N/A" as a special case - skip these tests
			if (expectedAnswer.trim().toUpperCase() === "#N/A" || expectedAnswer.trim().toUpperCase() === "N/A") {
				console.log(`⏭️ Skipping question with N/A expected answer: ${question}`);
				continue;
			}

			// If Value column exists and contains a decimal number, round it to 1 decimal place and use it as expected answer
			if (testDataValue !== null && testDataValue !== undefined) {
				const testDataValueStr = String(testDataValue).trim();
				if (testDataValueStr !== "" && testDataValueStr.toUpperCase() !== "N/A" && testDataValueStr.toUpperCase() !== "#N/A") {
					const numericValue = parseFloat(testDataValueStr);
					if (!isNaN(numericValue) && isFinite(numericValue)) {
						// Round to 1 decimal place: round(10.0 * value) / 10.0
						const roundedValue = Math.round(10.0 * numericValue) / 10.0;
						expectedAnswer = String(roundedValue);
						console.log(`📊 Using TBL_TestData Value: ${testDataValue} -> Rounded to: ${expectedAnswer}`);
					} else {
						console.log(`⚠️ TBL_TestData Value "${testDataValue}" is not a valid number, using Answer column: ${expectedAnswer}`);
					}
				} else {
					console.log(`ℹ️ TBL_TestData Value is empty/N/A, using Answer column: ${expectedAnswer}`);
				}
			} else {
				if (results.totalTests === 0) {
					// Log available columns for first test to help debug
					console.log(`ℹ️ Available columns in CSV: ${availableKeys.join(", ")}`);
				}
				console.log(`ℹ️ No TBL_TestData Value column found, using Answer column: ${expectedAnswer}`);
			}

			results.totalTests++;

			// Always use Luke Bangs as the player context for all questions
			const userContext = process.env.TEST_USER_CONTEXT || "Luke Bangs";

			try {
				console.log(`\n🧪 Testing question ${results.totalTests}: ${question}`);
				console.log(`   Expected Answer: ${expectedAnswer}`);
				console.log(`   Expected Output Type: ${expectedOutputType}`);
				console.log(`   User Context: ${userContext}`);

				let chatbotResponse, chatbotAnswer, cypherQuery;

				// Try to use the chatbot service directly first
				const chatbotService = loadChatbotService();
				if (chatbotService) {
					const response = await chatbotService.getInstance().processQuestion({
						question: question,
						userContext: userContext,
					});
					chatbotAnswer = response.answer || "Empty response or error";
					cypherQuery = response.cypherQuery || "N/A";
					chatbotResponse = response;
				} else {
					// Fallback to API call
					console.log(`🌐 Using API fallback for: ${question}`);
					const baseUrl = process.env.NODE_ENV === "production" ? "https://dorkinians-website-v3.netlify.app" : "http://localhost:3000";

					const response = await fetch(`${baseUrl}/api/chatbot`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							question: question,
							userContext: userContext,
						}),
					});

					if (response.ok) {
						const data = await response.json();
						chatbotAnswer = data.answer || "Empty response or error";
						cypherQuery = data.cypherQuery || "N/A";
						chatbotResponse = data;
					} else {
						throw new Error(`API call failed: ${response.status}`);
					}
				}

				console.log(`✅ Chatbot response: ${chatbotAnswer}`);
				console.log(`🔍 Cypher query: ${cypherQuery}`);

				// Extract value from response
				const extractedValue = extractValueFromResponse(chatbotResponse, expectedOutputType, expectedAnswer);
				console.log(`🔍 Extracted value: ${extractedValue}`);

				// Check if response is valid
				const hasValidResponse =
					chatbotAnswer &&
					chatbotAnswer !== "Empty response or error" &&
					chatbotAnswer !== "N/A" &&
					!chatbotAnswer.includes("error") &&
					!chatbotAnswer.includes("Error") &&
					!chatbotAnswer.includes("I couldn't find any relevant information") &&
					!chatbotAnswer.includes("I couldn't find relevant information for your question") &&
					!chatbotAnswer.includes("Database connection error") &&
					!chatbotAnswer.includes("Database error") &&
					!chatbotAnswer.includes("Player not found") &&
					!chatbotAnswer.includes("Team not found") &&
					!chatbotAnswer.includes("Missing context") &&
					!chatbotAnswer.includes("Please clarify your question") &&
					cypherQuery !== "N/A";

				// Compare answers
				const valuesMatch = compareAnswers(extractedValue, expectedAnswer, expectedOutputType);
				const passed = hasValidResponse && valuesMatch;

				if (passed) {
					results.passedTests++;
					console.log(`✅ PASSED`);
				} else {
					results.failedTests++;
					console.log(`❌ FAILED`);
					console.log(`   Expected: ${expectedAnswer}`);
					console.log(`   Extracted: ${extractedValue}`);
					console.log(`   Has Valid Response: ${hasValidResponse}`);
					console.log(`   Values Match: ${valuesMatch}`);
				}

				// Store test details
				results.testDetails.push({
					question: question,
					expectedAnswer: expectedAnswer,
					expectedOutputType: expectedOutputType,
					dataSource: dataSource,
					chatbotAnswer: chatbotAnswer,
					extractedValue: extractedValue !== null ? String(extractedValue) : "N/A",
					cypherQuery: cypherQuery,
					status: passed ? "PASSED" : "FAILED",
					hasValidResponse: hasValidResponse,
					valuesMatch: valuesMatch,
				});
			} catch (error) {
				results.failedTests++;
				console.error(`❌ Error testing question: ${error.message}`);
				results.testDetails.push({
					question: question,
					expectedAnswer: expectedAnswer,
					expectedOutputType: expectedOutputType,
					dataSource: dataSource,
					chatbotAnswer: `Error: ${error.message}`,
					extractedValue: "N/A",
					cypherQuery: "N/A",
					status: "FAILED",
					hasValidResponse: false,
					valuesMatch: false,
				});
			}
		}

		return { success: true, results };
	} catch (error) {
		console.error("❌ Error running tests programmatically:", error);
		return { success: false, error: error.message };
	}
}

/**
 * Generate email content
 */
function generateEmailContent(testResults) {
	const timestamp = new Date().toLocaleString();
	const successRate = testResults.totalTests > 0 ? ((testResults.passedTests / testResults.totalTests) * 100).toFixed(1) : 0;

	// Filter out passed tests if hide mode is enabled
	const testsToShow = hidePassedTests ? testResults.testDetails.filter((test) => test.status === "FAILED") : testResults.testDetails;
	const passedTestsCount = testResults.passedTests;
	const totalTestsCount = testResults.totalTests;

	let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; }
        .summary { background-color: ${successRate >= 80 ? "#d4edda" : successRate >= 60 ? "#fff3cd" : "#f8d7da"}; 
                   padding: 15px; border-radius: 5px; margin: 20px 0; }
        .test-details { margin: 20px 0; }
        .test-item { background-color: #f8f9fa; padding: 10px; margin: 5px 0; border-left: 4px solid #007bff; }
        .failed-test { border-left-color: #dc3545; }
        .passed-test { border-left-color: #28a745; }
        .stats-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .stats-table th, .stats-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .stats-table th { background-color: #f2f2f2; }
        .detailed-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
        .detailed-table th, .detailed-table td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        .detailed-table th { background-color: #f2f2f2; font-weight: bold; }
        .detailed-table .question { max-width: 300px; word-wrap: break-word; }
        .detailed-table .answer { max-width: 150px; word-wrap: break-word; }
        .detailed-table .chatbot-answer { max-width: 200px; word-wrap: break-word; }
        .detailed-table .cypher-query { max-width: 200px; word-wrap: break-word; font-family: monospace; font-size: 10px; }
        .detailed-table .status { max-width: 80px; text-align: center; font-weight: bold; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .hidden-info { background-color: #e3f2fd; padding: 10px; border-radius: 5px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🤖 Dorkinians Test Questions Report${hidePassedTests ? " (Failed Tests Only)" : ""}</h1>
        <p><strong>Generated:</strong> ${timestamp}</p>
        <p><strong>Test Suite:</strong> TBL_TestQuestions Validation</p>
        ${hidePassedTests ? `<p><strong>Note:</strong> This report shows only failed tests to reduce email length. ${passedTestsCount} passed tests are hidden.</p>` : ""}
      </div>

      <div class="summary">
        <h2>📊 Test Summary</h2>
        <table class="stats-table">
          <tr>
            <th>Metric</th>
            <th>Value</th>
          </tr>
          <tr>
            <td>Total Tests</td>
            <td>${totalTestsCount}</td>
          </tr>
          <tr>
            <td>Passed Tests</td>
            <td style="color: #28a745;">${passedTestsCount}${hidePassedTests ? " (hidden from detailed view)" : ""}</td>
          </tr>
          <tr>
            <td>Failed Tests</td>
            <td style="color: #dc3545;">${testResults.failedTests}</td>
          </tr>
          <tr>
            <td>Success Rate</td>
            <td style="font-weight: bold; color: ${successRate >= 80 ? "#28a745" : successRate >= 60 ? "#ffc107" : "#dc3545"};">
              ${successRate}%
            </td>
          </tr>
        </table>
      </div>

      ${hidePassedTests ? `
      <div class="hidden-info">
        <h3>📋 Hidden Information</h3>
        <p><strong>${passedTestsCount} passed tests</strong> have been hidden from this report to reduce email length. 
        To see all test results including passed tests, use the standard <code>npm run test:questions-report</code> command.</p>
      </div>
      ` : ""}
  `;

	// Generate detailed test results table
	if (testsToShow.length > 0) {
		html += `
      <div class="test-details">
        <h2>📋 ${hidePassedTests ? "Failed Test Results" : "Detailed Test Results Table"}</h2>
        <p>${hidePassedTests ? `Detailed view of ${testsToShow.length} failed tests that require attention:` : "Complete comparison of all test questions, expected answers, chatbot responses, and pass/fail status:"}</p>
        
        <table class="detailed-table">
          <thead>
            <tr>
              <th>Question</th>
              <th>Expected Answer</th>
              <th>Expected Output Type</th>
              <th>Chatbot Answer</th>
              <th>Extracted Value</th>
              <th>Cypher Query</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;

		testsToShow.forEach((test) => {
			const isFailed = test.status === "FAILED";
			const statusClass = isFailed ? "status-failed" : "status-passed";

			html += `
          <tr>
            <td class="question">${test.question}</td>
            <td class="answer">${test.expectedAnswer}</td>
            <td class="answer">${test.expectedOutputType}</td>
            <td class="chatbot-answer">${test.chatbotAnswer}</td>
            <td class="answer">${test.extractedValue}</td>
            <td class="cypher-query">${test.cypherQuery || "N/A"}</td>
            <td class="status ${statusClass}">${isFailed ? "❌ FAILED" : "✅ PASSED"}</td>
          </tr>
        `;
		});

		html += `
          </tbody>
        </table>
      </div>
    `;
	} else if (hidePassedTests && testsToShow.length === 0) {
		html += `
      <div class="test-details">
        <h2>🎉 No Failed Tests!</h2>
        <p>All ${totalTestsCount} tests passed successfully! The chatbot is working perfectly.</p>
      </div>
    `;
	}

	html += `
      <div class="summary">
        <h2>🔧 Next Steps</h2>
        <p>Based on the test results:</p>
        <ul>
          <li>Review failed tests to identify patterns in chatbot responses</li>
          <li>Check answer extraction logic for different output types</li>
          <li>Verify database queries return expected data formats</li>
          <li>Update response generation logic for better accuracy</li>
        </ul>
      </div>
    </body>
    </html>
  `;

	return html;
}

/**
 * Send email report
 */
async function sendEmailReport(testResults) {
	if (!EMAIL_CONFIG.host || !EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
		console.log("⚠️ Email credentials not configured. Skipping email report.");
		console.log("Set SMTP_SERVER, SMTP_USERNAME, and SMTP_PASSWORD environment variables to enable email reports.");
		return;
	}

	try {
		const transporter = nodemailer.createTransport(EMAIL_CONFIG);

		// Verify connection before sending
		console.log("🔍 Verifying email connection...");
		await transporter.verify();
		console.log("✅ Email connection verified");

		const htmlContent = generateEmailContent(testResults);

		const mailOptions = {
			from: EMAIL_CONFIG.auth.user,
			to: RECIPIENT_EMAIL,
			subject: `🤖 Dorkinians Test Questions Report${hidePassedTests ? " (Failed Tests Only)" : ""} - ${new Date().toLocaleDateString()}`,
			html: htmlContent,
			text: `Dorkinians Test Questions Report${hidePassedTests ? " (Failed Tests Only)" : ""}\n\nTotal Tests: ${testResults.totalTests}\nPassed: ${testResults.passedTests}${hidePassedTests ? " (hidden)" : ""}\nFailed: ${testResults.failedTests}\nSuccess Rate: ${testResults.totalTests > 0 ? ((testResults.passedTests / testResults.totalTests) * 100).toFixed(1) : 0}%\n\nSee HTML version for detailed results.`,
		};

		console.log("📧 Sending email report...");
		await transporter.sendMail(mailOptions);
		console.log(`✅ Email report sent successfully to ${RECIPIENT_EMAIL}`);
	} catch (error) {
		const errorMessage = error?.message || error?.toString() || String(error) || "Unknown error";
		const errorCode = error?.code || "N/A";
		const errorResponse = error?.response || "N/A";
		const responseCode = error?.responseCode || "N/A";
		
		console.error("❌ Failed to send email report");
		
		// Detect Gmail-specific authentication errors
		const isGmailAuthError = 
			errorCode === "EAUTH" || 
			responseCode === 535 || 
			(errorMessage.includes("535") && errorMessage.includes("Username and Password not accepted")) ||
			(errorResponse && typeof errorResponse === "string" && errorResponse.includes("535-5.7.8"));
		
		if (isGmailAuthError) {
			console.error("\n⚠️  Gmail Authentication Error Detected");
			console.error("   Gmail requires an App Password (not your regular password).");
			console.error("   To fix this:");
			console.error("   1. Enable 2-Factor Authentication on your Google account");
			console.error("   2. Go to: https://myaccount.google.com/apppasswords");
			console.error("   3. Generate an App Password for 'Mail'");
			console.error("   4. Use this App Password in your SMTP_PASSWORD environment variable");
			console.error("   For more info: https://support.google.com/mail/?p=BadCredentials");
			console.error("");
		}
		
		console.error(`   Error message: ${errorMessage}`);
		console.error(`   Error code: ${errorCode}`);
		if (errorResponse !== "N/A") {
			console.error(`   Error response: ${JSON.stringify(errorResponse)}`);
		}
		if (error?.stack) {
			console.error(`   Error stack: ${error.stack}`);
		}
		if (responseCode !== "N/A") {
			console.error(`   Response code: ${responseCode}`);
		}
		if (error?.command) {
			console.error(`   Command: ${error.command}`);
		}
	}
}

/**
 * Write test results to log file
 */
function writeTestResultsToLog(testResults) {
	try {
		const logContent = {
			timestamp: new Date().toISOString(),
			summary: {
				totalTests: testResults.totalTests,
				passedTests: testResults.passedTests,
				failedTests: testResults.failedTests,
				successRate: testResults.totalTests > 0 ? ((testResults.passedTests / testResults.totalTests) * 100).toFixed(1) : 0,
			},
			detailedResults: testResults.testDetails,
		};

		const logFile = path.join(__dirname, "..", "logs", "test-questions-email-report.log");
		fs.writeFileSync(logFile, JSON.stringify(logContent, null, 2));
		console.log(`📝 Test results written to: ${logFile}`);
	} catch (error) {
		console.error("❌ Failed to write test results to log:", error.message);
	}
}

/**
 * Main function
 */
async function main() {
	console.log("🚀 Starting test questions report...");
	console.log(`📝 Console output will be logged to: ${logFile}`);

	// Check if server is running first (skip if running via API)
	if (!process.env.SKIP_SERVER_CHECK) {
		console.log("🔍 Checking if development server is running...");
		const serverRunning = await checkServerHealth();

		if (!serverRunning) {
			console.log("❌ Development server is not running on localhost:3000");
			console.log("💡 Please start the server with: npm run dev");
			console.log("📧 Email report will not be sent - server unavailable");
			return;
		}

		console.log("✅ Development server is running");
	} else {
		console.log("⏭️ Skipping server health check (running via API)");
	}

	let finalResults;

	// Run tests programmatically
	const programmaticResult = await runTestsProgrammatically();

	if (programmaticResult.success) {
		console.log("\n📊 Test Results Summary:");
		console.log(`Total Tests: ${programmaticResult.results.totalTests}`);
		console.log(`Passed: ${programmaticResult.results.passedTests}`);
		console.log(`Failed: ${programmaticResult.results.failedTests}`);
		console.log(
			`Success Rate: ${programmaticResult.results.totalTests > 0 ? ((programmaticResult.results.passedTests / programmaticResult.results.totalTests) * 100).toFixed(1) : 0}%`,
		);

		// Write detailed test results to log file
		console.log("📝 Writing detailed test results to log file...");
		writeTestResultsToLog(programmaticResult.results);
		console.log("✅ Test results written to log");

		await sendEmailReport(programmaticResult.results);
		finalResults = programmaticResult.results;
	} else {
		console.log("❌ Programmatic approach failed - no fallback available");
		console.log("💡 Please check the CSV data source and try again");
		if (!process.env.SKIP_SERVER_CHECK) {
			process.exit(1);
		} else {
			console.log("📊 Script completed with errors");
		}
	}

	console.log("\n✅ Test questions report completed!");

	// Exit with appropriate code (skip if running via API)
	if (!process.env.SKIP_SERVER_CHECK) {
		process.exit(finalResults.failedTests > 0 ? 1 : 0);
	} else {
		console.log("📊 Final results:", finalResults);
	}
}

// Run the main function
main()
	.catch((error) => {
		console.error("❌ Script failed:", error);
		process.exit(1);
	})
	.finally(() => {
		// Log before closing the stream
		const finalMessage = `📝 Full debug log saved to: ${debugLogFile}`;
		originalConsole.log(finalMessage);
		// Close the debug log stream
		debugLogStream.end();
	});

