const path = require("path");
const http = require("http");
const https = require("https");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Import data sources and header configurations
const { dataSources } = require("../lib/config/dataSources");
const { csvHeaderConfigs } = require("../lib/config/csvHeaders");

// Helper function to make HTTP requests
function makeRequest(url, maxRedirects = 5) {
	return new Promise((resolve, reject) => {
		const urlObj = new URL(url);
		const isHttps = urlObj.protocol === "https:";
		const client = isHttps ? https : http;

		const requestOptions = {
			hostname: urlObj.hostname,
			port: urlObj.port || (isHttps ? 443 : 80),
			path: urlObj.pathname + urlObj.search,
			method: "GET",
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			},
		};

		const req = client.request(requestOptions, (res) => {
			// Handle redirects
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
				console.log(`  🔄 Following redirect: ${res.statusCode} -> ${res.headers.location}`);
				const redirectUrl = res.headers.location.startsWith("http")
					? res.headers.location
					: `${isHttps ? "https:" : "http:"}//${urlObj.hostname}${res.headers.location}`;

				makeRequest(redirectUrl, maxRedirects - 1)
					.then(resolve)
					.catch(reject);
				return;
			}

			let data = "";
			res.on("data", (chunk) => {
				data += chunk;
			});
			res.on("end", () => {
				if (res.statusCode === 200) {
					resolve(data);
				} else {
					reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
				}
			});
		});

		req.on("error", (error) => {
			reject(error);
		});

		req.end();
	});
}

// Function to fetch CSV headers
async function fetchCSVHeaders(url) {
	try {
		const csvText = await makeRequest(url);
		const lines = csvText.split("\n");

		if (lines.length === 0) {
			throw new Error("Empty CSV file");
		}

		// Parse the first line as headers
		const headerLine = lines[0].trim();
		if (!headerLine) {
			throw new Error("Empty header line");
		}

		// Split by comma and clean up quotes
		const headers = headerLine.split(",").map((header) => header.trim().replace(/^["']|["']$/g, ""));

		return headers;
	} catch (error) {
		throw error;
	}
}

// Function to validate CSV headers
function validateCSVHeaders(sourceName, expectedHeaders, actualHeaders) {
	const missingHeaders = expectedHeaders.filter((header) => !actualHeaders.includes(header));
	const extraHeaders = actualHeaders.filter((header) => !expectedHeaders.includes(header));

	return {
		isValid: missingHeaders.length === 0 && extraHeaders.length === 0,
		missingHeaders,
		extraHeaders,
	};
}

// Function to get expected headers for a given source name
function getExpectedHeaders(sourceName) {
	const config = csvHeaderConfigs.find(config => config.name === sourceName);
	return config ? config.expectedHeaders : null;
}

// Main test function
async function testCSVHeaders() {
	console.log("🔍 Testing CSV Header Validation...\n");

	let totalSources = 0;
	let validSources = 0;
	let failedSources = 0;
	const results = [];

	// Test each data source
	for (const dataSource of dataSources) {
		totalSources++;
		console.log(`📊 Testing ${dataSource.name}...`);

		try {
			const actualHeaders = await fetchCSVHeaders(dataSource.url);
			const expectedHeaders = getExpectedHeaders(dataSource.name);

			if (!expectedHeaders) {
				console.log(`  ⚠️ No header validation defined for ${dataSource.name}, skipping`);
				continue;
			}

			const missingHeaders = expectedHeaders.filter((h) => !actualHeaders.includes(h));
			const extraHeaders = actualHeaders.filter((h) => !expectedHeaders.includes(h));

			if (missingHeaders.length === 0 && extraHeaders.length === 0) {
				validSources++;
				console.log(`  ✅ Headers valid`);
			} else {
				failedSources++;
				console.log(`  ❌ Headers invalid`);
				console.log(`     Missing: ${missingHeaders.join(", ")}`);
				console.log(`     Extra: ${extraHeaders.join(", ")}`);
				console.log(`     Expected: ${expectedHeaders.join(", ")}`);
				console.log(`     Actual: ${actualHeaders.join(", ")}`);

				results.push({
					sourceName: dataSource.name,
					expectedHeaders,
					actualHeaders,
					missingHeaders,
					extraHeaders,
					url: dataSource.url,
				});
			}
		} catch (error) {
			failedSources++;
			console.log(`  ❌ Failed to validate headers for ${dataSource.name}: ${error.message}`);

			results.push({
				sourceName: dataSource.name,
				expectedHeaders: getExpectedHeaders(dataSource.name) || [],
				actualHeaders: [],
				missingHeaders: getExpectedHeaders(dataSource.name) || [],
				extraHeaders: [],
				url: dataSource.url,
			});
		}

		console.log(""); // Empty line for readability
	}

	// Summary
	console.log(`\n📊 CSV Header Validation Complete:`);
	console.log(`  Total Sources: ${totalSources}`);
	console.log(`  Valid Sources: ${validSources}`);
	console.log(`  Failed Sources: ${failedSources}`);
	console.log(`  Overall Result: ${failedSources === 0 ? "✅ PASSED" : "❌ FAILED"}`);

	// Check email configuration
	const emailConfig = {
		host: process.env.SMTP_SERVER,
		port: process.env.SMTP_PORT,
		secure: process.env.SMTP_EMAIL_SECURE === "true",
		user: process.env.SMTP_USERNAME,
		pass: process.env.SMTP_PASSWORD,
		from: process.env.SMTP_FROM_EMAIL,
		to: process.env.SMTP_TO_EMAIL,
	};

	console.log("\n🔍 Environment Variable Debug:");
	console.log(`  SMTP_SERVER: ${process.env.SMTP_SERVER || "NOT SET"}`);
	console.log(`  SMTP_PORT: ${process.env.SMTP_PORT || "NOT SET"}`);
	console.log(`  SMTP_EMAIL_SECURE: ${process.env.SMTP_EMAIL_SECURE || "NOT SET"}`);
	console.log(`  SMTP_USERNAME: ${process.env.SMTP_USERNAME || "NOT SET"}`);
	console.log(`  SMTP_PASSWORD: ${process.env.SMTP_PASSWORD ? "SET (hidden)" : "NOT SET"}`);
	console.log(`  SMTP_FROM_EMAIL: ${process.env.SMTP_FROM_EMAIL || "NOT SET"}`);
	console.log(`  SMTP_TO_EMAIL: ${process.env.SMTP_TO_EMAIL || "NOT SET"}`);

	// Check each required field individually
	const requiredFields = [
		{ name: "SMTP_SERVER", value: emailConfig.host },
		{ name: "SMTP_PORT", value: emailConfig.port },
		{ name: "SMTP_USERNAME", value: emailConfig.user },
		{ name: "SMTP_PASSWORD", value: emailConfig.pass },
		{ name: "SMTP_FROM_EMAIL", value: emailConfig.from },
		{ name: "SMTP_TO_EMAIL", value: emailConfig.to },
	];

	const missingFields = requiredFields.filter((field) => !field.value);
	const isEmailConfigured = missingFields.length === 0;

	if (isEmailConfigured) {
		console.log("\n📧 Email service configuration detected");
		console.log(`  SMTP Server: ${emailConfig.host}:${emailConfig.port}`);
		console.log(`  From: ${emailConfig.from}`);
		console.log(`  To: ${emailConfig.to}`);
	} else {
		console.log("\n⚠️ Email service not fully configured");
		console.log("   Required environment variables: SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_TO_EMAIL");
		console.log(`   Missing variables: ${missingFields.map((f) => f.name).join(", ")}`);
	}

	// Prepare enhanced email summary if there are failures
	if (failedSources > 0 && isEmailConfigured) {
		console.log(`\n📧 Preparing enhanced email notification:`);

		// Separate header validation failures from access failures
		const headerFailures = results.filter((r) => !r.validation.isValid && !r.error);
		const accessFailures = results.filter((r) => r.error);

		console.log(`  Header Validation Failures: ${headerFailures.length}`);
		console.log(`  Access Failures: ${accessFailures.length}`);

		// Convert results to the expected format for email
		const failures = results
			.filter((r) => !r.validation.isValid)
			.map((r) => ({
				sourceName: r.sourceName,
				expectedHeaders: r.expectedHeaders,
				actualHeaders: r.actualHeaders,
				missingHeaders: r.validation.missingHeaders,
				extraHeaders: r.validation.extraHeaders,
				url: r.url,
				error: r.error,
			}));

		console.log("📧 Enhanced email would include detailed failure analysis");
		console.log("  (Email sending requires the full application to be running)");
	}

	return {
		isValid: failedSources === 0,
		totalSources,
		validSources,
		failedSources,
		results,
		hasAccessFailures: results.some((r) => r.error),
		hasHeaderFailures: results.some((r) => !r.validation.isValid && !r.error),
	};
}

// Run the test if this script is executed directly
if (require.main === module) {
	testCSVHeaders()
		.then((result) => {
			console.log("\n🏁 Test completed");
			process.exit(result.isValid ? 0 : 1);
		})
		.catch((error) => {
			console.error("❌ Test failed:", error);
			process.exit(1);
		});
}

module.exports = { testCSVHeaders };
