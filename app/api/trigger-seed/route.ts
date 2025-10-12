import { NextRequest, NextResponse } from "next/server";

// Simple email service for Next.js API routes
class SimpleEmailService {
	private config: any = null;
	private transporter: any = null;

	configure() {
		// Try to get email configuration from environment variables
		const emailConfig = {
			host: process.env.SMTP_SERVER,
			port: parseInt(process.env.SMTP_PORT || "587"),
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
				// Dynamic import for nodemailer (only available in production)
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
				console.warn("⚠️ Failed to configure email service:", error);
			}
		} else {
			console.log("ℹ️ Email service not configured - missing environment variables");
		}
	}

	async sendSeedingStartEmail(environment: string) {
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
			console.error("Failed to send start notification:", error);
			return false;
		}
	}

	generateSeedingStartEmail(environment: string) {
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

	generateSeedingStartEmailText(environment: string) {
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

EXPECTED DURATION: ~65 minutes

This process runs on Heroku infrastructure and will continue even if you close this email.

Monitor progress via the admin panel or wait for completion email.

This is an automated notification from the Dorkinians Website V3 seeding system.
		`.trim();
	}
}

export async function POST(request: NextRequest) {
	try {
		// Force production environment for security
		const environment = "production";
		console.log(`🚀 API ROUTE: Enforcing production environment for database seeding`);

		// Generate unique job ID
		const jobId = `seed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		console.log("🆔 API ROUTE: Generated job ID:", jobId);

		// Configure and send email notification
		console.log("📧 EMAIL: Configuring email service...");
		const emailService = new SimpleEmailService();
		emailService.configure();

		// Send start notification
		console.log("📧 START: Attempting to send start notification...");
		try {
			await emailService.sendSeedingStartEmail(environment);
			console.log("✅ START: Start notification sent successfully");
		} catch (emailError) {
			console.warn("⚠️ START: Failed to send start notification:", emailError);
			// Don't fail the function if email fails
		}

		// Parse request body to get email configuration
		const requestBody = await request.json();
		const emailConfig = requestBody.emailConfig || {
			emailAddress: process.env.SMTP_TO_EMAIL || "bangsluke@gmail.com",
			sendEmailAtStart: false,
			sendEmailAtCompletion: true,
		};

		// Trigger Heroku seeding service (fire-and-forget)
		console.log("🌱 HEROKU: Starting Heroku seeding service...");
		const herokuUrl = process.env.HEROKU_SEEDER_URL || "https://database-dorkinians-4bac3364a645.herokuapp.com";

		// Fire-and-forget: don't wait for response to prevent timeout
		fetch(`${herokuUrl}/seed`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				environment,
				jobId,
				emailConfig,
			}),
		})
			.then((response) => {
				if (response.ok) {
					console.log("✅ HEROKU: Heroku seeding service started successfully");
				} else {
					console.warn("⚠️ HEROKU: Heroku seeding service may have failed to start");
				}
			})
			.catch((herokuError) => {
				console.warn("⚠️ HEROKU: Failed to start Heroku seeding service:", herokuError);
			});

		// Return immediate response
		console.log("✅ SUCCESS: Returning immediate response");
		return NextResponse.json({
			success: true,
			message: "Database seeding started on Heroku",
			environment,
			jobId,
			timestamp: new Date().toISOString(),
			status: "started",
			note: "Seeding is running on Heroku. Check email for completion notification.",
			herokuUrl: process.env.HEROKU_SEEDER_URL || "https://database-dorkinians-4bac3364a645.herokuapp.com",
		});
	} catch (error) {
		console.error("❌ ERROR: Main execution error:", error);

		return NextResponse.json(
			{
				error: "Failed to start database seeding",
				message: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	}
}
