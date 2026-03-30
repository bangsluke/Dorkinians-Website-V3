/**
 * Match rating band colours aligned with All Games / site rating guide:
 * 8.5–10 gold, 7.0–8.4 teal, 6.0–6.9 dark green, 4.0–5.9 tan, 1.0–3.9 red.
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

