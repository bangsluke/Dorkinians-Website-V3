import neo4j, { Driver, Session, Record } from "neo4j-driver";

// Check for debug mode
const isDebugMode = process.env.DEBUG_MODE === "true";

// Conditional logging functions
const logDebug = (message: string) => {
	if (isDebugMode) {
		console.log(message);
	}
};

class Neo4jService {
	private driver: Driver | null = null;
	private isConnected: boolean = false;
	private readonly GRAPH_LABEL = "dorkiniansWebsite";

	async connect() {
		try {
			// Use Neo4j Aura for both production and development
			// This ensures consistent data access across environments
			const uri = process.env.PROD_NEO4J_URI;
			const username = process.env.PROD_NEO4J_USER;
			const password = process.env.PROD_NEO4J_PASSWORD;

			logDebug(`🔧 Connection attempt - Environment: ${process.env.NODE_ENV}`);
			logDebug(`🔧 URI configured: ${uri ? "Yes" : "No"}`);
			logDebug(`🔧 Username configured: ${username ? "Yes" : "No"}`);
			logDebug(`🔧 Password configured: ${password ? "Yes" : "No"}`);

			if (!uri || !username || !password) {
				const missingVars = [];
				if (!uri) missingVars.push("PROD_NEO4J_URI");
				if (!username) missingVars.push("PROD_NEO4J_USER");
				if (!password) missingVars.push("PROD_NEO4J_PASSWORD");
				throw new Error(`Neo4j Aura connection details not configured. Missing: ${missingVars.join(", ")}`);
			}

			this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));

			// Test connection
			await this.driver.verifyConnectivity();
			this.isConnected = true;

			logDebug("✅ Neo4j Aura connection established");
			logDebug(`📍 Connected to: ${uri}`);
			logDebug(`🏷️ Graph Label: ${this.GRAPH_LABEL}`);
			return true;
		} catch (error) {
			console.error("❌ Neo4j Aura connection failed:", error);
			this.isConnected = false;
			return false;
		}
	}

	async disconnect() {
		if (this.driver) {
			await this.driver.close();
			this.driver = null;
			this.isConnected = false;
			console.log("🔌 Neo4j Aura connection closed");
		}
	}

	getSession(): Session | null {
		if (!this.driver || !this.isConnected) {
			console.warn("⚠️ Neo4j Aura not connected");
			return null;
		}
		return this.driver.session();
	}

	async executeQuery(query: string, params: any = {}) {
		if (!this.driver || !this.isConnected) {
			const connected = await this.connect();
			if (!connected) {
				throw new Error("Neo4j driver not initialized and connection failed");
			}
		}
		const session = this.driver.session();
		try {
			const result = await session.run(query, params);
			return result.records.map((record) => record.toObject());
		} catch (error) {
			console.error("❌ Query execution failed:", error);
			throw error;
		} finally {
			await session.close();
		}
	}

	async runQuery(query: string, params: any = {}) {
		if (!this.driver || !this.isConnected) {
			const connected = await this.connect();
			if (!connected) {
				throw new Error("Neo4j driver not initialized and connection failed");
			}
		}
		const session = this.driver.session();
		try {
			const result = await session.run(query, params);
			return result;
		} catch (error) {
			console.error("❌ Query execution failed:", error);
			throw error;
		} finally {
			await session.close();
		}
	}

	async createNode(label: string, properties: any) {
		if (!this.driver) {
			throw new Error("Neo4j driver not initialized");
		}
		const session = this.driver.session();
		try {
			// Add graphLabel and createdAt to properties
			const nodeProperties = {
				...properties,
				graphLabel: this.GRAPH_LABEL,
				createdAt: new Date().toISOString(),
			};

			const query = `
        CREATE (n:${label} $properties)
        RETURN n
      `;
			const result = await session.run(query, { properties: nodeProperties });
			const node = result.records[0]?.get("n");
			return node ? node.identity.toString() : null;
		} catch (error) {
			console.error("❌ Node creation failed:", error);
			throw error;
		} finally {
			await session.close();
		}
	}

	async createNodeIfNotExists(label: string, properties: any) {
		if (!this.driver) {
			throw new Error("Neo4j driver not initialized");
		}
		const session = this.driver.session();
		try {
			// Add graphLabel and createdAt to properties
			const nodeProperties = {
				...properties,
				graphLabel: this.GRAPH_LABEL,
				createdAt: new Date().toISOString(),
			};

			const query = `
        MERGE (n:${label} {id: $id, graphLabel: $graphLabel})
        ON CREATE SET n += $properties
        RETURN n
      `;
			const result = await session.run(query, {
				id: properties.id,
				graphLabel: this.GRAPH_LABEL,
				properties: nodeProperties,
			});
			const node = result.records[0]?.get("n");
			return node ? node.identity.toString() : null;
		} catch (error) {
			console.error("❌ Node creation/merge failed:", error);
			throw error;
		} finally {
			await session.close();
		}
	}

	async ensureNodeExists(label: string, id: string, maxRetries: number = 3): Promise<boolean> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const query = `
          MATCH (n:${label} {id: $id, graphLabel: $graphLabel})
          RETURN n
          LIMIT 1
        `;

				const result = await this.runQuery(query, { id, graphLabel: this.GRAPH_LABEL });

				if (result.records.length > 0) {
					return true;
				}

				if (attempt < maxRetries) {
					console.log(`⏳ Node ${label}:${id} not found, retrying in 100ms (attempt ${attempt}/${maxRetries})`);
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			} catch (error) {
				console.warn(`⚠️ Error checking node existence (attempt ${attempt}):`, error);
				if (attempt < maxRetries) {
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			}
		}

		return false;
	}

	async createRelationship(
		fromLabel: string,
		fromProps: any,
		relationshipType: string,
		toLabel: string,
		toProps: any,
		relationshipProps: any = {},
	) {
		if (!this.driver) {
			throw new Error("Neo4j driver not initialized");
		}
		const session = this.driver.session();
		try {
			// Ensure both nodes exist with retry logic
			const fromNodeExists = await this.ensureNodeExists(fromLabel, fromProps.id);
			if (!fromNodeExists) {
				throw new Error(`From node not found after retries: ${fromLabel}:${fromProps.id}`);
			}

			const toNodeExists = await this.ensureNodeExists(toLabel, toProps.id);
			if (!toNodeExists) {
				throw new Error(`To node not found after retries: ${toLabel}:${toProps.id}`);
			}

			// Check if relationship already exists to prevent duplicates
			const existingRelQuery = `
        MATCH (from:${fromLabel} {id: $fromId, graphLabel: $graphLabel})-[r:${relationshipType}]->(to:${toLabel} {id: $toId, graphLabel: $graphLabel})
        RETURN r
        LIMIT 1
      `;

			const existingRel = await session.run(existingRelQuery, {
				fromId: fromProps.id,
				toId: toProps.id,
				graphLabel: this.GRAPH_LABEL,
			});

			if (existingRel.records.length > 0) {
				console.log(`ℹ️ Relationship ${relationshipType} already exists between ${fromProps.id} and ${toProps.id}`);
				return existingRel.records[0].get("r");
			}

			// Create the relationship
			const createRelQuery = `
        MATCH (from:${fromLabel} {id: $fromId, graphLabel: $graphLabel})
        MATCH (to:${toLabel} {id: $toId, graphLabel: $graphLabel})
        CREATE (from)-[r:${relationshipType} $relProps]->(to)
        RETURN r
      `;

			const params = {
				fromId: fromProps.id,
				toId: toProps.id,
				graphLabel: this.GRAPH_LABEL,
				relProps: {
					...relationshipProps,
					graphLabel: this.GRAPH_LABEL,
					createdAt: new Date().toISOString(),
				},
			};

			const result = await session.run(createRelQuery, params);
			const relationship = result.records[0]?.get("r");

			if (relationship) {
				console.log(`✅ Created ${relationshipType} relationship: ${fromProps.id} → ${toProps.id}`);
			} else {
				throw new Error(`Failed to create ${relationshipType} relationship between ${fromProps.id} and ${toProps.id}`);
			}

			return relationship;
		} catch (error) {
			console.error(`❌ Relationship creation failed for ${relationshipType} between ${fromProps.id} and ${toProps.id}:`, error);
			throw error;
		} finally {
			await session.close();
		}
	}

	// Method to get all nodes with graphLabel
	async getNodesByGraphLabel(label?: string) {
		const session = this.getSession();
		if (!session) {
			throw new Error("No active Neo4j session");
		}

		try {
			const nodeLabel = label ? `:${label}` : "";
			const query = `
        MATCH (n${nodeLabel} {graphLabel: $graphLabel})
        RETURN n
      `;

			const result = await session.run(query, { graphLabel: this.GRAPH_LABEL });
			return result.records.map((record) => record.get("n"));
		} finally {
			await session.close();
		}
	}

	async clearGraphData() {
		try {
			console.log(`🗑️ Clearing graph data for graphLabel: ${this.GRAPH_LABEL}`);

			const query = `
        MATCH (n {graphLabel: $graphLabel})
        OPTIONAL MATCH (n)-[r]-()
        DELETE r, n
      `;

			if (!this.driver) {
				throw new Error("Neo4j driver not initialized");
			}
			const session = this.driver.session();
			const result = await session.run(query, { graphLabel: this.GRAPH_LABEL });
			await session.close();

			console.log(`✅ Only nodes with graphLabel: ${this.GRAPH_LABEL} were affected`);

			return {
				nodesDeleted: 0, // Simplified for now
				relationshipsDeleted: 0,
			};
		} catch (error) {
			console.error("❌ Failed to clear graph data:", error);
		}
	}

	async deleteNodesByLabel(label: string) {
		try {
			console.log(`🗑️ Deleting ${label} nodes with graphLabel: ${this.GRAPH_LABEL}`);

			const query = `
        MATCH (n:${label} {graphLabel: $graphLabel})
        OPTIONAL MATCH (n)-[r]-()
        DELETE r, n
      `;

			if (!this.driver) {
				throw new Error("Neo4j driver not initialized");
			}
			const session = this.driver.session();
			const result = await session.run(query, { graphLabel: this.GRAPH_LABEL });
			await session.close();

			console.log(`🗑️ Deleted ${label} nodes`);
			return {
				nodesDeleted: 0, // Simplified for now
				relationshipsDeleted: 0,
			};
		} catch (error) {
			console.error(`❌ Failed to delete ${label} nodes:`, error);
		}
	}

	// Method to get database statistics for dorkiniansWebsite data only
	async getDatabaseStats() {
		const session = this.getSession();
		if (!session) {
			throw new Error("No active Neo4j session");
		}

		try {
			const query = `
        MATCH (n {graphLabel: $graphLabel})
        RETURN 
          labels(n) as label,
          count(n) as count
        ORDER BY count DESC
      `;

			const result = await session.run(query, { graphLabel: this.GRAPH_LABEL });
			return result.records.map((record) => ({
				label: record.get("label"),
				count: record.get("count").toNumber(),
			}));
		} finally {
			await session.close();
		}
	}

	isConnectedStatus(): boolean {
		return this.isConnected;
	}

	getGraphLabel(): string {
		return this.GRAPH_LABEL;
	}

	async createAllRelationships(): Promise<number> {
		console.log("🔗 Creating relationships between nodes...");
		// This is a placeholder implementation
		// In a real implementation, you would create relationships between different node types
		// For now, we'll return 0 to indicate no relationships were created
		return 0;
	}
}

// Export singleton instance
export const neo4jService = new Neo4jService();

// Export for direct use
export default neo4jService;
