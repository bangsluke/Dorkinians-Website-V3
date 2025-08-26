'use client';

import { useState } from 'react';

interface SeedingResult {
	success: boolean;
	message: string;
	environment: string;
	timestamp: string;
	result: {
		success: boolean;
		exitCode: number;
		nodesCreated: number;
		relationshipsCreated: number;
		errorCount: number;
		errors: string[];
		duration: number;
	};
}

export default function AdminPanel() {
	const [isLoading, setIsLoading] = useState(false);
	const [result, setResult] = useState<SeedingResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [jobId, setJobId] = useState<string | null>(null);
	const [statusCheckLoading, setStatusCheckLoading] = useState(false);

	const triggerSeeding = async () => {
		setIsLoading(true);
		setError(null);
		setResult(null);

		try {
			// Show immediate feedback that seeding has started
			setResult({
				success: true,
				message: 'Database seeding started successfully',
				environment: 'production',
				timestamp: new Date().toISOString(),
				result: {
					success: true,
					exitCode: 0,
					nodesCreated: 0,
					relationshipsCreated: 0,
					errorCount: 0,
					errors: [],
					duration: 0
				}
			});

			const response = await fetch(`/.netlify/functions/trigger-seed?environment=production`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
			});

			const data = await response.json();
			console.log('Netlify function response:', data);

			if (response.ok) {
				// Transform the Netlify function response to match expected format
				const transformedResult = {
					success: data.success || false,
					message: data.message || 'Unknown response',
					environment: data.environment || 'production',
					timestamp: data.timestamp || new Date().toISOString(),
					result: {
						success: data.success || false,
						exitCode: data.success ? 0 : 1,
						nodesCreated: 0, // Will be updated when status is checked
						relationshipsCreated: 0, // Will be updated when status is checked
						errorCount: 0,
						errors: [],
						duration: 0
					}
				};
				
				setResult(transformedResult);
				// Extract job ID for status checking
				if (data.jobId) {
					setJobId(data.jobId);
				}
			} else {
				setError(data.error || 'Failed to trigger seeding');
			}
		} catch (err) {
			console.error('Seeding trigger error:', err);
			setError(err instanceof Error ? err.message : 'Network error');
		} finally {
			setIsLoading(false);
		}
	};

	const checkStatus = async () => {
		if (!jobId) {
			setError('No job ID available. Please trigger seeding first.');
			return;
		}

		setStatusCheckLoading(true);
		setError(null);

		try {
			const herokuUrl = process.env.NEXT_PUBLIC_HEROKU_SEEDER_URL || 'https://database-dorkinians-4bac3364a645.herokuapp.com';
			const response = await fetch(`${herokuUrl}/status/${jobId}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			});

			if (response.ok) {
				const statusData = await response.json();
				
				// Update result with current status
				if (statusData.status === 'completed' && statusData.result) {
					setResult({
						success: true,
						message: 'Seeding completed successfully',
						environment: 'production',
						timestamp: statusData.endTime || new Date().toISOString(),
						result: {
							success: statusData.result.success,
							exitCode: statusData.result.success ? 0 : 1,
							nodesCreated: statusData.result.nodesCreated || 0,
							relationshipsCreated: statusData.result.relationshipsCreated || 0,
							errorCount: statusData.result.errors?.length || 0,
							errors: statusData.result.errors || [],
							duration: statusData.result.duration || 0
						}
					});
				} else if (statusData.status === 'failed') {
					setResult({
						success: false,
						message: 'Seeding failed',
						environment: 'production',
						timestamp: statusData.endTime || new Date().toISOString(),
						result: {
							success: false,
							exitCode: 1,
							nodesCreated: 0,
							relationshipsCreated: 0,
							errorCount: 1,
							errors: [statusData.error || 'Unknown error'],
							duration: 0
						}
					});
				} else {
					// Still running
					setResult({
						success: true,
						message: `Seeding in progress: ${statusData.currentStep || 'Processing'}`,
						environment: 'production',
						timestamp: new Date().toISOString(),
						result: {
							success: true,
							exitCode: 0,
							nodesCreated: 0,
							relationshipsCreated: 0,
							errorCount: 0,
							errors: [],
							duration: 0
						}
					});
				}
			} else {
				setError('Failed to check status');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Network error');
		} finally {
			setStatusCheckLoading(false);
		}
	};

	return (
		<div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
			<h2 className="text-2xl font-bold text-gray-900 mb-6">Database Seeding Admin Panel</h2>
			
			{/* Configuration Section */}
			<div className="mb-6 p-4 bg-gray-50 rounded-lg">
				<h3 className="text-lg font-semibold text-gray-800 mb-3">Configuration</h3>
				<div className="flex items-center space-x-4">
					<label className="flex items-center">
						<input
							type="radio"
							value="production"
							checked={true}
							className="mr-2"
							disabled
						/>
						Production (Live Database)
					</label>
				</div>
				<p className="text-sm text-gray-600 mt-2">
					⚠️ This will seed the production Neo4j database. Development seeding has been disabled.
				</p>
			</div>

			{/* Trigger Button */}
			<div className="mb-6">
				<button
					onClick={triggerSeeding}
					disabled={isLoading}
					className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
						isLoading
							? 'bg-gray-400 cursor-not-allowed'
							: 'bg-blue-600 hover:bg-blue-700'
					}`}
				>
					{isLoading ? '🔄 Triggering...' : '🚀 Trigger Database Seeding'}
				</button>
			</div>

			{/* Status Check Button */}
			<div className="mb-6">
				<button
					onClick={checkStatus}
					disabled={statusCheckLoading || !jobId}
					className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
						statusCheckLoading || !jobId
							? 'bg-gray-400 cursor-not-allowed'
							: 'bg-purple-600 hover:bg-purple-700'
					}`}
				>
					{statusCheckLoading ? '🔄 Checking Status...' : '🔍 Check Seeding Status'}
				</button>
			</div>

			{/* Error Display */}
			{error && (
				<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
					<h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
					<p className="text-red-700">{error}</p>
				</div>
			)}

			{/* Result Display */}
			{result && (
				<div className={`mb-6 p-4 rounded-lg border ${
					isLoading || statusCheckLoading
						? 'bg-blue-50 border-blue-200' 
						: result.result.success 
							? 'bg-green-50 border-green-200' 
							: 'bg-red-50 border-red-200'
				}`}>
					<h3 className={`text-lg font-semibold mb-3 ${
						isLoading || statusCheckLoading
							? 'text-blue-800' 
							: result.result.success 
								? 'text-green-800' 
								: 'text-red-800'
					}`}>
						{isLoading || statusCheckLoading ? '🔄 Seeding in Progress...' : 'Seeding Result'}
					</h3>
					
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
						<div>
							<p className="text-sm text-gray-600">Environment</p>
							<p className="font-semibold">{result.environment}</p>
						</div>
						<div>
							<p className="text-sm text-gray-600">Timestamp</p>
							<p className="font-semibold">{new Date(result.timestamp).toLocaleString()}</p>
						</div>
						<div>
							<p className="text-sm text-gray-600">Status</p>
							<p className={`font-semibold ${result.result.success ? 'text-green-600' : 'text-red-600'}`}>
								{result.result.success ? '✅ Success' : '❌ Failed'}
							</p>
						</div>
						<div>
							<p className="text-sm text-gray-600">Exit Code</p>
							<p className="font-semibold">{result.result.exitCode}</p>
						</div>
					</div>

					{/* Statistics */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
						<div className="text-center p-3 bg-white rounded-lg">
							<p className="text-2xl font-bold text-blue-600">
								{isLoading || statusCheckLoading ? '🔄' : result.result.nodesCreated}
							</p>
							<p className="text-sm text-gray-600">
								{isLoading || statusCheckLoading ? 'Processing...' : 'Nodes Created'}
							</p>
						</div>
						<div className="text-center p-3 bg-white rounded-lg">
							<p className="text-2xl font-bold text-green-600">
								{isLoading || statusCheckLoading ? '🔄' : result.result.relationshipsCreated}
							</p>
							<p className="text-sm text-gray-600">
								{isLoading || statusCheckLoading ? 'Processing...' : 'Relationships Created'}
							</p>
						</div>
						<div className="text-center p-3 bg-white rounded-lg">
							<p className="text-2xl font-bold text-red-600">
								{isLoading || statusCheckLoading ? '🔄' : result.result.errorCount}
							</p>
							<p className="text-sm text-gray-600">
								{isLoading || statusCheckLoading ? 'Processing...' : 'Errors Found'}
							</p>
						</div>
					</div>

					{/* Progress Indicator */}
					{isLoading || statusCheckLoading && (
						<div className="mb-4 p-4 bg-blue-100 border border-blue-300 rounded-lg">
							<div className="flex items-center gap-3">
								<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
								<div>
									<p className="font-semibold text-blue-800">Seeding in Progress</p>
									<p className="text-sm text-blue-600">
										Processing 10 data sources from Google Sheets...
									</p>
									<p className="text-xs text-blue-500 mt-1">
										Expected duration: ~30 minutes. Check your email for start and completion notifications.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Errors */}
					{result.result.errors && result.result.errors.length > 0 && (
						<div className="mt-4">
							<h4 className="text-md font-semibold text-red-800 mb-2">Errors:</h4>
							<ul className="list-disc list-inside space-y-1">
								{result.result.errors.map((error, index) => (
									<li key={index} className="text-red-700 text-sm">{error}</li>
								))}
							</ul>
						</div>
					)}
				</div>
			)}

			{/* Information Section */}
			<div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
				<h3 className="text-lg font-semibold text-blue-800 mb-2">How It Works</h3>
				<ul className="text-blue-700 text-sm space-y-1">
					<li>• This triggers the database seeding process immediately</li>
					<li>• Seeding runs on Netlify&apos;s infrastructure</li>
					<li>• Results are displayed in real-time</li>
					<li>• Use for manual updates or testing</li>
				</ul>
			</div>
		</div>
	);
}
