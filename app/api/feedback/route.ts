import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiting (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 10 * 1000; // 10 seconds
const RATE_LIMIT_MAX_REQUESTS = 2;

function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const userLimit = rateLimitMap.get(ip);

	if (!userLimit) {
		rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
		return true;
	}

	if (now > userLimit.resetTime) {
		// Reset the window
		rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
		return true;
	}

	if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
		return false;
	}

	userLimit.count++;
	return true;
}

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

	async sendFeedbackEmail(data: {
		type: "bug" | "feature";
		name: string;
		message: string;
		version: string;
		timestamp: string;
	}) {
		if (!this.transporter) {
			throw new Error("Email service not configured");
		}

		const subject = `Dorkinians FC - ${data.type === "bug" ? "Bug Report" : "Feature Request"} from ${data.name}`;
		const html = `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #1e40af;">Dorkinians FC - ${data.type === "bug" ? "Bug Report" : "Feature Request"}</h2>
				
				<div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
					<h3 style="color: #374151; margin-top: 0;">Request Details</h3>
					<p><strong>Type:</strong> ${data.type === "bug" ? "Bug Report" : "Feature Request"}</p>
					<p><strong>Name:</strong> ${data.name}</p>
					<p><strong>App Version:</strong> ${data.version}</p>
					<p><strong>Timestamp:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
				</div>

				<div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
					<h3 style="color: #92400e; margin-top: 0;">Message</h3>
					<p style="white-space: pre-wrap; margin: 0;">${data.message}</p>
				</div>

				<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
					<p>This message was sent from the Dorkinians FC website feedback system.</p>
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
		console.log(`📧 Feedback email sent: ${subject}`);
	}
}

const emailService = new SimpleEmailService();
emailService.configure();

export async function POST(request: NextRequest) {
	try {
		// Get client IP for rate limiting
		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded ? forwarded.split(",")[0] : request.ip || "unknown";

		// Check rate limit
		if (!checkRateLimit(ip)) {
			return NextResponse.json(
				{ 
					success: false, 
					message: "Too many requests. Please wait before sending another message." 
				},
				{ status: 429 }
			);
		}

		const body = await request.json();
		const { type, name, message, version, timestamp } = body;

		// Validate required fields
		if (!type || !name || !message || !version || !timestamp) {
			return NextResponse.json(
				{ success: false, message: "Missing required fields" },
				{ status: 400 }
			);
		}

		// Validate type
		if (type !== "bug" && type !== "feature") {
			return NextResponse.json(
				{ success: false, message: "Invalid feedback type" },
				{ status: 400 }
			);
		}

		// Send email
		await emailService.sendFeedbackEmail({
			type,
			name: name.trim(),
			message: message.trim(),
			version,
			timestamp,
		});

		return NextResponse.json({
			success: true,
			message: "Feedback sent successfully",
		});

	} catch (error: any) {
		console.error("Error sending feedback:", error);
		return NextResponse.json(
			{ 
				success: false, 
				message: "Failed to send feedback. Please try again later." 
			},
			{ status: 500 }
		);
	}
}
