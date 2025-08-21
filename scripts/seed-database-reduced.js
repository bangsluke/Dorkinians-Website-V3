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

const { dataSources } = require("../lib/config/dataSources");

// Add maxRows to each data source for reduced seeding
const REDUCED_DATA_SOURCES = dataSources.map(source => ({
	...source,
	maxRows: 100 // Limit to 100 rows per source for testing
}));

// Unified database seeding script that works with both development and production
async function seedDatabase() {
	// Start timing
	const startTime = Date.now();
	
	try {
		console.log("🌱 Starting reduced database seeding process...");
		console.log("📊 REDUCED MODE: Processing up to 100 rows per table for testing");

		// Make request to the seeding API
		const apiUrl = "http://localhost:3000/api/seed-data/";
		const response = await makeRequest(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				dataSources: REDUCED_DATA_SOURCES,
				reducedMode: true, // Flag to indicate reduced seeding mode
			}),
		});

		if (response.ok) {
			const result = await response.json();
			console.log("✅ Database seeding completed successfully!");
			console.log(`📊 Result:`, result);

			if (result.success) {
				console.log(`📊 Nodes created: ${result.nodesCreated}`);
				console.log(`🔗 Relationships created: ${result.relationshipsCreated}`);
				console.log(`⚠️ Errors: ${result.errors.length}`);
				console.log(`❓ Unknown nodes: ${result.unknownNodes.length}`);

				if (result.errors.length > 0) {
					console.log("\n❌ Errors encountered:");
					result.errors.forEach((error, index) => {
						console.log(`  ${index + 1}. ${error}`);
					});
				}

				if (result.unknownNodes.length > 0) {
					console.log("\n❓ Unknown nodes encountered:");
					result.unknownNodes.forEach((node, index) => {
						console.log(`  ${index + 1}. ${node}`);
					});
				}
			} else {
				console.log("⚠️ Seeding completed with errors:", result.errors);
			}
		} else {
			const errorText = await response.text();
			console.error("❌ Database seeding failed:", response.status, errorText);
			process.exit(1);
		}
		
		// Calculate and display timing
		const endTime = Date.now();
		const duration = endTime - startTime;
		const minutes = Math.floor(duration / 60000);
		const seconds = Math.floor((duration % 60000) / 1000);
		const milliseconds = duration % 1000;
		
		console.log(`\n⏱️  Seeding Duration: ${minutes > 0 ? minutes + 'm ' : ''}${seconds}s ${milliseconds}ms`);
	} catch (error) {
		// Calculate timing even on error
		const endTime = Date.now();
		const duration = endTime - startTime;
		const minutes = Math.floor(duration / 60000);
		const seconds = Math.floor((duration % 60000) / 1000);
		const milliseconds = duration % 1000;
		
		console.log(`\n⏱️  Seeding Duration: ${minutes > 0 ? minutes + 'm ' : ''}${seconds}s ${milliseconds}ms`);
		console.error("❌ Error during database seeding:", error);
		process.exit(1);
	}
}

// Run the seeding
seedDatabase();
