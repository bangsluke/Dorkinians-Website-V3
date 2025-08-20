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
	maxRows: 50 // Limit to 50 rows per source for testing
}));

// Unified database seeding script that works with both development and production
async function seedDatabase() {
	try {
		console.log("🌱 Starting reduced database seeding process...");
		console.log("📊 REDUCED MODE: Processing limited rows for testing");

		// Make request to the seeding API
		const apiUrl = "http://localhost:3000/api/seed-data";
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

		if (response.success) {
			console.log("✅ Database seeding completed successfully!");
			console.log(`📊 Nodes created: ${response.data.nodesCreated}`);
			console.log(`🔗 Relationships created: ${response.data.relationshipsCreated}`);
			console.log(`⚠️ Errors: ${response.data.errors.length}`);
			console.log(`❓ Unknown nodes: ${response.data.unknownNodes.length}`);

			if (response.data.errors.length > 0) {
				console.log("\n❌ Errors encountered:");
				response.data.errors.forEach((error, index) => {
					console.log(`  ${index + 1}. ${error}`);
				});
			}

			if (response.data.unknownNodes.length > 0) {
				console.log("\n❓ Unknown nodes encountered:");
				response.data.unknownNodes.forEach((node, index) => {
					console.log(`  ${index + 1}. ${node}`);
				});
			}
		} else {
			console.error("❌ Database seeding failed:", response.error);
			process.exit(1);
		}
	} catch (error) {
		console.error("❌ Error during database seeding:", error);
		process.exit(1);
	}
}

// Run the seeding
seedDatabase();
