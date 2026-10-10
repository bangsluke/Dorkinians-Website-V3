/**
 * @jest-environment jsdom
 */

describe("playerStatsBootstrapCache", () => {
	beforeEach(() => {
		jest.resetModules();
	});

	it("dedupes concurrent fetches and seeds memory cache", async () => {
		let resolveFetch: (value: { ok: boolean; json: () => Promise<unknown> }) => void = () => undefined;
		const fetchPromise = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
			resolveFetch = resolve;
		});
		global.fetch = jest.fn().mockReturnValue(fetchPromise) as unknown as typeof fetch;

		const { fetchPlayerStatsBootstrap, getCachedPlayerStatsBootstrap } = await import(
			"@/lib/utils/playerStatsBootstrapCache"
		);

		const p1 = fetchPlayerStatsBootstrap("Luke Bangs");
		const p2 = fetchPlayerStatsBootstrap("Luke Bangs");
		expect(global.fetch).toHaveBeenCalledTimes(1);

		resolveFetch({
			ok: true,
			json: async () => ({
				playerName: "Luke Bangs",
				playerData: { appearances: 10 },
				seasonalStats: [{ season: "2025/26" }],
				teamStats: [],
				playerAwards: { awards: [] },
				captaincies: [],
				totalCaptaincies: 0,
				awards: [],
				totalAwards: 0,
			}),
		});

		const [a, b] = await Promise.all([p1, p2]);
		expect(a?.playerData).toEqual({ appearances: 10 });
		expect(b?.seasonalStats).toEqual([{ season: "2025/26" }]);
		expect(getCachedPlayerStatsBootstrap("Luke Bangs")?.playerName).toBe("Luke Bangs");
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});
});
