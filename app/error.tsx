"use client";

import { useEffect, useState } from "react";
import { getPWADebugInfo } from "@/lib/utils/pwaDebug";
import { appConfig } from "@/config/config";
import { logError } from "@/lib/utils/logger";
import { sanitizeError } from "@/lib/utils/errorSanitizer";

interface ErrorPageProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
	const [pwaDebugInfo, setPwaDebugInfo] = useState<ReturnType<typeof getPWADebugInfo> | null>(null);
	const [showDetails, setShowDetails] = useState(false);

	useEffect(() => {
		// Collect PWA debug info when error occurs
		const debugInfo = getPWADebugInfo();
		setPwaDebugInfo(debugInfo);
		
		// Log error details using sanitized logger
		logError("Next.js Error Page - Error", error);
		if (debugInfo) {
			logError("Next.js Error Page - PWA Debug Info", new Error(JSON.stringify(debugInfo)));
		}
	}, [error]);

	const handleReload = () => {
		if (typeof window !== "undefined") {
			window.location.reload();
		}
	};

	const handleEmailDev = () => {
		if (typeof window === "undefined") return;

		// Get selected player from localStorage
		const selectedPlayer = localStorage.getItem("dorkinians-selected-player") || "None";

		// Build email content - sanitize in production
		const isProduction = process.env.NODE_ENV === 'production';
		const sanitizedError = sanitizeError(error, isProduction);
		const errorMessage = sanitizedError.message;
		const stackTrace = isProduction ? "[Stack trace removed in production]" : (error.stack || "No stack trace available");
		const environmentInfo = pwaDebugInfo ? JSON.stringify(pwaDebugInfo, null, 2) : "No environment info available";
		const dateTime = new Date().toISOString();

		const emailBody = `Error Message: ${errorMessage}

Stack Trace:
${stackTrace}

Environment Info:
${environmentInfo}

Selected Player: ${selectedPlayer}

Date/Time: ${dateTime}`;

		const subject = encodeURIComponent("Dorkinians App Error Report");
		const body = encodeURIComponent(emailBody);
		const mailtoLink = `mailto:${appConfig.contact}?subject=${subject}&body=${body}`;

		window.location.href = mailtoLink;
	};

	return (
		<div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-black to-gray-900">
			<div className="max-w-2xl w-full bg-white/10 backdrop-blur-sm rounded-lg p-6 md:p-8 border border-white/20">
				<div className="text-center mb-6">
					<h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
						Whoops - Application Error
					</h1>
					<p className="text-gray-300 text-sm md:text-base">
						A client-side exception has occurred
					</p>
					{pwaDebugInfo?.isPWA && (
						<p className="text-yellow-400 text-xs mt-2">
							Running in PWA mode
						</p>
					)}
				</div>

				<div className="mb-6">
					<div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
						<p className="text-red-200 font-semibold mb-2">Error Message:</p>
						<p className="text-red-100 text-sm font-mono break-words">
							{process.env.NODE_ENV === 'production' 
								? sanitizeError(error, true).message
								: (error.message || "Unknown error")}
						</p>
						{error.digest && (
							<p className="text-red-300 text-xs mt-2">
								Error ID: {error.digest}
							</p>
						)}
					</div>

					{process.env.NODE_ENV !== 'production' && (
						<>
							<button
								onClick={() => setShowDetails(!showDetails)}
								className="w-full text-left text-gray-300 cursor-pointer text-sm mb-2 hover:text-white flex items-center justify-between p-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
							>
								<span>{showDetails ? "Hide" : "Show"} Error Details</span>
								<span className="text-lg">{showDetails ? "−" : "+"}</span>
							</button>

							{showDetails && (
								<div className="space-y-4">
									{error.stack && (
										<details className="mb-4">
											<summary className="text-gray-300 cursor-pointer text-sm mb-2 hover:text-white">
												Stack Trace
											</summary>
											<pre className="bg-black/50 rounded p-3 text-xs text-gray-400 overflow-x-auto max-h-48 overflow-y-auto">
												{error.stack}
											</pre>
										</details>
									)}

									{pwaDebugInfo && (
										<details className="mb-4">
											<summary className="text-gray-300 cursor-pointer text-sm mb-2 hover:text-white">
												Environment Info
											</summary>
											<div className="bg-black/50 rounded p-3 text-xs text-gray-400 overflow-x-auto">
												<pre>{JSON.stringify(pwaDebugInfo, null, 2)}</pre>
											</div>
										</details>
									)}
								</div>
							)}
						</>
					)}
				</div>

				<div className="flex flex-col sm:flex-row gap-3 justify-center">
					<button
						onClick={reset}
						className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors border border-white/20"
					>
						Try Again
					</button>
					<button
						onClick={handleReload}
						className="px-6 py-3 bg-[#1c8841] hover:bg-[#1a7a3a] text-white font-semibold rounded-lg transition-colors"
					>
						Reload App
					</button>
					<button
						onClick={handleEmailDev}
						className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg transition-colors"
					>
						Email Dev
					</button>
				</div>
			</div>
		</div>
	);
}
