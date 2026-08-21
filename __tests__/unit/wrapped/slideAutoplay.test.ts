import {
	remainingAfterElapsed,
	remainingToTimerPct,
	tickSlideAutoplay,
	WRAPPED_AUTOPLAY_MS,
} from "@/lib/wrapped/slideAutoplay";

describe("remainingAfterElapsed", () => {
	test("subtracts elapsed from remaining and never goes below 0", () => {
		expect(remainingAfterElapsed(15_000, 4_000)).toBe(11_000);
		expect(remainingAfterElapsed(600, 600)).toBe(0);
		expect(remainingAfterElapsed(500, 800)).toBe(0);
	});
});

describe("remainingToTimerPct", () => {
	test("maps remaining ms to a 0-100 bar relative to the full slide", () => {
		expect(remainingToTimerPct(WRAPPED_AUTOPLAY_MS)).toBe(100);
		expect(remainingToTimerPct(7_500)).toBe(50);
		expect(remainingToTimerPct(0)).toBe(0);
	});
});

describe("tickSlideAutoplay", () => {
	test("full slide counts down from 100% and advances at the end", () => {
		expect(tickSlideAutoplay(WRAPPED_AUTOPLAY_MS, 0)).toEqual({
			remainingMs: WRAPPED_AUTOPLAY_MS,
			timerPct: 100,
			shouldAdvance: false,
		});
		expect(tickSlideAutoplay(WRAPPED_AUTOPLAY_MS, 7_500).timerPct).toBe(50);
		expect(tickSlideAutoplay(WRAPPED_AUTOPLAY_MS, WRAPPED_AUTOPLAY_MS)).toEqual({
			remainingMs: 0,
			timerPct: 0,
			shouldAdvance: true,
		});
	});

	test("resume continues leftover remaining instead of restarting at 100%", () => {
		const pausedRemaining = remainingAfterElapsed(WRAPPED_AUTOPLAY_MS, 9_000);
		expect(pausedRemaining).toBe(6_000);

		const resumed = tickSlideAutoplay(pausedRemaining, 0);
		expect(resumed.timerPct).toBe(40);
		expect(resumed.shouldAdvance).toBe(false);

		const later = tickSlideAutoplay(pausedRemaining, 3_000);
		expect(later.remainingMs).toBe(3_000);
		expect(later.timerPct).toBe(20);
		expect(later.shouldAdvance).toBe(false);

		const end = tickSlideAutoplay(pausedRemaining, pausedRemaining);
		expect(end.shouldAdvance).toBe(true);
		expect(end.timerPct).toBe(0);
	});

	test("index change is modeled as a full remaining reset, not leftover from the previous slide", () => {
		const leftoverFromPrevious = 800;
		const afterIndexChange = tickSlideAutoplay(WRAPPED_AUTOPLAY_MS, 0);
		expect(afterIndexChange.remainingMs).not.toBe(leftoverFromPrevious);
		expect(afterIndexChange.timerPct).toBe(100);
		expect(afterIndexChange.shouldAdvance).toBe(false);
	});
});
