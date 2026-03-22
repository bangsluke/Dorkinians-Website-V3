"use client";

import { useEffect } from "react";
import { UmamiEvents } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/utils/trackEvent";

export default function UmamiAnalytics() {
	useEffect(() => {
		// Only track if Umami is configured
		const scriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;
		const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
		const appVersion = process.env.NEXT_PUBLIC_APP_VERSION;

		if (!scriptUrl || !websiteId || !appVersion) {
			return;
		}

		// Check if version has already been tracked this session
		const sessionKey = `umami_version_tracked_${appVersion}`;
		if (sessionStorage.getItem(sessionKey)) {
			return;
		}

		// Wait for Umami script to load
		const checkUmami = () => {
			if (typeof window !== "undefined" && window.umami) {
				try {
					trackEvent(UmamiEvents.AppVersion, { version: appVersion });
					sessionStorage.setItem(sessionKey, "true");
				} catch (error) {
					console.error("Failed to track app version:", error);
				}
			} else {
				// Retry after a short delay if Umami hasn't loaded yet
				setTimeout(checkUmami, 100);
			}
		};

		// Start checking after a brief delay to allow script to load
		setTimeout(checkUmami, 500);
	}, []);

	return null;
}

