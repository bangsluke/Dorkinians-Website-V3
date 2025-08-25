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
	const [environment, setEnvironment] = useState<'production' | 'development'>('production');
	const [isLoading, setIsLoading] = useState(false);
	const [result, setResult] = useState<SeedingResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	const triggerSeeding = async () => {
		setIsLoading(true);
		setError(null);
		setResult(null);

		try {
			// Show immediate feedback that seeding has started
			setResult({
				success: true,
				message: 'Database seeding started successfully',
				environment,
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

			const response = await fetch(`/.netlify/functions/trigger-seed?environment=${environment}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
			});

			const data = await response.json();

			if (response.ok) {
				setResult(data);
			} else {
				setError(data.error || 'Failed to trigger seeding');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Network error');
		} finally {
			setIsLoading(false);
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
							checked={environment === 'production'}
							onChange={(e) => setEnvironment(e.target.value as 'production' | 'development')}
							className="mr-2"
						/>
						Production
					</label>
					<label className="flex items-center">
						<input
							type="radio"
							value="development"
							checked={environment === 'development'}
							onChange={(e) => setEnvironment(e.target.value as 'production' | 'development')}
							className="mr-2"
						/>
						Development
					</label>
				</div>
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
					isLoading 
						? 'bg-blue-50 border-blue-200' 
						: result.result.success 
							? 'bg-green-50 border-green-200' 
							: 'bg-red-50 border-red-200'
				}`}>
					<h3 className={`text-lg font-semibold mb-3 ${
						isLoading 
							? 'text-blue-800' 
							: result.result.success 
								? 'text-green-800' 
								: 'text-red-800'
					}`}>
						{isLoading ? '🔄 Seeding in Progress...' : 'Seeding Result'}
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
								{isLoading ? '🔄' : result.result.nodesCreated}
							</p>
							<p className="text-sm text-gray-600">
								{isLoading ? 'Processing...' : 'Nodes Created'}
							</p>
						</div>
						<div className="text-center p-3 bg-white rounded-lg">
							<p className="text-2xl font-bold text-green-600">
								{isLoading ? '🔄' : result.result.relationshipsCreated}
							</p>
							<p className="text-sm text-gray-600">
								{isLoading ? 'Processing...' : 'Relationships Created'}
							</p>
						</div>
						<div className="text-center p-3 bg-white rounded-lg">
							<p className="text-2xl font-bold text-red-600">
								{isLoading ? '🔄' : result.result.errorCount}
							</p>
							<p className="text-sm text-gray-600">
								{isLoading ? 'Processing...' : 'Errors Found'}
							</p>
						</div>
					</div>

					{/* Progress Indicator */}
					{isLoading && (
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
