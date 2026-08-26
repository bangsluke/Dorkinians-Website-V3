"use client";

import { useEffect } from "react";
import { log } from "@/lib/utils/logger";

interface Neo4jPreWarmProps {
	enabled?: boolean;
}

// Pre-warm Neo4j connection when chatbot becomes visible
export default function Neo4jPreWarm({ enabled = true }: Neo4jPreWarmProps) {
	useEffect(() => {
		if (!enabled) return;

		// Pre-warm connection in background (non-blocking)
		const prewarmConnection = async () => {
			try {
				// Call a lightweight API endpoint that will trigger Neo4j connection
				// This endpoint should be fast and not require authentication
				await fetch("/api/players", {
					method: "GET",
					// Use low priority to not block other requests
					priority: "low",
				} as RequestInit).catch(() => {
					// Silently fail - this is just a pre-warm attempt
				});
				log("info", "✅ Neo4j connection pre-warmed");
			} catch {
				// Silently fail - pre-warming is optional
			}
		};

		// Short delay so initial player/captains fetches can share the connect path first
		const timeoutId = setTimeout(prewarmConnection, 200);
		
		return () => clearTimeout(timeoutId);
	}, [enabled]);

	return null; // This component doesn't render anything
}
