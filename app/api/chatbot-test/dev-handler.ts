// This file is only used in development mode
// It's dynamically imported to prevent Turbopack from analyzing spawn paths
import { NextRequest, NextResponse } from "next/server";

// Dynamic requires to prevent Turbopack static analysis
const getSpawn = () => require("child_process").spawn;
const getPath = () => require("path");

// Build script path at runtime to prevent Turbopack module resolution
function getScriptPath(): string {
	const pathModule = getPath();
	const cwd = process.cwd();
	const parts = ["scripts", "test-chatbot-email-report.js"];
	return pathModule.resolve(cwd, ...parts);
}

export async function runChatbotTest(request: NextRequest): Promise<NextResponse> {
	try {
		const body = await request.json();
		const { emailAddress } = body;

		if (!emailAddress) {
			return NextResponse.json({ success: false, message: "Email address is required" }, { status: 400 });
		}

		process.env.SMTP_TO_EMAIL = emailAddress;

		const scriptPath = getScriptPath();
		console.log("Script path:", scriptPath);
		console.log("Current working directory:", process.cwd());

		const spawn = getSpawn();
		const result = await new Promise<NextResponse>((resolve) => {
			const child = spawn("node", [scriptPath], {
				cwd: process.cwd(),
				env: {
					...process.env,
					SMTP_TO_EMAIL: emailAddress,
					SKIP_SERVER_CHECK: "true",
				},
				stdio: ["pipe", "pipe", "pipe"],
			});

			console.log(`Spawned process with PID: ${child.pid}`);

			let output = "";
			let errorOutput = "";
			let timeoutId: NodeJS.Timeout;

			timeoutId = setTimeout(
				() => {
					child.kill("SIGTERM");
					resolve(
						NextResponse.json(
							{
								success: false,
								message: "Script execution timed out after 5 minutes",
								error: "Timeout",
							},
							{ status: 500 },
						),
					);
				},
				5 * 60 * 1000,
			);

			child.stdout.on("data", (data: Buffer) => {
				output += data.toString();
			});

			child.stderr.on("data", (data: Buffer) => {
				errorOutput += data.toString();
			});

			child.on("close", (code: number | null) => {
				clearTimeout(timeoutId);
				console.log(`Script process closed with code: ${code}`);
				console.log(`Output length: ${output.length} characters`);
				console.log(`Error output length: ${errorOutput.length} characters`);

				if (code !== 0) {
					console.error("Script execution failed with code:", code);
					console.error("Error output:", errorOutput);
					resolve(
						NextResponse.json(
							{
								success: false,
								message: "Script execution failed",
								error: errorOutput || `Process exited with code ${code}`,
								output: output.substring(0, 1000),
							},
							{ status: 500 },
						),
					);
					return;
				}

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

				resolve(
					NextResponse.json({
						success: true,
						message: "Chatbot test completed successfully",
						totalTests,
						passedTests,
						failedTests,
						successRate,
						output: output.substring(0, 1000),
					}),
				);
			});

			child.on("error", (error: Error) => {
				clearTimeout(timeoutId);
				console.error("Script execution error:", error);
				resolve(
					NextResponse.json(
						{
							success: false,
							message: "Script execution failed",
							error: error.message,
						},
						{ status: 500 },
					),
				);
			});
		});

		return result;
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error("API error:", error);
		return NextResponse.json({ success: false, message: "Internal server error", error: errorMessage }, { status: 500 });
	}
}
