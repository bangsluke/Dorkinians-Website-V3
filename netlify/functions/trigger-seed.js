const path = require('path');

// Import the seeding service directly
let dataSeederService;
let emailService;

try {
	// Import from the copied lib directory in netlify/functions
	const { DataSeederService } = require('./lib/services/dataSeederService');
	const { emailService: emailServiceModule } = require('./lib/services/emailService');
	
	dataSeederService = new DataSeederService();
	emailService = emailServiceModule;
	console.log('✅ Services imported successfully from netlify/functions/lib');
} catch (error) {
	console.error('Failed to import from netlify/functions/lib:', error);
	console.error('This function will not work without proper imports');
}

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

		// Check if services are available
		if (!dataSeederService || !emailService) {
			const errorMsg = 'Required services not available. Check function logs for import errors.';
			console.error(errorMsg);
			console.error('DataSeederService available:', !!dataSeederService);
			console.error('EmailService available:', !!emailService);
			
			return {
				statusCode: 500,
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					error: errorMsg,
					details: {
						dataSeederService: !!dataSeederService,
						emailService: !!emailService,
						environment: process.env.NODE_ENV,
						buildPath: path.join(process.cwd(), '.next'),
						libPath: path.join(process.cwd(), 'lib')
					}
				})
			};
		}

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
			if (emailService) {
				await emailService.sendSeedingSummaryEmail({
					success: false,
					environment: event.queryStringParameters?.environment || 'production',
					nodesCreated: 0,
					relationshipsCreated: 0,
					errorCount: 1,
					errors: [error.message],
					duration: 0
				});
			}
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
		await dataSeederService.initialize();
		
		// Execute the seeding process
		const seedingResult = await dataSeederService.seedAllData();
		
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
			await dataSeederService.cleanup();
		} catch (cleanupError) {
			console.warn('Cleanup failed:', cleanupError);
		}
	}
}

async function sendSeedingNotification(result, environment, duration) {
	if (!emailService) {
		console.warn('Email service not available');
		return;
	}

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
		const fs = require('fs');
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
