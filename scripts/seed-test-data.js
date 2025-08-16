const path = require('path')

// Test seeding with sample data
async function seedTestData() {
  console.log('🧪 Testing Database Seeding with Sample Data...')
  
  try {
    // Load environment variables
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
    
    console.log('📋 Environment check:')
    console.log('  DEV_NEO4J_URI:', process.env.DEV_NEO4J_URI || 'not set')
    console.log('  DEV_NEO4J_USER:', process.env.DEV_NEO4J_USER || 'not set')
    console.log('  DEV_NEO4J_PASSWORD:', process.env.DEV_NEO4J_PASSWORD ? '***set***' : 'not set')
    
    if (!process.env.DEV_NEO4J_URI || !process.env.DEV_NEO4J_USER || !process.env.DEV_NEO4J_PASSWORD) {
      console.error('❌ Missing required Neo4j environment variables')
      return
    }
    
    console.log('✅ Environment variables loaded')
    
    // Test seeding via API with sample data
    console.log('🌐 Testing seeding with sample data...')
    
    const sampleData = {
      dataSources: [
        {
          name: "TestPlayerStats",
          url: "data:text/csv;base64,UGxheWVyTmFtZSxUZWFtLFBvc2l0aW9uLEdvYWxzCkpvaG4gRG9lLFRlYW0gMSxGb3J3YXJkLDEwClNtaXRoIEpvbmVzLFRlYW0gMiwgTWlkZmllbGRlciw1Ck1pa2UgV2lsbGlhbXMsVGVhbSAxLERlZmVuZGVyLDA=",
          type: "StatsData"
        }
      ]
    }
    
    const response = await fetch('http://localhost:3000/api/seed-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sampleData)
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('✅ Seeding successful!')
      console.log('📊 Result:', result)
      
      if (result.success) {
        console.log(`🎉 Created ${result.nodesCreated} nodes and ${result.relationshipsCreated} relationships`)
      } else {
        console.log('⚠️ Seeding completed with errors:', result.errors)
      }
    } else {
      const errorText = await response.text()
      console.error('❌ Seeding failed:', response.status, errorText)
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message)
    console.log('\n💡 Make sure:')
    console.log('1. Neo4j Desktop is running')
    console.log('2. Next.js server is running (npm run dev)')
    console.log('3. Your .env file has correct credentials')
  }
}

// Run the test seeding
seedTestData()
  .then(() => {
    console.log('\n🎉 Test seeding completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Test seeding failed:', error)
    process.exit(1)
  })
