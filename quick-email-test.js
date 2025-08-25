require('dotenv').config();

console.log('🔍 Quick Environment Variables Check');
console.log('=====================================');

const vars = [
    'SMTP_SERVER',
    'SMTP_PORT', 
    'SMTP_EMAIL_SECURE',
    'SMTP_USERNAME',
    'SMTP_PASSWORD',
    'SMTP_FROM_EMAIL',
    'SMTP_TO_EMAIL'
];

let allSet = true;

vars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅ SET' : '❌ NOT SET';
    const displayValue = varName === 'SMTP_PASSWORD' ? (value ? '***HIDDEN***' : 'NOT SET') : (value || 'NOT SET');
    
    console.log(`${status} ${varName}: ${displayValue}`);
    
    if (!value) allSet = false;
});

console.log('=====================================');

if (allSet) {
    console.log('🎉 All email environment variables are set!');
    console.log('💡 You can now run: node test-email.js');
} else {
    console.log('❌ Some email environment variables are missing');
    console.log('💡 Check your .env file and restart the terminal');
    console.log('📋 Template available in: email-config-template.env');
}
