#!/usr/bin/env node

/**
 * E2E Test Runner Script for Cron Jobs
 * 
 * This script runs the Playwright E2E test suite and handles:
 * - Headless execution
 * - Test report generation
 * - Exit code handling for cron job notifications
 * - Screenshot capture on failure (configured in playwright.config.ts)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://dorkinians-website-v3.netlify.app';
const HEADLESS = process.env.HEADLESS !== 'false';

console.log('🚀 Starting E2E Test Suite');
console.log(`📍 Base URL: ${BASE_URL}`);
console.log(`🎭 Headless: ${HEADLESS}`);
console.log('');

// Ensure test-results directory exists
const testResultsDir = path.join(process.cwd(), 'test-results');
const screenshotsDir = path.join(testResultsDir, 'screenshots');
if (!fs.existsSync(testResultsDir)) {
	fs.mkdirSync(testResultsDir, { recursive: true });
}
if (!fs.existsSync(screenshotsDir)) {
	fs.mkdirSync(screenshotsDir, { recursive: true });
}

try {
	// Run Playwright tests
	const command = `npx playwright test ${HEADLESS ? '--headed=false' : ''}`;
	console.log(`📝 Executing: ${command}`);
	console.log('');

	const result = execSync(command, {
		stdio: 'inherit',
		env: {
			...process.env,
			BASE_URL,
		},
		cwd: process.cwd(),
	});

	console.log('');
	console.log('✅ All tests passed!');
	console.log(`📊 View report: npm run test:e2e:report`);
	
	process.exit(0);
} catch (error) {
	console.error('');
	console.error('❌ Test suite failed!');
	console.error('');
	
	// Check if test results exist
	const reportDir = path.join(process.cwd(), 'playwright-report');
	if (fs.existsSync(reportDir)) {
		console.error(`📊 Test report available at: ${reportDir}`);
		console.error(`📊 View report: npm run test:e2e:report`);
	}
	
	// Check for screenshots
	const screenshots = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
	if (screenshots.length > 0) {
		console.error(`📸 ${screenshots.length} screenshot(s) captured on failure`);
		console.error(`📸 Screenshots: ${screenshotsDir}`);
	}
	
	console.error('');
	console.error('Exit code: 1');
	
	// Exit with non-zero code for cron job notification
	process.exit(1);
}
