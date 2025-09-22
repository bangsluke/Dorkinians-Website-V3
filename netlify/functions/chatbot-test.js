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
		const { emailAddress, maxTests = 15 } = body;

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
			
			// Import and run the random test logic directly
			const testModule = require("./test-chatbot-email-report.js");
			
			// Run the random test function from the test module
			const testResults = await testModule.runRandomTests(maxTests);
			
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
					message: "Random chatbot test completed successfully",
					selectedTests: testResults.selectedTests,
					totalAvailableTests: testResults.totalAvailableTests,
					processedTests: testResults.processedTests,
					passedTests: testResults.passedTests,
					failedTests: testResults.failedTests,
					successRate: testResults.processedTests > 0 ? ((testResults.passedTests / testResults.processedTests) * 100).toFixed(1) + '%' : '0%',
					output: `Random tests completed: ${testResults.passedTests}/${testResults.processedTests} passed (${testResults.selectedTests} selected from ${testResults.totalAvailableTests} available)`,
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
