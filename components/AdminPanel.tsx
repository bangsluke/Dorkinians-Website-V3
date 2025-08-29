'use client';

import { useState, useEffect, useRef } from 'react';

interface SeedingResult {
	success: boolean;
	message: string;
	environment: string;
	timestamp: string;
	status: 'pending' | 'running' | 'completed' | 'failed';
	progress?: number;
	currentStep?: string;
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
	const [lastStatusCheck, setLastStatusCheck] = useState<string | null>(null);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [showJobsModal, setShowJobsModal] = useState(false);
	const [jobsData, setJobsData] = useState<any>(null);
	const [jobsLoading, setJobsLoading] = useState(false);
	const [lastCompletedJobDuration, setLastCompletedJobDuration] = useState<number | null>(null);
	
	const startTimeRef = useRef<number | null>(null);
	const timerRef = useRef<NodeJS.Timeout | null>(null);

	// Timer effect
	useEffect(() => {
		if (startTimeRef.current && (result?.status === 'pending' || result?.status === 'running')) {
			timerRef.current = setInterval(() => {
				const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
				setElapsedTime(elapsed);
			}, 1000);
		} else {
			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}
		}

		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current);
			}
		};
	}, [result?.status]);

	// Cleanup function for component unmount
	useEffect(() => {
		return () => {
			// Clear any remaining timeouts
			if (timerRef.current) {
				clearInterval(timerRef.current);
			}
		};
	}, []);

	// Format elapsed time
	const formatElapsedTime = (seconds: number) => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		
		if (hours > 0) {
			return `${hours}h ${minutes}m ${secs}s`;
		} else if (minutes > 0) {
			return `${minutes}m ${secs}s`;
		} else {
			return `${secs}s`;
		}
	};

	const triggerSeeding = async () => {
		setIsLoading(true);
		setError(null);
		setResult(null);
		setLastStatusCheck(null);
		setElapsedTime(0);
		startTimeRef.current = Date.now();

		try {
			// Show immediate feedback that seeding has started
			setResult({
				success: true,
				message: 'Database seeding initiated successfully',
				environment: 'production',
				timestamp: new Date().toISOString(),
				status: 'pending',
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

			// Try different paths for the Netlify function
			const functionPaths = [
				'/.netlify/functions/trigger-seed',
				'/api/trigger-seed',
				'/trigger-seed'
			];

			let response = null;
			let data = null;
			let successfulPath = '';

			for (const path of functionPaths) {
				try {
					console.log(`Trying function path: ${path}`);
					response = await fetch(`${path}?environment=production`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
					});

					if (response.ok) {
						const contentType = response.headers.get('content-type');
						if (contentType && contentType.includes('application/json')) {
							data = await response.json();
							successfulPath = path;
							console.log(`✅ Success with path: ${path}`);
							console.log('Function response:', data);
							break;
						} else {
							console.warn(`Path ${path} returned non-JSON response:`, contentType);
							const textResponse = await response.text();
							console.warn('Response preview:', textResponse.substring(0, 200));
						}
					} else {
						console.warn(`Path ${path} returned status:`, response.status);
					}
				} catch (pathError) {
					console.warn(`Path ${path} failed:`, pathError);
				}
			}

			if (response && response.ok && data) {
				// Transform the Netlify function response to match expected format
				const transformedResult: SeedingResult = {
					success: data.success || false,
					message: `${data.message || 'Seeding process started'} (via ${successfulPath})`,
					environment: data.environment || 'production',
					timestamp: data.timestamp || new Date().toISOString(),
					status: 'running',
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
				throw new Error('Failed to trigger seeding - all function paths failed');
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
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
			
			const response = await fetch(`${herokuUrl}/status/${jobId}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
				mode: 'cors',
				signal: controller.signal
			});
			
			clearTimeout(timeoutId);

			if (response.ok) {
				const statusData = await response.json();
				console.log('Status check response:', statusData);
				
				// Update result with current status
				if (statusData.status === 'completed' && statusData.result && result) {
					setResult({
						success: true,
						message: 'Seeding completed successfully',
						environment: 'production',
						timestamp: result.timestamp, // Keep original trigger time
						status: 'completed',
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
					setLastStatusCheck(`✅ Completed at ${new Date().toLocaleString()}`);
					setLastCompletedJobDuration(statusData.result.duration || 0);
				} else if (statusData.status === 'failed' && result) {
					setResult({
						success: false,
						message: 'Seeding failed',
						environment: 'production',
						timestamp: result.timestamp, // Keep original trigger time
						status: 'failed',
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
					setLastStatusCheck(`❌ Failed at ${new Date().toLocaleString()}`);
					setLastCompletedJobDuration(0); // Reset duration for failed jobs
				} else if (statusData.status === 'not_found') {
					setResult(null); // Clear result if not found
					setError('Job ID not found. Please trigger seeding again.');
					setLastStatusCheck(`❌ Job ID not found. Please trigger seeding again.`);
				} else if (result) {
					setResult({
						success: true,
						message: `Seeding in progress: ${statusData.currentStep || 'Processing data sources'}`,
						environment: 'production',
						timestamp: result.timestamp, // Keep original trigger time
						status: 'running',
						progress: statusData.progress || 0,
						currentStep: statusData.currentStep || 'Processing data sources',
						result: {
							success: true,
							exitCode: 0,
							nodesCreated: statusData.result?.nodesCreated || 0,
							relationshipsCreated: statusData.result?.relationshipsCreated || 0,
							errorCount: statusData.result?.errors?.length || 0,
							errors: statusData.result?.errors || [],
							duration: statusData.result?.duration || 0
						}
					});
					setLastStatusCheck(`🔄 Last checked at ${new Date().toLocaleString()}`);
				}
			} else {
				const errorText = await response.text().catch(() => 'Unknown error');
				setError(`Failed to check status - HTTP ${response.status}: ${errorText}`);
			}
		} catch (err) {
			console.error('Status check error:', err);
			let errorMessage = 'Network error';
			if (err instanceof Error) {
				if (err.name === 'AbortError') {
					errorMessage = 'Request timed out after 10 seconds';
				} else {
					errorMessage = err.message;
				}
			}
			setError(`Status check failed: ${errorMessage}`);
		} finally {
			setStatusCheckLoading(false);
		}
	};

	const checkStatusForJob = async (specificJobId: string) => {
		setStatusCheckLoading(true);
		setError(null);

		try {
			const herokuUrl = process.env.NEXT_PUBLIC_HEROKU_SEEDER_URL || 'https://database-dorkinians-4bac3364a645.herokuapp.com';
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
			
			const response = await fetch(`${herokuUrl}/status/${specificJobId}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
				mode: 'cors',
				signal: controller.signal
			});
			
			clearTimeout(timeoutId);

			if (response.ok) {
				const statusData = await response.json();
				console.log('Status check response for specific job:', statusData);
				
				// Create a new result for this specific job
				const newResult: SeedingResult = {
					success: statusData.status !== 'failed',
					message: statusData.status === 'completed' ? 'Seeding completed successfully' : 
							 statusData.status === 'failed' ? 'Seeding failed' : 
							 `Seeding in progress: ${statusData.currentStep || 'Processing data sources'}`,
					environment: 'production',
					timestamp: statusData.startTime || new Date().toISOString(),
					status: statusData.status === 'completed' ? 'completed' : 
							statusData.status === 'failed' ? 'failed' : 
							statusData.status === 'running' ? 'running' : 'pending',
					progress: statusData.progress,
					currentStep: statusData.currentStep,
					result: {
						success: statusData.status !== 'failed',
						exitCode: statusData.status === 'failed' ? 1 : 0,
						nodesCreated: statusData.result?.nodesCreated || 0,
						relationshipsCreated: statusData.result?.relationshipsCreated || 0,
						errorCount: statusData.result?.errors?.length || 0,
						errors: statusData.result?.errors || [],
						duration: statusData.result?.duration || 0
					}
				};
				
				setResult(newResult);
				setJobId(specificJobId);
				setLastStatusCheck(`🔍 Status checked for job ${specificJobId} at ${new Date().toLocaleString()}`);
				
				// Update last completed job duration if this job completed successfully
				if (statusData.status === 'completed' && statusData.result?.duration) {
					setLastCompletedJobDuration(statusData.result.duration);
				}
			} else {
				setError('Failed to check status for specific job');
			}
		} catch (err) {
			let errorMessage = 'Network error';
			if (err instanceof Error) {
				if (err.name === 'AbortError') {
					errorMessage = 'Request timed out after 10 seconds';
				} else {
					errorMessage = err.message;
				}
			}
			setError(`Status check failed: ${errorMessage}`);
		} finally {
			setStatusCheckLoading(false);
		}
	};

	const getStatusDisplay = () => {
		if (!result) return null;
		
		switch (result.status) {
			case 'pending':
				return { text: 'Pending', color: 'text-yellow-600', bg: 'border-yellow-200 bg-yellow-50' };
			case 'running':
				return { text: 'Running', color: 'text-blue-600', bg: 'border-blue-200 bg-blue-50' };
			case 'completed':
				return { text: 'Completed', color: 'text-green-600', bg: 'border-green-200 bg-green-50' };
			case 'failed':
				return { text: 'Failed', color: 'text-red-600', bg: 'border-red-200 bg-red-50' };
			default:
				return { text: 'Unknown', color: 'text-gray-600', bg: 'border-gray-200 bg-gray-50' };
		}
	};

	const getValueDisplay = (value: number, label: string) => {
		if (result?.status === 'pending' || result?.status === 'running') {
			return { display: '⏳', label: `${label} (Pending)` };
		}
		return { display: value.toString(), label };
	};

	const statusInfo = getStatusDisplay();

	return (
		<div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
			<h2 className="text-2xl font-bold text-gray-900 mb-6">Database Seeding Admin Panel</h2>
			
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

			{/* Configuration Section */}
			<div className="mb-6 p-4 bg-gray-50 rounded-lg">
				<p className="text-sm text-gray-600 mt-2">
					⚠️ This will seed the production Neo4j database with data from Google Sheets.
				</p>
			</div>

			{/* Status Check Button */}
			<div className="mb-6 ">
				<button
					onClick={checkStatus}
					disabled={statusCheckLoading || !jobId}
					className={`px-6 py-3 mr-4 rounded-lg font-semibold text-white transition-colors ${
						statusCheckLoading || !jobId
							? 'bg-gray-400 cursor-not-allowed'
							: 'bg-purple-600 hover:bg-purple-700'
					}`}
				>
					{statusCheckLoading ? '🔄 Checking Status...' : '🔍 Check Seeding Status'}
				</button>
				<button
					onClick={async () => {
						setJobsLoading(true);
						setError(null);
						try {
							const herokuUrl = process.env.NEXT_PUBLIC_HEROKU_SEEDER_URL || 'https://database-dorkinians-4bac3364a645.herokuapp.com';
							const controller = new AbortController();
							const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
							
							const response = await fetch(`${herokuUrl}/jobs`, {
								method: 'GET',
								headers: {
									'Content-Type': 'application/json',
								},
								mode: 'cors',
								signal: controller.signal
							});
							
							clearTimeout(timeoutId);
							
							if (response.ok) {
								const data = await response.json();
								console.log('All jobs on Heroku:', data);
								setJobsData(data);
								setShowJobsModal(true);
							} else {
								throw new Error(`HTTP ${response.status}: ${response.statusText}`);
							}
						} catch (err) {
							console.error('Failed to fetch jobs:', err);
							let errorMessage = 'Failed to fetch jobs';
							if (err instanceof Error) {
								if (err.name === 'AbortError') {
									errorMessage = 'Request timed out after 10 seconds';
								} else {
									errorMessage = err.message;
								}
							}
							setError(`Failed to fetch jobs: ${errorMessage}`);
						} finally {
							setJobsLoading(false);
						}
					}}
					className="mt-2 px-6 py-3 rounded-lg font-semibold text-white transition-colors bg-gray-600 hover:bg-gray-700"
				>
					{jobsLoading ? '⏳ Loading...' : '🔍 Debug: List All Jobs'}
				</button>
				{lastStatusCheck && (
					<p className="text-sm text-gray-600 mt-2">{lastStatusCheck}</p>
				)}
				{jobId && (
					<p className="text-xs text-gray-500 mt-1">Current Job ID: {jobId}</p>
				)}
				
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
				<div className={`mb-6 p-4 rounded-lg border ${statusInfo?.bg}`}>
					<div className="mb-3">
						<h3 className={`text-lg font-semibold ${statusInfo?.color}`}>
							{result.status === 'running' ? '🔄 Seeding in Progress...' : 'Seeding Status'}
						</h3>
					</div>
					
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
						<div>
							<p className="text-sm text-gray-600">Environment</p>
							<p className="font-semibold">{result.environment.charAt(0).toUpperCase() + result.environment.slice(1)}</p>
						</div>
						<div>
							<p className="text-sm text-gray-600">Timestamp</p>
							<p className="font-semibold">{new Date(result.timestamp).toLocaleString()}</p>
						</div>
						<div>
							<p className="text-sm text-gray-600">Status</p>
							<p className={`font-semibold ${statusInfo?.color}`}>
								{statusInfo?.text}
							</p>
						</div>
						<div>
							<p className="text-sm text-gray-600">Elapsed Time</p>
							<p className="font-semibold text-blue-600">
								{elapsedTime > 0 ? formatElapsedTime(elapsedTime) : '0s'}
							</p>
						</div>
					</div>

					{/* Progress Indicator - Moved above statistics */}
					{(result.status === 'pending' || result.status === 'running') && (
						<div className="mb-4 p-4 bg-blue-100 border border-blue-300 rounded-lg">
							<div className="flex items-center gap-3">
								<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
								<div className="flex-1">
									<p className="font-semibold text-blue-800">Seeding in Progress</p>
									<p className="text-sm text-blue-600">
										{result.status === 'pending' 
											? 'Initializing seeding process...' 
											: result.currentStep || 'Processing 10 data sources from Google Sheets...'
										}
									</p>
									{result.progress !== undefined && (
										<div className="mt-2">
											<div className="flex justify-between text-xs text-blue-600 mb-1">
												<span>Progress</span>
												<span>{result.progress}%</span>
											</div>
											<div className="w-full bg-blue-200 rounded-full h-2">
												<div 
													className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
													style={{ width: `${result.progress}%` }}
												></div>
											</div>
										</div>
									)}
									<p className="text-xs text-blue-500 mt-2">
										Elapsed: {formatElapsedTime(elapsedTime)} | Expected duration: {lastCompletedJobDuration !== null ? formatElapsedTime(lastCompletedJobDuration) : '~30 minutes'}
									</p>
									<p className="text-xs text-blue-500">
										Check your email for start and completion notifications.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Final Statistics */}
					{result.status === 'completed' && (
						<div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
							<h4 className="text-md font-semibold text-blue-800 mb-3">🎯 Final Results</h4>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div className="text-center p-3 bg-white rounded-lg">
									<p className="text-2xl font-bold text-blue-600">
										{getValueDisplay(result.result.nodesCreated, 'Nodes Created').display}
									</p>
									<p className="text-sm text-gray-600">
										{getValueDisplay(result.result.nodesCreated, 'Nodes Created').label}
									</p>
								</div>
								<div className="text-center p-3 bg-white rounded-lg">
									<p className="text-2xl font-bold text-green-600">
										{getValueDisplay(result.result.relationshipsCreated, 'Relationships Created').display}
									</p>
									<p className="text-sm text-gray-600">
										{getValueDisplay(result.result.relationshipsCreated, 'Relationships Created').label}
									</p>
								</div>
								<div className="text-center p-3 bg-white rounded-lg">
									<p className="text-2xl font-bold text-red-600">
										{getValueDisplay(result.result.errorCount, 'Errors Found').display}
									</p>
									<p className="text-sm text-gray-600">
										{getValueDisplay(result.result.errorCount, 'Errors Found').label}
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
				<h3 className="text-lg font-semibold text-blue-800 mb-2">How the Database Seeding Process Works</h3>
				<ul className="text-blue-700 text-sm space-y-2">
					<li>• <strong>Step 1:</strong> Click &ldquo;Trigger Database Seeding&rdquo; to start the process. This triggers the Netlify function to make the call to Heroku and provides immediate feedback that the database seeding process has started</li>
					<li>• <strong>Step 2:</strong> The system will show &ldquo;Pending&rdquo; status while initializing</li>
					<li>• <strong>Step 3:</strong> Status changes to &ldquo;Running&rdquo; as the seeding begins on Heroku</li>
					<li>• <strong>Step 4:</strong> Use &ldquo;Check Seeding Status&rdquo; to monitor progress and get final results</li>
					<li>• <strong>Step 5:</strong> If you need to check the status of a specific job, use &ldquo;Debug: List All Jobs&rdquo; to view all jobs and their statuses. Click on the job ID to check its current status.</li>
					<li>• <strong>Note:</strong> Check your email for completion notifications</li>
				</ul>
			</div>

			{/* Jobs Modal */}
			{showJobsModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-semibold text-gray-800">All Jobs on Heroku</h3>
							<button
								onClick={() => setShowJobsModal(false)}
								className="text-gray-500 hover:text-gray-700 text-xl font-bold"
							>
								×
							</button>
						</div>
						
						{jobsData ? (
							<div>
								<div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
									<p className="text-sm text-blue-800">
										<strong>Total Jobs:</strong> {jobsData.totalJobs}
									</p>
								</div>
								
								{Object.keys(jobsData.jobs).length > 0 ? (
									<div className="space-y-3">
										{Object.entries(jobsData.jobs)
											.sort(([, a], [, b]) => {
												// Sort by startTime descending (most recent first)
												const timeA = (a as any).startTime ? new Date((a as any).startTime).getTime() : 0;
												const timeB = (b as any).startTime ? new Date((b as any).startTime).getTime() : 0;
												return timeB - timeA;
											})
											.map(([jobId, jobData]: [string, any]) => (
											<div key={jobId} className="p-3 border border-gray-200 rounded-lg">
												<div className="flex justify-between items-start mb-2">
													<div className="flex-1">
														<p className="font-semibold text-gray-800">Job ID: {jobId}</p>
														<p className="text-sm text-gray-600">
															Status: <span className={`font-medium ${
																jobData.status === 'completed' ? 'text-green-600' :
																jobData.status === 'failed' ? 'text-red-600' :
																jobData.status === 'running' ? 'text-blue-600' :
																'text-gray-600'
															}`}>
																{jobData.status}
															</span>
														</p>
														{jobData.currentStep && (
															<p className="text-sm text-gray-600">
																Current Step: {jobData.currentStep}
															</p>
														)}
														{jobData.progress !== undefined && (
															<p className="text-sm text-gray-600">
																Progress: {jobData.progress}%
															</p>
														)}
														{jobData.startTime && (
														<p className="text-sm text-gray-600">
															Started: {new Date(jobData.startTime).toLocaleString()}
														</p>
														)}
														<button
														onClick={() => {
															// Close modal and set up status checking for this job
															setShowJobsModal(false);
															setJobId(jobId);
															// Trigger status check for this specific job
															checkStatusForJob(jobId);
														}}
														className="ml-3 px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
													>
														Check Status
													</button>
													</div>
													
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="text-center py-8 text-gray-500">
										<p>No jobs found</p>
									</div>
								)}
							</div>
						) : (
							<div className="text-center py-8 text-gray-500">
								<p>Loading jobs...</p>
							</div>
						)}
						
						<div className="mt-6 flex justify-end">
							<button
								onClick={() => setShowJobsModal(false)}
								className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded"
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
