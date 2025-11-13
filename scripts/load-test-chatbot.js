/**
 * Load test script for chatbot API
 * Tests concurrent request handling (up to 500 users)
 * 
 * Usage: node scripts/load-test-chatbot.js [concurrentUsers] [durationSeconds]
 * Example: node scripts/load-test-chatbot.js 100 60
 */

const http = require("http");

const CONCURRENT_USERS = parseInt(process.argv[2]) || 50;
const DURATION_SECONDS = parseInt(process.argv[3]) || 30;
const API_URL = process.env.API_URL || "http://localhost:3000";
const ENDPOINT = `${API_URL}/api/chatbot`;

// Test questions
const TEST_QUESTIONS = [
	"How many goals have I scored?",
	"Who is the top goal scorer?",
	"How many appearances has John Smith made?",
	"What are the top 10 goal scorers?",
	"How many assists has the team made?",
	"Which player has the most clean sheets?",
	"How many goals were scored in 2023/24?",
	"Who scored the most goals for the 1st XI?",
];

const stats = {
	totalRequests: 0,
	successfulRequests: 0,
	failedRequests: 0,
	errorRequests: 0,
	responseTimes: [],
	startTime: Date.now(),
};

function makeRequest(question) {
	return new Promise((resolve) => {
		const startTime = Date.now();
		const postData = JSON.stringify({
			question,
			userContext: undefined,
		});

		const options = {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Content-Length": Buffer.byteLength(postData),
			},
			timeout: 30000, // 30 second timeout
		};

		const req = http.request(ENDPOINT, options, (res) => {
			let data = "";

			res.on("data", (chunk) => {
				data += chunk;
			});

			res.on("end", () => {
				const responseTime = Date.now() - startTime;
				stats.responseTimes.push(responseTime);

				if (res.statusCode === 200) {
					stats.successfulRequests++;
					resolve({ success: true, responseTime, statusCode: res.statusCode });
				} else {
					stats.failedRequests++;
					resolve({ success: false, responseTime, statusCode: res.statusCode });
				}
			});
		});

		req.on("error", (error) => {
			const responseTime = Date.now() - startTime;
			stats.responseTimes.push(responseTime);
			stats.errorRequests++;
			resolve({ success: false, responseTime, error: error.message });
		});

		req.on("timeout", () => {
			req.destroy();
			const responseTime = Date.now() - startTime;
			stats.responseTimes.push(responseTime);
			stats.errorRequests++;
			resolve({ success: false, responseTime, error: "Request timeout" });
		});

		req.write(postData);
		req.end();
	});
}

async function runUser() {
	while (Date.now() - stats.startTime < DURATION_SECONDS * 1000) {
		const question = TEST_QUESTIONS[Math.floor(Math.random() * TEST_QUESTIONS.length)];
		stats.totalRequests++;
		await makeRequest(question);
		// Small delay between requests from same user
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
}

function calculateStats() {
	const sortedTimes = [...stats.responseTimes].sort((a, b) => a - b);
	const avgResponseTime = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;
	const medianResponseTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
	const p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
	const p99ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

	return {
		avgResponseTime: Math.round(avgResponseTime),
		medianResponseTime,
		p95ResponseTime,
		p99ResponseTime,
		minResponseTime: sortedTimes[0] || 0,
		maxResponseTime: sortedTimes[sortedTimes.length - 1] || 0,
	};
}

async function runLoadTest() {
	console.log(`\n🚀 Starting load test...`);
	console.log(`📊 Configuration:`);
	console.log(`   - Concurrent Users: ${CONCURRENT_USERS}`);
	console.log(`   - Duration: ${DURATION_SECONDS} seconds`);
	console.log(`   - Endpoint: ${ENDPOINT}\n`);

	// Start all concurrent users
	const userPromises = [];
	for (let i = 0; i < CONCURRENT_USERS; i++) {
		userPromises.push(runUser());
	}

	// Wait for all users to complete
	await Promise.all(userPromises);

	// Calculate and display results
	const responseTimeStats = calculateStats();
	const duration = (Date.now() - stats.startTime) / 1000;
	const requestsPerSecond = (stats.totalRequests / duration).toFixed(2);

	console.log(`\n✅ Load test completed!\n`);
	console.log(`📈 Results:`);
	console.log(`   - Total Requests: ${stats.totalRequests}`);
	console.log(`   - Successful: ${stats.successfulRequests} (${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2)}%)`);
	console.log(`   - Failed: ${stats.failedRequests} (${((stats.failedRequests / stats.totalRequests) * 100).toFixed(2)}%)`);
	console.log(`   - Errors: ${stats.errorRequests} (${((stats.errorRequests / stats.totalRequests) * 100).toFixed(2)}%)`);
	console.log(`   - Requests/Second: ${requestsPerSecond}`);
	console.log(`\n⏱️  Response Times (ms):`);
	console.log(`   - Average: ${responseTimeStats.avgResponseTime}ms`);
	console.log(`   - Median: ${responseTimeStats.medianResponseTime}ms`);
	console.log(`   - P95: ${responseTimeStats.p95ResponseTime}ms`);
	console.log(`   - P99: ${responseTimeStats.p99ResponseTime}ms`);
	console.log(`   - Min: ${responseTimeStats.minResponseTime}ms`);
	console.log(`   - Max: ${responseTimeStats.maxResponseTime}ms\n`);

	// Recommendations
	if (stats.errorRequests / stats.totalRequests > 0.1) {
		console.log(`⚠️  Warning: High error rate detected. Consider:`);
		console.log(`   - Increasing Neo4j connection pool size`);
		console.log(`   - Adding request queuing`);
		console.log(`   - Scaling database resources\n`);
	}

	if (responseTimeStats.p95ResponseTime > 5000) {
		console.log(`⚠️  Warning: High response times detected. Consider:`);
		console.log(`   - Optimizing Cypher queries`);
		console.log(`   - Adding query result caching`);
		console.log(`   - Reviewing database indexes\n`);
	}
}

// Run the load test
runLoadTest().catch((error) => {
	console.error("❌ Load test failed:", error);
	process.exit(1);
});

