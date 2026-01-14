"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { seedingStatusService } from "@/lib/services/seedingStatusService";
import JobMonitoringDashboard from "./JobMonitoringDashboard";
import { killJob as killJobUtil } from "../lib/jobUtils";

interface SiteDetails {
	lastSeededStats: string | null;
}

interface SeedingResult {
	success: boolean;
	message: string;
	environment: string;
	timestamp: string;
	status: "pending" | "running" | "completed" | "failed" | "killed";
	progress?: number;
	currentStep?: string;
	progressDetails?: {
		currentNodeCount?: number;
		tableName?: string | null;
		relationshipType?: string | null;
		batchNumber?: number | null;
		totalBatches?: number | null;
		recordsProcessed?: number | null;
		totalRecords?: number | null;
		current?: number | null;
		total?: number | null;
		estimatedTimeRemaining?: number | null;
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
		errorDetails?: {
			type: string;
			message: string;
			name: string;
			code?: string;
			stack?: string;
		};
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

export default function AdminPanel() {
	const router = useRouter();
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
	const [killingJob, setKillingJob] = useState<string | null>(null);

	// Email configuration state
	const [emailAddress, setEmailAddress] = useState("bangsluke@gmail.com");
	const [sendEmailAtStart, setSendEmailAtStart] = useState(false);
	const [sendEmailAtCompletion, setSendEmailAtCompletion] = useState(true);

	// Season configuration state
	const [currentSeason, setCurrentSeason] = useState<string>("");
	const [seasonOverride, setSeasonOverride] = useState<string>("");
	const [useSeasonOverride, setUseSeasonOverride] = useState<boolean>(false);
	const [fullRebuild, setFullRebuild] = useState<boolean>(false);
	const [seasonOverrideError, setSeasonOverrideError] = useState<string>("");
	
	// Debug logs state
	const [debugLogs, setDebugLogs] = useState<boolean>(false);

	// Chatbot test state
	const [chatbotTestLoading, setChatbotTestLoading] = useState(false);
	const [chatbotTestResult, setChatbotTestResult] = useState<any>(null);
	const [chatbotTestError, setChatbotTestError] = useState<string | null>(null);

	// Site details state
	const [siteDetails, setSiteDetails] = useState<SiteDetails | null>(null);

	// Unanswered questions state
	const [unansweredQuestionsLoading, setUnansweredQuestionsLoading] = useState(false);
	const [unansweredQuestions, setUnansweredQuestions] = useState<Array<{ timestamp: string; question: string; playerName: string }>>([]);
	const [unansweredQuestionsError, setUnansweredQuestionsError] = useState<string | null>(null);
	const [clearingQuestions, setClearingQuestions] = useState(false);

	// Debug information state
	const [showDebugInfo, setShowDebugInfo] = useState(false);

	// UI state
	const [showProcessInfo, setShowProcessInfo] = useState(false);
	
	// Toast notification state
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

	// Check if we're in development mode
	const isDevelopment = process.env.NODE_ENV === "development";

	const startTimeRef = useRef<number | null>(null);
	const timerRef = useRef<NodeJS.Timeout | null>(null);

	// Season calculation logic
	const calculateCurrentSeason = (date = new Date()) => {
		const year = date.getFullYear();
		const month = date.getMonth() + 1; // getMonth() returns 0-11
		
		// Before August 1st: Previous year/Current year
		if (month < 8) {
			const previousYear = year - 1;
			const currentYearShort = year.toString().slice(-2);
			return `${previousYear}/${currentYearShort}`;
		}
		
		// August 1st and after: Current year/Next year
		const nextYear = year + 1;
		const nextYearShort = nextYear.toString().slice(-2);
		return `${year}/${nextYearShort}`;
	};

	// Initialize current season on component mount
	useEffect(() => {
		const calculatedSeason = calculateCurrentSeason();
		setCurrentSeason(calculatedSeason);
	}, []);

	// Fetch unanswered questions on component mount
	useEffect(() => {
		fetchUnansweredQuestions();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Season validation function
	const validateSeasonFormat = (season: string): boolean => {
		const seasonRegex = /^\d{4}\/\d{2}$/;
		if (!seasonRegex.test(season)) {
			setSeasonOverrideError("Season must be in format YYYY/YY (e.g., 2024/25)");
			return false;
		}
		
		const [startYear, endYear] = season.split('/');
		const startYearNum = parseInt(startYear);
		const endYearNum = parseInt('20' + endYear);
		
		if (endYearNum !== startYearNum + 1) {
			setSeasonOverrideError("Invalid season format - end year must be start year + 1");
			return false;
		}
		
		setSeasonOverrideError("");
		return true;
	};

	// Handle season override checkbox change with mutual exclusivity
	const handleSeasonOverrideChange = (checked: boolean) => {
		if (checked && fullRebuild) {
			setFullRebuild(false);
		}
		setUseSeasonOverride(checked);
		if (!checked) {
			setSeasonOverride("");
			setSeasonOverrideError("");
		}
	};

	// Handle full rebuild checkbox change with mutual exclusivity
	const handleFullRebuildChange = (checked: boolean) => {
		if (checked && useSeasonOverride) {
			setUseSeasonOverride(false);
			setSeasonOverride("");
			setSeasonOverrideError("");
		}
		setFullRebuild(checked);
	};

	// Handle season override input change with validation
	const handleSeasonOverrideInputChange = (value: string) => {
		setSeasonOverride(value);
		if (value.trim() === "") {
			setSeasonOverrideError("");
		} else {
			validateSeasonFormat(value);
		}
	};

	// Helper function to log to both console and page
	const addDebugLog = (message: string, type: 'info' | 'warn' | 'error' = 'info') => {
		const timestamp = new Date().toLocaleTimeString();
		const logMessage = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
		
		// Log to console
		if (type === 'error') {
			console.error(logMessage);
		} else if (type === 'warn') {
			console.warn(logMessage);
		} else {
			console.log(logMessage);
		}
		
		// Debug logging removed
	};

	// Toast notification function
	const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
		setToastMessage(message);
		setToastType(type);
		
		// Auto-hide toast after 3 seconds
		setTimeout(() => {
			setToastMessage(null);
		}, 3000);
	};

	// Timer effect - simplified since timer management is now handled in status check functions
	useEffect(() => {
		// Only handle cleanup when status changes to non-running states
		if (result?.status === "completed" || result?.status === "failed") {
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
		const secs = Math.round(seconds % 60);

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
		// Validate season override if enabled
		if (useSeasonOverride && seasonOverride.trim() === "") {
			setError("Please enter a season override value when override is enabled.");
			return;
		}
		
		if (useSeasonOverride && seasonOverride.trim() !== "" && !validateSeasonFormat(seasonOverride)) {
			setError(`Invalid season format: ${seasonOverrideError}`);
			return;
		}

		setIsLoading(true);
		setError(null);
		setResult(null);
		setLastStatusCheck(null);
		setElapsedTime(0);
		setShowProcessInfo(false); // Collapse process info when seeding starts
		startTimeRef.current = Date.now();
		addDebugLog("Starting seeding process...");

		// Start the elapsed time timer immediately
		if (timerRef.current) {
			clearInterval(timerRef.current);
		}
		timerRef.current = setInterval(() => {
			if (startTimeRef.current) {
				const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
				setElapsedTime(elapsed);
			}
		}, 1000);

		try {
			// Show immediate feedback that seeding has started
			setResult({
				success: true,
				message: "Database seeding initiated successfully",
				environment: "production",
				timestamp: new Date().toISOString(),
				status: "running",
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
			addDebugLog(`Trying ${functionPaths.length} function paths: ${functionPaths.join(", ")}`);

			let response = null;
			let data = null;
			let successfulPath = "";

			for (const path of functionPaths) {
				try {
					addDebugLog(`Trying function path: ${path}`);
					addDebugLog(`Full URL: ${window.location.origin}${path}`);
					
					const requestBody = {
						environment: "production",
						emailConfig: {
							emailAddress: emailAddress,
							sendEmailAtStart: sendEmailAtStart,
							sendEmailAtCompletion: sendEmailAtCompletion,
						},
						seasonConfig: {
							currentSeason: useSeasonOverride ? seasonOverride : currentSeason,
							useSeasonOverride: useSeasonOverride,
							fullRebuild: fullRebuild,
						},
						debug: debugLogs,
					};

					// Debug logging
					console.log('🚀 ADMIN: Sending request body:', JSON.stringify(requestBody, null, 2));
					console.log('🚀 ADMIN: fullRebuild state:', fullRebuild);
					console.log('🚀 ADMIN: useSeasonOverride state:', useSeasonOverride);

					response = await fetch(`${path}`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(requestBody),
					});

					const responseInfo = {
						status: response.status,
						statusText: response.statusText,
						ok: response.ok,
						headers: Object.fromEntries(response.headers.entries())
					};
					
					addDebugLog(`Response for ${path}: ${JSON.stringify(responseInfo)}`);

					if (response.ok) {
						const contentType = response.headers.get("content-type");
						if (contentType && contentType.includes("application/json")) {
							data = await response.json();
							successfulPath = path;
							addDebugLog(`✅ Success with path: ${path}`, 'info');
							addDebugLog(`Function response: ${JSON.stringify(data)}`, 'info');
							break;
						} else {
							addDebugLog(`Path ${path} returned non-JSON response: ${contentType}`, 'warn');
							const textResponse = await response.text();
							addDebugLog(`Response preview: ${textResponse.substring(0, 200)}`, 'warn');
						}
					} else {
						addDebugLog(`Path ${path} returned status: ${response.status}`, 'warn');
						const errorText = await response.text().catch(() => "Could not read error response");
						addDebugLog(`Error response for ${path}: ${errorText.substring(0, 200)}`, 'warn');
					}
				} catch (pathError) {
					const errorDetails = {
						name: (pathError as Error).name,
						message: (pathError as Error).message,
						stack: (pathError as Error).stack?.substring(0, 200)
					};
					addDebugLog(`Path ${path} failed: ${(pathError as Error).message}`, 'error');
					addDebugLog(`Error details for ${path}: ${JSON.stringify(errorDetails)}`, 'error');
				}
			}

			if (response && response.ok && data) {
				// Check for SMTP errors in response
				if (data.smtpError) {
					const smtpError = data.smtpError;
					const errorMessage = smtpError.isAuthError
						? `⚠️ SMTP Authentication Error: ${smtpError.message}. Gmail requires an App Password (not your regular password). Enable 2-Factor Authentication and generate an App Password at https://myaccount.google.com/apppasswords`
						: `⚠️ SMTP Error: ${smtpError.message}. Check SMTP configuration on Heroku.`;
					
					// Log to console
					console.error('📧 SMTP Error detected:', smtpError);
					console.error('📧 SMTP Error type:', smtpError.type);
					console.error('📧 SMTP Error message:', smtpError.message);
					if (smtpError.isAuthError) {
						console.error('📧 This is an authentication error. Gmail requires an App Password.');
						console.error('📧 Steps to fix:');
						console.error('   1. Enable 2-Factor Authentication on your Google account');
						console.error('   2. Go to: https://myaccount.google.com/apppasswords');
						console.error('   3. Generate an App Password for "Mail"');
						console.error('   4. Update SMTP_PASSWORD on Heroku with the App Password');
					}
					
					// Set warning message in AdminPanel
					setError(errorMessage);
					addDebugLog(errorMessage, 'warn');
				}
				
				// Transform the Netlify function response to match expected format
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
					
					// Automatic status checking after initial delay
					addDebugLog("🔄 Scheduling automatic status check in 15 seconds...", 'info');
					setTimeout(() => {
						addDebugLog("🔍 Auto-checking status after seeding trigger...", 'info');
						checkStatus();
						
						// Trigger JobMonitoringDashboard refresh
						addDebugLog("🔄 Triggering JobMonitoringDashboard refresh...", 'info');
						triggerJobMonitoringRefresh();
					}, 15000); // 15 second delay - allows time for job creation and saving
				}
			} else {
				addDebugLog("❌ All function paths failed", 'error');
				addDebugLog("💡 Check Heroku app status: https://dashboard.heroku.com/apps/database-dorkinians", 'info');
				addDebugLog("💡 The Netlify function is working but can't connect to Heroku", 'info');
				throw new Error("Failed to trigger seeding - Heroku service is unreachable. Check Heroku dashboard for app status.");
			}
		} catch (err) {
			addDebugLog(`Seeding trigger error: ${err instanceof Error ? err.message : "Network error"}`, 'error');
			setError(err instanceof Error ? err.message : "Network error");
			
			// Stop the timer on error
			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}
		} finally {
			setIsLoading(false);
		}
	};

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
			const herokuUrl = process.env.NEXT_PUBLIC_HEROKU_SEEDER_URL || "https://database-dorkinians-4bac3364a645.herokuapp.com";
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

				// Update result with current status
				if (statusData.status === "completed" && statusData.result && result) {
					setResult({
						success: true,
						message: "Seeding completed successfully",
						environment: "production",
						timestamp: result.timestamp, // Keep original trigger time
						status: "completed",
						result: {
							success: statusData.result.success,
							exitCode: statusData.result.success ? 0 : 1,
							nodesCreated: statusData.result.nodesCreated || 0,
							relationshipsCreated: statusData.result.relationshipsCreated || 0,
							errorCount: statusData.result.errors?.length || 0,
							errors: statusData.result.errors || [],
							duration: statusData.result.duration || 0,
						},
					});
					setLastStatusCheck(`✅ Completed at ${new Date().toLocaleString()}`);
					setLastCompletedJobDuration(statusData.result.duration || 0);

					// Use backend duration for completed jobs
					if (statusData.result.duration) {
						setElapsedTime(Math.floor(statusData.result.duration / 1000));
					}

					// Update seeding status service for successful completion
					if (statusData.result.success) {
						seedingStatusService.updateSeedingSuccess({
							jobId: jobId || "unknown",
							timestamp: new Date().toISOString(),
							duration: statusData.result.duration || 0,
							nodesCreated: statusData.result.nodesCreated || 0,
							relationshipsCreated: statusData.result.relationshipsCreated || 0,
						});
					}
				} else if (statusData.status === "failed" && result) {
					// Extract error information from the job status
					const errorMessages = statusData.result?.errors || [];
					const errorCount = statusData.result?.errorCount || errorMessages.length || 1;
					const primaryError = errorMessages.length > 0 ? errorMessages[0] : 
						statusData.error || 
						statusData.currentStep || 
						"Seeding failed - check logs for details";
					
					setResult({
						success: false,
						message: "Seeding failed",
						environment: "production",
						timestamp: result.timestamp, // Keep original trigger time
						status: "failed",
						result: {
							success: false,
							exitCode: 1,
							nodesCreated: statusData.result?.nodesCreated || 0,
							relationshipsCreated: statusData.result?.relationshipsCreated || 0,
							errorCount: errorCount,
							errors: errorMessages.length > 0 ? errorMessages : [primaryError],
							duration: statusData.result?.duration || 0,
						},
					});
					setLastStatusCheck(`❌ Failed at ${new Date().toLocaleString()}`);

					// Calculate elapsed time for failed jobs based on start time
					if (statusData.startTime) {
						const actualElapsedTime = calculateElapsedTimeFromStartTime(statusData.startTime);
						setElapsedTime(actualElapsedTime);
					}

					// Update seeding status service for failure
					seedingStatusService.updateSeedingFailure({
						jobId: jobId || "unknown",
						timestamp: new Date().toISOString(),
						duration: 0,
					});
					setLastCompletedJobDuration(0); // Reset duration for failed jobs
				} else if (statusData.status === "not_found") {
					// Don't clear result, keep it for debugging
					setError(`Job ID not found: ${jobId}. This could mean the job failed early or there's a communication issue.`);
					setLastStatusCheck(`❌ Job ID not found: ${jobId} at ${new Date().toLocaleString()}`);

					// Try to get more information about what jobs exist
					try {
						const jobsResponse = await fetch(`${herokuUrl}/jobs`, {
							method: "GET",
							headers: { "Content-Type": "application/json" },
							mode: "cors",
							signal: controller.signal,
						});
						if (jobsResponse.ok) {
							const jobsData = await jobsResponse.json();
							console.log("Available jobs:", jobsData);
							// Update error with more context
							setError(`Job ID not found: ${jobId}. Available jobs: ${Object.keys(jobsData.jobs || {}).length}. Check console for details.`);
						}
					} catch (jobsError) {
						console.error("Failed to fetch jobs list:", jobsError);
					}
				} else if (result) {
					setResult({
						success: true,
						message: `Seeding in progress: ${statusData.currentStep || "Processing data sources"}`,
						environment: "production",
						timestamp: result.timestamp, // Keep original trigger time
						status: "running",
						progress: statusData.progress || 0,
						currentStep: statusData.currentStep || "Processing data sources",
						progressDetails: statusData.progressDetails || {},
						result: {
							success: true,
							exitCode: 0,
							nodesCreated: statusData.result?.nodesCreated || 0,
							relationshipsCreated: statusData.result?.relationshipsCreated || 0,
							errorCount: statusData.result?.errorCount || 0,
							errors: statusData.result?.errors || [],
							duration: statusData.result?.duration || 0,
						},
					});
					setLastStatusCheck(`🔄 Last checked at ${new Date().toLocaleString()}`);

					// Calculate actual elapsed time based on job start time for running jobs
					if (statusData.startTime) {
						const jobStartTime = new Date(statusData.startTime).getTime();
						const actualElapsedTime = calculateElapsedTimeFromStartTime(statusData.startTime);
						setElapsedTime(actualElapsedTime);
						
						// Only restart timer if start time has changed or no timer is running
						if (startTimeRef.current !== jobStartTime || !timerRef.current) {
							startTimeRef.current = jobStartTime;
							
							// Clear any existing timer and start a new one with the correct start time
							if (timerRef.current) {
								clearInterval(timerRef.current);
							}
							timerRef.current = setInterval(() => {
								if (startTimeRef.current) {
									const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
									setElapsedTime(elapsed);
								}
							}, 1000);
						}
					}
				}
			} else {
				const errorText = await response.text().catch(() => "Unknown error");
				setError(`Failed to check status - HTTP ${response.status}: ${errorText}`);
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

	const checkStatusForJob = async (specificJobId: string) => {
		setStatusCheckLoading(true);
		setError(null);

		let controller: AbortController | null = null;
		let timeoutId: NodeJS.Timeout | null = null;

		try {
			const herokuUrl = process.env.NEXT_PUBLIC_HEROKU_SEEDER_URL || "https://database-dorkinians-4bac3364a645.herokuapp.com";
			controller = new AbortController();
			timeoutId = setTimeout(() => {
				if (controller && !controller.signal.aborted) {
					controller.abort();
				}
			}, 10000); // 10 second timeout

			const response = await fetch(`${herokuUrl}/status/${specificJobId}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				mode: "cors",
				signal: controller.signal,
			});

			if (response.ok) {
				const statusData = await response.json();
				console.log("Status check response for specific job:", statusData);

				// Create a new result for this specific job
				const newResult: SeedingResult = {
					success: statusData.status !== "failed",
					message:
						statusData.status === "completed"
							? "Seeding completed successfully"
							: statusData.status === "failed"
								? "Seeding failed"
								: `Seeding in progress: ${statusData.currentStep || "Processing data sources"}`,
					environment: "production",
					timestamp: statusData.startTime || new Date().toISOString(),
					status:
						statusData.status === "completed"
							? "completed"
							: statusData.status === "failed"
								? "failed"
								: statusData.status === "running"
									? "running"
									: "pending",
					progress: statusData.progress,
					currentStep: statusData.currentStep,
					progressDetails: statusData.progressDetails || {},
					result: {
						success: statusData.status !== "failed",
						exitCode: statusData.status === "failed" ? 1 : 0,
						nodesCreated: statusData.result?.nodesCreated || 0,
						relationshipsCreated: statusData.result?.relationshipsCreated || 0,
						errorCount: statusData.result?.errors?.length || 0,
						errors: statusData.result?.errors || [],
						duration: statusData.result?.duration || 0,
						errorDetails: statusData.result?.errorDetails || undefined,
					},
					// Enhanced error context from the API response
					errorContext: statusData.errorContext || undefined,
				};

				setResult(newResult);
				setJobId(specificJobId);
				setLastStatusCheck(`🔍 Status checked for job ${specificJobId} at ${new Date().toLocaleString()}`);

				// Calculate actual elapsed time based on job start time
				if (statusData.startTime) {
					if (statusData.status === "completed" && statusData.result?.duration) {
						// For completed jobs, use the backend duration
						setElapsedTime(Math.floor(statusData.result.duration / 1000));
						setLastCompletedJobDuration(statusData.result.duration);
					} else if (statusData.status === "running" || statusData.status === "initializing") {
						// For running jobs, calculate from start time
						const jobStartTime = new Date(statusData.startTime).getTime();
						const actualElapsedTime = calculateElapsedTimeFromStartTime(statusData.startTime);
						setElapsedTime(actualElapsedTime);
						
						// Only restart timer if start time has changed or no timer is running
						if (startTimeRef.current !== jobStartTime || !timerRef.current) {
							startTimeRef.current = jobStartTime;
							
							// Clear any existing timer and start a new one with the correct start time
							if (timerRef.current) {
								clearInterval(timerRef.current);
							}
							timerRef.current = setInterval(() => {
								if (startTimeRef.current) {
									const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
									setElapsedTime(elapsed);
								}
							}, 1000);
						}
					} else {
						// For failed or other statuses, calculate from start time
						const actualElapsedTime = calculateElapsedTimeFromStartTime(statusData.startTime);
						setElapsedTime(actualElapsedTime);
					}
				}
			} else {
				setError("Failed to check status for specific job");
			}
		} catch (err) {
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

	// Trigger JobMonitoringDashboard refresh
	const triggerJobMonitoringRefresh = () => {
		// Dispatch a custom event that JobMonitoringDashboard can listen to
		const refreshEvent = new CustomEvent('jobMonitoringRefresh', {
			detail: { timestamp: new Date().toISOString() }
		});
		window.dispatchEvent(refreshEvent);
		addDebugLog("📡 Dispatched job monitoring refresh event", 'info');
	};

	// Kill a specific job using shared utility
	const killJob = async (jobIdToKill: string) => {
		setKillingJob(jobIdToKill);
		setError(null);

		const success = await killJobUtil(jobIdToKill, {
			onSuccess: (jobId, result) => {
				console.log("Job kill result:", result);
				
				// Update the jobs data to reflect the killed status
				if (jobsData && jobsData.jobs && jobsData.jobs[jobId]) {
					jobsData.jobs[jobId].status = 'killed';
					jobsData.jobs[jobId].currentStep = 'Job killed by user';
					jobsData.jobs[jobId].lastUpdate = new Date().toISOString();
					setJobsData({ ...jobsData });
				}

				// If this was the current job being monitored, update the result
				if (jobId === jobIdToKill) {
					setResult({
						success: false,
						message: `Job ${jobIdToKill} has been killed`,
						environment: "production",
						timestamp: new Date().toISOString(),
						status: "killed",
						progress: 0,
						currentStep: "Job killed by user",
						result: {
							success: false,
							exitCode: 1,
							nodesCreated: 0,
							relationshipsCreated: 0,
							errorCount: 0,
							errors: ["Job killed by user"],
							duration: 0,
						},
					});
					setLastStatusCheck(`🛑 Job ${jobIdToKill} killed at ${new Date().toLocaleString()}`);
				}

				// Clear the current job if it was killed
				if (jobId === jobIdToKill) {
					setJobId(null);
					if (timerRef.current) {
						clearInterval(timerRef.current);
						timerRef.current = null;
					}
					setElapsedTime(0);
				}
			},
			onError: (jobId, errorMessage) => {
				setError(`Failed to kill job: ${errorMessage}`);
			},
			onFinally: (jobId) => {
				setKillingJob(null);
			}
		});
	};

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
			case "killed":
				return { text: "Killed", color: "text-orange-600", bg: "border-orange-200 bg-orange-50" };
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
		setChatbotTestError(null);
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
			setChatbotTestError(err instanceof Error ? err.message : "Network error");
		} finally {
			setChatbotTestLoading(false);
		}
	};

	const fetchUnansweredQuestions = async () => {
		setUnansweredQuestionsLoading(true);
		setUnansweredQuestionsError(null);

		try {
			const response = await fetch("/api/admin/unanswered-questions");
			const data = await response.json();

			if (data.success) {
				setUnansweredQuestions(data.data || []);
			} else {
				throw new Error(data.error || "Failed to fetch unanswered questions");
			}
		} catch (err) {
			console.error("Error fetching unanswered questions:", err);
			setUnansweredQuestionsError(err instanceof Error ? err.message : "Network error");
		} finally {
			setUnansweredQuestionsLoading(false);
		}
	};

	const clearUnansweredQuestions = async () => {
		if (!confirm("Are you sure you want to clear all unanswered questions? This action cannot be undone.")) {
			return;
		}

		setClearingQuestions(true);
		setUnansweredQuestionsError(null);

		try {
			const response = await fetch("/api/admin/unanswered-questions", {
				method: "DELETE",
			});

			const data = await response.json();

			if (data.success) {
				setUnansweredQuestions([]);
				showToast("All unanswered questions cleared successfully", "success");
			} else {
				throw new Error(data.error || "Failed to clear unanswered questions");
			}
		} catch (err) {
			console.error("Error clearing unanswered questions:", err);
			setUnansweredQuestionsError(err instanceof Error ? err.message : "Network error");
			showToast("Failed to clear unanswered questions", "error");
		} finally {
			setClearingQuestions(false);
		}
	};


	const statusInfo = getStatusDisplay();

	// Fetch site details on mount
	useEffect(() => {
		const fetchSiteDetails = async () => {
			try {
				const response = await fetch("/api/site-details");
				if (response.ok) {
					const data = await response.json();
					setSiteDetails(data);
				}
			} catch (error) {
				console.error("Failed to fetch site details:", error);
			}
		};
		fetchSiteDetails();
	}, []);

	const formatDate = (dateString: string | null) => {
		if (!dateString) return "Never";
		try {
			return new Date(dateString).toLocaleString();
		} catch {
			return dateString;
		}
	};

	return (
		<div className='w-full min-h-screen p-2 sm:p-6 bg-white overflow-x-hidden py-4 px-4'>
			<h2 className='text-xl sm:text-2xl font-bold text-gray-900 mb-6 text-center'>Dorkinians Database Seeding Admin Panel</h2>
			{siteDetails && (
				<div className='mb-4 text-center'>
					<p className='text-sm text-gray-600'>
						Database last updated: <span className='font-semibold'>{formatDate(siteDetails.lastSeededStats || null)}</span>
					</p>
				</div>
			)}

			{/* Umami Analytics Link */}
			<div className='mb-6 text-center'>
				<a
					href='https://cloud.umami.is/analytics/eu/websites/351bdc1f-abd3-4b55-8e6f-23b3693b13b4'
					target='_blank'
					rel='noopener noreferrer'
					className='inline-block px-6 py-3 rounded-lg text-sm font-semibold text-white transition-colors bg-green-600 hover:bg-green-700'>
					See Umami Analytics of the site here
				</a>
			</div>

			{/* League Table Scraper Link */}
			<div className='mb-6 text-center'>
				<a
					href='https://dashboard.scraperapi.com/home'
					target='_blank'
					rel='noopener noreferrer'
					className='inline-block px-6 py-3 rounded-lg text-sm font-semibold text-white transition-colors bg-blue-400 hover:bg-blue-500'>
					See League Table Scraper
				</a>
			</div>

					{/* How the Database Seeding Process Works - Collapsible */}
					<div className='mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
				<button
					onClick={() => setShowProcessInfo(!showProcessInfo)}
					className='flex items-center justify-between w-full text-left'>
					<h3 className='text-sm font-semibold text-blue-800'>How the Database Seeding Process Works</h3>
					<span className='text-blue-600 text-xl font-bold'>{showProcessInfo ? '−' : '+'}</span>
				</button>
				{showProcessInfo && (
					<div className='mt-3'>
						<ul className='text-blue-700 text-xs space-y-2'>
							<li>
								• <strong>Step 1:</strong> Configure season settings (optional) - Use season override for historical data correction or enable full rebuild to clear all data
							</li>
							<li>
								• <strong>Step 2:</strong> Click &quot;Trigger Database Seeding&quot; to start the process. This triggers the Netlify function to make the call to Heroku
							</li>
							<li>
								• <strong>Step 3:</strong> The system will show &quot;Pending&quot; status while initializing, then &quot;Running&quot; as seeding begins
							</li>
							<li>
								• <strong>Step 4:</strong> Data clearing occurs based on your configuration:
								<ul className='ml-4 mt-1 space-y-1'>
									<li>• <strong>Selective Mode (default):</strong> 
										<ul className='ml-4 mt-1 space-y-1'>
											<li>- <strong>SiteDetail & TestData:</strong> Cleared and rebuilt</li>
											<li>- <strong>Fixture & MatchDetail:</strong> Only current season cleared (historical preserved)</li>
											<li>- <strong>Player, WeeklyTOTW, SeasonTOTW, PlayersOfTheMonth, CaptainsAndAwards, OppositionDetails, UnansweredQuestions:</strong> Preserved (only new items added)</li>
										</ul>
									</li>
									<li>• <strong>Full Rebuild:</strong> ALL data is cleared and reseeded from scratch</li>
								</ul>
							</li>
							<li>
								• <strong>Step 5:</strong> CSV data is fetched and processed, with non-current season rows skipped in selective mode
							</li>
							<li>
								• <strong>Step 6:</strong> Use &quot;Check Seeding Status&quot; to monitor progress and get final results
							</li>
							<li>
								• <strong>Step 7:</strong> Check your email for detailed completion notifications with season information
							</li>
							<li>
								• <strong>Debug:</strong> Use &quot;Debug: List All Jobs&quot; to view all jobs and their statuses
							</li>
						</ul>
					</div>
				)}
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
							className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm placeholder-gray-800'
						/>
					</div>
					<div className='flex flex-col sm:flex-row sm:space-x-6 space-y-2 sm:space-y-0'>
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
			</div>

					{/* Debug Configuration Section */}
			<div className='mb-6 p-4 bg-gray-50 rounded-lg'>
				<h3 className='text-lg font-semibold text-gray-800 mb-2'>Debug Configuration</h3>
				<div className='space-y-2'>
					<div className='flex items-center'>
						<input
							type='checkbox'
							id='debugLogs'
							checked={debugLogs}
							onChange={(e) => setDebugLogs(e.target.checked)}
							className='mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
						/>
						<label htmlFor='debugLogs' className='text-sm text-gray-700'>
							Enable debug logs (verbose logging for troubleshooting)
						</label>
					</div>
					<p className='text-xs text-gray-600 ml-6'>
						When enabled, all debug information, query details, and object properties will be logged. 
						When disabled, only essential progress and completion logs are shown.
					</p>
				</div>
			</div>

			{/* Season Configuration Section */}
			<div className='mb-6 p-4 bg-blue-50 rounded-lg'>
				<h3 className='text-lg font-semibold text-gray-800 mb-2'>Season Configuration</h3>
				<div className='space-y-4'>
					<div className='p-3 bg-white rounded-md border'>
						<div className='flex items-center justify-between mb-2'>
							<span className='text-sm font-medium text-gray-700'>Current Season:</span>
							<span className='text-sm font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded'>{currentSeason}</span>
						</div>
					</div>
					
					<div className='flex flex-col sm:flex-row sm:space-x-6 space-y-2 sm:space-y-0'>
						<div className='flex items-center'>
							<input
								type='checkbox'
								id='useSeasonOverride'
								checked={useSeasonOverride}
								onChange={(e) => handleSeasonOverrideChange(e.target.checked)}
								className='mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
							/>
							<label htmlFor='useSeasonOverride' className='text-sm text-gray-700'>
								Override season (for historical data correction)
							</label>
						</div>
						<div className='flex items-center'>
							<input
								type='checkbox'
								id='fullRebuild'
								checked={fullRebuild}
								onChange={(e) => handleFullRebuildChange(e.target.checked)}
								className='mr-2 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded'
							/>
							<label htmlFor='fullRebuild' className='text-sm text-gray-700'>
								Full rebuild (clear ALL data, not just current season)
							</label>
						</div>
					</div>
					
					{useSeasonOverride && (
						<div>
							<label htmlFor='seasonOverride' className='block text-sm font-medium text-gray-700'>
								Override Season (format: YYYY/YY):
							</label>
							<input
								type='text'
								id='seasonOverride'
								value={seasonOverride}
								onChange={(e) => handleSeasonOverrideInputChange(e.target.value)}
								placeholder='2024/25'
								className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm placeholder-gray-500 ${
									seasonOverrideError ? 'border-red-300 bg-red-50' : 'border-gray-300'
								}`}
								style={{ color: '#1f2937' }}
							/>
							{seasonOverrideError && (
								<p className='mt-1 text-sm text-red-600'>{seasonOverrideError}</p>
							)}
						</div>
					)}
					
					
					<div className='p-3 bg-yellow-50 rounded-md border border-yellow-200'>
						<p className='text-xs text-yellow-800 mb-2'>
							<strong>Selective Clear (Default Mode):</strong>
						</p>
						<ul className='text-xs text-yellow-800 space-y-1 ml-4'>
							<li>• <strong>Cleared & Rebuilt:</strong> SiteDetail, TestData</li>
							<li>• <strong>Current Season Only:</strong> Fixture, MatchDetail (historical preserved)</li>
							<li>• <strong>Preserved (New Items Added):</strong> Player, WeeklyTOTW, SeasonTOTW, PlayersOfTheMonth, CaptainsAndAwards, OppositionDetails, UnansweredQuestions</li>
						</ul>
					</div>
				</div>
			</div>

			{/* Action Buttons */}
			<div className='mb-6 flex flex-col sm:flex-row justify-center gap-4'>
				<button
					onClick={triggerSeeding}
					disabled={isLoading}
					className={`w-full sm:w-64 px-6 py-3 rounded-lg text-xs sm:text-sm font-semibold text-white transition-colors ${
						isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
					}`}>
					{isLoading ? "🔄 Triggering..." : "🚀 Trigger Production Seeding"}
				</button>
				<button
					onClick={checkStatus}
					disabled={statusCheckLoading || !jobId}
					className={`w-full sm:w-64 px-6 py-3 rounded-lg text-xs sm:text-sm font-semibold text-white transition-colors ${
						statusCheckLoading || !jobId ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
					}`}>
					{statusCheckLoading ? "🔄 Checking Status..." : "🔍 Check Production Status"}
				</button>
				<button
					onClick={async () => {
						if (!jobId) {
							setError("No job ID available. Please trigger seeding first.");
							return;
						}

						// Open log viewer in new tab
						const herokuUrl = process.env.NEXT_PUBLIC_HEROKU_SEEDER_URL || "https://database-dorkinians-4bac3364a645.herokuapp.com";
						window.open(`${herokuUrl}/logs/${jobId}/view`, '_blank');
					}}
					disabled={!jobId}
					className={`w-full sm:w-64 px-6 py-3 rounded-lg text-xs sm:text-sm font-semibold text-white transition-colors ${
						!jobId ? "bg-gray-400 cursor-not-allowed" : "bg-orange-600 hover:bg-orange-700"
					}`}>
					📋 View Job Logs Online
				</button>
				<button
					onClick={async () => {
						if (!jobId) {
							setError("No job ID available. Please trigger seeding first.");
							return;
						}

						// Fetch warnings log and display in modal
						try {
							const herokuUrl = process.env.NEXT_PUBLIC_HEROKU_SEEDER_URL || "https://database-dorkinians-4bac3364a645.herokuapp.com";
							const response = await fetch(`${herokuUrl}/logs/${jobId}/warnings`);
							const data = await response.json();
							
							if (data.success && data.warningsLogs) {
								// Open warnings log in new tab with formatted display
								const warningsWindow = window.open('', '_blank');
								if (warningsWindow) {
									const warningsContent = typeof data.warningsLogs === 'string' 
										? data.warningsLogs 
										: JSON.stringify(data.warningsLogs, null, 2);
									
									// Use DOM manipulation instead of document.write() to avoid CSP violations
									warningsWindow.document.open();
									const doc = warningsWindow.document;
									
									// Create HTML structure using DOM methods
									doc.documentElement.innerHTML = '';
									const html = doc.createElement('html');
									const head = doc.createElement('head');
									const title = doc.createElement('title');
									title.textContent = `Warnings Log - ${jobId}`;
									head.appendChild(title);
									
									const style = doc.createElement('style');
									style.textContent = `
										body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
										pre { white-space: pre-wrap; word-wrap: break-word; }
										.header { background: #2d2d2d; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
										.warning { color: #ffa500; }
									`;
									head.appendChild(style);
									
									const body = doc.createElement('body');
									const headerDiv = doc.createElement('div');
									headerDiv.className = 'header';
									const h1 = doc.createElement('h1');
									h1.textContent = '⚠️ Warnings Log';
									const p = doc.createElement('p');
									p.textContent = `Job ID: ${jobId}`;
									headerDiv.appendChild(h1);
									headerDiv.appendChild(p);
									
									const pre = doc.createElement('pre');
									pre.textContent = warningsContent;
									
									body.appendChild(headerDiv);
									body.appendChild(pre);
									html.appendChild(head);
									html.appendChild(body);
									doc.appendChild(html);
									doc.close();
								}
							} else {
								setError(data.error || "No warnings log available for this job.");
							}
						} catch (error: any) {
							setError(`Failed to fetch warnings log: ${error.message}`);
						}
					}}
					disabled={!jobId}
					className={`w-full sm:w-64 px-6 py-3 rounded-lg text-xs sm:text-sm font-semibold text-white transition-colors ${
						!jobId ? "bg-gray-400 cursor-not-allowed" : "bg-yellow-600 hover:bg-yellow-700"
					}`}>
					⚠️ View Warnings Log
				</button>
				<button
					onClick={async () => {
						setJobsLoading(true);
						setError(null);

						let controller: AbortController | null = null;
						let timeoutId: NodeJS.Timeout | null = null;

						try {
							const herokuUrl = process.env.NEXT_PUBLIC_HEROKU_SEEDER_URL || "https://database-dorkinians-4bac3364a645.herokuapp.com";
							controller = new AbortController();
							timeoutId = setTimeout(() => {
								if (controller && !controller.signal.aborted) {
									controller.abort();
								}
							}, 10000); // 10 second timeout

							const response = await fetch(`${herokuUrl}/jobs`, {
								method: "GET",
								headers: {
									"Content-Type": "application/json",
								},
								mode: "cors",
								signal: controller.signal,
							});

							if (response.ok) {
								const data = await response.json();
								console.log("All jobs on Heroku:", data);
								setJobsData(data);
								setShowJobsModal(true);
							} else {
								throw new Error(`HTTP ${response.status}: ${response.statusText}`);
							}
						} catch (err) {
							console.error("Failed to fetch jobs:", err);
							let errorMessage = "Failed to fetch jobs";
							if (err instanceof Error) {
								if (err.name === "AbortError") {
									errorMessage = "Request timed out after 10 seconds";
								} else {
									errorMessage = err.message;
								}
							}
							setError(`Failed to fetch jobs: ${errorMessage}`);
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
							setJobsLoading(false);
						}
					}}
					className='w-full sm:w-64 px-6 py-3 rounded-lg text-xs sm:text-sm font-semibold text-white transition-colors bg-gray-600 hover:bg-gray-700'>
					{jobsLoading ? "⏳ Loading..." : "🔍 Debug: List All Jobs"}
				</button>
			</div>

			{/* Live Heroku Logs Instruction */}
			<div className='mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg'>
				<p className='text-sm text-gray-800 font-semibold mb-1'>Live Logs (Heroku CLI)</p>
				<p className='text-xs text-gray-700'>While seeding is running, you can stream full backend logs locally:</p>
				<div className='mt-2 relative'>
					<pre className='p-2 bg-gray-900 text-gray-100 text-xs rounded pr-10'><code>heroku logs --tail --app database-dorkinians</code></pre>
					<button
						onClick={async () => {
							try {
								await navigator.clipboard.writeText('heroku logs --tail --app database-dorkinians');
								showToast('Command copied to clipboard!', 'success');
							} catch (err) {
								showToast('Failed to copy to clipboard', 'error');
							}
						}}
						className='absolute top-1 right-1 p-1 text-gray-400 hover:text-white transition-colors'
						title='Copy to clipboard'
					>
						📋
					</button>
				</div>
			</div>

			{/* Status Information */}
			<div className='mb-6 text-center'>
				{lastStatusCheck && <p className='text-sm text-gray-600'>{lastStatusCheck}</p>}
				{jobId && <p className='text-xs text-gray-500 mt-1'>Current Job ID: {jobId}</p>}
			</div>

			{/* Error Display */}
			{error && (
				<div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg'>
					<h3 className='text-lg font-semibold text-red-800 mb-2'>❌ Error</h3>
					<p className='text-red-700 mb-2'>{error}</p>

					{/* Additional Context for Job Not Found Errors */}
					{error.includes("Job ID not found") && (
						<div className='mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded'>
							<h4 className='text-sm font-semibold text-yellow-800 mb-2'>🔍 Job Not Found Analysis:</h4>
							<ul className='text-sm text-yellow-700 space-y-1'>
							<li>• The job may have failed during initialization (before logging started)</li>
							<li>• Check if the Heroku service is running and accessible</li>
							<li>• The job may have completed but status was not properly updated</li>
							<li>• Try clicking &quot;View Job Logs Online&quot; to see if any logs were created</li>
							<li>• Check &quot;Debug: List All Jobs&quot; to see what jobs exist on Heroku</li>
							<li>• Use &quot;View All Logs Online&quot; to see comprehensive job history</li>
								<li>• Failure emails are sent automatically when jobs fail</li>
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
							<li>• Use &quot;View All Logs Online&quot; to see comprehensive job history and error details</li>
							<li>• Use &quot;View Job Logs Online&quot; for specific job debugging</li>
							<li>• Check failure emails for detailed error information</li>
						</ul>
					</div>
				</div>
			)}

			{/* Result Display */}
			{result && (
				<div className={`mb-6 p-4 rounded-lg border ${statusInfo?.bg}`}>
					<div className='mb-3'>
						<h3 className={`text-lg font-semibold ${statusInfo?.color}`}>
							{result.status === "running" ? "🔄 Seeding in Progress..." : "Seeding Status"}
						</h3>
					</div>

					<div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
						<div>
							<p className='text-sm text-gray-800 font-medium'>Environment</p>
							<p className='font-semibold text-gray-900'>{result.environment.charAt(0).toUpperCase() + result.environment.slice(1)}</p>
						</div>
						<div>
							<p className='text-sm text-gray-800 font-medium'>Status</p>
							<p className={`font-semibold ${statusInfo?.color}`}>{statusInfo?.text}</p>
						</div>
						<div>
							<p className='text-sm text-gray-800 font-medium'>Timestamp</p>
							<p className='font-semibold text-gray-900'>{new Date(result.timestamp).toLocaleString()}</p>
						</div>
						<div>
							<p className='text-sm text-gray-800 font-medium'>Elapsed Time</p>
							<p className='font-semibold text-blue-600'>{elapsedTime > 0 ? formatElapsedTime(elapsedTime) : "0s"}</p>
						</div>
					</div>

					{/* Progress Indicator - Moved above statistics */}
					{(result.status === "pending" || result.status === "running") && (
						<div className='mb-4 p-4 bg-blue-100 border border-blue-300 rounded-lg'>
							<div className='flex items-center gap-3'>
								<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'></div>
								<div className='flex-1'>
									<p className='font-semibold text-blue-800'>Seeding in Progress</p>
									<p className='text-sm text-blue-600'>
										{result.status === "pending"
											? "Initializing seeding process..."
											: result.currentStep || "Processing data sources from Google Sheets..."}
									</p>
									
									{/* Detailed Progress Information */}
									{result.progressDetails && (
										<div className='mt-2 space-y-1'>
											{result.progressDetails.tableName && (
												<p className='text-xs text-blue-700 font-medium'>
													📊 Table: {result.progressDetails.tableName}
													{result.progressDetails.recordsProcessed != null && result.progressDetails.totalRecords != null && (
														<> - {result.progressDetails.recordsProcessed.toLocaleString()}/{result.progressDetails.totalRecords.toLocaleString()} records ({Math.round((result.progressDetails.recordsProcessed / result.progressDetails.totalRecords) * 100)}%)</>
													)}
													{result.progressDetails.batchNumber != null && result.progressDetails.totalBatches != null && (
														<> - Batch {result.progressDetails.batchNumber}/{result.progressDetails.totalBatches} ({Math.round((result.progressDetails.batchNumber / result.progressDetails.totalBatches) * 100)}%)</>
													)}
												</p>
											)}
											{result.progressDetails.relationshipType && (
												<p className='text-xs text-blue-700 font-medium'>
													🔗 Relationship: {result.progressDetails.relationshipType}
													{result.progressDetails.current != null && result.progressDetails.total != null && (
														<> - {result.progressDetails.current.toLocaleString()}/{result.progressDetails.total.toLocaleString()} ({Math.round((result.progressDetails.current / result.progressDetails.total) * 100)}%)</>
													)}
												</p>
											)}
											{result.progressDetails.estimatedTimeRemaining != null && result.progressDetails.estimatedTimeRemaining > 0 && (
												<p className='text-xs text-blue-700 font-medium'>
													⏱️ Estimated time remaining (overall process): {formatElapsedTime(result.progressDetails.estimatedTimeRemaining / 1000)}
												</p>
											)}
										</div>
									)}
									
									{result.progress !== undefined && (
										<div className='mt-2'>
											<div className='flex justify-between text-xs text-blue-600 mb-1'>
												<span>Overall Progress</span>
												<span>{result.progress}%</span>
											</div>
											<div className='w-full bg-blue-200 rounded-full h-2'>
												<div className='bg-blue-600 h-2 rounded-full transition-all duration-300' style={{ width: `${result.progress}%` }}></div>
											</div>
										</div>
									)}
									{/* Live Node Count Display */}
									{result.progressDetails?.currentNodeCount && result.progressDetails.currentNodeCount > 0 && (
										<div className='mt-3 p-3 bg-white border border-blue-200 rounded-lg'>
											<div className='flex items-center justify-between'>
												<div className='flex items-center gap-2'>
													<div className='w-3 h-3 bg-green-500 rounded-full animate-pulse'></div>
													<span className='text-sm font-semibold text-gray-800'>Live Node Count</span>
												</div>
												<div className='text-right'>
													<p className='text-2xl font-bold text-green-600'>
														{result.progressDetails.currentNodeCount.toLocaleString()}
													</p>
													<p className='text-xs text-gray-500'>nodes created</p>
												</div>
											</div>
											{result.progressDetails.currentNodeCount >= 15000 && (
												<p className='text-xs text-green-600 mt-1 font-medium'>
													✅ Target reached! ({result.progressDetails.currentNodeCount.toLocaleString()} ≥ 15,000)
												</p>
											)}
											{result.progressDetails.currentNodeCount >= 12000 && result.progressDetails.currentNodeCount < 15000 && (
												<p className='text-xs text-yellow-600 mt-1 font-medium'>
													⚠️ Close to target ({result.progressDetails.currentNodeCount.toLocaleString()}/15,000)
												</p>
											)}
										</div>
									)}
									<p className='text-xs text-blue-500 mt-2'>
										Elapsed: {formatElapsedTime(elapsedTime)} | Expected duration:{" "}
										{lastCompletedJobDuration !== null ? formatElapsedTime(lastCompletedJobDuration) : 
											fullRebuild ? "~71 minutes" : "~71 minutes"}
										{result.timestamp && (
											<> | Expected end: {(() => {
												const startTime = new Date(result.timestamp);
												const expectedDurationMinutes = lastCompletedJobDuration !== null ? 
													Math.floor(lastCompletedJobDuration / 60) : 
													(fullRebuild ? 40 : 20);
												const expectedEndTime = new Date(startTime.getTime() + (expectedDurationMinutes * 60 * 1000));
												return expectedEndTime.toLocaleTimeString();
											})()}</>
										)}
									</p>
									<p className='text-xs text-blue-500'>Check your email for start and completion notifications.</p>
								</div>
							</div>
						</div>
					)}

					{/* Debug Information - Collapsible */}
					<div className='mt-6 p-3 bg-gray-50 border border-gray-200 rounded-lg'>
						<div className='flex justify-between items-center mb-2'>
							<h4 className='text-sm font-semibold text-gray-800'>🔧 Debug Information</h4>
							<button
								onClick={() => setShowDebugInfo(!showDebugInfo)}
								className='text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300'
							>
								{showDebugInfo ? 'Hide' : 'Show'}
							</button>
						</div>
						{showDebugInfo && (
							<div className='grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-700'>
								<div>
									<p><strong>Current Job ID:</strong> {jobId || "None"}</p>
									<p><strong>Last Status Check:</strong> {lastStatusCheck || "Never"}</p>
									<p><strong>Elapsed Time:</strong> {elapsedTime > 0 ? formatElapsedTime(elapsedTime) : "0s"}</p>
								</div>
								<div>
									<p><strong>Environment:</strong> Production</p>
									<p><strong>Email Notifications:</strong> {sendEmailAtCompletion ? "Enabled" : "Disabled"}</p>
									<p><strong>Email Address:</strong> {emailAddress}</p>
								</div>
							</div>
						)}
					</div>


					{/* Final Statistics */}
					{result.status === "completed" && (
						<div className='mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
							<h4 className='text-md font-semibold text-blue-800 mb-3'>🎯 Final Results</h4>
							<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
								<div className='text-center p-3 bg-white rounded-lg'>
									<p className='text-2xl font-bold text-blue-600'>{getValueDisplay(result.result.nodesCreated, "Nodes Created").display}</p>
									<p className='text-sm text-gray-600'>{getValueDisplay(result.result.nodesCreated, "Nodes Created").label}</p>
								</div>
								<div className='text-center p-3 bg-white rounded-lg'>
									<p className='text-2xl font-bold text-green-600'>
										{getValueDisplay(result.result.relationshipsCreated, "Relationships Created").display}
									</p>
									<p className='text-sm text-gray-600'>{getValueDisplay(result.result.relationshipsCreated, "Relationships Created").label}</p>
								</div>
								<div className='text-center p-3 bg-white rounded-lg'>
									<p className='text-2xl font-bold text-red-600'>{getValueDisplay(result.result.errorCount, "Errors Found").display}</p>
									<p className='text-sm text-gray-600'>{getValueDisplay(result.result.errorCount, "Errors Found").label}</p>
								</div>
							</div>
						</div>
					)}

					{/* Enhanced Error Display */}
					{result.result.errors && result.result.errors.length > 0 && (
						<div className='mt-4 p-4 bg-red-50 border border-red-200 rounded-lg'>
							<h4 className='text-lg font-semibold text-red-800 mb-3'>🚨 Error Details</h4>
							
							{/* Error Summary */}
							<div className='mb-4 p-3 bg-red-100 border border-red-300 rounded'>
								<div className='flex items-center gap-2 mb-2'>
									<span className='text-red-800 font-semibold'>Error Count:</span>
									<span className='px-2 py-1 bg-red-200 text-red-800 rounded text-sm font-bold'>
										{result.result.errors.length}
									</span>
								</div>
								<div className='flex items-center gap-2'>
									<span className='text-red-800 font-semibold'>Status:</span>
									<span className='px-2 py-1 bg-red-200 text-red-800 rounded text-sm font-bold'>
										{result.status === 'failed' ? 'FAILED' : 'ERRORS DETECTED'}
									</span>
								</div>
							</div>

							{/* Individual Error Details */}
							<div className='space-y-3'>
								{result.result.errors.map((error, index) => (
									<div key={index} className='p-3 bg-white border border-red-300 rounded'>
										<div className='flex items-start gap-2 mb-2'>
											<span className='text-red-600 font-bold text-sm'>#{index + 1}</span>
											<span className='text-red-800 font-semibold text-sm'>Error:</span>
										</div>
										<p className='text-red-700 text-sm ml-6 break-words'>{error}</p>
									</div>
								))}
							</div>

							{/* Enhanced Error Context - if available */}
							{result.errorContext && (
								<div className='mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded'>
									<h5 className='text-sm font-semibold text-yellow-800 mb-2'>🔍 Error Context</h5>
									<div className='grid grid-cols-1 md:grid-cols-2 gap-3 text-xs'>
										<div>
											<span className='font-semibold text-yellow-800'>Error Type:</span>
											<span className='ml-2 text-yellow-700'>{result.errorContext.errorType || 'Unknown'}</span>
										</div>
										<div>
											<span className='font-semibold text-yellow-800'>Error Name:</span>
											<span className='ml-2 text-yellow-700'>{result.errorContext.errorName || 'Unknown'}</span>
										</div>
										<div>
											<span className='font-semibold text-yellow-800'>Duration:</span>
											<span className='ml-2 text-yellow-700'>{result.errorContext.duration ? `${result.errorContext.duration}ms` : 'Unknown'}</span>
										</div>
										<div>
											<span className='font-semibold text-yellow-800'>Step:</span>
											<span className='ml-2 text-yellow-700'>{result.errorContext.step || 'Unknown'}</span>
										</div>
									</div>
									{result.errorContext.memoryUsage && (
										<div className='mt-2'>
											<span className='font-semibold text-yellow-800'>Memory Usage:</span>
											<div className='ml-2 text-yellow-700 text-xs'>
												RSS: {Math.round(result.errorContext.memoryUsage.rss / 1024 / 1024)}MB, 
												Heap: {Math.round(result.errorContext.memoryUsage.heapUsed / 1024 / 1024)}MB
											</div>
										</div>
									)}
								</div>
							)}

							{/* Error Details - if available */}
							{result.result.errorDetails && (
								<div className='mt-4 p-3 bg-blue-100 border border-blue-300 rounded'>
									<h5 className='text-sm font-semibold text-blue-800 mb-2'>📊 Technical Details</h5>
									<div className='space-y-2 text-xs'>
										<div>
											<span className='font-semibold text-blue-800'>Type:</span>
											<span className='ml-2 text-blue-700'>{result.result.errorDetails.type || 'Unknown'}</span>
										</div>
										<div>
											<span className='font-semibold text-blue-800'>Name:</span>
											<span className='ml-2 text-blue-700'>{result.result.errorDetails.name || 'Unknown'}</span>
										</div>
										{result.result.errorDetails.code && (
											<div>
												<span className='font-semibold text-blue-800'>Code:</span>
												<span className='ml-2 text-blue-700'>{result.result.errorDetails.code}</span>
											</div>
										)}
										{result.result.errorDetails.stack && (
											<div>
												<span className='font-semibold text-blue-800'>Stack Trace:</span>
												<details className='mt-1'>
													<summary className='cursor-pointer text-blue-600 hover:text-blue-800'>
														Click to view stack trace
													</summary>
													<pre className='mt-2 p-2 bg-white border rounded text-xs overflow-auto max-h-32'>
														{result.result.errorDetails.stack}
													</pre>
												</details>
											</div>
										)}
									</div>
								</div>
							)}

							{/* Troubleshooting Steps */}
							<div className='mt-4 p-3 bg-gray-100 border border-gray-300 rounded'>
								<h5 className='text-sm font-semibold text-gray-800 mb-2'>🔧 Troubleshooting Steps</h5>
								<ul className='text-xs text-gray-700 space-y-1'>
									<li>• Check the detailed error information above for specific failure reasons</li>
									<li>• Review the error context to understand which step failed</li>
									<li>• Check memory usage to see if the process ran out of memory</li>
									<li>• Use &quot;View Job Logs Online&quot; for complete error logs</li>
									<li>• Check failure emails for detailed error reports</li>
									<li>• Try running the seeding process again after addressing the issue</li>
								</ul>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Chatbot Test Loading Overlay */}
			{chatbotTestLoading && (
				<div className='mb-6 p-6 rounded-lg border-2 border-blue-200 bg-blue-50'>
					<div className='text-center'>
						<div className='inline-flex items-center justify-center w-16 h-16 mb-4 bg-blue-100 rounded-full'>
							<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
						</div>
						<h3 className='text-lg font-semibold text-blue-600 mb-2'>🤖 Chatbot Test Running</h3>
						<p className='text-sm text-blue-700 mb-2'>
							The chatbot test is currently running and will take a few minutes to complete.
						</p>
						<p className='text-xs text-blue-600'>
							You will receive an email with the test results once it&apos;s finished.
						</p>
					</div>
				</div>
			)}

			{/* Chatbot Test Results */}
			{chatbotTestResult && (
				<div
					className={`mb-6 p-4 rounded-lg border ${chatbotTestResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
					<div className='mb-3'>
						<h3 className={`text-lg font-semibold ${chatbotTestResult.success ? "text-green-600" : "text-red-600"}`}>
							{chatbotTestResult.success ? "✅ Chatbot Test Completed" : "❌ Chatbot Test Failed"}
						</h3>
						<p className='text-sm text-gray-600'>Completed at: {new Date(chatbotTestResult.timestamp).toLocaleString()}</p>
						{chatbotTestResult.success && (
							<p className='text-sm text-green-600 mt-1'>
								📧 Email with detailed test results has been sent to {emailAddress}
							</p>
						)}
					</div>

					<div className='space-y-2'>
						<p className='text-sm'>
							<strong>Message:</strong> {chatbotTestResult.message}
						</p>
						{chatbotTestResult.totalTests && (
							<div className='grid grid-cols-1 md:grid-cols-3 gap-4 mt-4'>
								<div className='text-center p-3 bg-white rounded-lg'>
									<p className='text-2xl font-bold text-blue-600'>{chatbotTestResult.totalTests}</p>
									<p className='text-sm text-gray-600'>Total Tests</p>
								</div>
								<div className='text-center p-3 bg-white rounded-lg'>
									<p className='text-2xl font-bold text-green-600'>{chatbotTestResult.passedTests || 0}</p>
									<p className='text-sm text-gray-600'>Passed</p>
								</div>
								<div className='text-center p-3 bg-white rounded-lg'>
									<p className='text-2xl font-bold text-red-600'>{chatbotTestResult.failedTests || 0}</p>
									<p className='text-sm text-gray-600'>Failed</p>
								</div>
							</div>
						)}
						{chatbotTestResult.successRate && (
							<p className='text-sm mt-2'>
								<strong>Success Rate:</strong> {chatbotTestResult.successRate}%
							</p>
						)}
					</div>
				</div>
			)}

			{/* Job Monitoring Section */}
			<div className='mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg'>
				<JobMonitoringDashboard />
			</div>

			{/* Chatbot Testing Section */}
			<div className='mt-6 p-4 bg-green-50 border border-green-200 rounded-lg'>
				<h3 className='text-lg font-semibold text-green-800 mb-2'>Chatbot Testing</h3>
				<p className='text-green-700 text-sm mb-4'>
					This button runs a comprehensive test of the chatbot functionality and sends you an email with the test results. 
					It tests various queries to ensure the chatbot is working correctly with the current database state.
				</p>
				<div className='flex justify-center'>
					<button
						onClick={triggerChatbotTest}
						disabled={chatbotTestLoading}
						className={`w-64 px-6 py-3 rounded-lg text-xs font-semibold text-white transition-colors ${
							chatbotTestLoading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
						}`}>
						{chatbotTestLoading ? "🔄 Testing..." : "🤖 Run Chatbot Test & Email"}
					</button>
				</div>
				
				{/* Chatbot Test Error Display */}
				{chatbotTestError && (
					<div className='mt-3 p-3 bg-red-50 border border-red-200 rounded-lg'>
						<p className='text-red-600 text-sm'>
							❌ <strong>Chatbot Test Error:</strong> {chatbotTestError}
						</p>
					</div>
				)}
			</div>

			{/* Unanswered Questions Section */}
			<div className='mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
				<div className='flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3'>
					<div>
						<h3 className='text-base sm:text-lg font-semibold text-blue-800 mb-1'>Unanswered Questions</h3>
						<p className='text-blue-700 text-xs sm:text-sm'>
							Questions the chatbot couldn&apos;t answer. Total: <strong>{unansweredQuestions.length}</strong>
						</p>
					</div>
					<div className='flex flex-col sm:flex-row gap-2 w-full sm:w-auto'>
						<button
							onClick={fetchUnansweredQuestions}
							disabled={unansweredQuestionsLoading}
							className={`px-2 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold text-white transition-colors ${
								unansweredQuestionsLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
							}`}>
							{unansweredQuestionsLoading ? "🔄 Loading..." : "🔄 Refresh"}
						</button>
						<button
							onClick={() => router.push("/admin/unanswered-questions")}
							className='px-2 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold text-white transition-colors bg-purple-600 hover:bg-purple-700'>
							👁️ View All
						</button>
						<button
							onClick={clearUnansweredQuestions}
							disabled={clearingQuestions || unansweredQuestions.length === 0}
							className={`px-2 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold text-white transition-colors ${
								clearingQuestions || unansweredQuestions.length === 0
									? "bg-gray-400 cursor-not-allowed"
									: "bg-red-600 hover:bg-red-700"
							}`}>
							{clearingQuestions ? "🔄 Clearing..." : "🗑️ Clear All"}
						</button>
					</div>
				</div>

				{/* Error Display */}
				{unansweredQuestionsError && (
					<div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-lg'>
						<p className='text-red-600 text-sm'>
							❌ <strong>Error:</strong> {unansweredQuestionsError}
						</p>
					</div>
				)}

				{/* Questions List */}
				{unansweredQuestionsLoading ? (
					<div className='text-center py-8 text-gray-500'>Loading questions...</div>
				) : unansweredQuestions.length === 0 ? (
					<div className='text-center py-8 text-gray-500'>No unanswered questions found.</div>
				) : (
					<div className='space-y-3 max-h-64 sm:max-h-96 overflow-y-auto'>
						{unansweredQuestions.map((item, index) => (
							<div
								key={index}
								className='p-3 bg-white border border-blue-200 rounded-lg hover:shadow-md transition-shadow'>
								<div className='flex justify-between items-start gap-4'>
									<div className='flex-1'>
										<p className='text-gray-800 font-medium text-sm sm:text-base'>{item.question}</p>
										<div className='flex flex-col sm:flex-row sm:gap-2 mt-1'>
											<p className='text-xs text-gray-500'>
												{new Date(item.timestamp).toLocaleString()}
											</p>
											<p className='text-xs text-gray-500'>
												Player: <span className='font-medium'>{item.playerName}</span>
											</p>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Jobs Modal */}
			{showJobsModal && (
				<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4' onClick={() => setShowJobsModal(false)}>
					<div className='bg-white rounded-lg p-4 sm:p-6 max-w-[95vw] sm:max-w-2xl w-full max-h-[90vh] overflow-y-auto' onClick={(e) => e.stopPropagation()}>
						<div className='flex justify-between items-center mb-4'>
							<h3 className='text-base sm:text-lg font-semibold text-gray-800'>All Jobs on Heroku</h3>
							<button onClick={() => setShowJobsModal(false)} className='text-gray-500 hover:text-gray-700 text-2xl sm:text-xl font-bold w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center'>
								×
							</button>
						</div>

						{jobsData ? (
							<div>
								<div className='mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg'>
									<p className='text-sm text-blue-800'>
										<strong>Total Jobs:</strong> {jobsData.totalJobs}
									</p>
								</div>

								{Object.keys(jobsData.jobs).length > 0 ? (
									<div className='space-y-3'>
										{Object.entries(jobsData.jobs)
											.sort(([, a], [, b]) => {
												// Sort by startTime descending (most recent first)
												const timeA = (a as any).startTime ? new Date((a as any).startTime).getTime() : 0;
												const timeB = (b as any).startTime ? new Date((b as any).startTime).getTime() : 0;
												return timeB - timeA;
											})
											.map(([jobId, jobData]: [string, any]) => (
												<div key={jobId} className='p-3 border border-gray-200 rounded-lg'>
													<div className='flex justify-between items-start mb-2'>
														<div className='flex-1'>
															<p className='font-semibold text-gray-800'>Job ID: {jobId}</p>
															<p className='text-sm text-gray-600'>
																Status:{" "}
																<span
																	className={`font-medium ${
																		jobData.status === "completed"
																			? "text-green-600"
																			: jobData.status === "failed"
																				? "text-red-600"
																				: jobData.status === "running"
																					? "text-blue-600"
																					: jobData.status === "killed"
																						? "text-orange-600"
																						: "text-gray-600"
																	}`}>
																	{jobData.status}
																</span>
															</p>
															{jobData.currentStep && <p className='text-sm text-gray-600'>Current Step: {jobData.currentStep}</p>}
															{jobData.progress !== undefined && <p className='text-sm text-gray-600'>Progress: {jobData.progress}%</p>}
															{jobData.startTime && <p className='text-sm text-gray-600'>Started: {new Date(jobData.startTime).toLocaleString()}</p>}
															<div className='flex gap-2 mt-2'>
																<button
																	onClick={() => {
																		// Close modal and set up status checking for this job
																		setShowJobsModal(false);
																		setJobId(jobId);
																		// Trigger status check for this specific job
																		checkStatusForJob(jobId);
																	}}
																	className='px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded'>
																	Check Status
																</button>
																{(jobData.status === 'running' || jobData.status === 'initializing') && (
																	<button
																		onClick={() => {
																			if (confirm(`Are you sure you want to kill job ${jobId}? This action cannot be undone.`)) {
																				killJob(jobId);
																			}
																		}}
																		disabled={killingJob === jobId}
																		className='px-3 py-1 text-xs bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded flex items-center gap-1'>
																		{killingJob === jobId ? (
																			<>
																				<span className='animate-spin'>⏳</span>
																				Killing...
																			</>
																		) : (
																			<>
																				<span>🛑</span>
																				Kill Job
																			</>
																		)}
																	</button>
																)}
															</div>
														</div>
													</div>
												</div>
											))}
									</div>
								) : (
									<div className='text-center py-8 text-gray-500'>
										<p>No jobs found</p>
									</div>
								)}
							</div>
						) : (
							<div className='text-center py-8 text-gray-500'>
								<p>Loading jobs...</p>
							</div>
						)}

						<div className='mt-6 flex justify-end'>
							<button onClick={() => setShowJobsModal(false)} className='px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded'>
								Close
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Toast Notification */}
			{toastMessage && (
				<div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
					toastType === 'success' ? 'bg-green-500 text-white' :
					toastType === 'error' ? 'bg-red-500 text-white' :
					'bg-blue-500 text-white'
				}`}>
					<div className="flex items-center gap-2">
						<span>
							{toastType === 'success' ? '✅' : 
							 toastType === 'error' ? '❌' : 'ℹ️'}
						</span>
						<span className="font-medium">{toastMessage}</span>
					</div>
				</div>
			)}
		</div>
	);
}
