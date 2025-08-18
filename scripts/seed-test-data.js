const path = require('path')
const fs = require('fs')

// Function to read and analyze the seeding errors log
function analyzeErrorLog() {
  const errorLogPath = path.join(process.cwd(), 'logs', 'seeding-errors.log')
  
  try {
    if (!fs.existsSync(errorLogPath)) {
      return {
        exists: false,
        errorCount: 0,
        errors: []
      }
    }
    
    const logContent = fs.readFileSync(errorLogPath, 'utf8')
    const lines = logContent.split('\n')
    
    // Count error entries (lines starting with timestamp)
    const errorLines = lines.filter(line => 
      line.trim() && 
      line.match(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/)
    )
    
    // Extract recent errors for summary
    const recentErrors = errorLines.slice(-10).map(line => {
      const match = line.match(/^\[([^\]]+)\]\s*(.+)/)
      if (match) {
        return {
          timestamp: match[1],
          message: match[2].trim()
        }
      }
      return null
    }).filter(Boolean)
    
    return {
      exists: true,
      errorCount: errorLines.length,
      errors: recentErrors,
      totalLines: lines.length
    }
  } catch (error) {
    return {
      exists: false,
      errorCount: 0,
      errors: [],
      error: error.message
    }
  }
}

// Test seeding with TBL_Players data
async function seedTestData() {
  console.log('🧪 Testing Database Seeding with TBL_Players...')
  
  try {
    // Load environment variables
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
    
    // Check if we're in production mode
    const isProduction = process.env.NODE_ENV === 'production'
    
    if (isProduction) {
      console.log('🏭 PRODUCTION MODE: Seeding Neo4j Aura Database')
      console.log('📋 Production Environment check:')
      console.log('  PROD_NEO4J_URI:', process.env.PROD_NEO4J_URI || 'not set')
      console.log('  PROD_NEO4J_USER:', process.env.PROD_NEO4J_USER || 'not set')
      console.log('  PROD_NEO4J_PASSWORD:', process.env.PROD_NEO4J_PASSWORD ? '***set***' : 'not set')
      
      if (!process.env.PROD_NEO4J_URI || !process.env.PROD_NEO4J_USER || !process.env.PROD_NEO4J_PASSWORD) {
        console.error('❌ Missing required production Neo4j environment variables')
        return
      }
    } else {
      console.log('💻 DEVELOPMENT MODE: Seeding Local Neo4j Database')
      console.log('📋 Development Environment check:')
      console.log('  DEV_NEO4J_URI:', process.env.DEV_NEO4J_URI || 'not set')
      console.log('  DEV_NEO4J_USER:', process.env.DEV_NEO4J_USER || 'not set')
      console.log('  DEV_NEO4J_PASSWORD:', process.env.DEV_NEO4J_PASSWORD ? '***set***' : 'not set')
      
      if (!process.env.DEV_NEO4J_URI || !process.env.DEV_NEO4J_USER || !process.env.DEV_NEO4J_PASSWORD) {
        console.error('❌ Missing required development Neo4j environment variables')
        return
      }
    }
    
    console.log('✅ Environment variables loaded')
    
    // Test seeding via API with TBL_Players
    console.log('🌐 Testing seeding with TBL_Players...')
    
    const seedData = {
      dataSources: [
        {
          name: "TBL_Players",
          url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=528214413&single=true&output=csv",
          type: "StatsData"
        },
        {
          name: "TBL_FixturesAndResults",
          url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=0&single=true&output=csv",
          type: "StatsData"
        }
      ]
    }
    
    // Use appropriate port based on environment
    const port = isProduction ? 3000 : 3000
    const apiUrl = `http://localhost:${port}/api/seed-data`
    
    console.log(`🌐 Calling API endpoint: ${apiUrl}`)
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(seedData)
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('✅ Seeding successful!')
      console.log('📊 Result:', result)
      
      if (result.success) {
        console.log(`🎉 Created ${result.nodesCreated} nodes and ${result.relationshipsCreated} relationships`)
        console.log(`📍 Database: ${isProduction ? 'Neo4j Aura (Production)' : 'Local Neo4j Desktop'}`)
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
    if (process.env.NODE_ENV === 'production') {
      console.log('1. Production Neo4j Aura is accessible')
      console.log('2. Production environment variables are set')
      console.log('3. Next.js server is running (npm run dev)')
    } else {
      console.log('1. Neo4j Desktop is running')
      console.log('2. Next.js server is running (npm run dev)')
      console.log('3. Your .env file has correct credentials')
    }
  }
}

// Run the test seeding
seedTestData()
  .then(() => {
    console.log('\n🔍 Analyzing seeding error log...')
    
    const errorAnalysis = analyzeErrorLog()
    
    if (errorAnalysis.exists) {
      console.log(`📊 Error Log Analysis:`)
      console.log(`  📁 Log file: logs/seeding-errors.log`)
      console.log(`  ❌ Total errors: ${errorAnalysis.errorCount}`)
      console.log(`  📄 Total log lines: ${errorAnalysis.totalLines}`)
      
      if (errorAnalysis.errorCount > 0) {
        console.log(`\n⚠️ Recent errors found:`)
        errorAnalysis.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. [${error.timestamp}] ${error.message}`)
        })
        
        if (errorAnalysis.errorCount > 10) {
          console.log(`  ... and ${errorAnalysis.errorCount - 10} more errors`)
        }
        
        console.log(`\n💡 Check the full log file for complete error details`)
      } else {
        console.log(`✅ No errors found in the log file`)
      }
    } else {
      console.log(`📊 Error Log Analysis:`)
      console.log(`  📁 Log file: logs/seeding-errors.log (not found)`)
      console.log(`  ℹ️ No error log file exists yet`)
    }
    
    console.log('\n🎉 Test seeding completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Test seeding failed:', error)
    process.exit(1)
  })
