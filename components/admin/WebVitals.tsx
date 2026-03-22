"use client";

import { useReportWebVitals } from "next/web-vitals";
import { UmamiEvents } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/utils/trackEvent";

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

		trackEvent(UmamiEvents.WebVital, {
			name: metric.name,
			value: Math.round(metric.value),
			id: metric.id,
			rating: metric.rating ?? "",
		});
	});

	return null;
}
