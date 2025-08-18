const neo4j = require('neo4j-driver')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function testFullSchema() {
  console.log('🧪 Testing Full Neo4j Schema with All Data Sources...')
  
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
    
    // Test 1: Node counts by type
    console.log('\n📊 Test 1: Node Counts by Type')
    const nodeCountResult = await session.run(`
      MATCH (n {graphLabel: 'dorkiniansWebsite'})
      RETURN labels(n) as nodeType, count(n) as count
      ORDER BY count DESC
    `)
    
    nodeCountResult.records.forEach(record => {
      const nodeType = record.get('nodeType')
      const count = record.get('count')
      console.log(`  ${nodeType}: ${count}`)
    })

    // Test 2: Schema constraints verification
    console.log('\n🔒 Test 2: Schema Constraints')
    const constraintsResult = await session.run('SHOW CONSTRAINTS')
    console.log(`  Active constraints: ${constraintsResult.records.length}`)
    
    constraintsResult.records.forEach(record => {
      const constraint = record.get('name')
      const type = record.get('type')
      console.log(`    - ${constraint} (${type})`)
    })

    // Test 3: Schema indexes verification
    console.log('\n📈 Test 3: Schema Indexes')
    const indexesResult = await session.run('SHOW INDEXES')
    console.log(`  Active indexes: ${indexesResult.records.length}`)
    
    // Group indexes by type
    const indexTypes = {}
    indexesResult.records.forEach(record => {
      const type = record.get('type')
      if (!indexTypes[type]) indexTypes[type] = 0
      indexTypes[type]++
    })
    
    Object.entries(indexTypes).forEach(([type, count]) => {
      console.log(`    ${type}: ${count}`)
    })

    // Test 4: Data integrity checks
    console.log('\n🔍 Test 4: Data Integrity Checks')
    
    // Check for nodes without required properties
    const integrityResult = await session.run(`
      MATCH (n:Player {graphLabel: 'dorkiniansWebsite'})
      WHERE n.name IS NULL OR n.id IS NULL
      RETURN count(n) as invalidPlayers
    `)
    
    const invalidPlayers = integrityResult.records[0].get('invalidPlayers')
    console.log(`  Players with missing properties: ${invalidPlayers}`)

    // Test 5: Sample data from each node type
    console.log('\n📋 Test 5: Sample Data from Each Node Type')
    const sampleResult = await session.run(`
      MATCH (n {graphLabel: 'dorkiniansWebsite'})
      WITH labels(n) as nodeType, n
      RETURN nodeType, collect({
        id: n.id,
        name: n.name,
        season: n.season
      })[0..2] as samples
      ORDER BY nodeType
    `)
    
    sampleResult.records.forEach(record => {
      const nodeType = record.get('nodeType')
      const samples = record.get('samples')
      console.log(`  ${nodeType}:`)
      samples.forEach(sample => {
        console.log(`    - ID: ${sample.id}, Name: ${sample.name || 'N/A'}, Season: ${sample.season || 'N/A'}`)
      })
    })

    // Test 6: Performance test with complex query
    console.log('\n⚡ Test 6: Performance Test (Complex Query)')
    const startTime = Date.now()
    
    const performanceResult = await session.run(`
      MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
      WHERE p.allowOnSite = true
      WITH p
      OPTIONAL MATCH (p)-[:PLAYS_FOR]->(t)
      RETURN count(p) as totalPlayers, count(t) as teams
    `)
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`  Query duration: ${duration}ms`)
    if (performanceResult.records.length > 0) {
      const record = performanceResult.records[0]
      console.log(`  Total players: ${record.get('totalPlayers')}`)
      console.log(`  Teams: ${record.get('teams')}`)
    }

    // Test 7: Graph label isolation
    console.log('\n🏷️ Test 7: Graph Label Isolation')
    const isolationResult = await session.run(`
      MATCH (n)
      WHERE n.graphLabel IS NULL OR n.graphLabel <> 'dorkiniansWebsite'
      RETURN count(n) as otherNodes
    `)
    
    const otherNodes = isolationResult.records[0].get('otherNodes')
    console.log(`  Other nodes in database: ${otherNodes}`)

    console.log('\n🎉 Full schema testing completed successfully!')
    
  } catch (error) {
    console.error('❌ Full schema testing failed:', error.message)
  } finally {
    await session.close()
    await driver.close()
  }
}

// Run the full schema testing
testFullSchema()
  .then(() => {
    console.log('✅ Full schema testing completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Full schema testing failed:', error)
    process.exit(1)
  })
