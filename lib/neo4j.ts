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

  async executeQuery(query: string, params: any = {}) {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized')
    }
    const session = this.driver.session()
    try {
      const result = await session.run(query, params)
      return result.records.map(record => record.toObject())
    } catch (error) {
      console.error('❌ Query execution failed:', error)
      throw error
    } finally {
      await session.close()
    }
  }

  async createNode(label: string, properties: any) {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized')
    }
    const session = this.driver.session()
    try {
      // Add graphLabel and createdAt to properties
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
      const node = result.records[0]?.get('n')
      return node ? node.identity.toString() : null
    } catch (error) {
      console.error('❌ Node creation failed:', error)
      throw error
    } finally {
      await session.close()
    }
  }

  async createRelationship(
    fromLabel: string,
    fromProps: any,
    relationshipType: string,
    toLabel: string,
    toProps: any,
    relationshipProps: any = {}
  ) {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized')
    }
    const session = this.driver.session()
    try {
      // Ensure both nodes have the correct graphLabel
      const query = `
        MATCH (from:${fromLabel} {graphLabel: $graphLabel})
        MATCH (to:${toLabel} {graphLabel: $graphLabel})
        WHERE from.id = $fromId AND to.id = $toId
        CREATE (from)-[r:${relationshipType} $relProps]->(to)
        RETURN r
      `
      
      const params = {
        graphLabel: this.GRAPH_LABEL,
        fromId: fromProps.id,
        toId: toProps.id,
        relProps: {
          ...relationshipProps,
          graphLabel: this.GRAPH_LABEL,
          createdAt: new Date().toISOString()
        }
      }
      
      const result = await session.run(query, params)
      return result.records[0]?.get('r')
    } catch (error) {
      console.error('❌ Relationship creation failed:', error)
      throw error
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

  async clearGraphData() {
    try {
      console.log(`🗑️ Clearing graph data for graphLabel: ${this.GRAPH_LABEL}`)
      
      const query = `
        MATCH (n {graphLabel: $graphLabel})
        OPTIONAL MATCH (n)-[r]-()
        DELETE r, n
      `
      
      if (!this.driver) {
        throw new Error('Neo4j driver not initialized')
      }
      const session = this.driver.session()
      const result = await session.run(query, { graphLabel: this.GRAPH_LABEL })
      await session.close()
      
      console.log(`✅ Only nodes with graphLabel: ${this.GRAPH_LABEL} were affected`)
      
      return {
        nodesDeleted: 0, // Simplified for now
        relationshipsDeleted: 0
      }
    } catch (error) {
      console.error('❌ Failed to clear graph data:', error)
    }
  }

  async deleteNodesByLabel(label: string) {
    try {
      console.log(`🗑️ Deleting ${label} nodes with graphLabel: ${this.GRAPH_LABEL}`)
      
      const query = `
        MATCH (n:${label} {graphLabel: $graphLabel})
        OPTIONAL MATCH (n)-[r]-()
        DELETE r, n
      `
      
      if (!this.driver) {
        throw new Error('Neo4j driver not initialized')
      }
      const session = this.driver.session()
      const result = await session.run(query, { graphLabel: this.GRAPH_LABEL })
      await session.close()
      
      console.log(`🗑️ Deleted ${label} nodes`)
      return {
        nodesDeleted: 0, // Simplified for now
        relationshipsDeleted: 0
      }
    } catch (error) {
      console.error(`❌ Failed to delete ${label} nodes:`, error)
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
