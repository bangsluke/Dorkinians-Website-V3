"use client";

import { useEffect } from "react";
import { CHUNK_RETRY_SESSION_KEY } from "@/lib/utils/chunkLoadRetry";

/** Clears one-shot chunk reload flag after a successful client load so future failures can retry once. */
export default function ClearChunkRetryFlag() {
	useEffect(() => {
		try {
			sessionStorage.removeItem(CHUNK_RETRY_SESSION_KEY);
		} catch {
			/* ignore private mode / quota */
		}
	}, []);
	return null;
}
