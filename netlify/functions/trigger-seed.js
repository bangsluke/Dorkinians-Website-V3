// Enhanced trigger-seed function with comprehensive monitoring
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
				const createTransport = nodemailer.default?.createTransport ?? nodemailer.createTransport;
				if (typeof createTransport !== "function") {
					console.warn("⚠️ nodemailer.createTransport not available:", typeof nodemailer, typeof nodemailer?.default);
				} else {
					this.transporter = createTransport({
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
				}
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
			console.log("📧 Summary email sent successfully:", info.messageId);
			return true;
		} catch (error) {
			console.error("Failed to send summary email:", error.message);
			return false;
		}
	}

	async sendCriticalErrorNotification(errorInfo) {
		if (!this.transporter || !this.config) {
			console.log("🚨 CRITICAL ERROR - Email service not configured, cannot send notification");
			console.log("🚨 CRITICAL ERROR DETAILS:", errorInfo);
			return false;
		}

		try {
			const subject = `🚨 CRITICAL ERROR - Database Seeder - ${errorInfo.errorType}`;
			const htmlBody = this.generateCriticalErrorEmail(errorInfo);
			const textBody = this.generateCriticalErrorEmailText(errorInfo);

			const mailOptions = {
				from: this.config.from,
				to: this.config.to,
				subject: subject,
				html: htmlBody,
				text: textBody,
				priority: 'high'
			};

			const info = await this.transporter.sendMail(mailOptions);
			console.log("📧 Critical error email sent successfully:", info.messageId);
			return true;
		} catch (error) {
			console.error("🚨 FAILED to send critical error email:", error.message);
			console.error("🚨 ORIGINAL CRITICAL ERROR:", errorInfo);
			return false;
		}
	}

	generateSeedingStartEmail(environment) {
		return `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<title>Database Seeding Started</title>
		</head>
		<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
			<div style="background: #007bff; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
				<h1 style="margin: 0; font-size: 24px;">🔄 Database Seeding Started</h1>
				<p style="margin: 10px 0 0 0; font-size: 16px;">Environment: ${environment}</p>
			</div>
			
			<div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
				<h2 style="margin-top: 0; color: #007bff;">Seeding Process Initiated</h2>
				<p>The database seeding process has been successfully started on the Heroku service.</p>
				<p><strong>What happens next:</strong></p>
				<ul>
					<li>Data will be fetched from external sources</li>
					<li>CSV files will be processed and validated</li>
					<li>Neo4j database will be updated with new data</li>
					<li>You will receive a completion notification when finished</li>
				</ul>
			</div>
			
			<div style="background: #d1ecf1; padding: 15px; border-radius: 5px; font-size: 14px; color: #0c5460;">
				<p style="margin: 0;"><strong>Service:</strong> Dorkinians Database Seeder</p>
				<p style="margin: 5px 0 0 0;"><strong>Environment:</strong> ${environment}</p>
				<p style="margin: 5px 0 0 0;"><strong>Started:</strong> ${new Date().toLocaleString()}</p>
			</div>
		</body>
		</html>
		`;
	}

	generateSeedingStartEmailText(environment) {
		return `
🔄 Database Seeding Started
Environment: ${environment}

The database seeding process has been successfully started on the Heroku service.

What happens next:
- Data will be fetched from external sources
- CSV files will be processed and validated
- Neo4j database will be updated with new data
- You will receive a completion notification when finished

Service: Dorkinians Database Seeder
Environment: ${environment}
Started: ${new Date().toLocaleString()}
		`.trim();
	}

	generateSeedingSummaryEmail(summary) {
		const statusIcon = summary.success ? '✅' : '❌';
		const statusText = summary.success ? 'Success' : 'Failed';
		const statusColor = summary.success ? '#28a745' : '#dc3545';
		const failureCypher = summary.success ? null : this.getFailureCypherFromSummary(summary);
		
		const startTime = summary.startTime ? new Date(summary.startTime).toLocaleString() : 'Not recorded';
		const endTime = summary.endTime ? new Date(summary.endTime).toLocaleString() : 'Not recorded';
		const durationFormatted = summary.duration ? `${(summary.duration / 1000).toFixed(2)}s` : 'Not recorded';
		
		return `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<title>Database Seeding ${statusText}</title>
		</head>
		<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
			<div style="background: ${statusColor}; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
				<h1 style="margin: 0; font-size: 24px;">${statusIcon} Database Seeding ${statusText}</h1>
				<p style="margin: 10px 0 0 0; font-size: 16px;">Environment: ${summary.environment}</p>
			</div>
			
			<div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
				<h2 style="margin-top: 0; color: ${statusColor};">Summary</h2>
				<table style="width: 100%; border-collapse: collapse;">
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold; width: 200px;">Job ID:</td>
						<td style="padding: 8px; border: 1px solid #ddd;">${summary.jobId}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold;">Status:</td>
						<td style="padding: 8px; border: 1px solid #ddd; color: ${statusColor}; font-weight: bold;">${statusText}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold;">Nodes Created:</td>
						<td style="padding: 8px; border: 1px solid #ddd;"><strong>${summary.nodesCreated || 0}</strong></td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold;">Relationships Created:</td>
						<td style="padding: 8px; border: 1px solid #ddd;"><strong>${summary.relationshipsCreated || 0}</strong></td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold;">Errors:</td>
						<td style="padding: 8px; border: 1px solid #ddd; color: ${summary.errorCount > 0 ? '#dc3545' : '#28a745'};"><strong>${summary.errorCount || 0}</strong></td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold;">Duration:</td>
						<td style="padding: 8px; border: 1px solid #ddd;"><strong>${durationFormatted}</strong></td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold;">Started:</td>
						<td style="padding: 8px; border: 1px solid #ddd;">${startTime}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold;">Finished:</td>
						<td style="padding: 8px; border: 1px solid #ddd;">${endTime}</td>
					</tr>
				</table>
			</div>
			
			${summary.errors && summary.errors.length > 0 ? `
			<div style="background: #f8d7da; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
				<h3 style="margin-top: 0; color: #721c24;">Errors</h3>
				<ul style="margin: 0; padding-left: 20px;">
					${summary.errors.map(error => `<li style="margin: 5px 0;">${error}</li>`).join('')}
				</ul>
			</div>
			` : ''}

			${failureCypher ? `
			<div style="background: #fff8e1; border: 1px solid #ffe082; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
				<h3 style="margin-top: 0; color: #856404;">Neo4j Debug Query</h3>
				<p style="margin: 0 0 10px 0;">Copy and paste this into Neo4j Aura Browser to inspect the failure:</p>
				<pre style="white-space: pre-wrap; font-family: Consolas, Monaco, monospace; font-size: 12px; line-height: 1.45; margin: 0; background: #111827; color: #f9fafb; padding: 12px; border-radius: 6px;">${this.escapeHtml(failureCypher)}</pre>
			</div>
			` : ''}
			
			<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; font-size: 14px; color: #6c757d;">
				<p style="margin: 0;"><strong>Service:</strong> Dorkinians Database Seeder</p>
				<p style="margin: 5px 0 0 0;"><strong>Environment:</strong> ${summary.environment}</p>
				<p style="margin: 5px 0 0 0;"><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
			</div>
		</body>
		</html>
		`;
	}

	generateSeedingSummaryEmailText(summary) {
		const statusIcon = summary.success ? '✅' : '❌';
		const statusText = summary.success ? 'Success' : 'Failed';
		const failureCypher = summary.success ? null : this.getFailureCypherFromSummary(summary);
		
		const startTime = summary.startTime ? new Date(summary.startTime).toLocaleString() : 'Not recorded';
		const endTime = summary.endTime ? new Date(summary.endTime).toLocaleString() : 'Not recorded';
		const durationFormatted = summary.duration ? `${(summary.duration / 1000).toFixed(2)}s` : 'Not recorded';
		
		return `
${statusIcon} Database Seeding ${statusText}
Environment: ${summary.environment}

Summary:
- Job ID: ${summary.jobId}
- Status: ${statusText}
- Nodes Created: ${summary.nodesCreated || 0}
- Relationships Created: ${summary.relationshipsCreated || 0}
- Errors: ${summary.errorCount || 0}
- Duration: ${durationFormatted}
- Started: ${startTime}
- Finished: ${endTime}

${summary.errors && summary.errors.length > 0 ? `
Errors:
${summary.errors.map(error => `- ${error}`).join('\n')}
` : ''}

${failureCypher ? `
NEO4J DEBUG QUERY
Copy and paste into Neo4j Aura Browser:
${failureCypher}
` : ''}

Service: Dorkinians Database Seeder
Environment: ${summary.environment}
Generated: ${new Date().toLocaleString()}
		`.trim();
	}

	escapeHtml(value) {
		return String(value || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	getFailureCypherFromSummary(summary) {
		const combinedText = [
			...(Array.isArray(summary.errors) ? summary.errors : []),
			summary.error || "",
			summary.errorMessage || ""
		]
			.join(" ")
			.toLowerCase();

		if (!combinedText.trim()) {
			return null;
		}

		if (combinedText.includes("relationship") || combinedText.includes("played_in")) {
			return `// Relationship diagnostics
MATCH (md:MatchDetail)
WHERE NOT EXISTS { MATCH (:Player)-[:PLAYED_IN]->(md) }
RETURN md.id AS matchDetailId, md.fixtureId AS fixtureId, md.date AS date
LIMIT 100;`;
		}

		if (combinedText.includes("missing") || combinedText.includes("required") || combinedText.includes("node")) {
			return `// Node diagnostics
MATCH (n)
WHERE n.id IS NULL OR n.graphLabel IS NULL
RETURN labels(n) AS labels, count(*) AS affectedNodes
ORDER BY affectedNodes DESC
LIMIT 50;`;
		}

		if (combinedText.includes("stale") || combinedText.includes("league")) {
			return `// League freshness diagnostics
MATCH (lt:LeagueTable)
RETURN lt.team AS team, lt.lastUpdated AS lastUpdated
ORDER BY lt.lastUpdated ASC
LIMIT 100;`;
		}

		if (combinedText.includes("integrity") || combinedText.includes("consistency") || combinedText.includes("duplicate")) {
			return `// Duplicate ID diagnostics
MATCH (n)
WHERE n.id IS NOT NULL
WITH labels(n) AS labels, n.id AS id, count(*) AS duplicates
WHERE duplicates > 1
RETURN labels, id, duplicates
ORDER BY duplicates DESC
LIMIT 50;`;
		}

		return null;
	}

	generateCriticalErrorEmail(errorInfo) {
		return `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<title>Critical Error - Database Seeder</title>
		</head>
		<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
			<div style="background: #dc3545; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
				<h1 style="margin: 0; font-size: 24px;">🚨 CRITICAL ERROR - Database Seeder</h1>
				<p style="margin: 10px 0 0 0; font-size: 16px;">${errorInfo.errorType}</p>
			</div>
			
			<div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
				<h2 style="margin-top: 0; color: #dc3545;">Error Details</h2>
				<table style="width: 100%; border-collapse: collapse;">
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold; width: 150px;">Error Type:</td>
						<td style="padding: 8px; border: 1px solid #ddd;">${errorInfo.errorType}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold;">Timestamp:</td>
						<td style="padding: 8px; border: 1px solid #ddd;">${new Date(errorInfo.timestamp).toLocaleString()}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd; background: #e9ecef; font-weight: bold;">Error Message:</td>
						<td style="padding: 8px; border: 1px solid #ddd; word-break: break-word;">${errorInfo.errorMessage}</td>
					</tr>
				</table>
			</div>
			
			<div style="background: #fff3cd; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
				<h3 style="margin-top: 0; color: #856404;">Stack Trace</h3>
				<pre style="background: #f8f9fa; padding: 15px; border-radius: 3px; overflow-x: auto; font-size: 12px; line-height: 1.4;">${errorInfo.errorStack}</pre>
			</div>
			
			<div style="background: #d1ecf1; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
				<h3 style="margin-top: 0; color: #0c5460;">Immediate Actions Required</h3>
				<ul style="margin: 0; padding-left: 20px;">
					<li>Check the application logs for additional context</li>
					<li>Verify database connectivity and credentials</li>
					<li>Review recent changes that might have caused this error</li>
					<li>Consider restarting the application if the error persists</li>
				</ul>
			</div>
			
			<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; font-size: 14px; color: #6c757d;">
				<p style="margin: 0;"><strong>Service:</strong> Dorkinians Database Seeder</p>
				<p style="margin: 5px 0 0 0;"><strong>Environment:</strong> ${process.env.NODE_ENV || 'production'}</p>
				<p style="margin: 5px 0 0 0;"><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
			</div>
		</body>
		</html>
		`;
	}

	generateCriticalErrorEmailText(errorInfo) {
		return `
🚨 CRITICAL ERROR - Database Seeder
${errorInfo.errorType}

Error Details:
- Error Type: ${errorInfo.errorType}
- Timestamp: ${new Date(errorInfo.timestamp).toLocaleString()}
- Error Message: ${errorInfo.errorMessage}

Stack Trace:
${errorInfo.errorStack}

Immediate Actions Required:
- Check the application logs for additional context
- Verify database connectivity and credentials
- Review recent changes that might have caused this error
- Consider restarting the application if the error persists

Service: Dorkinians Database Seeder
Environment: ${process.env.NODE_ENV || 'production'}
Generated: ${new Date().toLocaleString()}
		`;
	}
}

// Initialize services
const emailService = new SimpleEmailService();

// Enhanced monitoring functions
const monitorHerokuJob = async (jobId, herokuUrl, maxWaitTime = 35 * 60 * 1000) => {
	console.log(`🔍 MONITORING: Starting to monitor job ${jobId} for up to ${maxWaitTime / 1000} seconds`);
	
	const startTime = Date.now();
	const checkInterval = 30 * 1000; // Check every 30 seconds
	let lastStatus = null;
	
	while (Date.now() - startTime < maxWaitTime) {
		try {
			const statusUrl = `${herokuUrl}/status/${jobId}`;
			console.log(`🔍 MONITORING: Checking status at ${statusUrl}`);
			
			const response = await fetch(statusUrl, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'Netlify-Function-Monitor/1.0'
				}
			});
			
			if (response.ok) {
				const status = await response.json();
				console.log(`🔍 MONITORING: Job ${jobId} status:`, status);
				
				// Check if job is completed or failed
				if (status.status === 'completed' || status.status === 'failed') {
					console.log(`✅ MONITORING: Job ${jobId} finished with status: ${status.status}`);
					return {
						success: status.status === 'completed',
						status: status.status,
						jobId: jobId,
						details: status
					};
				}
				
				lastStatus = status;
			} else {
				console.warn(`⚠️ MONITORING: Failed to get status for job ${jobId}: ${response.status}`);
			}
		} catch (error) {
			console.error(`❌ MONITORING: Error checking status for job ${jobId}:`, error.message);
		}
		
		// Wait before next check
		await new Promise(resolve => setTimeout(resolve, checkInterval));
	}
	
	console.log(`⏰ MONITORING: Job ${jobId} monitoring timed out after ${maxWaitTime / 1000} seconds`);
	return {
		success: false,
		status: 'timeout',
		jobId: jobId,
		message: 'Job monitoring timed out',
		lastStatus: lastStatus
	};
};

exports.handler = async (event, context) => {
	const headers = {
		"Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://dorkinians-website-v3.netlify.app",
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
		const seasonConfig = {
			currentSeason: null,
			useSeasonOverride: false,
			fullRebuild: true,
			blueGreenCutover: true,
			...(requestBody.seasonConfig || {}),
		};
		const debug =
			requestBody.debug === true ||
			requestBody.debug === "true" ||
			seasonConfig.debug === true ||
			seasonConfig.debug === "true";
		
		console.log(`🗓️ TRIGGER: Season configuration received:`, JSON.stringify(seasonConfig, null, 2));
		console.log(`🔧 TRIGGER: Debug configuration received: ${debug ? "ENABLED ✅" : "DISABLED ❌"}`);

		// Detect if this is a cron job call (no email config) and set defaults
		const isCronJob = !requestBody.emailConfig || Object.keys(requestBody.emailConfig).length === 0;
		if (isCronJob) {
			console.log("🕐 TRIGGER: Detected cron job call - setting default email configuration");
			emailConfig.emailAddress = "bangsluke@gmail.com";
			emailConfig.sendEmailAtStart = false;
			// Cron: do not send success/completion emails; Heroku still sends on verification failure or seeding failure
			emailConfig.sendEmailAtCompletion = false;
		}

		console.log("📧 TRIGGER: Final email configuration:", emailConfig);

		// Generate unique job ID
		const jobId = `seed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		console.log("🆔 TRIGGER: Generated job ID:", jobId);

		// Configure email service with environment variables (available during execution)
		console.log("📧 EMAIL: Configuring email service...");
		try {
			emailService.configure();
		} catch (error) {
			console.warn("⚠️ Failed to configure email service:", error.message);
		}
		
		// Let Heroku handle all email notifications based on emailConfig flags
		// This ensures consistent email handling and proper seasonInfo in emails

		// Trigger Heroku seeding service
		console.log("🌱 HEROKU: Starting Heroku seeding service...");
		const herokuUrl = process.env.HEROKU_SEEDER_URL || "https://dorkinians-database-v3-0e9a731483c7.herokuapp.com/";
		console.log("🔗 HEROKU: Raw HEROKU_SEEDER_URL:", herokuUrl);
		const cleanHerokuUrl = herokuUrl.replace(/\/+$/, ""); // Remove one or more trailing slashes
		console.log("🔗 HEROKU: Cleaned URL:", cleanHerokuUrl);
		const fullUrl = `${cleanHerokuUrl}/seed`;
		console.log("🔗 HEROKU: Final URL being called:", fullUrl);

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
								sendEmailAtStart: Boolean(emailConfig.sendEmailAtStart ?? false),
								sendEmailAtCompletion: Boolean(
									emailConfig.sendEmailAtCompletion ?? (!isCronJob ? true : false)
								),
							},
							seasonConfig: { ...seasonConfig, debug },
							debug,
							triggerSource: isCronJob ? "cron" : "admin",
						}),
					},
					30000,
				); // 30 second timeout

				console.log("🌱 HEROKU: Response received - Status:", response.status);

				if (response.ok) {
					const responseBody = await response.text();
					console.log("✅ HEROKU: Heroku seeding service started successfully");
					console.log("✅ HEROKU: Response body:", responseBody);
					return { ok: true };
				} else {
					const responseBody = await response.text();
					console.warn("⚠️ HEROKU: Heroku seeding service may have failed to start");
					console.warn("⚠️ HEROKU: Response status:", response.status);
					console.warn("⚠️ HEROKU: Response body:", responseBody);
					return { ok: false, status: response.status, body: responseBody };
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
					throw error;
				}
			}
		};

		// Call Heroku and wait for response
		const herokuResult = await callHeroku();

		if (!herokuResult.ok) {
			const r = herokuResult;
			const status = r.status ?? 0;
			const body = r.body ?? "";
			let parsed = null;
			try { parsed = body ? JSON.parse(body) : null; } catch (_) {}
			const reason = "Heroku responded with " + status + (body ? ": " + (parsed?.error || body.slice(0, 120)) : "");
			const herokuBody = (parsed && typeof parsed === "object") ? parsed : (body.length > 500 ? body.slice(0, 500) + "…" : body);
			const origin = process.env.ALLOWED_ORIGIN || "https://dorkinians-website-v3.netlify.app";
			const hint = (status === 403 && body && (body.includes("CORS") || body.includes("Origin")))
				? `Check Heroku: NODE_ENV=production and CORS allows Origin: ${origin}`
				: (status === 401 || status === 403)
					? "SEED_API_KEY on Netlify must exactly match SEED_API_KEY on Heroku (same value and length). Heroku log \"Invalid API key length\" means the keys differ. Also verify CORS Origin if you see 403."
					: "Check Heroku logs and /seed endpoint.";

			console.error("❌ CRITICAL: Heroku seeding service failed to start after all retry attempts");
			console.error("❌ CRITICAL: This is a critical failure - no job was created on Heroku");

			try {
				await emailService.sendSeedingSummaryEmail({
					success: false,
					environment: environment,
					jobId: jobId,
					nodesCreated: 0,
					relationshipsCreated: 0,
					errorCount: 1,
					errors: ["CRITICAL: Failed to start Heroku seeding service after all retry attempts. " + reason],
					duration: 0,
					startTime: new Date().toISOString(),
					endTime: new Date().toISOString()
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
					reason,
					herokuStatus: status,
					herokuBody,
					hint,
					environment,
					jobId,
					timestamp: new Date().toISOString(),
					status: "failed",
					note: "Check your email for detailed failure notification."
				}),
			};
		}

		// Netlify now delegates all normal completion/failure emails to the Heroku
		// seeding service. We intentionally skip additional monitoring here to avoid
		// duplicate or conflicting completion notifications.
		console.log("🔍 MONITORING: Skipping Netlify-side monitoring – Heroku service will handle completion emails.");

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
				note: "Seeding is running on Heroku. The database service will send a completion email when finished, according to its configuration.",
				herokuUrl: cleanHerokuUrl,
				monitoring: {
					enabled: false
				}
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
				reason: "Unhandled error in trigger-seed",
				errorType: error.name || "Error",
				timestamp: new Date().toISOString(),
			}),
		};
	}
};
