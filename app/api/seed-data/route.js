// CommonJS version of seed-data API route for compatibility

const { NextRequest, NextResponse } = require("next/server");
const { dataSeederService } = require("@/lib/services/dataSeederService");
const { dataService } = require("@/lib/services/dataService");
const { csvHeaderValidator } = require("@/lib/services/csvHeaderValidator");
const { emailService } = require("@/lib/services/emailService");
const { getEmailConfig } = require("@/lib/config/emailConfig");
const { getDataSourcesByName } = require("@/lib/config/dataSources");

async function POST(request) {
	try {
		const body = await request.json();
		const { action, dataSources, reducedMode, query, params } = body;

		// Handle custom query execution
		if (action === "query" && query) {
			console.log("🔍 Executing custom Neo4j query...");

			try {
				const { neo4jService } = await import("@/lib/neo4j");
				const connected = await neo4jService.connect();

				if (!connected) {
					return NextResponse.json({ error: "Neo4j connection failed" }, { status: 500 });
				}

				const result = await neo4jService.runQuery(query, params || {});
				const data = result.records.map((record) => {
					const obj = {};
					record.keys.forEach((key) => {
						obj[String(key)] = record.get(key);
					});
					return obj;
				});

				return NextResponse.json({
					action: "query",
					success: true,
					data: data,
				});
			} catch (error) {
				console.error("❌ Query execution error:", error);
				return NextResponse.json(
					{
						error: "Query execution failed",
						details: error instanceof Error ? error.message : String(error),
					},
					{ status: 500 },
				);
			}
		}

		if (!dataSources || !Array.isArray(dataSources)) {
			return NextResponse.json({ error: "dataSources array is required" }, { status: 400 });
		}

		// Handle header validation only
		if (action === "validate-headers-only") {
			console.log("🔍 Starting CSV header validation...");

			try {
				// Configure email service if available
				const emailConfig = getEmailConfig();
				if (emailConfig) {
					emailService.configure(emailConfig);
					console.log("📧 Email service configured for CSV header validation notifications");
				} else {
					console.log("⚠️ Email service not configured - CSV header validation failures will not be emailed");
				}

				// Validate CSV headers using correct URLs from netlify/functions/lib/config/dataSources.js
				const dataSourceObjects = getDataSourcesByName(dataSources);
				const headerValidationResult = await csvHeaderValidator.validateAllCSVHeaders(dataSourceObjects);

				if (!headerValidationResult.isValid) {
					console.error(
						`❌ CSV header validation failed. ${headerValidationResult.failedSources} out of ${headerValidationResult.totalSources} data sources have invalid headers.`,
					);

					// Try to send email notification
					try {
						await emailService.sendCSVHeaderValidationFailure(headerValidationResult.failures);
						console.log("📧 Email notification sent for CSV header validation failures");
					} catch (emailError) {
						console.error("❌ Failed to send email notification:", emailError instanceof Error ? emailError.message : String(emailError));
					}
				}

				return NextResponse.json({
					action: "validate-headers-only",
					result: headerValidationResult,
				});
			} catch (error) {
				console.error("❌ CSV header validation error:", error);
				return NextResponse.json(
					{ error: "CSV header validation failed", details: error instanceof Error ? error.message : String(error) },
					{ status: 500 },
				);
			}
		}

		// Default action: seed the data
		console.log("🌱 Starting data seeding process...");
		if (reducedMode) {
			console.log("📊 REDUCED MODE: Processing limited rows for testing");
		}

		try {
			// Get the actual data source objects from the names
			const dataSourceObjects = getDataSourcesByName(dataSources);

			// Execute the seeding process
			const result = await dataSeederService.seedAllData(dataSourceObjects, reducedMode);

			return NextResponse.json({
				action: "seed",
				success: result.success,
				nodesCreated: result.nodesCreated,
				relationshipsCreated: result.relationshipsCreated,
				errors: result.errors,
				unknownNodes: result.unknownNodes,
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			console.error("❌ Seeding error:", error);
			return NextResponse.json({ error: "Seeding failed", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
		}
	} catch (error) {
		console.error("❌ Request processing error:", error);
		return NextResponse.json(
			{ error: "Request processing failed", details: error instanceof Error ? error.message : String(error) },
			{ status: 500 },
		);
	}
}

module.exports = { POST };
