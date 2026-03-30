/** sessionStorage key: one automatic reload per "stuck" session after a chunk load failure */
export const CHUNK_RETRY_SESSION_KEY = "dorkinians-chunk-retry";

/**
 * Wraps a dynamic `import()` so a stale chunk after HMR / deploy triggers one reload.
 * Pair with clearing {@link CHUNK_RETRY_SESSION_KEY} after a successful app load.
 */
export function wrapDynamicImport<T extends object>(loader: () => Promise<T>): () => Promise<T> {
	return () =>
		loader().catch((err: unknown) => {
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
				return new Promise(() => {});
			}
			throw err;
		});
}
