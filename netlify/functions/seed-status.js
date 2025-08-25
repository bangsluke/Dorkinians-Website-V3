// In-memory progress tracking (for demo - in production, use Redis or database)
const seedingProgress = new Map();

exports.handler = async (event, context) => {
	console.log('📊 STATUS: Seed status check initiated');
	
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
		const { jobId } = event.queryStringParameters || {};
		
		if (!jobId) {
			return {
				statusCode: 400,
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					error: 'Job ID required',
					message: 'Provide jobId as query parameter'
				})
			};
		}

		console.log(`📊 STATUS: Checking status for job: ${jobId}`);
		
		// Get progress from memory (or database in production)
		const progress = seedingProgress.get(jobId);
		
		if (!progress) {
			return {
				statusCode: 404,
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					error: 'Job not found',
					message: `No seeding job found with ID: ${jobId}`
				})
			});
		}

		// Calculate progress percentage
		const totalSteps = progress.totalSteps || 1;
		const currentStep = progress.currentStep || 0;
		const progressPercentage = Math.round((currentStep / totalSteps) * 100);

		return {
			statusCode: 200,
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				jobId,
				status: progress.status,
				progress: {
					current: currentStep,
					total: totalSteps,
					percentage: progressPercentage
				},
				currentStep: progress.currentStepName,
				startTime: progress.startTime,
				estimatedCompletion: progress.estimatedCompletion,
				lastUpdate: progress.lastUpdate,
				details: progress.details || []
			})
		};

	} catch (error) {
		console.error('❌ STATUS: Error checking status:', error);
		return {
			statusCode: 500,
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				error: 'Failed to check status',
				message: error.message
			})
		};
	}
};

// Progress tracking functions (called from background-seed.js)
function updateProgress(jobId, update) {
	const current = seedingProgress.get(jobId) || {};
	const updated = {
		...current,
		...update,
		lastUpdate: new Date().toISOString()
	};
	seedingProgress.set(jobId, updated);
}

function initializeProgress(jobId, totalSteps) {
	updateProgress(jobId, {
		status: 'running',
		totalSteps,
		currentStep: 0,
		currentStepName: 'Initializing',
		startTime: new Date().toISOString(),
		estimatedCompletion: new Date(Date.now() + (30 * 60 * 1000)).toISOString(), // 30 minutes
		details: []
	});
}

function setStepProgress(jobId, stepNumber, stepName, details = null) {
	updateProgress(jobId, {
		currentStep: stepNumber,
		currentStepName: stepName,
		details: details ? [...(seedingProgress.get(jobId)?.details || []), details] : undefined
	});
}

function completeProgress(jobId, success, result) {
	updateProgress(jobId, {
		status: success ? 'completed' : 'failed',
		currentStep: seedingProgress.get(jobId)?.totalSteps || 1,
		currentStepName: success ? 'Completed' : 'Failed',
		completionTime: new Date().toISOString(),
		result
	});
}

// Export progress tracking functions
module.exports = {
	updateProgress,
	initializeProgress,
	setStepProgress,
	completeProgress,
	seedingProgress
};
