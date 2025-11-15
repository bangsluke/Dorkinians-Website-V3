const neo4j = require("neo4j-driver");

// Check for debug mode
const isDebugMode = process.env.DEBUG_MODE === "true";

// Conditional logging functions
const logDebug = (message) => {
	if (isDebugMode) {
		console.log(message);
	}
};

class Neo4jService {
	constructor() {
		this.driver = null;
		this.isConnected = false;
		this.GRAPH_LABEL = "dorkiniansWebsite";
	}

	async connect() {
		try {
			// All environments now use Neo4j Aura
			const uri = process.env.PROD_NEO4J_URI;
			const username = process.env.PROD_NEO4J_USER;
			const password = process.env.PROD_NEO4J_PASSWORD;

			logDebug(`🔧 Connection attempt - Environment: ${process.env.NODE_ENV}`);
			logDebug(`🔧 URI configured: ${uri ? "Yes" : "No"}`);
			logDebug(`🔧 Username configured: ${username ? "Yes" : "No"}`);
			logDebug(`🔧 Password configured: ${password ? "Yes" : "No"}`);

			if (!uri || !username || !password) {
				const missingVars = [];
				if (!uri) missingVars.push("URI");
				if (!username) missingVars.push("USER");
				if (!password) missingVars.push("PASSWORD");
				throw new Error(`Neo4j connection details not configured. Missing: ${missingVars.join(", ")}`);
			}

			// Configure driver with connection pool settings for concurrent requests
			this.driver = neo4j.driver(
				uri,
				neo4j.auth.basic(username, password),
				{
					maxConnectionPoolSize: 50, // Default is 50, good for concurrent requests
					connectionAcquisitionTimeout: 60000, // 60 seconds
					connectionTimeout: 30000, // 30 seconds
					disableLosslessIntegers: true,
				}
			);

			// Test connection
			await this.driver.verifyConnectivity();
			this.isConnected = true;

			logDebug("✅ Neo4j connection established");
			logDebug(`📍 Connected to: ${uri}`);
			logDebug(`🏷️ Graph Label: ${this.GRAPH_LABEL}`);
			return true;
		} catch (error) {
			console.error("❌ Neo4j connection failed:", error);
			this.isConnected = false;
			return false;
		}
	}

	async disconnect() {
		if (this.driver) {
			await this.driver.close();
			this.driver = null;
			this.isConnected = false;
			logDebug("🔌 Neo4j connection closed");
		}
	}

	getSession() {
		if (!this.driver || !this.isConnected) {
			console.warn("⚠️ Neo4j not connected");
			return null;
		}
		return this.driver.session();
	}

	async executeQuery(query, params = {}) {
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

	async runQuery(query, params = {}) {
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

	async createNode(label, properties) {
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

			const query = `CREATE (n:${label} $properties) RETURN n`;
			const result = await session.run(query, { properties: nodeProperties });

			if (result.records.length > 0) {
				const node = result.records[0].get("n");
				console.log(`✅ Created ${label} node:`, node.properties);
				return node;
			}
			return null;
		} catch (error) {
			console.error(`❌ Failed to create ${label} node:`, error);
			throw error;
		} finally {
			await session.close();
		}
	}

	async createRelationship(fromLabel, fromProps, toLabel, toProps, relationshipType, relProps = {}) {
		if (!this.driver) {
			throw new Error("Neo4j driver not initialized");
		}
		const session = this.driver.session();
		try {
			const query = `
				MATCH (from:${fromLabel} $fromProps), (to:${toLabel} $toProps)
				CREATE (from)-[r:${relationshipType} $relProps]->(to)
				RETURN r
			`;
			const result = await session.run(query, { fromProps, toProps, relProps });

			if (result.records.length > 0) {
				const relationship = result.records[0].get("r");
				console.log(`✅ Created ${relationshipType} relationship:`, relationship.properties);
				return relationship;
			}
			return null;
		} catch (error) {
			console.error(`❌ Failed to create ${relationshipType} relationship:`, error);
			throw error;
		} finally {
			await session.close();
		}
	}

	async findNode(label, properties) {
		if (!this.driver) {
			throw new Error("Neo4j driver not initialized");
		}
		const session = this.driver.session();
		try {
			const query = `MATCH (n:${label} $properties) RETURN n LIMIT 1`;
			const result = await session.run(query, { properties });

			if (result.records.length > 0) {
				return result.records[0].get("n");
			}
			return null;
		} catch (error) {
			console.error(`❌ Failed to find ${label} node:`, error);
			throw error;
		} finally {
			await session.close();
		}
	}

	async updateNode(label, matchProps, updateProps) {
		if (!this.driver) {
			throw new Error("Neo4j driver not initialized");
		}
		const session = this.driver.session();
		try {
			const query = `
				MATCH (n:${label} $matchProps)
				SET n += $updateProps
				SET n.updatedAt = datetime()
				RETURN n
			`;
			const result = await session.run(query, { matchProps, updateProps });

			if (result.records.length > 0) {
				const node = result.records[0].get("n");
				console.log(`✅ Updated ${label} node:`, node.properties);
				return node;
			}
			return null;
		} catch (error) {
			console.error(`❌ Failed to update ${label} node:`, error);
			throw error;
		} finally {
			await session.close();
		}
	}

	async deleteNode(label, properties) {
		if (!this.driver) {
			throw new Error("Neo4j driver not initialized");
		}
		const session = this.driver.session();
		try {
			const query = `MATCH (n:${label} $properties) DETACH DELETE n RETURN count(n) as deleted`;
			const result = await session.run(query, { properties });

			const deletedCount = result.records[0].get("deleted").toNumber();
			console.log(`✅ Deleted ${deletedCount} ${label} node(s)`);
			return deletedCount;
		} catch (error) {
			console.error(`❌ Failed to delete ${label} node:`, error);
			throw error;
		} finally {
			await session.close();
		}
	}

	async clearAllData() {
		if (!this.driver) {
			throw new Error("Neo4j driver not initialized");
		}
		const session = this.driver.session();
		try {
			const query = `MATCH (n {graphLabel: $graphLabel}) DETACH DELETE n RETURN count(n) as deleted`;
			const result = await session.run(query, { graphLabel: this.GRAPH_LABEL });

			const deletedCount = result.records[0].get("deleted").toNumber();
			console.log(`🗑️ Cleared ${deletedCount} nodes and relationships`);
			return deletedCount;
		} catch (error) {
			console.error("❌ Failed to clear data:", error);
			throw error;
		} finally {
			await session.close();
		}
	}

	async getDataStats() {
		if (!this.driver) {
			throw new Error("Neo4j driver not initialized");
		}
		const session = this.driver.session();
		try {
			const query = `
				MATCH (n {graphLabel: $graphLabel})
				RETURN 
					count(n) as totalNodes,
					count(DISTINCT labels(n)) as uniqueLabels,
					count((n)-[r]->()) as totalRelationships
			`;
			const result = await session.run(query, { graphLabel: this.GRAPH_LABEL });

			if (result.records.length > 0) {
				const stats = result.records[0];
				return {
					totalNodes: stats.get("totalNodes").toNumber(),
					uniqueLabels: stats.get("uniqueLabels").toNumber(),
					totalRelationships: stats.get("totalRelationships").toNumber(),
				};
			}
			return { totalNodes: 0, uniqueLabels: 0, totalRelationships: 0 };
		} catch (error) {
			console.error("❌ Failed to get data stats:", error);
			throw error;
		} finally {
			await session.close();
		}
	}

	isConnected() {
		return this.isConnected;
	}

	getGraphLabel() {
		return this.GRAPH_LABEL;
	}
}

// Create and export singleton instance
const neo4jService = new Neo4jService();

module.exports = {
	Neo4jService,
	neo4jService,
};
