const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Use built-in http module for making requests
const http = require("http");
const https = require("https");
const fs = require("fs");

function makeRequest(url, options = {}) {
	return new Promise((resolve, reject) => {
		const urlObj = new URL(url);
		const isHttps = urlObj.protocol === "https:";
		const client = isHttps ? https : http;

		const requestOptions = {
			hostname: urlObj.hostname,
			port: urlObj.port,
			path: urlObj.pathname + urlObj.search,
			method: options.method || "GET",
			headers: options.headers || {},
		};

		if (options.body) {
			requestOptions.headers["Content-Type"] = "application/json";
			requestOptions.headers["Content-Length"] = Buffer.byteLength(options.body);
		}

		const req = client.request(requestOptions, (res) => {
			let data = "";
			res.on("data", (chunk) => {
				data += chunk;
			});
			res.on("end", () => {
				resolve({
					ok: res.statusCode >= 200 && res.statusCode < 300,
					status: res.statusCode,
					json: () => JSON.parse(data),
					text: () => data,
				});
			});
		});

		req.on("error", (error) => {
			reject(error);
		});

		if (options.body) {
			req.write(options.body);
		}

		req.end();
	});
}

function countErrorsFromLog() {
	try {
		const logPath = path.join(__dirname, "..", "logs", "seeding-errors.log");
		if (!fs.existsSync(logPath)) {
			return 0;
		}

		const logContent = fs.readFileSync(logPath, "utf8");
		const lines = logContent.split("\n");
		
		// Count lines that contain actual error details (not timestamps or separators)
		let errorCount = 0;
		for (const line of lines) {
			if (line.trim() && 
				!line.startsWith("===") && 
				!line.startsWith("[") && 
				!line.startsWith("Details:") &&
				!line.startsWith("}")) {
				errorCount++;
			}
		}
		
		return errorCount;
	} catch (error) {
		console.warn(`⚠️ Could not read error log: ${error.message}`);
		return 0;
	}
}

const { dataSources } = require("../lib/config/dataSources");

// Add maxRows to each data source for reduced seeding
const REDUCED_DATA_SOURCES = dataSources.map(source => ({
	...source,
	maxRows: 100 // Limit to 100 rows per source for testing
}));

// Unified database seeding script that works with both development and production
async function seedDatabase() {
	// Start timing
	const startTime = Date.now();
	
	try {
		console.log("🌱 Starting reduced database seeding process...");
		console.log("📊 REDUCED MODE: Processing up to 100 rows per table for testing");

		// Make request to the seeding API
		const apiUrl = "http://localhost:3000/api/seed-data/";
		const response = await makeRequest(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				dataSources: REDUCED_DATA_SOURCES,
				reducedMode: true, // Flag to indicate reduced seeding mode
			}),
		});

		if (response.ok) {
			const result = await response.json();
			console.log("✅ Database seeding completed successfully!");
			console.log(`📊 Result:`, result);

			if (result.success) {
				console.log(`📊 Nodes created: ${result.nodesCreated}`);
				console.log(`🔗 Relationships created: ${result.relationshipsCreated}`);
				console.log(`⚠️ Errors: ${result.errors.length}`);
				console.log(`❓ Unknown nodes: ${result.unknownNodes.length}`);

				if (result.errors.length > 0) {
					console.log("\n❌ Errors encountered:");
					result.errors.forEach((error, index) => {
						console.log(`  ${index + 1}. ${error}`);
					});
				}

				if (result.unknownNodes.length > 0) {
					console.log("\n❓ Unknown nodes encountered:");
					result.unknownNodes.forEach((node, index) => {
						console.log(`  ${index + 1}. ${node}`);
					});
				}

				// Send email notification
				console.log("\n📧 Sending seeding summary email...");
				try {
					const { emailService } = require("../lib/services/emailService");
					const { getEmailConfig } = require("../lib/config/emailConfig");
					
					const emailConfig = getEmailConfig();
					if (emailConfig) {
						emailService.configure(emailConfig);
						
						const errorCount = countErrorsFromLog();
						const duration = Math.floor((Date.now() - startTime) / 1000);
						
						const summary = {
							environment: "development (reduced)",
							nodesCreated: result.nodesCreated,
							relationshipsCreated: result.relationshipsCreated,
							duration: duration,
							errorCount: errorCount,
							timestamp: new Date().toISOString(),
							success: true
						};
						
						await emailService.sendSeedingSummary(summary);
						console.log("✅ Seeding summary email sent successfully");
					} else {
						console.log("⚠️ Email service not configured - skipping email notification");
					}
				} catch (emailError) {
					console.warn(`⚠️ Failed to send seeding summary email: ${emailError.message}`);
				}
			} else {
				console.log("⚠️ Seeding completed with errors:", result.errors);
				
				// Send email notification for seeding with errors
				console.log("\n📧 Sending seeding summary email...");
				try {
					const { emailService } = require("../lib/services/emailService");
					const { getEmailConfig } = require("../lib/config/emailConfig");
					
					const emailConfig = getEmailConfig();
					if (emailConfig) {
						emailService.configure(emailConfig);
						
						const errorCount = countErrorsFromLog();
						const duration = Math.floor((Date.now() - startTime) / 1000);
						
						const summary = {
							environment: "development (reduced)",
							nodesCreated: result.nodesCreated || 0,
							relationshipsCreated: result.relationshipsCreated || 0,
							duration: duration,
							errorCount: errorCount,
							timestamp: new Date().toISOString(),
							success: false,
							errors: result.errors
						};
						
						await emailService.sendSeedingSummary(summary);
						console.log("✅ Seeding summary email sent successfully");
					} else {
						console.log("⚠️ Email service not configured - skipping email notification");
					}
				} catch (emailError) {
					console.warn(`⚠️ Failed to send seeding summary email: ${emailError.message}`);
				}
			}
		} else {
			const errorText = await response.text();
			console.error("❌ Database seeding failed:", response.status, errorText);
			
			// Send email notification for complete seeding failure
			console.log("\n📧 Sending seeding summary email...");
			try {
				const { emailService } = require("../lib/services/emailService");
				const { getEmailConfig } = require("../lib/config/emailConfig");
				
				const emailConfig = getEmailConfig();
				if (emailConfig) {
					emailService.configure(emailConfig);
					
					const errorCount = countErrorsFromLog();
					const duration = Math.floor((Date.now() - startTime) / 1000);
					
					const summary = {
						environment: "development (reduced)",
						nodesCreated: 0,
						relationshipsCreated: 0,
						duration: duration,
						errorCount: errorCount,
						timestamp: new Date().toISOString(),
						success: false,
						errors: [`API call failed with status ${response.status}: ${errorText}`]
					};
					
					await emailService.sendSeedingSummary(summary);
					console.log("✅ Seeding summary email sent successfully");
				} else {
					console.log("⚠️ Email service not configured - skipping email notification");
				}
			} catch (emailError) {
				console.warn(`⚠️ Failed to send seeding summary email: ${emailError.message}`);
			}
			
			process.exit(1);
		}
		
		// Calculate and display timing
		const endTime = Date.now();
		const duration = endTime - startTime;
		const minutes = Math.floor(duration / 60000);
		const seconds = Math.floor((duration % 60000) / 1000);
		const milliseconds = duration % 1000;
		
		console.log(`\n⏱️  Seeding Duration: ${minutes > 0 ? minutes + 'm ' : ''}${seconds}s ${milliseconds}ms`);
	} catch (error) {
		// Calculate timing even on error
		const endTime = Date.now();
		const duration = endTime - startTime;
		const minutes = Math.floor(duration / 60000);
		const seconds = Math.floor((duration % 60000) / 1000);
		const milliseconds = duration % 1000;
		
		console.log(`\n⏱️  Seeding Duration: ${minutes > 0 ? minutes + 'm ' : ''}${seconds}s ${milliseconds}ms`);
		console.error("❌ Error during database seeding:", error);
		
		// Send email notification for complete seeding failure
		console.log("\n📧 Sending seeding summary email...");
		try {
			const { emailService } = require("../lib/services/emailService");
			const { getEmailConfig } = require("../lib/config/emailConfig");
			
			const emailConfig = getEmailConfig();
			if (emailConfig) {
				emailService.configure(emailConfig);
				
				const errorCount = countErrorsFromLog();
				const durationSeconds = Math.floor(duration / 1000);
				
				const summary = {
					environment: "development (reduced)",
					nodesCreated: 0,
					relationshipsCreated: 0,
					duration: durationSeconds,
					errorCount: errorCount,
					timestamp: new Date().toISOString(),
					success: false,
					errors: [`Seeding process failed with exception: ${error.message}`]
				};
				
				await emailService.sendSeedingSummary(summary);
				console.log("✅ Seeding summary email sent successfully");
			} else {
				console.log("⚠️ Email service not configured - skipping email notification");
			}
		} catch (emailError) {
			console.warn(`⚠️ Failed to send seeding summary email: ${emailError.message}`);
		}
		
		process.exit(1);
	}
}

// Run the seeding
seedDatabase();
