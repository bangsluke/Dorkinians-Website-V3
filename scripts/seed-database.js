// CommonJS version of seed-database script for compatibility

const { DataSeederService } = require("../lib/services/dataSeederService");
const { getDataSourcesByName } = require("../lib/config/dataSources");
const { getEmailConfig } = require("../lib/config/emailConfig");
const { EmailService } = require("../lib/services/emailService");
const fs = require("fs");
const path = require("path");

async function main() {
	const startTime = Date.now();
	
	// Parse command line arguments
	const args = process.argv.slice(2);
	const environment = args[0] || "development";
	const reducedMode = args.includes("--reduced");
	const dataSourceNames = args.filter(arg => !arg.startsWith("--") && arg !== environment);
	
	console.log("🚀 Dorkinians FC Database Seeding Script");
	console.log("========================================");
	console.log(`🌍 Environment: ${environment}`);
	console.log(`📊 Mode: ${reducedMode ? "Reduced (10 rows per source)" : "Full"}`);
	console.log(`📅 Started: ${new Date().toLocaleString()}`);
	console.log("");
	
	// Validate environment
	if (!["development", "production"].includes(environment)) {
		console.error("❌ Invalid environment. Use 'development' or 'production'");
		process.exit(1);
	}
	
	// Set environment variables
	process.env.NODE_ENV = environment;
	
	// Load environment variables from .env file
	try {
		if (environment === "development") {
			require("dotenv").config({ path: ".env.local" });
		} else {
			require("dotenv").config({ path: ".env.production" });
		}
		console.log("✅ Environment variables loaded");
	} catch (error) {
		console.warn("⚠️ Could not load .env file:", error.message);
	}
	
	// Get data sources to process
	let dataSources;
	if (dataSourceNames.length > 0) {
		console.log(`📋 Processing specific data sources: ${dataSourceNames.join(", ")}`);
		dataSources = getDataSourcesByName(dataSourceNames);
		
		if (dataSources.length === 0) {
			console.error("❌ No valid data sources found for the specified names");
			process.exit(1);
		}
	} else {
		console.log("📋 Processing all available data sources");
		dataSources = getDataSourcesByName([
			"TBL_SiteDetails",
			"TBL_Players", 
			"TBL_FixturesAndResults",
			"TBL_MatchDetails",
			"TBL_WeeklyTOTW",
			"TBL_SeasonTOTW",
			"TBL_PlayersOfTheMonth",
			"TBL_CaptainsAndAwards",
			"TBL_OppositionDetails",
			"TBL_TestData"
		]);
	}
	
	console.log(`📊 Found ${dataSources.length} data sources to process`);
	dataSources.forEach(source => {
		console.log(`   - ${source.name}: ${source.url.substring(0, 50)}...`);
	});
	console.log("");
	
	// Create data seeder instance
	const dataSeeder = new DataSeederService();

	try {
		// Execute seeding (no need to initialize - it's handled internally)
		console.log("🌱 Starting database seeding...");
		const result = await dataSeeder.seedAllData(dataSources, reducedMode);
		
		if (result.success) {
			console.log("✅ Seeding completed successfully!");
			console.log(`🎉 Created ${result.nodesCreated} nodes and ${result.relationshipsCreated} relationships`);
			console.log(`📍 Database: ${environment === "production" ? "Neo4j Aura (Production)" : "Local Neo4j Desktop"}`);
			
			// Send email notification
			console.log("\n📧 Sending seeding summary email...");
			try {
				const emailService = new EmailService();
				const emailConfig = getEmailConfig();
				if (emailConfig) {
					emailService.configure(emailConfig);
				}
				
				const errorCount = countErrorsFromLog();
				const duration = Math.floor((Date.now() - startTime) / 1000);
				
				const summary = {
					environment: environment,
					nodesCreated: result.nodesCreated,
					relationshipsCreated: result.relationshipsCreated,
					duration: duration,
					errorCount: errorCount,
					timestamp: new Date().toISOString(),
					success: true
				};
				
				await emailService.sendSeedingSummary(summary);
				console.log("✅ Seeding summary email sent successfully");
			} catch (emailError) {
				console.warn(`⚠️ Failed to send seeding summary email: ${emailError.message}`);
			}
		} else {
			console.log("⚠️ Seeding completed with errors:", result.errors);
			
			// Send email notification for seeding with errors
			console.log("\n📧 Sending seeding summary email...");
			try {
				const emailService = new EmailService();
				const emailConfig = getEmailConfig();
				if (emailConfig) {
					emailService.configure(emailConfig);
				}
				
				const errorCount = countErrorsFromLog();
				const duration = Math.floor((Date.now() - startTime) / 1000);
				
				const summary = {
					environment: environment,
					nodesCreated: result.nodesCreated || 0,
					relationshipsCreated: result.relationshipsCreated || 0,
					duration: duration,
					errorCount: errorCount,
					timestamp: new Date().toISOString(),
					success: false,
					errors: result.errors
				};
				
				await emailService.sendSeedingSummary(summary);
				console.log("✅ Seeding summary email sent successfully");
			} catch (emailError) {
				console.warn(`⚠️ Failed to send seeding summary email: ${emailError.message}`);
			}
		}
	} catch (seedingError) {
		console.error("❌ Seeding failed:", seedingError.message);
		console.log("\n💡 Make sure:");
		console.log("1. Neo4j database is accessible");
		console.log("2. All environment variables are set correctly");
		console.log("3. Data source files are available");
		
		// Send email notification for complete seeding failure
		console.log("\n📧 Sending seeding summary email...");
		try {
			const emailService = new EmailService();
			const emailConfig = getEmailConfig();
			if (emailConfig) {
				emailService.configure(emailConfig);
			}
			
			const errorCount = countErrorsFromLog();
			const duration = Math.floor((Date.now() - startTime) / 1000);
			
			const summary = {
				environment: environment,
				nodesCreated: 0,
				relationshipsCreated: 0,
				duration: duration,
				errorCount: errorCount,
				timestamp: new Date().toISOString(),
				success: false,
				errors: [seedingError.message]
			};
			
			await emailService.sendSeedingSummary(summary);
			console.log("✅ Seeding summary email sent successfully");
		} catch (emailError) {
			console.warn(`⚠️ Failed to send seeding summary email: ${emailError.message}`);
		}
		
		process.exit(1);
	}
	
	const totalDuration = Math.floor((Date.now() - startTime) / 1000);
	console.log(`\n⏱️ Total execution time: ${totalDuration} seconds`);
	console.log("🎯 Script completed!");
}

function countErrorsFromLog() {
	try {
		const logPath = path.join(process.cwd(), "logs", "seeding-errors.log");
		
		if (!fs.existsSync(logPath)) {
			return 0;
		}

		const logContent = fs.readFileSync(logPath, "utf8");
		const lines = logContent.split("\n");
		
		// Count lines that contain actual error details
		let errorCount = 0;
		for (const line of lines) {
			if (line.trim() && 
				!line.startsWith("===") && 
				!line.startsWith("[") && 
				!line.startsWith("Details:") &&
				!line.startsWith("}")) {
				errorCount++;
			}
		}
		
		return errorCount;
	} catch (error) {
		console.warn(`⚠️ Could not read error log: ${error.message}`);
		return 0;
	}
}

// Handle script execution
if (require.main === module) {
	main().catch(error => {
		console.error("❌ Script execution failed:", error.message);
		process.exit(1);
	});
}

module.exports = { main, countErrorsFromLog };
