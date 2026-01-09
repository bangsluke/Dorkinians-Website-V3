#!/usr/bin/env node

/**
 * E2E Test Email Report Script
 * Runs E2E tests and sends email notification with results
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Load environment variables
require('dotenv').config();

// Use WEBSITE_URL (available in Netlify) or fallback to BASE_URL for backward compatibility
const BASE_URL = process.env.WEBSITE_URL || process.env.BASE_URL || 'https://dorkinians-website-v3.netlify.app';
const HEADLESS = process.env.HEADLESS !== 'false';

// Email configuration
const getEmailConfig = () => {
	const host = process.env.SMTP_SERVER;
	const port = process.env.SMTP_PORT;
	const user = process.env.SMTP_USERNAME;
	const pass = process.env.SMTP_PASSWORD;
	const from = process.env.SMTP_FROM_EMAIL;
	const to = process.env.SMTP_TO_EMAIL;

	if (!host || !port || !user || !pass || !from || !to) {
		return null;
	}

	return {
		host,
		port: parseInt(port, 10),
		secure: process.env.SMTP_EMAIL_SECURE === 'true',
		auth: {
			user,
			pass,
		},
		from,
		to,
	};
};

// Ensure directories exist
const testResultsDir = path.join(process.cwd(), '__tests__', 'e2e', 'test-results');
const screenshotsDir = path.join(testResultsDir, 'screenshots');
const reportDir = path.join(process.cwd(), '__tests__', 'e2e', 'playwright-report');

if (!fs.existsSync(testResultsDir)) {
	fs.mkdirSync(testResultsDir, { recursive: true });
}
if (!fs.existsSync(screenshotsDir)) {
	fs.mkdirSync(screenshotsDir, { recursive: true });
}

console.log('🚀 Starting E2E Test Suite with Email Report');
console.log(`📍 Base URL: ${BASE_URL}`);
console.log(`🎭 Headless: ${HEADLESS}`);
console.log('');

let testPassed = false;
let testOutput = '';
let exitCode = 1;

// Run Playwright tests using spawn for real-time output streaming
const startTime = Date.now();
let stdoutBuffer = '';
let stderrBuffer = '';
let lastTestLine = '';
let lastActivityTime = Date.now();

// Parse command arguments
const commandArgs = ['playwright', 'test'];
if (!HEADLESS) {
	commandArgs.push('--headed');
}

console.log(`📝 Executing: npx ${commandArgs.join(' ')}`);
console.log('');

// Spawn process with real-time output
const child = spawn('npx', commandArgs, {
	stdio: ['inherit', 'pipe', 'pipe'],
	env: {
		...process.env,
		BASE_URL,
	},
	cwd: process.cwd(),
	shell: true,
});

// Stream stdout to console and buffer
child.stdout.on('data', (data) => {
	const text = data.toString();
	stdoutBuffer += text;
	process.stdout.write(text); // Real-time to GitHub Actions
	
	// Extract last meaningful line for heartbeat
	const lines = text.split('\n').filter(line => line.trim());
	if (lines.length > 0) {
		const meaningfulLine = lines[lines.length - 1];
		// Only update if it looks like test output (not just whitespace or control chars)
		if (meaningfulLine.match(/[✓✗›]/) || meaningfulLine.match(/Running|Test|passed|failed/i)) {
			lastTestLine = meaningfulLine.trim();
			lastActivityTime = Date.now();
		}
	}
});

// Stream stderr to console and buffer
child.stderr.on('data', (data) => {
	const text = data.toString();
	stderrBuffer += text;
	process.stderr.write(text); // Real-time to GitHub Actions
	lastActivityTime = Date.now();
});

// Heartbeat logging every 30 seconds
const heartbeatInterval = setInterval(() => {
	const elapsed = Math.floor((Date.now() - startTime) / 1000);
	const minutes = Math.floor(elapsed / 60);
	const seconds = elapsed % 60;
	const timeSinceActivity = Math.floor((Date.now() - lastActivityTime) / 1000);
	
	console.log(`\n[HEARTBEAT ${minutes}m ${seconds}s] Tests still running...`);
	
	if (lastTestLine) {
		console.log(`[HEARTBEAT] Last activity: ${lastTestLine.substring(0, 100)}${lastTestLine.length > 100 ? '...' : ''}`);
	}
	
	if (timeSinceActivity > 60) {
		console.log(`[HEARTBEAT] ⚠️ No output for ${Math.floor(timeSinceActivity / 60)}m ${timeSinceActivity % 60}s - tests may be stuck`);
	}
	
	// Timeout warnings
	if (elapsed >= 3000) { // 50 minutes
		console.log(`[HEARTBEAT] ⚠️ WARNING: Tests running for ${minutes} minutes, 5 minutes remaining before timeout`);
	} else if (elapsed >= 2400) { // 40 minutes
		console.log(`[HEARTBEAT] ⚠️ WARNING: Tests running for ${minutes} minutes, 15 minutes remaining before timeout`);
	}
}, 30000);

// Handle process completion
child.on('close', (code) => {
	clearInterval(heartbeatInterval);
	
	// Combine all output
	testOutput = stdoutBuffer + (stderrBuffer ? '\n' + stderrBuffer : '');
	
	if (code === 0) {
		testPassed = true;
		exitCode = 0;
		console.log('');
		console.log('✅ All tests passed!');
	} else {
		testPassed = false;
		exitCode = code || 1;
		console.error('');
		console.error('❌ Test suite failed!');
	}
	
	// Continue with email sending
	processTestResults();
});

// Handle process errors
child.on('error', (error) => {
	clearInterval(heartbeatInterval);
	testOutput = error.message || 'Test execution failed';
	testPassed = false;
	exitCode = 1;
	console.error('❌ Failed to start test process:', error.message);
	processTestResults();
});

// Function to process test results and send email
function processTestResults() {
	sendEmailReport()
		.then(() => {
			process.exit(exitCode);
		})
		.catch((error) => {
			console.error('❌ Error sending email report:', error);
			process.exit(exitCode);
		});
}

// Normalize suite name to match documentation sections
const normalizeSuiteName = (suiteName) => {
	const mapping = {
		'Navigation Tests': 'Navigation Tests',
		'Home Page Tests': 'Home Page Tests',
		'Stats Page Tests': 'Stats Page Tests',
		'TOTW Page Tests': 'TOTW Page Tests',
		'Club Info Page Tests': 'Club Info Page Tests',
		'Settings Page Tests': 'Settings Page Tests',
		'API Endpoint Tests': 'API Endpoint Tests',
		'Cross-Cutting Tests': 'Cross-Cutting Tests',
	};
	return mapping[suiteName] || suiteName;
};

// Extract failure reason from test output
const extractFailureReason = (testOutput, testLineIndex, lines) => {
	if (!lines || testLineIndex === undefined) return 'Failed (see raw output for details)';
	
	// Look ahead in the output for error messages
	for (let i = testLineIndex + 1; i < Math.min(testLineIndex + 20, lines.length); i++) {
		const line = lines[i];
		
		// Skip empty lines and next test results
		if (!line.trim() || line.match(/^\s*[✓✗]/)) {
			continue;
		}
		
		// Check for timeout
		if (line.match(/timeout|Timeout|exceeded/i)) {
			const timeoutMatch = line.match(/timeout.*?(\d+)\s*(?:ms|s|milliseconds?|seconds?)/i);
			if (timeoutMatch) {
				return `Failed due to timeout (${timeoutMatch[1]}${timeoutMatch[1].includes('ms') ? 'ms' : 's'})`;
			}
			return 'Failed due to timeout';
		}
		
		// Check for assertion errors
		if (line.match(/AssertionError|expect|assert/i)) {
			const errorMatch = line.match(/(?:AssertionError|Error):\s*(.+)/i);
			if (errorMatch) {
				return `Failed: ${errorMatch[1].substring(0, 100)}${errorMatch[1].length > 100 ? '...' : ''}`;
			}
			return 'Failed: Assertion error';
		}
		
		// Check for generic errors
		if (line.match(/Error:|Exception:/i)) {
			const errorMatch = line.match(/(?:Error|Exception):\s*(.+)/i);
			if (errorMatch) {
				return `Failed: ${errorMatch[1].substring(0, 100)}${errorMatch[1].length > 100 ? '...' : ''}`;
			}
		}
		
		// Check for element not found
		if (line.match(/not found|not visible|not attached|element.*not/i)) {
			return 'Failed: Element not found';
		}
		
		// If we find an error-like line, use it
		if (line.trim().length > 0 && !line.match(/^\s*at\s+/)) {
			const cleanLine = line.trim().substring(0, 150);
			if (cleanLine.length > 0) {
				return `Failed: ${cleanLine}${line.trim().length > 150 ? '...' : ''}`;
			}
		}
	}
	
	return 'Failed (see raw output for details)';
};

// Parse test results by suite (matching documentation sections)
const parseTestResults = () => {
	const testResults = {};
	const lines = testOutput.split('\n');
	let parsedCount = 0;
	let failedCount = 0;
	let passedCount = 0;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		
		// Match test result lines: ✓ or ✗ or ✘ followed by worker number, [chromium], file path, suite, and test name
		// Format: "  ✓    2 [chromium] › e2e\api\api.spec.ts:29:6 › API Endpoint Tests › should return TOTW data from TOTW API (2.7s)"
		// Format: "  ✗    1 [chromium] › e2e\api\api.spec.ts:6:6 › API Endpoint Tests › should respond to chatbot API query (4.0s)"
		// Also handles forward slashes: "  ✓ e2e/api/api.spec.ts:29:6 › API Endpoint Tests › should return TOTW data from TOTW API (2.7s)"
		// Fallback pattern without worker number and [chromium] tag for some output formats
		let testMatch = line.match(/^\s*([✓✗✘×])\s+\d+\s+\[chromium\]\s+›\s+([^:]+):\d+:\d+\s+›\s+(.+?)\s+›\s+(.+?)\s+\(([\d.]+)s\)/);
		
		// Fallback: try without worker number and [chromium] tag
		if (!testMatch) {
			testMatch = line.match(/^\s*([✓✗✘×])\s+([^:]+):\d+:\d+\s+›\s+(.+?)\s+›\s+(.+?)\s+\(([\d.]+)s\)/);
		}
		
		// Additional fallback: try matching lines that might have different spacing
		if (!testMatch) {
			testMatch = line.match(/^\s*([✓✗✘×])\s+.*?\[chromium\].*?›\s+([^:]+):\d+:\d+\s+›\s+(.+?)\s+›\s+(.+?)\s+\(([\d.]+)s\)/);
		}
		
		if (testMatch) {
			const statusIcon = testMatch[1];
			const status = statusIcon === '✓' ? 'passed' : 'failed';
			const filePath = testMatch[2].trim();
			const suite = normalizeSuiteName(testMatch[3].trim());
			const testName = testMatch[4].trim();
			const duration = parseFloat(testMatch[5]);
			
			parsedCount++;
			if (status === 'passed') {
				passedCount++;
			} else {
				failedCount++;
			}
			
			// Extract failure reason if test failed
			let failureReason = null;
			if (status === 'failed') {
				failureReason = extractFailureReason(testOutput, i, lines);
			}
			
			if (!testResults[suite]) {
				testResults[suite] = {
					suite: suite,
					tests: [],
					passed: 0,
					failed: 0,
				};
			}
			
			testResults[suite].tests.push({
				name: testName,
				status,
				duration,
				failureReason,
				file: filePath,
			});
			
			if (status === 'passed') {
				testResults[suite].passed++;
			} else {
				testResults[suite].failed++;
			}
		}
	}
	
	// Debug logging
	if (parsedCount === 0) {
		console.warn('⚠️ No test results parsed. First 20 lines of output:');
		console.warn(lines.slice(0, 20).join('\n'));
	} else {
		console.log(`📊 Parsed ${parsedCount} tests (${passedCount} passed, ${failedCount} failed)`);
	}
	
	return testResults;
};

// Get test summary
const getTestSummary = () => {
	const summary = {
		passed: 0,
		failed: 0,
		skipped: 0,
		total: 0,
		duration: 0,
		passPercentage: 0,
	};

	// Try to parse test output for summary
	const passedMatch = testOutput.match(/(\d+)\s+passed/i);
	const failedMatch = testOutput.match(/(\d+)\s+failed/i);
	const skippedMatch = testOutput.match(/(\d+)\s+skipped/i);
	const durationMatch = testOutput.match(/(\d+\.?\d*)\s*(?:s|seconds?|ms|milliseconds?)/i);

	if (passedMatch) summary.passed = parseInt(passedMatch[1], 10);
	if (failedMatch) summary.failed = parseInt(failedMatch[1], 10);
	if (skippedMatch) summary.skipped = parseInt(skippedMatch[1], 10);
	if (durationMatch) summary.duration = parseFloat(durationMatch[1]);

	summary.total = summary.passed + summary.failed + summary.skipped;
	
	// Calculate pass percentage
	if (summary.total > 0) {
		summary.passPercentage = ((summary.passed / summary.total) * 100).toFixed(1);
	}

	return summary;
};

// Get screenshot list
const getScreenshots = () => {
	if (!fs.existsSync(screenshotsDir)) {
		return [];
	}
	
	const files = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
	return files.map(f => path.join(screenshotsDir, f));
};

// Send email notification
const sendEmailReport = async () => {
	const emailConfig = getEmailConfig();
	
	if (!emailConfig) {
		console.warn('⚠️ Email configuration not available. Skipping email notification.');
		console.warn('   Required: SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_TO_EMAIL');
		return;
	}

	const summary = getTestSummary();
	const testResults = parseTestResults();
	const screenshots = getScreenshots();
	const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });

	const status = testPassed ? '✅ PASSED' : '❌ FAILED';
	const statusColor = testPassed ? '#28a745' : '#dc3545';

	// Generate test results HTML grouped by suite (matching documentation sections)
	const generateTestResultsHTML = () => {
		const suiteNames = Object.keys(testResults).sort();
		
		if (suiteNames.length === 0) {
			return '<p>No test results parsed. Check raw output below.</p>';
		}
		
		// Define order to match documentation
		const suiteOrder = [
			'Navigation Tests',
			'Home Page Tests',
			'Stats Page Tests',
			'TOTW Page Tests',
			'Club Info Page Tests',
			'Settings Page Tests',
			'API Endpoint Tests',
			'Cross-Cutting Tests',
		];
		
		// Sort suites by documentation order, then alphabetically for any extras
		const sortedSuites = suiteNames.sort((a, b) => {
			const aIndex = suiteOrder.indexOf(a);
			const bIndex = suiteOrder.indexOf(b);
			if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
			if (aIndex !== -1) return -1;
			if (bIndex !== -1) return 1;
			return a.localeCompare(b);
		});
		
		let html = '';
		
		for (const suiteName of sortedSuites) {
			const suiteData = testResults[suiteName];
			const suiteStatus = suiteData.failed === 0 ? 'passed' : 'failed';
			const suiteStatusColor = suiteStatus === 'passed' ? '#28a745' : '#dc3545';
			const suiteStatusIcon = suiteStatus === 'passed' ? '✅' : '❌';
			
			html += `
			<div class="suite-section">
				<div class="suite-header" style="background: ${suiteStatusColor};">
					<h3>${suiteStatusIcon} ${suiteName} - ${suiteData.passed} passed, ${suiteData.failed} failed</h3>
				</div>
				<div class="suite-tests">
					<ul class="test-list">
			`;
			
			for (const test of suiteData.tests) {
				const testStatusIcon = test.status === 'passed' ? '✓' : '✗';
				const testStatusColor = test.status === 'passed' ? '#28a745' : '#dc3545';
				const testStatusClass = test.status === 'passed' ? 'test-passed' : 'test-failed';
				
				html += `
					<li class="test-item ${testStatusClass}">
						<span class="test-icon" style="color: ${testStatusColor};">${testStatusIcon}</span>
						<div class="test-details">
							<div class="test-name">${test.name}</div>
							<div class="test-meta">
								<span class="test-duration">${test.duration.toFixed(1)}s</span>
								${test.failureReason ? `<span class="test-failure"> - ${test.failureReason}</span>` : ''}
							</div>
						</div>
					</li>
				`;
			}
			
			html += `
					</ul>
				</div>
			</div>
			`;
		}
		
		return html;
	};

	// Create HTML email
	const htmlContent = `
<!DOCTYPE html>
<html>
<head>
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
		.container { max-width: 900px; margin: 0 auto; padding: 20px; }
		.header { background: ${statusColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
		.content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
		.summary { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid ${statusColor}; }
		.summary-item { margin: 5px 0; }
		.label { font-weight: bold; }
		.suite-section { background: white; margin: 20px 0; border-radius: 5px; overflow: hidden; border: 1px solid #ddd; }
		.suite-header { color: white; padding: 15px 20px; }
		.suite-header h3 { margin: 0; font-size: 18px; }
		.suite-tests { padding: 15px 20px; }
		.test-list { list-style: none; padding: 0; margin: 0; }
		.test-item { display: flex; align-items: flex-start; padding: 10px; margin: 5px 0; border-radius: 4px; background: #f8f9fa; }
		.test-item.test-passed { background: #d4edda; border-left: 3px solid #28a745; }
		.test-item.test-failed { background: #f8d7da; border-left: 3px solid #dc3545; }
		.test-icon { font-size: 18px; margin-right: 10px; font-weight: bold; flex-shrink: 0; }
		.test-details { flex: 1; }
		.test-name { font-weight: 500; color: #333; margin-bottom: 3px; }
		.test-meta { font-size: 12px; color: #666; }
		.test-duration { color: #666; }
		.test-failure { color: #dc3545; font-style: italic; }
		.output { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 5px; font-family: 'Courier New', monospace; font-size: 11px; overflow-x: auto; white-space: pre-wrap; max-height: 400px; overflow-y: auto; }
		.screenshots { margin-top: 20px; }
		.footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>E2E Test Results - ${status}</h1>
			<p>Dorkinians FC Website - ${timestamp}</p>
		</div>
		<div class="content">
			<div class="summary">
				<h2>Test Summary</h2>
				<div class="summary-item"><span class="label">Status:</span> ${status}</div>
				<div class="summary-item"><span class="label">Total Tests:</span> ${summary.total}</div>
				<div class="summary-item"><span class="label">Pass Rate:</span> <span style="color: ${summary.passPercentage >= 80 ? '#28a745' : summary.passPercentage >= 50 ? '#ffc107' : '#dc3545'}; font-weight: bold;">${summary.passPercentage}%</span></div>
				<div class="summary-item"><span class="label">Passed:</span> <span style="color: #28a745;">${summary.passed}</span></div>
				<div class="summary-item"><span class="label">Failed:</span> <span style="color: #dc3545;">${summary.failed}</span></div>
				<div class="summary-item"><span class="label">Skipped:</span> ${summary.skipped}</div>
				${summary.duration > 0 ? `<div class="summary-item"><span class="label">Duration:</span> ${summary.duration}s</div>` : ''}
			</div>

			<h2 style="margin-top: 30px;">Test Results by Page</h2>
			${generateTestResultsHTML()}

			<h3 style="margin-top: 30px;">Raw Test Output</h3>
			<div class="output">${testOutput.replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 3000)}${testOutput.length > 3000 ? '\n\n... (truncated)' : ''}</div>

			${screenshots.length > 0 ? `
			<div class="screenshots">
				<h3>Screenshots (${screenshots.length})</h3>
				<p>Screenshots were captured for failed tests. Check the test report for details.</p>
			</div>
			` : ''}

			<div class="footer">
				<p><strong>Base URL:</strong> ${BASE_URL}</p>
				<p><strong>Test Report:</strong> Available in __tests__/e2e/playwright-report/</p>
				<p><strong>Screenshots:</strong> Available in __tests__/e2e/test-results/screenshots/</p>
				<p>View full report: <code>npm run test:e2e:report</code></p>
			</div>
		</div>
	</div>
</body>
</html>
	`;

	// Create text version
	const generateTextResults = () => {
		const suiteNames = Object.keys(testResults).sort();
		
		// Define order to match documentation
		const suiteOrder = [
			'Navigation Tests',
			'Home Page Tests',
			'Stats Page Tests',
			'TOTW Page Tests',
			'Club Info Page Tests',
			'Settings Page Tests',
			'API Endpoint Tests',
			'Cross-Cutting Tests',
		];
		
		// Sort suites by documentation order, then alphabetically for any extras
		const sortedSuites = suiteNames.sort((a, b) => {
			const aIndex = suiteOrder.indexOf(a);
			const bIndex = suiteOrder.indexOf(b);
			if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
			if (aIndex !== -1) return -1;
			if (bIndex !== -1) return 1;
			return a.localeCompare(b);
		});
		
		let text = '';
		
		for (const suiteName of sortedSuites) {
			const suiteData = testResults[suiteName];
			const suiteStatus = suiteData.failed === 0 ? '✅' : '❌';
			
			text += `\n${suiteStatus} ${suiteName} (${suiteData.passed} passed, ${suiteData.failed} failed)\n`;
			text += `${'='.repeat(50)}\n`;
			
			for (const test of suiteData.tests) {
				const icon = test.status === 'passed' ? '✓' : '✗';
				text += `  ${icon} ${test.name} (${test.duration.toFixed(1)}s)`;
				if (test.failureReason) {
					text += ` - ${test.failureReason}`;
				}
				text += '\n';
			}
			text += '\n';
		}
		
		return text;
	};

	const textContent = `
E2E Test Results - ${status}
Dorkinians FC Website - ${timestamp}

Test Summary:
- Status: ${status}
- Total Tests: ${summary.total}
- Pass Rate: ${summary.passPercentage}%
- Passed: ${summary.passed}
- Failed: ${summary.failed}
- Skipped: ${summary.skipped}
${summary.duration > 0 ? `- Duration: ${summary.duration}s` : ''}

Test Results by Page:
${generateTextResults()}

${screenshots.length > 0 ? `\nScreenshots: ${screenshots.length} screenshot(s) captured\n` : ''}

Base URL: ${BASE_URL}
Test Report: __tests__/e2e/playwright-report/
Screenshots: __tests__/e2e/test-results/screenshots/
View full report: npm run test:e2e:report
	`;

	try {
		const transporter = nodemailer.createTransport({
			host: emailConfig.host,
			port: emailConfig.port,
			secure: emailConfig.secure,
			auth: emailConfig.auth,
			tls: {
				rejectUnauthorized: false, // Allow self-signed certificates
			},
		});

		const mailOptions = {
			from: emailConfig.from,
			to: emailConfig.to,
			subject: `E2E Tests ${testPassed ? 'PASSED' : 'FAILED'} - Dorkinians FC Website`,
			text: textContent,
			html: htmlContent,
		};

		// Attach screenshots if any
		if (screenshots.length > 0) {
			mailOptions.attachments = screenshots.map((screenshotPath, index) => ({
				filename: `screenshot-${index + 1}.png`,
				path: screenshotPath,
			}));
		}

		const info = await transporter.sendMail(mailOptions);
		console.log(`📧 Email sent successfully to ${emailConfig.to}`);
		console.log(`   Message ID: ${info.messageId}`);
	} catch (error) {
		console.error('❌ Failed to send email:', error.message);
	}
};

// Note: Email sending is now handled in processTestResults() which is called after tests complete
