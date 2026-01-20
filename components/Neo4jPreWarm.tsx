"use client";

import { useEffect } from "react";
import { log } from "@/lib/utils/logger";

// Pre-warm Neo4j connection on app startup
export default function Neo4jPreWarm() {
	useEffect(() => {
		// Pre-warm connection in background (non-blocking)
		const prewarmConnection = async () => {
			try {
				// Call a lightweight API endpoint that will trigger Neo4j connection
				// This endpoint should be fast and not require authentication
				await fetch("/api/players", {
					method: "GET",
					// Use low priority to not block other requests
					priority: "low" as any,
				}).catch(() => {
					// Silently fail - this is just a pre-warm attempt
				});
				log("info", "✅ Neo4j connection pre-warmed");
			} catch (error) {
				// Silently fail - pre-warming is optional
			}
		};

		// Delay pre-warm slightly to not interfere with initial page load
		const timeoutId = setTimeout(prewarmConnection, 1000);
		
		return () => clearTimeout(timeoutId);
	}, []);

	return null; // This component doesn't render anything
}
