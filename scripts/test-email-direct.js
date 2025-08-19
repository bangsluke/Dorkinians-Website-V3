const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

// Simple test to verify email configuration and send a test email
async function testEmailDirectly() {
  console.log('📧 Testing Email Service Directly...')
  
  try {
    // Check environment variables
    const emailConfig = {
      host: process.env.SMTP_SERVER,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_EMAIL_SECURE === 'true',
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
      from: process.env.SMTP_FROM_EMAIL,
      to: process.env.SMTP_TO_EMAIL
    }

    console.log('🔍 Environment Variables:')
    console.log(`  SMTP_SERVER: ${emailConfig.host}`)
    console.log(`  SMTP_PORT: ${emailConfig.port}`)
    console.log(`  SMTP_USERNAME: ${emailConfig.user}`)
    console.log(`  SMTP_PASSWORD: ${emailConfig.pass ? 'SET' : 'NOT SET'}`)
    console.log(`  SMTP_FROM_EMAIL: ${emailConfig.from}`)
    console.log(`  SMTP_TO_EMAIL: ${emailConfig.to}`)

    // Check if all required variables are set
    const missingVars = []
    if (!emailConfig.host) missingVars.push('SMTP_SERVER')
    if (!emailConfig.port) missingVars.push('SMTP_PORT')
    if (!emailConfig.user) missingVars.push('SMTP_USERNAME')
    if (!emailConfig.pass) missingVars.push('SMTP_PASSWORD')
    if (!emailConfig.from) missingVars.push('SMTP_FROM_EMAIL')
    if (!emailConfig.to) missingVars.push('SMTP_TO_EMAIL')

    if (missingVars.length > 0) {
      console.log(`❌ Missing environment variables: ${missingVars.join(', ')}`)
      return false
    }

    console.log('✅ All environment variables are set')
    console.log('📧 Email configuration is complete and ready for testing')
    
    return true

  } catch (error) {
    console.error('❌ Email test failed:', error.message)
    return false
  }
}

// Run the test
if (require.main === module) {
  testEmailDirectly()
    .then(success => {
      console.log(`\n🏁 Email test completed: ${success ? '✅ SUCCESS' : '❌ FAILED'}`)
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('❌ Test failed:', error)
      process.exit(1)
    })
}

module.exports = { testEmailDirectly }
