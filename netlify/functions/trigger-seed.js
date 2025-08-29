const path = require("path");
const fs = require("fs");

// Simple email service implementation for Netlify Functions
class SimpleEmailService {
	constructor() {
		this.config = null;
		this.transporter = null;
	}

	configure() {
		// Try to get email configuration from environment variables
		const emailConfig = {
			host: process.env.SMTP_SERVER,
			port: parseInt(process.env.SMTP_PORT) || 587,
			secure: process.env.SMTP_EMAIL_SECURE === "true",
			auth: {
				user: process.env.SMTP_USERNAME,
				pass: process.env.SMTP_PASSWORD,
			},
			from: process.env.SMTP_FROM_EMAIL,
			to: process.env.SMTP_TO_EMAIL,
		};

		// Check if all required email config is present
		if (emailConfig.host && emailConfig.auth.user && emailConfig.auth.pass && emailConfig.from && emailConfig.to) {
			try {
				const nodemailer = require("nodemailer");
				this.transporter = nodemailer.createTransport({
					host: emailConfig.host,
					port: emailConfig.port,
					secure: emailConfig.secure,
					auth: emailConfig.auth,
					tls: {
						rejectUnauthorized: false,
						checkServerIdentity: () => undefined,
					},
				});
				this.config = emailConfig;
				console.log("📧 Email service configured successfully");
			} catch (error) {
				console.warn("⚠️ Failed to configure email service:", error.message);
			}
		} else {
			console.log("ℹ️ Email service not configured - missing environment variables");
		}
	}

	async sendSeedingStartEmail(environment) {
		if (!this.transporter || !this.config) {
			console.log("Email service not configured, skipping start notification");
			return true;
		}

		try {
			const subject = `🔄 Database Seeding Started - ${environment}`;

			const htmlBody = this.generateSeedingStartEmail(environment);
			const textBody = this.generateSeedingStartEmailText(environment);

			const mailOptions = {
				from: this.config.from,
				to: this.config.to,
				subject: subject,
				html: htmlBody,
				text: textBody,
			};

			const info = await this.transporter.sendMail(mailOptions);
			console.log("📧 Start notification sent successfully:", info.messageId);
			return true;
		} catch (error) {
			console.error("Failed to send start notification:", error.message);
			return false;
		}
	}

	async sendSeedingSummaryEmail(summary) {
		if (!this.transporter || !this.config) {
			console.log("Email service not configured, skipping email notification");
			return true;
		}

		try {
			const subject = `Database Seeding ${summary.success ? "Success" : "Failed"} - ${summary.environment}`;

			// Add finish timestamp if not present
			const summaryWithFinishTime = {
				...summary,
				finishTime: summary.finishTime || new Date().toISOString(),
			};

			const htmlBody = this.generateSeedingSummaryEmail(summaryWithFinishTime);
			const textBody = this.generateSeedingSummaryEmailText(summaryWithFinishTime);

			const mailOptions = {
				from: this.config.from,
				to: this.config.to,
				subject: subject,
				html: htmlBody,
				text: textBody,
			};

			const info = await this.transporter.sendMail(mailOptions);
			console.log("📧 Email sent successfully:", info.messageId);
			return true;
		} catch (error) {
			console.error("Failed to send email:", error.message);
			return false;
		}
	}

	generateSeedingStartEmail(environment) {
		return `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
					.content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
					.info-box { background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff; }
					.footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #666; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>🔄 Database Seeding Started</h1>
						<p>Environment: ${environment.toUpperCase()}</p>
						<p>Timestamp: ${new Date().toLocaleString()}</p>
					</div>
					
					<div class="content">
						<h2>Seeding Process Initiated</h2>
						
						<div class="info-box">
							<h3>What's Happening:</h3>
							<ul>
								<li>✅ Database connection established</li>
								<li>🔄 Processing 10 data sources from Google Sheets</li>
								<li>🗑️ Clearing existing data and applying schema</li>
								<li>📊 Creating nodes and relationships</li>
								<li>📧 You'll receive another email when complete</li>
							</ul>
						</div>
						
						<div class="info-box">
							<h3>Expected Duration:</h3>
							<p>Based on current performance: <strong>~30 minutes</strong></p>
							<p>This process runs on Heroku infrastructure and will continue even if you close this email.</p>
						</div>
						
						<div class="footer">
							<p>This is an automated notification from the Dorkinians Website V3 seeding system.</p>
							<p>Monitor progress via the admin panel or wait for completion email.</p>
						</div>
					</div>
				</div>
			</body>
			</html>
		`;
	}

	generateSeedingStartEmailText(environment) {
		return `
Database Seeding Started
Environment: ${environment.toUpperCase()}
Timestamp: ${new Date().toLocaleString()}

SEEDING PROCESS INITIATED:
✅ Database connection established
🔄 Processing 10 data sources from Google Sheets
🗑️ Clearing existing data and applying schema
📊 Creating nodes and relationships
📧 You'll receive another email when complete

EXPECTED DURATION: ~30 minutes

This process runs on Heroku infrastructure and will continue even if you close this email.

Monitor progress via the admin panel or wait for completion email.

This is an automated notification from the Dorkinians Website V3 seeding system.
		`.trim();
	}

	generateSeedingSummaryEmail(summary) {
		const statusIcon = summary.success ? "✅" : "❌";
		const statusText = summary.success ? "Success" : "Failed";
		const statusColor = summary.success ? "#28a745" : "#dc3545";

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: ${statusColor}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
					.content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
					.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
					.summary-item { background: white; padding: 15px; border-radius: 5px; text-align: center; }
					.summary-number { font-size: 24px; font-weight: bold; color: ${statusColor}; }
					.summary-label { font-size: 14px; color: #666; margin-top: 5px; }
					.error-list { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0; }
					.error-item { margin: 5px 0; padding: 5px; background: white; border-radius: 3px; }
					.footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #666; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>${statusIcon} Database Seeding ${statusText}</h1>
						<p>Environment: ${summary.environment.toUpperCase()}</p>
						<p>Started: ${new Date(summary.timestamp).toLocaleString()}</p>
						<p>Finished: ${new Date(summary.finishTime).toLocaleString()}</p>
					</div>
					
					<div class="content">
						<h2>Seeding Summary</h2>
						
						<div class="summary-grid">
							<div class="summary-item">
								<div class="summary-number">${summary.nodesCreated}</div>
								<div class="summary-label">Nodes Created</div>
							</div>
							<div class="summary-item">
								<div class="summary-number">${summary.relationshipsCreated}</div>
								<div class="summary-label">Relationships Created</div>
							</div>
							<div class="summary-item">
								<div class="summary-number">${summary.errorCount}</div>
								<div class="summary-label">Errors in Log</div>
							</div>
						</div>
						
						${
							summary.errors && summary.errors.length > 0
								? `
							<div class="error-list">
								<h3>Errors Encountered:</h3>
								${summary.errors.map((error) => `<div class="error-item">❌ ${error}</div>`).join("")}
							</div>
						`
								: ""
						}
						
						<div class="footer">
							<p>This is an automated notification from the Dorkinians Website V3 seeding system.</p>
							<p>For detailed error logs, check the Heroku logs.</p>
						</div>
					</div>
				</div>
			</body>
			</html>
		`;
	}

	generateSeedingSummaryEmailText(summary) {
		const statusText = summary.success ? "SUCCESS" : "FAILED";

		return `
Database Seeding ${statusText}
Environment: ${summary.environment.toUpperCase()}
Started: ${new Date(summary.timestamp).toLocaleString()}
Finished: ${new Date(summary.finishTime).toLocaleString()}

SUMMARY:
- Nodes Created: ${summary.nodesCreated}
- Relationships Created: ${summary.relationshipsCreated}
- Errors in Log: ${summary.errorCount}

${
	summary.errors && summary.errors.length > 0
		? `
ERRORS ENCOUNTERED:
${summary.errors.map((error) => `- ${error}`).join("\n")}
`
		: ""
}

This is an automated notification from the Dorkinians Website V3 seeding system.
For detailed error logs, check the Heroku logs.
		`.trim();
	}
}

// Initialize services
const emailService = new SimpleEmailService();

exports.handler = async (event, context) => {
	const headers = {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Allow-Methods": "POST, OPTIONS",
	};

	// Handle preflight requests
	if (event.httpMethod === "OPTIONS") {
		return {
			statusCode: 200,
			headers,
			body: "",
		};
	}

	// Only allow POST requests
	if (event.httpMethod !== "POST") {
		return {
			statusCode: 405,
			headers,
			body: JSON.stringify({ error: "Method not allowed" }),
		};
	}

	try {
		// Force production environment for security
		const environment = "production";
		console.log(`🚀 TRIGGER: Enforcing production environment for database seeding`);

		// Generate unique job ID
		const jobId = `seed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		console.log("🆔 TRIGGER: Generated job ID:", jobId);

		// Configure email service with environment variables (available during execution)
		console.log("📧 EMAIL: Configuring email service...");
		emailService.configure();

		// Note: Start notification is sent by Heroku service after seeding begins
		console.log("📧 START: Start notification will be sent by Heroku service");

		// Trigger Heroku seeding service (fire-and-forget)
		console.log("🌱 HEROKU: Starting Heroku seeding service...");
		const herokuUrl = process.env.HEROKU_SEEDER_URL || "https://database-dorkinians-4bac3364a645.herokuapp.com";
		const cleanHerokuUrl = herokuUrl.replace(/\/$/, "");
		const fullUrl = `${cleanHerokuUrl}/seed`;
		console.log("🔗 HEROKU: Full URL being called:", fullUrl);
		console.log("🔗 HEROKU: Environment variable HEROKU_SEEDER_URL:", process.env.HEROKU_SEEDER_URL);

		// Fire-and-forget: don't wait for response to prevent timeout
		console.log("🌱 HEROKU: Making POST request to:", fullUrl);
		console.log("🌱 HEROKU: Request payload:", JSON.stringify({ environment, jobId }));

		// Enhanced fetch with timeout and retry logic
		const fetchWithTimeout = async (url, options, timeout = 30000) => {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);

			try {
				const response = await fetch(url, {
					...options,
					signal: controller.signal,
				});
				clearTimeout(timeoutId);
				return response;
			} catch (error) {
				clearTimeout(timeoutId);
				throw error;
			}
		};

		// Attempt to call Heroku with retry logic
		const callHeroku = async (retryCount = 0, maxRetries = 3) => {
			try {
				console.log(`🌱 HEROKU: Attempt ${retryCount + 1}/${maxRetries + 1} to call Heroku...`);

				const response = await fetchWithTimeout(
					fullUrl,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"User-Agent": "Netlify-Function/1.0",
						},
						body: JSON.stringify({
							environment,
							jobId,
						}),
					},
					30000,
				); // 30 second timeout

				console.log("🌱 HEROKU: Response received - Status:", response.status);
				console.log("🌱 HEROKU: Response headers:", Object.fromEntries(response.headers.entries()));

				if (response.ok) {
					const responseBody = await response.text();
					console.log("✅ HEROKU: Heroku seeding service started successfully");
					console.log("✅ HEROKU: Response body:", responseBody);
					return true;
				} else {
					const responseBody = await response.text();
					console.warn("⚠️ HEROKU: Heroku seeding service may have failed to start");
					console.warn("⚠️ HEROKU: Response status:", response.status);
					console.warn("⚠️ HEROKU: Response status text:", response.statusText);
					console.warn("⚠️ HEROKU: Response body:", responseBody);
					return false;
				}
			} catch (error) {
				console.error(`❌ HEROKU: Attempt ${retryCount + 1} failed:`, error.message);

				if (retryCount < maxRetries) {
					const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
					console.log(`🔄 HEROKU: Retrying in ${delay}ms...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
					return callHeroku(retryCount + 1, maxRetries);
				} else {
					console.error("❌ HEROKU: All retry attempts failed");
					console.error("❌ HEROKU: Final error details:", {
						name: error.name,
						message: error.message,
						stack: error.stack,
						code: error.code,
					});
					return false;
				}
			}
		};

		// Start the Heroku call process
		callHeroku()
			.then((success) => {
				if (success) {
					console.log("✅ HEROKU: Successfully communicated with Heroku");
				} else {
					console.error("❌ HEROKU: Failed to communicate with Heroku after all retries");
				}
			})
			.catch((error) => {
				console.error("❌ HEROKU: Unexpected error in callHeroku:", error);
			});

		// Add a small delay to allow the Heroku call to start
		console.log("⏳ HEROKU: Allowing time for Heroku call to initiate...");
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Return immediate response
		console.log("✅ SUCCESS: Returning immediate response");
		return {
			statusCode: 200,
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({
				success: true,
				message: "Database seeding started on Heroku",
				environment,
				jobId,
				timestamp: new Date().toISOString(),
				status: "started",
				note: "Seeding is running on Heroku. Check email for start and completion notifications.",
				herokuUrl: process.env.HEROKU_SEEDER_URL || "https://database-dorkinians-4bac3364a645.herokuapp.com",
			}),
		};
	} catch (error) {
		console.error("❌ ERROR: Main execution error:", error);
		console.error("❌ ERROR: Stack trace:", error.stack);

		// Send failure notification
		console.log("📧 FAILURE: Attempting to send failure notification...");
		try {
			await emailService.sendSeedingSummaryEmail({
				success: false,
				environment: "production", // Always production for failure
				jobId: "unknown",
				nodesCreated: 0,
				relationshipsCreated: 0,
				errorCount: 1,
				errors: [error.message],
				duration: 0,
			});
			console.log("✅ FAILURE: Failure notification sent successfully");
		} catch (emailError) {
			console.warn("⚠️ FAILURE: Failed to send failure email:", emailError);
		}

		return {
			statusCode: 500,
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({
				error: "Failed to start database seeding",
				message: error.message,
				timestamp: new Date().toISOString(),
			}),
		};
	}
};
