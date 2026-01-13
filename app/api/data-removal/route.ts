import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/middleware/rateLimiter";

// Security: Sanitize HTML to prevent XSS attacks
function sanitizeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;')
		.replace(/\//g, '&#x2F;');
}

// Rate limiting: 2 requests per 10 seconds (using centralized Redis-based limiter)
const dataRemovalRateLimiter = createRateLimiter({
	windowMs: 10 * 1000, // 10 seconds
	maxRequests: 2, // 2 requests per window
});

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
			to: "bangsluke@gmail.com", // Hardcoded as requested
		};

		// Check if all required email config is present
		if (emailConfig.host && emailConfig.auth.user && emailConfig.auth.pass && emailConfig.from) {
			try {
				// Dynamic import for nodemailer (only available in production)
				const nodemailer = require("nodemailer");
				// Security: Use proper TLS validation - removed insecure certificate bypass
				this.transporter = nodemailer.createTransport({
					host: emailConfig.host,
					port: emailConfig.port,
					secure: emailConfig.secure,
					auth: emailConfig.auth,
					// TLS certificate validation is enabled by default for security
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

	async sendDataRemovalEmail(data: { name: string; version: string; timestamp: string }) {
		if (!this.transporter) {
			throw new Error("Email service not configured");
		}

		// Security: Sanitize all user input to prevent XSS attacks
		const sanitizedName = sanitizeHtml(data.name);
		const sanitizedVersion = sanitizeHtml(data.version);
		
		const subject = `Dorkinians FC - Data Removal Request from ${sanitizedName}`;
		const html = `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #1e40af;">Dorkinians FC - Data Removal Request</h2>
				
				<div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
					<h3 style="color: #dc2626; margin-top: 0;">⚠️ Data Removal Request</h3>
					<p style="margin: 0; color: #7f1d1d;">A user has requested to have their data removed from the Dorkinians FC website.</p>
				</div>

				<div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
					<h3 style="color: #374151; margin-top: 0;">Request Details</h3>
					<p><strong>Name to Remove:</strong> ${sanitizedName}</p>
					<p><strong>App Version:</strong> ${sanitizedVersion}</p>
					<p><strong>Request Timestamp:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
				</div>

				<div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
					<h3 style="color: #92400e; margin-top: 0;">Action Required</h3>
					<p style="margin: 0;">Please review and process this data removal request according to your data protection policies.</p>
				</div>

				<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
					<p>This message was sent from the Dorkinians FC website data removal system.</p>
				</div>
			</div>
		`;

		const mailOptions = {
			from: this.config.from,
			to: this.config.to,
			subject,
			html,
		};

		await this.transporter.sendMail(mailOptions);
		console.log(`📧 Data removal email sent: ${subject}`);
	}
}

const emailService = new SimpleEmailService();
emailService.configure();

export async function POST(request: NextRequest) {
	// Apply rate limiting
	const rateLimitResponse = await dataRemovalRateLimiter(request);
	if (rateLimitResponse) {
		return NextResponse.json(
			{
				success: false,
				message: "Too many requests. Please wait before sending another request.",
			},
			{ status: 429 },
		);
	}

	try {

		const body = await request.json();
		const { name, version, timestamp } = body;

		// Validate required fields
		if (!name || !version || !timestamp) {
			return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
		}

		// Send email
		await emailService.sendDataRemovalEmail({
			name: name.trim(),
			version,
			timestamp,
		});

		return NextResponse.json({
			success: true,
			message: "Data removal request sent successfully",
		});
	} catch (error: any) {
		console.error("Error sending data removal request:", error);
		return NextResponse.json(
			{
				success: false,
				message: "Failed to send request. Please try again later.",
			},
			{ status: 500 },
		);
	}
}
