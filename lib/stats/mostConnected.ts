export type MostConnectedEntry = {
	name: string;
	timesPlayed: number;
	winRate: number | null;
};

function toFiniteNumber(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : null;
}

/**
 * Build top-N "most connected" players from Feature 7 partnership JSON.
 * Sort order: timesPlayed desc, then name asc for deterministic ties.
 */
export function buildMostConnectedListFromPartnershipsJson(raw: string | null | undefined, limit = 5): MostConnectedEntry[] {
	if (!raw || typeof raw !== "string") return [];

	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];

		const normalized = parsed
			.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
			.map((item) => {
				const name = String(item.name ?? "").trim();
				const matches = toFiniteNumber(item.matches);
				const winRate = toFiniteNumber(item.winRate);
				return {
					name,
					timesPlayed: matches == null ? 0 : Math.max(0, Math.round(matches)),
					winRate,
				};
			})
			.filter((item) => item.name.length > 0 && item.timesPlayed > 0)
			.sort((a, b) => {
				if (b.timesPlayed !== a.timesPlayed) return b.timesPlayed - a.timesPlayed;
				return a.name.localeCompare(b.name);
			});

		return normalized.slice(0, Math.max(0, limit));
	} catch {
		return [];
	}
}
