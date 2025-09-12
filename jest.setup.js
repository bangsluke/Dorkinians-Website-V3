// Jest setup file
require("@testing-library/jest-dom");

// Load environment variables from .env file
require("dotenv").config({ path: ".env" });

// Production database environment variables for real testing
process.env.NODE_ENV = "test";
// All environments now use Neo4j Aura (PROD_NEO4J_* variables)

// Global test timeout - increased for database operations
jest.setTimeout(60000);

// Conditional logging based on JEST_VERBOSE environment variable
const isVerbose = process.env.JEST_VERBOSE === "true";

if (isVerbose) {
	// Enable real console output for debugging database operations
	console.log("🧪 Jest setup: Testing against production database");
	console.log("🔗 Neo4j URI:", process.env.PROD_NEO4J_URI);
	console.log("👤 Neo4j User:", process.env.PROD_NEO4J_USER);
	console.log("⏱️  Test timeout:", 60000, "ms");
	console.log("📝 Verbose mode: ENABLED - Detailed logging active");
} else {
	// Clean, minimal output for regular test runs
	console.log("🧪 Jest setup: Production database testing configured");
}
