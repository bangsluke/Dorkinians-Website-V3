const { spawn } = require('child_process');
const path = require('path');

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

		// Check if seeding is already running (optional - can be disabled with force=true)
		if (!force) {
			// You could implement a simple lock mechanism here
			// For now, we'll allow concurrent executions
		}

		console.log(`🚀 Triggering database seeding for environment: ${environment}`);

		// Execute seeding script
		const result = await executeSeedingScript(environment);

		// Return success response
		return {
			statusCode: 200,
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				success: true,
				message: 'Database seeding triggered successfully',
				environment,
				timestamp: new Date().toISOString(),
				result
			})
		};

	} catch (error) {
		console.error('❌ Error triggering seeding:', error);

		return {
			statusCode: 500,
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				error: 'Failed to trigger database seeding',
				message: error.message,
				timestamp: new Date().toISOString()
			})
		};
	}
};

function executeSeedingScript(environment) {
	return new Promise((resolve, reject) => {
		// Determine the script to run
		const npmScript = environment === 'production' ? 'seed-prod' : 'seed-dev';
		
		console.log(`📜 Executing: npm run ${npmScript}`);

		// Execute the seeding script
		const child = spawn('npm', ['run', npmScript], {
			cwd: process.cwd(),
			stdio: ['pipe', 'pipe', 'pipe'],
			env: { ...process.env, NODE_ENV: environment }
		});

		let stdout = '';
		let stderr = '';
		let nodesCreated = 0;
		let relationshipsCreated = 0;

		child.stdout?.on('data', (data) => {
			const output = data.toString();
			stdout += output;
			console.log(`[SEEDING] ${output.trim()}`);

			// Parse output for statistics
			if (output.includes('✅ Created')) {
				const match = output.match(/(\d+) nodes/);
				if (match) nodesCreated = parseInt(match[1]);
			}
			if (output.includes('✅ Created')) {
				const match = output.match(/(\d+) relationships/);
				if (match) relationshipsCreated = parseInt(match[1]);
			}
		});

		child.stderr?.on('data', (data) => {
			const output = data.toString();
			stderr += output;
			console.error(`[SEEDING ERROR] ${output.trim()}`);
		});

		child.on('close', (code) => {
			const exitCode = code || 0;
			const success = exitCode === 0;

			// Count errors from the log file
			const errorCount = countErrorsFromLog();

			const result = {
				success,
				exitCode,
				nodesCreated,
				relationshipsCreated,
				errorCount,
				errors: success ? [] : [stderr || 'Script execution failed'],
				duration: Date.now() // You could add timing logic here
			};

			if (success) {
				resolve(result);
			} else {
				reject(new Error(`Seeding failed with exit code ${exitCode}`));
			}
		});

		child.on('error', (error) => {
			reject(error);
		});
	});
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
