module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>"],
	testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
	transform: {
		"^.+\\.ts$": "ts-jest",
	},
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/$1",
	},
	setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
	testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
	collectCoverageFrom: ["lib/**/*.ts", "components/**/*.tsx", "!**/*.d.ts", "!**/node_modules/**"],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html"],
	// Production database testing configuration
	testTimeout: 60000,
	// Enable verbose output for database operations
	verbose: process.env.JEST_VERBOSE === "true",
	// Handle async operations properly
	forceExit: true,
	// Clean up after tests
	clearMocks: true,
	resetMocks: true,
	restoreMocks: true,
	// Custom reporter for clean output
	reporters: ["default", process.env.JEST_VERBOSE === "true" ? undefined : "<rootDir>/__tests__/reporters/summaryReporter.js"].filter(
		Boolean,
	),
};
