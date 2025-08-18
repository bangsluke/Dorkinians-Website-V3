const neo4j = require('neo4j-driver')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function testSchemaQueries() {
  console.log('🧪 Testing Neo4j Schema Queries...')
  
  // Get environment variables
  const uri = process.env.NODE_ENV === 'production' 
    ? process.env.PROD_NEO4J_URI 
    : process.env.DEV_NEO4J_URI
  const username = process.env.NODE_ENV === 'production' 
    ? process.env.PROD_NEO4J_USER 
    : process.env.DEV_NEO4J_USER
  const password = process.env.NODE_ENV === 'production' 
    ? process.env.PROD_NEO4J_PASSWORD 
    : process.env.DEV_NEO4J_PASSWORD

  if (!uri || !username || !password) {
    console.error('❌ Missing Neo4j environment variables')
    return
  }

  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password))
  const session = driver.session()

  try {
    console.log('🔗 Connected to Neo4j database')
    
    // Test 1: Basic node count
    console.log('\n📊 Test 1: Node Counts')
    const nodeCountResult = await session.run(`
      MATCH (n {graphLabel: 'dorkiniansWebsite'})
      RETURN labels(n) as nodeType, count(n) as count
      ORDER BY count DESC
    `)
    
    nodeCountResult.records.forEach(record => {
      console.log(`  ${record.get('nodeType')}: ${record.get('count')}`)
    })

    // Test 2: Player search with index
    console.log('\n🔍 Test 2: Player Search (Index Test)')
    const playerSearchResult = await session.run(`
      MATCH (p:Player {name: 'James Tain'})
      RETURN p.name, p.allowOnSite, p.createdAt
    `)
    
    if (playerSearchResult.records.length > 0) {
      const player = playerSearchResult.records[0]
      console.log(`  Found: ${player.get('p.name')} (Allow on site: ${player.get('p.allowOnSite')})`)
    } else {
      console.log('  No players found')
    }

    // Test 3: Graph label isolation
    console.log('\n🏷️ Test 3: Graph Label Isolation')
    const isolationResult = await session.run(`
      MATCH (n)
      WHERE n.graphLabel IS NULL OR n.graphLabel <> 'dorkiniansWebsite'
      RETURN count(n) as otherNodes
    `)
    
    const otherNodes = isolationResult.records[0].get('otherNodes')
    console.log(`  Other nodes in database: ${otherNodes}`)

    // Test 4: Constraint verification
    console.log('\n🔒 Test 4: Constraint Verification')
    const constraintResult = await session.run('SHOW CONSTRAINTS')
    console.log(`  Active constraints: ${constraintResult.records.length}`)

    // Test 5: Index verification
    console.log('\n📈 Test 5: Index Verification')
    const indexResult = await session.run('SHOW INDEXES')
    console.log(`  Active indexes: ${indexResult.records.length}`)

    console.log('\n🎉 Schema testing completed successfully!')
    
  } catch (error) {
    console.error('❌ Schema testing failed:', error.message)
  } finally {
    await session.close()
    await driver.close()
  }
}

// Run the schema testing
testSchemaQueries()
  .then(() => {
    console.log('✅ Schema testing completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Schema testing failed:', error)
    process.exit(1)
  })
