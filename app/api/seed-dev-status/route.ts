import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";

export async function GET(request: NextRequest) {
	try {
		// Only allow in development mode
		if (process.env.NODE_ENV !== 'development') {
			console.warn("⚠️ DEV STATUS: Development status check only available in development mode");
			return NextResponse.json(
				{ 
					error: "Development status check only available in development mode",
					environment: process.env.NODE_ENV
				}, 
				{ status: 403 }
			);
		}

		console.log("🔍 DEV STATUS: Checking development database status...");
		
		// Validate environment variables
		const devUri = process.env.DEV_NEO4J_URI;
		const devUser = process.env.DEV_NEO4J_USER;
		const devPassword = process.env.DEV_NEO4J_PASSWORD;

		if (!devUri || !devUser || !devPassword) {
			const missingVars = [];
			if (!devUri) missingVars.push("DEV_NEO4J_URI");
			if (!devUser) missingVars.push("DEV_NEO4J_USER");
			if (!devPassword) missingVars.push("DEV_NEO4J_PASSWORD");
			
			console.error(`❌ DEV STATUS: Missing environment variables: ${missingVars.join(", ")}`);
			return NextResponse.json(
				{ 
					error: "Development database credentials not configured", 
					missing: missingVars 
				}, 
				{ status: 400 }
			);
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json(
				{ 
					error: "Failed to connect to development Neo4j database",
					connected: false
				}, 
				{ status: 500 }
			);
		}

		// Get database statistics
		const stats = await neo4jService.getDatabaseStats();
		
		// Get connection info
		const connectionInfo = {
			uri: devUri,
			user: devUser,
			connected: neo4jService.isConnectedStatus(),
			graphLabel: neo4jService.getGraphLabel()
		};

		// Disconnect
		await neo4jService.disconnect();

		console.log(`✅ DEV STATUS: Retrieved database statistics`);
		console.log(`📊 DEV STATUS: Found ${stats.length} node types`);

		return NextResponse.json({
			environment: "development",
			connected: true,
			connectionInfo,
			stats,
			timestamp: new Date().toISOString(),
		});

	} catch (error) {
		console.error("❌ DEV STATUS: Status check error:", error);
		return NextResponse.json(
			{ 
				error: "Development database status check failed", 
				details: error instanceof Error ? error.message : String(error),
				connected: false
			}, 
			{ status: 500 }
		);
	}
}
