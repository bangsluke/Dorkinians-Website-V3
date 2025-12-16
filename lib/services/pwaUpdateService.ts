import { appConfig } from "@/config/config";

export interface UpdateInfo {
	isUpdateAvailable: boolean;
	version?: string;
	releaseNotes?: string;
}

class PWAUpdateService {
	private updateAvailable = false;
	private updateCallback?: (updateInfo: UpdateInfo) => void;

	constructor() {
		this.initializeUpdateListener();
	}

	private initializeUpdateListener() {
		// Only run on client side
		if (typeof window === "undefined") return;

		// Listen for service worker updates
		if ("serviceWorker" in navigator) {
			// Check for waiting service worker on initialization
			navigator.serviceWorker.getRegistration().then((registration) => {
				if (!registration) return;
				
				try {
					if (registration.waiting) {
						this.updateAvailable = true;
						this.notifyUpdateAvailable();
					}

					// Listen for new service worker installations
					registration.addEventListener("updatefound", () => {
						try {
							const newWorker = registration.installing;
							if (newWorker) {
								newWorker.addEventListener("statechange", () => {
									try {
										if (newWorker.state === "installed" && navigator.serviceWorker?.controller) {
											// New service worker is waiting
											this.updateAvailable = true;
											this.notifyUpdateAvailable();
										}
									} catch (error) {
										console.error("[PWAUpdateService] Error in statechange handler:", error);
									}
								});
							}
						} catch (error) {
							console.error("[PWAUpdateService] Error in updatefound handler:", error);
						}
					});
				} catch (error) {
					console.error("[PWAUpdateService] Error initializing update listener:", error);
				}
			}).catch((error) => {
				console.error("[PWAUpdateService] Error getting service worker registration:", error);
			});

			// Check for updates on page load
			this.checkForUpdates();
		}
	}

	public checkForUpdates(): Promise<UpdateInfo> {
		return new Promise((resolve) => {
			// Only run on client side
			if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
				resolve({ isUpdateAvailable: false });
				return;
			}

			navigator.serviceWorker.getRegistration().then((registration) => {
				if (!registration) {
					resolve({ isUpdateAvailable: false });
					return;
				}

				try {
					// Check if there's a waiting service worker
					if (registration.waiting) {
						this.updateAvailable = true;
						resolve({
							isUpdateAvailable: true,
							version: appConfig.version,
							releaseNotes: "Bug fixes and performance improvements",
						});
						return;
					}

					// Track if we've already resolved to avoid multiple resolutions
					let resolved = false;
					const resolveOnce = (info: UpdateInfo) => {
						if (!resolved) {
							resolved = true;
							resolve(info);
						}
					};

					// Check for installing worker and wait for it to become waiting
					if (registration.installing) {
						const installingWorker = registration.installing;
					
						const stateChangeHandler = () => {
							try {
								if (installingWorker?.state === "installed" && navigator.serviceWorker?.controller) {
									// Worker is now waiting
									this.updateAvailable = true;
									resolveOnce({
										isUpdateAvailable: true,
										version: appConfig.version,
										releaseNotes: "Bug fixes and performance improvements",
									});
								} else if (installingWorker?.state === "activated") {
									// Worker activated immediately (no update needed)
									if (!resolved) {
										// Continue with update check
									}
								}
							} catch (error) {
								console.error("[PWAUpdateService] Error in stateChangeHandler:", error);
							}
						};

						if (installingWorker) {
							installingWorker.addEventListener("statechange", stateChangeHandler);
						}
						
						// Also check current state in case it's already installed
						if (installingWorker?.state === "installed" && navigator.serviceWorker?.controller) {
							this.updateAvailable = true;
							resolveOnce({
								isUpdateAvailable: true,
								version: appConfig.version,
								releaseNotes: "Bug fixes and performance improvements",
							});
							return;
						}
					}

					// Force update check
					registration.update().then(() => {
						try {
							// Check immediately after update
							if (registration.waiting) {
								this.updateAvailable = true;
								resolveOnce({
									isUpdateAvailable: true,
									version: appConfig.version,
									releaseNotes: "Bug fixes and performance improvements",
								});
								return;
							}

							// If there's an installing worker, wait for it
							if (registration.installing) {
							const installingWorker = registration.installing;
							
							const stateChangeHandler = () => {
								try {
									if (installingWorker?.state === "installed" && navigator.serviceWorker?.controller) {
										this.updateAvailable = true;
										resolveOnce({
											isUpdateAvailable: true,
											version: appConfig.version,
											releaseNotes: "Bug fixes and performance improvements",
										});
									} else if (installingWorker?.state === "activated") {
										// No update available
										if (!resolved) {
											resolveOnce({ isUpdateAvailable: false });
										}
									}
								} catch (error) {
									console.error("[PWAUpdateService] Error in stateChangeHandler:", error);
								}
							};

							if (installingWorker) {
								installingWorker.addEventListener("statechange", stateChangeHandler);
							}
						
							// Set a timeout to check periodically (in case statechange doesn't fire)
							let checkCount = 0;
							const maxChecks = 10; // Check up to 10 times (5 seconds total)
							const checkInterval = setInterval(() => {
								try {
									checkCount++;
									
									if (registration.waiting) {
										clearInterval(checkInterval);
										this.updateAvailable = true;
										resolveOnce({
											isUpdateAvailable: true,
											version: appConfig.version,
											releaseNotes: "Bug fixes and performance improvements",
										});
									} else if (checkCount >= maxChecks || !registration.installing) {
										clearInterval(checkInterval);
										if (!resolved) {
											resolveOnce({ isUpdateAvailable: false });
										}
									}
								} catch (error) {
									console.error("[PWAUpdateService] Error in checkInterval:", error);
									clearInterval(checkInterval);
									if (!resolved) {
										resolveOnce({ isUpdateAvailable: false });
									}
								}
							}, 500);
							
							// Also set a final timeout as fallback
							setTimeout(() => {
								try {
									clearInterval(checkInterval);
									if (registration.waiting) {
										this.updateAvailable = true;
										resolveOnce({
											isUpdateAvailable: true,
											version: appConfig.version,
											releaseNotes: "Bug fixes and performance improvements",
										});
									} else if (!resolved) {
										resolveOnce({ isUpdateAvailable: false });
									}
								} catch (error) {
									console.error("[PWAUpdateService] Error in final timeout:", error);
									if (!resolved) {
										resolveOnce({ isUpdateAvailable: false });
									}
								}
							}, 5000);
						} else {
							// No installing worker, check periodically for a short time
							let checkCount = 0;
							const maxChecks = 6; // Check up to 6 times (3 seconds total)
							const checkInterval = setInterval(() => {
								try {
									checkCount++;
									
									if (registration.waiting) {
										clearInterval(checkInterval);
										this.updateAvailable = true;
										resolveOnce({
											isUpdateAvailable: true,
											version: appConfig.version,
											releaseNotes: "Bug fixes and performance improvements",
										});
									} else if (checkCount >= maxChecks) {
										clearInterval(checkInterval);
										if (!resolved) {
											resolveOnce({ isUpdateAvailable: false });
										}
									}
								} catch (error) {
									console.error("[PWAUpdateService] Error in checkInterval:", error);
									clearInterval(checkInterval);
									if (!resolved) {
										resolveOnce({ isUpdateAvailable: false });
									}
								}
							}, 500);
							
							// Final timeout as fallback
							setTimeout(() => {
								try {
									clearInterval(checkInterval);
									if (!resolved) {
										resolveOnce({ isUpdateAvailable: false });
									}
								} catch (error) {
									console.error("[PWAUpdateService] Error in final timeout:", error);
									if (!resolved) {
										resolveOnce({ isUpdateAvailable: false });
									}
								}
							}, 3000);
							}
						} catch (error) {
							console.error("[PWAUpdateService] Error in update check:", error);
							if (!resolved) {
								resolveOnce({ isUpdateAvailable: false });
							}
						}
					}).catch((error) => {
						// If update check fails, resolve with no update
						console.error("[PWAUpdateService] Error in registration.update():", error);
						if (!resolved) {
							resolveOnce({ isUpdateAvailable: false });
						}
					});
				} catch (error) {
					console.error("[PWAUpdateService] Error in update check:", error);
					if (!resolved) {
						resolveOnce({ isUpdateAvailable: false });
					}
				}
			}).catch((error) => {
				console.error("[PWAUpdateService] Error getting service worker registration:", error);
				resolve({ isUpdateAvailable: false });
			});
		});
	}

	public onUpdateAvailable(callback: (updateInfo: UpdateInfo) => void) {
		this.updateCallback = callback;
	}

	private notifyUpdateAvailable() {
		if (this.updateCallback) {
			this.updateCallback({
				isUpdateAvailable: true,
				version: appConfig.version,
				releaseNotes: "Bug fixes and performance improvements",
			});
		}
	}

	public dismissUpdate() {
		this.updateAvailable = false;
	}

	public async activateUpdate(): Promise<void> {
		// Only run on client side
		if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
			return;
		}

		try {
			const registration = await navigator.serviceWorker.getRegistration();
			if (registration?.waiting) {
				// Send message to waiting service worker to skip waiting
				if (registration.waiting.postMessage) {
					registration.waiting.postMessage({ type: "SKIP_WAITING" });
				}
				// Reload to activate new service worker
				if (window.location?.reload) {
					window.location.reload();
				}
			}
		} catch (error) {
			console.error("[PWAUpdateService] Error activating update:", error);
		}
	}
}

export const pwaUpdateService = new PWAUpdateService();
