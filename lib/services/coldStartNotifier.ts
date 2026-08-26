/**
 * Page-level Neo4j cold-start toast bridge.
 * Registered once from the home page useToast instance (not a second ToastContainer).
 */

export const COLD_START_TOAST_MESSAGE =
	"Waking up the app… Connecting to the database can take a few seconds after startup. The page will update shortly.";

export const COLD_START_RECOVERED_TOAST_MESSAGE = "Connected.";

export const COLD_START_STILL_FAILING_TOAST_MESSAGE =
	"The app is still starting up. Some data may be stale — try refreshing in a moment.";

export type ColdStartNotifierCallbacks = {
	onColdStart: () => string | void;
	onRecovered: () => void;
	onStillFailing?: () => void;
};

let callbacks: ColdStartNotifierCallbacks | null = null;
let coldStartNotified = false;
let recoveredNotified = false;
let stillFailingNotified = false;
let activeToastId: string | null = null;

export function setColdStartNotifier(next: ColdStartNotifierCallbacks | null): void {
	callbacks = next;
}

export function resetColdStartNotifierState(): void {
	coldStartNotified = false;
	recoveredNotified = false;
	stillFailingNotified = false;
	activeToastId = null;
}

export function notifyNeo4jColdStart(): void {
	if (coldStartNotified || !callbacks) {
		return;
	}
	coldStartNotified = true;
	const id = callbacks.onColdStart();
	if (typeof id === "string") {
		activeToastId = id;
	}
}

export function notifyNeo4jColdStartRecovered(): void {
	if (!coldStartNotified || recoveredNotified || !callbacks) {
		return;
	}
	recoveredNotified = true;
	callbacks.onRecovered();
	activeToastId = null;
}

export function notifyNeo4jColdStartStillFailing(): void {
	if (!coldStartNotified || recoveredNotified || stillFailingNotified || !callbacks) {
		return;
	}
	stillFailingNotified = true;
	callbacks.onStillFailing?.();
	activeToastId = null;
}

export function getActiveColdStartToastId(): string | null {
	return activeToastId;
}

/** Test helper */
export function getColdStartNotifierDebugState(): {
	coldStartNotified: boolean;
	recoveredNotified: boolean;
	stillFailingNotified: boolean;
	hasCallbacks: boolean;
} {
	return {
		coldStartNotified,
		recoveredNotified,
		stillFailingNotified,
		hasCallbacks: callbacks !== null,
	};
}
