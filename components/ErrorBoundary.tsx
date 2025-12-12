"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { getPWADebugInfo } from "@/lib/utils/pwaDebug";
import { appConfig } from "@/config/config";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
	errorInfo: ErrorInfo | null;
	pwaDebugInfo: ReturnType<typeof getPWADebugInfo> | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			pwaDebugInfo: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<State> {
		// Update state so the next render will show the fallback UI
		return {
			hasError: true,
			error,
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		// Collect PWA debug info when error occurs
		const pwaDebugInfo = getPWADebugInfo();
		
		// Log error details
		console.error("ErrorBoundary caught an error:", error);
		console.error("Error info:", errorInfo);
		console.error("PWA Debug Info:", pwaDebugInfo);
		
		this.setState({
			error,
			errorInfo,
			pwaDebugInfo,
		});
	}

	handleReload = () => {
		if (typeof window !== "undefined") {
			window.location.reload();
		}
	};

	handleEmailDev = () => {
		if (typeof window === "undefined") return;

		// Get selected player from localStorage
		const selectedPlayer = localStorage.getItem("dorkinians-selected-player") || "None";

		// Build email content
		const errorMessage = this.state.error?.message || "Unknown error";
		const stackTrace = this.state.error?.stack || "No stack trace available";
		const environmentInfo = this.state.pwaDebugInfo ? JSON.stringify(this.state.pwaDebugInfo, null, 2) : "No environment info available";
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

	render() {
		if (this.state.hasError) {
			// Use custom fallback if provided
			if (this.props.fallback) {
				return this.props.fallback;
			}

			// Default error UI
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
						</div>

						{this.state.error && (
							<div className="mb-6">
								<div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
									<p className="text-red-200 font-semibold mb-2">Error Message:</p>
									<p className="text-red-100 text-sm font-mono break-words">
										{this.state.error.message || "Unknown error"}
									</p>
								</div>

								{this.state.errorInfo && (
									<details className="mb-4">
										<summary className="text-gray-300 cursor-pointer text-sm mb-2 hover:text-white">
											Stack Trace (click to expand)
										</summary>
										<pre className="bg-black/50 rounded p-3 text-xs text-gray-400 overflow-x-auto max-h-48 overflow-y-auto">
											{this.state.error.stack || "No stack trace available"}
										</pre>
									</details>
								)}

								{this.state.pwaDebugInfo && (
									<details className="mb-4">
										<summary className="text-gray-300 cursor-pointer text-sm mb-2 hover:text-white">
											Environment Info (click to expand)
										</summary>
										<div className="bg-black/50 rounded p-3 text-xs text-gray-400 overflow-x-auto">
											<pre>{JSON.stringify(this.state.pwaDebugInfo, null, 2)}</pre>
										</div>
									</details>
								)}
							</div>
						)}

						<div className="flex flex-col sm:flex-row gap-3 justify-center">
							<button
								onClick={this.handleReload}
								className="px-6 py-3 bg-[#1c8841] hover:bg-[#1a7a3a] text-white font-semibold rounded-lg transition-colors"
							>
								Reload App
							</button>
							<button
								onClick={this.handleEmailDev}
								className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg transition-colors"
							>
								Email Dev
							</button>
						</div>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
