const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

exports.handler = async (event, context) => {
	// Only allow POST requests
	if (event.httpMethod !== "POST") {
		return {
			statusCode: 405,
			body: JSON.stringify({
				success: false,
				message: "Method not allowed. Use POST.",
			}),
		};
	}

	try {
		// Parse the request body
		const body = JSON.parse(event.body || "{}");
		const { emailAddress, batchSize = 10, startIndex = 0 } = body;

		if (!emailAddress) {
			return {
				statusCode: 400,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Headers": "Content-Type",
					"Access-Control-Allow-Methods": "POST, OPTIONS",
				},
				body: JSON.stringify({
					success: false,
					message: "Email address is required",
				}),
			};
		}

		// Set the email address in environment for the script
		process.env.SMTP_TO_EMAIL = emailAddress;

		// Run the test logic directly instead of executing external script
		try {
			// Set environment for Netlify function
			process.env.NETLIFY = "true";
			process.env.SMTP_TO_EMAIL = emailAddress;
			
			// Import and run the test logic directly
			const testModule = require("./test-chatbot-email-report.js");
			
			// Run a batch of tests
			const testResults = await testModule.runTestsBatch(batchSize, startIndex);
			
			return {
				statusCode: 200,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Headers": "Content-Type",
					"Access-Control-Allow-Methods": "POST, OPTIONS",
				},
				body: JSON.stringify({
					success: true,
					message: `Batch ${Math.floor(startIndex / batchSize) + 1} completed`,
					batchSize: testResults.batchSize,
					startIndex: testResults.startIndex,
					processedTests: testResults.processedTests,
					totalTests: testResults.totalTests,
					passedTests: testResults.passedTests,
					failedTests: testResults.failedTests,
					hasMore: testResults.hasMore,
					nextStartIndex: testResults.nextStartIndex,
					output: `Batch completed: ${testResults.passedTests}/${testResults.processedTests} passed`,
				}),
			};
		} catch (error) {
			console.error("Test execution error:", error);
			
			return {
				statusCode: 500,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Headers": "Content-Type",
					"Access-Control-Allow-Methods": "POST, OPTIONS",
				},
				body: JSON.stringify({
					success: false,
					message: "Test execution failed",
					error: error.message,
				}),
			};
		}
	} catch (error) {
		console.error("Function error:", error);
		return {
			statusCode: 500,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Headers": "Content-Type",
				"Access-Control-Allow-Methods": "POST, OPTIONS",
			},
			body: JSON.stringify({
				success: false,
				message: "Internal server error",
				error: error.message,
			}),
		};
	}
};
