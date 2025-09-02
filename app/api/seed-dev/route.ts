import { NextRequest, NextResponse } from "next/server";
import { dataSeederService } from "@/lib/services/dataSeederService";

// Import CommonJS module
const { getDataSourcesByName } = require("@/lib/config/dataSources");

// Simple email service for development seeding notifications
class DevEmailService {
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
				// Dynamic import for nodemailer
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
				console.log("📧 DEV EMAIL: Email service configured successfully");
			} catch (error) {
				console.warn("⚠️ DEV EMAIL: Failed to configure email service:", error);
			}
		} else {
			console.log("ℹ️ DEV EMAIL: Email service not configured - missing environment variables");
		}
	}

	async sendDevSeedingCompleteEmail(result: any) {
		if (!this.transporter || !this.config) {
			console.log("ℹ️ DEV EMAIL: Email service not configured, skipping notification");
			return;
		}

		try {
			const subject = `🌱 Development Database Seeding ${result.success ? 'Completed Successfully' : 'Failed'}`;
			const html = `
				<h2>Development Database Seeding ${result.success ? 'Completed' : 'Failed'}</h2>
				<p><strong>Environment:</strong> Development</p>
				<p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
				<p><strong>Status:</strong> ${result.success ? '✅ Success' : '❌ Failed'}</p>
				<p><strong>Nodes Created:</strong> ${result.nodesCreated}</p>
				<p><strong>Relationships Created:</strong> ${result.relationshipsCreated}</p>
				${result.errors.length > 0 ? `<p><strong>Errors:</strong></p><ul>${result.errors.map((error: string) => `<li>${error}</li>`).join('')}</ul>` : ''}
				<p>This was a development database seeding operation using DEV_NEO4J_* environment variables.</p>
			`;

			await this.transporter.sendMail({
				from: this.config.from,
				to: this.config.to,
				subject,
				html,
			});

			console.log("✅ DEV EMAIL: Completion notification sent successfully");
		} catch (error) {
			console.warn("⚠️ DEV EMAIL: Failed to send completion notification:", error);
		}
	}
}

export async function POST(request: NextRequest) {
	try {
		// Only allow in development mode
		if (process.env.NODE_ENV !== 'development') {
			console.warn("⚠️ DEV SEEDING: Development seeding only available in development mode");
			return NextResponse.json(
				{ 
					error: "Development seeding only available in development mode",
					environment: process.env.NODE_ENV
				}, 
				{ status: 403 }
			);
		}

		console.log("🌱 DEV SEEDING: Starting development database seeding process...");
		
		// Get request body
		const body = await request.json();
		const { 
			dataSources = ["TBL_Players", "TBL_FixturesAndResults", "TBL_MatchDetails"],
			reducedMode = true, // Default to reduced mode for development
			clearFirst = true,  // Default to clearing first for development
			emailAddress = "bangsluke@gmail.com"
		} = body;

		console.log(`📊 DEV SEEDING: Data sources: ${dataSources.join(", ")}`);
		console.log(`📊 DEV SEEDING: Reduced mode: ${reducedMode}`);
		console.log(`📊 DEV SEEDING: Clear first: ${clearFirst}`);
		console.log(`📧 DEV SEEDING: Email address: ${emailAddress}`);

		// Validate environment variables
		const devUri = process.env.DEV_NEO4J_URI;
		const devUser = process.env.DEV_NEO4J_USER;
		const devPassword = process.env.DEV_NEO4J_PASSWORD;

		if (!devUri || !devUser || !devPassword) {
			const missingVars = [];
			if (!devUri) missingVars.push("DEV_NEO4J_URI");
			if (!devUser) missingVars.push("DEV_NEO4J_USER");
			if (!devPassword) missingVars.push("DEV_NEO4J_PASSWORD");
			
			console.error(`❌ DEV SEEDING: Missing environment variables: ${missingVars.join(", ")}`);
			return NextResponse.json(
				{ 
					error: "Development database credentials not configured", 
					missing: missingVars 
				}, 
				{ status: 400 }
			);
		}

		console.log(`✅ DEV SEEDING: Environment variables validated`);
		console.log(`🔗 DEV SEEDING: URI configured: ${devUri ? "Yes" : "No"}`);
		console.log(`👤 DEV SEEDING: User configured: ${devUser ? "Yes" : "No"}`);
		console.log(`🔐 DEV SEEDING: Password configured: ${devPassword ? "Yes" : "No"}`);

		// Get the actual data source objects from the names
		const dataSourceObjects = getDataSourcesByName(dataSources);
		console.log(`📋 DEV SEEDING: Found ${dataSourceObjects.length} data source objects`);

		// Execute the seeding process
		console.log("🌱 DEV SEEDING: Starting actual data seeding...");
		const result = await dataSeederService.seedAllData(dataSourceObjects, reducedMode);

		console.log(`🎉 DEV SEEDING: Completed! Success: ${result.success}`);
		console.log(`📊 DEV SEEDING: Nodes created: ${result.nodesCreated}`);
		console.log(`🔗 DEV SEEDING: Relationships created: ${result.relationshipsCreated}`);
		console.log(`❌ DEV SEEDING: Errors: ${result.errors.length}`);

		// Send email notification
		const emailService = new DevEmailService();
		emailService.configure();
		await emailService.sendDevSeedingCompleteEmail(result);

		return NextResponse.json({
			action: "dev-seed",
			environment: "development",
			success: result.success,
			nodesCreated: result.nodesCreated,
			relationshipsCreated: result.relationshipsCreated,
			errors: result.errors,
			unknownNodes: result.unknownNodes,
			timestamp: new Date().toISOString(),
		});

	} catch (error) {
		console.error("❌ DEV SEEDING: Seeding error:", error);
		
		// Try to send error notification email
		try {
			const emailService = new DevEmailService();
			emailService.configure();
			await emailService.sendDevSeedingCompleteEmail({
				success: false,
				nodesCreated: 0,
				relationshipsCreated: 0,
				errors: [error instanceof Error ? error.message : String(error)]
			});
		} catch (emailError) {
			console.warn("⚠️ DEV EMAIL: Failed to send error notification:", emailError);
		}

		return NextResponse.json(
			{ 
				error: "Development seeding failed", 
				details: error instanceof Error ? error.message : String(error) 
			}, 
			{ status: 500 }
		);
	}
}