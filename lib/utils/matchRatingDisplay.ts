import type { CSSProperties } from "react";

/**
 * Inline fill + text + border so rating circles keep colour (avoids global `button` resets).
 * Bands: 8.5–10 gold, 7.0–8.4 teal, 6.0–6.9 dark green, 4.0–5.9 tan, 1.0–3.9 red.
 */
export function matchRatingCircleStyle(rating: number): CSSProperties {
	if (rating >= 8.5) return { backgroundColor: "#C9A42A", color: "#111827", borderColor: "#E8D48B" };
	if (rating >= 7) return { backgroundColor: "#5DCAA5", color: "#111827", borderColor: "#7FD4B8" };
	if (rating >= 6) return { backgroundColor: "#2D6A4F", color: "#ffffff", borderColor: "#40916C" };
	if (rating >= 4) return { backgroundColor: "#D4A574", color: "#111827", borderColor: "#C9A06B" };
	return { backgroundColor: "#BC4749", color: "#ffffff", borderColor: "#E76F51" };
}

/**
 * Tailwind classes (e.g. legends); prefer {@link matchRatingCircleStyle} on `<button>` dots.
 */
export function matchRatingCircleClass(rating: number): string {
	if (rating >= 8.5) return "bg-[#C9A42A] text-gray-900 border-2 border-[#E8D48B]";
	if (rating >= 7) return "bg-[#5DCAA5] text-gray-900 border-2 border-[#7FD4B8]";
	if (rating >= 6) return "bg-[#2D6A4F] text-white border-2 border-[#40916C]";
	if (rating >= 4) return "bg-[#D4A574] text-gray-900 border-2 border-[#C9A06B]";
	return "bg-[#BC4749] text-white border-2 border-[#E76F51]";
}

/** Everything after the first word (surname / double-barrel surnames). Single token → unchanged. */
export function playerSurnameOrAfterFirstName(fullName: string): string {
	const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
	if (parts.length <= 1) return parts[0] ?? "";
	return parts.slice(1).join(" ");
}

