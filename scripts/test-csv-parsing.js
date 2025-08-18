const Papa = require('papaparse')
require('dotenv').config()

async function testCSVParsing() {
  console.log('🔍 Testing CSV parsing...\n')
  
  // Test URLs
  const csvUrls = {
    'TBL_Players': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=528214413&single=true&output=csv',
    'TBL_MatchDetails': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=564691931&single=true&output=csv'
  }
  
  for (const [tableName, url] of Object.entries(csvUrls)) {
    console.log(`📊 ${tableName}:`)
    
    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.log(`   ❌ HTTP error: ${response.status}`)
        continue
      }
      
      const csvText = await response.text()
      
      // Parse with Papa Parse
      const result = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        preview: 5 // Only parse first 5 rows
      })
      
      console.log(`   🏷️  Column names: ${result.meta.fields?.join(', ') || 'None'}`)
      console.log(`   📄 Rows parsed: ${result.data.length}`)
      
      if (result.data.length > 0) {
        console.log(`   📝 First row:`, JSON.stringify(result.data[0], null, 2))
        
        // Test the findColumnValue logic
        const row = result.data[0]
        console.log(`   🔍 Testing column access:`)
        console.log(`      PLAYER NAME: "${row['PLAYER NAME']}"`)
        console.log(`      TEAM: "${row['TEAM']}"`)
        console.log(`      DATE: "${row['DATE']}"`)
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`)
    }
    
    console.log('') // Empty line between tables
  }
}

// Run the test
testCSVParsing().catch(console.error)
