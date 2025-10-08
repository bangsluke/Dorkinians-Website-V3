#!/usr/bin/env node

/**
 * Simple Test Script
 * Direct test of TypeScript compilation and ChatbotService loading
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

console.log("🧪 Simple TypeScript Test");

try {
	// Register ts-node with minimal configuration
	require("ts-node").register({
		transpileOnly: true,
		compilerOptions: {
			module: "commonjs",
			target: "es2020",
			esModuleInterop: true,
			allowSyntheticDefaultImports: true,
			moduleResolution: "node"
		}
	});
	
	console.log("✅ ts-node registered");
	
	// Try to load the chatbot service
	const chatbotModule = require("./lib/services/chatbotService.ts");
	console.log("✅ chatbotService.ts loaded");
	
	// Check if ChatbotService class exists
	if (chatbotModule.ChatbotService) {
		console.log("✅ ChatbotService class found");
		
		// Try to get an instance
		const service = chatbotModule.ChatbotService.getInstance();
		console.log("✅ ChatbotService instance created");
		
		// Test a simple method call
		console.log("🧪 Testing processQuestion method...");
		const result = await service.processQuestion({
			question: "How many appearances has Luke Bangs made?",
			userContext: "test"
		});
		
		console.log("✅ processQuestion executed successfully");
		console.log("📊 Result:", result.answer);
		
	} else {
		console.log("❌ ChatbotService class not found");
	}
	
} catch (error) {
	console.log("❌ Error:", error.message);
	console.log("Stack:", error.stack);
}
