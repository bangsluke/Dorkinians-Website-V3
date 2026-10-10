"use client";

import { useEffect } from "react";

/**
 * Warm common lazy chunks after first paint so navigating to stats / totw / etc.
 * hits the disk cache sooner (matches dynamic imports in app/page.tsx).
 */
function prefetchHeavyChunks() {
	void import("@/components/stats/StatsContainer");
	void import("@/components/totw/TOTWContainer");
	void import("@/components/club-info/ClubInfoContainer");
	void import("@/components/pages/Settings");
	void import("@/components/filters/FilterSidebar");
	void import("@/components/stats/StatsNavigationMenu");
	void import("@/components/chatbot/ChatbotInterface");
	void import("@/components/home/SeasonWrappedBanner");
	void import("@/components/profile/PlayerProfileView");
}

function shouldSkipPrefetch(): boolean {
	if (typeof navigator === "undefined") return false;
	const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
	if (conn?.saveData) return true;
	const effectiveType = conn?.effectiveType;
	return effectiveType === "slow-2g" || effectiveType === "2g";
}

export default function DynamicChunksPrefetch() {
	useEffect(() => {
		if (shouldSkipPrefetch()) return;

		let cancelled = false;
		const run = () => {
			if (!cancelled) prefetchHeavyChunks();
		};
		if (typeof window.requestIdleCallback === "function") {
			const id = window.requestIdleCallback(run, { timeout: 4000 });
			return () => {
				cancelled = true;
				window.cancelIdleCallback(id);
			};
		}
		const t = window.setTimeout(run, 2000);
		return () => {
			cancelled = true;
			window.clearTimeout(t);
		};
	}, []);

	return null;
}
