#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const logArg = process.argv[2];
const thresholdArg = process.argv[3];

if (!logArg) {
	console.error("Usage: node scripts/ci-check-pass-rate.cjs <logPath> [thresholdPercent]");
	process.exit(2);
}

const threshold = Number(thresholdArg ?? "90");
if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 100) {
	console.error(`Invalid threshold: ${String(thresholdArg)}`);
	process.exit(2);
}

const logPath = path.resolve(logArg);
if (!fs.existsSync(logPath)) {
	console.error(`Log file not found: ${logPath}`);
	process.exit(2);
}

const content = fs.readFileSync(logPath, "utf8");
const summaryMatch = content.match(/Total:\s*(\d+)\s*\/\s*(\d+)\s*test suites passed/i);

if (!summaryMatch) {
	console.error("Could not find pass summary in log output.");
	process.exit(1);
}

const passed = Number(summaryMatch[1]);
const total = Number(summaryMatch[2]);
const failed = Math.max(0, total - passed);
const denominator = passed + failed; // explicitly excludes skipped by construction
const passRate = denominator > 0 ? (passed / denominator) * 100 : 0;

console.log(`Parsed test suite pass summary: ${passed}/${total}`);
console.log(`Computed pass rate: ${passRate.toFixed(2)}% (threshold: ${threshold.toFixed(2)}%)`);

if (passRate < threshold) {
	console.error(`Pass rate gate failed: ${passRate.toFixed(2)}% < ${threshold.toFixed(2)}%`);
	process.exit(1);
}

console.log("Pass rate gate passed.");
