/**
 * Custom Jest Reporter for Clean Output
 * Provides simple one-line status for regular test runs
 */

class SummaryReporter {
	constructor(globalConfig, options) {
		this.globalConfig = globalConfig;
		this.options = options;
		this.testResults = [];
		this.currentTestFile = "";
		this.currentTestSuite = "";
	}

	onRunStart(results, options) {
		if (process.env.JEST_VERBOSE !== "true") {
			console.log("\n🧪 Starting test suite...");
		}
	}

	onTestFileStart(test) {
		this.currentTestFile = test.path;
		if (process.env.JEST_VERBOSE !== "true") {
			const fileName = test.path.split("/").pop().replace(".test.ts", "");
			console.log(`\n📁 ${fileName}`);
		}
	}

	onTestResult(test, testResult, aggregatedResult) {
		if (process.env.JEST_VERBOSE !== "true") {
			const fileName = testResult.testFilePath.split("/").pop().replace(".test.ts", "");
			const suiteName = testResult.testResults[0]?.ancestorTitles[0] || "";

			// Show suite name if it's different from previous
			if (suiteName !== this.currentTestSuite) {
				this.currentTestSuite = suiteName;
				console.log(`  📋 ${suiteName}`);
			}

			// Show test results with simple status
			testResult.testResults.forEach((result) => {
				const status = result.status === "passed" ? "✅" : result.status === "failed" ? "❌" : "⚠️";
				const testName = result.title;

				if (result.status === "passed") {
					console.log(`    ${status} ${testName}`);
				} else if (result.status === "failed") {
					console.log(`    ${status} ${testName}`);
					if (result.failureMessages && result.failureMessages.length > 0) {
						console.log(`      💥 ${result.failureMessages[0].split("\n")[0]}`);
					}
				} else {
					console.log(`    ${status} ${testName}`);
				}
			});
		}
	}

	onRunComplete(contexts, results) {
		if (process.env.JEST_VERBOSE !== "true") {
			const { numPassedTests, numFailedTests, numTotalTests } = results;
			const successRate = ((numPassedTests / numTotalTests) * 100).toFixed(1);

			console.log("\n📊 Test Summary:");
			console.log(`  ✅ Passed: ${numPassedTests}`);
			console.log(`  ❌ Failed: ${numFailedTests}`);
			console.log(`  📈 Success Rate: ${successRate}%`);

			if (numFailedTests > 0) {
				console.log("\n💡 Run `npm run test:debug` for detailed error information");
			}

			console.log("\n🎯 Test execution complete!\n");
		}
	}

	getLastError() {
		return null;
	}
}

module.exports = SummaryReporter;
