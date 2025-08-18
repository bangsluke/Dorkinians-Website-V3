const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

// Test relationship creation logic
async function testRelationshipCreation() {
  console.log('🧪 Testing Relationship Creation Logic...')
  
  try {
    // Test the extractYear function
    const testSeasons = ['2016-17', '2017/18', '2018', 'unknown']
    console.log('\n📅 Testing extractYear function:')
    testSeasons.forEach(season => {
      const year = extractYear(season)
      console.log(`  ${season} → ${year}`)
    })
    
    // Test node ID generation
    console.log('\n🆔 Testing node ID generation:')
    const testNames = ['John Smith', 'Team A', 'Season 2020']
    testNames.forEach(name => {
      const id = generateNodeId('test', name)
      console.log(`  "${name}" → ${id}`)
    })
    
    console.log('\n✅ Relationship creation logic tests completed')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

function extractYear(seasonString) {
  if (!seasonString) return new Date().getFullYear()
  
  // Handle formats like "2016-17", "2016/17", "2016"
  const yearMatch = seasonString.match(/(\d{4})/)
  if (yearMatch) {
    return parseInt(yearMatch[1])
  }
  
  return new Date().getFullYear()
}

function generateNodeId(prefix, name) {
  return `${prefix}-${String(name).toLowerCase().replace(/\s+/g, '-')}`
}

// Run the test
testRelationshipCreation()
  .then(() => {
    console.log('🎉 Test completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })
