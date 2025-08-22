import { neo4jService } from "@/lib/neo4j";
import { dataService, CSVRow, DataSource } from "./dataService";
import { csvHeaderValidator, CSVHeaderValidationResult } from "./csvHeaderValidator";
import { emailService, CSVHeaderValidationFailure } from "./emailService";
import { getEmailConfig } from "@/lib/config/emailConfig";
import * as fs from "fs";
import * as path from "path";

export interface SeedingResult {
	success: boolean;
	nodesCreated: number;
	relationshipsCreated: number;
	errors: string[];
	unknownNodes: string[];
}

export class DataSeederService {
	private static instance: DataSeederService;
	private errorLogPath: string;

	constructor() {
		this.errorLogPath = path.join(process.cwd(), "logs", "seeding-errors.log");
		this.ensureLogDirectory();
	}

	static getInstance(): DataSeederService {
		if (!DataSeederService.instance) {
			DataSeederService.instance = new DataSeederService();
		}
		return DataSeederService.instance;
	}

	private ensureLogDirectory(): void {
		const logDir = path.dirname(this.errorLogPath);
		if (!fs.existsSync(logDir)) {
			fs.mkdirSync(logDir, { recursive: true });
		}
	}

	private logError(message: string, details?: any): void {
		const timestamp = new Date().toISOString();
		const logEntry = `[${timestamp}] ${message}${details ? "\nDetails: " + JSON.stringify(details, null, 2) : ""}\n`;

		try {
			fs.appendFileSync(this.errorLogPath, logEntry);
			console.log(`📝 Error logged to: ${this.errorLogPath}`);
		} catch (error) {
			console.error("Failed to write to error log:", error);
		}
	}

	private logConsoleError(message: string, details?: any): void {
		// Log to console with ❌ symbol
		console.error(`❌ ${message}`);

		// Also log to error file
		this.logError(message, details);
	}

	async seedAllData(dataSources: DataSource[], reducedMode: boolean = false): Promise<SeedingResult> {
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
					await emailService.sendCSVHeaderValidationFailure(headerValidationResult.failures);
					console.log("📧 Email notification sent for CSV header validation failures");
				} catch (emailError) {
					console.error("❌ Failed to send email notification:", emailError instanceof Error ? emailError.message : String(emailError));
				}

				return {
					success: false,
					nodesCreated: 0,
					relationshipsCreated: 0,
					errors: [errorMsg],
					unknownNodes: [],
				};
			}

			console.log("✅ CSV header validation passed");

			// Step 3: Process each data source
			console.log("🌱 Step 3: Processing data sources...");
			let totalNodesCreated = 0;
			let totalRelationshipsCreated = 0;
			const allErrors: string[] = [];
			const allUnknownNodes: string[] = [];

			for (const dataSource of dataSources) {
				try {
					console.log(`\n📊 Processing: ${dataSource.name}`);
					
					// Get maxRows from dataSource if available, default to 50 for reduced mode
					const maxRows = reducedMode ? (dataSource.maxRows || 50) : 0;
					
					// Fetch CSV data with reduced mode if specified
					const csvData = await dataService.fetchCSVData(dataSource, reducedMode, maxRows);
					
					if (csvData.length === 0) {
						console.log(`ℹ️ No data found for ${dataSource.name}`);
						continue;
					}

					console.log(`📥 Fetched ${csvData.length} rows from ${dataSource.name}`);

					// Process the data
					const result = await this.processDataSource(dataSource.name, csvData);
					
					totalNodesCreated += result.nodesCreated;
					totalRelationshipsCreated += result.relationshipsCreated;
					
					if (result.errors.length > 0) {
						allErrors.push(...result.errors);
					}
					
					if (result.unknownNodes.length > 0) {
						allUnknownNodes.push(...result.unknownNodes);
					}

					console.log(`✅ ${dataSource.name}: ${result.nodesCreated} nodes, ${result.relationshipsCreated} relationships`);
				} catch (error) {
					const errorMsg = `Failed to process ${dataSource.name}: ${error instanceof Error ? error.message : String(error)}`;
					console.error(`❌ ${errorMsg}`);
					this.logError(errorMsg, { dataSource, error: error instanceof Error ? error.message : String(error) });
					allErrors.push(errorMsg);
				}
			}

			// Step 4: Create relationships between nodes
			console.log("\n🔗 Step 4: Creating relationships...");
			const relationshipResult = await this.createAllRelationships();
			totalRelationshipsCreated += relationshipResult;

			console.log(`\n🎉 Seeding completed with summary:`);
			console.log(`📊 Total nodes created: ${totalNodesCreated}`);
			console.log(`🔗 Total relationships created: ${totalRelationshipsCreated}`);
			console.log(`❌ Total errors: ${allErrors.length}`);
			console.log(`❓ Total unknown nodes: ${allUnknownNodes.length}`);

			// Log final summary
			this.logError("Seeding completed with summary:", {
				totalNodes: totalNodesCreated,
				totalRelationships: totalRelationshipsCreated,
				errors: allErrors.length,
				unknownNodes: allUnknownNodes.length,
				success: allErrors.length === 0,
			});

			return {
				success: allErrors.length === 0,
				nodesCreated: totalNodesCreated,
				relationshipsCreated: totalRelationshipsCreated,
				errors: allErrors,
				unknownNodes: allUnknownNodes,
			};
		} catch (error) {
			const errorMsg = `Seeding process failed: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`❌ ${errorMsg}`);
			this.logError(errorMsg, { error: error instanceof Error ? error.message : String(error) });

			return {
				success: false,
				nodesCreated: 0,
				relationshipsCreated: 0,
				errors: [errorMsg],
				unknownNodes: [],
			};
		}
	}

	private async processDataSource(sourceName: string, csvData: CSVRow[]): Promise<{ nodesCreated: number; relationshipsCreated: number; errors: string[]; unknownNodes: string[] }> {
		console.log(`🔄 Processing ${sourceName} with ${csvData.length} rows...`);
		
		let nodesCreated = 0;
		let relationshipsCreated = 0;
		const errors: string[] = [];
		const unknownNodes: string[] = [];

		try {
			// Ensure Neo4j connection
			const connected = await neo4jService.connect();
			if (!connected) {
				throw new Error("Failed to connect to Neo4j database");
			}

			// Clear existing data for this source if it's the first run
			if (sourceName === "TBL_Players") {
				console.log("🗑️ Clearing existing graph data...");
				await neo4jService.clearGraphData();
				
				// Apply schema constraints and indexes
				console.log("🏗️ Applying database schema...");
				await this.applySchema();
			}

			// Create nodes for this data source
			const nodeResult = await this.createNodesForDataSource(sourceName, csvData);
			nodesCreated = nodeResult.nodesCreated;

			// Check for unknown nodes
			nodeResult.createdNodes.forEach((node) => {
				if (node.id.includes("unknown") || JSON.stringify(node.properties).includes("unknown")) {
					unknownNodes.push(`${node.nodeLabel}: ${node.id}`);
					this.logError(`Unknown node detected: ${node.nodeLabel} - ${node.id}`, node.properties);
				}
			});

			// Note: Relationships will be created after all nodes are created
			console.log(`ℹ️ Relationships for ${sourceName} will be created after all nodes are processed`);

			console.log(`✅ ${sourceName}: ${nodesCreated} nodes, ${relationshipsCreated} relationships created`);
		} catch (error) {
			const errorMsg = `Failed to process ${sourceName}: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`❌ ${errorMsg}`);
			this.logError(errorMsg, { sourceName, dataLength: csvData.length, error: error instanceof Error ? error.message : String(error) });
			errors.push(errorMsg);
		}

		return { nodesCreated, relationshipsCreated, errors, unknownNodes };
	}

	private async createAllRelationships(): Promise<number> {
		console.log("🔗 Creating relationships between all nodes...");
		let totalRelationships = 0;

		try {
			// Get all nodes from the database to create relationships
			const allNodesQuery = `
				MATCH (n {graphLabel: 'dorkiniansWebsite'})
				RETURN n.id as id, labels(n)[0] as label, n
				ORDER BY labels(n)[0], n.id
			`;
			
			const allNodesResult = await neo4jService.runQuery(allNodesQuery);
			console.log(`📊 Found ${allNodesResult.records.length} nodes to process for relationships`);
			
			// Group nodes by type
			const nodesByType: { [key: string]: any[] } = {};
			allNodesResult.records.forEach(record => {
				const label = record.get("label");
				const nodeData = record.get("n").properties;
				if (!nodesByType[label]) {
					nodesByType[label] = [];
				}
				nodesByType[label].push(nodeData);
			});
			
			// Create relationships for each node type
			for (const [nodeType, nodes] of Object.entries(nodesByType)) {
				console.log(`🔗 Processing ${nodeType} nodes for relationships...`);
				
				// Map Neo4j labels back to source names for relationship creation
				const sourceName = this.mapNodeLabelToSourceName(nodeType);
				
				for (const node of nodes) {
					try {
						const relationshipsCreatedForNode = await this.createRelationshipsForNode({
							id: node.id,
							properties: node,
							sourceName: sourceName,
							nodeLabel: nodeType
						});
						totalRelationships += relationshipsCreatedForNode;
						
						if (relationshipsCreatedForNode === 0) {
							console.log(`ℹ️ No relationships created for ${nodeType}: ${node.id}`);
						}
					} catch (error) {
						console.warn(`⚠️ Failed to create relationships for ${nodeType} ${node.id}: ${error instanceof Error ? error.message : String(error)}`);
					}
				}
			}
			
			console.log(`✅ Created ${totalRelationships} total relationships`);
		} catch (error) {
			console.error(`❌ Error creating relationships: ${error instanceof Error ? error.message : String(error)}`);
		}

		return totalRelationships;
	}

	private async applySchema(): Promise<void> {
		try {
			// Apply constraints
			console.log("📋 Applying constraints...");
			const constraints = [
				"CREATE CONSTRAINT player_id_unique IF NOT EXISTS FOR (p:Player) REQUIRE p.id IS UNIQUE",
				"CREATE CONSTRAINT player_name_unique IF NOT EXISTS FOR (p:Player) REQUIRE p.name IS UNIQUE",
				"CREATE CONSTRAINT team_id_unique IF NOT EXISTS FOR (t:Team) REQUIRE t.id IS UNIQUE",
				"CREATE CONSTRAINT team_season_name_unique IF NOT EXISTS FOR (t:Team) REQUIRE (t.season, t.name) IS UNIQUE",
				"CREATE CONSTRAINT season_id_unique IF NOT EXISTS FOR (s:Season) REQUIRE s.id IS UNIQUE",
				"CREATE CONSTRAINT fixture_id_unique IF NOT EXISTS FOR (f:Fixture) REQUIRE f.id IS UNIQUE",
				"CREATE CONSTRAINT fixture_season_id_unique IF NOT EXISTS FOR (f:Fixture) REQUIRE (f.season, f.seasonFixId) IS UNIQUE",
				"CREATE CONSTRAINT matchdetail_id_unique IF NOT EXISTS FOR (md:MatchDetail) REQUIRE md.id IS UNIQUE",
				"CREATE CONSTRAINT matchdetail_fixture_player_unique IF NOT EXISTS FOR (md:MatchDetail) REQUIRE (md.fixtureId, md.playerName) IS UNIQUE",
				"CREATE CONSTRAINT totw_id_unique IF NOT EXISTS FOR (t:TOTW) REQUIRE t.id IS UNIQUE",
				"CREATE CONSTRAINT totw_season_week_unique IF NOT EXISTS FOR (t:TOTW) REQUIRE (t.season, t.week) IS UNIQUE",
				"CREATE CONSTRAINT season_totw_id_unique IF NOT EXISTS FOR (st:SeasonTOTW) REQUIRE st.id IS UNIQUE",
				"CREATE CONSTRAINT season_totw_season_unique IF NOT EXISTS FOR (st:SeasonTOTW) REQUIRE st.season IS UNIQUE",
				"CREATE CONSTRAINT playerofmonth_id_unique IF NOT EXISTS FOR (pom:PlayerOfTheMonth) REQUIRE pom.id IS UNIQUE",
				"CREATE CONSTRAINT opposition_id_unique IF NOT EXISTS FOR (o:OppositionDetail) REQUIRE o.id IS UNIQUE",
			];

			for (const constraint of constraints) {
				try {
					await neo4jService.runQuery(constraint);
				} catch (error) {
					if (error instanceof Error && !error.message.includes("already exists")) {
						console.warn(`⚠️ Constraint issue: ${constraint.split(" ")[2]} - ${error.message}`);
					}
				}
			}

			// Apply indexes
			console.log("📊 Applying indexes...");
			const indexes = [
				"CREATE INDEX player_name_index IF NOT EXISTS FOR (p:Player) ON (p.name)",
				"CREATE INDEX player_allowonsite_index IF NOT EXISTS FOR (p:Player) ON (p.allowOnSite)",
				"CREATE INDEX team_name_index IF NOT EXISTS FOR (t:Team) ON (t.name)",
				"CREATE INDEX team_season_index IF NOT EXISTS FOR (t:Team) ON (t.season)",
				"CREATE INDEX team_league_index IF NOT EXISTS FOR (t:Team) ON (t.league)",
				"CREATE INDEX season_startyear_index IF NOT EXISTS FOR (s:Season) ON (s.startYear)",
				"CREATE INDEX season_endyear_index IF NOT EXISTS FOR (s:Season) ON (s.endYear)",
				"CREATE INDEX season_active_index IF NOT EXISTS FOR (s:Season) ON (s.isActive)",
				"CREATE INDEX fixture_date_index IF NOT EXISTS FOR (f:Fixture) ON (f.date)",
				"CREATE INDEX fixture_season_index IF NOT EXISTS FOR (f:Fixture) ON (f.season)",
				"CREATE INDEX fixture_hometeam_index IF NOT EXISTS FOR (f:Fixture) ON (f.homeTeam)",
				"CREATE INDEX fixture_awayteam_index IF NOT EXISTS FOR (f:Fixture) ON (f.awayTeam)",
				"CREATE INDEX fixture_result_index IF NOT EXISTS FOR (f:Fixture) ON (f.result)",
				"CREATE INDEX fixture_competition_index IF NOT EXISTS FOR (f:Fixture) ON (f.competition)",
				"CREATE INDEX fixture_conceded_index IF NOT EXISTS FOR (f:Fixture) ON (f.conceded)",
				"CREATE INDEX matchdetail_player_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.playerName)",
				"CREATE INDEX matchdetail_team_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.team)",
				"CREATE INDEX matchdetail_date_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.date)",
				"CREATE INDEX matchdetail_fixtureid_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.fixtureId)",
				"CREATE INDEX matchdetail_class_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.class)",
				"CREATE INDEX matchdetail_goals_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.goals)",
				"CREATE INDEX matchdetail_assists_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.assists)",
				"CREATE INDEX matchdetail_manofmatch_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.manOfMatch)",
				"CREATE INDEX matchdetail_yellowcards_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.yellowCards)",
				"CREATE INDEX matchdetail_redcards_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.redCards)",
				"CREATE INDEX matchdetail_saves_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.saves)",
				"CREATE INDEX matchdetail_owngoals_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.ownGoals)",
				"CREATE INDEX matchdetail_penaltiesscored_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.penaltiesScored)",
				"CREATE INDEX matchdetail_penaltiesmissed_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.penaltiesMissed)",
				"CREATE INDEX matchdetail_penaltiesconceded_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.penaltiesConceded)",
				"CREATE INDEX matchdetail_penaltiessaved_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.penaltiesSaved)",
				"CREATE INDEX totw_season_index IF NOT EXISTS FOR (t:TOTW) ON (t.season)",
				"CREATE INDEX totw_week_index IF NOT EXISTS FOR (t:TOTW) ON (t.week)",
				"CREATE INDEX totw_starman_index IF NOT EXISTS FOR (t:TOTW) ON (t.starMan)",
				"CREATE INDEX totw_seasonweek_index IF NOT EXISTS FOR (t:TOTW) ON (t.seasonWeekNumRef)",
				"CREATE INDEX season_totw_season_index IF NOT EXISTS FOR (st:SeasonTOTW) ON (st.season)",
				"CREATE INDEX season_totw_starman_index IF NOT EXISTS FOR (st:SeasonTOTW) ON (st.starMan)",
				"CREATE INDEX playerofmonth_season_index IF NOT EXISTS FOR (pom:PlayerOfTheMonth) ON (pom.season)",
				"CREATE INDEX playerofmonth_month_index IF NOT EXISTS FOR (pom:PlayerOfTheMonth) ON (pom.month)",
				"CREATE INDEX playerofmonth_seasonmonth_index IF NOT EXISTS FOR (pom:PlayerOfTheMonth) ON (pom.seasonMonthRef)",
				"CREATE INDEX opposition_league_index IF NOT EXISTS FOR (o:OppositionDetail) ON (o.league)",
				"CREATE INDEX opposition_division_index IF NOT EXISTS FOR (o:OppositionDetail) ON (o.division)",
			];

			for (const index of indexes) {
				try {
					await neo4jService.runQuery(index);
				} catch (error) {
					if (error instanceof Error && !error.message.includes("already exists")) {
						console.warn(`⚠️ Index issue: ${index.split(" ")[2]} - ${error.message}`);
					}
				}
			}

			console.log("✅ Schema applied successfully");
		} catch (error) {
			const errorMsg = `Failed to apply schema: ${error instanceof Error ? error.message : String(error)}`;
			this.logConsoleError(errorMsg, { error: error instanceof Error ? error.message : String(error) });
			throw error;
		}
	}

	private async createNodesForDataSource(
		sourceName: string,
		data: CSVRow[],
	): Promise<{ nodesCreated: number; createdNodes: Array<{ id: string; properties: any; sourceName: string; nodeLabel: string }> }> {
		let nodesCreated = 0;
		const createdNodes: Array<{ id: string; properties: any; sourceName: string; nodeLabel: string }> = [];

		// Map table names to semantic node labels
		const getNodeLabel = (tableName: string): string => {
			if (tableName.includes("Player")) return "Player";
			if (tableName.includes("FixturesAndResults")) return "Fixture";
			if (tableName.includes("MatchDetails")) return "MatchDetail";
			if (tableName.includes("WeeklyTOTW")) return "TOTW";
			if (tableName.includes("SeasonTOTW")) return "SeasonTOTW";
			if (tableName.includes("PlayersOfTheMonth")) return "PlayerOfTheMonth";
			// StatDetails is handled as table data, not graph nodes
			if (tableName.includes("OppositionDetails")) return "OppositionDetail";
			if (tableName.includes("SiteDetails")) return "SiteDetail";
			return tableName; // fallback to table name if no match
		};

		const nodeLabel = getNodeLabel(sourceName);
		console.log(`🏷️ Using node label: ${nodeLabel} for table: ${sourceName}`);

		// Create nodes for each row
		for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
			const row = data[rowIndex];
			try {
				// Validate ID format before processing
				const validationErrors = this.validateRowIDs(row, sourceName);
				if (validationErrors.length > 0) {
					console.error(`❌ ID validation failed for row ${rowIndex} in ${sourceName}:`);
					validationErrors.forEach(error => console.error(`  ${error}`));
					this.logError(`ID validation failed for row ${rowIndex} in ${sourceName}`, { row, validationErrors, rowIndex });
					continue; // Skip invalid rows
				}

				// Map CSV data to schema properties
				const mappedProperties = this.mapCSVToSchema(sourceName, row, rowIndex);

				// Skip rows that return null (invalid data)
				if (!mappedProperties) {
					console.log(`ℹ️ Skipping row ${rowIndex} in ${sourceName}: Invalid data`);
					continue;
				}

				// Validate that we have a unique ID
				if (!mappedProperties.id || mappedProperties.id.includes("unknown-unknown")) {
					console.warn(`⚠️ Skipping row ${rowIndex} in ${sourceName}: Invalid ID generated: ${mappedProperties.id}`);
					continue;
				}

				// Check if node already exists to prevent duplicates
				const existingNode = await this.checkNodeExists(nodeLabel, mappedProperties.id);
				if (existingNode) {
					console.log(`ℹ️ Skipping row ${rowIndex} in ${sourceName}: Node already exists with ID: ${mappedProperties.id}`);
					continue;
				}

				// Create main entity node with semantic label
				const nodeId = await neo4jService.createNode(nodeLabel, mappedProperties);

				if (nodeId) {
					nodesCreated++;
					createdNodes.push({
						id: nodeId,
						properties: mappedProperties,
						sourceName,
						nodeLabel,
					});
					console.log(`✅ Created ${nodeLabel} node: ${mappedProperties.id}`);
				}
			} catch (error) {
				console.warn(`⚠️ Failed to process row ${rowIndex} in ${sourceName}:`, error);
			}
		}

		return { nodesCreated, createdNodes };
	}

	private async createRelationshipsForNode(node: { id: string; properties: any; sourceName: string; nodeLabel: string }): Promise<number> {
		let relationshipsCreated = 0;

		try {
			if (node.sourceName.includes("Player")) {
				console.log(`🔗 Creating Player relationships for: ${node.properties.name}`);
				relationshipsCreated = await this.createPlayerRelationships(node.properties, node.id);
			} else if (node.sourceName.includes("FixturesAndResults")) {
				console.log(`🔗 Creating Fixture relationships for: ${node.properties.id}`);
				relationshipsCreated = await this.createFixtureRelationships(node.properties, node.id);
			} else if (node.sourceName.includes("MatchDetails")) {
				console.log(`🔗 Creating MatchDetail relationships for: ${node.properties.id}`);
				relationshipsCreated = await this.createMatchDetailRelationships(node.properties, node.id);
			} else if (node.sourceName.includes("WeeklyTOTW") || node.sourceName.includes("SeasonTOTW")) {
				console.log(`🔗 Creating TOTW relationships for: ${node.properties.id}`);
				relationshipsCreated = await this.createTOTWRelationships(node.properties, node.id);
			} else if (node.sourceName.includes("PlayersOfTheMonth")) {
				console.log(`🔗 Creating PlayerOfMonth relationships for: ${node.properties.id}`);
				relationshipsCreated = await this.createPlayerOfMonthRelationships(node.properties, node.id);
			} else {
				console.log(`ℹ️ No relationship creation for source: ${node.sourceName}`);
			}

			if (relationshipsCreated > 0) {
				console.log(`  ✅ Created ${relationshipsCreated} relationships for ${node.properties.id}`);
			}
		} catch (error) {
			console.warn(`⚠️ Failed to create relationships for node ${node.id}:`, error);
		}

		return relationshipsCreated;
	}

	private mapCSVToSchema(sourceName: string, row: CSVRow, rowIndex: number): any {
		// Use the explicit ID column from the CSV instead of generating IDs
		const explicitId = String(row["ID"] || "");
		
		if (!explicitId || explicitId.trim() === "") {
			console.warn(`⚠️ Skipping row ${rowIndex}: No ID found`);
			return null;
		}

		// Map CSV data based on source name using explicit IDs
		switch (sourceName) {
			case "TBL_Players":
				return this.mapPlayerData(row, explicitId);

			case "TBL_FixturesAndResults":
				return this.mapFixtureData(row, explicitId);

			case "TBL_MatchDetails":
				return this.mapMatchDetailData(row, explicitId);

			case "TBL_WeeklyTOTW":
				return this.mapWeeklyTOTWData(row, explicitId);

			case "TBL_SeasonTOTW":
				return this.mapSeasonTOTWData(row, explicitId);

			case "TBL_PlayersOfTheMonth":
				return this.mapPlayerOfMonthData(row, explicitId);

			case "TBL_OppositionDetails":
				return this.mapOppositionDetailData(row, explicitId);

			default:
				console.warn(`⚠️ Unknown source type: ${sourceName}`);
				return null;
		}
	}

	private mapPlayerData(row: CSVRow, explicitId: string): any {
		const playerName = String(row["PLAYER NAME"] || "");
		const allowOnSite = String(row["ALLOW ON SITE"] || "").toUpperCase() === "TRUE";
		const mostPlayedForTeam = String(row["MOST PLAYED FOR TEAM"] || "");
		const mostCommonPosition = String(row["MOST COMMON POSITION"] || "");

		// Skip players who are not allowed on site
		if (!allowOnSite) {
			console.log(`ℹ️ Skipping player ${playerName}: ALLOW ON SITE = FALSE`);
			return null;
		}

		// Skip players with blank team or position values
		if (!mostPlayedForTeam || mostPlayedForTeam.trim() === "" || !mostCommonPosition || mostCommonPosition.trim() === "") {
			console.log(`ℹ️ Skipping player ${playerName}: Missing team or position data`);
			return null;
		}

		return {
			id: explicitId,
			name: playerName,
			allowOnSite: true,
			mostPlayedForTeam: mostPlayedForTeam,
			mostCommonPosition: mostCommonPosition,
			graphLabel: "dorkiniansWebsite",
			createdAt: new Date().toISOString(),
		};
	}

	private mapFixtureData(row: CSVRow, explicitId: string): any {
		const season = String(row["SEASON"] || "");
		const date = String(row["DATE"] || "");
		const team = String(row["TEAM"] || "");
		const compType = String(row["COMP TYPE"] || "");
		const competition = String(row["COMPETITION"] || "");
		const opposition = String(row["OPPOSITION"] || "");
		const homeAway = String(row["HOME/AWAY"] || "");
		const result = String(row["RESULT"] || "");
		const homeScore = this.parseNumber(row["HOME SCORE"]);
		const awayScore = this.parseNumber(row["AWAY SCORE"]);
		const conceded = this.parseNumber(row["CONCEDED"]);

		// Skip fixtures when COMP TYPE or COMPETITION is "-" or OPPOSITION is "No Game"
		if (compType === "-" || opposition === "No Game" || competition === "-") {
			console.log(`ℹ️ Skipping fixture ${explicitId}: COMP TYPE="${compType}", OPPOSITION="${opposition}"`);
			return null;
		}

		return {
			id: explicitId,
			season: season,
			date: date,
			team: team,
			compType: compType,
			competition: competition,
			opposition: opposition,
			homeAway: homeAway,
			result: result,
			homeScore: homeScore,
			awayScore: awayScore,
			conceded: conceded,
			graphLabel: "dorkiniansWebsite",
			createdAt: new Date().toISOString(),
		};
	}

	private mapMatchDetailData(row: CSVRow, explicitId: string): any {
		const season = String(row["SEASON"] || "");
		const date = String(row["DATE"] || "");
		const team = String(row["TEAM"] || "");
		const playerName = String(row["PLAYER NAME"] || "");
		const minutes = this.parseNumber(row["MIN"]);
		const position = String(row["CLASS"] || "");
		const manOfMatch = this.parseNumber(row["MOM"]);
		const goals = this.parseNumber(row["G"]);
		const assists = this.parseNumber(row["A"]);
		const yellowCards = this.parseNumber(row["Y"]);
		const redCards = this.parseNumber(row["R"]);
		const saves = this.parseNumber(row["SAVES"]);
		const ownGoals = this.parseNumber(row["OG"]);
		const penaltiesScored = this.parseNumber(row["PSC"]);
		const penaltiesMissed = this.parseNumber(row["PM"]);
		const penaltiesConceded = this.parseNumber(row["PCO"]);
		const penaltiesSaved = this.parseNumber(row["PSV"]);

		// Extract fixture ID from the explicit ID (format: matchdetail__{fixtureID}__{playerName})
		// Use double underscore separator for clean, unambiguous parsing
		// Split on double underscores to get fixture ID and player name
		const parts = explicitId.split('__');
		
		let fixtureId: string;
		if (parts.length === 3 && parts[0] === 'matchdetail') {
			// Format: matchdetail__{fixtureID}__{playerName}
			fixtureId = parts[1];
		} else {
			// Fallback: try to extract using old logic for backward compatibility
			const withoutPrefix = explicitId.replace(/^matchdetail-/, "");
			const homeAwayPlayerPattern = /-(home|away)-([a-zA-Z_-]+)$/;
			const match = withoutPrefix.match(homeAwayPlayerPattern);
			
			if (match) {
				const playerNameWithSeparator = `-${match[2]}`;
				fixtureId = withoutPrefix.replace(playerNameWithSeparator, "");
			} else {
				// Last resort: use last underscore
				const lastUnderscoreIndex = withoutPrefix.lastIndexOf("_");
				fixtureId = lastUnderscoreIndex !== -1 ? withoutPrefix.substring(0, lastUnderscoreIndex) : withoutPrefix;
			}
		}

		return {
			id: explicitId,
			fixtureId: fixtureId,
			playerName: playerName,
			team: team,
			season: season,
			date: date,
			class: position,
			minutes: minutes,
			goals: goals,
			assists: assists,
			manOfMatch: manOfMatch,
			yellowCards: yellowCards,
			redCards: redCards,
			saves: saves,
			ownGoals: ownGoals,
			penaltiesScored: penaltiesScored,
			penaltiesMissed: penaltiesMissed,
			penaltiesConceded: penaltiesConceded,
			penaltiesSaved: penaltiesSaved,
			graphLabel: "dorkiniansWebsite",
			createdAt: new Date().toISOString(),
		};
	}

	private mapWeeklyTOTWData(row: CSVRow, explicitId: string): any {
		const season = String(row["SEASON"] || "");
		const week = String(row["WEEK"] || "");
		const totwScore = this.parseNumber(row["TOTW SCORE"]);
		const playerCount = this.parseNumber(row["PLAYER COUNT"]);
		const starMan = String(row["STAR MAN"] || "");
		const starManScore = this.parseNumber(row["STAR MAN SCORE"]);

		// Map all player positions
		const playerPositions = {
			gk1: String(row["GK1"] || ""),
			def1: String(row["DEF1"] || ""),
			def2: String(row["DEF2"] || ""),
			def3: String(row["DEF3"] || ""),
			def4: String(row["DEF4"] || ""),
			def5: String(row["DEF5"] || ""),
			mid1: String(row["MID1"] || ""),
			mid2: String(row["MID2"] || ""),
			mid3: String(row["MID3"] || ""),
			mid4: String(row["MID4"] || ""),
			mid5: String(row["MID5"] || ""),
			fwd1: String(row["FWD1"] || ""),
			fwd2: String(row["FWD2"] || ""),
			fwd3: String(row["FWD3"] || ""),
		};

		return {
			id: explicitId,
			season: season,
			week: week,
			totwScore: totwScore,
			playerCount: playerCount,
			starMan: starMan,
			starManScore: starManScore,
			...playerPositions,
			graphLabel: "dorkiniansWebsite",
			createdAt: new Date().toISOString(),
		};
	}

	private mapSeasonTOTWData(row: CSVRow, explicitId: string): any {
		const season = String(row["SEASON"] || "");
		const totwScore = this.parseNumber(row["TOTW SCORE"]);
		const starMan = String(row["STAR MAN"] || "");
		const starManScore = this.parseNumber(row["STAR MAN SCORE"]);

		// Map all player positions
		const playerPositions = {
			gk1: String(row["GK1"] || ""),
			def1: String(row["DEF1"] || ""),
			def2: String(row["DEF2"] || ""),
			def3: String(row["DEF3"] || ""),
			def4: String(row["DEF4"] || ""),
			def5: String(row["DEF5"] || ""),
			mid1: String(row["MID1"] || ""),
			mid2: String(row["MID2"] || ""),
			mid3: String(row["MID3"] || ""),
			mid4: String(row["MID4"] || ""),
			mid5: String(row["MID5"] || ""),
			fwd1: String(row["FWD1"] || ""),
			fwd2: String(row["FWD2"] || ""),
			fwd3: String(row["FWD3"] || ""),
		};

		return {
			id: explicitId,
			season: season,
			totwScore: totwScore,
			starMan: starMan,
			starManScore: starManScore,
			...playerPositions,
			graphLabel: "dorkiniansWebsite",
			createdAt: new Date().toISOString(),
		};
	}

	private mapPlayerOfMonthData(row: CSVRow, explicitId: string): any {
		const season = String(row["SEASON"] || "");
		const date = String(row["DATE"] || "");

		// Map all player rankings
		const playerRankings = {
			player1Name: String(row["#1 Name"] || ""),
			player1Points: this.parseNumber(row["#1 Points"]),
			player2Name: String(row["#2 Name"] || ""),
			player2Points: this.parseNumber(row["#2 Points"]),
			player3Name: String(row["#3 Name"] || ""),
			player3Points: this.parseNumber(row["#3 Points"]),
			player4Name: String(row["#4 Name"] || ""),
			player4Points: this.parseNumber(row["#4 Points"]),
			player5Name: String(row["#5 Name"] || ""),
			player5Points: this.parseNumber(row["#5 Points"]),
		};

		// Extract month from date or ID
		let month = "";
		if (date) {
			month = date;
		} else if (explicitId.includes("-")) {
			const parts = explicitId.split("-");
			month = parts[parts.length - 1] || "";
		}

		return {
			id: explicitId,
			season: season,
			month: month,
			...playerRankings,
			graphLabel: "dorkiniansWebsite",
			createdAt: new Date().toISOString(),
		};
	}

	private mapOppositionDetailData(row: CSVRow, explicitId: string): any {
		const opposition = String(row["OPPOSITION"] || "");
		const shortTeamName = String(row["SHORT TEAM NAME"] || "");
		const address = String(row["ADDRESS"] || "");
		const distance = String(row["DISTANCE (MILES)"] || "");

		return {
			id: explicitId,
			oppositionName: opposition,
			shortTeamName: shortTeamName,
			address: address,
			distance: distance,
			graphLabel: "dorkiniansWebsite",
			createdAt: new Date().toISOString(),
		};
	}

	private parseNumber(value: any): number | null {
		if (value === null || value === undefined || value === "") return null;
		const num = Number(value);
		return isNaN(num) ? null : num;
	}

	private findColumnValue(row: CSVRow, possibleNames: string[]): any {
		for (const name of possibleNames) {
			if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
				return row[name];
			}
		}
		return null;
	}

	private debugRowKeys(row: CSVRow, rowIndex: number): void {
		console.log(`🚨 DEBUG METHOD CALLED for row ${rowIndex}`);
		if (rowIndex < 3) {
			console.log(`🔍 DEBUG Row ${rowIndex} - All keys:`, Object.keys(row));
			console.log(`🔍 DEBUG Row ${rowIndex} - Sample values:`, Object.entries(row).slice(0, 5));
		}
	}

	private async checkNodeExists(label: string, id: string): Promise<boolean> {
		try {
			const query = `
        MATCH (n:${label} {id: $id, graphLabel: 'dorkiniansWebsite'})
        RETURN n
        LIMIT 1
      `;
			const result = await neo4jService.runQuery(query, { id });
			return result.records.length > 0;
		} catch (error) {
			console.warn(`⚠️ Error checking if node exists: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	private async ensureNodeExists(label: string, properties: any): Promise<string> {
		try {
			// Check if node already exists
			const existingNode = await this.checkNodeExists(label, properties.id);
			if (existingNode) {
				return properties.id;
			}

			// Create the node if it doesn't exist
			const nodeId = await neo4jService.createNode(label, properties);
			if (nodeId) {
				console.log(`✅ Created ${label} node: ${properties.id}`);
				return nodeId;
			}

			throw new Error(`Failed to create ${label} node: ${properties.id}`);
		} catch (error) {
			console.warn(`⚠️ Error ensuring ${label} node exists: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	private async createPlayerRelationships(playerData: CSVRow, playerNodeId: string): Promise<number> {
		console.log(`🔗 Creating Player relationships for: ${playerData.name}`);
		let relationshipsCreated = 0;

		try {
			// Create Player-Team relationship based on mostPlayedForTeam
			if (playerData.mostPlayedForTeam && String(playerData.mostPlayedForTeam).trim() !== "") {
				const teamId = `team-${String(playerData.mostPlayedForTeam).toLowerCase().replace(/\s+/g, "-")}`;

				// Create team node if it doesn't exist
				await neo4jService.createNodeIfNotExists("Team", {
					id: teamId,
					name: playerData.mostPlayedForTeam,
					season: "current", // Default season since we don't have specific season data
					league: "unknown",
					graphLabel: "dorkiniansWebsite",
				});

				// Create PLAYS_FOR relationship
				const playsForRel = await neo4jService.createRelationship(
					"Player",
					{ id: playerNodeId, graphLabel: "dorkiniansWebsite" } as any,
					"PLAYS_FOR",
					"Team",
					{ id: teamId, graphLabel: "dorkiniansWebsite" } as any,
					{
						season: "current",
						startDate: playerData.createdAt || new Date().toISOString(),
						graphLabel: "dorkiniansWebsite",
					},
				);

				if (playsForRel) {
					relationshipsCreated++;
					console.log(`  ✅ Created PLAYS_FOR relationship: ${playerData.name} → ${playerData.mostPlayedForTeam}`);
				} else {
					this.logError(`Failed to create PLAYS_FOR relationship for ${playerData.name}`, { teamId, playerData });
				}
			}

			// Note: Position is stored as a string property on Player nodes, no separate Position nodes needed
		} catch (error) {
			console.warn(
				`⚠️ Failed to create player relationships for ${playerData.name}: ${error instanceof Error ? error.message : String(error)}`,
			);
			this.logError(`Failed to create player relationships for ${playerData.name}`, {
				playerData,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		return relationshipsCreated;
	}

	private async createFixtureRelationships(fixtureData: CSVRow, fixtureNodeId: string): Promise<number> {
		console.log(`🔗 Creating Fixture relationships for: ${fixtureData.id}`);
		let relationshipsCreated = 0;

		try {
			// Create Fixture-Season relationship
			if (fixtureData.season) {
				const seasonId = `season-${String(fixtureData.season).toLowerCase().replace(/\s+/g, "-")}`;

				// Create season node if it doesn't exist - use season string as unique identifier
				await neo4jService.createNodeIfNotExists("Season", {
					id: seasonId,
					name: fixtureData.season,
					startYear: this.extractYear(String(fixtureData.season)),
					endYear: this.extractYear(String(fixtureData.season)) + 1,
					isActive: false,
				});

				// Create BELONGS_TO relationship
				const belongsToRel = await neo4jService.createRelationship(
					"Fixture",
					{ id: fixtureNodeId, graphLabel: "dorkiniansWebsite" } as any,
					"BELONGS_TO",
					"Season",
					{ id: seasonId, graphLabel: "dorkiniansWebsite" } as any,
					{ graphLabel: "dorkiniansWebsite" },
				);

				if (belongsToRel) {
					relationshipsCreated++;
					console.log(`  ✅ Created BELONGS_TO relationship: ${fixtureData.id} → ${fixtureData.season}`);
				} else {
					this.logError(`Failed to create BELONGS_TO relationship for ${fixtureData.id}`, { seasonId, fixtureData });
				}
			}

			// Create Fixture-Competition relationship
			if (fixtureData.competition && fixtureData.competition !== "-") {
				try {
					const competitionId = `competition-${String(fixtureData.competition).toLowerCase().replace(/\s+/g, "-")}`;

					await neo4jService.createNodeIfNotExists("Competition", {
						id: competitionId,
						name: fixtureData.competition,
					});

					const competitionRel = await neo4jService.createRelationship(
						"Fixture",
						{ id: fixtureNodeId, graphLabel: "dorkiniansWebsite" } as any,
						"IN_COMPETITION",
						"Competition",
						{ id: competitionId, graphLabel: "dorkiniansWebsite" } as any,
						{ graphLabel: "dorkiniansWebsite" },
					);

					if (competitionRel) {
						relationshipsCreated++;
						console.log(`  ✅ Created IN_COMPETITION relationship: ${fixtureData.id} → ${fixtureData.competition}`);
					} else {
						this.logError(`Failed to create IN_COMPETITION relationship for ${fixtureData.id}`, { competitionId, fixtureData });
					}
				} catch (error) {
					const errorMsg = `Failed to create competition relationship for fixture ${fixtureData.id}: ${error instanceof Error ? error.message : String(error)}`;
					console.warn(`⚠️ ${errorMsg}`);
					this.logError(errorMsg, {
						fixtureId: fixtureData.id,
						competition: fixtureData.competition,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			// Create Team-Season relationships for both home and away teams
			if (fixtureData.team) {
				const teamId = `team-${String(fixtureData.team).toLowerCase().replace(/\s+/g, "-")}`;

				// Create team node if it doesn't exist
				await neo4jService.createNodeIfNotExists("Team", {
					id: teamId,
					name: fixtureData.team,
					season: fixtureData.season || "unknown",
					league: "unknown",
				});

				// Create PARTICIPATES_IN relationship
				if (fixtureData.season) {
					const seasonId = `season-${String(fixtureData.season).toLowerCase().replace(/\s+/g, "-")}`;
					const teamSeasonRel = await neo4jService.createRelationship(
						"Team",
						{ id: teamId, graphLabel: "dorkiniansWebsite" } as any,
						"PARTICIPATES_IN",
						"Season",
						{ id: seasonId, graphLabel: "dorkiniansWebsite" } as any,
						{ graphLabel: "dorkiniansWebsite" },
					);

					if (teamSeasonRel) {
						relationshipsCreated++;
						console.log(`  ✅ Created Team PARTICIPATES_IN relationship: ${fixtureData.team} → ${fixtureData.season}`);
					} else {
						this.logError(`Failed to create Team PARTICIPATES_IN relationship for ${fixtureData.id}`, { teamId, seasonId, fixtureData });
					}
				}

				// Create AGAINST relationship if opposition exists
				if (fixtureData.opposition && fixtureData.opposition !== "-") {
					const oppositionId = `opposition-${String(fixtureData.opposition).toLowerCase().replace(/\s+/g, "-")}`;

					// Create opposition node if it doesn't exist
					await neo4jService.createNodeIfNotExists("OppositionDetail", {
						id: oppositionId,
						oppositionName: fixtureData.opposition,
						league: "unknown",
						division: "unknown",
					});

					const againstRel = await neo4jService.createRelationship(
						"Fixture",
						{ id: fixtureNodeId, graphLabel: "dorkiniansWebsite" } as any,
						"AGAINST",
						"OppositionDetail",
						{ id: oppositionId, graphLabel: "dorkiniansWebsite" } as any,
						{ graphLabel: "dorkiniansWebsite" },
					);

					if (againstRel) {
						relationshipsCreated++;
						console.log(`  ✅ Created AGAINST relationship: ${fixtureData.id} → ${fixtureData.opposition}`);
					} else {
						this.logError(`Failed to create AGAINST relationship for ${fixtureData.id}`, { oppositionId, fixtureData });
					}
				}
			}
		} catch (error) {
			const errorMsg = `Failed to create fixture relationships for ${fixtureData.id}: ${error instanceof Error ? error.message : String(error)}`;
			console.warn(`⚠️ ${errorMsg}`);
			this.logError(errorMsg, { fixtureData, error: error instanceof Error ? error.message : String(error) });
		}

		return relationshipsCreated;
	}

	private async createMatchDetailRelationships(matchDetailData: CSVRow, matchDetailNodeId: string): Promise<number> {
		console.log(`🔗 Creating MatchDetail relationships for: ${matchDetailData.id}`);
		let relationshipsCreated = 0;

		try {
			// Create MatchDetail-Fixture relationship using the explicit fixtureId
			if (matchDetailData.fixtureId) {
				const fixtureId = String(matchDetailData.fixtureId);

				// Check if fixture node exists before creating relationship
				const fixtureExists = await this.checkNodeExists("Fixture", fixtureId);
				if (!fixtureExists) {
					console.warn(`⚠️ Fixture node ${fixtureId} not found for MatchDetail ${matchDetailData.id}`);
					this.logError(`Fixture node not found for MatchDetail ${matchDetailData.id}`, { fixtureId, matchDetailData });
					// Continue with other relationships instead of failing completely
				} else {
					// Create GENERATED_FROM relationship
					const generatedFromRel = await neo4jService.createRelationship(
						"MatchDetail",
						{ id: matchDetailNodeId, graphLabel: "dorkiniansWebsite" } as any,
						"GENERATED_FROM",
						"Fixture",
						{ id: fixtureId, graphLabel: "dorkiniansWebsite" } as any,
						{ graphLabel: "dorkiniansWebsite" },
					);

					if (generatedFromRel) {
						relationshipsCreated++;
						console.log(`  ✅ Created GENERATED_FROM relationship: ${matchDetailData.id} → ${fixtureId}`);
					} else {
						this.logError(`Failed to create GENERATED_FROM relationship for ${matchDetailData.id}`, { fixtureId, matchDetailData });
					}
				}
			}

			// Create MatchDetail-Player relationship
			if (matchDetailData.playerName) {
				// Try to find player by name instead of generating ID
				const playerQuery = `
					MATCH (p:Player {name: $playerName, graphLabel: 'dorkiniansWebsite'})
					RETURN p.id as playerId
					LIMIT 1
				`;
				
				try {
					const playerResult = await neo4jService.runQuery(playerQuery, { playerName: String(matchDetailData.playerName) });
					
					if (playerResult.records.length > 0) {
						const playerId = playerResult.records[0].get("playerId");
						
						// Calculate clean sheet based on fixture CONCEDED value
						let cleanSheet = 0;
						if (matchDetailData.fixtureId) {
							try {
								// Find the fixture to get the CONCEDED value using the direct fixture ID
								const fixtureQuery = `
									MATCH (f:Fixture {id: $fixtureId, graphLabel: 'dorkiniansWebsite'})
									RETURN f.conceded as conceded
								`;
								const fixtureResult = await neo4jService.runQuery(fixtureQuery, {
									fixtureId: String(matchDetailData.fixtureId),
								});
								if (fixtureResult.records.length > 0) {
									const conceded = fixtureResult.records[0].get("conceded");
									// Clean sheet = 1 if conceded = 0, otherwise 0
									cleanSheet = conceded === 0 ? 1 : 0;
								}
							} catch (error) {
								console.warn(
									`⚠️ Could not calculate clean sheet for ${matchDetailData.id}: ${error instanceof Error ? error.message : String(error)}`,
								);
								this.logError(`Clean sheet calculation failed for ${matchDetailData.id}`, {
									error: error instanceof Error ? error.message : String(error),
								});
							}
						}

						// Create PERFORMED_IN relationship with all statistical properties
						const performedInRel = await neo4jService.createRelationship(
							"Player",
							{ id: playerId, graphLabel: "dorkiniansWebsite" } as any,
							"PERFORMED_IN",
							"MatchDetail",
							{ id: matchDetailNodeId, graphLabel: "dorkiniansWebsite" } as any,
							{
								goals: matchDetailData.goals || 0,
								assists: matchDetailData.assists || 0,
								manOfMatch: matchDetailData.manOfMatch || 0,
								yellowCards: matchDetailData.yellowCards || 0,
								redCards: matchDetailData.redCards || 0,
								saves: matchDetailData.saves || 0,
								ownGoals: matchDetailData.ownGoals || 0,
								penaltiesScored: matchDetailData.penaltiesScored || 0,
								penaltiesMissed: matchDetailData.penaltiesMissed || 0,
								penaltiesConceded: matchDetailData.penaltiesConceded || 0,
								penaltiesSaved: matchDetailData.penaltiesSaved || 0,
								cleanSheet: cleanSheet,
								graphLabel: "dorkiniansWebsite",
							},
						);

						if (performedInRel) {
							relationshipsCreated++;
							console.log(`  ✅ Created PERFORMED_IN relationship: ${matchDetailData.playerName} → ${matchDetailData.id}`);
						} else {
							this.logError(`Failed to create PERFORMED_IN relationship for ${matchDetailData.id}`, { playerId, matchDetailData });
						}

						// Create Player-Team relationship based on match data
						if (matchDetailData.team) {
							const teamId = `team-${String(matchDetailData.team).toLowerCase().replace(/\s+/g, "-")}`;

							// Create team node if it doesn't exist
							await neo4jService.createNodeIfNotExists("Team", {
								id: teamId,
								name: matchDetailData.team,
								season: matchDetailData.season || "unknown",
								league: "unknown",
								graphLabel: "dorkiniansWebsite",
							});

							// Check if PLAYS_FOR relationship already exists to prevent duplicates
							const existingPlaysForQuery = `
								MATCH (p:Player {id: $playerId, graphLabel: 'dorkiniansWebsite'})-[r:PLAYS_FOR]->(t:Team {id: $teamId, graphLabel: 'dorkiniansWebsite'})
								WHERE r.season = $season
								RETURN r LIMIT 1
							`;
							const existingPlaysFor = await neo4jService.runQuery(existingPlaysForQuery, {
								playerId,
								teamId,
								season: matchDetailData.season || "unknown",
							});

							if (existingPlaysFor.records.length === 0) {
								// Create PLAYS_FOR relationship only if it doesn't exist
								const playsForRel = await neo4jService.createRelationship(
									"Player",
									{ id: playerId, graphLabel: "dorkiniansWebsite" } as any,
									"PLAYS_FOR",
									"Team",
									{ id: teamId, graphLabel: "dorkiniansWebsite" } as any,
									{
										season: matchDetailData.season || "unknown",
										startDate: matchDetailData.date || new Date().toISOString(),
										graphLabel: "dorkiniansWebsite",
									},
								);

								if (playsForRel) {
									relationshipsCreated++;
									console.log(`  ✅ Created PLAYS_FOR relationship: ${matchDetailData.playerName} → ${matchDetailData.team}`);
								} else {
									this.logError(`Failed to create PLAYS_FOR relationship for ${matchDetailData.id}`, { playerId, teamId, matchDetailData });
								}
							} else {
								console.log(
									`  ℹ️ PLAYS_FOR relationship already exists: ${matchDetailData.playerName} → ${matchDetailData.team} (${matchDetailData.season})`,
								);
							}
						}

						// Create Player-Season relationship based on match data
						if (matchDetailData.season) {
							const seasonId = `season-${String(matchDetailData.season).toLowerCase().replace(/\s+/g, "-")}`;

							// Create season node if it doesn't exist
							await neo4jService.createNodeIfNotExists("Season", {
								id: seasonId,
								name: matchDetailData.season,
								startYear: this.extractYear(String(matchDetailData.season)),
								endYear: this.extractYear(String(matchDetailData.season)) + 1,
								isActive: false,
								graphLabel: "dorkiniansWebsite",
							});

							// Check if PARTICIPATES_IN relationship already exists to prevent duplicates
							const existingParticipatesQuery = `
								MATCH (p:Player {id: $playerId, graphLabel: 'dorkiniansWebsite'})-[r:PARTICIPATES_IN]->(s:Season {id: $seasonId, graphLabel: 'dorkiniansWebsite'})
								RETURN r LIMIT 1
							`;
							const existingParticipates = await neo4jService.runQuery(existingParticipatesQuery, { playerId, seasonId });

							if (existingParticipates.records.length === 0) {
								// Create PARTICIPATES_IN relationship only if it doesn't exist
								const participatesRel = await neo4jService.createRelationship(
									"Player",
									{ id: playerId, graphLabel: "dorkiniansWebsite" } as any,
									"PARTICIPATES_IN",
									"Season",
									{ id: seasonId, graphLabel: "dorkiniansWebsite" } as any,
									{ graphLabel: "dorkiniansWebsite" },
								);

								if (participatesRel) {
									relationshipsCreated++;
									console.log(`  ✅ Created PARTICIPATES_IN relationship: ${matchDetailData.playerName} → ${matchDetailData.season}`);
								} else {
									this.logError(`Failed to create PARTICIPATES_IN relationship for ${matchDetailData.id}`, { playerId, seasonId, matchDetailData });
								}
							} else {
								console.log(`  ℹ️ PARTICIPATES_IN relationship already exists: ${matchDetailData.playerName} → ${matchDetailData.season}`);
							}
						}
					} else {
						console.warn(`⚠️ Player node not found for name: ${matchDetailData.playerName} in MatchDetail ${matchDetailData.id}`);
						this.logError(`Player node not found for name: ${matchDetailData.playerName} in MatchDetail ${matchDetailData.id}`, { playerName: matchDetailData.playerName, matchDetailData });
					}
				} catch (error) {
					console.warn(`⚠️ Error finding player ${matchDetailData.playerName}: ${error instanceof Error ? error.message : String(error)}`);
					this.logError(`Error finding player ${matchDetailData.playerName}`, { playerName: matchDetailData.playerName, error: error instanceof Error ? error.message : String(error) });
				}
			}

			// Create MatchDetail-Team relationship
			if (matchDetailData.team) {
				const teamId = `team-${String(matchDetailData.team).toLowerCase().replace(/\s+/g, "-")}`;

				// Create PLAYED_FOR relationship
				const playedForRel = await neo4jService.createRelationship(
					"MatchDetail",
					{ id: matchDetailNodeId, graphLabel: "dorkiniansWebsite" } as any,
					"PLAYED_FOR",
					"Team",
					{ id: teamId, graphLabel: "dorkiniansWebsite" } as any,
					{ graphLabel: "dorkiniansWebsite" },
				);

				if (playedForRel) {
					relationshipsCreated++;
					console.log(`  ✅ Created PLAYED_FOR relationship: ${matchDetailData.id} → ${matchDetailData.team}`);
				} else {
					this.logError(`Failed to create PLAYED_FOR relationship for ${matchDetailData.id}`, { teamId, matchDetailData });
				}
			}
		} catch (error) {
			const errorMsg = `Failed to create match detail relationships for ${matchDetailData.id}: ${error instanceof Error ? error.message : String(error)}`;
			console.warn(`⚠️ ${errorMsg}`);
			this.logError(errorMsg, { matchDetailData, error: error instanceof Error ? error.message : String(error) });
		}

		return relationshipsCreated;
	}

	private async createTOTWRelationships(totwData: CSVRow, totwNodeId: string): Promise<number> {
		console.log(`🔗 Creating TOTW relationships for: ${totwData.id}`);
		let relationshipsCreated = 0;

		try {
			// Create TOTW-Season relationship
			if (totwData.season) {
				const seasonId = `season-${String(totwData.season).toLowerCase().replace(/\s+/g, "-")}`;

				// Create season node if it doesn't exist
				await neo4jService.createNodeIfNotExists("Season", {
					id: seasonId,
					name: totwData.season,
					startYear: this.extractYear(String(totwData.season)),
					endYear: this.extractYear(String(totwData.season)) + 1,
					isActive: false,
					graphLabel: "dorkiniansWebsite",
				});

				// Create REPRESENTS relationship
				const representsRel = await neo4jService.createRelationship(
					"TOTW",
					{ id: totwNodeId, graphLabel: "dorkiniansWebsite" } as any,
					"REPRESENTS",
					"Season",
					{ id: seasonId, graphLabel: "dorkiniansWebsite" } as any,
					{ graphLabel: "dorkiniansWebsite" },
				);

				if (representsRel) {
					relationshipsCreated++;
					console.log(`  ✅ Created REPRESENTS relationship: ${totwData.id} → ${totwData.season}`);
				} else {
					this.logError(`Failed to create REPRESENTS relationship for ${totwData.id}`, { seasonId, totwData });
				}
			}

			// Create TOTW-Player relationships for all positions
			const playerPositions = [
				"gk1",
				"def1",
				"def2",
				"def3",
				"def4",
				"def5",
				"mid1",
				"mid2",
				"mid3",
				"mid4",
				"mid5",
				"fwd1",
				"fwd2",
				"fwd3",
			];

			for (const position of playerPositions) {
				const playerName = totwData[position];
				if (playerName && String(playerName).trim() !== "") {
					try {
						// Ensure player node exists (create if missing)
						const playerId = await this.ensurePlayerNodeExists(String(playerName));
						
						// Create SELECTED_IN relationship
						const selectedInRel = await neo4jService.createRelationship(
							"Player",
							{ id: playerId, graphLabel: "dorkiniansWebsite" } as any,
							"SELECTED_IN",
							"TOTW",
							{ id: totwNodeId, graphLabel: "dorkiniansWebsite" } as any,
							{
								position: position,
								graphLabel: "dorkiniansWebsite",
							},
						);

						if (selectedInRel) {
							relationshipsCreated++;
							console.log(`  ✅ Created SELECTED_IN relationship: ${playerName} → ${totwData.id} (${position})`);
						} else {
							this.logError(`Failed to create SELECTED_IN relationship for ${totwData.id}`, { playerId, position, totwData });
						}
					} catch (error) {
						console.warn(`⚠️ Error creating relationship for player ${playerName}: ${error instanceof Error ? error.message : String(error)}`);
						this.logError(`Error creating relationship for player ${playerName}`, { playerName, error: error instanceof Error ? error.message : String(error) });
					}
				}
			}

			// Create TOTW-StarMan relationship if star man exists
			if (totwData.starMan && String(totwData.starMan).trim() !== "") {
				try {
					// Ensure star man player node exists (create if missing)
					const starManId = await this.ensurePlayerNodeExists(String(totwData.starMan));
					
					// Create STAR_MAN relationship
					const starManRel = await neo4jService.createRelationship(
						"Player",
						{ id: starManId, graphLabel: "dorkiniansWebsite" } as any,
						"STAR_MAN",
						"TOTW",
						{ id: totwNodeId, graphLabel: "dorkiniansWebsite" } as any,
						{
							score: totwData.starManScore || 0,
							graphLabel: "dorkiniansWebsite",
						},
					);

					if (starManRel) {
						relationshipsCreated++;
						console.log(`  ✅ Created STAR_MAN relationship: ${totwData.starMan} → ${totwData.id}`);
					} else {
						this.logError(`Failed to create STAR_MAN relationship for ${totwData.id}`, { starManId, totwData });
					}
				} catch (error) {
					console.warn(`⚠️ Error creating star man relationship for ${totwData.starMan}: ${error instanceof Error ? error.message : String(error)}`);
					this.logError(`Error creating star man relationship for ${totwData.starMan}`, { starManName: totwData.starMan, error: error instanceof Error ? error.message : String(error) });
				}
			}
		} catch (error) {
			const errorMsg = `Failed to create TOTW relationships for ${totwData.id}: ${error instanceof Error ? error.message : String(error)}`;
			console.warn(`⚠️ ${errorMsg}`);
			this.logError(errorMsg, { totwData, error: error instanceof Error ? error.message : String(error) });
		}

		return relationshipsCreated;
	}

	private async createPlayerOfMonthRelationships(pomData: CSVRow, pomNodeId: string): Promise<number> {
		console.log(`🔗 Creating PlayerOfMonth relationships for: ${pomData.id}`);
		let relationshipsCreated = 0;

		try {
			// Create PlayerOfMonth-Season relationship
			if (pomData.season) {
				const seasonId = `season-${String(pomData.season).toLowerCase().replace(/\s+/g, "-")}`;

				// Create season node if it doesn't exist
				await neo4jService.createNodeIfNotExists("Season", {
					id: seasonId,
					name: pomData.season,
					startYear: this.extractYear(String(pomData.season)),
					endYear: this.extractYear(String(pomData.season)) + 1,
					isActive: false,
				});

				// Create REPRESENTS relationship
				const representsRel = await neo4jService.createRelationship(
					"PlayerOfMonth",
					{ id: pomNodeId, graphLabel: "dorkiniansWebsite" } as any,
					"REPRESENTS",
					"Season",
					{ id: seasonId, graphLabel: "dorkiniansWebsite" } as any,
					{ graphLabel: "dorkiniansWebsite" },
				);

				if (representsRel) {
					relationshipsCreated++;
					console.log(`  ✅ Created REPRESENTS relationship: ${pomData.id} → ${pomData.season}`);
				} else {
					this.logError(`Failed to create REPRESENTS relationship for ${pomData.id}`, { seasonId, pomData });
				}
			}

			// Create PlayerOfMonth-Player relationships for all rankings
			const playerRankings = [
				{ name: pomData.player1Name, points: pomData.player1Points, rank: 1 },
				{ name: pomData.player2Name, points: pomData.player2Points, rank: 2 },
				{ name: pomData.player3Name, points: pomData.player3Points, rank: 3 },
				{ name: pomData.player4Name, points: pomData.player4Points, rank: 4 },
				{ name: pomData.player5Name, points: pomData.player5Points, rank: 5 },
			];

			for (const ranking of playerRankings) {
				if (ranking.name && String(ranking.name).trim() !== "") {
					// Search for player by name in the Players table
					const playerQuery = `
						MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
						WHERE p.name = $playerName OR p.name = $playerNameLower OR p.name = $playerNameHyphen
						RETURN p.id as playerId, p.name as playerName
						LIMIT 1
					`;
					
					try {
						const playerNameLower = String(ranking.name).toLowerCase();
						const playerNameHyphen = String(ranking.name).toLowerCase().replace(/\s+/g, "-");
						
						const playerResult = await neo4jService.runQuery(playerQuery, { 
							playerName: String(ranking.name),
							playerNameLower: playerNameLower,
							playerNameHyphen: playerNameHyphen
						});
						
						if (playerResult.records.length > 0) {
							const playerId = playerResult.records[0].get("playerId");
							const foundPlayerName = playerResult.records[0].get("playerName");
							
							// Create RANKED_IN relationship
							const rankedInRel = await neo4jService.createRelationship(
								"Player",
								{ id: playerId, graphLabel: "dorkiniansWebsite" } as any,
								"RANKED_IN",
								"PlayerOfMonth",
								{ id: pomNodeId, graphLabel: "dorkiniansWebsite" } as any,
								{
									rank: ranking.rank,
									points: ranking.points || 0,
									graphLabel: "dorkiniansWebsite",
								},
							);

							if (rankedInRel) {
								relationshipsCreated++;
								console.log(`  ✅ Created RANKED_IN relationship: ${foundPlayerName} → ${pomData.id} (Rank ${ranking.rank})`);
							} else {
								this.logError(`Failed to create RANKED_IN relationship for ${pomData.id}`, { playerId, ranking, pomData });
							}
						} else {
							console.warn(`⚠️ Player node not found for name: ${ranking.name} in PlayerOfMonth ${pomData.id}`);
							this.logError(`Player node not found for name: ${ranking.name} in PlayerOfMonth ${pomData.id}`, { playerName: ranking.name, pomData });
						}
					} catch (error) {
						console.warn(`⚠️ Error finding player ${ranking.name}: ${error instanceof Error ? error.message : String(error)}`);
						this.logError(`Error finding player ${ranking.name}`, { playerName: ranking.name, error: error instanceof Error ? error.message : String(error) });
					}
				}
			}
		} catch (error) {
			const errorMsg = `Failed to create PlayerOfMonth relationships for ${pomData.id}: ${error instanceof Error ? error.message : String(error)}`;
			console.warn(`⚠️ ${errorMsg}`);
			this.logError(errorMsg, { pomData, error: error instanceof Error ? error.message : String(error) });
		}

		return relationshipsCreated;
	}

	/**
	 * Validates ID format against expected patterns
	 * @param id The ID to validate
	 * @param expectedFormat The expected format pattern
	 * @returns true if valid, false otherwise
	 */
	private validateIDFormat(id: string, expectedFormat: string): boolean {
		if (!id || typeof id !== 'string') {
			return false;
		}

		if (expectedFormat.includes('__')) {
			// Double underscore format: entity__primaryKey__secondaryKey
			const parts = id.split('__');
			
			// Must have at least 3 parts: entity, primaryKey, secondaryKey
			if (parts.length < 3) {
				return false;
			}
			
			// Check entity type matches
			if (parts[0] !== expectedFormat.split('__')[0]) {
				return false;
			}
			
			// Validate that all parts exist and are not empty
			return parts.every(part => part && part.trim() !== '');
		} else {
			// Simple prefix format: entity-{data}
			return id.startsWith(expectedFormat);
		}
	}

	/**
	 * Validates all IDs in a data row against expected formats
	 * @param row The CSV row data
	 * @param sourceName The source table name
	 * @returns Array of validation errors, empty if all valid
	 */
	private validateRowIDs(row: CSVRow, sourceName: string): string[] {
		const errors: string[] = [];
		
		switch (sourceName) {
			case "TBL_Players":
				if (row.ID && !this.validateIDFormat(String(row.ID), "player-")) {
					errors.push(`Invalid Player ID format: ${row.ID}. Expected: player-{firstName}-{lastName}`);
				}
				break;
				
			case "TBL_FixturesAndResults":
				if (row.ID && !this.validateIDFormat(String(row.ID), "fixture-")) {
					errors.push(`Invalid Fixture ID format: ${row.ID}. Expected: fixture-{season}-{date}-{team}-vs-{opposition}-{homeAway}`);
				}
				break;
				
			case "TBL_MatchDetails":
				if (row.ID && !this.validateIDFormat(String(row.ID), "matchdetail__")) {
					errors.push(`Invalid MatchDetail ID format: ${row.ID}. Expected: matchdetail__{fixtureID}__{playerName}`);
				}
				break;
				
			case "TBL_WeeklyTOTW":
				if (row.ID && !this.validateIDFormat(String(row.ID), "totw__")) {
					errors.push(`Invalid WeeklyTOTW ID format: ${row.ID}. Expected: totw__{season}__week-{weekNumber}`);
				}
				break;
				
			case "TBL_SeasonTOTW":
				if (row.ID && !this.validateIDFormat(String(row.ID), "totw__")) {
					errors.push(`Invalid SeasonTOTW ID format: ${row.ID}. Expected: totw__{season}__season`);
				}
				break;
				
			case "TBL_PlayersOfTheMonth":
				if (row.ID && !this.validateIDFormat(String(row.ID), "pom__")) {
					errors.push(`Invalid PlayerOfMonth ID format: ${row.ID}. Expected: pom__{season}__{month}`);
				}
				break;
				
			case "TBL_OppositionDetails":
				if (row.ID && !this.validateIDFormat(String(row.ID), "opposition-")) {
					errors.push(`Invalid Opposition ID format: ${row.ID}. Expected: opposition-{opposition}`);
				}
				break;
		}
		
		return errors;
	}

	private async ensurePlayerNodeExists(playerName: string): Promise<string> {
		// First try to find existing player
		// Handle both underscore-separated names and space-separated names
		const existingPlayerQuery = `
			MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
			WHERE p.name = $playerName OR p.name = $playerNameDisplay OR p.name = $playerNameLower OR p.name = $playerNameHyphen
			RETURN p.id as playerId
			LIMIT 1
		`;
		
		try {
			const playerNameDisplay = String(playerName).replace(/_/g, " "); // Convert underscores to spaces
			const playerNameLower = String(playerName).toLowerCase();
			const playerNameHyphen = String(playerName).toLowerCase().replace(/[_\s]+/g, "-");
			
			const existingResult = await neo4jService.runQuery(existingPlayerQuery, { 
				playerName: String(playerName),
				playerNameDisplay: playerNameDisplay,
				playerNameLower: playerNameLower,
				playerNameHyphen: playerNameHyphen
			});
			
			if (existingResult.records.length > 0) {
				return existingResult.records[0].get("playerId");
			}
			
			// Player doesn't exist, create a new one
			// Convert underscore-separated names back to readable format for display
			const displayName = String(playerName).replace(/_/g, " ");
			const playerId = `player-${String(playerName).toLowerCase().replace(/_/g, "-")}`;
			const playerProperties = {
				id: playerId,
				name: displayName, // Store the readable name (with spaces)
				allowOnSite: false, // Historical player not allowed on site
				mostPlayedForTeam: "Unknown",
				mostCommonPosition: "Unknown",
				graphLabel: "dorkiniansWebsite",
				createdAt: new Date().toISOString(),
			};
			
			await neo4jService.createNode("Player", playerProperties);
			console.log(`  ℹ️ Created missing Player node: ${playerName} (${playerId})`);
			return playerId;
			
		} catch (error) {
			console.warn(`⚠️ Error ensuring player node exists for ${playerName}: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	private mapNodeLabelToSourceName(nodeLabel: string): string {
		// Map Neo4j labels back to CSV source names for relationship creation
		switch (nodeLabel) {
			case "Player":
				return "TBL_Players";
			case "Fixture":
				return "TBL_FixturesAndResults";
			case "MatchDetail":
				return "TBL_MatchDetails";
			case "TOTW":
				return "TBL_WeeklyTOTW";
			case "SeasonTOTW":
				return "TBL_SeasonTOTW";
			case "PlayerOfTheMonth":
				return "TBL_PlayersOfTheMonth";
			case "OppositionDetail":
				return "TBL_OppositionDetails";
			case "SiteDetail":
				return "TBL_SiteDetails";
			default:
				return nodeLabel; // fallback to node label if no mapping found
		}
	}

	private extractYear(seasonString: string): number {
		if (!seasonString) return new Date().getFullYear();

		// Handle formats like "2016-17", "2016/17", "2016"
		const yearMatch = seasonString.match(/(\d{4})/);
		if (yearMatch) {
			return parseInt(yearMatch[1]);
		}

		return new Date().getFullYear();
	}

	async getDatabaseStats(): Promise<any> {
		return await neo4jService.getDatabaseStats();
	}
}

export const dataSeederService = DataSeederService.getInstance();
