import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		// Force production environment for security
		const environment = "production";
		console.log(`🚀 API ROUTE: Enforcing production environment for database seeding`);

		// Generate unique job ID
		const jobId = `seed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		console.log("🆔 API ROUTE: Generated job ID:", jobId);

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

		console.log("📧 API ROUTE: Email configuration:", emailConfig);
		console.log("🗓️ API ROUTE: Season configuration:", seasonConfig);

		// Trigger Heroku seeding service (fire-and-forget)
		console.log("🌱 HEROKU: Starting Heroku seeding service...");
		const herokuUrl = process.env.HEROKU_SEEDER_URL || "https://database-dorkinians-4bac3364a645.herokuapp.com";
		
		// Clean URL to remove trailing slash to prevent double slashes
		const cleanHerokuUrl = herokuUrl.replace(/\/+$/, '');
		console.log("🔗 HEROKU: Raw HEROKU_SEEDER_URL:", herokuUrl);
		console.log("🔗 HEROKU: Cleaned Heroku URL:", cleanHerokuUrl);

		// Wait for Heroku response to capture SMTP errors (with timeout)
		let smtpError = null;
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
			
			// Security: Include API key for authentication
			const seedApiKey = process.env.SEED_API_KEY;
			if (!seedApiKey) {
				console.error("❌ SECURITY: SEED_API_KEY not configured");
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
					console.warn("⚠️ HEROKU: SMTP error detected:", smtpError);
				} else {
					console.log("✅ HEROKU: Heroku seeding service started successfully");
				}
			} else {
				console.warn("⚠️ HEROKU: Heroku seeding service may have failed to start");
			}
		} catch (herokuError: any) {
			// If timeout or network error, continue anyway (seeding may still start)
			if (herokuError.name === 'AbortError') {
				console.warn("⚠️ HEROKU: Request timeout - seeding may still have started");
			} else {
				console.warn("⚠️ HEROKU: Failed to start Heroku seeding service:", herokuError.message);
			}
		}

		// Return response with SMTP error if present
		console.log("✅ SUCCESS: Returning response");
		return NextResponse.json({
			success: true,
			message: "Database seeding started on Heroku",
			environment,
			jobId,
			timestamp: new Date().toISOString(),
			status: "started",
			note: "Seeding is running on Heroku. Check email for completion notification.",
			herokuUrl: process.env.HEROKU_SEEDER_URL || "https://database-dorkinians-4bac3364a645.herokuapp.com",
			smtpError: smtpError || null, // Include SMTP error if any
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
