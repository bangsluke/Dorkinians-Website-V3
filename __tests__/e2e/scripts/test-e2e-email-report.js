#!/usr/bin/env node

/**
 * E2E Test Email Report Script
 * Runs E2E tests and sends email notification with results (unified Dorkinians report layout).
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
	escapeHtml,
	sendReportEmail,
	wrapSectionCard,
	buildDefaultContext,
	extractSkippedTestsFromPlaywrightJson,
	mergeSkippedTestsForEmail,
	renderSkippedTestsTableHtml,
} = require('../../../lib/email/dorkiniansReportEmail.js');

require('dotenv').config();

const BASE_URL = process.env.WEBSITE_URL || process.env.BASE_URL || 'https://dorkinians-website-v3.netlify.app';
const HEADLESS = process.env.HEADLESS !== 'false';
const E2E_SKIP_REASON_NOTE =
	'Skipped E2E tests are intentional guard skips (for example: missing/slow test data, valid empty states, or project/device-specific conditions).';

const PLAYWRIGHT_EMAIL_CONFIG = path.join(process.cwd(), 'playwright.email-report.config.ts');
const JSON_REPORT_PATH = path.join(process.cwd(), '__tests__', 'e2e', 'test-results', 'e2e-email-report.json');

const testResultsDir = path.join(process.cwd(), '__tests__', 'e2e', 'test-results');
const screenshotsDir = path.join(testResultsDir, 'screenshots');

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
let e2eWallClockSec = 0;

const DOCUMENTED_SUITE_ORDER = [
	'Navigation Tests',
	'Home Page Tests',
	'Stats Page Tests',
	'TOTW Page Tests',
	'Club Info Page Tests',
	'Settings Page Tests',
	'Admin Page Tests',
	'API Endpoint Tests',
	'Cross-Cutting Tests',
];

const startTime = Date.now();
let stdoutBuffer = '';
let stderrBuffer = '';
let lastTestLine = '';
let lastActivityTime = Date.now();

const commandArgs = ['playwright', 'test', '-c', PLAYWRIGHT_EMAIL_CONFIG];
if (!HEADLESS) {
	commandArgs.push('--headed');
}

console.log(`📝 Executing: npx ${commandArgs.join(' ')}`);
console.log('');

const child = spawn('npx', commandArgs, {
	stdio: ['inherit', 'pipe', 'pipe'],
	env: {
		...process.env,
		BASE_URL,
		WEBSITE_URL: BASE_URL,
	},
	cwd: process.cwd(),
	shell: true,
});

child.stdout.on('data', (data) => {
	const text = data.toString();
	stdoutBuffer += text;
	process.stdout.write(text);
	const lines = text.split('\n').filter((line) => line.trim());
	if (lines.length > 0) {
		const meaningfulLine = lines[lines.length - 1];
		if (meaningfulLine.match(/[✓✗›⊘-]/) || meaningfulLine.match(/Running|Test|passed|failed|skipped/i)) {
			lastTestLine = meaningfulLine.trim();
			lastActivityTime = Date.now();
		}
	}
});

child.stderr.on('data', (data) => {
	const text = data.toString();
	stderrBuffer += text;
	process.stderr.write(text);
	lastActivityTime = Date.now();
});

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

	if (elapsed >= 3000) {
		console.log(`[HEARTBEAT] ⚠️ WARNING: Tests running for ${minutes} minutes, 5 minutes remaining before timeout`);
	} else if (elapsed >= 2400) {
		console.log(`[HEARTBEAT] ⚠️ WARNING: Tests running for ${minutes} minutes, 15 minutes remaining before timeout`);
	}
}, 30000);

child.on('close', (code) => {
	clearInterval(heartbeatInterval);
	e2eWallClockSec = Math.round(((Date.now() - startTime) / 1000) * 10) / 10;
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
	processTestResults();
});

child.on('error', (error) => {
	clearInterval(heartbeatInterval);
	e2eWallClockSec = Math.round(((Date.now() - startTime) / 1000) * 10) / 10;
	testOutput = error.message || 'Test execution failed';
	testPassed = false;
	exitCode = 1;
	console.error('❌ Failed to start test process:', error.message);
	processTestResults();
});

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

const normalizeSuiteName = (suiteName) => {
	const mapping = {
		'Navigation Tests': 'Navigation Tests',
		'Home Page Tests': 'Home Page Tests',
		'Stats Page Tests': 'Stats Page Tests',
		'TOTW Page Tests': 'TOTW Page Tests',
		'Club Info Page Tests': 'Club Info Page Tests',
		'Settings Page Tests': 'Settings Page Tests',
		'Admin Page Tests': 'Admin Page Tests',
		'API Endpoint Tests': 'API Endpoint Tests',
		'Cross-Cutting Tests': 'Cross-Cutting Tests',
	};
	return mapping[suiteName] || suiteName;
};

const extractFailureReason = (output, testLineIndex, lines) => {
	if (!lines || testLineIndex === undefined) return 'Failed (see raw output for details)';

	for (let i = testLineIndex + 1; i < Math.min(testLineIndex + 20, lines.length); i++) {
		const line = lines[i];

		if (!line.trim() || line.match(/^\s*[✓✗⊘-]/)) {
			continue;
		}

		if (line.match(/timeout|Timeout|exceeded/i)) {
			const timeoutMatch = line.match(/timeout.*?(\d+)\s*(?:ms|s|milliseconds?|seconds?)/i);
			if (timeoutMatch) {
				return `Failed due to timeout (${timeoutMatch[1]}${timeoutMatch[1].includes('ms') ? 'ms' : 's'})`;
			}
			return 'Failed due to timeout';
		}

		if (line.match(/AssertionError|expect|assert/i)) {
			const errorMatch = line.match(/(?:AssertionError|Error):\s*(.+)/i);
			if (errorMatch) {
				return `Failed: ${errorMatch[1].substring(0, 100)}${errorMatch[1].length > 100 ? '...' : ''}`;
			}
			return 'Failed: Assertion error';
		}

		if (line.match(/Error:|Exception:/i)) {
			const errorMatch = line.match(/(?:Error|Exception):\s*(.+)/i);
			if (errorMatch) {
				return `Failed: ${errorMatch[1].substring(0, 100)}${errorMatch[1].length > 100 ? '...' : ''}`;
			}
		}

		if (line.match(/not found|not visible|not attached|element.*not/i)) {
			return 'Failed: Element not found';
		}

		if (line.trim().length > 0 && !line.match(/^\s*at\s+/)) {
			const cleanLine = line.trim().substring(0, 150);
			if (cleanLine.length > 0) {
				return `Failed: ${cleanLine}${line.trim().length > 150 ? '...' : ''}`;
			}
		}
	}

	return 'Failed (see raw output for details)';
};

const PLAYWRIGHT_LINE_RE =
	/^\s*([✓✗✘×⊘-])\s+\d+\s+\[([^\]]+)\]\s+›\s+([^:]+):\d+:\d+\s+›\s+(.+?)\s+›\s+(.+?)\s+\(([\d.]+)s\)/;

const classifyStatusFromIcon = (icon) => {
	if (icon === '✓') return 'passed';
	if (icon === '⊘' || icon === '-') return 'skipped';
	return 'failed';
};

const mergeStatus = (a, b) => {
	const rank = { passed: 0, skipped: 1, failed: 2 };
	return rank[a] >= rank[b] ? a : b;
};

const iconForStatus = (status) => {
	if (status === 'passed') return '✓';
	if (status === 'skipped') return '⊘';
	return '✗';
};

const parseTestResults = () => {
	const lines = testOutput.split('\n');
	const rawRows = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		let testMatch = line.match(PLAYWRIGHT_LINE_RE);
		if (!testMatch) {
			testMatch = line.match(
				/^\s*([✓✗✘×⊘-])\s+.*?\[([^\]]+)\]\s+›\s+([^:]+):\d+:\d+\s+›\s+(.+?)\s+›\s+(.+?)\s+\(([\d.]+)s\)/,
			);
		}
		if (!testMatch) continue;

		const statusIcon = testMatch[1];
		const filePath = testMatch[3].trim();
		const suite = normalizeSuiteName(testMatch[4].trim());
		const testName = testMatch[5].trim();
		const duration = parseFloat(testMatch[6]);

		rawRows.push({
			lineIndex: i,
			statusIcon,
			filePath,
			suite,
			testName,
			duration,
		});
	}

	const mergeMap = new Map();
	for (const row of rawRows) {
		const key = `${row.filePath}||${row.suite}||${row.testName}`;
		const prev = mergeMap.get(key);
		if (!prev) {
			mergeMap.set(key, { ...row });
			continue;
		}
		const mergedStatus = mergeStatus(classifyStatusFromIcon(prev.statusIcon), classifyStatusFromIcon(row.statusIcon));
		const lineIndex = mergedStatus === 'failed'
			? (classifyStatusFromIcon(row.statusIcon) === 'failed' ? row.lineIndex : prev.lineIndex)
			: row.lineIndex;
		mergeMap.set(key, {
			lineIndex,
			statusIcon: iconForStatus(mergedStatus),
			filePath: row.filePath,
			suite: row.suite,
			testName: row.testName,
			duration: Math.max(prev.duration, row.duration),
		});
	}

	const testResults = {};
	let mergedCount = 0;
	let passedCount = 0;
	let failedCount = 0;
	let skippedCount = 0;

	for (const row of mergeMap.values()) {
		mergedCount++;
		const status = classifyStatusFromIcon(row.statusIcon);
		if (status === 'passed') passedCount++;
		else if (status === 'failed') failedCount++;
		else skippedCount++;

		let failureReason = null;
		if (status === 'failed') {
			failureReason = extractFailureReason(testOutput, row.lineIndex, lines);
		}

		if (!testResults[row.suite]) {
			testResults[row.suite] = {
				suite: row.suite,
				tests: [],
				passed: 0,
				failed: 0,
				skipped: 0,
			};
		}

		testResults[row.suite].tests.push({
			name: row.testName,
			status,
			duration: row.duration,
			failureReason,
			file: row.filePath,
		});

		if (status === 'passed') testResults[row.suite].passed++;
		else if (status === 'failed') testResults[row.suite].failed++;
		else testResults[row.suite].skipped++;
	}

	if (rawRows.length === 0) {
		console.warn('⚠️ No test results parsed. First 20 lines of output:');
		console.warn(lines.slice(0, 20).join('\n'));
	} else {
		console.log(
			`📊 Parsed ${rawRows.length} result lines → ${mergedCount} tests (${passedCount} passed, ${failedCount} failed, ${skippedCount} skipped)`,
		);
	}

	return testResults;
};

const getTestSummary = () => {
	const summary = {
		passed: 0,
		failed: 0,
		skipped: 0,
		total: 0,
		duration: 0,
		passPercentage: 0,
	};

	const passedMatch = testOutput.match(/(\d+)\s+passed/i);
	const failedMatch = testOutput.match(/(\d+)\s+failed/i);
	const skippedMatch = testOutput.match(/(\d+)\s+skipped/i);

	if (passedMatch) summary.passed = parseInt(passedMatch[1], 10);
	if (failedMatch) summary.failed = parseInt(failedMatch[1], 10);
	if (skippedMatch) summary.skipped = parseInt(skippedMatch[1], 10);
	if (e2eWallClockSec > 0) {
		summary.duration = e2eWallClockSec;
	}

	summary.total = summary.passed + summary.failed + summary.skipped;

	if (summary.total > 0) {
		summary.passPercentage = ((summary.passed / summary.total) * 100).toFixed(1);
	}

	return summary;
};

const getScreenshots = () => {
	if (!fs.existsSync(screenshotsDir)) {
		return [];
	}
	const files = fs.readdirSync(screenshotsDir).filter((f) => f.endsWith('.png'));
	return files.map((f) => path.join(screenshotsDir, f));
};

function loadSkippedFromJsonReport() {
	try {
		if (!fs.existsSync(JSON_REPORT_PATH)) {
			console.warn('⚠️ Playwright JSON report not found:', JSON_REPORT_PATH);
			return { rows: [], available: false };
		}
		const raw = fs.readFileSync(JSON_REPORT_PATH, 'utf8');
		const report = JSON.parse(raw);
		const rows = extractSkippedTestsFromPlaywrightJson(report);
		return { rows: mergeSkippedTestsForEmail(rows), available: true };
	} catch (e) {
		console.warn('⚠️ Could not parse Playwright JSON for skips:', e.message);
		return { rows: [], available: false };
	}
}

const sendEmailReport = async () => {
	const summary = getTestSummary();
	const testResults = parseTestResults();
	const screenshots = getScreenshots();
	const skippedMeta = loadSkippedFromJsonReport();
	const skippedMerged = skippedMeta.rows;
	const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });

	const status = testPassed ? '✅ PASSED' : '❌ FAILED';
	const statusColor = testPassed ? '#28a745' : '#dc3545';

	const generateTestResultsHTML = () => {
		const suiteNames = Object.keys(testResults).sort();

		if (suiteNames.length === 0) {
			return '<p>No test results parsed. Check raw output below.</p>';
		}

		const suiteOrder = DOCUMENTED_SUITE_ORDER;
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
			const suiteStatus = suiteData.failed > 0 ? 'failed' : suiteData.passed > 0 ? 'passed' : 'skipped';
			const suiteStatusColor = suiteStatus === 'passed' ? '#28a745' : suiteStatus === 'skipped' ? '#b45309' : '#dc3545';
			const suiteStatusIcon = suiteStatus === 'passed' ? '✅' : suiteStatus === 'skipped' ? '⊘' : '❌';

			html += `
			<div style="margin:12px 0;border:1px solid #eaecf0;border-radius:10px;overflow:hidden;background:#ffffff;">
				<div style="color:white;padding:12px 14px;background:${suiteStatusColor};">
					<h3 style="margin:0;font-size:16px;">${suiteStatusIcon} ${escapeHtml(suiteName)} - ${suiteData.passed} passed, ${suiteData.failed} failed, ${suiteData.skipped || 0} skipped</h3>
				</div>
				<div style="padding:12px 14px;">
					<ul style="list-style:none;padding:0;margin:0;">
			`;

			for (const test of suiteData.tests) {
				const testStatusIcon = test.status === 'passed' ? '✓' : test.status === 'skipped' ? '⊘' : '✗';
				const testStatusColor = test.status === 'passed' ? '#28a745' : test.status === 'skipped' ? '#b45309' : '#dc3545';
				const bg = test.status === 'passed' ? '#ecfdf3' : test.status === 'skipped' ? '#fffbeb' : '#fef3f2';
				const border = test.status === 'passed' ? '#bbf7d0' : test.status === 'skipped' ? '#fedf89' : '#fecdca';

				html += `
					<li style="display:flex;align-items:flex-start;padding:10px;margin:6px 0;border-radius:6px;background:${bg};border-left:3px solid ${border};">
						<span style="font-size:16px;margin-right:8px;color:${testStatusColor};font-weight:bold;">${testStatusIcon}</span>
						<div style="flex:1;">
							<div style="font-weight:600;color:#101828;">${escapeHtml(test.name)}</div>
							<div style="font-size:12px;color:#667085;">
								<span>${test.duration.toFixed(1)}s</span>
								${test.failureReason ? `<span style="color:#b42318;font-style:italic;"> - ${escapeHtml(test.failureReason)}</span>` : ''}
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

	const summaryHtml = `
		<div style="border-left:4px solid ${statusColor};padding:12px 14px;background:#f9fafb;border-radius:8px;">
			<div style="font-size:15px;font-weight:700;margin-bottom:8px;color:#101828;">Test summary</div>
			<div style="font-size:13px;line-height:1.6;color:#344054;">
				<div><strong>Status:</strong> ${escapeHtml(status)}</div>
				<div><strong>Total tests:</strong> ${summary.total}</div>
				<div><strong>Pass rate:</strong> <span style="color:${Number(summary.passPercentage) >= 80 ? '#177245' : Number(summary.passPercentage) >= 50 ? '#b45309' : '#b42318'};font-weight:700;">${summary.passPercentage}%</span></div>
				<div><strong>Passed:</strong> <span style="color:#177245;">${summary.passed}</span></div>
				<div><strong>Failed:</strong> <span style="color:#b42318;">${summary.failed}</span></div>
				<div><strong>Skipped:</strong> ${summary.skipped}</div>
				${summary.skipped > 0 ? `<div style="margin-top:6px;"><strong>Skip note:</strong> ${escapeHtml(E2E_SKIP_REASON_NOTE)}</div>` : ''}
				${summary.duration > 0 ? `<div><strong>Duration:</strong> ${summary.duration}s</div>` : ''}
			</div>
		</div>
	`;

	const skippedSectionMessage =
		!skippedMeta.available && summary.skipped > 0
			? '<p style="margin:0;color:#b42318;">Skipped tests were detected, but the Playwright JSON report was unavailable, so per-test skip reasons could not be extracted.</p>'
			: renderSkippedTestsTableHtml(skippedMerged);
	const skippedSectionHtml = wrapSectionCard(
		`<p style="margin:0 0 10px 0;font-size:12px;color:#667085;">Skipped tests and reasons (from Playwright JSON report).</p>${skippedSectionMessage}`,
		{ heading: 'Skipped tests' },
	);

	const byPageHtml = wrapSectionCard(generateTestResultsHTML(), { heading: 'Results by page / suite' });

	const rawEsc = testOutput.replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const rawTrunc = rawEsc.substring(0, 3000) + (testOutput.length > 3000 ? '\n\n... (truncated)' : '');
	const rawHtml = wrapSectionCard(
		`<pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.4;background:#1e1e1e;color:#f8f8f2;padding:12px;border-radius:8px;max-height:400px;overflow:auto;">${rawTrunc}</pre>`,
		{ heading: 'Raw test output (truncated)' },
	);

	const footerHtml = `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #eaecf0;font-size:12px;color:#667085;">
		<p style="margin:4px 0;"><strong>Base URL:</strong> ${escapeHtml(BASE_URL)}</p>
		<p style="margin:4px 0;"><strong>HTML report:</strong> __tests__/e2e/playwright-report/</p>
		<p style="margin:4px 0;"><strong>Screenshots:</strong> __tests__/e2e/test-results/screenshots/</p>
		<p style="margin:4px 0;">View report: <code>npm run test:e2e:show-last-report</code></p>
	</div>`;

	const innerHtml = summaryHtml + skippedSectionHtml + byPageHtml + rawHtml + footerHtml;

	const generateTextResults = () => {
		const suiteNames = Object.keys(testResults).sort();
		const suiteOrder = DOCUMENTED_SUITE_ORDER;
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
			const suiteStatus = suiteData.failed > 0 ? '❌' : suiteData.passed > 0 ? '✅' : '⊘';
			text += `\n${suiteStatus} ${suiteName} (${suiteData.passed} passed, ${suiteData.failed} failed, ${suiteData.skipped || 0} skipped)\n`;
			text += `${'='.repeat(50)}\n`;
			for (const test of suiteData.tests) {
				const icon = test.status === 'passed' ? '✓' : test.status === 'skipped' ? '⊘' : '✗';
				text += `  ${icon} ${test.name} (${test.duration.toFixed(1)}s)`;
				if (test.failureReason) text += ` - ${test.failureReason}`;
				text += '\n';
			}
			text += '\n';
		}
		return text;
	};

	let skippedText = '';
	if (skippedMerged.length) {
		skippedText = '\nSkipped tests:\n' + skippedMerged.map((s) => `  - [${s.projects?.join(', ') || s.projectName}] ${s.title} (${s.file}${s.line ? ':' + s.line : ''}): ${s.reason}`).join('\n');
	} else if (!skippedMeta.available && summary.skipped > 0) {
		skippedText = '\nSkipped tests:\n  - Per-test skip reasons unavailable because the Playwright JSON report was missing or unreadable.';
	}

	const textBody = `E2E Test Results - ${status}
${timestamp}

Summary:
- Status: ${status}
- Total: ${summary.total}
- Pass rate: ${summary.passPercentage}%
- Passed: ${summary.passed}
- Failed: ${summary.failed}
- Skipped: ${summary.skipped}
${summary.skipped > 0 ? `- Skip note: ${E2E_SKIP_REASON_NOTE}` : ''}
${summary.duration > 0 ? `- Duration: ${summary.duration}s` : ''}
${skippedText}

By page:
${generateTextResults()}
${screenshots.length > 0 ? `\nScreenshots: ${screenshots.length}\n` : ''}
Base URL: ${BASE_URL}
`;

	const subjectDetail = `E2E ${testPassed ? 'PASSED' : 'FAILED'} (${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped)`;

	const context = buildDefaultContext({
		triggeredBy: `node __tests__/e2e/scripts/test-e2e-email-report.js`,
		npmScript: 'npm run test:e2e:email',
	});

	try {
		const result = await sendReportEmail({
			subjectDetail,
			title: `E2E test results - ${status.replace(/✅\s*|❌\s*/g, '').trim()}`,
			subtitle: `Dorkinians FC Website - ${timestamp}`,
			accentColor: statusColor,
			context,
			innerHtml,
			textBody,
			smtpMode: 'strict',
			attachments:
				screenshots.length > 0
					? screenshots.map((screenshotPath, index) => ({
							filename: `screenshot-${index + 1}.png`,
							path: screenshotPath,
					  }))
					: undefined,
		});

		if (result.skipped) {
			console.warn('⚠️ Email configuration not available. Skipping email notification.');
			console.warn('   Required: SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_TO_EMAIL');
			return;
		}
		console.log(`📧 Email sent successfully`);
		console.log(`   Message ID: ${result.messageId}`);
	} catch (error) {
		console.error('❌ Failed to send email:', error.message);
	}
};
