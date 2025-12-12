"use client";

import { useEffect, useState } from "react";
import { getPWADebugInfo } from "@/lib/utils/pwaDebug";

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
		
		// Log error details
		console.error("Next.js Error Page - Error:", error);
		console.error("Next.js Error Page - PWA Debug Info:", debugInfo);
	}, [error]);

	const handleReload = () => {
		if (typeof window !== "undefined") {
			window.location.reload();
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-black to-gray-900">
			<div className="max-w-2xl w-full bg-white/10 backdrop-blur-sm rounded-lg p-6 md:p-8 border border-white/20">
				<div className="text-center mb-6">
					<h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
						Application Error
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
							{error.message || "Unknown error"}
						</p>
						{error.digest && (
							<p className="text-red-300 text-xs mt-2">
								Error ID: {error.digest}
							</p>
						)}
					</div>

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
				</div>

				<div className="flex flex-col sm:flex-row gap-3 justify-center">
					<button
						onClick={handleReload}
						className="px-6 py-3 bg-[#1c8841] hover:bg-[#1a7a3a] text-white font-semibold rounded-lg transition-colors"
					>
						Reload App
					</button>
					<button
						onClick={reset}
						className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors border border-white/20"
					>
						Try Again
					</button>
					<button
						onClick={() => {
							if (typeof window !== "undefined") {
								window.location.href = "/";
							}
						}}
						className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors border border-white/20"
					>
						Go Home
					</button>
				</div>

				<p className="text-center text-gray-400 text-xs mt-6">
					If this problem persists, please check the browser console for more details.
					{pwaDebugInfo?.isIOS && (
						<span className="block mt-2">
							To debug on iOS: Enable Web Inspector in Settings → Safari → Advanced
						</span>
					)}
				</p>
			</div>
		</div>
	);
}
