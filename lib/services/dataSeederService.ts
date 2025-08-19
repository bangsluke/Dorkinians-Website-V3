import { neo4jService } from '@/lib/neo4j'
import { dataService, CSVRow, DataSource } from './dataService'
import { csvHeaderValidator, CSVHeaderValidationResult } from './csvHeaderValidator'
import { emailService, CSVHeaderValidationFailure } from './emailService'
import { getEmailConfig } from '@/lib/config/emailConfig'
import * as fs from 'fs'
import * as path from 'path'

export interface SeedingResult {
  success: boolean
  nodesCreated: number
  relationshipsCreated: number
  errors: string[]
  unknownNodes: string[]
}

export class DataSeederService {
  private static instance: DataSeederService
  private errorLogPath: string

  constructor() {
    this.errorLogPath = path.join(process.cwd(), 'logs', 'seeding-errors.log')
    this.ensureLogDirectory()
  }

  static getInstance(): DataSeederService {
    if (!DataSeederService.instance) {
      DataSeederService.instance = new DataSeederService()
    }
    return DataSeederService.instance
  }

  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.errorLogPath)
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
  }

  private logError(message: string, details?: any): void {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ${message}${details ? '\nDetails: ' + JSON.stringify(details, null, 2) : ''}\n`
    
    try {
      fs.appendFileSync(this.errorLogPath, logEntry)
      console.log(`📝 Error logged to: ${this.errorLogPath}`)
    } catch (error) {
      console.error('Failed to write to error log:', error)
    }
  }

  private logConsoleError(message: string, details?: any): void {
    // Log to console with ❌ symbol
    console.error(`❌ ${message}`)
    
    // Also log to error file
    this.logError(message, details)
  }

  async seedAllData(dataSources: DataSource[]): Promise<SeedingResult> {
    console.log('🌱 Starting data seeding process...')
    
    // Clear previous error log for this run
    try {
      fs.writeFileSync(this.errorLogPath, `=== SEEDING RUN STARTED: ${new Date().toISOString()} ===\n`)
    } catch (error) {
      console.error('Failed to clear error log:', error)
    }
    
    try {
      // Step 1: Configure email service if available
      const emailConfig = getEmailConfig()
      if (emailConfig) {
        emailService.configure(emailConfig)
        console.log('📧 Email service configured for CSV header validation notifications')
      } else {
        console.log('⚠️ Email service not configured - CSV header validation failures will not be emailed')
      }
      
      // Step 2: Validate CSV headers before proceeding
      console.log('🔍 Step 2: Validating CSV headers...')
      const headerValidationResult = await csvHeaderValidator.validateAllCSVHeaders(dataSources)
      
      if (!headerValidationResult.isValid) {
        const errorMsg = `CSV header validation failed. ${headerValidationResult.failedSources} out of ${headerValidationResult.totalSources} data sources have invalid headers.`
        console.error(`❌ ${errorMsg}`)
        
        // Log the validation failures
        this.logError('CSV Header Validation Failed', {
          totalSources: headerValidationResult.totalSources,
          validSources: headerValidationResult.validSources,
          failedSources: headerValidationResult.failedSources,
          failures: headerValidationResult.failures
        })
        
        // Try to send email notification
        try {
          await emailService.sendCSVHeaderValidationFailure(headerValidationResult.failures)
          console.log('📧 Email notification sent for CSV header validation failures')
        } catch (emailError) {
          console.error('❌ Failed to send email notification:', emailError)
          this.logError('Failed to send email notification for CSV header validation failures', { emailError })
        }
        
        // Return early with validation failure
        return {
          success: false,
          nodesCreated: 0,
          relationshipsCreated: 0,
          errors: [errorMsg, ...headerValidationResult.failures.map(f => 
            `${f.sourceName}: Missing [${f.missingHeaders.join(', ')}], Extra [${f.extraHeaders.join(', ')}]`
          )],
          unknownNodes: []
        }
      }
      
      console.log('✅ CSV header validation passed')
      
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
      const unknownNodes: string[] = []

      // Phase 1: Create all nodes first
      console.log('\n🔄 Phase 1: Creating all nodes...')
      const allNodes: Array<{ id: string, properties: any, sourceName: string, nodeLabel: string }> = []
      
      for (const [sourceName, data] of Array.from(allData.entries())) {
        try {
          console.log(`📊 Creating nodes for ${sourceName} with ${data.length} rows...`)
          
          const result = await this.createNodesForDataSource(sourceName, data)
          totalNodes += result.nodesCreated
          allNodes.push(...result.createdNodes)
          
          // Check for unknown nodes
          result.createdNodes.forEach(node => {
            if (node.id.includes('unknown') || JSON.stringify(node.properties).includes('unknown')) {
              unknownNodes.push(`${node.nodeLabel}: ${node.id}`)
              this.logError(`Unknown node detected: ${node.nodeLabel} - ${node.id}`, node.properties)
            }
          })
          
          console.log(`✅ ${sourceName}: ${result.nodesCreated} nodes created`)
        } catch (error) {
          const errorMsg = `Failed to create nodes for ${sourceName}: ${error instanceof Error ? error.message : String(error)}`
          console.error(errorMsg)
          errors.push(errorMsg)
          this.logError(errorMsg, { sourceName, dataLength: data.length })
        }
      }

      // Phase 2: Create relationships between existing nodes
      console.log('\n🔗 Phase 2: Creating relationships...')
      for (const node of allNodes) {
        try {
          const relationshipsCreated = await this.createRelationshipsForNode(node)
          totalRelationships += relationshipsCreated
          
          if (relationshipsCreated === 0) {
            this.logError(`No relationships created for node: ${node.nodeLabel} - ${node.id}`, node.properties)
          }
        } catch (error) {
          const errorMsg = `Failed to create relationships for node ${node.id}: ${error instanceof Error ? error.message : String(error)}`
          console.warn(`⚠️ ${errorMsg}`)
          this.logError(errorMsg, { nodeId: node.id, nodeLabel: node.nodeLabel, properties: node.properties })
        }
      }

      console.log(`\n🎉 Seeding completed: ${totalNodes} nodes, ${totalRelationships} relationships`)
      
      // Log final summary
      const summary = {
        totalNodes,
        totalRelationships,
        errors: errors.length,
        unknownNodes: unknownNodes.length,
        success: errors.length === 0
      }
      
      this.logError(`Seeding completed with summary:`, summary)

      return {
        success: errors.length === 0,
        nodesCreated: totalNodes,
        relationshipsCreated: totalRelationships,
        errors,
        unknownNodes
      }
    } catch (error) {
      const errorMsg = `Data seeding failed: ${error instanceof Error ? error.message : String(error)}`
      this.logConsoleError(errorMsg, { stack: error instanceof Error ? error.stack : undefined })
      
      return {
        success: false,
        nodesCreated: 0,
        relationshipsCreated: 0,
        errors: [errorMsg],
        unknownNodes: []
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
        'CREATE CONSTRAINT fixture_id_unique IF NOT EXISTS FOR (f:Fixture) REQUIRE f.id IS UNIQUE',
        'CREATE CONSTRAINT fixture_season_id_unique IF NOT EXISTS FOR (f:Fixture) REQUIRE (f.season, f.seasonFixId) IS UNIQUE',
        'CREATE CONSTRAINT matchdetail_id_unique IF NOT EXISTS FOR (md:MatchDetail) REQUIRE md.id IS UNIQUE',
        'CREATE CONSTRAINT matchdetail_fixture_player_unique IF NOT EXISTS FOR (md:MatchDetail) REQUIRE (md.fixtureId, md.playerName) IS UNIQUE',
        'CREATE CONSTRAINT totw_id_unique IF NOT EXISTS FOR (t:TOTW) REQUIRE t.id IS UNIQUE',
        'CREATE CONSTRAINT totw_season_week_unique IF NOT EXISTS FOR (t:TOTW) REQUIRE (t.season, t.week) IS UNIQUE',
        'CREATE CONSTRAINT season_totw_id_unique IF NOT EXISTS FOR (st:SeasonTOTW) REQUIRE st.id IS UNIQUE',
        'CREATE CONSTRAINT season_totw_season_unique IF NOT EXISTS FOR (st:SeasonTOTW) REQUIRE st.season IS UNIQUE',
        'CREATE CONSTRAINT playerofmonth_id_unique IF NOT EXISTS FOR (pom:PlayerOfTheMonth) REQUIRE pom.id IS UNIQUE',
        'CREATE CONSTRAINT opposition_id_unique IF NOT EXISTS FOR (o:OppositionDetail) REQUIRE o.id IS UNIQUE'
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
        'CREATE INDEX fixture_conceded_index IF NOT EXISTS FOR (f:Fixture) ON (f.conceded)',
        'CREATE INDEX matchdetail_player_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.playerName)',
        'CREATE INDEX matchdetail_team_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.team)',
        'CREATE INDEX matchdetail_date_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.date)',
        'CREATE INDEX matchdetail_fixtureid_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.fixtureId)',
        'CREATE INDEX matchdetail_class_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.class)',
        'CREATE INDEX matchdetail_goals_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.goals)',
        'CREATE INDEX matchdetail_assists_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.assists)',
        'CREATE INDEX matchdetail_manofmatch_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.manOfMatch)',
        'CREATE INDEX matchdetail_yellowcards_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.yellowCards)',
        'CREATE INDEX matchdetail_redcards_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.redCards)',
        'CREATE INDEX matchdetail_saves_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.saves)',
        'CREATE INDEX matchdetail_owngoals_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.ownGoals)',
        'CREATE INDEX matchdetail_penaltiesscored_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.penaltiesScored)',
        'CREATE INDEX matchdetail_penaltiesmissed_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.penaltiesMissed)',
        'CREATE INDEX matchdetail_penaltiesconceded_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.penaltiesConceded)',
        'CREATE INDEX matchdetail_penaltiessaved_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.penaltiesSaved)',
                                     'CREATE INDEX totw_season_index IF NOT EXISTS FOR (t:TOTW) ON (t.season)',
        'CREATE INDEX totw_week_index IF NOT EXISTS FOR (t:TOTW) ON (t.week)',
        'CREATE INDEX totw_starman_index IF NOT EXISTS FOR (t:TOTW) ON (t.starMan)',
        'CREATE INDEX totw_seasonweek_index IF NOT EXISTS FOR (t:TOTW) ON (t.seasonWeekNumRef)',
        'CREATE INDEX season_totw_season_index IF NOT EXISTS FOR (st:SeasonTOTW) ON (st.season)',
        'CREATE INDEX season_totw_starman_index IF NOT EXISTS FOR (st:SeasonTOTW) ON (st.starMan)',
        'CREATE INDEX playerofmonth_season_index IF NOT EXISTS FOR (pom:PlayerOfTheMonth) ON (pom.season)',
        'CREATE INDEX playerofmonth_month_index IF NOT EXISTS FOR (pom:PlayerOfTheMonth) ON (pom.month)',
        'CREATE INDEX playerofmonth_seasonmonth_index IF NOT EXISTS FOR (pom:PlayerOfTheMonth) ON (pom.seasonMonthRef)',
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
      const errorMsg = `Failed to apply schema: ${error instanceof Error ? error.message : String(error)}`
      this.logConsoleError(errorMsg, { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  private async createNodesForDataSource(sourceName: string, data: CSVRow[]): Promise<{ nodesCreated: number, createdNodes: Array<{ id: string, properties: any, sourceName: string, nodeLabel: string }> }> {
    let nodesCreated = 0
    const createdNodes: Array<{ id: string, properties: any, sourceName: string, nodeLabel: string }> = []

    // Map table names to semantic node labels
    const getNodeLabel = (tableName: string): string => {
      if (tableName.includes('Player')) return 'Player'
      if (tableName.includes('FixturesAndResults')) return 'Fixture'
      if (tableName.includes('MatchDetails')) return 'MatchDetail'
      if (tableName.includes('WeeklyTOTW')) return 'TOTW'
      if (tableName.includes('SeasonTOTW')) return 'SeasonTOTW'
      if (tableName.includes('PlayersOfTheMonth')) return 'PlayerOfTheMonth'
      // StatDetails is handled as table data, not graph nodes
      if (tableName.includes('OppositionDetails')) return 'OppositionDetail'
      if (tableName.includes('SiteDetails')) return 'SiteDetail'
      return tableName // fallback to table name if no match
    }

    const nodeLabel = getNodeLabel(sourceName)
    console.log(`🏷️ Using node label: ${nodeLabel} for table: ${sourceName}`)

    // Create nodes for each row
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex]
      try {
        // Map CSV data to schema properties
        const mappedProperties = this.mapCSVToSchema(sourceName, row, rowIndex)
        
        // Skip rows that return null (invalid data)
        if (!mappedProperties) {
          console.log(`ℹ️ Skipping row ${rowIndex} in ${sourceName}: Invalid data`)
          continue
        }
        
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
          createdNodes.push({ 
            id: nodeId, 
            properties: mappedProperties, 
            sourceName, 
            nodeLabel 
          })
          console.log(`✅ Created ${nodeLabel} node: ${mappedProperties.id}`)
        }
      } catch (error) {
        console.warn(`⚠️ Failed to process row ${rowIndex} in ${sourceName}:`, error)
      }
    }

    return { nodesCreated, createdNodes }
  }

  private async createRelationshipsForNode(node: { id: string, properties: any, sourceName: string, nodeLabel: string }): Promise<number> {
    let relationshipsCreated = 0
    
    try {
      if (node.sourceName.includes('Player')) {
        console.log(`🔗 Creating Player relationships for: ${node.properties.name}`)
        relationshipsCreated = await this.createPlayerRelationships(node.properties, node.id)
      } else if (node.sourceName.includes('FixturesAndResults')) {
        console.log(`🔗 Creating Fixture relationships for: ${node.properties.id}`)
        relationshipsCreated = await this.createFixtureRelationships(node.properties, node.id)
      } else if (node.sourceName.includes('MatchDetails')) {
        console.log(`🔗 Creating MatchDetail relationships for: ${node.properties.id}`)
        relationshipsCreated = await this.createMatchDetailRelationships(node.properties, node.id)
      } else if (node.sourceName.includes('WeeklyTOTW') || node.sourceName.includes('SeasonTOTW')) {
        console.log(`🔗 Creating TOTW relationships for: ${node.properties.id}`)
        relationshipsCreated = await this.createTOTWRelationships(node.properties, node.id)
      } else if (node.sourceName.includes('PlayersOfTheMonth')) {
        console.log(`🔗 Creating PlayerOfMonth relationships for: ${node.properties.id}`)
        relationshipsCreated = await this.createPlayerOfMonthRelationships(node.properties, node.id)
      } else {
        console.log(`ℹ️ No relationship creation for source: ${node.sourceName}`)
      }
      
      if (relationshipsCreated > 0) {
        console.log(`  ✅ Created ${relationshipsCreated} relationships for ${node.properties.id}`)
      }
      
    } catch (error) {
      console.warn(`⚠️ Failed to create relationships for node ${node.id}:`, error)
    }
    
    return relationshipsCreated
  }

  private mapCSVToSchema(sourceName: string, row: CSVRow, rowIndex: number): any {
    // Map CSV column names to schema property names
    if (sourceName.includes('Player')) {
      const playerName = String(this.findColumnValue(row, ['PLAYER NAME']) || `unknown-player-${rowIndex}`)
      const allowOnSite = String(this.findColumnValue(row, ['ALLOW ON SITE'])) === 'TRUE'
      const mostPlayedForTeam = String(this.findColumnValue(row, ['MOST PLAYED FOR TEAM']) || '')
      const mostCommonPosition = String(this.findColumnValue(row, ['MOST COMMON POSITION']) || '')
      
      // Skip players who are not allowed on site
      if (!allowOnSite) {
        console.log(`ℹ️ Skipping player ${playerName}: ALLOW ON SITE = FALSE`)
        return null
      }
      
      // Skip players with blank team or position values
      if (!mostPlayedForTeam || mostPlayedForTeam.trim() === '' || 
          !mostCommonPosition || mostCommonPosition.trim() === '') {
        console.log(`ℹ️ Skipping player ${playerName}: Missing team or position data`)
        return null
      }
      
      return {
        id: `player-${playerName.toLowerCase().replace(/\s+/g, '-')}`,
        name: playerName,
        allowOnSite: true,
        mostPlayedForTeam: mostPlayedForTeam,
        mostCommonPosition: mostCommonPosition,
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    if (sourceName.includes('FixturesAndResults')) {
      // Debug: Show actual row data
      this.debugRowKeys(row, rowIndex)
      
      // Use positional indexing since first 3 columns were deleted from CSV
      // Original columns: [0]=SEASON, [1]=FIX ID, [2]=COMPETITION, [3]=DATE, [4]=TEAM, [5]=OPPOSITION, [6]=RESULT, [7]=HOME SCORE, [8]=AWAY SCORE, [9]=CONCEDED
      // After deletion: [0]=DATE, [1]=TEAM, [2]=OPPOSITION, [3]=RESULT, [4]=HOME SCORE, [5]=AWAY SCORE, [6]=CONCEDED
      const date = String(row[0] || '')
      const team = String(row[1] || '')
      const opposition = String(row[2] || '')
      const result = String(row[3] || '')
      const homeScore = row[4] || null
      const awayScore = row[5] || null
      const conceded = row[6] || null
      
      // Since SEASON and FIX ID columns were deleted, we need to generate them
      const seasonFixId = `fix-${rowIndex + 1}` // Generate a sequential fixture ID
      
      if (rowIndex < 3) {
        console.log(`🔍 Mapped values: date="${date}", team="${team}", opposition="${opposition}", seasonFixId="${seasonFixId}"`)
      }
      
      // Extract season from date since SEASON column was deleted
      let finalSeason = null
      if (date && date.includes(',')) {
        // Date format: "Sat, 10 Sep 2016" - extract year
        const yearMatch = date.match(/(\d{4})/)
        if (yearMatch) {
          const year = parseInt(yearMatch[1])
          finalSeason = `${year}/${year + 1}`
          console.log(`🔍 Extracted season "${finalSeason}" from date "${date}"`)
        }
      } else if (date && date.includes('/')) {
        // Date format: "10/09/16" - extract year
        const dateParts = date.split('/')
        if (dateParts.length >= 3) {
          const year = dateParts[2]
          if (year && year.length === 2) {
            finalSeason = `20${year}/17` // Convert 2-digit year to season format
            console.log(`🔍 Extracted season "${finalSeason}" from date "${date}"`)
          }
        }
      }
      
      // If we still don't have a valid season, skip this row
      if (!finalSeason || finalSeason.trim() === '' || finalSeason.includes('unknown')) {
        console.warn(`⚠️ Skipping row ${rowIndex}: No valid season found. date="${date}"`)
        return null // This will cause the row to be skipped
      }
      
      // Validate seasonFixId
      if (!seasonFixId || seasonFixId.trim() === '') {
        console.warn(`⚠️ Skipping row ${rowIndex}: No valid FIX ID found. seasonFixId="${seasonFixId}"`)
        return null
      }
      
      // Skip fixtures with invalid opposition or team data (competition column was deleted)
      if (opposition === 'No Game' || 
          team === 'HOME/AWAY' || team === '-') {
        console.log(`ℹ️ Skipping fixture ${seasonFixId}: Invalid data (opposition="${opposition}", team="${team}")`)
        return null
      }
      
      return {
        id: `fixture-${finalSeason}-${seasonFixId}`,
        season: finalSeason,
        seasonFixId: seasonFixId,
        date: date,
        team: team,
        competition: 'Unknown', // Competition column was deleted, set default value
        opposition: opposition,
        result: result,
        homeScore: this.parseNumber(homeScore),
        awayScore: this.parseNumber(awayScore),
        conceded: this.parseNumber(conceded),
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    if (sourceName.includes('MatchDetails')) {
      // Use actual column names from CSV
      const team = String(this.findColumnValue(row, ['TEAM']) || '')
      const playerName = String(this.findColumnValue(row, ['PLAYER NAME']) || `unknown-player-${rowIndex}`)
      const fixtureDesc = String(this.findColumnValue(row, ['DATE']) || '')
      const minutes = this.findColumnValue(row, ['MIN']) || null
      const position = String(this.findColumnValue(row, ['CLASS']) || '')
      const goals = this.findColumnValue(row, ['G']) || null
      const assists = this.findColumnValue(row, ['A']) || null
      const manOfMatch = this.findColumnValue(row, ['MOM']) || null
      const yellowCards = this.findColumnValue(row, ['Y']) || null
      const redCards = this.findColumnValue(row, ['R']) || null
      const saves = this.findColumnValue(row, ['SAVES']) || null
      const ownGoals = this.findColumnValue(row, ['OG']) || null
      const penaltiesScored = this.findColumnValue(row, ['PSC']) || null
      const penaltiesMissed = this.findColumnValue(row, ['PM']) || null
      const penaltiesConceded = this.findColumnValue(row, ['PCO']) || null
      const penaltiesSaved = this.findColumnValue(row, ['PSV']) || null
      
      // Extract season from fixture description (e.g., "10/09/16 - Old Thorntonians First - Away")
      let season = null
      if (fixtureDesc && fixtureDesc.includes('/')) {
        const datePart = fixtureDesc.split(' - ')[0]
        if (datePart && datePart.includes('/')) {
          const year = datePart.split('/')[2]
          if (year && year.length === 2) {
            season = `20${year}/17` // Convert 2-digit year to season format (e.g., 16 -> 2016/17)
          }
        }
      }
      
      // Create a fixture ID from the description - use a more reliable method
      let fixtureId = null
      if (fixtureDesc) {
        // Try to extract a meaningful ID from the fixture description
        const cleanDesc = fixtureDesc.replace(/[^a-zA-Z0-9\s\-]/g, '').trim()
        if (cleanDesc) {
          fixtureId = `fixture-${cleanDesc.replace(/\s+/g, '-').toLowerCase()}`
        }
      }
      
      // If we couldn't create a meaningful fixture ID, use a fallback
      if (!fixtureId) {
        fixtureId = `fixture-${rowIndex}-${team}-${playerName}`
      }
      
      return {
        id: `match-${fixtureId}-${playerName}`,
        fixtureId: fixtureId,
        playerName: playerName,
        team: team,
        season: season,
        date: fixtureDesc, // Use fixture description as date for now
        class: position,
        minutes: this.parseNumber(minutes),
        // Add all the statistical properties
        goals: this.parseNumber(goals),
        assists: this.parseNumber(assists),
        manOfMatch: this.parseNumber(manOfMatch),
        yellowCards: this.parseNumber(yellowCards),
        redCards: this.parseNumber(redCards),
        saves: this.parseNumber(saves),
        ownGoals: this.parseNumber(ownGoals),
        penaltiesScored: this.parseNumber(penaltiesScored),
        penaltiesMissed: this.parseNumber(penaltiesMissed),
        penaltiesConceded: this.parseNumber(penaltiesConceded),
        penaltiesSaved: this.parseNumber(penaltiesSaved),
        // Clean sheets will be calculated during relationship creation based on fixture CONCEDED value
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    if (sourceName.includes('WeeklyTOTW')) {
      // Use actual column names from CSV
      const seasonWeekNumRef = String(this.findColumnValue(row, ['SEASONWEEKNUMREF']) || `unknown-ref-${rowIndex}`)
      const totwScore = this.findColumnValue(row, ['TOTW SCORE'])
      const playerCount = this.findColumnValue(row, ['PLAYER COUNT']) || null
      const starMan = String(this.findColumnValue(row, ['STAR MAN']) || '')
      const starManScore = this.findColumnValue(row, ['STAR MAN SCORE']) || null
      
      // Skip rows where TOTW SCORE is blank
      if (!totwScore || String(totwScore).trim() === '') {
        console.log(`ℹ️ Skipping WeeklyTOTW row ${rowIndex}: TOTW SCORE is blank`)
        return null
      }
      
      // Extract season and week from SEASONWEEKNUMREF (e.g., "2016/17-37")
      let season = ''
      let week = ''
      
      if (seasonWeekNumRef && seasonWeekNumRef.includes('-')) {
        const [seasonPart, weekPart] = seasonWeekNumRef.split('-')
        season = seasonPart || ''
        week = weekPart || ''
      }
      
      // Validate that we have both season and week
      if (!season || !week) {
        console.warn(`⚠️ Skipping WeeklyTOTW row ${rowIndex}: Invalid SEASONWEEKNUMREF format: "${seasonWeekNumRef}"`)
        return null
      }
      
      return {
        id: `totw-weekly-${season}-${week}`,
        season: season,
        week: parseInt(week) || 0,
        seasonWeekNumRef: seasonWeekNumRef,
        totwScore: this.parseNumber(totwScore),
        playerCount: this.parseNumber(playerCount),
        starMan: starMan,
        starManScore: this.parseNumber(starManScore),
        // Player position fields
        gk1: String(this.findColumnValue(row, ['GK1']) || ''),
        def1: String(this.findColumnValue(row, ['DEF1']) || ''),
        def2: String(this.findColumnValue(row, ['DEF2']) || ''),
        def3: String(this.findColumnValue(row, ['DEF3']) || ''),
        def4: String(this.findColumnValue(row, ['DEF4']) || ''),
        def5: String(this.findColumnValue(row, ['DEF5']) || ''),
        mid1: String(this.findColumnValue(row, ['MID1']) || ''),
        mid2: String(this.findColumnValue(row, ['MID2']) || ''),
        mid3: String(this.findColumnValue(row, ['MID3']) || ''),
        mid4: String(this.findColumnValue(row, ['MID4']) || ''),
        mid5: String(this.findColumnValue(row, ['MID5']) || ''),
        fwd1: String(this.findColumnValue(row, ['FWD1']) || ''),
        fwd2: String(this.findColumnValue(row, ['FWD2']) || ''),
        fwd3: String(this.findColumnValue(row, ['FWD3']) || ''),
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    if (sourceName.includes('SeasonTOTW')) {
      // Use actual column names from CSV
      const dateLookup = String(this.findColumnValue(row, ['DATE LOOKUP']) || `unknown-date-${rowIndex}`)
      const totwScore = this.findColumnValue(row, ['TOTW SCORE'])
      const starMan = String(this.findColumnValue(row, ['STAR MAN']) || '')
      const starManScore = this.findColumnValue(row, ['STAR MAN SCORE']) || null
      
      // Skip rows where TOTW SCORE is blank
      if (!totwScore || String(totwScore).trim() === '') {
        console.log(`ℹ️ Skipping SeasonTOTW row ${rowIndex}: TOTW SCORE is blank`)
        return null
      }
      
      // Extract season from DATE LOOKUP (e.g., "2016/17 Season" -> "2016/17")
      let season = ''
      if (dateLookup && dateLookup.includes('Season')) {
        season = dateLookup.replace(' Season', '').trim()
      } else if (dateLookup && dateLookup.includes('All Time')) {
        season = 'All Time'
      } else {
        season = dateLookup || `unknown-season-${rowIndex}`
      }
      
      // Validate that we have a valid season
      if (!season || season.trim() === '' || season.includes('unknown')) {
        console.warn(`⚠️ Skipping SeasonTOTW row ${rowIndex}: Invalid season extracted from DATE LOOKUP: "${dateLookup}"`)
        return null
      }
      
      return {
        id: `totw-season-${season}`,
        season: season,
        dateLookup: dateLookup,
        totwScore: this.parseNumber(totwScore),
        starMan: starMan,
        starManScore: this.parseNumber(starManScore),
        // Player position fields
        gk1: String(this.findColumnValue(row, ['GK1']) || ''),
        def1: String(this.findColumnValue(row, ['DEF1']) || ''),
        def2: String(this.findColumnValue(row, ['DEF2']) || ''),
        def3: String(this.findColumnValue(row, ['DEF3']) || ''),
        def4: String(this.findColumnValue(row, ['DEF4']) || ''),
        def5: String(this.findColumnValue(row, ['DEF5']) || ''),
        mid1: String(this.findColumnValue(row, ['MID1']) || ''),
        mid2: String(this.findColumnValue(row, ['MID2']) || ''),
        mid3: String(this.findColumnValue(row, ['MID3']) || ''),
        mid4: String(this.findColumnValue(row, ['MID4']) || ''),
        mid5: String(this.findColumnValue(row, ['MID5']) || ''),
        fwd1: String(this.findColumnValue(row, ['FWD1']) || ''),
        fwd2: String(this.findColumnValue(row, ['FWD2']) || ''),
        fwd3: String(this.findColumnValue(row, ['FWD3']) || ''),
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    if (sourceName.includes('PlayersOfTheMonth')) {
      // Use actual column names from CSV
      const seasonMonthRef = String(this.findColumnValue(row, ['SEASONMONTHREF']) || `unknown-ref-${rowIndex}`)
      const player1Name = String(this.findColumnValue(row, ['#1 Name']) || '')
      const player1Points = this.findColumnValue(row, ['#1 Points']) || null
      
      // Skip rows where #1 Name is blank
      if (!player1Name || player1Name.trim() === '') {
        console.log(`ℹ️ Skipping PlayersOfTheMonth row ${rowIndex}: #1 Name is blank`)
        return null
      }
      
      // Extract season and month from SEASONMONTHREF (e.g., "2016/17-09" -> season="2016/17", month="09")
      let season = ''
      let month = ''
      
      if (seasonMonthRef && seasonMonthRef.includes('-')) {
        const [seasonPart, monthPart] = seasonMonthRef.split('-')
        season = seasonPart || ''
        month = monthPart || ''
      }
      
      // Validate that we have both season and month
      if (!season || !month) {
        console.warn(`⚠️ Skipping PlayersOfTheMonth row ${rowIndex}: Invalid SEASONMONTHREF format: "${seasonMonthRef}"`)
        return null
      }
      
      return {
        id: `pom-${season}-${month}`,
        season: season,
        month: month,
        seasonMonthRef: seasonMonthRef,
        // Player rankings and points
        player1Name: player1Name,
        player1Points: this.parseNumber(player1Points),
        player2Name: String(this.findColumnValue(row, ['#2 Name']) || ''),
        player2Points: this.parseNumber(this.findColumnValue(row, ['#2 Points'])),
        player3Name: String(this.findColumnValue(row, ['#3 Name']) || ''),
        player3Points: this.parseNumber(this.findColumnValue(row, ['#3 Points'])),
        player4Name: String(this.findColumnValue(row, ['#4 Name']) || ''),
        player4Points: this.parseNumber(this.findColumnValue(row, ['#4 Points'])),
        player5Name: String(this.findColumnValue(row, ['#5 Name']) || ''),
        player5Points: this.parseNumber(this.findColumnValue(row, ['#5 Points'])),
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    // StatDetails is handled as table data, not graph nodes
    
    if (sourceName.includes('OppositionDetails')) {
      // Use positional column mapping based on actual CSV structure
      // Columns: [0]=Name, [1]=League, [2]=Division
      const name = String(row[0] || `unknown-opposition-${rowIndex}`)
      
      // Skip rows with empty names to prevent constraint violations
      if (!name || name.trim() === '' || name === 'unknown-opposition-' + rowIndex) {
        console.log(`ℹ️ Skipping OppositionDetail row ${rowIndex}: Empty or invalid name`)
        return null
      }
      
      return {
        id: `opposition-${name}`,
        oppositionName: String(row[0] || ''),
        league: String(row[1] || ''),
        division: String(row[2] || ''),
        graphLabel: 'dorkiniansWebsite',
        createdAt: new Date().toISOString()
      }
    }
    
    // Default mapping for unknown types
    return {
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

  private findColumnValue(row: CSVRow, possibleNames: string[]): any {
    for (const name of possibleNames) {
      if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
        return row[name]
      }
    }
    return null
  }

  private debugRowKeys(row: CSVRow, rowIndex: number): void {
    console.log(`🚨 DEBUG METHOD CALLED for row ${rowIndex}`)
    if (rowIndex < 3) {
      console.log(`🔍 DEBUG Row ${rowIndex} - All keys:`, Object.keys(row))
      console.log(`🔍 DEBUG Row ${rowIndex} - Sample values:`, Object.entries(row).slice(0, 5))
    }
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

  private async createPlayerRelationships(playerData: CSVRow, playerNodeId: string): Promise<number> {
    console.log(`🔗 Creating Player relationships for: ${playerData.name}`)
    let relationshipsCreated = 0
    
    try {
      // Create Player-Team relationship based on mostPlayedForTeam
      if (playerData.mostPlayedForTeam && String(playerData.mostPlayedForTeam).trim() !== '') {
        const teamId = `team-${String(playerData.mostPlayedForTeam).toLowerCase().replace(/\s+/g, '-')}`
        
        // Create team node if it doesn't exist
        await neo4jService.createNodeIfNotExists('Team', {
          id: teamId,
          name: playerData.mostPlayedForTeam,
          season: 'current', // Default season since we don't have specific season data
          league: 'unknown'
        })
        
        // Create PLAYS_FOR relationship
        const playsForRel = await neo4jService.createRelationship(
          'Player',
          { id: playerNodeId, graphLabel: 'dorkiniansWebsite' } as any,
          'PLAYS_FOR',
          'Team',
          { id: teamId, graphLabel: 'dorkiniansWebsite' } as any,
          { 
            season: 'current',
            startDate: playerData.createdAt || new Date().toISOString(),
            graphLabel: 'dorkiniansWebsite'
          }
        )
        
        if (playsForRel) {
          relationshipsCreated++
          console.log(`  ✅ Created PLAYS_FOR relationship: ${playerData.name} → ${playerData.mostPlayedForTeam}`)
        } else {
          this.logError(`Failed to create PLAYS_FOR relationship for ${playerData.name}`, { teamId, playerData })
        }
      }
      
      // Note: Position is stored as a string property on Player nodes, no separate Position nodes needed
      
    } catch (error) {
      console.warn(`⚠️ Failed to create player relationships for ${playerData.name}: ${error instanceof Error ? error.message : String(error)}`)
      this.logError(`Failed to create player relationships for ${playerData.name}`, { playerData, error: error instanceof Error ? error.message : String(error) })
    }
    
    return relationshipsCreated
  }

  private async createFixtureRelationships(fixtureData: CSVRow, fixtureNodeId: string): Promise<number> {
    console.log(`🔗 Creating Fixture relationships for: ${fixtureData.id}`)
    let relationshipsCreated = 0
    
    try {
      // Create Fixture-Season relationship
      if (fixtureData.season) {
        const seasonId = `season-${String(fixtureData.season).toLowerCase().replace(/\s+/g, '-')}`
        
        // Create season node if it doesn't exist - use season string as unique identifier
        await neo4jService.createNodeIfNotExists('Season', {
          id: seasonId,
          name: fixtureData.season,
                     startYear: this.extractYear(String(fixtureData.season)),
           endYear: this.extractYear(String(fixtureData.season)) + 1,
          isActive: false
        })
        
        // Create BELONGS_TO relationship
        const belongsToRel = await neo4jService.createRelationship(
          'Fixture',
          { id: fixtureNodeId, graphLabel: 'dorkiniansWebsite' } as any,
          'BELONGS_TO',
          'Season',
          { id: seasonId, graphLabel: 'dorkiniansWebsite' } as any,
          { graphLabel: 'dorkiniansWebsite' }
        )
        
        if (belongsToRel) {
          relationshipsCreated++
          console.log(`  ✅ Created BELONGS_TO relationship: ${fixtureData.id} → ${fixtureData.season}`)
        } else {
          this.logError(`Failed to create BELONGS_TO relationship for ${fixtureData.id}`, { seasonId, fixtureData })
        }
      }
      
      // Create Fixture-Competition relationship
      if (fixtureData.competition && fixtureData.competition !== '-') {
        try {
          const competitionId = `competition-${String(fixtureData.competition).toLowerCase().replace(/\s+/g, '-')}`
          
          await neo4jService.createNodeIfNotExists('Competition', {
            id: competitionId,
            name: fixtureData.competition
          })
        
          const competitionRel = await neo4jService.createRelationship(
            'Fixture',
            { id: fixtureNodeId, graphLabel: 'dorkiniansWebsite' } as any,
            'IN_COMPETITION',
            'Competition',
            { id: competitionId, graphLabel: 'dorkiniansWebsite' } as any,
            { graphLabel: 'dorkiniansWebsite' }
          )
          
          if (competitionRel) {
            relationshipsCreated++
            console.log(`  ✅ Created IN_COMPETITION relationship: ${fixtureData.id} → ${fixtureData.competition}`)
          } else {
            this.logError(`Failed to create IN_COMPETITION relationship for ${fixtureData.id}`, { competitionId, fixtureData })
          }
        } catch (error) {
          const errorMsg = `Failed to create competition relationship for fixture ${fixtureData.id}: ${error instanceof Error ? error.message : String(error)}`
          console.warn(`⚠️ ${errorMsg}`)
          this.logError(errorMsg, { fixtureId: fixtureData.id, competition: fixtureData.competition, error: error instanceof Error ? error.message : String(error) })
        }
      }
      
      // Create Team-Season relationships for both home and away teams
      if (fixtureData.team) {
        const teamId = `team-${String(fixtureData.team).toLowerCase().replace(/\s+/g, '-')}`
        
        // Create team node if it doesn't exist
        await neo4jService.createNodeIfNotExists('Team', {
          id: teamId,
          name: fixtureData.team,
          season: fixtureData.season || 'unknown',
          league: 'unknown'
        })
        
        // Create PARTICIPATES_IN relationship
        if (fixtureData.season) {
          const seasonId = `season-${String(fixtureData.season).toLowerCase().replace(/\s+/g, '-')}`
          const teamSeasonRel = await neo4jService.createRelationship(
            'Team',
            { id: teamId, graphLabel: 'dorkiniansWebsite' } as any,
            'PARTICIPATES_IN',
            'Season',
            { id: seasonId, graphLabel: 'dorkiniansWebsite' } as any,
            { graphLabel: 'dorkiniansWebsite' }
          )
          
          if (teamSeasonRel) {
            relationshipsCreated++
            console.log(`  ✅ Created Team PARTICIPATES_IN relationship: ${fixtureData.team} → ${fixtureData.season}`)
          } else {
            this.logError(`Failed to create Team PARTICIPATES_IN relationship for ${fixtureData.id}`, { teamId, seasonId, fixtureData })
          }
        }
        
        // Create AGAINST relationship if opposition exists
        if (fixtureData.opposition && fixtureData.opposition !== '-') {
          const oppositionId = `opposition-${String(fixtureData.opposition).toLowerCase().replace(/\s+/g, '-')}`
          
          // Create opposition node if it doesn't exist
          await neo4jService.createNodeIfNotExists('OppositionDetail', {
            id: oppositionId,
            oppositionName: fixtureData.opposition,
            league: 'unknown',
            division: 'unknown'
          })
          
          const againstRel = await neo4jService.createRelationship(
            'Fixture',
            { id: fixtureNodeId, graphLabel: 'dorkiniansWebsite' } as any,
            'AGAINST',
            'OppositionDetail',
            { id: oppositionId, graphLabel: 'dorkiniansWebsite' } as any,
            { graphLabel: 'dorkiniansWebsite' }
          )
          
          if (againstRel) {
            relationshipsCreated++
            console.log(`  ✅ Created AGAINST relationship: ${fixtureData.id} → ${fixtureData.opposition}`)
          } else {
            this.logError(`Failed to create AGAINST relationship for ${fixtureData.id}`, { oppositionId, fixtureData })
          }
        }
      }
      
    } catch (error) {
      const errorMsg = `Failed to create fixture relationships for ${fixtureData.id}: ${error instanceof Error ? error.message : String(error)}`
      console.warn(`⚠️ ${errorMsg}`)
      this.logError(errorMsg, { fixtureData, error: error instanceof Error ? error.message : String(error) })
    }
    
    return relationshipsCreated
  }

  private async createMatchDetailRelationships(matchDetailData: CSVRow, matchDetailNodeId: string): Promise<number> {
    console.log(`🔗 Creating MatchDetail relationships for: ${matchDetailData.id}`)
    let relationshipsCreated = 0
    
    try {
      // Create MatchDetail-Fixture relationship
      if (matchDetailData.fixtureId) {
        const fixtureId = `fixture-${matchDetailData.season || 'unknown'}-${matchDetailData.fixtureId}`
        
        // Create GENERATED_FROM relationship
        const generatedFromRel = await neo4jService.createRelationship(
          'MatchDetail',
          { id: matchDetailNodeId, graphLabel: 'dorkiniansWebsite' } as any,
          'GENERATED_FROM',
          'Fixture',
          { id: fixtureId, graphLabel: 'dorkiniansWebsite' } as any,
          { graphLabel: 'dorkiniansWebsite' }
        )
        
        if (generatedFromRel) {
          relationshipsCreated++
          console.log(`  ✅ Created GENERATED_FROM relationship: ${matchDetailData.id} → ${fixtureId}`)
        } else {
          this.logError(`Failed to create GENERATED_FROM relationship for ${matchDetailData.id}`, { fixtureId, matchDetailData })
        }
      }
      
      // Create MatchDetail-Player relationship
      if (matchDetailData.playerName) {
        const playerId = `player-${String(matchDetailData.playerName).toLowerCase().replace(/\s+/g, '-')}`
        
        // Calculate clean sheet based on fixture CONCEDED value
        let cleanSheet = 0
        if (matchDetailData.fixtureId) {
          try {
            // Find the fixture to get the CONCEDED value
            const fixtureQuery = `
              MATCH (f:Fixture {id: $fixtureId, graphLabel: 'dorkiniansWebsite'})
              RETURN f.conceded as conceded
            `
            const fixtureResult = await neo4jService.runQuery(fixtureQuery, { fixtureId: `fixture-${matchDetailData.season || 'unknown'}-${matchDetailData.fixtureId}` })
            if (fixtureResult.records.length > 0) {
              const conceded = fixtureResult.records[0].get('conceded')
              // Clean sheet = 1 if conceded = 0, otherwise 0
              cleanSheet = conceded === 0 ? 1 : 0
            }
          } catch (error) {
            console.warn(`⚠️ Could not calculate clean sheet for ${matchDetailData.id}: ${error instanceof Error ? error.message : String(error)}`)
            this.logError(`Clean sheet calculation failed for ${matchDetailData.id}`, { error: error instanceof Error ? error.message : String(error) })
          }
        }
        
        // Create PERFORMED_IN relationship with all statistical properties
        const performedInRel = await neo4jService.createRelationship(
          'Player',
          { id: playerId, graphLabel: 'dorkiniansWebsite' } as any,
          'PERFORMED_IN',
          'MatchDetail',
          { id: matchDetailNodeId, graphLabel: 'dorkiniansWebsite' } as any,
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
            graphLabel: 'dorkiniansWebsite'
          }
        )
        
        if (performedInRel) {
          relationshipsCreated++
          console.log(`  ✅ Created PERFORMED_IN relationship: ${matchDetailData.playerName} → ${matchDetailData.id}`)
        } else {
          this.logError(`Failed to create PERFORMED_IN relationship for ${matchDetailData.id}`, { playerId, matchDetailData })
        }
        
        // Create Player-Team relationship based on match data
        if (matchDetailData.team) {
          const teamId = `team-${String(matchDetailData.team).toLowerCase().replace(/\s+/g, '-')}`
          
          // Create team node if it doesn't exist
          await neo4jService.createNodeIfNotExists('Team', {
            id: teamId,
            name: matchDetailData.team,
            season: matchDetailData.season || 'unknown',
            league: 'unknown'
          })
          
          // Check if PLAYS_FOR relationship already exists to prevent duplicates
          const existingPlaysForQuery = `
            MATCH (p:Player {id: $playerId, graphLabel: 'dorkiniansWebsite'})-[r:PLAYS_FOR]->(t:Team {id: $teamId, graphLabel: 'dorkiniansWebsite'})
            WHERE r.season = $season
            RETURN r LIMIT 1
          `
          const existingPlaysFor = await neo4jService.runQuery(existingPlaysForQuery, { 
            playerId, 
            teamId, 
            season: matchDetailData.season || 'unknown' 
          })
          
          if (existingPlaysFor.records.length === 0) {
            // Create PLAYS_FOR relationship only if it doesn't exist
            const playsForRel = await neo4jService.createRelationship(
              'Player',
              { id: playerId, graphLabel: 'dorkiniansWebsite' } as any,
              'PLAYS_FOR',
              'Team',
              { id: teamId, graphLabel: 'dorkiniansWebsite' } as any,
              { 
                season: matchDetailData.season || 'unknown',
                startDate: matchDetailData.date || new Date().toISOString(),
                graphLabel: 'dorkiniansWebsite'
              }
            )
            
            if (playsForRel) {
              relationshipsCreated++
              console.log(`  ✅ Created PLAYS_FOR relationship: ${matchDetailData.playerName} → ${matchDetailData.team}`)
            } else {
              this.logError(`Failed to create PLAYS_FOR relationship for ${matchDetailData.id}`, { playerId, teamId, matchDetailData })
            }
          } else {
            console.log(`  ℹ️ PLAYS_FOR relationship already exists: ${matchDetailData.playerName} → ${matchDetailData.team} (${matchDetailData.season})`)
          }
        }
        
        // Create Player-Season relationship based on match data
        if (matchDetailData.season) {
          const seasonId = `season-${String(matchDetailData.season).toLowerCase().replace(/\s+/g, '-')}`
          
          // Create season node if it doesn't exist
          await neo4jService.createNodeIfNotExists('Season', {
            id: seasonId,
            name: matchDetailData.season,
                         startYear: this.extractYear(String(matchDetailData.season)),
             endYear: this.extractYear(String(matchDetailData.season)) + 1,
            isActive: false
          })
          
          // Check if PARTICIPATES_IN relationship already exists to prevent duplicates
          const existingParticipatesQuery = `
            MATCH (p:Player {id: $playerId, graphLabel: 'dorkiniansWebsite'})-[r:PARTICIPATES_IN]->(s:Season {id: $seasonId, graphLabel: 'dorkiniansWebsite'})
            RETURN r LIMIT 1
          `
          const existingParticipates = await neo4jService.runQuery(existingParticipatesQuery, { playerId, seasonId })
          
          if (existingParticipates.records.length === 0) {
            // Create PARTICIPATES_IN relationship only if it doesn't exist
            const participatesRel = await neo4jService.createRelationship(
              'Player',
              { id: playerId, graphLabel: 'dorkiniansWebsite' } as any,
              'PARTICIPATES_IN',
              'Season',
              { id: seasonId, graphLabel: 'dorkiniansWebsite' } as any,
              { graphLabel: 'dorkiniansWebsite' }
            )
            
            if (participatesRel) {
              relationshipsCreated++
              console.log(`  ✅ Created PARTICIPATES_IN relationship: ${matchDetailData.playerName} → ${matchDetailData.season}`)
            } else {
              this.logError(`Failed to create PARTICIPATES_IN relationship for ${matchDetailData.id}`, { playerId, seasonId, matchDetailData })
            }
          } else {
            console.log(`  ℹ️ PARTICIPATES_IN relationship already exists: ${matchDetailData.playerName} → ${matchDetailData.season}`)
          }
        }
      }
      
      // Create MatchDetail-Team relationship
      if (matchDetailData.team) {
        const teamId = `team-${String(matchDetailData.team).toLowerCase().replace(/\s+/g, '-')}`
        
        // Create PLAYED_FOR relationship
        const playedForRel = await neo4jService.createRelationship(
          'MatchDetail',
          { id: matchDetailNodeId, graphLabel: 'dorkiniansWebsite' } as any,
          'PLAYED_FOR',
          'Team',
          { id: teamId, graphLabel: 'dorkiniansWebsite' } as any,
          { graphLabel: 'dorkiniansWebsite' }
        )
        
        if (playedForRel) {
          relationshipsCreated++
          console.log(`  ✅ Created PLAYED_FOR relationship: ${matchDetailData.id} → ${matchDetailData.team}`)
        } else {
          this.logError(`Failed to create PLAYED_FOR relationship for ${matchDetailData.id}`, { teamId, matchDetailData })
        }
      }
      
    } catch (error) {
      const errorMsg = `Failed to create match detail relationships for ${matchDetailData.id}: ${error instanceof Error ? error.message : String(error)}`
      console.warn(`⚠️ ${errorMsg}`)
      this.logError(errorMsg, { matchDetailData, error: error instanceof Error ? error.message : String(error) })
    }
    
    return relationshipsCreated
  }

  private async createTOTWRelationships(totwData: CSVRow, totwNodeId: string): Promise<number> {
    console.log(`🔗 Creating TOTW relationships for: ${totwData.id}`)
    let relationshipsCreated = 0
    
    try {
      // Create TOTW-Season relationship
      if (totwData.season) {
        const seasonId = `season-${String(totwData.season).toLowerCase().replace(/\s+/g, '-')}`
        
        // Create season node if it doesn't exist
        await neo4jService.createNodeIfNotExists('Season', {
          id: seasonId,
          name: totwData.season,
                     startYear: this.extractYear(String(totwData.season)),
           endYear: this.extractYear(String(totwData.season)) + 1,
          isActive: false
        })
        
        // Create HAS_TOTW relationship
        const hasTotwRel = await neo4jService.createRelationship(
          'Season',
          { id: seasonId, graphLabel: 'dorkiniansWebsite' } as any,
          'HAS_TOTW',
          'TOTW',
          { id: totwNodeId, graphLabel: 'dorkiniansWebsite' } as any,
          { graphLabel: 'dorkiniansWebsite' }
        )
        
        if (hasTotwRel) {
          relationshipsCreated++
          console.log(`  ✅ Created HAS_TOTW relationship: ${totwData.season} → ${totwData.id}`)
        }
      }
      
             // Create TOTW-Player relationships for star man
       if (totwData.starMan) {
         const playerId = `player-${String(totwData.starMan).toLowerCase().replace(/\s+/g, '-')}`
         
         // Create SELECTED_IN relationship
         const selectedInRel = await neo4jService.createRelationship(
           'Player',
           { id: playerId, graphLabel: 'dorkiniansWebsite' } as any,
           'SELECTED_IN',
           'TOTW',
           { id: totwNodeId, graphLabel: 'dorkiniansWebsite' } as any,
           { 
             position: 'star_man',
             score: totwData.starManScore || 0,
             graphLabel: 'dorkiniansWebsite'
           }
         )
         
         if (selectedInRel) {
           relationshipsCreated++
           console.log(`  ✅ Created SELECTED_IN relationship: ${totwData.starMan} → ${totwData.id}`)
         }
       }
       
       // Create TOTW-Player relationships for all selected players
       const playerPositions = ['gk1', 'def1', 'def2', 'def3', 'def4', 'def5', 'mid1', 'mid2', 'mid3', 'mid4', 'mid5', 'fwd1', 'fwd2', 'fwd3']
       
       for (const position of playerPositions) {
         const playerName = String(totwData[position] || '')
         if (playerName && playerName.trim() !== '') {
           const playerId = `player-${String(playerName).toLowerCase().replace(/\s+/g, '-')}`
           
           // Create SELECTED_IN relationship for each selected player
           const selectedInRel = await neo4jService.createRelationship(
             'Player',
             { id: playerId, graphLabel: 'dorkiniansWebsite' } as any,
             'SELECTED_IN',
             'TOTW',
             { id: totwNodeId, graphLabel: 'dorkiniansWebsite' } as any,
             { 
               position: position,
               score: 0, // Default score for non-star man players
               graphLabel: 'dorkiniansWebsite'
             }
           )
           
           if (selectedInRel) {
             relationshipsCreated++
             console.log(`  ✅ Created SELECTED_IN relationship: ${playerName} → ${totwData.id} (${position})`)
           }
         }
       }
      
    } catch (error) {
      console.warn(`⚠️ Failed to create TOTW relationships for ${totwData.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
    
    return relationshipsCreated
  }

  private async createPlayerOfMonthRelationships(pomData: CSVRow, pomNodeId: string): Promise<number> {
    console.log(`🔗 Creating PlayerOfMonth relationships for: ${pomData.id}`)
    let relationshipsCreated = 0
    
    try {
      // Create PlayerOfMonth-Season relationship
      if (pomData.season) {
        const seasonId = `season-${String(pomData.season).toLowerCase().replace(/\s+/g, '-')}`
        
        // Create season node if it doesn't exist
        await neo4jService.createNodeIfNotExists('Season', {
          id: seasonId,
          name: pomData.season,
                     startYear: this.extractYear(String(pomData.season)),
           endYear: this.extractYear(String(pomData.season)) + 1,
          isActive: false
        })
        
        // Create HAS_MONTHLY_AWARDS relationship
        const hasMonthlyRel = await neo4jService.createRelationship(
          'Season',
          { id: seasonId, graphLabel: 'dorkiniansWebsite' } as any,
          'HAS_MONTHLY_AWARDS',
          'PlayerOfTheMonth',
          { id: pomNodeId, graphLabel: 'dorkiniansWebsite' } as any,
          { graphLabel: 'dorkiniansWebsite' }
        )
        
        if (hasMonthlyRel) {
          relationshipsCreated++
          console.log(`  ✅ Created HAS_MONTHLY_AWARDS relationship: ${pomData.season} → ${pomData.id}`)
        }
      }
      
      // Create PlayerOfMonth-Player relationships for all ranked players
      const playerRankings = [
        { name: pomData.player1Name, points: pomData.player1Points, rank: 1 },
        { name: pomData.player2Name, points: pomData.player2Points, rank: 2 },
        { name: pomData.player3Name, points: pomData.player3Points, rank: 3 },
        { name: pomData.player4Name, points: pomData.player4Points, rank: 4 },
        { name: pomData.player5Name, points: pomData.player5Points, rank: 5 }
      ]
      
      for (const playerRank of playerRankings) {
        if (playerRank.name && String(playerRank.name).trim() !== '') {
          const playerId = `player-${String(playerRank.name).toLowerCase().replace(/\s+/g, '-')}`
          
          // Create AWARDED_MONTHLY relationship
          const awardedMonthlyRel = await neo4jService.createRelationship(
            'Player',
            { id: playerId, graphLabel: 'dorkiniansWebsite' } as any,
            'AWARDED_MONTHLY',
            'PlayerOfTheMonth',
            { id: pomNodeId, graphLabel: 'dorkiniansWebsite' } as any,
            { 
              month: pomData.month,
              season: pomData.season,
              rank: playerRank.rank,
              points: playerRank.points || 0,
              graphLabel: 'dorkiniansWebsite'
            }
          )
          
          if (awardedMonthlyRel) {
            relationshipsCreated++
            console.log(`  ✅ Created AWARDED_MONTHLY relationship: ${playerRank.name} → ${pomData.id} (Rank ${playerRank.rank})`)
          } else {
            this.logError(`Failed to create AWARDED_MONTHLY relationship for ${playerRank.name}`, { playerId, pomData, playerRank })
          }
        }
      }
      
    } catch (error) {
      console.warn(`⚠️ Failed to create PlayerOfMonth relationships for ${pomData.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
    
    return relationshipsCreated
  }

  private extractYear(seasonString: string): number {
    if (!seasonString) return new Date().getFullYear()
    
    // Handle formats like "2016-17", "2016/17", "2016"
    const yearMatch = seasonString.match(/(\d{4})/)
    if (yearMatch) {
      return parseInt(yearMatch[1])
    }
    
    return new Date().getFullYear()
  }



  async getDatabaseStats(): Promise<any> {
    return await neo4jService.getDatabaseStats()
  }
}

export const dataSeederService = DataSeederService.getInstance()
