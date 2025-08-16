import neo4j, { Driver, Session } from 'neo4j-driver'

class Neo4jService {
  private driver: Driver | null = null
  private isConnected: boolean = false

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

  isConnectedStatus(): boolean {
    return this.isConnected
  }
}

// Export singleton instance
export const neo4jService = new Neo4jService()

// Export for direct use
export default neo4jService
