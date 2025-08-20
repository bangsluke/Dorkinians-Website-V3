const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Use built-in http module for making requests
const http = require("http");
const https = require("https");

function makeRequest(url, options = {}) {
	return new Promise((resolve, reject) => {
		const urlObj = new URL(url);
		const isHttps = urlObj.protocol === "https:";
		const client = isHttps ? https : http;

		const requestOptions = {
			hostname: urlObj.hostname,
			port: urlObj.port,
			path: urlObj.pathname + urlObj.search,
			method: options.method || "GET",
			headers: options.headers || {},
		};

		if (options.body) {
			requestOptions.headers["Content-Type"] = "application/json";
			requestOptions.headers["Content-Length"] = Buffer.byteLength(options.body);
		}

		const req = client.request(requestOptions, (res) => {
			let data = "";
			res.on("data", (chunk) => {
				data += chunk;
			});
			res.on("end", () => {
				resolve({
					ok: res.statusCode >= 200 && res.statusCode < 300,
					status: res.statusCode,
					json: () => JSON.parse(data),
					text: () => data,
				});
			});
		});

		req.on("error", (error) => {
			reject(error);
		});

		if (options.body) {
			req.write(options.body);
		}

		req.end();
	});
}

// All data sources from the project with reduced row limits
const ALL_DATA_SOURCES = [
	{
		name: "TBL_Players",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=528214413&single=true&output=csv",
		type: "StatsData",
		maxRows: 50, // Limit to 50 players
	},
	{
		name: "TBL_FixturesAndResults",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=0&single=true&output=csv",
		type: "StatsData",
		maxRows: 50, // Limit to 50 fixtures
	},
	{
		name: "TBL_MatchDetails",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=564691931&single=true&output=csv",
		type: "StatsData",
		maxRows: 50, // Limit to 50 match details
	},
	{
		name: "TBL_WeeklyTOTW",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1985336995&single=true&output=csv",
		type: "StatsData",
		maxRows: 50, // Limit to 50 TOTW entries
	},
	{
		name: "TBL_SeasonTOTW",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=91372781&single=true&output=csv",
		type: "StatsData",
		maxRows: 50, // Limit to 50 season TOTW entries
	},
	{
		name: "TBL_PlayersOfTheMonth",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=2007852556&single=true&output=csv",
		type: "StatsData",
		maxRows: 50, // Limit to 50 player of month entries
	},
	{
		name: "TBL_OppositionDetails",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1977394709&single=true&output=csv",
		type: "StatsData",
		maxRows: 50, // Limit to 50 opposition details
	},
];

// Unified database seeding script that works with both development and production
async function seedDatabase() {
	// Get environment from command line argument or default to development
	const environment = process.argv[2] || "development";

	console.log(`🚀 Starting REDUCED Database Seeding...`);
	console.log(`📍 Environment: ${environment.toUpperCase()}`);
	console.log(`📊 Processing max 50 rows per data source`);

	try {
		// Set NODE_ENV based on the environment parameter
		process.env.NODE_ENV = environment;

		// Check environment variables based on the target environment
		if (environment === "production") {
			console.log("📋 Production Environment Check:");
			console.log("  NODE_ENV:", process.env.NODE_ENV);
			console.log("  PROD_NEO4J_URI:", process.env.PROD_NEO4J_URI ? "✅ Set" : "❌ Missing");
			console.log("  PROD_NEO4J_USER:", process.env.PROD_NEO4J_USER ? "✅ Set" : "❌ Missing");
			console.log("  PROD_NEO4J_PASSWORD:", process.env.PROD_NEO4J_PASSWORD ? "✅ Set" : "❌ Missing");

			if (!process.env.PROD_NEO4J_URI || !process.env.PROD_NEO4J_USER || !process.env.PROD_NEO4J_PASSWORD) {
				throw new Error("Production Neo4j environment variables are not configured");
			}

			console.log("📍 Target: Neo4j Aura (Production)");
		} else {
			console.log("📋 Development Environment Check:");
			console.log("  NODE_ENV:", process.env.NODE_ENV);
			console.log("  DEV_NEO4J_URI:", process.env.DEV_NEO4J_URI ? "✅ Set" : "❌ Missing");
			console.log("  DEV_NEO4J_USER:", process.env.DEV_NEO4J_USER ? "✅ Set" : "❌ Missing");
			console.log("  DEV_NEO4J_PASSWORD:", process.env.DEV_NEO4J_PASSWORD ? "✅ Set" : "❌ Missing");

			if (!process.env.DEV_NEO4J_URI || !process.env.DEV_NEO4J_USER || !process.env.DEV_NEO4J_PASSWORD) {
				throw new Error("Development Neo4j environment variables are not configured");
			}

			console.log("📍 Target: Local Neo4j Desktop (Development)");
		}

		console.log("✅ Environment variables validated");

		// Use appropriate port based on environment
		const port = 3000; // Both dev and prod use port 3000
		const apiUrl = `http://localhost:${port}/api/seed-data/`;

		console.log(`🌐 Calling seeding API: ${apiUrl}`);
		console.log(`📊 Seeding ${ALL_DATA_SOURCES.length} data sources with reduced limits...`);

		// Display data sources being seeded
		ALL_DATA_SOURCES.forEach((source, index) => {
			console.log(`  ${index + 1}. ${source.name} (max ${source.maxRows} rows)`);
		});

		const response = await makeRequest(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				dataSources: ALL_DATA_SOURCES,
				reducedMode: true, // Flag to indicate reduced seeding mode
			}),
		});

		if (response.ok) {
			const result = await response.json();
			console.log("✅ Reduced seeding completed successfully!");
			console.log("📊 Result:", result);

			if (result.success) {
				console.log(`🎉 Created ${result.nodesCreated} nodes and ${result.relationshipsCreated} relationships`);
				console.log(`📍 Database: ${environment === "production" ? "Neo4j Aura (Production)" : "Local Neo4j Desktop"}`);
				console.log(`📊 This was a REDUCED seeding run (max 50 rows per source)`);
			} else {
				console.log("⚠️ Reduced seeding completed with errors:", result.errors);
			}
		} else {
			const errorText = await response.text();
			console.error("❌ Reduced seeding failed:", response.status, errorText);
			console.log("\n💡 Make sure:");
			console.log("1. Next.js server is running (npm run dev)");
			console.log("2. Neo4j database is accessible");
			console.log("3. All environment variables are set correctly");
		}

		console.log(`✅ ${environment} reduced seeding completed!`);
	} catch (error) {
		console.error(`❌ ${environment} reduced seeding failed:`, error.message);
		console.log("\n💡 Make sure:");
		console.log("1. Next.js server is running (npm run dev)");
		console.log("2. Neo4j database is accessible");
		console.log("3. All environment variables are set correctly");
		process.exit(1);
	}
}

// Run the seeding
seedDatabase();
