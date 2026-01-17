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
					// First, check if there's already a waiting service worker (from previous update)
					// This is the primary check - we want to detect updates that are already waiting
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
					let updateCheckTimeout: ReturnType<typeof setTimeout> | null = null;
					let updateFoundHandler: (() => void) | null = null;
					
					const resolveOnce = (info: UpdateInfo) => {
						if (!resolved) {
							resolved = true;
							// Clean up listeners and timeouts
							if (updateCheckTimeout) {
								clearTimeout(updateCheckTimeout);
								updateCheckTimeout = null;
							}
							if (updateFoundHandler) {
								registration.removeEventListener("updatefound", updateFoundHandler);
								updateFoundHandler = null;
							}
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

					// Only trigger a new update check if there's no waiting or installing worker
					// This prevents automatic activation when user just wants to check for existing updates
					// Note: registration.update() will check for new service worker versions but won't
					// activate them automatically (skipWaiting: false in next.config.js)
					
					// Set up updatefound listener BEFORE calling registration.update()
					// This ensures we catch the event when a new service worker is found
					updateFoundHandler = () => {
						try {
							const installingWorker = registration.installing;
							if (!installingWorker) {
								if (!resolved) {
									resolveOnce({ isUpdateAvailable: false });
								}
								return;
							}

							// Wait for the installing worker to reach "installed" state
							const stateChangeHandler = () => {
								try {
									if (installingWorker?.state === "installed" && navigator.serviceWorker?.controller) {
										// Worker is now waiting - update available!
										this.updateAvailable = true;
										resolveOnce({
											isUpdateAvailable: true,
											version: appConfig.version,
											releaseNotes: "Bug fixes and performance improvements",
										});
									} else if (installingWorker?.state === "activated") {
										// Worker activated immediately (no update needed, or first install)
										if (!resolved) {
											resolveOnce({ isUpdateAvailable: false });
										}
									}
								} catch (error) {
									console.error("[PWAUpdateService] Error in stateChangeHandler:", error);
								}
							};

							// Check current state in case it's already installed
							if (installingWorker.state === "installed" && navigator.serviceWorker?.controller) {
								this.updateAvailable = true;
								resolveOnce({
									isUpdateAvailable: true,
									version: appConfig.version,
									releaseNotes: "Bug fixes and performance improvements",
								});
								return;
							}

							// Listen for state changes
							installingWorker.addEventListener("statechange", stateChangeHandler);

							// Also poll periodically as a fallback (in case statechange doesn't fire)
							let checkCount = 0;
							const maxChecks = 20; // Check up to 20 times (10 seconds total)
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
									} else if (installingWorker?.state === "installed" && navigator.serviceWorker?.controller) {
										clearInterval(checkInterval);
										this.updateAvailable = true;
										resolveOnce({
											isUpdateAvailable: true,
											version: appConfig.version,
											releaseNotes: "Bug fixes and performance improvements",
										});
									} else if (installingWorker?.state === "activated" || checkCount >= maxChecks) {
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
						} catch (error) {
							console.error("[PWAUpdateService] Error in updatefound handler:", error);
							if (!resolved) {
								resolveOnce({ isUpdateAvailable: false });
							}
						}
					};

					// Add the listener BEFORE calling update()
					registration.addEventListener("updatefound", updateFoundHandler);

					// Trigger the update check
					registration.update().catch((error) => {
						console.error("[PWAUpdateService] Error in registration.update():", error);
						// Remove listener on error
						if (updateFoundHandler) {
							registration.removeEventListener("updatefound", updateFoundHandler);
						}
						if (!resolved) {
							resolveOnce({ isUpdateAvailable: false });
						}
					});

					// Set a timeout to resolve if no update is found within reasonable time
					// This handles the case where registration.update() completes but no updatefound event fires
					updateCheckTimeout = setTimeout(() => {
						try {
							// Check if a waiting worker appeared
							if (registration.waiting) {
								this.updateAvailable = true;
								resolveOnce({
									isUpdateAvailable: true,
									version: appConfig.version,
									releaseNotes: "Bug fixes and performance improvements",
								});
							} else if (!resolved) {
								// No update found - remove listener and resolve
								if (updateFoundHandler) {
									registration.removeEventListener("updatefound", updateFoundHandler);
								}
								resolveOnce({ isUpdateAvailable: false });
							}
						} catch (error) {
							console.error("[PWAUpdateService] Error in update check timeout:", error);
							if (updateFoundHandler) {
								registration.removeEventListener("updatefound", updateFoundHandler);
							}
							if (!resolved) {
								resolveOnce({ isUpdateAvailable: false });
							}
						}
					}, 10000); // 10 second timeout for update check
				} catch (error) {
					console.error("[PWAUpdateService] Error in update check:", error);
					resolve({ isUpdateAvailable: false });
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
				// Store the update date before reloading
				this.setLastUpdateDate(new Date());
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

	public getLastUpdateDate(): Date | null {
		// Only run on client side
		if (typeof window === "undefined") {
			return null;
		}

		try {
			const dateString = localStorage.getItem("dorkinians-last-update-date");
			if (!dateString) {
				return null;
			}
			return new Date(dateString);
		} catch (error) {
			console.error("[PWAUpdateService] Error getting last update date:", error);
			return null;
		}
	}

	private setLastUpdateDate(date: Date): void {
		// Only run on client side
		if (typeof window === "undefined") {
			return;
		}

		try {
			localStorage.setItem("dorkinians-last-update-date", date.toISOString());
		} catch (error) {
			console.error("[PWAUpdateService] Error setting last update date:", error);
		}
	}
}

export const pwaUpdateService = new PWAUpdateService();
