export const WRAPPED_AUTOPLAY_MS = 15_000;
export const WRAPPED_AUTOPLAY_TICK_MS = 120;

export interface SlideAutoplayTick {
	remainingMs: number;
	timerPct: number;
	shouldAdvance: boolean;
}

export function remainingAfterElapsed(remainingAtStart: number, elapsedMs: number): number {
	return Math.max(0, remainingAtStart - elapsedMs);
}

export function remainingToTimerPct(remainingMs: number, autoplayMs: number = WRAPPED_AUTOPLAY_MS): number {
	if (autoplayMs <= 0) return 0;
	return Math.max(0, Math.min(100, (remainingMs / autoplayMs) * 100));
}

export function tickSlideAutoplay(
	remainingAtStart: number,
	elapsedMs: number,
	autoplayMs: number = WRAPPED_AUTOPLAY_MS,
): SlideAutoplayTick {
	const remainingMs = remainingAfterElapsed(remainingAtStart, elapsedMs);
	return {
		remainingMs,
		timerPct: remainingToTimerPct(remainingMs, autoplayMs),
		shouldAdvance: remainingMs <= 0,
	};
}
