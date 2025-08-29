// CommonJS version of data seeder service for compatibility

const { neo4jService } = require("../neo4j");
const { dataService } = require("./dataService");
const { csvHeaderValidator } = require("./csvHeaderValidator");
const { emailService } = require("./emailService");
const { getEmailConfig } = require("../config/emailConfig");
const fs = require("fs");
const path = require("path");

class DataSeederService {
	constructor() {
		this.errorLogPath = path.join(process.cwd(), "logs", "seeding-errors.log");
		this.ensureLogDirectory();
	}

	static getInstance() {
		if (!DataSeederService.instance) {
			DataSeederService.instance = new DataSeederService();
		}
		return DataSeederService.instance;
	}

	ensureLogDirectory() {
		const logDir = path.dirname(this.errorLogPath);
		if (!fs.existsSync(logDir)) {
			fs.mkdirSync(logDir, { recursive: true });
		}
	}

	logError(message, details) {
		const timestamp = new Date().toISOString();
		const logEntry = `[${timestamp}] ${message}${details ? "\nDetails: " + JSON.stringify(details, null, 2) : ""}\n`;

		try {
			fs.appendFileSync(this.errorLogPath, logEntry);
			console.log(`📝 Error logged to: ${this.errorLogPath}`);
		} catch (error) {
			console.error("Failed to write to error log:", error);
		}
	}

	logConsoleError(message, details) {
		// Log to console with ❌ symbol
		console.error(`❌ ${message}`);

		// Also log to error file
		this.logError(message, details);
	}

	async seedAllData(dataSources, reducedMode = false) {
		console.log("🌱 Starting data seeding process...");
		if (reducedMode) {
			console.log("📊 REDUCED MODE: Processing limited rows for testing");
		}

		// Clear previous error log for this run
		try {
			fs.writeFileSync(this.errorLogPath, `=== SEEDING RUN STARTED: ${new Date().toISOString()} ===\n`);
		} catch (error) {
			console.error("Failed to clear error log:", error);
		}

		try {
			// Step 1: Configure email service if available
			const emailConfig = getEmailConfig();
			if (emailConfig) {
				emailService.configure(emailConfig);
				console.log("📧 Email service configured for CSV header validation notifications");
			} else {
				console.log("⚠️ Email service not configured - CSV header validation failures will not be emailed");
			}

			// Step 2: Validate CSV headers before proceeding
			console.log("🔍 Step 2: Validating CSV headers...");
			const headerValidationResult = await csvHeaderValidator.validateAllCSVHeaders(dataSources);

			if (!headerValidationResult.isValid) {
				const errorMsg = `CSV header validation failed. ${headerValidationResult.failedSources} out of ${headerValidationResult.totalSources} data sources have invalid headers.`;
				console.error(`❌ ${errorMsg}`);

				// Log the validation failures
				this.logError("CSV Header Validation Failed", {
					totalSources: headerValidationResult.totalSources,
					validSources: headerValidationResult.validSources,
					failedSources: headerValidationResult.failedSources,
					failures: headerValidationResult.failures,
				});

				// Try to send email notification
				try {
					await emailService.sendCSVHeaderValidationFailureEmail(headerValidationResult);
				} catch (emailError) {
					console.warn("Failed to send CSV header validation failure email:", emailError);
				}

				return {
					success: false,
					nodesCreated: 0,
					relationshipsCreated: 0,
					errors: [errorMsg],
					unknownNodes: [],
				};
			}

			console.log(
				`✅ CSV header validation passed: ${headerValidationResult.validSources}/${headerValidationResult.totalSources} sources valid`,
			);

			// Step 3: Initialize Neo4j connection
			console.log("🔌 Step 3: Initializing Neo4j connection...");
			await neo4jService.initialize();

			// Step 4: Clear existing data and apply schema
			console.log("🗑️ Step 4: Clearing existing data and applying schema...");
			await neo4jService.clearGraphData();
			await neo4jService.applySchema();

			// Step 5: Process each data source
			console.log("📊 Step 5: Processing data sources...");
			let totalNodesCreated = 0;
			let totalRelationshipsCreated = 0;
			const errors = [];
			const unknownNodes = [];

			for (const dataSource of dataSources) {
				try {
					console.log(`📥 Processing: ${dataSource.name}`);
					const result = await this.processDataSource(dataSource, reducedMode);
					totalNodesCreated += result.nodesCreated;
					totalRelationshipsCreated += result.relationshipsCreated;

					if (result.errors.length > 0) {
						errors.push(...result.errors);
					}

					if (result.unknownNodes.length > 0) {
						unknownNodes.push(...result.unknownNodes);
					}

					console.log(`✅ ${dataSource.name}: ${result.nodesCreated} nodes, ${result.relationshipsCreated} relationships`);
				} catch (error) {
					const errorMsg = `Failed to process ${dataSource.name}: ${error.message}`;
					console.error(`❌ ${errorMsg}`);
					errors.push(errorMsg);
					this.logError(errorMsg, error);
				}
			}

			// Step 6: Create relationships between nodes
			console.log("🔗 Step 6: Creating relationships between nodes...");
			const relationshipResult = await neo4jService.createAllRelationships();
			totalRelationshipsCreated += relationshipResult;

			console.log(`🎉 Seeding completed! Created ${totalNodesCreated} nodes and ${totalRelationshipsCreated} relationships`);

			return {
				success: errors.length === 0,
				nodesCreated: totalNodesCreated,
				relationshipsCreated: totalRelationshipsCreated,
				errors: errors,
				unknownNodes: unknownNodes,
			};
		} catch (error) {
			const errorMsg = `Seeding failed: ${error.message}`;
			console.error(`❌ ${errorMsg}`);
			this.logError(errorMsg, error);

			return {
				success: false,
				nodesCreated: 0,
				relationshipsCreated: 0,
				errors: [errorMsg],
				unknownNodes: [],
			};
		} finally {
			// Clean up Neo4j connection
			try {
				await neo4jService.cleanup();
			} catch (cleanupError) {
				console.warn("Cleanup failed:", cleanupError);
			}
		}
	}

	async processDataSource(dataSource, reducedMode) {
		let nodesCreated = 0;
		let relationshipsCreated = 0;
		const errors = [];
		const unknownNodes = [];

		try {
			// Fetch CSV data
			const csvData = await dataService.fetchCSVData(dataSource.url);

			if (csvData.length === 0) {
				console.log(`ℹ️ No data found for ${dataSource.name}`);
				return { nodesCreated: 0, relationshipsCreated: 0, errors: [], unknownNodes: [] };
			}

			// Apply reduced mode if enabled
			const dataToProcess = reducedMode ? csvData.slice(0, 10) : csvData;
			console.log(`📥 Processing ${dataToProcess.length} rows from ${dataSource.name}${reducedMode ? " (REDUCED MODE)" : ""}`);

			// Process the data based on source type
			const result = await this.processDataSourceByType(dataSource.name, dataToProcess);
			nodesCreated = result.nodesCreated;
			relationshipsCreated = result.relationshipsCreated;

			if (result.errors.length > 0) {
				errors.push(...result.errors);
			}

			if (result.unknownNodes.length > 0) {
				unknownNodes.push(...result.unknownNodes);
			}
		} catch (error) {
			const errorMsg = `Failed to process ${dataSource.name}: ${error.message}`;
			errors.push(errorMsg);
			this.logError(errorMsg, error);
		}

		return { nodesCreated, relationshipsCreated, errors, unknownNodes };
	}

	async processDataSourceByType(sourceName, csvData) {
		let nodesCreated = 0;
		let relationshipsCreated = 0;
		const errors = [];
		const unknownNodes = [];

		try {
			switch (sourceName) {
				case "TBL_Players":
					nodesCreated = await neo4jService.createPlayerNodes(csvData);
					break;
				case "TBL_FixturesAndResults":
					nodesCreated = await neo4jService.createFixtureNodes(csvData);
					break;
				case "TBL_MatchDetails":
					nodesCreated = await neo4jService.createMatchDetailNodes(csvData);
					break;
				case "TBL_SiteDetails":
					nodesCreated = await neo4jService.createSiteDetailNodes(csvData);
					break;
				case "TBL_WeeklyTOTW":
					nodesCreated = await neo4jService.createWeeklyTOTWNodes(csvData);
					break;
				case "TBL_SeasonTOTW":
					nodesCreated = await neo4jService.createSeasonTOTWNodes(csvData);
					break;
				case "TBL_PlayersOfTheMonth":
					nodesCreated = await neo4jService.createPlayerOfTheMonthNodes(csvData);
					break;
				case "TBL_CaptainsAndAwards":
					nodesCreated = await neo4jService.createCaptainAndAwardNodes(csvData);
					break;
				case "TBL_OppositionDetails":
					nodesCreated = await neo4jService.createOppositionDetailNodes(csvData);
					break;
				case "TBL_TestData":
					nodesCreated = await neo4jService.createTestDataNodes(csvData);
					break;
				default:
					console.log(`⚠️ Unknown data source: ${sourceName}`);
			}
		} catch (error) {
			errors.push(`Failed to process ${sourceName}: ${error.message}`);
		}

		return { nodesCreated, relationshipsCreated, errors, unknownNodes };
	}
}

const dataSeederService = DataSeederService.getInstance();

module.exports = {
	DataSeederService,
	dataSeederService,
};
