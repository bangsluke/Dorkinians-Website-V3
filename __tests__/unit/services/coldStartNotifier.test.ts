import {
	getColdStartNotifierDebugState,
	notifyNeo4jColdStart,
	notifyNeo4jColdStartRecovered,
	notifyNeo4jColdStartStillFailing,
	resetColdStartNotifierState,
	setColdStartNotifier,
} from "@/lib/services/coldStartNotifier";

describe("coldStartNotifier", () => {
	beforeEach(() => {
		resetColdStartNotifierState();
		setColdStartNotifier(null);
	});

	afterEach(() => {
		setColdStartNotifier(null);
		resetColdStartNotifierState();
	});

	test("onColdStart fires only once per page load", () => {
		const onColdStart = jest.fn(() => "toast-1");
		const onRecovered = jest.fn();
		setColdStartNotifier({ onColdStart, onRecovered });

		notifyNeo4jColdStart();
		notifyNeo4jColdStart();
		notifyNeo4jColdStart();

		expect(onColdStart).toHaveBeenCalledTimes(1);
		expect(getColdStartNotifierDebugState().coldStartNotified).toBe(true);
	});

	test("onRecovered fires once after cold start", () => {
		const onColdStart = jest.fn(() => "toast-1");
		const onRecovered = jest.fn();
		setColdStartNotifier({ onColdStart, onRecovered });

		notifyNeo4jColdStartRecovered();
		expect(onRecovered).not.toHaveBeenCalled();

		notifyNeo4jColdStart();
		notifyNeo4jColdStartRecovered();
		notifyNeo4jColdStartRecovered();

		expect(onRecovered).toHaveBeenCalledTimes(1);
	});

	test("onStillFailing fires once and skips after recovery", () => {
		const onColdStart = jest.fn(() => "toast-1");
		const onRecovered = jest.fn();
		const onStillFailing = jest.fn();
		setColdStartNotifier({ onColdStart, onRecovered, onStillFailing });

		notifyNeo4jColdStart();
		notifyNeo4jColdStartStillFailing();
		notifyNeo4jColdStartStillFailing();
		expect(onStillFailing).toHaveBeenCalledTimes(1);

		resetColdStartNotifierState();
		setColdStartNotifier({ onColdStart, onRecovered, onStillFailing });
		notifyNeo4jColdStart();
		notifyNeo4jColdStartRecovered();
		notifyNeo4jColdStartStillFailing();
		expect(onStillFailing).toHaveBeenCalledTimes(1);
	});

	test("no-ops without registered callbacks", () => {
		expect(() => {
			notifyNeo4jColdStart();
			notifyNeo4jColdStartRecovered();
			notifyNeo4jColdStartStillFailing();
		}).not.toThrow();
		expect(getColdStartNotifierDebugState().hasCallbacks).toBe(false);
	});
});
