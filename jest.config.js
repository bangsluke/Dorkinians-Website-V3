module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>"],
	testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
	transform: {
		"^.+\\.ts$": [
			"ts-jest",
			{
				tsconfig: "tsconfig.test.json"
			}
		],
	},
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/$1",
	},
	setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
	testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
	collectCoverageFrom: ["lib/**/*.ts", "components/**/*.tsx", "!**/*.d.ts", "!**/node_modules/**"],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html"],
	coverageThreshold: {
		global: {
			lines: 80,
			branches: 70,
			functions: 80,
			statements: 80,
		},
	},
	// Production database testing configuration
	testTimeout: 60000,
	// Enable verbose output for database operations
	verbose: process.env.JEST_VERBOSE === "true",
	// Let Jest exit naturally so open-handle leaks are visible/fixable.
	// Clean up after tests
	clearMocks: true,
	resetMocks: true,
	restoreMocks: true,
	// Custom reporter for clean output
	reporters: ["default", process.env.JEST_VERBOSE === "true" ? undefined : "<rootDir>/__tests__/reporters/summaryReporter.js"].filter(
		Boolean,
	),
};
