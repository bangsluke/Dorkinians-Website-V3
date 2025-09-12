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
			navigator.serviceWorker.addEventListener("controllerchange", () => {
				this.updateAvailable = true;
				this.notifyUpdateAvailable();
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

			if ("serviceWorker" in navigator) {
				navigator.serviceWorker.getRegistration().then((registration) => {
					if (registration) {
						registration.update();

						// Simulate checking for updates (in a real app, this would check with your server)
						setTimeout(() => {
							// Randomly simulate an update being available (for demo purposes)
							const hasUpdate = Math.random() > 0.5;
							this.updateAvailable = hasUpdate;

							const updateInfo: UpdateInfo = {
								isUpdateAvailable: hasUpdate,
								version: hasUpdate ? appConfig.version : undefined,
								releaseNotes: hasUpdate ? "Bug fixes and performance improvements" : undefined,
							};
							resolve(updateInfo);
						}, 1000);
					} else {
						resolve({ isUpdateAvailable: false });
					}
				});
			} else {
				resolve({ isUpdateAvailable: false });
			}
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
}

export const pwaUpdateService = new PWAUpdateService();
