"use client";

import { useReportWebVitals } from "next/web-vitals";

export default function WebVitals() {
	useReportWebVitals((metric) => {
		// Only track in production
		if (process.env.NODE_ENV !== "production") {
			return;
		}

		const umamiScriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;
		const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

		if (!umamiScriptUrl || !websiteId) {
			return;
		}

		// Send metric to Umami
		if (typeof window !== "undefined" && (window as any).umami) {
			try {
				(window as any).umami.track("Web Vital", {
					name: metric.name,
					value: Math.round(metric.value),
					id: metric.id,
					rating: metric.rating,
				});
			} catch (error) {
				// Silently fail - analytics is not critical
			}
		}
	});

	return null;
}
