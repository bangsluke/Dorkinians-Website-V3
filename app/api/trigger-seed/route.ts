import { NextRequest, NextResponse } from "next/server";
import { seedApiRateLimiter } from "@/lib/middleware/rateLimiter";
import { sanitizeError } from "@/lib/utils/errorSanitizer";
import { log, logError, logRequest } from "@/lib/utils/logger";
import { csrfProtection } from "@/lib/middleware/csrf";

export async function POST(request: NextRequest) {
	// Apply rate limiting
	const rateLimitResponse = await seedApiRateLimiter(request);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	// CSRF protection for state-changing endpoint
	const csrfResponse = csrfProtection(request);
	if (csrfResponse) {
		return csrfResponse;
	}

	try {
		// Force production environment for security
		const environment = "production";
		log("info", "Enforcing production environment for database seeding");

		// Generate unique job ID
		const jobId = `seed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		log("info", "Generated job ID", { jobId });

		// Parse request body to get email and season configuration
		const requestBody = await request.json();
		const emailConfig = requestBody.emailConfig || {
			emailAddress: process.env.SMTP_TO_EMAIL || "bangsluke@gmail.com",
			sendEmailAtStart: false,
			sendEmailAtCompletion: true,
		};
		const seasonConfig = requestBody.seasonConfig || {
			currentSeason: null,
			useSeasonOverride: false,
			fullRebuild: false,
		};

		logRequest("Seed request received", {
			hasEmailConfig: !!emailConfig,
			hasSeasonConfig: !!seasonConfig,
		});

		// Trigger Heroku seeding service (fire-and-forget)
		log("info", "Starting Heroku seeding service");
		const herokuUrl = process.env.HEROKU_SEEDER_URL;
		if (!herokuUrl) {
			logError("HEROKU_SEEDER_URL not configured", new Error("Missing Heroku URL"));
			return NextResponse.json(
				{ error: "Server configuration error", message: "Heroku URL not configured" },
				{ status: 500 }
			);
		}
		
		// Clean URL to remove trailing slash to prevent double slashes
		const cleanHerokuUrl = herokuUrl.replace(/\/+$/, '');

		// Wait for Heroku response to capture SMTP errors (with timeout)
		let smtpError = null;
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
			
			// Security: Include API key for authentication
			const seedApiKey = process.env.SEED_API_KEY;
			if (!seedApiKey) {
				logError("SEED_API_KEY not configured", new Error("Missing API key"));
				return NextResponse.json(
					{
						error: "Server configuration error",
						message: "API key not configured",
					},
					{ status: 500 }
				);
			}

			const herokuResponse = await fetch(`${cleanHerokuUrl}/seed`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-API-Key": seedApiKey,
				},
				body: JSON.stringify({
					environment,
					jobId,
					emailConfig,
					seasonConfig,
				}),
				signal: controller.signal,
			});
			
			clearTimeout(timeoutId);
			
			if (herokuResponse.ok) {
				const herokuData = await herokuResponse.json();
				if (herokuData.smtpError) {
					smtpError = herokuData.smtpError;
					log("warn", "SMTP error detected", { error: smtpError });
				} else {
					log("info", "Heroku seeding service started successfully");
				}
			} else {
				log("warn", "Heroku seeding service may have failed to start");
			}
		} catch (herokuError: any) {
			// If timeout or network error, continue anyway (seeding may still start)
			if (herokuError.name === 'AbortError') {
				log("warn", "Request timeout - seeding may still have started");
			} else {
				logError("Failed to start Heroku seeding service", herokuError);
			}
		}

		// Return response with SMTP error if present
		log("info", "Returning seed response");
		return NextResponse.json({
			success: true,
			message: "Database seeding started on Heroku",
			environment,
			jobId,
			timestamp: new Date().toISOString(),
			status: "started",
			note: "Seeding is running on Heroku. Check email for completion notification.",
			herokuUrl: process.env.HEROKU_SEEDER_URL || "[configured]",
			smtpError: smtpError || null, // Include SMTP error if any
		});
	} catch (error) {
		logError("Main execution error in trigger-seed", error);

		// Sanitize error for production
		const sanitized = sanitizeError(error, process.env.NODE_ENV === "production");

		return NextResponse.json(
			{
				error: "Failed to start database seeding",
				message: sanitized.message,
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	}
}
