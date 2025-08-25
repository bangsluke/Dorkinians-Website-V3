const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
    console.log('🔍 Testing email configuration...');
    console.log('=====================================');
    
    // Log environment variables (mask password)
    console.log('📧 Environment Variables:');
    console.log('SMTP_SERVER:', process.env.SMTP_SERVER || 'NOT SET');
    console.log('SMTP_PORT:', process.env.SMTP_PORT || 'NOT SET');
    console.log('SMTP_EMAIL_SECURE:', process.env.SMTP_EMAIL_SECURE || 'NOT SET');
    console.log('SMTP_USERNAME:', process.env.SMTP_USERNAME || 'NOT SET');
    console.log('SMTP_FROM_EMAIL:', process.env.SMTP_FROM_EMAIL || 'NOT SET');
    console.log('SMTP_TO_EMAIL:', process.env.SMTP_TO_EMAIL || 'NOT SET');
    console.log('SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '***SET***' : 'NOT SET');
    console.log('');
    
    // Check for missing variables
    const missingVars = [];
    if (!process.env.SMTP_SERVER) missingVars.push('SMTP_SERVER');
    if (!process.env.SMTP_USERNAME) missingVars.push('SMTP_USERNAME');
    if (!process.env.SMTP_PASSWORD) missingVars.push('SMTP_PASSWORD');
    if (!process.env.SMTP_FROM_EMAIL) missingVars.push('SMTP_FROM_EMAIL');
    if (!process.env.SMTP_TO_EMAIL) missingVars.push('SMTP_TO_EMAIL');
    
    if (missingVars.length > 0) {
        console.error('❌ Missing required email environment variables:');
        missingVars.forEach(varName => console.error(`   - ${varName}`));
        console.error('');
        console.error('💡 Add these to your .env file and restart the terminal');
        return;
    }
    
    console.log('✅ All required environment variables are set');
    console.log('');
    
    try {
        console.log('🔧 Creating email transporter...');
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_SERVER,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_EMAIL_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USERNAME,
                pass: process.env.SMTP_PASSWORD
            },
            tls: {
                rejectUnauthorized: false,
                checkServerIdentity: () => undefined
            }
        });
        
        console.log('✅ Transporter created successfully');
        console.log('');
        
        console.log('🔐 Testing SMTP connection...');
        await transporter.verify();
        console.log('✅ SMTP connection verified successfully');
        console.log('');
        
        console.log('📤 Sending test email...');
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM_EMAIL,
            to: process.env.SMTP_TO_EMAIL,
            subject: '🧪 Test Email - Dorkinians Website',
            text: 'This is a test email to verify SMTP configuration is working correctly.',
            html: `
                <h1>🧪 Test Email - Dorkinians Website</h1>
                <p>This is a test email to verify SMTP configuration is working correctly.</p>
                <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>SMTP Server:</strong> ${process.env.SMTP_SERVER}</p>
                <p><strong>From:</strong> ${process.env.SMTP_FROM_EMAIL}</p>
                <p><strong>To:</strong> ${process.env.SMTP_TO_EMAIL}</p>
                <hr>
                <p><em>If you receive this email, your SMTP configuration is working!</em></p>
            `
        });
        
        console.log('✅ Test email sent successfully!');
        console.log('📧 Message ID:', info.messageId);
        console.log('📧 Response:', info.response);
        console.log('');
        console.log('🎉 Email configuration is working correctly!');
        console.log('💡 You can now proceed with testing the Netlify function');
        
    } catch (error) {
        console.error('❌ Email test failed:');
        console.error('Error:', error.message);
        console.error('');
        
        if (error.code === 'EAUTH') {
            console.error('🔐 Authentication failed. Check:');
            console.error('   - Username and password are correct');
            console.error('   - For Gmail: Use App Password, not regular password');
            console.error('   - 2-factor authentication is enabled (for Gmail)');
        } else if (error.code === 'ECONNECTION') {
            console.error('🌐 Connection failed. Check:');
            console.error('   - SMTP server address is correct');
            console.error('   - Port number is correct');
            console.error('   - Firewall/ISP is not blocking the connection');
        } else if (error.code === 'ETIMEDOUT') {
            console.error('⏰ Connection timeout. Check:');
            console.error('   - Internet connection is stable');
            console.error('   - SMTP server is responding');
        }
        
        console.error('');
        console.error('📋 Full error details:', error);
    }
}

// Run the test
testEmail();
