import neo4j, { Driver, Session, Record } from 'neo4j-driver'

class Neo4jService {
  private driver: Driver | null = null
  private isConnected: boolean = false
  private readonly GRAPH_LABEL = 'dorkiniansWebsite'

  async connect() {
    try {
      const uri = process.env.NODE_ENV === 'production' 
        ? process.env.PROD_NEO4J_URI 
        : process.env.DEV_NEO4J_URI
      
      const username = process.env.NODE_ENV === 'production' 
        ? process.env.PROD_NEO4J_USER 
        : process.env.DEV_NEO4J_USER
      
      const password = process.env.NODE_ENV === 'production' 
        ? process.env.PROD_NEO4J_PASSWORD 
        : process.env.DEV_NEO4J_PASSWORD

      if (!uri || !username || !password) {
        throw new Error('Neo4j connection details not configured')
      }

      this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password))
      
      // Test connection
      await this.driver.verifyConnectivity()
      this.isConnected = true
      
      console.log('✅ Neo4j connection established')
      console.log(`📍 Connected to: ${uri}`)
      console.log(`🏷️ Graph Label: ${this.GRAPH_LABEL}`)
      return true
    } catch (error) {
      console.error('❌ Neo4j connection failed:', error)
      this.isConnected = false
      return false
    }
  }

  async disconnect() {
    if (this.driver) {
      await this.driver.close()
      this.driver = null
      this.isConnected = false
      console.log('🔌 Neo4j connection closed')
    }
  }

  getSession(): Session | null {
    if (!this.driver || !this.isConnected) {
      console.warn('⚠️ Neo4j not connected')
      return null
    }
    return this.driver.session()
  }

  async executeQuery(query: string, params: Record<string, any> = {}) {
    const session = this.getSession()
    if (!session) {
      throw new Error('No active Neo4j session')
    }

    try {
      const result = await session.run(query, params)
      return result.records.map(record => record.toObject())
    } finally {
      await session.close()
    }
  }

  // Helper method to create nodes with graphLabel property
  async createNode(label: string, properties: Record<string, any>) {
    const session = this.getSession()
    if (!session) {
      throw new Error('No active Neo4j session')
    }

    try {
      // Add graphLabel property to all nodes
      const nodeProperties = {
        ...properties,
        graphLabel: this.GRAPH_LABEL,
        createdAt: new Date().toISOString()
      }

      const query = `
        CREATE (n:${label} $properties)
        RETURN n
      `
      
      const result = await session.run(query, { properties: nodeProperties })
      return result.records[0]?.get('n')
    } finally {
      await session.close()
    }
  }

  // Helper method to create relationships with graphLabel property
  async createRelationship(
    fromLabel: string, 
    fromProps: Record<string, any>, 
    relationshipType: string, 
    toLabel: string, 
    toProps: Record<string, any>,
    relationshipProps: Record<string, any> = {}
  ) {
    const session = this.getSession()
    if (!session) {
      throw new Error('No active Neo4j session')
    }

    try {
      // Add graphLabel to relationship properties
      const relProperties = {
        ...relationshipProps,
        graphLabel: this.GRAPH_LABEL,
        createdAt: new Date().toISOString()
      }

      const query = `
        MATCH (a:${fromLabel} {graphLabel: $graphLabel})
        MATCH (b:${toLabel} {graphLabel: $graphLabel})
        CREATE (a)-[r:${relationshipType} $relProps]->(b)
        RETURN r
      `
      
      const result = await session.run(query, { 
        fromProps, 
        toProps, 
        relProps: relProperties,
        graphLabel: this.GRAPH_LABEL
      })
      return result.records[0]?.get('r')
    } finally {
      await session.close()
    }
  }

  // Method to get all nodes with graphLabel
  async getNodesByGraphLabel(label?: string) {
    const session = this.getSession()
    if (!session) {
      throw new Error('No active Neo4j session')
    }

    try {
      const nodeLabel = label ? `:${label}` : ''
      const query = `
        MATCH (n${nodeLabel} {graphLabel: $graphLabel})
        RETURN n
      `
      
      const result = await session.run(query, { graphLabel: this.GRAPH_LABEL })
      return result.records.map(record => record.get('n'))
    } finally {
      await session.close()
    }
  }

  // SAFE method to clear only dorkiniansWebsite data
  async clearGraphData() {
    const session = this.getSession()
    if (!session) {
      throw new Error('No active Neo4j session')
    }

    try {
      console.log(`🧹 Clearing data with graphLabel: ${this.GRAPH_LABEL}`)
      
      // First, count nodes to be deleted for safety
      const countQuery = `
        MATCH (n {graphLabel: $graphLabel})
        RETURN count(n) as nodeCount
      `
      const countResult = await session.run(countQuery, { graphLabel: this.GRAPH_LABEL })
      const nodeCount = countResult.records[0]?.get('nodeCount').toNumber() || 0
      
      if (nodeCount === 0) {
        console.log('ℹ️ No nodes found with specified graphLabel')
        return { nodesDeleted: 0, relationshipsDeleted: 0 }
      }

      console.log(`⚠️ About to delete ${nodeCount} nodes with graphLabel: ${this.GRAPH_LABEL}`)
      
      // Delete only nodes with our specific graphLabel
      const deleteQuery = `
        MATCH (n {graphLabel: $graphLabel})
        DETACH DELETE n
      `
      
      const result = await session.run(deleteQuery, { graphLabel: this.GRAPH_LABEL })
      const summary = result.summary.counters
      
      console.log(`🗑️ Deleted ${summary.nodesDeleted()} nodes and ${summary.relationshipsDeleted()} relationships`)
      console.log(`✅ Only nodes with graphLabel: ${this.GRAPH_LABEL} were affected`)
      
      return summary
    } catch (error) {
      console.error('❌ Failed to clear graph data:', error)
      throw error
    } finally {
      await session.close()
    }
  }

  // Method to safely delete specific node types with graphLabel
  async deleteNodesByLabel(label: string) {
    const session = this.getSession()
    if (!session) {
      throw new Error('No active Neo4j session')
    }

    try {
      console.log(`🧹 Deleting ${label} nodes with graphLabel: ${this.GRAPH_LABEL}`)
      
      const query = `
        MATCH (n:${label} {graphLabel: $graphLabel})
        DETACH DELETE n
      `
      
      const result = await session.run(query, { graphLabel: this.GRAPH_LABEL })
      const summary = result.summary.counters
      
      console.log(`🗑️ Deleted ${summary.nodesDeleted()} ${label} nodes`)
      return summary
    } catch (error) {
      console.error(`❌ Failed to delete ${label} nodes:`, error)
      throw error
    } finally {
      await session.close()
    }
  }

  // Method to get database statistics for dorkiniansWebsite data only
  async getDatabaseStats() {
    const session = this.getSession()
    if (!session) {
      throw new Error('No active Neo4j session')
    }

    try {
      const query = `
        MATCH (n {graphLabel: $graphLabel})
        RETURN 
          labels(n) as label,
          count(n) as count
        ORDER BY count DESC
      `
      
      const result = await session.run(query, { graphLabel: this.GRAPH_LABEL })
      return result.records.map(record => ({
        label: record.get('label'),
        count: record.get('count').toNumber()
      }))
    } finally {
      await session.close()
    }
  }

  isConnectedStatus(): boolean {
    return this.isConnected
  }

  getGraphLabel(): string {
    return this.GRAPH_LABEL
  }
}

// Export singleton instance
export const neo4jService = new Neo4jService()

// Export for direct use
export default neo4jService
