import { FALLBACK_FULL_TIME_LEAGUE_EMBED_CODES } from "@/lib/config/fullTimeLeagueEmbeds";

jest.mock("@/config/dataSources.js", () => ({
	dataSources: [
		{
			name: "TBL_LeagueSources",
			url: "https://example.test/league-sources.csv",
		},
	],
}));

describe("getLiveFullTimeLeagueEmbedCodes", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
		jest.resetModules();
	});

	it("merges valid digit embed codes from the sheet over the fallback map", async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			text: async () =>
				[
					"Team,Division,Tab Name,Season,Embed Code",
					"1st XI,Senior Division 1,1stXILeague,2026/27,111111111",
					"2nd XI,Intermediate South,2ndXILeague,2026/27,https://fulltime.thefa.com/table.html",
					"3rd XI,South Division 4,3rdXILeague,2025/26,222222222",
				].join("\n"),
		}) as unknown as typeof fetch;

		const { getLiveFullTimeLeagueEmbedCodes } = await import("@/lib/services/leagueSourcesService");
		const codes = await getLiveFullTimeLeagueEmbedCodes("2026/27");

		expect(codes["1s"]).toBe("111111111");
		expect(codes["2s"]).toBe(FALLBACK_FULL_TIME_LEAGUE_EMBED_CODES["2s"]);
		expect(codes["3s"]).toBe(FALLBACK_FULL_TIME_LEAGUE_EMBED_CODES["3s"]);
	});

	it("returns the fallback map when the sheet cannot be read", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

		const { getLiveFullTimeLeagueEmbedCodes } = await import("@/lib/services/leagueSourcesService");
		const codes = await getLiveFullTimeLeagueEmbedCodes("2026/27");

		expect(codes).toEqual(FALLBACK_FULL_TIME_LEAGUE_EMBED_CODES);
	});
});
