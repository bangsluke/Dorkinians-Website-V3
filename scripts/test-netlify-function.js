#!/usr/bin/env node

/**
 * Test script for Netlify function debugging
 * Run this to test the function logic without the full Netlify environment
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('🧪 Testing Netlify Function Logic...\n');

// Test 1: Check environment variables
console.log('📋 Environment Variables Check:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
console.log(`PROD_NEO4J_URI: ${process.env.PROD_NEO4J_URI ? 'SET' : 'NOT SET'}`);
console.log(`PROD_NEO4J_USER: ${process.env.PROD_NEO4J_USER ? 'SET' : 'NOT SET'}`);
console.log(`PROD_NEO4J_PASSWORD: ${process.env.PROD_NEO4J_PASSWORD ? 'SET' : 'NOT SET'}`);
console.log(`EMAIL_HOST: ${process.env.EMAIL_HOST ? 'SET' : 'NOT SET'}`);
console.log(`EMAIL_USER: ${process.env.EMAIL_USER ? 'SET' : 'NOT SET'}`);
console.log(`EMAIL_PASS: ${process.env.EMAIL_PASS ? 'SET' : 'NOT SET'}\n`);

// Test 2: Check if required files exist
console.log('📁 File Existence Check:');
const requiredFiles = [
	'../lib/services/dataSeederService.ts',
	'../lib/services/emailService.ts',
	'../lib/neo4j.ts'
];

for (const file of requiredFiles) {
	const fullPath = path.join(__dirname, file);
	const fs = require('fs');
	const exists = fs.existsSync(fullPath);
	console.log(`${file}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
}
console.log('');

// Test 3: Check if lib directory was copied for Netlify Functions
console.log('🔌 Netlify Functions Lib Check:');
try {
	const netlifyLibPath = path.join(__dirname, '..', 'netlify', 'functions', 'lib');
	const dataSeederPath = path.join(netlifyLibPath, 'services', 'dataSeederService.ts');
	const emailServicePath = path.join(netlifyLibPath, 'services', 'emailService.ts');
	const neo4jPath = path.join(netlifyLibPath, 'neo4j.ts');
	
	const fs = require('fs');
	
	if (fs.existsSync(netlifyLibPath)) {
		console.log('✅ Netlify functions lib directory exists');
	} else {
		console.log('❌ Netlify functions lib directory missing - run "npm run build:lib" first');
	}
	
	if (fs.existsSync(dataSeederPath)) {
		console.log('✅ dataSeederService.ts copied to netlify/functions/lib');
	} else {
		console.log('❌ dataSeederService.ts not copied - run "npm run build:lib" first');
	}
	
	if (fs.existsSync(emailServicePath)) {
		console.log('✅ emailService.ts copied to netlify/functions/lib');
	} else {
		console.log('❌ emailService.ts not copied - run "npm run build:lib" first');
	}
	
	if (fs.existsSync(neo4jPath)) {
		console.log('✅ neo4j.ts copied to netlify/functions/lib');
	} else {
		console.log('❌ neo4j.ts not copied - run "npm run build:lib" first');
	}
	
} catch (error) {
	console.log('❌ Service import failed:', error.message);
	console.log('💡 This might indicate a build or dependency issue');
}

// Test 5: Check if build is needed
console.log('\n🔨 Build Status Check:');
const buildPath = path.join(__dirname, '..', '.next');
if (require('fs').existsSync(buildPath)) {
	console.log('✅ Next.js build exists (.next directory found)');
} else {
	console.log('❌ Next.js build missing - run "npm run build" first');
}

console.log('\n🎯 Test Summary:');
if (process.env.PROD_NEO4J_URI && process.env.PROD_NEO4J_USER && process.env.PROD_NEO4J_PASSWORD) {
	console.log('✅ Neo4j credentials are configured');
} else {
	console.log('❌ Neo4j credentials are missing - check your .env file');
}

if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
	console.log('✅ Email configuration is complete');
} else {
	console.log('❌ Email configuration is incomplete - check your .env file');
}

console.log('\n💡 Next steps:');
console.log('1. ✅ Run "npm run build" to compile the project');
console.log('2. ✅ Run "npm run build:lib" to prepare for Netlify Functions');
console.log('3. ✅ Deploy to Netlify (automatic on git push)');
console.log('4. ✅ Set environment variables in Netlify Dashboard');
console.log('5. ✅ Test the deployed function');
console.log('6. ✅ Set up external cron job (cron-job.org)');
