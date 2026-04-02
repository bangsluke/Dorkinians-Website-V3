/** sessionStorage key: one automatic reload per "stuck" session after a chunk load failure */
export const CHUNK_RETRY_SESSION_KEY = "dorkinians-chunk-retry";

/**
 * Runs a dynamic `import()` and returns its Promise with chunk-error handling.
 * Use as: `dynamic(() => wrapDynamicImport(() => import("./Mod")))`.
 * Must return a Promise (not a function) — `next/dynamic` calls the loader and chains `.then`.
 */
export function wrapDynamicImport<T extends object>(loader: () => Promise<T>): Promise<T> {
	return loader().catch((err: unknown) => {
		if (typeof window === "undefined") throw err;
		const name = err instanceof Error ? err.name : "";
		const message = err instanceof Error ? err.message : String(err);
		const isChunkError =
			name === "ChunkLoadError" ||
			message.includes("Failed to load chunk") ||
			message.includes("Loading chunk") ||
			message.includes("Importing a module script failed");
		if (isChunkError && !sessionStorage.getItem(CHUNK_RETRY_SESSION_KEY)) {
			sessionStorage.setItem(CHUNK_RETRY_SESSION_KEY, "1");
			window.location.reload();
			return new Promise(() => {}) as Promise<T>;
		}
		throw err;
	});
}
