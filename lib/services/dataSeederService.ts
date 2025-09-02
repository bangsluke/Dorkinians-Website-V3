import { neo4jService } from "../neo4j";
import { getDataSourcesByName } from "../config/dataSources";
import { DataService } from "./dataService";

interface SeedingResult {
	success: boolean;
	nodesCreated: number;
	relationshipsCreated: number;
	errors: string[];
	unknownNodes: string[];
}

class DataSeederService {
	private static instance: DataSeederService;

	constructor() {
		// Initialize any required properties
	}

	static getInstance(): DataSeederService {
		if (!DataSeederService.instance) {
			DataSeederService.instance = new DataSeederService();
		}
		return DataSeederService.instance;
	}

	async seedAllData(dataSources: any[], reducedMode: boolean = false): Promise<SeedingResult> {
		console.log("🌱 Starting data seeding process...");
		if (reducedMode) {
			console.log("📊 REDUCED MODE: Processing limited rows for testing");
		}

		try {
			// Step 1: Connect to Neo4j
			console.log("🔗 Step 1: Connecting to Neo4j...");
			const connected = await neo4jService.connect();
			if (!connected) {
				throw new Error("Failed to connect to Neo4j database");
			}

			// Step 2: Clear existing data (optional)
			console.log("🗑️ Step 2: Clearing existing data...");
			await neo4jService.clearGraphData();

			// Step 3: Process each data source
			console.log("📥 Step 3: Processing data sources...");
			let totalNodesCreated = 0;
			let totalRelationshipsCreated = 0;
			const errors: string[] = [];
			const unknownNodes: string[] = [];

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
					const errorMsg = `Failed to process ${dataSource.name}: ${error instanceof Error ? error.message : String(error)}`;
					console.error(`❌ ${errorMsg}`);
					errors.push(errorMsg);
				}
			}

			// Step 4: Create relationships between nodes
			console.log("🔗 Step 4: Creating relationships between nodes...");
			try {
				const relationshipResult = await neo4jService.createAllRelationships();
				totalRelationshipsCreated += relationshipResult;
			} catch (error) {
				const errorMsg = `Failed to create relationships: ${error instanceof Error ? error.message : String(error)}`;
				console.error(`❌ ${errorMsg}`);
				errors.push(errorMsg);
			}

			console.log(`🎉 Seeding completed! Created ${totalNodesCreated} nodes and ${totalRelationshipsCreated} relationships`);

			return {
				success: errors.length === 0,
				nodesCreated: totalNodesCreated,
				relationshipsCreated: totalRelationshipsCreated,
				errors: errors,
				unknownNodes: unknownNodes,
			};
		} catch (error) {
			const errorMsg = `Seeding failed: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`❌ ${errorMsg}`);

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
				await neo4jService.disconnect();
			} catch (cleanupError) {
				console.warn("Cleanup failed:", cleanupError);
			}
		}
	}

	private async processDataSource(dataSource: any, reducedMode: boolean): Promise<{ nodesCreated: number; relationshipsCreated: number; errors: string[]; unknownNodes: string[] }> {
		let nodesCreated = 0;
		let relationshipsCreated = 0;
		const errors: string[] = [];
		const unknownNodes: string[] = [];

		try {
			console.log(`📊 Processing ${dataSource.name}`);
			
			// Fetch CSV data using the data service
			const dataService = DataService.getInstance();
			const csvData = await dataService.fetchCSVData(dataSource, reducedMode, 10); // Limit to 10 rows for development

			if (csvData.length === 0) {
				console.log(`ℹ️ No data found for ${dataSource.name}`);
				return { nodesCreated: 0, relationshipsCreated: 0, errors: [], unknownNodes: [] };
			}

			console.log(`📥 Processing ${csvData.length} rows from ${dataSource.name}${reducedMode ? " (REDUCED MODE)" : ""}`);

			// Process the data based on source type
			const result = await this.processDataSourceByType(dataSource.name, csvData);
			nodesCreated = result.nodesCreated;
			relationshipsCreated = result.relationshipsCreated;

			if (result.errors.length > 0) {
				errors.push(...result.errors);
			}

			if (result.unknownNodes.length > 0) {
				unknownNodes.push(...result.unknownNodes);
			}

		} catch (error) {
			const errorMsg = `Failed to process ${dataSource.name}: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`❌ ${errorMsg}`);
			errors.push(errorMsg);
		}

		return { nodesCreated, relationshipsCreated, errors, unknownNodes };
	}

	private async processDataSourceByType(sourceName: string, csvData: any[]): Promise<{ nodesCreated: number; relationshipsCreated: number; errors: string[]; unknownNodes: string[] }> {
		let nodesCreated = 0;
		let relationshipsCreated = 0;
		const errors: string[] = [];
		const unknownNodes: string[] = [];

		try {
			// For development, we'll create simple nodes based on the data
			// In a full implementation, you would have specific node creation methods
			console.log(`📊 Processing ${sourceName} with ${csvData.length} rows`);
			
			// Create nodes based on the data source type
			switch (sourceName) {
				case "TBL_Players":
					for (const row of csvData) {
						try {
							const playerId = row.id || row.player_id || `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
							const player = await neo4jService.createNode("Player", {
								id: playerId,
								name: row.name || row.player_name || "Unknown Player",
								position: row.position || "Unknown",
								number: row.number || row.player_number || 0
							});
							if (player) nodesCreated++;
						} catch (error) {
							errors.push(`Failed to create player node: ${error instanceof Error ? error.message : String(error)}`);
						}
					}
					break;
					
				case "TBL_FixturesAndResults":
					for (const row of csvData) {
						try {
							const fixtureId = row.id || row.fixture_id || `fixture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
							const fixture = await neo4jService.createNode("Fixture", {
								id: fixtureId,
								date: row.date || row.fixture_date || new Date().toISOString(),
								home_team: row.home_team || "Unknown",
								away_team: row.away_team || "Unknown",
								score: row.score || "0-0"
							});
							if (fixture) nodesCreated++;
						} catch (error) {
							errors.push(`Failed to create fixture node: ${error instanceof Error ? error.message : String(error)}`);
						}
					}
					break;
					
				case "TBL_MatchDetails":
					for (const row of csvData) {
						try {
							const matchId = row.id || row.match_id || `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
							const match = await neo4jService.createNode("Match", {
								id: matchId,
								player_id: row.player_id || "unknown",
								fixture_id: row.fixture_id || "unknown",
								minutes_played: row.minutes_played || 0,
								goals: row.goals || 0,
								assists: row.assists || 0
							});
							if (match) nodesCreated++;
						} catch (error) {
							errors.push(`Failed to create match node: ${error instanceof Error ? error.message : String(error)}`);
						}
					}
					break;
					
				default:
					console.log(`⚠️ Unknown data source: ${sourceName}`);
					unknownNodes.push(sourceName);
			}
		} catch (error) {
			errors.push(`Failed to process ${sourceName}: ${error instanceof Error ? error.message : String(error)}`);
		}

		return { nodesCreated, relationshipsCreated, errors, unknownNodes };
	}
}

// Export singleton instance
export const dataSeederService = DataSeederService.getInstance();

// Export for direct use
export default dataSeederService;
