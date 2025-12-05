import { appConfig } from "@/config/config";

export interface UpdateInfo {
	isUpdateAvailable: boolean;
	version?: string;
	releaseNotes?: string;
}

class PWAUpdateService {
	private updateAvailable = false;
	private updateCallback?: (updateInfo: UpdateInfo) => void;
	private deferredPrompt: any = null;

	constructor() {
		this.initializeUpdateListener();
	}

	private initializeUpdateListener() {
		// Only run on client side
		if (typeof window === "undefined") return;

		// Listen for the beforeinstallprompt event
		window.addEventListener("beforeinstallprompt", (e) => {
			e.preventDefault();
			this.deferredPrompt = e;
			this.updateAvailable = true;
			this.notifyUpdateAvailable();
		});

		// Listen for service worker updates
		if ("serviceWorker" in navigator) {
			// Check for waiting service worker on initialization
			navigator.serviceWorker.getRegistration().then((registration) => {
				if (registration?.waiting) {
					this.updateAvailable = true;
					this.notifyUpdateAvailable();
				}

				// Listen for new service worker installations
				if (registration) {
					registration.addEventListener("updatefound", () => {
						const newWorker = registration.installing;
						if (newWorker) {
							newWorker.addEventListener("statechange", () => {
								if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
									// New service worker is waiting
									this.updateAvailable = true;
									this.notifyUpdateAvailable();
								}
							});
						}
					});
				}
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
						if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
							// Worker is now waiting
							this.updateAvailable = true;
							resolveOnce({
								isUpdateAvailable: true,
								version: appConfig.version,
								releaseNotes: "Bug fixes and performance improvements",
							});
						} else if (installingWorker.state === "activated") {
							// Worker activated immediately (no update needed)
							if (!resolved) {
								// Continue with update check
							}
						}
					};

					installingWorker.addEventListener("statechange", stateChangeHandler);
					
					// Also check current state in case it's already installed
					if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
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
							if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
								this.updateAvailable = true;
								resolveOnce({
									isUpdateAvailable: true,
									version: appConfig.version,
									releaseNotes: "Bug fixes and performance improvements",
								});
							} else if (installingWorker.state === "activated") {
								// No update available
								if (!resolved) {
									resolveOnce({ isUpdateAvailable: false });
								}
							}
						};

						installingWorker.addEventListener("statechange", stateChangeHandler);
						
						// Set a timeout to check periodically (in case statechange doesn't fire)
						let checkCount = 0;
						const maxChecks = 10; // Check up to 10 times (5 seconds total)
						const checkInterval = setInterval(() => {
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
						}, 500);
						
						// Also set a final timeout as fallback
						setTimeout(() => {
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
						}, 5000);
					} else {
						// No installing worker, check periodically for a short time
						let checkCount = 0;
						const maxChecks = 6; // Check up to 6 times (3 seconds total)
						const checkInterval = setInterval(() => {
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
						}, 500);
						
						// Final timeout as fallback
						setTimeout(() => {
							clearInterval(checkInterval);
							if (!resolved) {
								resolveOnce({ isUpdateAvailable: false });
							}
						}, 3000);
					}
				}).catch(() => {
					// If update check fails, resolve with no update
					if (!resolved) {
						resolveOnce({ isUpdateAvailable: false });
					}
				});
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

	public async performUpdate(): Promise<boolean> {
		// Only run on client side
		if (typeof window === "undefined") return false;

		if (this.deferredPrompt) {
			this.deferredPrompt.prompt();
			const { outcome } = await this.deferredPrompt.userChoice;
			this.deferredPrompt = null;

			if (outcome === "accepted") {
				this.updateAvailable = false;
				return true;
			}
		}
		return false;
	}

	public dismissUpdate() {
		this.updateAvailable = false;
	}

	public async activateUpdate(): Promise<void> {
		// Only run on client side
		if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
			return;
		}

		const registration = await navigator.serviceWorker.getRegistration();
		if (registration?.waiting) {
			// Send message to waiting service worker to skip waiting
			registration.waiting.postMessage({ type: "SKIP_WAITING" });
			// Reload to activate new service worker
			window.location.reload();
		}
	}
}

export const pwaUpdateService = new PWAUpdateService();
