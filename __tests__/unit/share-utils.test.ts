/** @jest-environment jsdom */
import { shareImage, performIOSShare, performNonIOSShare } from "@/lib/utils/shareUtils";
import { trackEvent } from "@/lib/utils/trackEvent";

jest.mock("@/lib/utils/trackEvent", () => ({
	trackEvent: jest.fn(),
}));

// Exercises shareUtils Web Share vs download fallbacks under jsdom with a stubbed navigator and mocked analytics.
// User-agent overrides simulate iOS vs desktop; no real network-share/download paths are faked via jest spies.
// Relies on DOM APIs (document.body, anchor click); failures usually mean browser API surface changed in tests.

const ONE_PIXEL_PNG =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sVnXwAAAABJRU5ErkJggg==";

function setUserAgent(value: string) {
	Object.defineProperty(window.navigator, "userAgent", {
		configurable: true,
		value,
	});
}

describe("Unit - shareUtils resilience and fallback", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36");
		(document.body as any).innerHTML = "";
	});

	test("shareImage returns preview path when Web Share is available", async () => {
		// Arrange: enable Web Share API stubs on navigator
		(navigator as any).share = jest.fn();
		(navigator as any).canShare = jest.fn(() => true);

		// Act & assert: desktop path requests preview flow
		const result = await shareImage(ONE_PIXEL_PNG, "Luke Bangs", "seasonal-performance");
		expect(result).toEqual({ success: true, needsPreview: true });
	});

	test("shareImage returns iOS preview path on iOS user agent", async () => {
		// Arrange: iOS UA plus working share stubs
		setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
		(navigator as any).share = jest.fn();
		(navigator as any).canShare = jest.fn(() => true);

		// Act & assert: iOS-specific preview branch
		const result = await shareImage(ONE_PIXEL_PNG, "Luke Bangs", "match-results");
		expect(result).toEqual({ success: true, needsIOSPreview: true });
	});

	test("shareImage falls back to download when Web Share is unavailable", async () => {
		// Arrange: remove share APIs and spy anchor clicks for synthetic download
		(navigator as any).share = undefined;
		(navigator as any).canShare = undefined;
		const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

		// Act: shareImage should synthesize download
		const result = await shareImage(ONE_PIXEL_PNG, "Luke Bangs", "defensive-record");
		// Assert: success plus click + analytics side effects
		expect(result).toEqual({ success: true });
		expect(clickSpy).toHaveBeenCalled();
		expect(trackEvent).toHaveBeenCalled();
		clickSpy.mockRestore();
	});

	test("performIOSShare reports success when navigator.share succeeds", async () => {
		// Arrange: canShare true and share resolves cleanly
		(navigator as any).canShare = jest.fn(() => true);
		(navigator as any).share = jest.fn(async () => undefined);

		// Act & assert: helper reports success
		const ok = await performIOSShare(ONE_PIXEL_PNG, "Luke Bangs", "card-stats");
		expect(ok).toBe(true);
	});

	test("performNonIOSShare returns false and tracks error when Web Share throws", async () => {
		// Arrange: share promise rejects to simulate user cancel or platform error
		(navigator as any).canShare = jest.fn(() => true);
		(navigator as any).share = jest.fn(async () => {
			throw new Error("share failed");
		});

		// Act: attempt non-iOS share path
		const ok = await performNonIOSShare(ONE_PIXEL_PNG, "Luke Bangs", "minutes-per-stats");
		// Assert: failure surfaced and telemetry recorded
		expect(ok).toBe(false);
		expect(trackEvent).toHaveBeenCalled();
	});
});
