// Global type declarations for PWA events

interface BeforeInstallPromptEvent extends Event {
	readonly platforms: string[];
	readonly userChoice: Promise<{
		outcome: "accepted" | "dismissed";
		platform: string;
	}>;
	prompt(): Promise<void>;
}

// Umami Analytics types
interface Umami {
	track(eventName: string, eventData?: Record<string, any>): void;
}

declare global {
	interface WindowEventMap {
		beforeinstallprompt: BeforeInstallPromptEvent;
	}

	interface Window {
		umami?: Umami;
	}
}

export {};
