/**
 * Netlify trigger-seed and /api/trigger-seed return overlapping fields (hint, reason, message, error).
 * Prefer a single actionable line for the admin UI.
 */
export function summarizeSeedingTriggerError(
	parsed: unknown,
): string | null {
	if (!parsed || typeof parsed !== "object") {
		return null;
	}
	const j = parsed as Record<string, unknown>;
	const hint = typeof j.hint === "string" ? j.hint.trim() : "";
	if (hint.length > 0) {
		return hint;
	}
	const parts = [j.reason, j.message, j.error]
		.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
		.map((s) => s.trim());
	if (parts.length === 0) {
		return null;
	}
	return [...new Set(parts)].join(" — ");
}
