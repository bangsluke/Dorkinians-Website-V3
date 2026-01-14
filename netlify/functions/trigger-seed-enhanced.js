// Enhanced trigger-seed function with Heroku health check and immediate failure notifications
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
				this.transporter = nodemailer.createTransporter({
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

	async sendCriticalFailureEmail(environment, jobId, errorDetails) {
		if (!this.transporter || !this.config) {
			console.log("🚨 CRITICAL FAILURE - Email service not configured, cannot send notification");
			console.log("🚨 CRITICAL FAILURE DETAILS:", errorDetails);
			return false;
		}

		try {
			const subject = `🚨 CRITICAL FAILURE - Heroku App Down - Database Seeder`;
			const htmlBody = this.generateCriticalFailureEmail(environment, jobId, errorDetails);
			const textBody = this.generateCriticalFailureEmailText(environment, jobId, errorDetails);

			const mailOptions = {
				from: this.config.from,
				to: this.config.to,
				subject: subject,
				html: htmlBody,
				text: textBody,
				priority: 'high'
			};

			const info = await this.transporter.sendMail(mailOptions);
			console.log("📧 Critical failure email sent successfully:", info.messageId);
			return true;
		} catch (error) {
			console.error("🚨 FAILED to send critical failure email:", error.message);
			console.error("🚨 ORIGINAL CRITICAL FAILURE:", errorDetails);
			return false;
		}
	}

	generateCriticalFailureEmail(environment, jobId, errorDetails) {
		return `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<title>CRITICAL FAILURE - Heroku App Down</title>
		</head>
		<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
			<div style="background: #dc3545; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
				<h1 style="margin: 0; font-size: 24px;">🚨 CRITICAL FAILURE - Heroku App Down</h1>
				<p style="margin: 10px 0 0 0; font-size: 16px;">Database Seeder Service Unavailable</p>
			</div>
			
			<div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
				<h2 style="margin-top: 0; color: #dc3545;">Failure Details</h2>
				<table style="width: 100%; border-collapse: collapse;">
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold; width: 150px;">Environment:</td>
						<td style="padding: 8px; border: 1px solid #ddd;">${environment}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold;">Job ID:</td>
						<td style="padding: 8px; border: 1px solid #ddd;">${jobId}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold;">Timestamp:</td>
						<td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleString()}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold;">Error Type:</td>
						<td style="padding: 8px; border: 1px solid #ddd;">Heroku Application Down</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold;">Status Code:</td>
						<td style="padding: 8px; border: 1px solid #ddd; color: #dc3545; font-weight: bold;">${errorDetails.statusCode || 'Unknown'}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold;">Error Message:</td>
						<td style="padding: 8px; border: 1px solid #ddd; word-break: break-word;">${errorDetails.message || 'Heroku application is not responding'}</td>
					</tr>
				</table>
			</div>
			
			<div style="background: #fff3cd; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
				<h3 style="margin-top: 0; color: #856404;">What This Means</h3>
				<ul style="margin: 0; padding-left: 20px;">
					<li>The Heroku database seeder application is completely down</li>
					<li>No seeding jobs can be started or processed</li>
					<li>All database operations are unavailable</li>
					<li>This is a critical infrastructure failure</li>
				</ul>
			</div>
			
			<div style="background: #d1ecf1; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
				<h3 style="margin-top: 0; color: #0c5460;">Immediate Actions Required</h3>
				<ul style="margin: 0; padding-left: 20px;">
					<li>Check Heroku dashboard for application status</li>
					<li>Review Heroku logs for crash details</li>
					<li>Restart the Heroku application if possible</li>
					<li>Check for memory or resource issues</li>
					<li>Verify environment variables and configuration</li>
					<li>Consider scaling up Heroku dynos if needed</li>
				</ul>
			</div>
			
			<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; font-size: 14px; color: #6c757d;">
				<p style="margin: 0;"><strong>Service:</strong> Dorkinians Database Seeder</p>
				<p style="margin: 5px 0 0 0;"><strong>Environment:</strong> ${environment}</p>
				<p style="margin: 5px 0 0 0;"><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
			</div>
		</body>
		</html>
		`;
	}

	generateCriticalFailureEmailText(environment, jobId, errorDetails) {
		return `
🚨 CRITICAL FAILURE - Heroku App Down
Database Seeder Service Unavailable

Failure Details:
- Environment: ${environment}
- Job ID: ${jobId}
- Timestamp: ${new Date().toLocaleString()}
- Error Type: Heroku Application Down
- Status Code: ${errorDetails.statusCode || 'Unknown'}
- Error Message: ${errorDetails.message || 'Heroku application is not responding'}

What This Means:
- The Heroku database seeder application is completely down
- No seeding jobs can be started or processed
- All database operations are unavailable
- This is a critical infrastructure failure

Immediate Actions Required:
- Check Heroku dashboard for application status
- Review Heroku logs for crash details
- Restart the Heroku application if possible
- Check for memory or resource issues
- Verify environment variables and configuration
- Consider scaling up Heroku dynos if needed

Service: Dorkinians Database Seeder
Environment: ${environment}
Generated: ${new Date().toLocaleString()}
		`;
	}

	// ... (include all other existing methods from the original file)
}

// Initialize services
const emailService = new SimpleEmailService();

// Enhanced Heroku health check function
const checkHerokuHealth = async (herokuUrl, timeout = 10000) => {
	console.log(`🏥 HEALTH CHECK: Checking Heroku app health at ${herokuUrl}`);
	
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const response = await fetch(`${herokuUrl}/health`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Netlify-Function-HealthCheck/1.0'
			},
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (response.ok) {
			const healthData = await response.json();
			console.log(`✅ HEALTH CHECK: Heroku app is healthy - ${healthData.status}`);
			return { healthy: true, data: healthData };
		} else {
			console.error(`❌ HEALTH CHECK: Heroku app unhealthy - Status: ${response.status}`);
			return { 
				healthy: false, 
				error: `HTTP ${response.status}`, 
				statusCode: response.status,
				message: `Heroku app returned ${response.status} status`
			};
		}
	} catch (error) {
		console.error(`❌ HEALTH CHECK: Heroku app check failed:`, error.message);
		return { 
			healthy: false, 
			error: error.message,
			statusCode: error.name === 'AbortError' ? 408 : 500,
			message: `Heroku app is not responding: ${error.message}`
		};
	}
};

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

		// Parse request body to get email configuration
		let requestBody = {};
		try {
			requestBody = JSON.parse(event.body || "{}");
		} catch (error) {
			console.warn("⚠️ TRIGGER: Failed to parse request body:", error.message);
		}

		const emailConfig = requestBody.emailConfig || {};

		// Detect if this is a cron job call (no email config) and set defaults
		const isCronJob = !requestBody.emailConfig || Object.keys(requestBody.emailConfig).length === 0;
		if (isCronJob) {
			console.log("🕐 TRIGGER: Detected cron job call - setting default email configuration");
			emailConfig.emailAddress = "bangsluke@gmail.com";
			emailConfig.sendEmailAtStart = false;
			emailConfig.sendEmailAtCompletion = true;
		}

		console.log("📧 TRIGGER: Final email configuration:", emailConfig);

		// Generate unique job ID
		const jobId = `seed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		console.log("🆔 TRIGGER: Generated job ID:", jobId);

		// Configure email service with environment variables (available during execution)
		console.log("📧 EMAIL: Configuring email service...");
		emailService.configure();

		// Get Heroku URL
		const herokuUrl = process.env.HEROKU_SEEDER_URL || "https://dorkinians-database-v3-0e9a731483c7.herokuapp.com/";
		const cleanHerokuUrl = herokuUrl.replace(/\/+$/, "");

		// CRITICAL: Check Heroku health BEFORE attempting to start seeding
		console.log("🏥 HEALTH CHECK: Performing pre-flight health check...");
		const healthCheck = await checkHerokuHealth(cleanHerokuUrl, 10000); // 10 second timeout

		if (!healthCheck.healthy) {
			console.error("🚨 CRITICAL: Heroku app is down or unhealthy");
			console.error("🚨 CRITICAL: Health check failed:", healthCheck);

			// Send immediate critical failure notification
			try {
				await emailService.sendCriticalFailureEmail(environment, jobId, {
					statusCode: healthCheck.statusCode,
					message: healthCheck.message,
					error: healthCheck.error,
					healthCheckData: healthCheck
				});
				console.log("✅ CRITICAL: Critical failure notification sent");
			} catch (emailError) {
				console.error("❌ CRITICAL: Failed to send critical failure notification:", emailError.message);
			}

			// Return error response to user
			return {
				statusCode: 503,
				headers: { ...headers, "Content-Type": "application/json" },
				body: JSON.stringify({
					success: false,
					error: "CRITICAL: Heroku application is down or unhealthy",
					message: "The database seeding service is currently unavailable. Check your email for detailed failure notification.",
					environment,
					jobId,
					timestamp: new Date().toISOString(),
					status: "failed",
					healthCheck: healthCheck,
					note: "Heroku app health check failed. Service is down."
				}),
			};
		}

		console.log("✅ HEALTH CHECK: Heroku app is healthy, proceeding with seeding...");

		// Send start notification if requested
		if (emailConfig.sendEmailAtStart && emailConfig.emailAddress) {
			console.log("📧 START: Sending start notification email...");
			try {
				const originalTo = emailService.config?.to;
				if (emailService.config) {
					emailService.config.to = emailConfig.emailAddress;
				}

				const startEmailSent = await emailService.sendSeedingStartEmail(environment);
				if (startEmailSent) {
					console.log("✅ START: Start notification email sent successfully");
				} else {
					console.warn("⚠️ START: Failed to send start notification email");
				}

				if (emailService.config && originalTo) {
					emailService.config.to = originalTo;
				}
			} catch (error) {
				console.error("❌ START: Error sending start notification email:", error.message);
			}
		}

		// Trigger Heroku seeding service (now that we know it's healthy)
		console.log("🌱 HEROKU: Starting Heroku seeding service...");
		const fullUrl = `${cleanHerokuUrl}/seed`;

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

				// Security: Include API key for authentication
				const seedApiKey = process.env.SEED_API_KEY;
				if (!seedApiKey) {
					console.error("❌ SECURITY: SEED_API_KEY not configured");
					throw new Error("API key not configured");
				}

				// Get origin for CORS validation
				const origin = process.env.ALLOWED_ORIGIN || "https://dorkinians-website-v3.netlify.app";

				const response = await fetchWithTimeout(
					fullUrl,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"User-Agent": "Netlify-Function/1.0",
							"X-API-Key": seedApiKey,
							"Origin": origin,
						},
						body: JSON.stringify({
							environment,
							jobId,
							emailConfig: {
								emailAddress: emailConfig.emailAddress || "bangsluke@gmail.com",
								sendEmailAtStart: emailConfig.sendEmailAtStart || false,
								sendEmailAtCompletion: emailConfig.sendEmailAtCompletion || true,
							},
						}),
					},
					30000,
				);

				console.log("🌱 HEROKU: Response received - Status:", response.status);

				if (response.ok) {
					const responseBody = await response.text();
					console.log("✅ HEROKU: Heroku seeding service started successfully");
					console.log("✅ HEROKU: Response body:", responseBody);
					return true;
				} else {
					const responseBody = await response.text();
					console.warn("⚠️ HEROKU: Heroku seeding service may have failed to start");
					console.warn("⚠️ HEROKU: Response status:", response.status);
					console.warn("⚠️ HEROKU: Response body:", responseBody);
					return false;
				}
			} catch (error) {
				console.error(`❌ HEROKU: Attempt ${retryCount + 1} failed:`, error.message);

				if (retryCount < maxRetries) {
					const delay = Math.pow(2, retryCount) * 1000;
					console.log(`🔄 HEROKU: Retrying in ${delay}ms...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
					return callHeroku(retryCount + 1, maxRetries);
				} else {
					console.error("❌ HEROKU: All retry attempts failed");
					throw error;
				}
			}
		};

		// Call Heroku and wait for response
		const herokuStarted = await callHeroku();
		
		if (!herokuStarted) {
			console.error("❌ CRITICAL: Heroku seeding service failed to start after all retry attempts");
			
			// Send critical failure notification
			try {
				await emailService.sendCriticalFailureEmail(environment, jobId, {
					statusCode: 500,
					message: "Failed to start Heroku seeding service after all retry attempts",
					error: "Heroku service call failed"
				});
				console.log("✅ CRITICAL: Critical failure notification sent");
			} catch (emailError) {
				console.error("❌ CRITICAL: Failed to send critical failure notification:", emailError.message);
			}
			
			return {
				statusCode: 500,
				headers: { ...headers, "Content-Type": "application/json" },
				body: JSON.stringify({
					success: false,
					error: "CRITICAL: Failed to start Heroku seeding service after all retry attempts",
					message: "The seeding service could not be started. This is a critical failure.",
					environment,
					jobId,
					timestamp: new Date().toISOString(),
					status: "failed",
					note: "Check your email for detailed failure notification."
				}),
			};
		}

		// Return immediate response
		console.log("✅ SUCCESS: Returning immediate response");
		return {
			statusCode: 200,
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({
				success: true,
				message: "Database seeding started on Heroku with monitoring",
				environment,
				jobId,
				timestamp: new Date().toISOString(),
				status: "started",
				note: "Seeding is running on Heroku with background monitoring. Check email for completion notification.",
				herokuUrl: cleanHerokuUrl,
				healthCheck: {
					passed: true,
					checkedAt: new Date().toISOString()
				}
			}),
		};
	} catch (error) {
		console.error("❌ ERROR: Main execution error:", error);
		console.error("❌ ERROR: Stack trace:", error.stack);

		// Send failure notification
		console.log("📧 FAILURE: Attempting to send failure notification...");
		try {
			await emailService.sendCriticalFailureEmail("production", "unknown", {
				statusCode: 500,
				message: error.message,
				error: error.stack
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