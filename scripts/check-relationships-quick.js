const { exec } = require('child_process')
require('dotenv').config()

async function checkRelationships() {
  console.log('🔍 Quick check of relationships created...\n')
  
  try {
    // Try to connect via Next.js API first
    const response = await fetch('http://localhost:3000/api/neo4j/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          MATCH ()-[r]-()
          WHERE r.graphLabel = 'dorkiniansWebsite'
          RETURN DISTINCT type(r) as relationshipType, count(r) as count
          ORDER BY count DESC
        `
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('📊 Relationship Types Created:')
      if (result.data && result.data.length > 0) {
        result.data.forEach(row => {
          console.log(`   ${row.relationshipType}: ${row.count} relationships`)
        })
      } else {
        console.log('   No relationships found')
      }
    } else {
      console.log('❌ Next.js API failed, trying direct Neo4j connection...')
      
      // Fallback to direct Neo4j connection
      const baseUrl = process.env.DEV_NEO4J_URI || 'bolt://localhost:7687'
      const username = process.env.DEV_NEO4J_USER || 'neo4j'
      const password = process.env.DEV_NEO4J_PASSWORD || 'password'
      
      const hostPort = baseUrl.replace('bolt://', '').replace('neo4j://', '')
      const [host, port] = hostPort.split(':')
      const httpPort = port ? parseInt(port) + 1000 : 7474
      
      const httpUrl = `http://${host}:${httpPort}`
      
      const curlCommand = `curl -s -X POST "${httpUrl}/db/neo4j/tx/commit" \
        -H "Content-Type: application/json" \
        -H "Authorization: Basic ${Buffer.from(`${username}:${password}`).toString('base64')}" \
        -d '{
          "statements": [{
            "statement": "MATCH ()-[r]-() WHERE r.graphLabel = \\"dorkiniansWebsite\\" RETURN DISTINCT type(r) as relationshipType, count(r) as count ORDER BY count DESC",
            "resultDataContents": ["row"]
          }]
        }'`
      
      exec(curlCommand, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Error:', error.message)
          return
        }
        
        try {
          const result = JSON.parse(stdout)
          if (result.results && result.results[0]) {
            const rows = result.results[0].data
            console.log('📊 Relationship Types Created:')
            rows.forEach(row => {
              console.log(`   ${row.row[0]}: ${row.row[1]} relationships`)
            })
          }
        } catch (parseError) {
          console.log('❌ Failed to parse response:', parseError.message)
        }
      })
    }
    
  } catch (error) {
    console.error('❌ Failed to check relationships:', error.message)
  }
}

// Run the check
checkRelationships().catch(console.error)
