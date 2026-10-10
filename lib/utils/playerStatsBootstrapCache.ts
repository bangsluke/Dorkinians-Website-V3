/** Client-side in-flight + TTL cache for GET /api/player-stats-bootstrap. */

export type PlayerStatsBootstrap = {
	playerName: string;
	playerData: unknown | null;
	seasonalStats: unknown[];
	teamStats: unknown[];
	playerAwards: unknown | null;
	captaincies: unknown[];
	totalCaptaincies: number;
	awards: unknown[];
	totalAwards: number;
};

const TTL_MS = 5 * 60 * 1000;

let cached: { playerName: string; data: PlayerStatsBootstrap; at: number } | null = null;
let inflight: { playerName: string; promise: Promise<PlayerStatsBootstrap | null> } | null = null;

export function getCachedPlayerStatsBootstrap(playerName: string): PlayerStatsBootstrap | null {
	if (!cached || cached.playerName !== playerName) {
		return null;
	}
	if (Date.now() - cached.at >= TTL_MS) {
		return null;
	}
	return cached.data;
}

export function seedPlayerStatsBootstrap(data: PlayerStatsBootstrap): void {
	if (!data?.playerName) {
		return;
	}
	cached = { playerName: data.playerName, data, at: Date.now() };
}

export async function fetchPlayerStatsBootstrap(playerName: string): Promise<PlayerStatsBootstrap | null> {
	const hit = getCachedPlayerStatsBootstrap(playerName);
	if (hit) {
		return hit;
	}
	if (inflight && inflight.playerName === playerName) {
		return inflight.promise;
	}

	const promise = (async () => {
		try {
			const response = await fetch(`/api/player-stats-bootstrap?playerName=${encodeURIComponent(playerName)}`);
			if (!response.ok) {
				return null;
			}
			const data = (await response.json()) as PlayerStatsBootstrap;
			if (!data || data.playerName !== playerName) {
				return null;
			}
			seedPlayerStatsBootstrap(data);
			return data;
		} catch {
			return null;
		} finally {
			if (inflight?.playerName === playerName) {
				inflight = null;
			}
		}
	})();

	inflight = { playerName, promise };
	return promise;
}

export function resetPlayerStatsBootstrapCacheForTests(): void {
	cached = null;
	inflight = null;
}
