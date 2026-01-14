"use client";

import { useState, useEffect, useRef } from "react";
import { seedingStatusService } from "@/lib/services/seedingStatusService";

interface SeedingResult {
	success: boolean;
	message: string;
	environment: string;
	timestamp: string;
	status: "pending" | "running" | "completed" | "failed" | "heroku_down" | "critical_failure";
	progress?: number;
	currentStep?: string;
	progressDetails?: {
		currentNodeCount?: number;
		[key: string]: any;
	};
	result: {
		success: boolean;
		exitCode: number;
		nodesCreated: number;
		relationshipsCreated: number;
		errorCount: number;
		errors: string[];
		duration: number;
	};
	// Enhanced error information
	errorDetails?: {
		type: string;
		message: string;
		statusCode?: number;
		healthCheck?: any;
		timestamp: string;
	};
	// Enhanced error context information
	errorContext?: {
		jobId: string;
		environment: string;
		errorType: string;
		errorMessage: string;
		errorStack: string;
		errorName: string;
		errorCode?: string;
		duration: number;
		step: string;
		memoryUsage: {
			rss: number;
			heapTotal: number;
			heapUsed: number;
			external: number;
			arrayBuffers: number;
		};
		timestamp: string;
	};
}

export default function AdminPanelEnhanced() {
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

	// Email configuration state
	const [emailAddress, setEmailAddress] = useState("bangsluke@gmail.com");
	const [sendEmailAtStart, setSendEmailAtStart] = useState(false);
	const [sendEmailAtCompletion, setSendEmailAtCompletion] = useState(true);

	// Chatbot test state
	const [chatbotTestLoading, setChatbotTestLoading] = useState(false);
	const [chatbotTestResult, setChatbotTestResult] = useState<any>(null);

	// Enhanced health monitoring state
	const [herokuHealth, setHerokuHealth] = useState<{
		status: 'unknown' | 'healthy' | 'unhealthy' | 'down';
		lastChecked: string | null;
		error: string | null;
	}>({
		status: 'unknown',
		lastChecked: null,
		error: null
	});

	// Check if we're in development mode
	const isDevelopment = process.env.NODE_ENV === "development";

	const startTimeRef = useRef<number | null>(null);
	const timerRef = useRef<NodeJS.Timeout | null>(null);

	// Enhanced health check function
	const checkHerokuHealth = async () => {
		try {
			const herokuUrl = process.env.NEXT_PUBLIC_HEROKU_SEEDER_URL || "https://dorkinians-database-v3-0e9a731483c7.herokuapp.com/";
			const response = await fetch(`${herokuUrl}/health`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
				mode: 'cors',
				signal: AbortSignal.timeout(10000) // 10 second timeout
			});

			if (response.ok) {
				const healthData = await response.json();
				setHerokuHealth({
					status: 'healthy',
					lastChecked: new Date().toISOString(),
					error: null
				});
				return true;
			} else {
				setHerokuHealth({
					status: 'unhealthy',
					lastChecked: new Date().toISOString(),
					error: `HTTP ${response.status}`
				});
				return false;
			}
		} catch (error) {
			setHerokuHealth({
				status: 'down',
				lastChecked: new Date().toISOString(),
				error: error instanceof Error ? error.message : 'Unknown error'
			});
			return false;
		}
	};

	// Auto health check on component mount
	useEffect(() => {
		checkHerokuHealth();
	}, []);

	// Timer effect
	useEffect(() => {
		if (startTimeRef.current && (result?.status === "pending" || result?.status === "running")) {
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

		// Use backend duration when job is completed
		if (result?.status === "completed" && result?.result?.duration) {
			setElapsedTime(Math.floor(result.result.duration / 1000)); // Convert ms to seconds
		}

		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current);
			}
		};
	}, [result?.status, result?.result?.duration]);

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

	// Calculate elapsed time from job start time
	const calculateElapsedTimeFromStartTime = (startTime: string) => {
		const start = new Date(startTime);
		const now = new Date();
		return Math.floor((now.getTime() - start.getTime()) / 1000);
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
				message: "Database seeding initiated successfully",
				environment: "production",
				timestamp: new Date().toISOString(),
				status: "pending",
				result: {
					success: true,
					exitCode: 0,
					nodesCreated: 0,
					relationshipsCreated: 0,
					errorCount: 0,
					errors: [],
					duration: 0,
				},
			});

			// Try different paths for the Netlify function
			const functionPaths = ["/.netlify/functions/trigger-seed", "/api/trigger-seed", "/trigger-seed"];

			let response = null;
			let data = null;
			let successfulPath = "";

			for (const path of functionPaths) {
				try {
					console.log(`Trying function path: ${path}`);
					response = await fetch(`${path}?environment=production`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							environment: "production",
							emailConfig: {
								emailAddress: emailAddress,
								sendEmailAtStart: sendEmailAtStart,
								sendEmailAtCompletion: sendEmailAtCompletion,
							},
						}),
					});

					if (response.ok) {
						const contentType = response.headers.get("content-type");
						if (contentType && contentType.includes("application/json")) {
							data = await response.json();
							successfulPath = path;
							console.log(`✅ Success with path: ${path}`);
							console.log("Function response:", data);
							break;
						} else {
							console.warn(`Path ${path} returned non-JSON response:`, contentType);
							const textResponse = await response.text();
							console.warn("Response preview:", textResponse.substring(0, 200));
						}
					} else {
						console.warn(`Path ${path} returned status:`, response.status);
					}
				} catch (pathError) {
					console.warn(`Path ${path} failed:`, pathError);
				}
			}

			if (response && response.ok && data) {
				// Check for critical failures in the response
				if (data.status === "failed" || data.error?.includes("CRITICAL") || data.error?.includes("Heroku")) {
					// This is a critical failure - show immediate feedback
					const transformedResult: SeedingResult = {
						success: false,
						message: data.message || "CRITICAL FAILURE: Database seeding service is down",
						environment: data.environment || "production",
						timestamp: data.timestamp || new Date().toISOString(),
						status: "critical_failure",
						result: {
							success: false,
							exitCode: 1,
							nodesCreated: 0,
							relationshipsCreated: 0,
							errorCount: 1,
							errors: [data.error || "Critical service failure"],
							duration: 0,
						},
						errorDetails: {
							type: "Critical Service Failure",
							message: data.error || "Database seeding service is unavailable",
							statusCode: response.status,
							healthCheck: data.healthCheck,
							timestamp: new Date().toISOString()
						}
					};

					setResult(transformedResult);
					setError(`🚨 CRITICAL FAILURE: ${data.error || "Database seeding service is down"}`);
					setLastStatusCheck(`❌ CRITICAL FAILURE detected at ${new Date().toLocaleString()}`);
					
					// Update health status
					setHerokuHealth({
						status: 'down',
						lastChecked: new Date().toISOString(),
						error: data.error || "Service is down"
					});

					// Update seeding status service for critical failure
					seedingStatusService.updateSeedingFailure({
						jobId: data.jobId || "unknown",
						timestamp: new Date().toISOString(),
						duration: 0,
					});
				} else {
					// Normal success case
					const transformedResult: SeedingResult = {
						success: data.success || false,
						message: `${data.message || "Seeding process started"} (via ${successfulPath})`,
						environment: data.environment || "production",
						timestamp: data.timestamp || new Date().toISOString(),
						status: "running",
						result: {
							success: data.success || false,
							exitCode: data.success ? 0 : 1,
							nodesCreated: 0, // Will be updated when status is checked
							relationshipsCreated: 0, // Will be updated when status is checked
							errorCount: 0,
							errors: [],
							duration: 0,
						},
					};

					setResult(transformedResult);
					// Extract job ID for status checking
					if (data.jobId) {
						setJobId(data.jobId);
						// Update seeding status service for start
						seedingStatusService.updateSeedingStart({
							jobId: data.jobId,
							timestamp: data.timestamp || new Date().toISOString(),
						});
					}
				}
			} else {
				throw new Error("Failed to trigger seeding - all function paths failed");
			}
		} catch (err) {
			console.error("Seeding trigger error:", err);
			setError(err instanceof Error ? err.message : "Network error");
		} finally {
			setIsLoading(false);
		}
	};

	// Enhanced status check with immediate problem detection
	const checkStatus = async () => {
		if (!jobId) {
			setError("No job ID available. Please trigger seeding first.");
			return;
		}

		setStatusCheckLoading(true);
		setError(null);

		let controller: AbortController | null = null;
		let timeoutId: NodeJS.Timeout | null = null;

		try {
			const herokuUrl = process.env.NEXT_PUBLIC_HEROKU_SEEDER_URL || "https://dorkinians-database-v3-0e9a731483c7.herokuapp.com/";
			controller = new AbortController();
			timeoutId = setTimeout(() => {
				if (controller && !controller.signal.aborted) {
					controller.abort();
				}
			}, 10000); // 10 second timeout

			const response = await fetch(`${herokuUrl}/status/${jobId}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				mode: "cors",
				signal: controller.signal,
			});

			if (response.ok) {
				const statusData = await response.json();
				console.log("Status check response:", statusData);

				// Check for critical errors in status response
				if (statusData.status === "error" || statusData.error) {
					// This is a critical error - show immediate feedback
					setResult({
						success: false,
						message: "CRITICAL ERROR: Database seeding service has failed",
						environment: "production",
						timestamp: result?.timestamp || new Date().toISOString(),
						status: "critical_failure",
						result: {
							success: false,
							exitCode: 1,
							nodesCreated: 0,
							relationshipsCreated: 0,
							errorCount: 1,
							errors: [statusData.error || "Critical service error"],
							duration: 0,
						},
						errorDetails: {
							type: "Critical Service Error",
							message: statusData.error || "Database seeding service has failed",
							statusCode: response.status,
							timestamp: new Date().toISOString()
						}
					});
					setError(`🚨 CRITICAL ERROR: ${statusData.error || "Database seeding service has failed"}`);
					setLastStatusCheck(`❌ CRITICAL ERROR detected at ${new Date().toLocaleString()}`);
					
					// Update health status
					setHerokuHealth({
						status: 'down',
						lastChecked: new Date().toISOString(),
						error: statusData.error || "Service error"
					});

					// Update seeding status service for critical failure
					seedingStatusService.updateSeedingFailure({
						jobId: jobId || "unknown",
						timestamp: new Date().toISOString(),
						duration: 0,
					});
					return;
				}

				// Normal status processing (existing logic)
				// ... (rest of existing status check logic)
				
			} else {
				// HTTP error - this could be a critical failure
				const errorText = await response.text().catch(() => "Unknown error");
				
				if (response.status === 503 || response.status === 500) {
					// This is likely a service down error
					setResult({
						success: false,
						message: "CRITICAL FAILURE: Database seeding service is down",
						environment: "production",
						timestamp: result?.timestamp || new Date().toISOString(),
						status: "heroku_down",
						result: {
							success: false,
							exitCode: 1,
							nodesCreated: 0,
							relationshipsCreated: 0,
							errorCount: 1,
							errors: [`HTTP ${response.status}: ${errorText}`],
							duration: 0,
						},
						errorDetails: {
							type: "Service Down",
							message: `HTTP ${response.status}: ${errorText}`,
							statusCode: response.status,
							timestamp: new Date().toISOString()
						}
					});
					setError(`🚨 CRITICAL FAILURE: Database seeding service is down (HTTP ${response.status})`);
					setLastStatusCheck(`❌ SERVICE DOWN detected at ${new Date().toLocaleString()}`);
					
					// Update health status
					setHerokuHealth({
						status: 'down',
						lastChecked: new Date().toISOString(),
						error: `HTTP ${response.status}: ${errorText}`
					});

					// Update seeding status service for critical failure
					seedingStatusService.updateSeedingFailure({
						jobId: jobId || "unknown",
						timestamp: new Date().toISOString(),
						duration: 0,
					});
				} else {
					setError(`Failed to check status - HTTP ${response.status}: ${errorText}`);
				}
			}
		} catch (err) {
			console.error("Status check error:", err);
			let errorMessage = "Network error";
			if (err instanceof Error) {
				if (err.name === "AbortError") {
					errorMessage = "Request timed out after 10 seconds";
				} else {
					errorMessage = err.message;
				}
			}
			setError(`Status check failed: ${errorMessage}`);
		} finally {
			// Ensure proper cleanup of timeout and controller
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			if (controller && !controller.signal.aborted) {
				controller.abort();
			}
			controller = null;
			setStatusCheckLoading(false);
		}
	};

	// ... (rest of existing methods)

	const getStatusDisplay = () => {
		if (!result) return null;

		switch (result.status) {
			case "pending":
				return { text: "Pending", color: "text-yellow-600", bg: "border-yellow-200 bg-yellow-50" };
			case "running":
				return { text: "Running", color: "text-blue-600", bg: "border-blue-200 bg-blue-50" };
			case "completed":
				return { text: "Completed", color: "text-green-600", bg: "border-green-200 bg-green-50" };
			case "failed":
				return { text: "Failed", color: "text-red-600", bg: "border-red-200 bg-red-50" };
			case "heroku_down":
				return { text: "🚨 SERVICE DOWN", color: "text-red-800", bg: "border-red-400 bg-red-100" };
			case "critical_failure":
				return { text: "🚨 CRITICAL FAILURE", color: "text-red-800", bg: "border-red-400 bg-red-100" };
			default:
				return { text: "Unknown", color: "text-gray-600", bg: "border-gray-200 bg-gray-50" };
		}
	};

	const getValueDisplay = (value: number, label: string) => {
		if (result?.status === "pending" || result?.status === "running") {
			return { display: "⏳", label: `${label} (Pending)` };
		}
		return { display: value.toString(), label };
	};

	const triggerChatbotTest = async () => {
		setChatbotTestLoading(true);
		setError(null);
		setChatbotTestResult(null);

		try {
			const response = await fetch("/api/chatbot-test", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					emailAddress: emailAddress,
				}),
			});

			if (response.ok) {
				const data = await response.json();
				setChatbotTestResult({
					success: true,
					message: "Chatbot test completed successfully",
					timestamp: new Date().toISOString(),
					...data,
				});
			} else {
				const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
				throw new Error(errorData.message || `HTTP ${response.status}`);
			}
		} catch (err) {
			console.error("Chatbot test error:", err);
			setError(err instanceof Error ? err.message : "Network error");
		} finally {
			setChatbotTestLoading(false);
		}
	};

	const statusInfo = getStatusDisplay();

	return (
		<div className='max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg'>
			<h2 className='text-2xl font-bold text-gray-900 mb-6'>Database Seeding Admin Panel</h2>

			{/* Enhanced Health Status Display */}
			<div className='mb-6 p-4 bg-gray-50 rounded-lg'>
				<h3 className='text-lg font-semibold text-gray-800 mb-2'>🔍 Service Health Status</h3>
				<div className='flex items-center justify-between'>
					<div className='flex items-center gap-3'>
						<div className={`w-3 h-3 rounded-full ${
							herokuHealth.status === 'healthy' ? 'bg-green-500' :
							herokuHealth.status === 'unhealthy' ? 'bg-yellow-500' :
							herokuHealth.status === 'down' ? 'bg-red-500' : 'bg-gray-500'
						}`}></div>
						<span className={`font-medium ${
							herokuHealth.status === 'healthy' ? 'text-green-600' :
							herokuHealth.status === 'unhealthy' ? 'text-yellow-600' :
							herokuHealth.status === 'down' ? 'text-red-600' : 'text-gray-600'
						}`}>
							{herokuHealth.status === 'healthy' ? '✅ Healthy' :
							 herokuHealth.status === 'unhealthy' ? '⚠️ Unhealthy' :
							 herokuHealth.status === 'down' ? '🚨 DOWN' : '❓ Unknown'}
						</span>
					</div>
					<div className='text-sm text-gray-600'>
						{herokuHealth.lastChecked && `Last checked: ${new Date(herokuHealth.lastChecked).toLocaleTimeString()}`}
					</div>
				</div>
				{herokuHealth.error && (
					<div className='mt-2 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-700'>
						<strong>Error:</strong> {herokuHealth.error}
					</div>
				)}
				<button
					onClick={checkHerokuHealth}
					className='mt-2 px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded'
				>
					🔄 Refresh Health Check
				</button>
			</div>

			{/* Email Configuration Section */}
			<div className='mb-6 p-4 bg-gray-50 rounded-lg'>
				<h3 className='text-lg font-semibold text-gray-800 mb-2'>Email Notifications</h3>
				<div className='space-y-4'>
					<div>
						<label htmlFor='emailAddress' className='block text-sm font-medium text-gray-700'>
							Email Address for Notifications:
						</label>
						<input
							type='email'
							id='emailAddress'
							value={emailAddress}
							onChange={(e) => setEmailAddress(e.target.value)}
							placeholder='bangsluke@gmail.com'
							className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm placeholder-gray-600'
						/>
					</div>
					<div className='flex items-center'>
						<input
							type='checkbox'
							id='sendEmailAtStart'
							checked={sendEmailAtStart}
							onChange={(e) => setSendEmailAtStart(e.target.checked)}
							className='mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
						/>
						<label htmlFor='sendEmailAtStart' className='text-sm text-gray-700'>
							Send email when seeding starts
						</label>
					</div>
					<div className='flex items-center'>
						<input
							type='checkbox'
							id='sendEmailAtCompletion'
							checked={sendEmailAtCompletion}
							onChange={(e) => setSendEmailAtCompletion(e.target.checked)}
							className='mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
						/>
						<label htmlFor='sendEmailAtCompletion' className='text-sm text-gray-700'>
							Send email when seeding completes
						</label>
					</div>
				</div>
			</div>

			{/* Action Buttons */}
			<div className='mb-6 flex justify-center gap-4 flex-wrap'>
				<button
					onClick={triggerSeeding}
					disabled={isLoading}
					className={`w-64 px-6 py-3 rounded-lg text-xs font-semibold text-white transition-colors ${
						isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
					}`}>
					{isLoading ? "🔄 Triggering..." : "🚀 Trigger Production Seeding"}
				</button>
				<button
					onClick={triggerChatbotTest}
					disabled={chatbotTestLoading}
					className={`w-64 px-6 py-3 rounded-lg text-xs font-semibold text-white transition-colors ${
						chatbotTestLoading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
					}`}>
					{chatbotTestLoading ? "🔄 Testing..." : "🤖 Run Chatbot Test & Email"}
				</button>
				<button
					onClick={checkStatus}
					disabled={statusCheckLoading || !jobId}
					className={`w-64 px-6 py-3 rounded-lg text-xs font-semibold text-white transition-colors ${
						statusCheckLoading || !jobId ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
					}`}>
					{statusCheckLoading ? "🔄 Checking Status..." : "🔍 Check Production Status"}
				</button>
			</div>

			{/* Enhanced Error Display with Critical Failure Detection */}
			{error && (
				<div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg'>
					<h3 className='text-lg font-semibold text-red-800 mb-2'>❌ Error</h3>
					<p className='text-red-700 mb-2'>{error}</p>

					{/* Critical Failure Analysis */}
					{error.includes("CRITICAL") && (
						<div className='mt-3 p-3 bg-red-100 border border-red-300 rounded'>
							<h4 className='text-sm font-semibold text-red-800 mb-2'>🚨 CRITICAL FAILURE DETECTED:</h4>
							<ul className='text-sm text-red-700 space-y-1'>
								<li>• The database seeding service is completely down</li>
								<li>• No jobs can be started or processed</li>
								<li>• This is a critical infrastructure failure</li>
								<li>• Check your email for detailed failure notification</li>
								<li>• Contact system administrator immediately</li>
							</ul>
						</div>
					)}

					{/* Service Down Analysis */}
					{error.includes("SERVICE DOWN") && (
						<div className='mt-3 p-3 bg-red-100 border border-red-300 rounded'>
							<h4 className='text-sm font-semibold text-red-800 mb-2'>🚨 SERVICE DOWN:</h4>
							<ul className='text-sm text-red-700 space-y-1'>
								<li>• The Heroku application is not responding</li>
								<li>• All database operations are unavailable</li>
								<li>• Check Heroku dashboard for application status</li>
								<li>• Review Heroku logs for crash details</li>
								<li>• Consider restarting the Heroku application</li>
							</ul>
						</div>
					)}

					<div className='mt-3 p-3 bg-red-100 border border-red-300 rounded'>
						<h4 className='text-sm font-semibold text-red-800 mb-2'>🔍 Troubleshooting Steps:</h4>
						<ul className='text-sm text-red-700 space-y-1'>
							<li>• Check if the Heroku seeder service is running</li>
							<li>• Verify network connectivity to Heroku</li>
							<li>• Check the browser console for additional error details</li>
							<li>• Try refreshing the page and attempting again</li>
							<li>• If the issue persists, check the Heroku logs for detailed error information</li>
						</ul>
					</div>
				</div>
			)}

			{/* Enhanced Result Display with Critical Failure Status */}
			{result && (
				<div className={`mb-6 p-4 rounded-lg border ${statusInfo?.bg}`}>
					<div className='mb-3'>
						<h3 className={`text-lg font-semibold ${statusInfo?.color}`}>
							{result.status === "critical_failure" ? "🚨 CRITICAL FAILURE" :
							 result.status === "heroku_down" ? "🚨 SERVICE DOWN" :
							 result.status === "running" ? "🔄 Seeding in Progress..." : "Seeding Status"}
						</h3>
					</div>

					{/* Critical Failure Details */}
					{result.status === "critical_failure" && result.errorDetails && (
						<div className='mb-4 p-4 bg-red-100 border border-red-300 rounded-lg'>
							<h4 className='text-md font-semibold text-red-800 mb-3'>🚨 Critical Failure Details</h4>
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								<div>
									<p className='text-sm text-gray-800 font-medium'>Error Type</p>
									<p className='font-semibold text-red-900'>{result.errorDetails.type}</p>
								</div>
								<div>
									<p className='text-sm text-gray-800 font-medium'>Status Code</p>
									<p className='font-semibold text-red-900'>{result.errorDetails.statusCode}</p>
								</div>
								<div className='md:col-span-2'>
									<p className='text-sm text-gray-800 font-medium'>Error Message</p>
									<p className='font-semibold text-red-900'>{result.errorDetails.message}</p>
								</div>
							</div>
						</div>
					)}

					{/* Rest of existing result display logic */}
					{/* ... (existing result display code) */}
				</div>
			)}

			{/* Rest of existing component */}
			{/* ... (existing component code) */}
		</div>
	);
}
