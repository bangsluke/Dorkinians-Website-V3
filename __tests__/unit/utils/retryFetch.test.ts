import {
	isColdStartFailure,
	isRetryableHttpStatus,
	isRetryableNetworkError,
	retryFetch,
} from "@/lib/utils/retryFetch";

describe("retryFetch helpers", () => {
	test("identifies retryable HTTP statuses", () => {
		expect(isRetryableHttpStatus(500)).toBe(true);
		expect(isRetryableHttpStatus(502)).toBe(true);
		expect(isRetryableHttpStatus(503)).toBe(true);
		expect(isRetryableHttpStatus(404)).toBe(false);
		expect(isRetryableHttpStatus(400)).toBe(false);
	});

	test("identifies network Failed to fetch as retryable / cold-start", () => {
		const error = new TypeError("Failed to fetch");
		expect(isRetryableNetworkError(error)).toBe(true);
		expect(isColdStartFailure(error)).toBe(true);
		expect(isColdStartFailure(undefined, 500)).toBe(true);
		expect(isColdStartFailure(undefined, 404)).toBe(false);
	});

	test("retries on 500 then returns successful response", async () => {
		const fetchImpl = jest
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 500, statusText: "Internal Server Error" }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

		const onRetryableFailure = jest.fn();
		const onRecovered = jest.fn();

		const response = await retryFetch("/api/player-data", undefined, {
			fetchImpl: fetchImpl as unknown as typeof fetch,
			retryDelaysMs: [1, 1, 1],
			onRetryableFailure,
			onRecovered,
		});

		expect(response.ok).toBe(true);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
		expect(onRetryableFailure).toHaveBeenCalledTimes(1);
		expect(onRecovered).toHaveBeenCalledTimes(1);
	});

	test("retries network failure then recovers", async () => {
		const fetchImpl = jest
			.fn()
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockResolvedValueOnce(new Response("{}", { status: 200 }));

		const onRetryableFailure = jest.fn();
		const onRecovered = jest.fn();

		const response = await retryFetch("/api/player-data-filtered", { method: "POST" }, {
			fetchImpl: fetchImpl as unknown as typeof fetch,
			retryDelaysMs: [1],
			maxRetries: 1,
			onRetryableFailure,
			onRecovered,
		});

		expect(response.status).toBe(200);
		expect(onRetryableFailure).toHaveBeenCalledTimes(1);
		expect(onRecovered).toHaveBeenCalledTimes(1);
	});

	test("retries 404 once then returns 404 without cold-start callback", async () => {
		const fetchImpl = jest
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ error: "missing" }), {
					status: 404,
					statusText: "Not Found",
					headers: { "content-type": "application/json" },
				}),
			);

		const onRetryableFailure = jest.fn();

		const response = await retryFetch("/api/captains/data", undefined, {
			fetchImpl: fetchImpl as unknown as typeof fetch,
			retryDelaysMs: [1],
			maxRetries: 2,
			onRetryableFailure,
		});

		expect(response.status).toBe(404);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
		expect(onRetryableFailure).not.toHaveBeenCalled();
	});

	test("retries HTML 404 route misses with cold-start callback then recovers", async () => {
		const fetchImpl = jest
			.fn()
			.mockResolvedValueOnce(
				new Response("<!DOCTYPE html>", {
					status: 404,
					statusText: "Not Found",
					headers: { "content-type": "text/html; charset=utf-8" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ teams: [] }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			);

		const onRetryableFailure = jest.fn();
		const onRecovered = jest.fn();

		const response = await retryFetch("/api/teams", undefined, {
			fetchImpl: fetchImpl as unknown as typeof fetch,
			retryDelaysMs: [1],
			maxRetries: 2,
			onRetryableFailure,
			onRecovered,
		});

		expect(response.ok).toBe(true);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
		expect(onRetryableFailure).toHaveBeenCalledTimes(1);
		expect(onRecovered).toHaveBeenCalledTimes(1);
	});

	test("does not retry 400", async () => {
		const fetchImpl = jest
			.fn()
			.mockResolvedValue(new Response(null, { status: 400, statusText: "Bad Request" }));

		const response = await retryFetch("/api/x", undefined, {
			fetchImpl: fetchImpl as unknown as typeof fetch,
			retryDelaysMs: [1],
		});

		expect(response.status).toBe(400);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});
});
