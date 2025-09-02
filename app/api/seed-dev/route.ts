import { NextRequest, NextResponse } from "next/server";

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
			emailAddress = "bangsluke@gmail.com"
		} = body;

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

		// Execute the seeding process using the same method as production
		console.log("🌱 DEV SEEDING: Starting actual data seeding via Heroku service...");
		
		// Use the same proven method as production seeding
		const herokuUrl = process.env.HEROKU_SEEDER_URL || "https://database-dorkinians-4bac3364a645.herokuapp.com";
		const cleanHerokuUrl = herokuUrl.replace(/\/$/, "");
		const fullUrl = `${cleanHerokuUrl}/seed`;
		
		console.log("🔗 DEV SEEDING: Calling Heroku service:", fullUrl);
		
		const herokuResponse = await fetch(fullUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "V3-Dorkinians-Website-Dev/1.0",
			},
			body: JSON.stringify({
				environment: "development", // Use development environment
				jobId: `dev_seed_${Date.now()}`,
				emailConfig: {
					emailAddress: emailAddress,
					sendEmailAtStart: false,
					sendEmailAtCompletion: true
				},
				neo4jCredentials: {
					uri: devUri,
					user: devUser,
					password: devPassword
				}
			}),
		});
		
		if (!herokuResponse.ok) {
			throw new Error(`Heroku service failed: ${herokuResponse.status} ${herokuResponse.statusText}`);
		}
		
		const herokuResult = await herokuResponse.json();
		console.log("✅ DEV SEEDING: Heroku service response:", herokuResult);
		
		// Return a result in the same format as the local dataSeederService
		const result = {
			success: herokuResult.success || true,
			nodesCreated: herokuResult.nodesCreated || 0,
			relationshipsCreated: herokuResult.relationshipsCreated || 0,
			errors: herokuResult.errors || [],
			unknownNodes: herokuResult.unknownNodes || []
		};

		console.log(`🎉 DEV SEEDING: Completed! Success: ${result.success}`);
		console.log(`📊 DEV SEEDING: Nodes created: ${result.nodesCreated}`);
		console.log(`🔗 DEV SEEDING: Relationships created: ${result.relationshipsCreated}`);
		console.log(`❌ DEV SEEDING: Errors: ${result.errors.length}`);

		// Return success response
		return NextResponse.json({
			action: "dev-seed",
			environment: "development",
			success: result.success,
			nodesCreated: result.nodesCreated,
			relationshipsCreated: result.relationshipsCreated,
			errors: result.errors,
			unknownNodes: result.unknownNodes,
			timestamp: new Date().toISOString(),
			note: "Seeding is running on Heroku service. Check email for completion notification."
		});

	} catch (error) {
		console.error("❌ DEV SEEDING: Error:", error);
		
		return NextResponse.json(
			{ 
				action: "dev-seed",
				environment: "development",
				success: false,
				error: error instanceof Error ? error.message : String(error),
				timestamp: new Date().toISOString()
			}, 
			{ status: 500 }
		);
	}
}