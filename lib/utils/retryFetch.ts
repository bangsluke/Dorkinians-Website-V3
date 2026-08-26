/**
 * Fetch with short backoff for transient Neo4j cold-start / network / Turbopack route misses.
 */

export const COLD_START_RETRY_DELAYS_MS = [500, 1500, 3000] as const;

export type RetryFetchOptions = {
	/** Extra attempts after the first (default: delays length → 4 total tries). */
	maxRetries?: number;
	/** Backoff delays in ms between retries. */
	retryDelaysMs?: readonly number[];
	/** Called once when the first attempt fails in a retryable way (cold-start signal). */
	onRetryableFailure?: () => void;
	/** Called when a later attempt succeeds after at least one retryable failure. */
	onRecovered?: () => void;
	fetchImpl?: typeof fetch;
};

export function isRetryableHttpStatus(status: number): boolean {
	return status === 500 || status === 502 || status === 503;
}

/**
 * Turbopack / stale `.next` can serve the HTML not-found page for real API routes.
 * Those 404s should get full cold-start backoff, not a single retry.
 */
export function isHtmlNotFoundResponse(response: Response): boolean {
	if (response.status !== 404) {
		return false;
	}
	const contentType = response.headers.get("content-type") ?? "";
	return contentType.includes("text/html");
}

/** One retry for non-HTML 404 (e.g. Turbopack JSON miss); not treated as cold-start forever. */
export function isTransientNotFoundStatus(status: number): boolean {
	return status === 404;
}

export function isRetryableNetworkError(error: unknown): boolean {
	if (!(error instanceof TypeError)) {
		return false;
	}
	const message = error.message.toLowerCase();
	return message.includes("failed to fetch") || message.includes("network");
}

export function isColdStartFailure(error: unknown, status?: number, response?: Response): boolean {
	if (response && isHtmlNotFoundResponse(response)) {
		return true;
	}
	if (status !== undefined && isRetryableHttpStatus(status)) {
		return true;
	}
	return isRetryableNetworkError(error);
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Performs fetch with retries on 500/502/503, HTML 404 route misses, and network failures.
 * Non-HTML 404 gets a single extra attempt only.
 */
export async function retryFetch(
	input: RequestInfo | URL,
	init?: RequestInit,
	options: RetryFetchOptions = {},
): Promise<Response> {
	const {
		maxRetries = COLD_START_RETRY_DELAYS_MS.length,
		retryDelaysMs = COLD_START_RETRY_DELAYS_MS,
		onRetryableFailure,
		onRecovered,
		fetchImpl = fetch,
	} = options;

	let lastError: unknown;
	let hadRetryableFailure = false;
	let notFoundRetried = false;

	const totalAttempts = maxRetries + 1;

	for (let attempt = 0; attempt < totalAttempts; attempt++) {
		try {
			const response = await fetchImpl(input, init);

			if (response.ok) {
				if (hadRetryableFailure) {
					onRecovered?.();
				}
				return response;
			}

			const htmlNotFound = isHtmlNotFoundResponse(response);
			const retryableStatus = isRetryableHttpStatus(response.status) || htmlNotFound;
			const allowNotFoundRetry =
				!htmlNotFound &&
				isTransientNotFoundStatus(response.status) &&
				!notFoundRetried;

			if (retryableStatus || allowNotFoundRetry) {
				if (allowNotFoundRetry) {
					notFoundRetried = true;
				}
				if (!hadRetryableFailure && retryableStatus) {
					hadRetryableFailure = true;
					onRetryableFailure?.();
				}
				if (attempt < totalAttempts - 1) {
					const waitMs = retryDelaysMs[Math.min(attempt, retryDelaysMs.length - 1)] ?? 500;
					await delay(waitMs);
					continue;
				}
			}

			return response;
		} catch (error) {
			lastError = error;
			if (isRetryableNetworkError(error)) {
				if (!hadRetryableFailure) {
					hadRetryableFailure = true;
					onRetryableFailure?.();
				}
				if (attempt < totalAttempts - 1) {
					const waitMs = retryDelaysMs[Math.min(attempt, retryDelaysMs.length - 1)] ?? 500;
					await delay(waitMs);
					continue;
				}
			}
			throw error;
		}
	}

	throw lastError instanceof Error ? lastError : new Error("retryFetch failed");
}
