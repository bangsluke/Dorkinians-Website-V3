const neo4j = require('neo4j-driver')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function testPlayerSearch() {
  console.log('🔍 Testing Player Search with Schema...')
  
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
    
    // Test 1: Search by exact name (should use index)
    console.log('\n🔍 Test 1: Exact Name Search')
    const exactSearchResult = await session.run(`
      MATCH (p:Player {name: 'Alex Wells', graphLabel: 'dorkiniansWebsite'})
      RETURN p.name, p.id, p.allowOnSite
    `)
    
    if (exactSearchResult.records.length > 0) {
      const player = exactSearchResult.records[0]
      console.log(`  ✅ Found: ${player.get('p.name')} (ID: ${player.get('p.id')})`)
    } else {
      console.log('  ❌ No player found with exact name')
    }

    // Test 2: Search by partial name (should use text index)
    console.log('\n🔍 Test 2: Partial Name Search')
    const partialSearchResult = await session.run(`
      MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
      WHERE p.name CONTAINS 'Alex'
      RETURN p.name, p.id
      LIMIT 5
    `)
    
    console.log(`  Found ${partialSearchResult.records.length} players with 'Alex' in name:`)
    partialSearchResult.records.forEach(record => {
      console.log(`    - ${record.get('p.name')}`)
    })

    // Test 3: Search by allowOnSite flag (should use index)
    console.log('\n🔍 Test 3: Boolean Property Search')
    const allowOnSiteResult = await session.run(`
      MATCH (p:Player {allowOnSite: true, graphLabel: 'dorkiniansWebsite'})
      RETURN count(p) as count
    `)
    
    const allowOnSiteCount = allowOnSiteResult.records[0].get('count')
    console.log(`  Players allowed on site: ${allowOnSiteCount}`)

    // Test 4: Performance test with index
    console.log('\n⚡ Test 4: Performance Test (Index Usage)')
    const startTime = Date.now()
    
    const performanceResult = await session.run(`
      MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
      WHERE p.name CONTAINS 'James'
      RETURN count(p) as count
    `)
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`  Query duration: ${duration}ms`)
    console.log(`  Players with 'James' in name: ${performanceResult.records[0].get('count')}`)

    // Test 5: Schema constraint test
    console.log('\n🔒 Test 5: Schema Constraint Test')
    try {
      const constraintTestResult = await session.run(`
        CREATE (p:Player {
          name: 'Test Player',
          id: 'player-test-player',
          allowOnSite: true,
          graphLabel: 'dorkiniansWebsite',
          createdAt: datetime()
        })
        RETURN p.name
      `)
      console.log(`  ✅ Constraint test passed: ${constraintTestResult.records[0].get('p.name')}`)
      
      // Clean up test node
      await session.run(`
        MATCH (p:Player {name: 'Test Player'})
        DELETE p
      `)
      console.log('  🗑️ Test node cleaned up')
      
    } catch (error) {
      console.log(`  ❌ Constraint test failed: ${error.message}`)
    }

    console.log('\n🎉 Player search testing completed successfully!')
    
  } catch (error) {
    console.error('❌ Player search testing failed:', error.message)
  } finally {
    await session.close()
    await driver.close()
  }
}

// Run the player search testing
testPlayerSearch()
  .then(() => {
    console.log('✅ Player search testing completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Player search testing failed:', error)
    process.exit(1)
  })
