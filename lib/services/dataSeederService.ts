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
      console.log('🗑️ Clearing existing graph data...')
      await neo4jService.clearGraphData()
      
      // Apply schema constraints and indexes
      console.log('🏗️ Applying database schema...')
      await this.applySchema()
      
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

  private async applySchema(): Promise<void> {
    try {
      // Apply constraints
      console.log('📋 Applying constraints...')
      const constraints = [
        'CREATE CONSTRAINT player_id_unique IF NOT EXISTS FOR (p:Player) REQUIRE p.id IS UNIQUE',
        'CREATE CONSTRAINT player_name_unique IF NOT EXISTS FOR (p:Player) REQUIRE p.name IS UNIQUE',
        'CREATE CONSTRAINT team_id_unique IF NOT EXISTS FOR (t:Team) REQUIRE t.id IS UNIQUE',
        'CREATE CONSTRAINT team_season_name_unique IF NOT EXISTS FOR (t:Team) REQUIRE (t.season, t.name) IS UNIQUE',
        'CREATE CONSTRAINT season_id_unique IF NOT EXISTS FOR (s:Season) REQUIRE s.id IS UNIQUE',
        'CREATE CONSTRAINT season_years_unique IF NOT EXISTS FOR (s:Season) REQUIRE (s.startYear, s.endYear) IS UNIQUE',
        'CREATE CONSTRAINT fixture_id_unique IF NOT EXISTS FOR (f:Fixture) REQUIRE f.id IS UNIQUE',
        'CREATE CONSTRAINT fixture_season_id_unique IF NOT EXISTS FOR (f:Fixture) REQUIRE (f.season, f.seasonFixId) IS UNIQUE',
        'CREATE CONSTRAINT matchdetail_id_unique IF NOT EXISTS FOR (md:MatchDetail) REQUIRE md.id IS UNIQUE',
        'CREATE CONSTRAINT matchdetail_fixture_player_unique IF NOT EXISTS FOR (md:MatchDetail) REQUIRE (md.fixtureId, md.playerName) IS UNIQUE',
        'CREATE CONSTRAINT totw_id_unique IF NOT EXISTS FOR (t:TOTW) REQUIRE t.id IS UNIQUE',
        'CREATE CONSTRAINT totw_season_week_unique IF NOT EXISTS FOR (t:TOTW) REQUIRE (t.season, t.week) IS UNIQUE',
        'CREATE CONSTRAINT playerofmonth_id_unique IF NOT EXISTS FOR (pom:PlayerOfTheMonth) REQUIRE (pom.season, pom.month, pom.playerName) IS UNIQUE',
        'CREATE CONSTRAINT opposition_id_unique IF NOT EXISTS FOR (o:OppositionDetail) REQUIRE o.id IS UNIQUE',
        'CREATE CONSTRAINT opposition_name_unique IF NOT EXISTS FOR (o:OppositionDetail) REQUIRE o.oppositionName IS UNIQUE'
      ]

      for (const constraint of constraints) {
        try {
          await neo4jService.runQuery(constraint)
        } catch (error) {
          if (error instanceof Error && !error.message.includes('already exists')) {
            console.warn(`⚠️ Constraint issue: ${constraint.split(' ')[2]} - ${error.message}`)
          }
        }
      }

      // Apply indexes
      console.log('📊 Applying indexes...')
      const indexes = [
        'CREATE INDEX player_name_index IF NOT EXISTS FOR (p:Player) ON (p.name)',
        'CREATE INDEX player_allowonsite_index IF NOT EXISTS FOR (p:Player) ON (p.allowOnSite)',
        'CREATE INDEX team_name_index IF NOT EXISTS FOR (t:Team) ON (t.name)',
        'CREATE INDEX team_season_index IF NOT EXISTS FOR (t:Team) ON (t.season)',
        'CREATE INDEX team_league_index IF NOT EXISTS FOR (t:Team) ON (t.league)',
        'CREATE INDEX season_startyear_index IF NOT EXISTS FOR (s:Season) ON (s.startYear)',
        'CREATE INDEX season_endyear_index IF NOT EXISTS FOR (s:Season) ON (s.endYear)',
        'CREATE INDEX season_active_index IF NOT EXISTS FOR (s:Season) ON (s.isActive)',
        'CREATE INDEX fixture_date_index IF NOT EXISTS FOR (f:Fixture) ON (f.date)',
        'CREATE INDEX fixture_season_index IF NOT EXISTS FOR (f:Fixture) ON (f.season)',
        'CREATE INDEX fixture_hometeam_index IF NOT EXISTS FOR (f:Fixture) ON (f.homeTeam)',
        'CREATE INDEX fixture_awayteam_index IF NOT EXISTS FOR (f:Fixture) ON (f.awayTeam)',
        'CREATE INDEX fixture_result_index IF NOT EXISTS FOR (f:Fixture) ON (f.result)',
        'CREATE INDEX fixture_competition_index IF NOT EXISTS FOR (f:Fixture) ON (f.competition)',
        'CREATE INDEX matchdetail_player_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.playerName)',
        'CREATE INDEX matchdetail_team_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.team)',
        'CREATE INDEX matchdetail_date_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.date)',
        'CREATE INDEX matchdetail_fixtureid_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.fixtureId)',
        'CREATE INDEX matchdetail_class_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.class)',
        'CREATE INDEX totw_season_index IF NOT EXISTS FOR (t:TOTW) ON (t.season)',
        'CREATE INDEX totw_week_index IF NOT EXISTS FOR (t:TOTW) ON (t.week)',
        'CREATE INDEX totw_seasonweek_index IF NOT EXISTS FOR (t:TOTW) ON (t.seasonWeekNumRef)',
        'CREATE INDEX totw_starman_index IF NOT EXISTS FOR (t:TOTW) ON (t.starMan)',
        'CREATE INDEX playerofmonth_season_index IF NOT EXISTS FOR (pom:PlayerOfTheMonth) ON (pom.season)',
        'CREATE INDEX playerofmonth_month_index IF NOT EXISTS FOR (pom:PlayerOfTheMonth) ON (pom.month)',
        'CREATE INDEX playerofmonth_player_index IF NOT EXISTS FOR (pom:PlayerOfTheMonth) ON (pom.playerName)',
        'CREATE INDEX playerofmonth_team_index IF NOT EXISTS FOR (pom:PlayerOfTheMonth) ON (pom.team)',
        'CREATE INDEX opposition_league_index IF NOT EXISTS FOR (o:OppositionDetail) ON (o.league)',
        'CREATE INDEX opposition_division_index IF NOT EXISTS FOR (o:OppositionDetail) ON (o.division)'
      ]

      for (const index of indexes) {
        try {
          await neo4jService.runQuery(index)
        } catch (error) {
          if (error instanceof Error && !error.message.includes('already exists')) {
            console.warn(`⚠️ Index issue: ${index.split(' ')[2]} - ${error.message}`)
          }
        }
      }

      console.log('✅ Schema applied successfully')
    } catch (error) {
      console.error('❌ Failed to apply schema:', error)
      throw error
    }
  }

  private async processDataSource(sourceName: string, data: CSVData[]): Promise<{ nodesCreated: number, relationshipsCreated: number }> {
    let nodesCreated = 0
    let relationshipsCreated = 0

    // Map table names to semantic node labels
    const getNodeLabel = (tableName: string): string => {
      if (tableName.includes('Player')) return 'Player'
      if (tableName.includes('FixturesAndResults')) return 'Fixture'
      if (tableName.includes('MatchDetails')) return 'MatchDetail'
      if (tableName.includes('WeeklyTOTW')) return 'TOTW'
      if (tableName.includes('SeasonTOTW')) return 'SeasonTOTW'
      if (tableName.includes('PlayersOfTheMonth')) return 'PlayerOfTheMonth'
      if (tableName.includes('StatDetails')) return 'StatDetail'
      if (tableName.includes('OppositionDetails')) return 'OppositionDetail'
      if (tableName.includes('SiteDetails')) return 'SiteDetail'
      return tableName // fallback to table name if no match
    }

    const nodeLabel = getNodeLabel(sourceName)
    console.log(`🏷️ Using node label: ${nodeLabel} for table: ${sourceName}`)

    // Create nodes for each row
    console.log(`🔄 Processing ${data.length} rows for ${sourceName}`)
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex]
      try {
        // Map CSV data to schema properties
        const mappedProperties = this.mapCSVToSchema(sourceName, row, rowIndex)
        
        // Validate that we have a unique ID
        if (!mappedProperties.id || mappedProperties.id.includes('unknown-unknown')) {
          console.warn(`⚠️ Skipping row ${rowIndex} in ${sourceName}: Invalid ID generated: ${mappedProperties.id}`)
          continue
        }
        
        // Check if node already exists to prevent duplicates
        const existingNode = await this.checkNodeExists(nodeLabel, mappedProperties.id)
        if (existingNode) {
          console.log(`ℹ️ Skipping row ${rowIndex} in ${sourceName}: Node already exists with ID: ${mappedProperties.id}`)
          continue
        }
        
        // Create main entity node with semantic label
        const nodeId = await neo4jService.createNode(nodeLabel, mappedProperties)
        
        if (nodeId) {
          nodesCreated++
          console.log(`✅ Created ${nodeLabel} node: ${mappedProperties.id}`)
          
          // Create relationships based on data type
          console.log(`🔍 RELATIONSHIP DEBUG: sourceName="${sourceName}", includes('FixturesAndResults')=${sourceName.includes('FixturesAndResults')}`)
          if (sourceName.includes('Player')) {
            console.log(`🔗 Creating Player relationships for: ${mappedProperties.name}`)
            const playerRels = await this.createPlayerRelationships(mappedProperties, nodeId)
            relationshipsCreated += playerRels
            console.log(`  Created ${playerRels} Player relationships`)
          } else if (sourceName.includes('FixturesAndResults')) {
            console.log(`🚨 ENTERING FixturesAndResults RELATIONSHIP CREATION`)
            console.log(`  Source name: "${sourceName}"`)
            console.log(`  Includes check: ${sourceName.includes('FixturesAndResults')}`)
            console.log(`  About to call createFixtureRelationships...`)
            const fixtureRels = await this.createFixtureRelationships(mappedProperties, nodeId)
            console.log(`  createFixtureRelationships returned: ${fixtureRels}`)
            relationshipsCreated += fixtureRels
            console.log(`  Created ${fixtureRels} Fixture relationships`)
          } else {
            console.log(`ℹ️ No relationship creation for source: ${sourceName}`)
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to process row ${rowIndex} in ${sourceName}:`, error)
      }
    }

    return { nodesCreated, relationshipsCreated }
  }

  private mapCSVToSchema(sourceName: string, row: CSVData, rowIndex: number): any {
    // Map CSV column names to schema property names
    if (sourceName.includes('Player')) {
      const playerName = row['NAME'] || `unknown-player-${rowIndex}`
      return {
        id: `player-${playerName.toString().toLowerCase().replace(/\s+/g, '-')}`,
        name: row['NAME'] || null,
        allowOnSite: row['ALLOW ON SITE'] === 'TRUE',
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    if (sourceName.includes('FixturesAndResults')) {
      const season = row['SEASON'] || `unknown-season-${rowIndex}`
      const seasonFixId = row['SEASON FIX ID'] || `unknown-id-${rowIndex}`
      return {
        id: `fixture-${season}-${seasonFixId}`,
        season: row['SEASON'] || null,
        seasonFixId: row['SEASON FIX ID'] || null,
        date: row['DATE'] || null,
        team: row['TEAM'] || null,
        compType: row['COMP TYPE'] || null,
        competition: row['COMPETITION'] || null,
        opposition: row['OPPOSITION'] || null,
        homeAway: row['HOME/AWAY'] || null,
        result: row['RESULT'] || null,
        homeScore: row['HOME SCORE'] || null,
        awayScore: row['AWAY SCORE'] || null,
        fullResult: row['FULL RESULT'] || null,
        dorkiniansGoals: this.parseNumber(row['DORKINIANS GOALS']),
        conceded: this.parseNumber(row['CONCEDED']),
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    if (sourceName.includes('MatchDetails')) {
      const fixtureId = row['FIXTURE_ID'] || `unknown-fixture-${rowIndex}`
      const playerName = row['PLAYER_NAME'] || `unknown-player-${rowIndex}`
      return {
        id: `match-${fixtureId}-${playerName}`,
        fixtureId: row['FIXTURE_ID'] || null,
        playerName: row['PLAYER_NAME'] || null,
        team: row['TEAM'] || null,
        date: row['DATE'] || null,
        class: row['CLASS'] || null,
        // Add all the statistical properties
        goals: this.parseNumber(row['GOALS']),
        assists: this.parseNumber(row['ASSISTS']),
        cleanSheets: this.parseNumber(row['CLEAN_SHEETS']),
        starMan: this.parseNumber(row['STAR_MAN']),
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    if (sourceName.includes('WeeklyTOTW')) {
      const season = row['SEASON'] || `unknown-season-${rowIndex}`
      const week = row['WEEK'] || `unknown-week-${rowIndex}`
      return {
        id: `totw-weekly-${season}-${week}`,
        season: row['SEASON'] || null,
        week: row['WEEK'] || null,
        seasonWeekNumRef: row['SEASON_WEEK_NUM_REF'] || null,
        starMan: row['STAR_MAN'] || null,
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    if (sourceName.includes('SeasonTOTW')) {
      const season = row['SEASON'] || `unknown-season-${rowIndex}`
      const playerName = row['PLAYER_NAME'] || `unknown-player-${rowIndex}`
      return {
        id: `totw-season-${season}-${playerName}`,
        season: row['SEASON'] || null,
        playerName: row['PLAYER_NAME'] || null,
        team: row['TEAM'] || null,
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    if (sourceName.includes('PlayersOfTheMonth')) {
      const season = row['SEASON'] || `unknown-season-${rowIndex}`
      const month = row['MONTH'] || `unknown-month-${rowIndex}`
      const playerName = row['PLAYER_NAME'] || `unknown-player-${rowIndex}`
      return {
        id: `pom-${season}-${month}-${playerName}`,
        season: row['SEASON'] || null,
        month: row['MONTH'] || null,
        playerName: row['PLAYER_NAME'] || null,
        team: row['TEAM'] || null,
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    if (sourceName.includes('StatDetails')) {
      const season = row['SEASON'] || `unknown-season-${rowIndex}`
      const playerName = row['PLAYER_NAME'] || `unknown-player-${rowIndex}`
      return {
        id: `stat-${season}-${playerName}`,
        season: row['SEASON'] || null,
        playerName: row['PLAYER_NAME'] || null,
        team: row['TEAM'] || null,
        goals: this.parseNumber(row['GOALS']),
        assists: this.parseNumber(row['ASSISTS']),
        cleanSheets: this.parseNumber(row['CLEAN_SHEETS']),
        starMan: this.parseNumber(row['STAR_MAN']),
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    if (sourceName.includes('OppositionDetails')) {
      const name = row['NAME'] || `unknown-opposition-${rowIndex}`
      return {
        id: `opposition-${name}`,
        oppositionName: row['NAME'] || null,
        league: row['LEAGUE'] || null,
        division: row['DIVISION'] || null,
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    // Default mapping for unknown types
    return {
      ...row,
      id: `${sourceName.toLowerCase()}-${rowIndex}-${Object.values(row).join('-').toLowerCase().replace(/\s+/g, '-')}`,
      graphLabel: 'dorkiniansWebsite',
      createdAt: new Date().toISOString()
    }
  }

  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null
    const num = Number(value)
    return isNaN(num) ? null : num
  }

  private async checkNodeExists(label: string, id: string): Promise<boolean> {
    try {
      const query = `
        MATCH (n:${label} {id: $id, graphLabel: 'dorkiniansWebsite'})
        RETURN n
        LIMIT 1
      `
      const result = await neo4jService.runQuery(query, { id })
      return result.records.length > 0
    } catch (error) {
      console.warn(`⚠️ Error checking if node exists: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  private async ensureNodeExists(label: string, properties: any): Promise<string> {
    try {
      // Check if node already exists
      const existingNode = await this.checkNodeExists(label, properties.id)
      if (existingNode) {
        return properties.id
      }
      
      // Create the node if it doesn't exist
      const nodeId = await neo4jService.createNode(label, properties)
      if (nodeId) {
        console.log(`✅ Created ${label} node: ${properties.id}`)
        return nodeId
      }
      
      throw new Error(`Failed to create ${label} node: ${properties.id}`)
    } catch (error) {
      console.warn(`⚠️ Error ensuring ${label} node exists: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  private async createPlayerRelationships(playerData: CSVData, playerNodeId: string): Promise<number> {
    // Player relationships will be created based on match data, not static CSV data
    // This method is kept for future use when we implement dynamic relationship creation
    console.log(`ℹ️ Player ${playerData.name}: Relationships will be created from match data`)
    return 0 // No relationships created yet
  }

  private async createFixtureRelationships(fixtureData: CSVData, fixtureNodeId: string): Promise<number> {
    console.log(`🔍 createFixtureRelationships called for: ${fixtureData.id}`)
    let relationshipsCreated = 0
    
    // Create relationships only for data that actually exists
    if (fixtureData.competition && fixtureData.competition !== '-') {
      try {
        // First ensure the competition node exists, then create relationship
        const competitionId = `competition-${String(fixtureData.competition).toLowerCase().replace(/\s+/g, '-')}`
        
        await this.ensureNodeExists('Competition', {
          id: competitionId,
          name: fixtureData.competition,
          graphLabel: 'dorkiniansWebsite',
          createdAt: new Date().toISOString()
        })
        
        const relationship = await neo4jService.createRelationship(
          'Fixture',
          { id: fixtureNodeId, graphLabel: 'dorkiniansWebsite' } as any,
          'IN_COMPETITION',
          'Competition',
          { id: competitionId, graphLabel: 'dorkiniansWebsite' } as any,
          { graphLabel: 'dorkiniansWebsite' } as any
        )
        
        if (relationship) {
          relationshipsCreated++
        }
      } catch (error) {
        console.warn(`⚠️ Failed to create competition relationship for fixture ${fixtureData.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    
    return relationshipsCreated
  }

  async getDatabaseStats(): Promise<any> {
    return await neo4jService.getDatabaseStats()
  }
}

export const dataSeederService = DataSeederService.getInstance()
