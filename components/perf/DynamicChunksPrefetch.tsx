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
	void import("@/components/home/StreaksAtRiskBanner");
	void import("@/components/home/SeasonWrappedBanner");
}

export default function DynamicChunksPrefetch() {
	useEffect(() => {
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
		const t = window.setTimeout(run, 1);
		return () => {
			cancelled = true;
			window.clearTimeout(t);
		};
	}, []);

	return null;
}
