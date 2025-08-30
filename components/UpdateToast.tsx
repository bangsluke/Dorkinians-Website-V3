"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { CheckIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { pwaUpdateService, UpdateInfo } from "@/lib/services/pwaUpdateService";

interface UpdateToastProps {
	onClose: () => void;
}

export default function UpdateToast({ onClose }: UpdateToastProps) {
	const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
	const [isUpdating, setIsUpdating] = useState(false);
	const [showDismissMessage, setShowDismissMessage] = useState(false);

	useEffect(() => {
		// Only run on client side
		if (typeof window === 'undefined') return;

		// Listen for updates
		pwaUpdateService.onUpdateAvailable((info) => {
			setUpdateInfo(info);
		});

		// Check for updates on mount
		pwaUpdateService.checkForUpdates().then((info) => {
			if (info.isUpdateAvailable) {
				setUpdateInfo(info);
			}
		});
	}, []);

	const handleUpdate = async () => {
		setIsUpdating(true);
		try {
			const success = await pwaUpdateService.performUpdate();
			if (success) {
				// Update successful, close toast
				onClose();
			} else {
				// Update failed or cancelled
				setIsUpdating(false);
			}
		} catch (error) {
			console.error('Update failed:', error);
			setIsUpdating(false);
		}
	};

	const handleDismiss = () => {
		pwaUpdateService.dismissUpdate();
		setShowDismissMessage(true);
		
		// Show dismiss message for 3 seconds then close
		setTimeout(() => {
			onClose();
		}, 3000);
	};

	// Don't render on server side
	if (typeof window === 'undefined') return null;

	if (!updateInfo?.isUpdateAvailable) {
		return null;
	}

	return (
		<AnimatePresence>
			<motion.div
				initial={{ y: 100, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				exit={{ y: 100, opacity: 0 }}
				transition={{ type: "spring", stiffness: 300, damping: 30 }}
				className="fixed bottom-28 left-4 right-4 z-50">
				
				{/* Update Available Toast */}
				{!showDismissMessage && (
					<motion.div
						initial={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="bg-dorkinians-blue rounded-lg shadow-lg border border-white/20 p-4">
						<div className="flex flex-col space-y-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center space-x-3">
									<div className="p-2 rounded-full bg-dorkinians-yellow/20">
										<ArrowPathIcon className="w-5 h-5 text-dorkinians-yellow" />
									</div>
									<div>
										<h3 className="text-white font-semibold">Update Available</h3>
										<p className="text-white/80 text-sm">
											Version {updateInfo.version} is ready to install
										</p>
										{updateInfo.releaseNotes && (
											<p className="text-white/60 text-xs mt-1">
												{updateInfo.releaseNotes}
											</p>
										)}
									</div>
								</div>
								<motion.button
									onClick={handleDismiss}
									className="p-2 text-white/80 hover:text-white transition-colors"
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}>
									<XMarkIcon className="w-5 h-5" />
								</motion.button>
							</div>
							
							{/* Update Button Below Text */}
							<motion.button
								onClick={handleUpdate}
								disabled={isUpdating}
								className="w-full px-4 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}>
								{isUpdating ? (
									<div className="flex items-center justify-center space-x-2">
										<div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
										<span>Updating...</span>
									</div>
								) : (
									<div className="flex items-center justify-center space-x-2">
										<CheckIcon className="w-4 h-4" />
										<span>Update Now</span>
									</div>
								)}
							</motion.button>
						</div>
					</motion.div>
				)}

				{/* Dismiss Message */}
				{showDismissMessage && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4 text-center">
						<p className="text-white text-sm">
							You can update any time from the settings screen
						</p>
					</motion.div>
				)}
			</motion.div>
		</AnimatePresence>
	);
}
