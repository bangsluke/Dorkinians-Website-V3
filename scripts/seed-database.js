const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

// Unified database seeding script that works with both development and production
async function seedDatabase() {
  // Get environment from command line argument or default to development
  const environment = process.argv[2] || 'development'
  
  console.log(`🚀 Starting Database Seeding...`)
  console.log(`📍 Environment: ${environment.toUpperCase()}`)
  
  try {
    // Set NODE_ENV based on the environment parameter
    process.env.NODE_ENV = environment
    
    // Check environment variables based on the target environment
    if (environment === 'production') {
      console.log('📋 Production Environment Check:')
      console.log('  NODE_ENV:', process.env.NODE_ENV)
      console.log('  PROD_NEO4J_URI:', process.env.PROD_NEO4J_URI ? '✅ Set' : '❌ Missing')
      console.log('  PROD_NEO4J_USER:', process.env.PROD_NEO4J_USER ? '✅ Set' : '❌ Missing')
      console.log('  PROD_NEO4J_PASSWORD:', process.env.PROD_NEO4J_PASSWORD ? '✅ Set' : '❌ Missing')
      
      if (!process.env.PROD_NEO4J_URI || !process.env.PROD_NEO4J_USER || !process.env.PROD_NEO4J_PASSWORD) {
        throw new Error('Production Neo4j environment variables are not configured')
      }
      
      console.log('📍 Target: Neo4j Aura (Production)')
    } else {
      console.log('📋 Development Environment Check:')
      console.log('  NODE_ENV:', process.env.NODE_ENV)
      console.log('  DEV_NEO4J_URI:', process.env.DEV_NEO4J_URI ? '✅ Set' : '❌ Missing')
      console.log('  DEV_NEO4J_USER:', process.env.DEV_NEO4J_USER ? '✅ Set' : '❌ Missing')
      console.log('  DEV_NEO4J_PASSWORD:', process.env.DEV_NEO4J_PASSWORD ? '✅ Set' : '❌ Missing')
      
      if (!process.env.DEV_NEO4J_URI || !process.env.DEV_NEO4J_USER || !process.env.DEV_NEO4J_PASSWORD) {
        throw new Error('Development Neo4j environment variables are not configured')
      }
      
      console.log('📍 Target: Local Neo4j Desktop (Development)')
    }
    
    console.log('✅ Environment variables validated')
    
    // Import the data seeder service
    const { dataSeederService } = require('../lib/services/dataSeederService')
    
    // Test data source - TBL_Players
    const seedData = {
      dataSources: [
        {
          name: "TBL_Players",
          url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=528214413&single=true&output=csv",
          type: "StatsData"
        }
      ]
    }
    
    console.log(`🌱 Seeding TBL_Players data to ${environment} database...`)
    
    // Seed the data
    const result = await dataSeederService.seedAllData(seedData)
    
    console.log(`✅ ${environment} seeding completed successfully!`)
    console.log('📊 Result:', JSON.stringify(result, null, 2))
    
  } catch (error) {
    console.error(`❌ ${environment} seeding failed:`, error.message)
    process.exit(1)
  }
}

// Run the seeding
seedDatabase()
