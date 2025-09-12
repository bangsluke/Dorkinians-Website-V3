const { execSync } = require("child_process");
const path = require("path");

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
		const { emailAddress } = body;

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

		// Run the chatbot test script
		const scriptPath = path.join(process.cwd(), "scripts", "test-chatbot-email-report.js");

		try {
			const output = execSync(`node "${scriptPath}"`, {
				encoding: "utf8",
				cwd: process.cwd(),
				stdio: "pipe",
				maxBuffer: 1024 * 1024 * 10, // 10MB buffer
				env: {
					...process.env,
					SMTP_TO_EMAIL: emailAddress,
				},
			});

			// Parse the output to extract test results
			const lines = output.split("\n");
			let totalTests = 0;
			let passedTests = 0;
			let failedTests = 0;
			let successRate = 0;

			for (const line of lines) {
				if (line.includes("Total Tests:")) {
					const match = line.match(/Total Tests: (\d+)/);
					if (match) totalTests = parseInt(match[1]);
				}
				if (line.includes("Passed:")) {
					const match = line.match(/Passed: (\d+)/);
					if (match) passedTests = parseInt(match[1]);
				}
				if (line.includes("Failed:")) {
					const match = line.match(/Failed: (\d+)/);
					if (match) failedTests = parseInt(match[1]);
				}
				if (line.includes("Success Rate:")) {
					const match = line.match(/Success Rate: ([\d.]+)%/);
					if (match) successRate = parseFloat(match[1]);
				}
			}

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
					message: "Chatbot test completed successfully",
					totalTests,
					passedTests,
					failedTests,
					successRate,
					output: output.substring(0, 1000), // First 1000 chars for debugging
				}),
			};
		} catch (error) {
			console.error("Script execution error:", error);

			// Check if the script actually ran successfully but just had failed tests
			if (error.stdout && error.stdout.includes("Email report sent successfully")) {
				// Script ran successfully, parse the output even though exit code was non-zero
				const lines = error.stdout.split("\n");
				let totalTests = 0;
				let passedTests = 0;
				let failedTests = 0;
				let successRate = 0;

				for (const line of lines) {
					if (line.includes("Total Tests:")) {
						const match = line.match(/Total Tests: (\d+)/);
						if (match) totalTests = parseInt(match[1]);
					}
					if (line.includes("Passed:")) {
						const match = line.match(/Passed: (\d+)/);
						if (match) passedTests = parseInt(match[1]);
					}
					if (line.includes("Failed:")) {
						const match = line.match(/Failed: (\d+)/);
						if (match) failedTests = parseInt(match[1]);
					}
					if (line.includes("Success Rate:")) {
						const match = line.match(/Success Rate: ([\d.]+)%/);
						if (match) successRate = parseFloat(match[1]);
					}
				}

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
						message: "Chatbot test completed successfully",
						totalTests,
						passedTests,
						failedTests,
						successRate,
						output: error.stdout.substring(0, 1000), // First 1000 chars for debugging
					}),
				};
			}

			// Real error occurred
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
					message: "Script execution failed",
					error: error.message,
					stderr: error.stderr?.toString() || "",
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
