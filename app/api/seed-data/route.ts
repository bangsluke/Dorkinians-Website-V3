import { NextRequest, NextResponse } from "next/server";
import { dataSeederService } from "@/lib/services/dataSeederService";
import { dataService } from "@/lib/services/dataService";
import { csvHeaderValidator } from "@/lib/services/csvHeaderValidator";
import { emailService } from "@/lib/services/emailService";
import { getEmailConfig } from "@/lib/config/emailConfig";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { action, dataSources } = body;

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

				// Validate CSV headers
				const headerValidationResult = await csvHeaderValidator.validateAllCSVHeaders(
					dataSources.map((name) => ({
						name,
						url: `https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv&gid=${getGidForDataSource(name)}`,
						type: "StatsData" as const,
					})),
				);

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

		// Seed the data
		const result = await dataSeederService.seedAllData(dataSources);

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

// Helper function to get GID for data sources (using actual GIDs from dataSources.ts)
function getGidForDataSource(name: string): string {
	const gidMap: Record<string, string> = {
		TBL_Players: "528214413",
		TBL_FixturesAndResults: "0",
		TBL_MatchDetails: "1",
		TBL_WeeklyTOTW: "2",
		TBL_SeasonTOTW: "3",
		TBL_PlayersOfTheMonth: "4",
		TBL_OppositionDetails: "6",
		TBL_SiteDetails: "7",
		TBL_CaptainsAndAwards: "8",
	};
	return gidMap[name] || "0";
}
