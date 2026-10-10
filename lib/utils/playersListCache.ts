/** Shared in-flight + short TTL cache for GET /api/players (dedupes PlayerSelection / Comparison). */

export type PlayerListItem = {
	playerName: string;
	mostPlayedForTeam?: string;
};

const TTL_MS = 10 * 60 * 1000;

let cached: { players: PlayerListItem[]; at: number } | null = null;
let inflight: Promise<PlayerListItem[]> | null = null;

export async function fetchPlayersList(): Promise<PlayerListItem[]> {
	if (cached && Date.now() - cached.at < TTL_MS) {
		return cached.players;
	}
	if (inflight) {
		return inflight;
	}

	inflight = (async () => {
		const response = await fetch("/api/players");
		if (!response.ok) {
			throw new Error(`Failed to fetch players: ${response.status}`);
		}
		const data = (await response.json()) as { players?: PlayerListItem[] };
		const players = Array.isArray(data.players) ? data.players : [];
		cached = { players, at: Date.now() };
		return players;
	})().finally(() => {
		inflight = null;
	});

	return inflight;
}
