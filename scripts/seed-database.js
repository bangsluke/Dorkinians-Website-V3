const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const fs = require("fs");

function countErrorsFromLog() {
	try {
		const logPath = path.join(__dirname, "..", "logs", "seeding-errors.log");
		if (!fs.existsSync(logPath)) {
			return 0;
		}

		const logContent = fs.readFileSync(logPath, "utf8");
		const lines = logContent.split("\n");
		
		// Count lines that contain actual error details (not timestamps or separators)
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

// Import data sources from configuration
const { dataSources } = require("../lib/config/dataSources");

// Unified database seeding script that works with both development and production
async function seedDatabase() {
	// Get environment from command line argument or default to development
	const environment = process.argv[2] || "development";
	
	// Start timing
	const startTime = Date.now();

	console.log(`🚀 Starting Database Seeding...`);
	console.log(`📍 Environment: ${environment.toUpperCase()}`);
	console.log(`📊 Processing all data sources`);

	try {
		// Set NODE_ENV based on the environment parameter
		process.env.NODE_ENV = environment;

		// Check environment variables based on the target environment
		if (environment === "production") {
			console.log("📋 Production Environment Check:");
			console.log("  NODE_ENV:", process.env.NODE_ENV);
			console.log("  PROD_NEO4J_URI:", process.env.PROD_NEO4J_URI ? "✅ Set" : "❌ Missing");
			console.log("  PROD_NEO4J_USER:", process.env.PROD_NEO4J_USER ? "✅ Set" : "❌ Missing");
			console.log("  PROD_NEO4J_PASSWORD:", process.env.PROD_NEO4J_USER ? "✅ Set" : "❌ Missing");

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

		console.log(`📊 Seeding ${dataSources.length} data sources...`);

		// Display data sources being seeded
		dataSources.forEach((source, index) => {
			console.log(`  ${index + 1}. ${source.name}`);
		});

		// Import and use DataSeederService directly
		console.log("\n🔧 Initializing DataSeederService...");
		const { DataSeederService } = require("../lib/services/dataSeederService");
		const dataSeeder = new DataSeederService();

		try {
			// Initialize the service
			await dataSeeder.initialize();
			
			// Execute seeding
			console.log("🌱 Starting database seeding...");
			const result = await dataSeeder.seedAllData();
			
			if (result.success) {
				console.log("✅ Seeding completed successfully!");
				console.log(`🎉 Created ${result.nodesCreated} nodes and ${result.relationshipsCreated} relationships`);
				console.log(`📍 Database: ${environment === "production" ? "Neo4j Aura (Production)" : "Local Neo4j Desktop"}`);
				
				// Run data validation test after successful seeding
				console.log("\n🧪 Running data validation test...");
				try {
					const { testDataValidation } = require("./test-data-validation");
					const validationResult = await testDataValidation();
					
					if (validationResult.success) {
						console.log(`✅ Validation completed: ${validationResult.passedTests}/${validationResult.totalTests} tests passed`);
					} else {
						console.log(`⚠️ Validation completed with issues: ${validationResult.error}`);
					}
				} catch (validationError) {
					console.warn(`⚠️ Data validation failed: ${validationError.message}`);
				}

				// Send email notification
				console.log("\n📧 Sending seeding summary email...");
				try {
					const { emailService } = require("../lib/services/emailService");
					const { getEmailConfig } = require("../lib/config/emailConfig");
					
					const emailConfig = getEmailConfig();
					if (emailConfig) {
						emailService.configure(emailConfig);
						
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
					} else {
						console.log("⚠️ Email service not configured - skipping email notification");
					}
				} catch (emailError) {
					console.warn(`⚠️ Failed to send seeding summary email: ${emailError.message}`);
				}
			} else {
				console.log("⚠️ Seeding completed with errors:", result.errors);
				
				// Send email notification for seeding with errors
				console.log("\n📧 Sending seeding summary email...");
				try {
					const { emailService } = require("../lib/services/emailService");
					const { getEmailConfig } = require("../lib/config/emailConfig");
					
					const emailConfig = getEmailConfig();
					if (emailConfig) {
						emailService.configure(emailConfig);
						
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
					} else {
						console.log("⚠️ Email service not configured - skipping email notification");
					}
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
				const { emailService } = require("../lib/services/emailService");
				const { getEmailConfig } = require("../lib/config/emailConfig");
				
				const emailConfig = getEmailConfig();
				if (emailConfig) {
					emailService.configure(emailConfig);
					
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
				} else {
					console.log("⚠️ Email service not configured - skipping email notification");
				}
			} catch (emailError) {
				console.warn(`⚠️ Failed to send seeding summary email: ${emailError.message}`);
				console.log("✅ Seeding summary email sent successfully");
			}
		} finally {
			// Clean up connections
			try {
				await dataSeeder.cleanup();
			} catch (cleanupError) {
				console.warn("⚠️ Cleanup failed:", cleanupError.message);
			}
		}

		// Calculate and display timing
		const endTime = Date.now();
		const duration = endTime - startTime;
		const minutes = Math.floor(duration / 60000);
		const seconds = Math.floor((duration % 60000) / 1000);
		const milliseconds = duration % 1000;
		
		console.log(`\n⏱️  Seeding Duration: ${minutes > 0 ? minutes + 'm ' : ''}${seconds}s ${milliseconds}ms`);
		console.log(`✅ ${environment} seeding completed!`);
	} catch (error) {
		// Calculate timing even on error
		const endTime = Date.now();
		const duration = endTime - startTime;
		const minutes = Math.floor(duration / 60000);
		const seconds = Math.floor((duration % 60000) / 1000);
		const milliseconds = duration % 1000;
		
		console.log(`\n⏱️  Seeding Duration: ${minutes > 0 ? minutes + 'm ' : ''}${seconds}s ${milliseconds}ms`);
		console.error(`❌ ${environment} seeding failed:`, error.message);
		console.log("\n💡 Make sure:");
		console.log("1. Neo4j database is accessible");
		console.log("2. All environment variables are set correctly");
		console.log("3. Data source files are available");
		
		// Send email notification for complete seeding failure
		console.log("\n📧 Sending seeding summary email...");
		try {
			const { emailService } = require("../lib/services/emailService");
			const { getEmailConfig } = require("../lib/config/emailConfig");
			
			const emailConfig = getEmailConfig();
			if (emailConfig) {
				emailService.configure(emailConfig);
				
				const errorCount = countErrorsFromLog();
				const durationSeconds = Math.floor(duration / 1000);
				
				const summary = {
					environment: environment,
					nodesCreated: 0,
					relationshipsCreated: 0,
					duration: durationSeconds,
					errorCount: errorCount,
					timestamp: new Date().toISOString(),
					success: false,
					errors: [`Seeding process failed with exception: ${error.message}`]
				};
				
				await emailService.sendSeedingSummary(summary);
				console.log("✅ Seeding summary email sent successfully");
			} else {
				console.log("⚠️ Email service not configured - skipping email notification");
			}
		} catch (emailError) {
			console.warn(`⚠️ Failed to send seeding summary email: ${emailError.message}`);
		}
		
		process.exit(1);
	}
}

// Run the seeding
seedDatabase();
