const neo4j = require('neo4j-driver')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function checkRelationships() {
  console.log('🔍 Checking Neo4j Relationships and graphLabel Properties...')
  
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
    
    // Check 1: Count all relationships
    console.log('\n📊 Check 1: Total Relationship Count')
    const totalRelResult = await session.run('MATCH ()-[r]->() RETURN count(r) as totalRelationships')
    const totalRels = totalRelResult.records[0].get('totalRelationships')
    console.log(`  Total relationships in database: ${totalRels}`)

    // Check 2: Count relationships with graphLabel property
    console.log('\n🏷️ Check 2: Relationships with graphLabel Property')
    const labeledRelResult = await session.run(`
      MATCH ()-[r]->()
      WHERE r.graphLabel IS NOT NULL
      RETURN count(r) as labeledRelationships
    `)
    const labeledRels = labeledRelResult.records[0].get('labeledRelationships')
    console.log(`  Relationships with graphLabel: ${labeledRels}`)

    // Check 3: Check specific graphLabel values
    console.log('\n🔍 Check 3: graphLabel Values on Relationships')
    const labelValuesResult = await session.run(`
      MATCH ()-[r]->()
      WHERE r.graphLabel IS NOT NULL
      RETURN r.graphLabel as graphLabel, count(r) as count
      ORDER BY count DESC
    `)
    
    labelValuesResult.records.forEach(record => {
      const graphLabel = record.get('graphLabel')
      const count = record.get('count')
      console.log(`  ${graphLabel}: ${count} relationships`)
    })

    // Check 4: Check nodes with graphLabel property
    console.log('\n📋 Check 4: Nodes with graphLabel Property')
    const labeledNodesResult = await session.run(`
      MATCH (n)
      WHERE n.graphLabel IS NOT NULL
      RETURN n.graphLabel as graphLabel, count(n) as count
      ORDER BY count DESC
    `)
    
    labeledNodesResult.records.forEach(record => {
      const graphLabel = record.get('graphLabel')
      const count = record.get('count')
      console.log(`  ${graphLabel}: ${count} nodes`)
    })

    // Check 5: Sample relationships to see their properties
    console.log('\n🔗 Check 5: Sample Relationships with Properties')
    const sampleRelsResult = await session.run(`
      MATCH (n)-[r]->(m)
      WHERE n.graphLabel = 'dorkiniansWebsite' OR m.graphLabel = 'dorkiniansWebsite' OR r.graphLabel = 'dorkiniansWebsite'
      RETURN n.graphLabel as fromLabel, type(r) as relType, r.graphLabel as relLabel, m.graphLabel as toLabel
      LIMIT 10
    `)
    
    if (sampleRelsResult.records.length > 0) {
      console.log('  Sample relationships:')
      sampleRelsResult.records.forEach((record, index) => {
        const fromLabel = record.get('fromLabel')
        const relType = record.get('relType')
        const relLabel = record.get('relLabel')
        const toLabel = record.get('toLabel')
        console.log(`    ${index + 1}. (${fromLabel})-[${relType}:${relLabel}]->(${toLabel})`)
      })
    } else {
      console.log('  No relationships found with dorkiniansWebsite graphLabel')
    }

    // Check 6: Look for any relationships at all
    console.log('\n🔍 Check 6: Any Relationships in Database')
    const anyRelsResult = await session.run(`
      MATCH ()-[r]->()
      RETURN type(r) as relType, count(r) as count
      ORDER BY count DESC
      LIMIT 10
    `)
    
    if (anyRelsResult.records.length > 0) {
      console.log('  Relationship types found:')
      anyRelsResult.records.forEach(record => {
        const relType = record.get('relType')
        const count = record.get('count')
        console.log(`    ${relType}: ${count}`)
      })
    } else {
      console.log('  No relationships found in database')
    }

    console.log('\n✅ Relationship check completed')
    
  } catch (error) {
    console.error('❌ Relationship check failed:', error.message)
  } finally {
    await session.close()
    await driver.close()
  }
}

// Run the relationship check
checkRelationships()
  .then(() => {
    console.log('✅ Relationship check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Relationship check failed:', error)
    process.exit(1)
  })
