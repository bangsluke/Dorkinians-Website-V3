// Netlify function to trigger E2E tests with email notifications
const { execSync } = require('child_process');
const path = require('path');

exports.handler = async (event, context) => {
	const headers = {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	};

	// Handle preflight requests
	if (event.httpMethod === "OPTIONS") {
		return {
			statusCode: 200,
			headers,
			body: "",
		};
	}

	// Only allow GET and POST requests
	if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
		return {
			statusCode: 405,
			headers,
			body: JSON.stringify({ error: "Method not allowed" }),
		};
	}

	try {
		console.log("🚀 E2E Tests: Starting E2E test execution via Netlify function");
		
		// Set environment variables for test execution
		const BASE_URL = process.env.BASE_URL || 'https://dorkinians-website-v3.netlify.app';
		const HEADLESS = process.env.HEADLESS !== 'false';
		
		console.log(`📍 E2E Tests: Base URL: ${BASE_URL}`);
		console.log(`🎭 E2E Tests: Headless: ${HEADLESS}`);
		
		// Get the path to the test script
		// In Netlify functions, we need to use the correct path
		// The function runs from the netlify/functions directory
		const projectRoot = path.resolve(__dirname, '../..');
		const testScriptPath = path.join(projectRoot, '__tests__', 'e2e', 'scripts', 'test-e2e-email-report.js');
		
		console.log(`📝 E2E Tests: Executing test script: ${testScriptPath}`);
		
		// Execute the test script
		// Note: This will block until tests complete (5-10 minutes expected)
		// The script handles email notifications internally
		let testOutput = '';
		let exitCode = 0;
		let testPassed = false;
		
		try {
			const result = execSync(`node "${testScriptPath}"`, {
				stdio: 'pipe',
				env: {
					...process.env,
					BASE_URL,
					HEADLESS: HEADLESS ? 'true' : 'false',
				},
				cwd: projectRoot,
				encoding: 'utf8',
				maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large test outputs
			});
			
			testOutput = result.toString();
			testPassed = true;
			exitCode = 0;
			
			console.log("✅ E2E Tests: Test execution completed successfully");
		} catch (error) {
			const stdout = error.stdout?.toString() || '';
			const stderr = error.stderr?.toString() || '';
			testOutput = stdout + (stderr ? '\n' + stderr : '') || error.message || 'Test execution failed';
			testPassed = false;
			exitCode = error.status || 1;
			
			console.error("❌ E2E Tests: Test execution failed");
			console.error("❌ E2E Tests: Error:", error.message);
		}
		
		// Parse test summary from output
		const passedMatch = testOutput.match(/(\d+)\s+passed/i);
		const failedMatch = testOutput.match(/(\d+)\s+failed/i);
		const skippedMatch = testOutput.match(/(\d+)\s+skipped/i);
		
		const summary = {
			passed: passedMatch ? parseInt(passedMatch[1], 10) : 0,
			failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
			skipped: skippedMatch ? parseInt(skippedMatch[1], 10) : 0,
			total: 0,
		};
		summary.total = summary.passed + summary.failed + summary.skipped;
		
		// Return response
		return {
			statusCode: testPassed ? 200 : 500,
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({
				success: testPassed,
				message: testPassed 
					? "E2E tests completed successfully. Email notification sent." 
					: "E2E tests failed. Email notification sent with details.",
				summary: {
					passed: summary.passed,
					failed: summary.failed,
					skipped: summary.skipped,
					total: summary.total,
					passRate: summary.total > 0 
						? ((summary.passed / summary.total) * 100).toFixed(1) + '%'
						: '0%',
				},
				baseUrl: BASE_URL,
				timestamp: new Date().toISOString(),
				note: "Email notification has been sent with detailed test results and screenshots (if any failures occurred).",
				output: testOutput.substring(0, 1000) + (testOutput.length > 1000 ? '\n\n... (truncated)' : ''),
			}),
		};
	} catch (error) {
		console.error("❌ E2E Tests: Function execution error:", error);
		console.error("❌ E2E Tests: Stack trace:", error.stack);
		
		return {
			statusCode: 500,
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({
				success: false,
				error: "Failed to execute E2E tests",
				message: error.message,
				timestamp: new Date().toISOString(),
			}),
		};
	}
};
