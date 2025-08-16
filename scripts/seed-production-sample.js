const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

// Production database seeding with sample data
async function seedProductionWithSample() {
  console.log('🚀 Starting Production Database Seeding with Sample Data...')
  console.log('📍 Target: Neo4j Aura (Production)')
  
  try {
    // Check production environment variables
    console.log('📋 Production Environment Variables:')
    console.log('  PROD_NEO4J_URI:', process.env.PROD_NEO4J_URI || 'not set')
    console.log('  PROD_NEO4J_USER:', process.env.PROD_NEO4J_USER || 'not set')
    console.log('  PROD_NEO4J_PASSWORD:', process.env.PROD_NEO4J_PASSWORD ? '***set***' : 'not set')
    
    if (!process.env.PROD_NEO4J_URI || !process.env.PROD_NEO4J_USER || !process.env.PROD_NEO4J_PASSWORD) {
      throw new Error('Production Neo4j environment variables are not configured')
    }
    
    // Import required modules
    const neo4j = require('neo4j-driver')
    
    console.log('🔌 Creating Neo4j driver...')
    const driver = neo4j.driver(
      process.env.PROD_NEO4J_URI,
      neo4j.auth.basic(process.env.PROD_NEO4J_USER, process.env.PROD_NEO4J_PASSWORD)
    )
    
    console.log('✅ Driver created successfully')
    
    // Test connection
    console.log('🔍 Testing connection...')
    const session = driver.session()
    
    // Clear existing dorkiniansWebsite data
    console.log('🗑️ Clearing existing dorkiniansWebsite data...')
    const clearResult = await session.run(`
      MATCH (n {graphLabel: "dorkiniansWebsite"})
      OPTIONAL MATCH (n)-[r]-()
      DELETE r, n
    `)
    console.log('✅ Existing data cleared')
    
    // Create sample player data
    console.log('🌱 Creating sample player nodes...')
    const samplePlayers = [
      {
        NAME: "Aaron Harper",
        TEAM: "1st XI",
        POSITION: "Forward",
        GOALS: "15",
        ASSISTS: "8",
        APPEARANCES: "22",
        ALLOW_ON_SITE: "TRUE"
      },
      {
        NAME: "Aaron Mason",
        TEAM: "1st XI",
        POSITION: "Midfielder",
        GOALS: "12",
        ASSISTS: "15",
        APPEARANCES: "25",
        ALLOW_ON_SITE: "TRUE"
      },
      {
        NAME: "Adam Bennetti",
        TEAM: "2nd XI",
        POSITION: "Defender",
        GOALS: "3",
        ASSISTS: "5",
        APPEARANCES: "20",
        ALLOW_ON_SITE: "TRUE"
      },
      {
        NAME: "Adam Bower",
        TEAM: "1st XI",
        POSITION: "Goalkeeper",
        GOALS: "0",
        ASSISTS: "2",
        APPEARANCES: "18",
        ALLOW_ON_SITE: "TRUE"
      },
      {
        NAME: "Adam Davison",
        TEAM: "2nd XI",
        POSITION: "Forward",
        GOALS: "18",
        ASSISTS: "6",
        APPEARANCES: "24",
        ALLOW_ON_SITE: "TRUE"
      }
    ]
    
    let nodesCreated = 0
    let relationshipsCreated = 0
    
    for (const playerData of samplePlayers) {
      try {
        // Add required properties
        const playerProps = {
          ...playerData,
          graphLabel: 'dorkiniansWebsite',
          createdAt: new Date().toISOString()
        }
        
        // Create player node
        const createResult = await session.run(`
          CREATE (p:Player $props)
          RETURN p
        `, { props: playerProps })
        
        nodesCreated++
        
        // Create team relationship
        if (playerData.TEAM) {
          await session.run(`
            MERGE (t:Team {name: $teamName, graphLabel: "dorkiniansWebsite"})
            WITH t
            MATCH (p:Player {NAME: $playerName, graphLabel: "dorkiniansWebsite"})
            MERGE (p)-[:PLAYS_FOR {graphLabel: "dorkiniansWebsite"}]->(t)
          `, { 
            teamName: playerData.TEAM, 
            playerName: playerData.NAME 
          })
          relationshipsCreated++
        }
        
        // Create position relationship
        if (playerData.POSITION) {
          await session.run(`
            MERGE (pos:Position {name: $positionName, graphLabel: "dorkiniansWebsite"})
            WITH pos
            MATCH (p:Player {NAME: $playerName, graphLabel: "dorkiniansWebsite"})
            MERGE (p)-[:PLAYS_AS {graphLabel: "dorkiniansWebsite"}]->(pos)
          `, { 
            positionName: playerData.POSITION, 
            playerName: playerData.NAME 
          })
          relationshipsCreated++
        }
        
        console.log(`  ✅ Created player: ${playerData.NAME} (${playerData.TEAM})`)
        
      } catch (error) {
        console.error(`❌ Failed to create player ${playerData.NAME}:`, error.message)
      }
    }
    
    console.log(`🎉 Sample seeding completed!`)
    console.log(`📊 Created ${nodesCreated} nodes and ${relationshipsCreated} relationships`)
    
    // Verify the data
    console.log('🔍 Verifying created data...')
    const verifyResult = await session.run(`
      MATCH (n:Player {graphLabel: "dorkiniansWebsite"})
      RETURN count(n) as playerCount
    `)
    const playerCount = verifyResult.records[0].get('playerCount').toNumber()
    console.log(`✅ Verified ${playerCount} Player nodes in database`)
    
    // Show sample data
    const sampleResult = await session.run(`
      MATCH (p:Player {graphLabel: "dorkiniansWebsite"})
      RETURN p.NAME as name, p.TEAM as team, p.POSITION as position, p.GOALS as goals
      LIMIT 5
    `)
    
    console.log('👥 Sample players in database:')
    sampleResult.records.forEach(record => {
      const name = record.get('name')
      const team = record.get('team')
      const position = record.get('position')
      const goals = record.get('goals')
      console.log(`  ${name} - ${team} ${position} (${goals} goals)`)
    })
    
    await session.close()
    await driver.close()
    
    console.log('✅ Production sample seeding completed successfully!')
    console.log('💡 You can now test the chatbot with this sample data')
    
  } catch (error) {
    console.error('❌ Production sample seeding failed:', error.message)
    console.error('Full error:', error)
  }
}

// Run the seeding
seedProductionWithSample()
