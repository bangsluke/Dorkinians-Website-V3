const path = require('path')
const http = require('http')
const https = require('https')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

// GID mapping for Google Sheets (using the actual URLs from dataSources.ts)
const dataSourceUrls = {
  'TBL_Players': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=528214413&single=true&output=csv',
  'TBL_FixturesAndResults': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=0&single=true&output=csv',
  'TBL_MatchDetails': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1&single=true&output=csv',
  'TBL_WeeklyTOTW': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=2&single=true&output=csv',
  'TBL_SeasonTOTW': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=3&single=true&output=csv',
  'TBL_PlayersOfTheMonth': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=4&single=true&output=csv',
  'TBL_OppositionDetails': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=6&single=true&output=csv',
  'TBL_SiteDetails': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=7&single=true&output=csv',
  'TBL_CaptainsAndAwards': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=8&single=true&output=csv'
}

// Helper function to make HTTP requests
function makeRequest(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const client = isHttps ? https : http
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }

    const req = client.request(requestOptions, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        console.log(`  🔄 Following redirect: ${res.statusCode} -> ${res.headers.location}`)
        const redirectUrl = res.headers.location.startsWith('http') 
          ? res.headers.location 
          : `${isHttps ? 'https:' : 'http:'}//${urlObj.hostname}${res.headers.location}`
        
        makeRequest(redirectUrl, maxRedirects - 1)
          .then(resolve)
          .catch(reject)
        return
      }

      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data)
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })
    
    req.end()
  })
}

// Function to fetch CSV headers
async function fetchCSVHeaders(url) {
  try {
    const csvText = await makeRequest(url)
    const lines = csvText.split('\n')

    if (lines.length === 0) {
      throw new Error('Empty CSV file')
    }

    // Parse the first line as headers
    const headerLine = lines[0].trim()
    if (!headerLine) {
      throw new Error('Empty header line')
    }

    // Split by comma and clean up quotes
    const headers = headerLine.split(',').map(header =>
      header.trim().replace(/^["']|["']$/g, '')
    )

    return headers
  } catch (error) {
    console.error(`❌ Failed to fetch CSV headers from ${url}:`, error.message)
    throw error
  }
}

// Function to validate CSV headers
function validateCSVHeaders(sourceName, expectedHeaders, actualHeaders) {
  const missingHeaders = expectedHeaders.filter(header => !actualHeaders.includes(header))
  const extraHeaders = actualHeaders.filter(header => !expectedHeaders.includes(header))

  return {
    isValid: missingHeaders.length === 0 && extraHeaders.length === 0,
    missingHeaders,
    extraHeaders
  }
}

// Main test function
async function testCSVHeaders() {
  console.log('🔍 Testing CSV Header Validation...')
  
  // Expected headers for each data source
  const expectedHeaders = {
    'TBL_SiteDetails': ['Version Number', 'Version Release Details', 'Updates To Come', 'Last Updated Stats', 'Page Details Last Refreshed', 'Current Season', 'Stat Limitations', 'Stat Details'],
    'TBL_Players': ['PLAYER NAME', 'ALLOW ON SITE', 'MOST PLAYED FOR TEAM', 'MOST COMMON POSITION'],
    'TBL_FixturesAndResults': ['SEASON FIX ID', 'DATE', 'TEAM', 'COMP TYPE', 'COMPETITION', 'OPPOSITION', 'HOME/AWAY', 'RESULT', 'HOME SCORE', 'AWAY SCORE', 'STATUS', 'OPPO OWN GOALS', 'FULL RESULT', 'DORKINIANS GOALS', 'CONCEDED'],
    'TBL_MatchDetails': ['TEAM', 'PLAYER NAME', 'DATE', 'MIN', 'CLASS', 'MOM', 'G', 'A', 'Y', 'R', 'SAVES', 'OG', 'PSC', 'PM', 'PCO', 'PSV'],
    'TBL_WeeklyTOTW': ['SEASONWEEKNUMREF', 'TOTW SCORE', 'PLAYER COUNT', 'STAR MAN', 'STAR MAN SCORE', 'GK1', 'DEF1', 'DEF2', 'DEF3', 'DEF4', 'DEF5', 'MID1', 'MID2', 'MID3', 'MID4', 'MID5', 'FWD1', 'FWD2', 'FWD3'],
    'TBL_SeasonTOTW': ['DATE LOOKUP', 'TOTW SCORE', 'STAR MAN', 'STAR MAN SCORE', 'GK1', 'DEF1', 'DEF2', 'DEF3', 'DEF4', 'DEF5', 'MID1', 'MID2', 'MID3', 'MID4', 'MID5', 'FWD1', 'FWD2', 'FWD3'],
    'TBL_PlayersOfTheMonth': ['SEASONMONTHREF', '#1 Name', '#1 Points', '#2 Name', '#2 Points', '#3 Name', '#3 Points', '#4 Name', '#4 Points', '#5 Name', '#5 Points'],
    'TBL_OppositionDetails': ['OPPOSITION', 'SHORT TEAM NAME', 'ADDRESS', 'DISTANCE (MILES)'],
    'TBL_CaptainsAndAwards': ['Item', 'HTML ID', '2016/17', '2017/18', '2018/19', '2019/20', '2020/21', '2021/22', '2022/23', '2023/24', '2024/25', '2025/26', '2026/27']
  }
  
  const results = []
  let totalSources = 0
  let validSources = 0
  let failedSources = 0

  for (const [sourceName, headers] of Object.entries(expectedHeaders)) {
    totalSources++
    console.log(`\n📊 Testing ${sourceName}...`)
    
    try {
      const url = dataSourceUrls[sourceName]
      
      const actualHeaders = await fetchCSVHeaders(url)
      const validation = validateCSVHeaders(sourceName, headers, actualHeaders)
      
      if (validation.isValid) {
        console.log(`  ✅ Headers valid for ${sourceName}`)
        validSources++
      } else {
        console.error(`  ❌ Header validation failed for ${sourceName}`)
        console.error(`     Expected: ${headers.join(', ')}`)
        console.error(`     Actual:   ${actualHeaders.join(', ')}`)
        console.error(`     Missing:  ${validation.missingHeaders.join(', ') || 'None'}`)
        console.error(`     Extra:    ${validation.extraHeaders.join(', ') || 'None'}`)
        failedSources++
      }
      
      results.push({
        sourceName,
        expectedHeaders: headers,
        actualHeaders,
        validation,
        url
      })

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      console.error(`  ❌ Failed to validate headers for ${sourceName}:`, error.message)
      failedSources++
      
      const url = dataSourceUrls[sourceName]
      results.push({
        sourceName,
        expectedHeaders: headers,
        actualHeaders: [],
        validation: { isValid: false, missingHeaders: headers, extraHeaders: [] },
        url: url || 'N/A',
        error: error.message
      })
    }
  }

  // Summary
  console.log(`\n📊 CSV Header Validation Complete:`)
  console.log(`  Total Sources: ${totalSources}`)
  console.log(`  Valid Sources: ${validSources}`)
  console.log(`  Failed Sources: ${failedSources}`)
  console.log(`  Overall Result: ${failedSources === 0 ? '✅ PASSED' : '❌ FAILED'}`)

  // Check email configuration
  const emailConfig = {
    host: process.env.SMTP_SERVER,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_EMAIL_SECURE === 'true',
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM_EMAIL,
    to: process.env.SMTP_TO_EMAIL
  }

  console.log('\n🔍 Environment Variable Debug:')
  console.log(`  SMTP_SERVER: ${process.env.SMTP_SERVER || 'NOT SET'}`)
  console.log(`  SMTP_PORT: ${process.env.SMTP_PORT || 'NOT SET'}`)
  console.log(`  SMTP_EMAIL_SECURE: ${process.env.SMTP_EMAIL_SECURE || 'NOT SET'}`)
  console.log(`  SMTP_USERNAME: ${process.env.SMTP_USERNAME || 'NOT SET'}`)
  console.log(`  SMTP_PASSWORD: ${process.env.SMTP_PASSWORD ? 'SET (hidden)' : 'NOT SET'}`)
  console.log(`  SMTP_FROM_EMAIL: ${process.env.SMTP_FROM_EMAIL || 'NOT SET'}`)
  console.log(`  SMTP_TO_EMAIL: ${process.env.SMTP_TO_EMAIL || 'NOT SET'}`)

  // Check each required field individually
  const requiredFields = [
    { name: 'SMTP_SERVER', value: emailConfig.host },
    { name: 'SMTP_PORT', value: emailConfig.port },
    { name: 'SMTP_USERNAME', value: emailConfig.user },
    { name: 'SMTP_PASSWORD', value: emailConfig.pass },
    { name: 'SMTP_FROM_EMAIL', value: emailConfig.from },
    { name: 'SMTP_TO_EMAIL', value: emailConfig.to }
  ]

  const missingFields = requiredFields.filter(field => !field.value)
  const isEmailConfigured = missingFields.length === 0
  
  if (isEmailConfigured) {
    console.log('\n📧 Email service configuration detected')
    console.log(`  SMTP Server: ${emailConfig.host}:${emailConfig.port}`)
    console.log(`  From: ${emailConfig.from}`)
    console.log(`  To: ${emailConfig.to}`)
  } else {
    console.log('\n⚠️ Email service not fully configured')
    console.log('   Required environment variables: SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_TO_EMAIL')
    console.log(`   Missing variables: ${missingFields.map(f => f.name).join(', ')}`)
  }

  // Prepare enhanced email summary if there are failures
  if (failedSources > 0 && isEmailConfigured) {
    console.log(`\n📧 Preparing enhanced email notification:`)
    
    // Separate header validation failures from access failures
    const headerFailures = results.filter(r => !r.validation.isValid && !r.error)
    const accessFailures = results.filter(r => r.error)
    
    console.log(`  Header Validation Failures: ${headerFailures.length}`)
    console.log(`  Access Failures: ${accessFailures.length}`)
    
    // Convert results to the expected format for email
    const failures = results
      .filter(r => !r.validation.isValid)
      .map(r => ({
        sourceName: r.sourceName,
        expectedHeaders: r.expectedHeaders,
        actualHeaders: r.actualHeaders,
        missingHeaders: r.validation.missingHeaders,
        extraHeaders: r.validation.extraHeaders,
        url: r.url,
        error: r.error
      }))

    console.log('📧 Enhanced email would include detailed failure analysis')
    console.log('  (Email sending requires the full application to be running)')
  }

  return {
    isValid: failedSources === 0,
    totalSources,
    validSources,
    failedSources,
    results,
    hasAccessFailures: results.some(r => r.error),
    hasHeaderFailures: results.some(r => !r.validation.isValid && !r.error)
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testCSVHeaders()
    .then(result => {
      console.log('\n🏁 Test completed')
      process.exit(result.isValid ? 0 : 1)
    })
    .catch(error => {
      console.error('❌ Test failed:', error)
      process.exit(1)
    })
}

module.exports = { testCSVHeaders }
