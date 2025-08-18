const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function testMinimalRelationship() {
  console.log('🧪 Testing Minimal Relationship Creation...')
  
  try {
    // Test the neo4j service directly
    const { neo4jService } = require('./lib/neo4j')
    
    // Connect to database
    const connected = await neo4jService.connect()
    if (!connected) {
      throw new Error('Failed to connect to Neo4j')
    }
    
    console.log('✅ Connected to Neo4j')
    
    // Clear existing data
    await neo4jService.clearGraphData()
    console.log('✅ Cleared existing data')
    
    // Create a test fixture node
    const fixtureProps = {
      id: 'test-fixture-1',
      season: '2023/24',
      competition: 'Premier',
      graphLabel: 'dorkiniansWebsite',
      createdAt: new Date().toISOString()
    }
    
    const fixtureId = await neo4jService.createNode('Fixture', fixtureProps)
    console.log(`✅ Created test fixture: ${fixtureId}`)
    
    // Create a test competition node
    const compProps = {
      id: 'competition-premier',
      name: 'Premier',
      graphLabel: 'dorkiniansWebsite',
      createdAt: new Date().toISOString()
    }
    
    const compId = await neo4jService.createNode('Competition', compProps)
    console.log(`✅ Created test competition: ${compId}`)
    
    // Test relationship creation
    console.log('🔗 Testing relationship creation...')
    const relationship = await neo4jService.createRelationship(
      'Fixture',
      { id: fixtureId, graphLabel: 'dorkiniansWebsite' },
      'IN_COMPETITION',
      'Competition',
      { id: compId, graphLabel: 'dorkiniansWebsite' },
      { graphLabel: 'dorkiniansWebsite', createdAt: new Date().toISOString() }
    )
    
    if (relationship) {
      console.log('✅ Relationship created successfully!')
      
      // Verify it exists
      const verifyQuery = `
        MATCH (f:Fixture {id: $fixtureId})-[r:IN_COMPETITION]->(c:Competition {id: $compId})
        RETURN f.id as fixtureId, type(r) as relType, c.name as competition
      `
      const result = await neo4jService.runQuery(verifyQuery, { fixtureId, compId })
      if (result.records.length > 0) {
        console.log('✅ Relationship verified in database')
      } else {
        console.log('❌ Relationship not found in database')
      }
    } else {
      console.log('❌ Relationship creation returned null')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Error details:', error)
  }
}

testMinimalRelationship()
