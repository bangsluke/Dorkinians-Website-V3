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
				seasonConfig,
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
