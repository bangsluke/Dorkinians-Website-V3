const path = require('path')
const nodemailer = require('nodemailer')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function testEmailSending() {
  console.log('📧 Testing Email Sending Functionality...')
  
  try {
    // Create transporter directly with nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_SERVER,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_EMAIL_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
      },
      tls: {
        rejectUnauthorized: false // For development/testing
      }
    })

    console.log('🔧 Transporter created, testing connection...')
    
    // Test connection
    await transporter.verify()
    console.log('✅ SMTP connection verified successfully')

    // Send test email
    const testMailOptions = {
      from: process.env.SMTP_FROM_EMAIL,
      to: process.env.SMTP_TO_EMAIL,
      subject: '🧪 Test Email - CSV Header Validation System',
      html: `
        <h2>🧪 Test Email - CSV Header Validation System</h2>
        <p>This is a test email to verify the email service is working correctly.</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p><strong>Purpose:</strong> Testing email functionality for CSV header validation failures</p>
        
        <h3>📊 Test Results:</h3>
        <ul>
          <li>✅ SMTP Connection: Working</li>
          <li>✅ Email Configuration: Complete</li>
          <li>✅ Transporter: Created Successfully</li>
        </ul>
        
        <p>If you receive this email, the CSV header validation email system is ready to send notifications.</p>
        
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is a test email from the Dorkinians FC database seeding system.
        </p>
      `,
      text: `
Test Email - CSV Header Validation System

This is a test email to verify the email service is working correctly.

Time: ${new Date().toISOString()}
Purpose: Testing email functionality for CSV header validation failures

Test Results:
- SMTP Connection: Working
- Email Configuration: Complete  
- Transporter: Created Successfully

If you receive this email, the CSV header validation email system is ready to send notifications.

---
This is a test email from the Dorkinians FC database seeding system.
      `
    }

    console.log('📤 Sending test email...')
    const info = await transporter.sendMail(testMailOptions)
    
    console.log('✅ Test email sent successfully!')
    console.log(`📧 Message ID: ${info.messageId}`)
    console.log(`📤 From: ${process.env.SMTP_FROM_EMAIL}`)
    console.log(`📥 To: ${process.env.SMTP_TO_EMAIL}`)
    
    return true

  } catch (error) {
    console.error('❌ Email sending test failed:', error.message)
    
    if (error.code === 'EAUTH') {
      console.error('🔐 Authentication failed - check SMTP_USERNAME and SMTP_PASSWORD')
    } else if (error.code === 'ECONNECTION') {
      console.error('🌐 Connection failed - check SMTP_SERVER and SMTP_PORT')
    } else if (error.code === 'ETIMEDOUT') {
      console.error('⏰ Connection timeout - check network and firewall settings')
    }
    
    return false
  }
}

// Run the test
if (require.main === module) {
  testEmailSending()
    .then(success => {
      console.log(`\n🏁 Email sending test completed: ${success ? '✅ SUCCESS' : '❌ FAILED'}`)
      if (success) {
        console.log('📧 Check your email inbox for the test message')
      }
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('❌ Test failed:', error)
      process.exit(1)
    })
}

module.exports = { testEmailSending }
