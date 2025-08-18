const path = require('path')

async function testAPI() {
  console.log('🧪 Testing Seed Data API with Fixtures...')
  
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
    
    const testData = {
      dataSources: [
        {
          name: "TBL_FixturesAndResults",
          url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=0&single=true&output=csv",
          type: "StatsData"
        }
      ]
    }
    
    console.log('🌐 Calling API endpoint: http://localhost:3000/api/seed-data')
    console.log('📊 Test data:', JSON.stringify(testData, null, 2))
    
    const response = await fetch('http://localhost:3000/api/seed-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('✅ API call successful!')
      console.log('📊 Result:', result)
    } else {
      const errorText = await response.text()
      console.error('❌ API call failed:', response.status, errorText)
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testAPI()
