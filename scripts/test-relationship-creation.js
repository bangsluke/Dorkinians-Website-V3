const neo4j = require('neo4j-driver')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function testRelationshipCreation() {
  console.log('🧪 Testing Relationship Creation Directly...')
  
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
    
    // Test 1: Create a simple test relationship
    console.log('\n📝 Test 1: Creating Test Relationship')
    
    // First create two test nodes
    const createNodesQuery = `
      CREATE (p:TestPlayer {id: 'test-player-1', name: 'Test Player', graphLabel: 'dorkiniansWebsite'})
      CREATE (t:TestTeam {id: 'test-team-1', name: 'Test Team', graphLabel: 'dorkiniansWebsite'})
      RETURN p, t
    `
    
    await session.run(createNodesQuery)
    console.log('✅ Created test nodes')
    
    // Now create a relationship
    const createRelQuery = `
      MATCH (p:TestPlayer {id: 'test-player-1'})
      MATCH (t:TestTeam {id: 'test-team-1'})
      CREATE (p)-[r:TEST_RELATIONSHIP {graphLabel: 'dorkiniansWebsite', testProp: 'test'}]->(t)
      RETURN r
    `
    
    const result = await session.run(createRelQuery)
    console.log('✅ Created test relationship')
    
    // Check if the relationship has the graphLabel
    const checkRelQuery = `
      MATCH ()-[r:TEST_RELATIONSHIP]->()
      RETURN r.graphLabel as graphLabel, r.testProp as testProp
    `
    
    const checkResult = await session.run(checkRelQuery)
    if (checkResult.records.length > 0) {
      const record = checkResult.records[0]
      const graphLabel = record.get('graphLabel')
      const testProp = record.get('testProp')
      console.log(`  Relationship graphLabel: ${graphLabel}`)
      console.log(`  Relationship testProp: ${testProp}`)
    }
    
    // Test 2: Check all relationships with graphLabel
    console.log('\n🔍 Test 2: Checking All Relationships with graphLabel')
    const allRelsQuery = `
      MATCH ()-[r]->()
      WHERE r.graphLabel IS NOT NULL
      RETURN type(r) as relType, r.graphLabel as graphLabel, count(r) as count
      ORDER BY count DESC
    `
    
    const allRelsResult = await session.run(allRelsQuery)
    if (allRelsResult.records.length > 0) {
      console.log('  Relationships with graphLabel:')
      allRelsResult.records.forEach(record => {
        const relType = record.get('relType')
        const graphLabel = record.get('graphLabel')
        const count = record.get('count')
        console.log(`    ${relType}: ${count} (${graphLabel})`)
      })
    } else {
      console.log('  No relationships with graphLabel found')
    }
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...')
    const cleanupQuery = `
      MATCH (p:TestPlayer)
      MATCH (t:TestTeam)
      MATCH ()-[r:TEST_RELATIONSHIP]->()
      DELETE r, p, t
    `
    
    await session.run(cleanupQuery)
    console.log('✅ Test data cleaned up')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  } finally {
    await session.close()
    await driver.close()
  }
}

// Run the test
testRelationshipCreation()
  .then(() => {
    console.log('✅ Relationship creation test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Relationship creation test failed:', error)
    process.exit(1)
  })
