import { NextRequest, NextResponse } from "next/server";
import { dataSeederService } from "@/lib/services/dataSeederService";
import { dataService } from "@/lib/services/dataService";
import { csvHeaderValidator } from "@/lib/services/csvHeaderValidator";
import { emailService } from "@/lib/services/emailService";
import { getEmailConfig } from "@/lib/config/emailConfig";
import { getDataSourcesByName } from "@/lib/config/dataSources";

export async function POST(request: NextRequest) {
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
				const data = result.records.map(record => {
					const obj: { [key: string]: any } = {};
					record.keys.forEach(key => {
						obj[String(key)] = record.get(key);
					});
					return obj;
				});
				
				return NextResponse.json({
					action: "query",
					success: true,
					data: data
				});
			} catch (error) {
				console.error("❌ Query execution error:", error);
				return NextResponse.json({ 
					error: "Query execution failed", 
					details: error instanceof Error ? error.message : String(error) 
				}, { status: 500 });
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

				// Validate CSV headers using correct URLs from dataSources.ts
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

		// Seed the data with reduced mode flag
		const result = await dataSeederService.seedAllData(dataSources, reducedMode);

		if (result.success) {
			console.log(`✅ Data seeding completed: ${result.nodesCreated} nodes, ${result.relationshipsCreated} relationships`);
		} else {
			console.log(`⚠️ Data seeding completed with errors: ${result.errors.join(", ")}`);
		}

		return NextResponse.json(result);
	} catch (error) {
		console.error("❌ Data seeding API error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function GET() {
	try {
		// Get database stats
		const stats = await dataSeederService.getDatabaseStats();
		const cacheStats = dataService.getCacheStats();

		return NextResponse.json({
			database: stats,
			cache: cacheStats,
		});
	} catch (error) {
		console.error("❌ Stats API error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}


