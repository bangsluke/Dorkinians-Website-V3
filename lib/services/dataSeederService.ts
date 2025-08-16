import { neo4jService } from '@/lib/neo4j'
import { dataService, CSVData, DataSource } from './dataService'

export interface SeedingResult {
  success: boolean
  nodesCreated: number
  relationshipsCreated: number
  errors: string[]
}

export class DataSeederService {
  private static instance: DataSeederService

  static getInstance(): DataSeederService {
    if (!DataSeederService.instance) {
      DataSeederService.instance = new DataSeederService()
    }
    return DataSeederService.instance
  }

  async seedAllData(dataSources: DataSource[]): Promise<SeedingResult> {
    console.log('🌱 Starting data seeding process...')
    
    try {
      // Ensure Neo4j connection
      const connected = await neo4jService.connect()
      if (!connected) {
        throw new Error('Failed to connect to Neo4j database')
      }

      // Clear existing data first
      await neo4jService.clearGraphData()
      
      // Fetch all data sources
      const allData = await dataService.fetchAllDataSources(dataSources)
      
      let totalNodes = 0
      let totalRelationships = 0
      const errors: string[] = []

      // Process each data source
      for (const [sourceName, data] of Array.from(allData.entries())) {
        try {
          console.log(`📊 Processing ${sourceName} with ${data.length} rows...`)
          
          const result = await this.processDataSource(sourceName, data)
          totalNodes += result.nodesCreated
          totalRelationships += result.relationshipsCreated
          
          console.log(`✅ ${sourceName}: ${result.nodesCreated} nodes, ${result.relationshipsCreated} relationships`)
        } catch (error) {
          const errorMsg = `Failed to process ${sourceName}: ${error instanceof Error ? error.message : String(error)}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }

      return {
        success: errors.length === 0,
        nodesCreated: totalNodes,
        relationshipsCreated: totalRelationships,
        errors
      }
    } catch (error) {
      console.error('❌ Data seeding failed:', error)
      return {
        success: false,
        nodesCreated: 0,
        relationshipsCreated: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      }
    }
  }

  private async processDataSource(sourceName: string, data: CSVData[]): Promise<{ nodesCreated: number, relationshipsCreated: number }> {
    let nodesCreated = 0
    let relationshipsCreated = 0

    // Create nodes for each row
    for (const row of data) {
      try {
        // Create main entity node
        const nodeId = await neo4jService.createNode(sourceName, {
          ...row,
          source: sourceName,
          rowId: `${sourceName}_${nodesCreated}`
        } as any)
        
        if (nodeId) {
          nodesCreated++
          
          // Create relationships based on data type
          if (sourceName.includes('Player')) {
            await this.createPlayerRelationships(row, nodeId)
            relationshipsCreated += 2 // Assuming 2 relationships per player
          } else if (sourceName.includes('Fixture')) {
            await this.createFixtureRelationships(row, nodeId)
            relationshipsCreated += 3 // Assuming 3 relationships per fixture
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to process row in ${sourceName}:`, error)
      }
    }

    return { nodesCreated, relationshipsCreated }
  }

  private async createPlayerRelationships(playerData: CSVData, playerNodeId: string) {
    // Create relationships to team, position, etc.
    if (playerData.team) {
      await neo4jService.createRelationship(
        'Player',
        { id: playerNodeId, graphLabel: 'dorkiniansWebsite' } as any,
        'PLAYS_FOR',
        'Team',
        { name: playerData.team, graphLabel: 'dorkiniansWebsite' } as any,
        { graphLabel: 'dorkiniansWebsite' } as any
      )
    }
    
    if (playerData.position) {
      await neo4jService.createRelationship(
        'Player',
        { id: playerNodeId, graphLabel: 'dorkiniansWebsite' } as any,
        'PLAYS_AS',
        'Position',
        { name: playerData.position, graphLabel: 'dorkiniansWebsite' } as any,
        { graphLabel: 'dorkiniansWebsite' } as any
      )
    }
  }

  private async createFixtureRelationships(fixtureData: CSVData, fixtureNodeId: string) {
    // Create relationships to teams, competition, etc.
    if (fixtureData.homeTeam) {
      await neo4jService.createRelationship(
        'Fixture',
        { id: fixtureNodeId, graphLabel: 'dorkiniansWebsite' } as any,
        'HOME_TEAM',
        'Team',
        { name: fixtureData.homeTeam, graphLabel: 'dorkiniansWebsite' } as any,
        { graphLabel: 'dorkiniansWebsite' } as any
      )
    }
    
    if (fixtureData.awayTeam) {
      await neo4jService.createRelationship(
        'Fixture',
        { id: fixtureNodeId, graphLabel: 'dorkiniansWebsite' } as any,
        'AWAY_TEAM',
        'Team',
        { name: fixtureData.awayTeam, graphLabel: 'dorkiniansWebsite' } as any,
        { graphLabel: 'dorkiniansWebsite' } as any
      )
    }
    
    if (fixtureData.competition) {
      await neo4jService.createRelationship(
        'Fixture',
        { id: fixtureNodeId, graphLabel: 'dorkiniansWebsite' } as any,
        'IN_COMPETITION',
        'Competition',
        { name: fixtureData.competition, graphLabel: 'dorkiniansWebsite' } as any,
        { graphLabel: 'dorkiniansWebsite' } as any
      )
    }
  }

  async getDatabaseStats(): Promise<any> {
    return await neo4jService.getDatabaseStats()
  }
}

export const dataSeederService = DataSeederService.getInstance()
