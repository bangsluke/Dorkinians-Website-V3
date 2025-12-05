"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DevicePhoneMobileIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

// Define BeforeInstallPromptEvent type
interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallButton() {
	const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
	const [isInstalled, setIsInstalled] = useState(false);
	const [showIOSInstructions, setShowIOSInstructions] = useState(false);
	const [showAndroidInstructions, setShowAndroidInstructions] = useState(false);
	const [isIOS, setIsIOS] = useState(false);
	const [isAndroid, setIsAndroid] = useState(false);
	const [isStandalone, setIsStandalone] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const [isInstalling, setIsInstalling] = useState(false);
	const [installError, setInstallError] = useState<string | null>(null);
	const [showButton, setShowButton] = useState(false);

	useEffect(() => {
		// Check if app is already installed (standalone mode)
		const checkStandalone = () => {
			const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
			setIsStandalone(isStandaloneMode);
			setIsInstalled(isStandaloneMode);
		};

		// Check if device is iOS
		const checkIOS = () => {
			const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
			setIsIOS(isIOSDevice);
		};

		// Check if device is Android
		const checkAndroid = () => {
			const isAndroidDevice = /Android/.test(navigator.userAgent);
			setIsAndroid(isAndroidDevice);
		};

		// Check if device is mobile
		const checkMobile = () => {
			const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
			setIsMobile(isMobileDevice);
			return isMobileDevice;
		};

		// Check if browser supports PWA installation (Chrome, Edge, etc.)
		const checkPWASupport = (isMobileDevice: boolean) => {
			// Improved Chrome detection - works for both desktop and mobile
			const userAgent = navigator.userAgent;
			const isChrome = /Chrome/.test(userAgent) && !/Edg|OPR|Opera/.test(userAgent);
			const isEdge = /Edg/.test(userAgent);
			const isMobileChrome = /Android/.test(userAgent) && /Chrome/.test(userAgent);
			const supportsPWA = isChrome || isEdge || isMobileChrome || isMobileDevice;
			return supportsPWA;
		};

		checkStandalone();
		checkIOS();
		checkAndroid();
		const isMobileDevice = checkMobile();

		// Show button if mobile or if browser supports PWA installation
		const supportsPWA = checkPWASupport(isMobileDevice);
		// Always show on mobile devices, or if PWA is supported
		setShowButton(supportsPWA || isMobileDevice);

		// Listen for the beforeinstallprompt event
		const handleBeforeInstallPrompt = (e: Event) => {
			e.preventDefault();
			setDeferredPrompt(e as BeforeInstallPromptEvent);
			setShowButton(true);
		};

		// Listen for app installed event
		const handleAppInstalled = () => {
			setIsInstalled(true);
			setDeferredPrompt(null);
			setIsInstalling(false);
			setInstallError(null);
		};

		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
		window.addEventListener("appinstalled", handleAppInstalled);

		return () => {
			window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
			window.removeEventListener("appinstalled", handleAppInstalled);
		};
	}, []);

	const handleInstallClick = async () => {
		if (deferredPrompt) {
			setIsInstalling(true);
			setInstallError(null);

			try {
				// Show the install prompt
				await deferredPrompt.prompt();
				const { outcome } = await deferredPrompt.userChoice;

				if (outcome === "accepted") {
					// Installation will be confirmed via appinstalled event
					setIsInstalling(false);
				} else {
					setIsInstalling(false);
					setInstallError("Installation was cancelled");
				}

				setDeferredPrompt(null);
			} catch (error) {
				console.error("Installation error:", error);
				setIsInstalling(false);
				setInstallError("Failed to show installation prompt. Please try using your browser's menu to install the app.");
				setDeferredPrompt(null);
			}
		} else if (isIOS) {
			// Show iOS instructions
			setShowIOSInstructions(true);
		} else if (isAndroid) {
			// Show Android instructions
			setShowAndroidInstructions(true);
		} else {
			// No prompt available - provide helpful message
			setInstallError("Installation prompt not available. Please use your browser's menu (⋮ or ⋯) and select 'Install App' or 'Add to Home Screen'.");
		}
	};

	const closeIOSInstructions = () => {
		setShowIOSInstructions(false);
	};

	const closeAndroidInstructions = () => {
		setShowAndroidInstructions(false);
	};

	// Don't show the button if app is already installed
	if (isInstalled || isStandalone) {
		return null;
	}

	// Don't show the button if app is already installed or button shouldn't be shown
	if (!showButton) {
		return null;
	}

	return (
		<>
			<div className='space-y-2'>
				<motion.button
					onClick={handleInstallClick}
					disabled={isInstalling}
					className='w-full p-4 rounded-lg bg-dorkinians-yellow/20 hover:bg-dorkinians-yellow/30 border border-dorkinians-yellow/40 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed'
					whileHover={{ scale: isInstalling ? 1 : 1.02 }}
					whileTap={{ scale: isInstalling ? 1 : 0.98 }}
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}>
					<div className='flex items-center space-x-4'>
						<div className='p-2 rounded-full bg-dorkinians-yellow/30'>
							{isInstalling ? (
								<div className='w-5 h-5 border-2 border-dorkinians-yellow border-t-transparent rounded-full animate-spin'></div>
							) : (
								<DevicePhoneMobileIcon className='w-5 h-5 text-dorkinians-yellow' />
							)}
						</div>
						<div className='flex-1'>
							<h3 className='text-lg font-semibold text-white'>
								{isInstalling ? "Installing..." : "Add App to Home Screen"}
							</h3>
							<p className='text-sm text-gray-300'>
								{isInstalling
									? "Please confirm the installation in the browser prompt"
									: isIOS
									? "Add Dorkinians FC Stats to your home screen for quick access"
									: "Install Dorkinians FC Stats as a native app on your device"}
							</p>
						</div>
						{!isInstalling && (
							<div className='text-dorkinians-yellow'>
								<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
									<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
								</svg>
							</div>
						)}
					</div>
				</motion.button>

				{installError && (
					<div className='p-3 rounded-lg bg-red-500/20 border border-red-500/30'>
						<p className='text-sm text-red-300'>{installError}</p>
					</div>
				)}
			</div>

			{/* Android Instructions Modal */}
			{showAndroidInstructions && (
				<AnimatePresence>
					<>
						{/* Backdrop */}
						<motion.div
							className='fixed inset-0 bg-black/50 z-[9999]'
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={closeAndroidInstructions}
						/>

						{/* Full-screen modal */}
						<motion.div
							className='fixed inset-0 h-screen w-screen z-[10000] shadow-xl'
							style={{ backgroundColor: '#0f0f0f' }}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ type: "spring", stiffness: 300, damping: 30 }}>
							<div className='h-full flex flex-col'>
								{/* Header */}
								<div className='flex items-center justify-between p-4 border-b border-white/20'>
									<h2 className='text-lg font-semibold text-white'>Add to Home Screen</h2>
									<button
										onClick={closeAndroidInstructions}
										className='p-2 text-white/60 hover:text-white hover:bg-white/20 rounded-full transition-colors'>
										<XMarkIcon className='w-5 h-5' />
									</button>
								</div>

								{/* Scrollable content */}
								<div 
									className='flex-1 overflow-y-auto p-4 space-y-4'
									style={{ WebkitOverflowScrolling: 'touch' }}>
									<div className='space-y-4 text-gray-300'>
										<p className='text-sm text-white'>To add Dorkinians FC Stats to your home screen on Android:</p>

										<div className='space-y-3'>
											<div className='flex items-start space-x-3'>
												<div className='w-6 h-6 rounded-full bg-dorkinians-yellow text-black text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5'>
													1
												</div>
												<p className='text-sm text-white/80'>
													Tap the <strong>three-dot menu</strong> (⋮) in the top-right corner of Chrome
												</p>
											</div>

											<div className='flex items-start space-x-3'>
												<div className='w-6 h-6 rounded-full bg-dorkinians-yellow text-black text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5'>
													2
												</div>
												<p className='text-sm text-white/80'>
													Look for <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong> in the menu
												</p>
											</div>

											<div className='flex items-start space-x-3'>
												<div className='w-6 h-6 rounded-full bg-dorkinians-yellow text-black text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5'>
													3
												</div>
												<p className='text-sm text-white/80'>
													Tap it and confirm the installation when prompted
												</p>
											</div>
										</div>

										<div className='mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg'>
											<p className='text-xs text-blue-300'>
												💡 <strong>Tip:</strong> The app will appear on your home screen like any other app! Chrome on Android fully supports Progressive Web Apps.
											</p>
										</div>
									</div>
								</div>

								{/* Footer with close button */}
								<div className='p-4 border-t border-white/20'>
									<button
										onClick={closeAndroidInstructions}
										className='w-full px-4 py-2 bg-dorkinians-yellow text-black rounded-lg font-semibold hover:bg-dorkinians-yellow/90 transition-colors'>
										Got it!
									</button>
								</div>
							</div>
						</motion.div>
					</>
				</AnimatePresence>
			)}

			{/* iOS Instructions Modal */}
			{showIOSInstructions && (
				<AnimatePresence>
					<>
						{/* Backdrop */}
						<motion.div
							className='fixed inset-0 bg-black/50 z-[9999]'
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={closeIOSInstructions}
						/>

						{/* Full-screen modal */}
						<motion.div
							className='fixed inset-0 h-screen w-screen z-[10000] shadow-xl'
							style={{ backgroundColor: '#0f0f0f' }}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ type: "spring", stiffness: 300, damping: 30 }}>
							<div className='h-full flex flex-col'>
								{/* Header */}
								<div className='flex items-center justify-between p-4 border-b border-white/20'>
									<h2 className='text-lg font-semibold text-white'>Add to Home Screen</h2>
									<button
										onClick={closeIOSInstructions}
										className='p-2 text-white/60 hover:text-white hover:bg-white/20 rounded-full transition-colors'>
										<XMarkIcon className='w-5 h-5' />
									</button>
								</div>

								{/* Scrollable content */}
								<div 
									className='flex-1 overflow-y-auto p-4 space-y-4'
									style={{ WebkitOverflowScrolling: 'touch' }}>
									<div className='space-y-4 text-gray-300'>
										<div className='p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg mb-4'>
											<p className='text-xs text-yellow-300'>
												💡 <strong>Best Browser:</strong> Safari is the best browser to use for adding apps to your home screen on iOS devices.
											</p>
										</div>

										<p className='text-sm text-white'>To add Dorkinians FC Stats to your home screen:</p>

										<div className='space-y-3'>
											<div className='flex items-start space-x-3'>
												<div className='w-6 h-6 rounded-full bg-dorkinians-yellow text-black text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5'>
													1
												</div>
												<p className='text-sm text-white/80'>
													Tap the <strong>Share</strong> button at the bottom of your Safari browser
												</p>
											</div>

											<div className='flex items-start space-x-3'>
												<div className='w-6 h-6 rounded-full bg-dorkinians-yellow text-black text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5'>
													2
												</div>
												<p className='text-sm text-white/80'>
													Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>
												</p>
											</div>

											<div className='flex items-start space-x-3'>
												<div className='w-6 h-6 rounded-full bg-dorkinians-yellow text-black text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5'>
													3
												</div>
												<p className='text-sm text-white/80'>
													Tap <strong>&quot;Add&quot;</strong> to confirm
												</p>
											</div>
										</div>

										<div className='mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg'>
											<p className='text-xs text-blue-300'>
												💡 <strong>Tip:</strong> The app will appear on your home screen like any other app!
											</p>
										</div>
									</div>
								</div>

								{/* Footer with close button */}
								<div className='p-4 border-t border-white/20'>
									<button
										onClick={closeIOSInstructions}
										className='w-full px-4 py-2 bg-dorkinians-yellow text-black rounded-lg font-semibold hover:bg-dorkinians-yellow/90 transition-colors'>
										Got it!
									</button>
								</div>
							</div>
						</motion.div>
					</>
				</AnimatePresence>
			)}
		</>
	);
}
