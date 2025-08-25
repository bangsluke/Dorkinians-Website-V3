const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };
    
    // Handle preflight request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    try {
        console.log('🔍 Testing email in Netlify function...');
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
            const errorMsg = `Missing required email environment variables: ${missingVars.join(', ')}`;
            console.error('❌', errorMsg);
            
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: errorMsg,
                    missingVariables: missingVars,
                    details: 'Add these variables to your Netlify environment variables'
                })
            };
        }
        
        console.log('✅ All required environment variables are set');
        console.log('');
        
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
            subject: '🧪 Netlify Function Test Email - Dorkinians Website',
            text: 'This is a test email from Netlify function to verify SMTP configuration.',
            html: `
                <h1>🧪 Netlify Function Test Email</h1>
                <p>This is a test email from Netlify function to verify SMTP configuration is working correctly.</p>
                <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Environment:</strong> Netlify Function</p>
                <p><strong>SMTP Server:</strong> ${process.env.SMTP_SERVER}</p>
                <p><strong>From:</strong> ${process.env.SMTP_FROM_EMAIL}</p>
                <p><strong>To:</strong> ${process.env.SMTP_TO_EMAIL}</p>
                <hr>
                <p><em>If you receive this email, your SMTP configuration is working in Netlify!</em></p>
            `
        });
        
        console.log('✅ Test email sent successfully!');
        console.log('📧 Message ID:', info.messageId);
        console.log('📧 Response:', info.response);
        console.log('');
        console.log('🎉 Email configuration is working correctly in Netlify!');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Test email sent successfully from Netlify function',
                messageId: info.messageId,
                response: info.response,
                timestamp: new Date().toISOString(),
                environment: 'Netlify Function'
            })
        };
        
    } catch (error) {
        console.error('❌ Email test failed:');
        console.error('Error:', error.message);
        console.error('Code:', error.code);
        console.error('');
        
        let errorDetails = 'Unknown error occurred';
        
        if (error.code === 'EAUTH') {
            errorDetails = 'Authentication failed - check username and password';
        } else if (error.code === 'ECONNECTION') {
            errorDetails = 'Connection failed - check SMTP server and port';
        } else if (error.code === 'ETIMEDOUT') {
            errorDetails = 'Connection timeout - check network and SMTP server';
        } else if (error.message) {
            errorDetails = error.message;
        }
        
        console.error('📋 Full error details:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: errorDetails,
                errorCode: error.code,
                details: 'Check Netlify function logs for more information',
                timestamp: new Date().toISOString()
            })
        };
    }
};
