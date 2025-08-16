import neo4jService from './neo4j'
import { Player, Fixture, MatchDetail, WeeklyTOTW, SeasonTOTW } from '@/types'

export class DataSeeder {
  private neo4j = neo4jService

  async seedPlayers(players: Player[]) {
    console.log(`🌱 Seeding ${players.length} players...`)
    
    for (const player of players) {
      try {
        await this.neo4j.createNode('Player', {
          name: player.name,
          allowOnSite: player.allowOnSite
        })
      } catch (error) {
        console.error(`❌ Failed to seed player ${player.name}:`, error)
      }
    }
    
    console.log(`✅ Players seeded successfully`)
  }

  async seedFixtures(fixtures: Fixture[]) {
    console.log(`🌱 Seeding ${fixtures.length} fixtures...`)
    
    for (const fixture of fixtures) {
      try {
        await this.neo4j.createNode('Fixture', {
          id: fixture.id,
          season: fixture.season,
          fixId: fixture.fixId,
          seasonFixId: fixture.seasonFixId,
          date: fixture.date,
          team: fixture.team,
          compType: fixture.compType,
          competition: fixture.competition,
          opposition: fixture.opposition,
          homeAway: fixture.homeAway,
          result: fixture.result,
          homeScore: fixture.homeScore,
          awayScore: fixture.awayScore,
          status: fixture.status,
          oppoOwnGoals: fixture.oppoOwnGoals,
          fullResult: fixture.fullResult,
          dorkiniansGoals: fixture.dorkiniansGoals,
          conceded: fixture.conceded
        })
      } catch (error) {
        console.error(`❌ Failed to seed fixture ${fixture.id}:`, error)
      }
    }
    
    console.log(`✅ Fixtures seeded successfully`)
  }

  async seedMatchDetails(matchDetails: MatchDetail[]) {
    console.log(`🌱 Seeding ${matchDetails.length} match details...`)
    
    for (const match of matchDetails) {
      try {
        await this.neo4j.createNode('MatchDetail', {
          team: match.team,
          playerName: match.playerName,
          date: match.date,
          min: match.min,
          class: match.class,
          mom: match.mom,
          goals: match.goals,
          assists: match.assists,
          yellowCards: match.yellowCards,
          redCards: match.redCards,
          saves: match.saves,
          ownGoals: match.ownGoals,
          penaltiesScored: match.penaltiesScored,
          penaltiesMissed: match.penaltiesMissed,
          penaltiesConceded: match.penaltiesConceded,
          penaltiesSaved: match.penaltiesSaved
        })
      } catch (error) {
        console.error(`❌ Failed to seed match detail for ${match.playerName}:`, error)
      }
    }
    
    console.log(`✅ Match details seeded successfully`)
  }

  async seedWeeklyTOTW(totwEntries: WeeklyTOTW[]) {
    console.log(`🌱 Seeding ${totwEntries.length} weekly TOTW entries...`)
    
    for (const totw of totwEntries) {
      try {
        await this.neo4j.createNode('WeeklyTOTW', {
          season: totw.season,
          week: totw.week,
          seasonWeekNumRef: totw.seasonWeekNumRef,
          dateLookup: totw.dateLookup,
          seasonMonthRef: totw.seasonMonthRef,
          weekAdjusted: totw.weekAdjusted,
          bestFormation: totw.bestFormation,
          totwScore: totw.totwScore,
          playerCount: totw.playerCount,
          starMan: totw.starMan,
          starManScore: totw.starManScore,
          playerLookups: totw.playerLookups,
          gk1: totw.gk1,
          def1: totw.def1,
          def2: totw.def2,
          def3: totw.def3,
          def4: totw.def4,
          def5: totw.def5,
          mid1: totw.mid1,
          mid2: totw.mid2,
          mid3: totw.mid3,
          mid4: totw.mid4,
          mid5: totw.mid5,
          fwd1: totw.fwd1,
          fwd2: totw.fwd2,
          fwd3: totw.fwd3
        })
      } catch (error) {
        console.error(`❌ Failed to seed weekly TOTW for week ${totw.week}:`, error)
      }
    }
    
    console.log(`✅ Weekly TOTW entries seeded successfully`)
  }

  async seedSeasonTOTW(totwEntries: SeasonTOTW[]) {
    console.log(`🌱 Seeding ${totwEntries.length} season TOTW entries...`)
    
    for (const totw of totwEntries) {
      try {
        await this.neo4j.createNode('SeasonTOTW', {
          season: totw.season,
          month: totw.month,
          seasonMonthRef: totw.seasonMonthRef,
          bestFormation: totw.bestFormation,
          totwScore: totw.totwScore,
          playerCount: totw.playerCount,
          starMan: totw.starMan,
          starManScore: totw.starManScore,
          playerLookups: totw.playerLookups,
          gk1: totw.gk1,
          def1: totw.def1,
          def2: totw.def2,
          def3: totw.def3,
          def4: totw.def4,
          def5: totw.def5,
          mid1: totw.mid1,
          mid2: totw.mid2,
          mid3: totw.mid3,
          mid4: totw.mid4,
          mid5: totw.mid5,
          fwd1: totw.fwd1,
          fwd2: totw.fwd2,
          fwd3: totw.fwd3
        })
      } catch (error) {
        console.error(`❌ Failed to seed season TOTW for ${totw.season} ${totw.month}:`, error)
      }
    }
    
    console.log(`✅ Season TOTW entries seeded successfully`)
  }

  async createRelationships() {
    console.log(`🔗 Creating relationships between nodes...`)
    
    try {
      // Create relationships between players and match details
      await this.neo4j.executeQuery(`
        MATCH (p:Player {graphLabel: $graphLabel})
        MATCH (m:MatchDetail {graphLabel: $graphLabel})
        WHERE p.name = m.playerName
        CREATE (p)-[:PLAYED_IN {graphLabel: $graphLabel}]->(m)
      `, { graphLabel: this.neo4j.getGraphLabel() })

      // Create relationships between fixtures and match details
      await this.neo4j.executeQuery(`
        MATCH (f:Fixture {graphLabel: $graphLabel})
        MATCH (m:MatchDetail {graphLabel: $graphLabel})
        WHERE f.date = m.date AND f.team = m.team
        CREATE (f)-[:CONTAINS {graphLabel: $graphLabel}]->(m)
      `, { graphLabel: this.neo4j.getGraphLabel() })

      console.log(`✅ Relationships created successfully`)
    } catch (error) {
      console.error(`❌ Failed to create relationships:`, error)
    }
  }

  async seedAllData(data: {
    players: Player[]
    fixtures: Fixture[]
    matchDetails: MatchDetail[]
    weeklyTOTW: WeeklyTOTW[]
    seasonTOTW: SeasonTOTW[]
  }) {
    console.log(`🚀 Starting complete data seeding process...`)
    
    try {
      // Clear existing data first
      await this.neo4j.clearGraphData()
      
      // Seed all data types
      await this.seedPlayers(data.players)
      await this.seedFixtures(data.fixtures)
      await this.seedMatchDetails(data.matchDetails)
      await this.seedWeeklyTOTW(data.weeklyTOTW)
      await this.seedSeasonTOTW(data.seasonTOTW)
      
      // Create relationships
      await this.createRelationships()
      
      console.log(`🎉 All data seeded successfully!`)
    } catch (error) {
      console.error(`❌ Data seeding failed:`, error)
      throw error
    }
  }
}

export const dataSeeder = new DataSeeder()
export default dataSeeder
