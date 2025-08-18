const neo4j = require('neo4j-driver')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function testStepByStep() {
  console.log('🧪 Testing Relationship Creation Step by Step...')
  
  const uri = process.env.DEV_NEO4J_URI
  const username = process.env.DEV_NEO4J_USER
  const password = process.env.DEV_NEO4J_PASSWORD

  if (!uri || !username || !password) {
    console.error('❌ Missing Neo4j environment variables')
    return
  }

  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password))
  const session = driver.session()

  try {
    console.log('🔗 Connected to Neo4j database')
    
    // Test 1: Check what nodes we actually have
    console.log('\n📊 Test 1: Available Node Types')
    const nodeTypesQuery = `
      MATCH (n)
      RETURN labels(n) as nodeLabels, count(n) as count
      ORDER BY count DESC
      LIMIT 10
    `
    
    const nodeTypesResult = await session.run(nodeTypesQuery)
    console.log('  Node types and counts:')
    nodeTypesResult.records.forEach(record => {
      const labels = record.get('nodeLabels')
      const count = record.get('count')
      console.log(`    ${labels}: ${count}`)
    })
    
    // Test 2: Check if we have the right data for relationships
    console.log('\n🔍 Test 2: Sample Player Data')
    const playerQuery = `
      MATCH (p:Player)
      RETURN p.id as id, p.name as name, p.team as team, p.season as season
      LIMIT 5
    `
    
    const playerResult = await session.run(playerQuery)
    console.log('  Sample players:')
    playerResult.records.forEach((record, index) => {
      const id = record.get('id')
      const name = record.get('name')
      const team = record.get('team')
      const season = record.get('season')
      console.log(`    ${index + 1}. ID: ${id}, Name: ${name}, Team: ${team}, Season: ${season}`)
    })
    
    // Test 3: Check if we have the right data for Fixtures
    console.log('\n🔍 Test 3: Sample Fixture Data')
    const fixtureQuery = `
      MATCH (f:Fixture)
      RETURN f.id as id, f.season as season, f.team as team, f.competition as competition
      LIMIT 5
    `
    
    const fixtureResult = await session.run(fixtureQuery)
    console.log('  Sample fixtures:')
    fixtureResult.records.forEach((record, index) => {
      const id = record.get('id')
      const season = record.get('season')
      const team = record.get('team')
      const competition = record.get('competition')
      console.log(`    ${index + 1}. ID: ${id}, Season: ${season}, Team: ${team}, Competition: ${competition}`)
    })
    
    // Test 4: Check if we have the right data for MatchDetails
    console.log('\n🔍 Test 4: Sample MatchDetail Data')
    const matchDetailQuery = `
      MATCH (md:MatchDetail)
      RETURN md.id as id, md.playerName as playerName, md.team as team, md.season as season, md.fixtureId as fixtureId
      LIMIT 5
    `
    
    const matchDetailResult = await session.run(matchDetailQuery)
    console.log('  Sample match details:')
    matchDetailResult.records.forEach((record, index) => {
      const id = record.get('id')
      const playerName = record.get('playerName')
      const team = record.get('team')
      const season = record.get('season')
      const fixtureId = record.get('fixtureId')
      console.log(`    ${index + 1}. ID: ${id}, Player: ${playerName}, Team: ${team}, Season: ${season}, Fixture: ${fixtureId}`)
    })
    
    // Test 5: Try to create a simple relationship manually
    console.log('\n🔗 Test 5: Manual Relationship Creation')
    
    // First, find a player and team that should be related
    const findPlayerTeamQuery = `
      MATCH (p:Player)
      MATCH (t:Team)
      WHERE p.team = t.name OR p.team IS NOT NULL
      RETURN p.id as playerId, p.name as playerName, t.id as teamId, t.name as teamName
      LIMIT 1
    `
    
    try {
      const findResult = await session.run(findPlayerTeamQuery)
      if (findResult.records.length > 0) {
        const record = findResult.records[0]
        const playerId = record.get('playerId')
        const playerName = record.get('playerName')
        const teamId = record.get('teamId')
        const teamName = record.get('teamName')
        
        console.log(`  Found potential relationship: ${playerName} (${playerId}) -> ${teamName} (${teamId})`)
        
        // Try to create the relationship
        const createRelQuery = `
          MATCH (p:Player {id: $playerId})
          MATCH (t:Team {id: $teamId})
          CREATE (p)-[r:PLAYS_FOR {graphLabel: 'dorkiniansWebsite', test: true}]->(t)
          RETURN r
        `
        
        const createResult = await session.run(createRelQuery, { playerId, teamId })
        if (createResult.records.length > 0) {
          console.log('  ✅ Successfully created PLAYS_FOR relationship manually')
        } else {
          console.log('  ❌ Failed to create relationship manually')
        }
      } else {
        console.log('  ❌ No matching player-team pairs found for relationship creation')
      }
    } catch (error) {
      console.log(`  ❌ Error creating relationship manually: ${error.message}`)
    }
    
    console.log('\n✅ Step-by-step test completed')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  } finally {
    await session.close()
    await driver.close()
  }
}

// Run the test
testStepByStep()
  .then(() => {
    console.log('🎉 Step-by-step test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })
