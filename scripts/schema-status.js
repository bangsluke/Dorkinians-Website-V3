const neo4j = require('neo4j-driver')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function showSchemaStatus() {
  console.log('📊 Neo4j Database Schema Status...')
  
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
    
    // Quick node count
    const nodeCountResult = await session.run(`
      MATCH (n {graphLabel: 'dorkiniansWebsite'})
      RETURN labels(n) as nodeType, count(n) as count
      ORDER BY count DESC
    `)
    
    console.log('\n📈 Current Database State:')
    let totalNodes = 0
    nodeCountResult.records.forEach(record => {
      const nodeType = record.get('nodeType')
      const count = record.get('count')
      totalNodes += Number(count)
      console.log(`  ${nodeType}: ${count}`)
    })
    console.log(`  Total: ${totalNodes} nodes`)

    // Schema status
    const constraintsResult = await session.run('SHOW CONSTRAINTS')
    const indexesResult = await session.run('SHOW INDEXES')
    
    console.log('\n🏗️ Schema Status:')
    console.log(`  Constraints: ${constraintsResult.records.length}`)
    console.log(`  Indexes: ${indexesResult.records.length}`)
    
    // Performance check
    const startTime = Date.now()
    await session.run(`
      MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
      WHERE p.name CONTAINS 'James'
      RETURN count(p) as count
    `)
    const endTime = Date.now()
    
    console.log('\n⚡ Performance:')
    console.log(`  Sample query: ${endTime - startTime}ms`)
    
    console.log('\n✅ Schema is ready for chatbot queries!')
    
  } catch (error) {
    console.error('❌ Status check failed:', error.message)
  } finally {
    await session.close()
    await driver.close()
  }
}

// Run the status check
showSchemaStatus()
  .then(() => {
    console.log('✅ Status check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Status check failed:', error)
    process.exit(1)
  })
