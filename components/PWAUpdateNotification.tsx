"use client";

import { useState, useEffect } from "react";
import { pwaUpdateService } from "@/lib/services/pwaUpdateService";

interface PWAUpdateNotificationProps {
	onUpdate?: () => void;
}

export default function PWAUpdateNotification({ onUpdate }: PWAUpdateNotificationProps) {
	const [showUpdateNotification, setShowUpdateNotification] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);

	useEffect(() => {
		// Check if PWA is installed
		const isPWAInstalled = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;

		if (isPWAInstalled) {
			// Listen for service worker updates
			if ("serviceWorker" in navigator) {
				// Check for updates on page load
				navigator.serviceWorker.getRegistration().then((registration) => {
					if (registration) {
						// Check if there's already a waiting worker
						if (registration.waiting) {
							setShowUpdateNotification(true);
						}

						registration.addEventListener("updatefound", () => {
							const newWorker = registration.installing;
							if (newWorker) {
								newWorker.addEventListener("statechange", () => {
									if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
										setShowUpdateNotification(true);
									}
								});
							}
						});
					}
				});
			}
		}
	}, []);

	const handleUpdate = async () => {
		setIsUpdating(true);
		try {
			await pwaUpdateService.activateUpdate();
			// Page will reload, so this won't execute
			if (onUpdate) {
				onUpdate();
			}
		} catch (error) {
			console.error("Update failed:", error);
			setIsUpdating(false);
		}
	};

	const handleDismiss = () => {
		setShowUpdateNotification(false);
	};

	if (!showUpdateNotification) {
		return null;
	}

	return (
		<div className='fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50'>
			<div className='flex items-start justify-between'>
				<div className='flex-1'>
					<h3 className='font-semibold text-sm mb-1'>Update Available</h3>
					<p className='text-xs text-blue-100 mb-3'>
						A new version of Dorkinians Stats is available. Update to get the latest features and improvements.
					</p>
					<div className='flex space-x-2'>
						<button
							onClick={handleUpdate}
							disabled={isUpdating}
							className='bg-white text-blue-600 px-3 py-1 rounded text-xs font-medium hover:bg-blue-50 disabled:opacity-50'>
							{isUpdating ? "Updating..." : "Update Now"}
						</button>
						<button onClick={handleDismiss} className='text-blue-100 hover:text-white text-xs'>
							Later
						</button>
					</div>
				</div>
				<button onClick={handleDismiss} className='text-blue-200 hover:text-white ml-2'>
					<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
					</svg>
				</button>
			</div>
		</div>
	);
}
