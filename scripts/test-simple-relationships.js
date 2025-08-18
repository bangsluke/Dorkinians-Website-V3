const neo4j = require('neo4j-driver')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function testSimpleRelationships() {
  console.log('🧪 Testing Simple Relationship Creation...')
  
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
    
    // Test 1: Create simple test nodes and relationship
    console.log('\n📝 Test 1: Creating Simple Test Relationship')
    
    // Create test nodes
    const createNodesQuery = `
      CREATE (p:TestPlayer {id: 'test-player-1', name: 'Test Player', graphLabel: 'dorkiniansWebsite'})
      CREATE (t:TestTeam {id: 'test-team-1', name: 'Test Team', graphLabel: 'dorkiniansWebsite'})
      RETURN p, t
    `
    
    await session.run(createNodesQuery)
    console.log('✅ Created test nodes')
    
    // Create relationship
    const createRelQuery = `
      MATCH (p:TestPlayer {id: 'test-player-1'})
      MATCH (t:TestTeam {id: 'test-team-1'})
      CREATE (p)-[r:PLAYS_FOR {graphLabel: 'dorkiniansWebsite'}]->(t)
      RETURN r
    `
    
    const result = await session.run(createRelQuery)
    console.log('✅ Created test relationship')
    
    // Verify relationship exists
    const checkRelQuery = `
      MATCH ()-[r:PLAYS_FOR]->()
      RETURN count(r) as count
    `
    
    const checkResult = await session.run(checkRelQuery)
    const count = checkResult.records[0].get('count')
    console.log(`  Total PLAYS_FOR relationships: ${count}`)
    
    // Test 2: Check if we can query the relationship
    console.log('\n🔍 Test 2: Querying Test Relationship')
    const queryRelQuery = `
      MATCH (p:TestPlayer)-[r:PLAYS_FOR]->(t:TestTeam)
      RETURN p.name as playerName, t.name as teamName, type(r) as relationshipType
    `
    
    const queryResult = await session.run(queryRelQuery)
    if (queryResult.records.length > 0) {
      const record = queryResult.records[0]
      console.log(`  ✅ Found relationship: ${record.get('playerName')} -[${record.get('relationshipType')}]-> ${record.get('teamName')}`)
    } else {
      console.log('  ❌ No relationships found')
    }
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...')
    const cleanupQuery = `
      MATCH (p:TestPlayer)
      MATCH (t:TestTeam)
      MATCH ()-[r:PLAYS_FOR]->()
      DELETE r, p, t
    `
    
    await session.run(cleanupQuery)
    console.log('✅ Test data cleaned up')
    
    console.log('\n🎉 Simple relationship test completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  } finally {
    await session.close()
    await driver.close()
  }
}

// Run the test
testSimpleRelationships()
  .then(() => {
    console.log('✅ Simple relationship test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })
