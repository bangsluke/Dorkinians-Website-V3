/**
 * @jest-environment jsdom
 */

describe("fetchPlayersList", () => {
	beforeEach(() => {
		jest.resetModules();
	});

	it("dedupes concurrent callers to a single fetch", async () => {
		let resolveFetch: (value: { ok: boolean; json: () => Promise<unknown> }) => void = () => undefined;
		const fetchPromise = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
			resolveFetch = resolve;
		});
		global.fetch = jest.fn().mockReturnValue(fetchPromise) as unknown as typeof fetch;

		const { fetchPlayersList } = await import("@/lib/utils/playersListCache");
		const p1 = fetchPlayersList();
		const p2 = fetchPlayersList();
		expect(global.fetch).toHaveBeenCalledTimes(1);

		resolveFetch({
			ok: true,
			json: async () => ({ players: [{ playerName: "Luke Bangs" }] }),
		});

		const [a, b] = await Promise.all([p1, p2]);
		expect(a).toEqual([{ playerName: "Luke Bangs" }]);
		expect(b).toEqual([{ playerName: "Luke Bangs" }]);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});
});
