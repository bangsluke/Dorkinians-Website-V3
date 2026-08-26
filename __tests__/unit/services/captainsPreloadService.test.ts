import { preloadCaptainsData } from "@/lib/services/captainsPreloadService";

jest.mock("@/lib/utils/logger", () => ({
	log: jest.fn(),
}));

jest.mock("@/lib/services/coldStartNotifier", () => ({
	notifyNeo4jColdStart: jest.fn(),
	notifyNeo4jColdStartRecovered: jest.fn(),
	notifyNeo4jColdStartStillFailing: jest.fn(),
}));

describe("preloadCaptainsData", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
		jest.clearAllMocks();
	});

	test("does not throw when response is not ok", async () => {
		jest.useFakeTimers();
		global.fetch = jest.fn().mockResolvedValue(
			new Response(null, { status: 404, statusText: "Not Found" }),
		) as unknown as typeof fetch;

		const promise = preloadCaptainsData("2026/27");
		await jest.runAllTimersAsync();
		await expect(promise).resolves.toBeUndefined();
		jest.useRealTimers();
	});

	test("does not throw on network failure after retries", async () => {
		jest.useFakeTimers();
		global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch;

		const promise = preloadCaptainsData("2026/27");
		await jest.runAllTimersAsync();
		await expect(promise).resolves.toBeUndefined();
		jest.useRealTimers();
	});

	test("caches captains data on success", async () => {
		const setItem = jest.fn();
		Object.defineProperty(global, "window", {
			value: global,
			configurable: true,
		});
		Object.defineProperty(global, "sessionStorage", {
			value: {
				getItem: jest.fn(),
				setItem,
				removeItem: jest.fn(),
			},
			configurable: true,
		});

		global.fetch = jest.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					captainsData: [{ team: "1st XI Captain", captain: "Test" }],
				}),
				{ status: 200 },
			),
		) as unknown as typeof fetch;

		await preloadCaptainsData("2025/26");

		expect(setItem).toHaveBeenCalledWith(
			"dorkinians-captains-data-cache",
			expect.stringContaining("2025/26"),
		);
	});
});
