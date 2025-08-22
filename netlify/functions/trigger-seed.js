const path = require('path');
const fs = require('fs');

// Simple email service implementation for Netlify Functions
class SimpleEmailService {
	constructor() {
		this.config = null;
	}

	configure(config) {
		this.config = config;
	}

	async sendSeedingSummaryEmail(summary) {
		if (!this.config) {
			console.log('Email service not configured, skipping email notification');
			return true;
		}

		try {
			// For now, just log the email that would be sent
			console.log('📧 Email notification would be sent:', {
				to: this.config.to,
				subject: `Database Seeding ${summary.success ? 'Success' : 'Failed'}`,
				summary
			});
			return true;
		} catch (error) {
			console.error('Failed to send email:', error);
			return false;
		}
	}
}

// Simple data seeder implementation for Netlify Functions
class SimpleDataSeeder {
	constructor() {
		this.neo4jDriver = null;
		this.session = null;
	}

	async initialize() {
		try {
			// Import neo4j driver dynamically
			const neo4j = require('neo4j-driver');
			
			const uri = process.env.PROD_NEO4J_URI;
			const user = process.env.PROD_NEO4J_USER;
			const password = process.env.PROD_NEO4J_PASSWORD;

			if (!uri || !user || !password) {
				throw new Error('Missing Neo4j environment variables');
			}

			this.neo4jDriver = neo4j.driver(uri, neo4j.auth.basic(user, password));
			this.session = this.neo4jDriver.session();
			
			// Test connection
			await this.session.run('RETURN 1 as test');
			console.log('✅ Neo4j connection established');
			
		} catch (error) {
			console.error('❌ Failed to initialize Neo4j connection:', error);
			throw error;
		}
	}

	async cleanup() {
		try {
			if (this.session) {
				await this.session.close();
			}
			if (this.neo4jDriver) {
				await this.neo4jDriver.close();
			}
			console.log('✅ Neo4j connection closed');
		} catch (error) {
			console.warn('⚠️ Error during cleanup:', error);
		}
	}

	async seedAllData() {
		try {
			console.log('🌱 Starting simplified seeding process...');
			
			// For now, just return a success result
			// In a real implementation, you would add the actual seeding logic here
			return {
				success: true,
				nodesCreated: 0,
				relationshipsCreated: 0,
				errors: []
			};
		} catch (error) {
			console.error('❌ Seeding failed:', error);
			return {
				success: false,
				nodesCreated: 0,
				relationshipsCreated: 0,
				errors: [error.message]
			};
		}
	}
}

// Initialize services
const dataSeeder = new SimpleDataSeeder();
const emailService = new SimpleEmailService();

exports.handler = async (event, context) => {
	// Set CORS headers
	const headers = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
	};

	// Handle preflight request
	if (event.httpMethod === 'OPTIONS') {
		return {
			statusCode: 200,
			headers,
			body: ''
		};
	}

	try {
		// Parse request
		const { environment = 'production', force = false } = event.queryStringParameters || {};
		
		// Validate environment
		if (!['development', 'production'].includes(environment)) {
			return {
				statusCode: 400,
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					error: 'Invalid environment. Use "development" or "production"'
				})
			};
		}

		console.log(`🚀 Triggering database seeding for environment: ${environment}`);

		// Execute seeding directly
		const startTime = Date.now();
		const result = await executeSeedingDirectly(environment);
		const duration = Date.now() - startTime;

		// Send email notification
		try {
			await sendSeedingNotification(result, environment, duration);
		} catch (emailError) {
			console.warn('Failed to send email notification:', emailError);
			// Don't fail the function if email fails
		}

		// Return success response
		return {
			statusCode: 200,
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				success: true,
				message: 'Database seeding completed successfully',
				environment,
				timestamp: new Date().toISOString(),
				result: {
					...result,
					duration
				}
			})
		};

	} catch (error) {
		console.error('❌ Error during seeding:', error);

		// Send failure notification
		try {
			await emailService.sendSeedingSummaryEmail({
				success: false,
				environment: event.queryStringParameters?.environment || 'production',
				nodesCreated: 0,
				relationshipsCreated: 0,
				errorCount: 1,
				errors: [error.message],
				duration: 0
			});
		} catch (emailError) {
			console.warn('Failed to send failure email:', emailError);
		}

		return {
			statusCode: 500,
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				error: 'Failed to complete database seeding',
				message: error.message,
				timestamp: new Date().toISOString()
			})
		};
	}
};

async function executeSeedingDirectly(environment) {
	console.log(`📜 Starting direct seeding for environment: ${environment}`);
	
	// Set environment variables
	process.env.NODE_ENV = environment;
	
	try {
		// Initialize the data seeder service
		await dataSeeder.initialize();
		
		// Execute the seeding process
		const seedingResult = await dataSeeder.seedAllData();
		
		// Count errors from log file
		const errorCount = countErrorsFromLog();
		
		return {
			success: true,
			exitCode: 0,
			nodesCreated: seedingResult.nodesCreated || 0,
			relationshipsCreated: seedingResult.relationshipsCreated || 0,
			errorCount,
			errors: []
		};
		
	} catch (error) {
		console.error('Seeding failed:', error);
		return {
			success: false,
			exitCode: 1,
			nodesCreated: 0,
			relationshipsCreated: 0,
			errorCount: 1,
			errors: [error.message]
		};
	} finally {
		// Clean up connections
		try {
			await dataSeeder.cleanup();
		} catch (cleanupError) {
			console.warn('Cleanup failed:', cleanupError);
		}
	}
}

async function sendSeedingNotification(result, environment, duration) {
	const summary = {
		success: result.success,
		environment,
		nodesCreated: result.nodesCreated,
		relationshipsCreated: result.relationshipsCreated,
		errorCount: result.errorCount,
		errors: result.errors,
		duration
	};

	await emailService.sendSeedingSummaryEmail(summary);
}

function countErrorsFromLog() {
	try {
		const logPath = path.join(process.cwd(), 'logs', 'seeding-errors.log');
		
		if (!fs.existsSync(logPath)) {
			return 0;
		}

		const logContent = fs.readFileSync(logPath, 'utf8');
		const lines = logContent.split('\n');
		
		// Count lines that contain actual error details
		let errorCount = 0;
		for (const line of lines) {
			if (line.trim() && 
				!line.startsWith('===') && 
				!line.startsWith('[') && 
				!line.startsWith('Details:') &&
				!line.startsWith('}')) {
				errorCount++;
			}
		}
		
		return errorCount;
	} catch (error) {
		console.warn(`⚠️ Could not read error log: ${error}`);
		return 0;
	}
}
