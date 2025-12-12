// PWA debugging utilities for detecting environment and collecting debug info

export interface PWADebugInfo {
	isPWA: boolean;
	isIOS: boolean;
	isAndroid: boolean;
	isStandalone: boolean;
	userAgent: string;
	displayMode: string | null;
	serviceWorkerSupported: boolean;
	localStorageSupported: boolean;
	localStorageQuota: string | null;
	windowSize: { width: number; height: number };
	timestamp: string;
}

// Check if running in PWA standalone mode
export function isPWAInstalled(): boolean {
	if (typeof window === "undefined") return false;
	
	// Check for standalone display mode
	const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
	
	// iOS Safari specific check
	const isIOSStandalone = (window.navigator as any).standalone === true;
	
	return isStandalone || isIOSStandalone;
}

// Detect iOS device
export function isIOS(): boolean {
	if (typeof window === "undefined") return false;
	return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

// Detect Android device
export function isAndroid(): boolean {
	if (typeof window === "undefined") return false;
	return /Android/.test(navigator.userAgent);
}

// Get display mode (standalone, fullscreen, minimal-ui, browser)
export function getDisplayMode(): string | null {
	if (typeof window === "undefined") return null;
	
	if (window.matchMedia("(display-mode: standalone)").matches) return "standalone";
	if (window.matchMedia("(display-mode: fullscreen)").matches) return "fullscreen";
	if (window.matchMedia("(display-mode: minimal-ui)").matches) return "minimal-ui";
	return "browser";
}

// Check localStorage availability and quota
export function checkLocalStorageSupport(): { supported: boolean; quota: string | null; error?: string } {
	if (typeof window === "undefined") {
		return { supported: false, quota: null };
	}
	
	try {
		const testKey = "__pwa_test__";
		localStorage.setItem(testKey, "test");
		localStorage.removeItem(testKey);
		
		// Try to estimate quota (this may not work in all browsers)
		let quota: string | null = null;
		if ("storage" in navigator && "estimate" in navigator.storage) {
			navigator.storage.estimate().then((estimate) => {
				if (estimate.quota) {
					const quotaMB = Math.round(estimate.quota / 1024 / 1024);
					quota = `${quotaMB}MB`;
				}
			}).catch(() => {
				// Ignore quota estimation errors
			});
		}
		
		return { supported: true, quota };
	} catch (e: any) {
		return { 
			supported: false, 
			quota: null, 
			error: e.message || "localStorage not available" 
		};
	}
}

// Collect comprehensive PWA debug information
export function getPWADebugInfo(): PWADebugInfo {
	const isPWA = isPWAInstalled();
	const isIOSDevice = isIOS();
	const isAndroidDevice = isAndroid();
	const displayMode = getDisplayMode();
	const localStorageCheck = checkLocalStorageSupport();
	
	return {
		isPWA,
		isIOS: isIOSDevice,
		isAndroid: isAndroidDevice,
		isStandalone: isPWA,
		userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
		displayMode,
		serviceWorkerSupported: typeof navigator !== "undefined" && "serviceWorker" in navigator,
		localStorageSupported: localStorageCheck.supported,
		localStorageQuota: localStorageCheck.quota,
		windowSize: {
			width: typeof window !== "undefined" ? window.innerWidth : 0,
			height: typeof window !== "undefined" ? window.innerHeight : 0,
		},
		timestamp: new Date().toISOString(),
	};
}

// Safely access localStorage with error handling
export function safeLocalStorageGet(key: string): string | null {
	if (typeof window === "undefined") return null;
	
	try {
		return localStorage.getItem(key);
	} catch (e: any) {
		console.warn(`Failed to read from localStorage (key: ${key}):`, e.message);
		return null;
	}
}

// Safely set localStorage with error handling
export function safeLocalStorageSet(key: string, value: string): boolean {
	if (typeof window === "undefined") return false;
	
	try {
		localStorage.setItem(key, value);
		return true;
	} catch (e: any) {
		console.warn(`Failed to write to localStorage (key: ${key}):`, e.message);
		
		// If quota exceeded, try to clear old data
		if (e.name === "QuotaExceededError" || e.message?.includes("quota")) {
			console.warn("localStorage quota exceeded, attempting cleanup...");
			try {
				// Clear old cache keys (example - adjust based on your app's keys)
				const keysToKeep = ["selectedPlayer", "team-stats-selected-team"];
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i);
					if (key && !keysToKeep.some(keepKey => key.includes(keepKey))) {
						localStorage.removeItem(key);
					}
				}
				// Retry setting the value
				localStorage.setItem(key, value);
				return true;
			} catch (retryError) {
				console.error("Failed to recover from localStorage quota error:", retryError);
			}
		}
		
		return false;
	}
}

// Safely remove from localStorage
export function safeLocalStorageRemove(key: string): boolean {
	if (typeof window === "undefined") return false;
	
	try {
		localStorage.removeItem(key);
		return true;
	} catch (e: any) {
		console.warn(`Failed to remove from localStorage (key: ${key}):`, e.message);
		return false;
	}
}
