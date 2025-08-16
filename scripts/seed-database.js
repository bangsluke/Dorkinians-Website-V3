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
    
    // For now, we'll use the development server approach
    console.log('🌱 To seed the database, please:')
    console.log('1. Start the development server: npm run dev')
    console.log('2. Run the test seeding: npm run test-seed')
    console.log('3. Or use the chatbot to test data retrieval')
    
    console.log(`✅ ${environment} environment check completed successfully!`)
    
  } catch (error) {
    console.error(`❌ ${environment} seeding failed:`, error.message)
    process.exit(1)
  }
}

// Run the seeding
seedDatabase()
