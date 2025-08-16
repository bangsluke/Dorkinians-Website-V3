const path = require('path')

// Simple test script for Neo4j connection and seeding
async function testNeo4jConnection() {
  console.log('🧪 Testing Neo4j Local Connection...')
  console.log('📁 Current directory:', __dirname)
  console.log('📁 Project root:', path.join(__dirname, '..'))
  
  try {
    // Check if .env file exists and load it
    const envPath = path.join(__dirname, '..', '.env')
    console.log('🔍 Looking for .env file at:', envPath)
    
    // Try to load environment variables
    require('dotenv').config({ path: envPath })
    
    console.log('📋 Environment variables loaded:')
    console.log('  NODE_ENV:', process.env.NODE_ENV || 'not set')
    console.log('  DEV_NEO4J_URI:', process.env.DEV_NEO4J_URI || 'not set')
    console.log('  DEV_NEO4J_USER:', process.env.DEV_NEO4J_USER || 'not set')
    console.log('  DEV_NEO4J_PASSWORD:', process.env.DEV_NEO4J_PASSWORD ? '***set***' : 'not set')
    
    // Check if we have the required environment variables
    if (!process.env.DEV_NEO4J_URI || !process.env.DEV_NEO4J_USER || !process.env.DEV_NEO4J_PASSWORD) {
      console.error('❌ Missing required Neo4j environment variables')
      console.error('   Please check your .env file')
      return
    }
    
    console.log('✅ Environment variables are properly configured')
    console.log('🎯 Ready to test Neo4j connection')
    
    // Test the actual connection by calling the seed-data API
    console.log('🌐 Testing connection via API...')
    
    const response = await fetch('http://localhost:3000/api/seed-data', {
      method: 'GET'
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ API connection successful!')
      console.log('📊 Database stats:', data)
    } else {
      console.log('⚠️ API not responding, but this might be expected if server is not running')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    console.error('💡 Make sure you have a .env file with Neo4j configuration')
  }
}

// Run the test
testNeo4jConnection()
  .then(() => {
    console.log('🎉 Environment test completed')
    console.log('\n📋 Next steps:')
    console.log('1. Start your Neo4j Desktop database')
    console.log('2. Run: npm run dev')
    console.log('3. Test seeding: http://localhost:3000/api/seed-data')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })
