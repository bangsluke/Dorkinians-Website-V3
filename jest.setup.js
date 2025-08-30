// Jest setup file
require('@testing-library/jest-dom');

// Production database environment variables for real testing
process.env.NODE_ENV = 'test';
process.env.DEV_NEO4J_URI = process.env.PROD_NEO4J_URI || 'bolt://localhost:7687';
process.env.DEV_NEO4J_USER = process.env.PROD_NEO4J_USER || 'neo4j';
process.env.DEV_NEO4J_PASSWORD = process.env.PROD_NEO4J_PASSWORD || 'password';

// Global test timeout - increased for database operations
jest.setTimeout(60000);

// Enable real console output for debugging database operations
// global.console = {
//   ...console,
//   log: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

console.log('🧪 Jest setup: Testing against production database');
console.log('🔗 Neo4j URI:', process.env.DEV_NEO4J_URI);
console.log('👤 Neo4j User:', process.env.DEV_NEO4J_USER);
console.log('⏱️  Test timeout:', 60000, 'ms');
