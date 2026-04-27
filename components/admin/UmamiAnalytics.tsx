"use client";

import { useEffect } from "react";

export default function UmamiAnalytics() {
	useEffect(() => {
		// Temporarily disabled to reduce Umami event volume/noise.
		// trackEvent(UmamiEvents.AppVersion, { version: process.env.NEXT_PUBLIC_APP_VERSION });
	}, []);

	return null;
}

