import type { CSSProperties } from "react";

/**
 * Inline fill + text + border so rating circles keep colour (avoids global `button` resets).
 * Bands: 8.5–10 gold, 7.0–8.4 mint, 6.0–6.9 muted green, 4.0–5.9 tan, 1.0–3.9 orange-red.
 */
export function matchRatingCircleStyle(rating: number): CSSProperties {
	if (rating >= 8.5) {
		return {
			backgroundColor: "var(--match-rating-85-100-bg)",
			color: "var(--match-rating-85-100-text)",
			borderColor: "var(--match-rating-85-100-border)",
		};
	}
	if (rating >= 7) {
		return {
			backgroundColor: "var(--match-rating-70-84-bg)",
			color: "var(--match-rating-70-84-text)",
			borderColor: "var(--match-rating-70-84-border)",
		};
	}
	if (rating >= 6) {
		return {
			backgroundColor: "var(--match-rating-60-69-bg)",
			color: "var(--match-rating-60-69-text)",
			borderColor: "var(--match-rating-60-69-border)",
		};
	}
	if (rating >= 4) {
		return {
			backgroundColor: "var(--match-rating-40-59-bg)",
			color: "var(--match-rating-40-59-text)",
			borderColor: "var(--match-rating-40-59-border)",
		};
	}
	return {
		backgroundColor: "var(--match-rating-10-39-bg)",
		color: "var(--match-rating-10-39-text)",
		borderColor: "var(--match-rating-10-39-border)",
	};
}

/**
 * Tailwind classes (e.g. legends); prefer {@link matchRatingCircleStyle} on `<button>` dots.
 */
export function matchRatingCircleClass(rating: number): string {
	if (rating >= 8.5) return "bg-[var(--match-rating-85-100-bg)] text-[var(--match-rating-85-100-text)] border-2 border-[var(--match-rating-85-100-border)]";
	if (rating >= 7) return "bg-[var(--match-rating-70-84-bg)] text-[var(--match-rating-70-84-text)] border-2 border-[var(--match-rating-70-84-border)]";
	if (rating >= 6) return "bg-[var(--match-rating-60-69-bg)] text-[var(--match-rating-60-69-text)] border-2 border-[var(--match-rating-60-69-border)]";
	if (rating >= 4) return "bg-[var(--match-rating-40-59-bg)] text-[var(--match-rating-40-59-text)] border-2 border-[var(--match-rating-40-59-border)]";
	return "bg-[var(--match-rating-10-39-bg)] text-[var(--match-rating-10-39-text)] border-2 border-[var(--match-rating-10-39-border)]";
}

/** Everything after the first word (surname / double-barrel surnames). Single token → unchanged. */
export function playerSurnameOrAfterFirstName(fullName: string): string {
	const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
	if (parts.length <= 1) return parts[0] ?? "";
	return parts.slice(1).join(" ");
}

