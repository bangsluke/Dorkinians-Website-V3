const { exec } = require('child_process')
require('dotenv').config()

async function debugCSVStructure() {
  console.log('🔍 Debugging CSV structure...\n')
  
  // Test URLs for the CSV files
  const csvUrls = {
    'TBL_Players': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=528214413&single=true&output=csv',
    'TBL_FixturesAndResults': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=0&single=true&output=csv',
    'TBL_MatchDetails': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=564691931&single=true&output=csv'
  }
  
  for (const [tableName, url] of Object.entries(csvUrls)) {
    console.log(`📊 ${tableName}:`)
    console.log(`   URL: ${url}`)
    
    try {
      // Fetch CSV data
      const response = await fetch(url)
      if (!response.ok) {
        console.log(`   ❌ HTTP error: ${response.status}`)
        continue
      }
      
      const csvText = await response.text()
      const lines = csvText.split('\n')
      
      // Show first few lines
      console.log(`   📄 Total lines: ${lines.length}`)
      console.log(`   🔤 First line (headers): ${lines[0]?.substring(0, 100)}...`)
      console.log(`   📝 Second line (sample data): ${lines[1]?.substring(0, 100)}...`)
      
      // Parse with Papa Parse to see column names
      const Papa = require('papaparse')
      const result = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        preview: 3 // Only parse first 3 rows
      })
      
      if (result.meta.fields && result.meta.fields.length > 0) {
        console.log(`   🏷️  Column names: ${result.meta.fields.join(', ')}`)
      } else {
        console.log(`   ⚠️  No column names found (header: false might be needed)`)
      }
      
      if (result.data && result.data.length > 0) {
        console.log(`   📊 Sample row:`, JSON.stringify(result.data[0], null, 2))
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`)
    }
    
    console.log('') // Empty line between tables
  }
}

// Run the debug script
debugCSVStructure().catch(console.error)
