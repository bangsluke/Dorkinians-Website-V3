import type { UmamiEventName } from "@/lib/analytics/events";

export type UmamiProps = Record<string, string | number | boolean | undefined>;

/**
 * Client-safe Umami custom event. No-ops on server or when umami is unavailable.
 */
export function trackEvent(name: UmamiEventName | string, props?: UmamiProps): void {
	if (typeof window === "undefined") {
		return;
	}
	const umami = window.umami;
	if (!umami || typeof umami.track !== "function") {
		return;
	}
	try {
		const cleaned = props
			? Object.fromEntries(
					Object.entries(props).filter(([, v]) => v !== undefined) as [string, string | number | boolean][],
				)
			: undefined;
		umami.track(name, cleaned);
	} catch {
		// Analytics must never break the app
	}
}
