"use client";

import { useState, useEffect } from "react";
import { consumePwaUpdateResultToast, pwaUpdateService } from "@/lib/services/pwaUpdateService";
import { useToast } from "@/lib/hooks/useToast";

interface PWAUpdateNotificationProps {
	onUpdate?: () => void;
}

export default function PWAUpdateNotification({ onUpdate }: PWAUpdateNotificationProps) {
	const [showUpdateNotification, setShowUpdateNotification] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);
	const { showSuccess, showError } = useToast();

	useEffect(() => {
		const result = consumePwaUpdateResultToast();
		if (result === "success") {
			showSuccess("Update Successful");
		} else if (result === "error") {
			showError("Update Unsuccessful");
		}
	}, [showSuccess, showError]);

	useEffect(() => {
		try {
			const isPWAInstalled =
				window.matchMedia("(display-mode: standalone)").matches ||
				(window.navigator as Navigator & { standalone?: boolean }).standalone === true;

			if (!isPWAInstalled || !("serviceWorker" in navigator)) {
				return;
			}

			navigator.serviceWorker
				.getRegistration()
				.then((registration) => {
					if (!registration) return;

					try {
						if (registration.waiting) {
							setShowUpdateNotification(true);
						}

						registration.addEventListener("updatefound", () => {
							try {
								const newWorker = registration.installing;
								if (!newWorker) return;
								newWorker.addEventListener("statechange", () => {
									try {
										if (newWorker.state === "installed" && navigator.serviceWorker?.controller) {
											setShowUpdateNotification(true);
										}
									} catch (error) {
										console.error("[PWAUpdateNotification] Error in statechange handler:", error);
									}
								});
							} catch (error) {
								console.error("[PWAUpdateNotification] Error in updatefound handler:", error);
							}
						});
					} catch (error) {
						console.error("[PWAUpdateNotification] Error setting up update listener:", error);
					}
				})
				.catch((error) => {
					console.error("[PWAUpdateNotification] Error getting service worker registration:", error);
				});
		} catch (error) {
			console.error("[PWAUpdateNotification] Error in useEffect:", error);
		}
	}, []);

	const handleUpdate = async () => {
		setIsUpdating(true);
		try {
			const result = await pwaUpdateService.activateUpdate();
			if (result === "success") {
				// Page reloads after controllerchange; toast is shown on the next load.
				setShowUpdateNotification(false);
				onUpdate?.();
				return;
			}
			if (result === "no-waiting") {
				setShowUpdateNotification(false);
				showSuccess("Update Successful");
			} else {
				showError("Update Unsuccessful");
			}
			setIsUpdating(false);
		} catch (error) {
			console.error("Update failed:", error);
			showError("Update Unsuccessful");
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
							type='button'
							onClick={handleUpdate}
							disabled={isUpdating}
							className='bg-white text-blue-600 px-3 py-1 rounded text-xs font-medium hover:bg-blue-50 disabled:opacity-50'>
							{isUpdating ? "Updating..." : "Update Now"}
						</button>
						<button type='button' onClick={handleDismiss} className='text-blue-100 hover:text-white text-xs'>
							Later
						</button>
					</div>
				</div>
				<button type='button' onClick={handleDismiss} className='text-blue-200 hover:text-white ml-2' aria-label='Dismiss update notification'>
					<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
					</svg>
				</button>
			</div>
		</div>
	);
}
