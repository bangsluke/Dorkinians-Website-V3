const { DataSeederService } = require('./lib/services/dataSeederService');
const { EmailService } = require('./lib/services/emailService');
const { initializeProgress, setStepProgress, completeProgress } = require('./seed-status');

const emailService = new EmailService();

exports.handler = async (event, context) => {
	console.log('🚀 BACKGROUND: Background seeding function initiated');
	console.log('📊 BACKGROUND: Event details:', JSON.stringify(event, null, 2));
	console.log('⏰ BACKGROUND: Context remaining time:', context.getRemainingTimeInMillis(), 'ms');
	
	// Set CORS headers
	const headers = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
	};

	// Handle preflight request
	if (event.httpMethod === 'OPTIONS') {
		console.log('🔄 BACKGROUND: Handling OPTIONS request');
		return {
			statusCode: 200,
			headers,
			body: ''
		};
	}

	try {
		console.log('🔧 BACKGROUND: Starting background execution logic');
		
		// Parse request body for seeding parameters
		let seedingParams;
		if (event.body) {
			try {
				seedingParams = JSON.parse(event.body);
			} catch (parseError) {
				console.error('❌ BACKGROUND: Failed to parse request body:', parseError);
				return {
					statusCode: 400,
					headers: { ...headers, 'Content-Type': 'application/json' },
					body: JSON.stringify({
						error: 'Invalid JSON in request body'
					})
				};
			}
		} else {
			seedingParams = { environment: 'production' };
		}

		const { environment = 'production', jobId = 'unknown' } = seedingParams;
		console.log('🌍 BACKGROUND: Target environment:', environment);
		console.log('🆔 BACKGROUND: Job ID:', jobId);

		// Initialize progress tracking
		const totalSteps = 12; // Total steps in seeding process
		initializeProgress(jobId, totalSteps);
		console.log('📊 BACKGROUND: Progress tracking initialized');

		// Configure email service
		console.log('📧 BACKGROUND: Configuring email service...');
		setStepProgress(jobId, 1, 'Configuring email service');
		emailService.configure();

		// Send start notification
		console.log('📧 BACKGROUND: Sending start notification...');
		setStepProgress(jobId, 2, 'Sending start notification');
		try {
			await emailService.sendSeedingStartEmail(environment, jobId);
			console.log('✅ BACKGROUND: Start notification sent successfully');
		} catch (emailError) {
			console.warn('⚠️ BACKGROUND: Failed to send start notification:', emailError);
		}

		// Execute seeding
		console.log('🌱 BACKGROUND: Starting background seeding execution...');
		const startTime = Date.now();
		const result = await executeBackgroundSeeding(environment, jobId);
		const duration = Date.now() - startTime;
		console.log('⏱️ BACKGROUND: Seeding execution completed in', duration, 'ms');

		// Complete progress tracking
		completeProgress(jobId, result.success, result);

		// Send completion notification
		console.log('📧 BACKGROUND: Sending completion notification...');
		setStepProgress(jobId, totalSteps, 'Sending completion notification');
		try {
			await emailService.sendSeedingSummaryEmail({
				success: result.success,
				environment,
				jobId,
				nodesCreated: result.nodesCreated,
				relationshipsCreated: result.relationshipsCreated,
				errorCount: result.errors.length,
				errors: result.errors,
				duration
			});
			console.log('✅ BACKGROUND: Completion notification sent successfully');
		} catch (emailError) {
			console.warn('⚠️ BACKGROUND: Failed to send completion email:', emailError);
		}

		// Return success response
		console.log('✅ BACKGROUND: Returning success response');
		return {
			statusCode: 200,
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				success: true,
				message: 'Background seeding completed successfully',
				environment,
				jobId,
				timestamp: new Date().toISOString(),
				result: {
					...result,
					duration
				},
				statusUrl: `/.netlify/functions/seed-status?jobId=${jobId}`
			})
		};

	} catch (error) {
		console.error('❌ BACKGROUND: Main execution error:', error);
		console.error('❌ BACKGROUND: Stack trace:', error.stack);

		// Update progress with failure
		if (event.body) {
			try {
				const { jobId } = JSON.parse(event.body);
				completeProgress(jobId, false, { error: error.message });
			} catch (parseError) {
				console.warn('⚠️ BACKGROUND: Could not update progress for failure');
			}
		}

		// Send failure notification
		console.log('📧 BACKGROUND: Attempting to send failure notification...');
		try {
			await emailService.sendSeedingSummaryEmail({
				success: false,
				environment: event.body ? JSON.parse(event.body).environment : 'production',
				jobId: event.body ? JSON.parse(event.body).jobId : 'unknown',
				nodesCreated: 0,
				relationshipsCreated: 0,
				errorCount: 1,
				errors: [error.message],
				duration: 0
			});
			console.log('✅ BACKGROUND: Failure notification sent successfully');
		} catch (emailError) {
			console.warn('⚠️ BACKGROUND: Failed to send failure email:', emailError);
		}

		return {
			statusCode: 500,
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				error: 'Background seeding failed',
				message: error.message,
				timestamp: new Date().toISOString()
			})
		};
	}
};

async function executeBackgroundSeeding(environment, jobId) {
	console.log(`📜 BACKGROUND: Starting background seeding for environment: ${environment}, job: ${jobId}`);
	console.log(`⏰ BACKGROUND: Remaining time: ${context?.getRemainingTimeInMillis() || 'unknown'} ms`);
	
	// Set environment variables
	process.env.NODE_ENV = environment;
	console.log('🔧 BACKGROUND: Environment variables set');
	setStepProgress(jobId, 3, 'Setting environment variables');
	
	try {
		console.log('🔌 BACKGROUND: Initializing data seeder service...');
		setStepProgress(jobId, 4, 'Initializing data seeder service');
		const dataSeeder = new DataSeederService();
		await dataSeeder.initialize();
		console.log('✅ BACKGROUND: Data seeder initialized successfully');
		
		console.log('🌱 BACKGROUND: Executing seeding process...');
		setStepProgress(jobId, 5, 'Starting data seeding process');
		const seedingResult = await dataSeeder.seedAllData();
		console.log('✅ BACKGROUND: Seeding process completed');
		setStepProgress(jobId, 6, 'Data seeding completed');
		
		console.log('📊 BACKGROUND: Counting errors from log...');
		setStepProgress(jobId, 7, 'Processing results and counting errors');
		const errorCount = countErrorsFromLog();
		console.log('📊 BACKGROUND: Error count:', errorCount);
		
		console.log('📤 BACKGROUND: Preparing return result...');
		setStepProgress(jobId, 8, 'Preparing final results');
		return {
			success: true,
			exitCode: 0,
			nodesCreated: seedingResult.nodesCreated || 0,
			relationshipsCreated: seedingResult.relationshipsCreated || 0,
			errorCount,
			errors: []
		};
		
	} catch (error) {
		console.error('❌ BACKGROUND: Seeding failed:', error);
		console.error('❌ BACKGROUND: Stack trace:', error.stack);
		setStepProgress(jobId, 9, 'Error occurred during seeding');
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
		console.log('🧹 BACKGROUND: Starting cleanup...');
		setStepProgress(jobId, 10, 'Cleaning up connections and resources');
		try {
			if (dataSeeder) {
				await dataSeeder.cleanup();
				console.log('✅ BACKGROUND: Cleanup completed successfully');
			}
		} catch (cleanupError) {
			console.warn('⚠️ BACKGROUND: Cleanup failed:', cleanupError);
		}
		setStepProgress(jobId, 11, 'Cleanup completed');
	}
}

function countErrorsFromLog() {
	// Simple error counting - can be enhanced with actual log parsing
	return 0;
}
