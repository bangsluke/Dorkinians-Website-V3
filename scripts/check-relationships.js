const neo4j = require('neo4j-driver')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function checkRelationships() {
  console.log('🔍 Checking Database Relationships...')
  
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
    const totalRelsQuery = `
      MATCH ()-[r]->()
      RETURN count(r) as totalRelationships
    `
    
    const totalRelsResult = await session.run(totalRelsQuery)
    const totalRels = totalRelsResult.records[0].get('totalRelationships')
    console.log(`  Total relationships: ${totalRels}`)
    
    // Check 2: Count relationships by type
    console.log('\n🔗 Check 2: Relationships by Type')
    const relsByTypeQuery = `
      MATCH ()-[r]->()
      RETURN type(r) as relationshipType, count(r) as count
      ORDER BY count DESC
    `
    
    const relsByTypeResult = await session.run(relsByTypeQuery)
    console.log('  Relationships by type:')
    relsByTypeResult.records.forEach(record => {
      const relType = record.get('relationshipType')
      const count = record.get('count')
      console.log(`    ${relType}: ${count}`)
    })
    
    // Check 3: Check specific relationship types we expect
    console.log('\n🎯 Check 3: Expected Relationship Types')
    const expectedRels = ['PLAYS_FOR', 'PARTICIPATES_IN', 'BELONGS_TO', 'PERFORMED_IN', 'GENERATED_FROM']
    
    for (const relType of expectedRels) {
      const checkQuery = `
        MATCH ()-[r:${relType}]->()
        RETURN count(r) as count
      `
      
      try {
        const result = await session.run(checkQuery)
        const count = result.records[0].get('count')
        console.log(`    ${relType}: ${count}`)
      } catch (error) {
        console.log(`    ${relType}: Error - ${error.message}`)
      }
    }
    
    // Check 4: Sample relationships
    console.log('\n📋 Check 4: Sample Relationships')
    const sampleRelsQuery = `
      MATCH (from)-[r]->(to)
      RETURN labels(from)[0] as fromType, from.id as fromId, type(r) as relType, labels(to)[0] as toType, to.id as toId
      LIMIT 10
    `
    
    const sampleRelsResult = await session.run(sampleRelsQuery)
    console.log('  Sample relationships:')
    sampleRelsResult.records.forEach((record, index) => {
      const fromType = record.get('fromType')
      const fromId = record.get('fromId')
      const relType = record.get('relType')
      const toType = record.get('toType')
      const toId = record.get('toId')
      console.log(`    ${index + 1}. (${fromType}:${fromId}) -[${relType}]-> (${toType}:${toId})`)
    })
    
    // Check 5: Player-Team relationships specifically
    console.log('\n👥 Check 5: Player-Team Relationships')
    const playerTeamQuery = `
      MATCH (p:Player)-[r:PLAYS_FOR]->(t:Team)
      RETURN count(r) as count
    `
    
    try {
      const playerTeamResult = await session.run(playerTeamQuery)
      const count = playerTeamResult.records[0].get('count')
      console.log(`  Player-Team relationships: ${count}`)
      
      if (count > 0) {
        // Show a sample
        const sampleQuery = `
          MATCH (p:Player)-[r:PLAYS_FOR]->(t:Team)
          RETURN p.name as playerName, t.name as teamName, r.season as season
          LIMIT 3
        `
        const sampleResult = await session.run(sampleQuery)
        console.log('  Sample Player-Team relationships:')
        sampleResult.records.forEach((record, index) => {
          const playerName = record.get('playerName')
          const teamName = record.get('teamName')
          const season = record.get('season')
          console.log(`    ${index + 1}. ${playerName} plays for ${teamName} (${season})`)
        })
      }
    } catch (error) {
      console.log(`  Error checking Player-Team relationships: ${error.message}`)
    }
    
    console.log('\n✅ Relationship check completed')
    
  } catch (error) {
    console.error('❌ Check failed:', error.message)
  } finally {
    await session.close()
    await driver.close()
  }
}

// Run the check
checkRelationships()
  .then(() => {
    console.log('🎉 Relationship check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Check failed:', error)
    process.exit(1)
  })
