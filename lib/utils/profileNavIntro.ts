/** Persisted after the one-time profile-icon intro ring finishes. */
export const PROFILE_NAV_INTRO_LS_KEY = "stats-nav-profile-intro-done";

/**
 * Schedules 3 short yellow-ring bursts. Persists PROFILE_NAV_INTRO_LS_KEY after ~1.6s.
 * Returns cleanup that clears timers (LS is not set if cleanup runs first).
 */
export function scheduleProfileIntroBursts(setPulse: (v: boolean) => void): () => void {
	const timers: number[] = [];
	[0, 520, 1040].forEach((delay) => {
		timers.push(window.setTimeout(() => setPulse(true), delay));
		timers.push(window.setTimeout(() => setPulse(false), delay + 400));
	});
	timers.push(
		window.setTimeout(() => {
			try {
				localStorage.setItem(PROFILE_NAV_INTRO_LS_KEY, "true");
			} catch {
				/* ignore */
			}
		}, 1600),
	);
	return () => {
		for (const t of timers) {
			window.clearTimeout(t);
		}
	};
}

export function shouldRunProfileIntro(): boolean {
	if (typeof window === "undefined") return false;
	try {
		return localStorage.getItem(PROFILE_NAV_INTRO_LS_KEY) !== "true";
	} catch {
		return true;
	}
}
