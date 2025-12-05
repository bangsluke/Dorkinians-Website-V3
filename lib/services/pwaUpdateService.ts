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

				// Check for installing worker
				if (registration.installing) {
					registration.installing.addEventListener("statechange", () => {
						if (registration.waiting) {
							this.updateAvailable = true;
							resolve({
								isUpdateAvailable: true,
								version: appConfig.version,
								releaseNotes: "Bug fixes and performance improvements",
							});
						}
					});
				}

				// Force update check
				registration.update().then(() => {
					// After update check, see if we now have a waiting worker
					setTimeout(() => {
						if (registration.waiting) {
							this.updateAvailable = true;
							resolve({
								isUpdateAvailable: true,
								version: appConfig.version,
								releaseNotes: "Bug fixes and performance improvements",
							});
						} else {
							resolve({ isUpdateAvailable: false });
						}
					}, 1000);
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
