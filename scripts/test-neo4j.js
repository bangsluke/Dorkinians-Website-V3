const path = require('path')

// Load environment variables
require('dotenv').config()

async function testNeo4jConnection() {
  console.log('🧪 Testing Neo4j Local Connection...')
  
  try {
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
    
    // For now, just show the connection details
    console.log('\n🔗 Connection Details:')
    console.log(`  URI: ${process.env.DEV_NEO4J_URI}`)
    console.log(`  User: ${process.env.DEV_NEO4J_USER}`)
    console.log(`  Database: ${process.env.DEV_NEO4J_DATABASE || 'neo4j'}`)
    
    console.log('\n💡 To test the actual Neo4j connection, you can:')
    console.log('   1. Start your Neo4j Desktop database')
    console.log('   2. Run the development server: npm run dev')
    console.log('   3. Check the console for connection logs')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    console.error('💡 Make sure you have a .env file with Neo4j configuration')
  }
}

// Run the test
testNeo4jConnection()
  .then(() => {
    console.log('\n🎉 Environment test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })
