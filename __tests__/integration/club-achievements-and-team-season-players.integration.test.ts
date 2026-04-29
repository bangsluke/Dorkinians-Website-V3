import { NextRequest } from "next/server";
import { apiCache } from "@/lib/utils/apiCache";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn(),
		runQuery: jest.fn(),
		getGraphLabel: jest.fn(() => "test-graph"),
	},
}));

jest.mock("@/lib/services/leagueTableService", () => ({
	getAvailableSeasons: jest.fn(),
	getSeasonDataFromJSON: jest.fn(),
	normalizeSeasonFormat: (season: string, targetFormat: "slash" | "hyphen") => {
		if (!season) return season;
		return targetFormat === "slash" ? season.replace("-", "/") : season.replace("/", "-");
	},
}));

describe("club achievements + team season players (league/cup)", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		apiCache.clear();
	});

	describe("GET /api/club-achievements", () => {
		test("merges league and cup achievements with stable ordering", async () => {
			const { getAvailableSeasons, getSeasonDataFromJSON } = require("@/lib/services/leagueTableService");
			const { neo4jService } = require("@/lib/neo4j");

			getAvailableSeasons.mockResolvedValue(["2020-21", "2021-22"]);
			getSeasonDataFromJSON.mockImplementation(async (seasonHyphen: string) => {
				if (seasonHyphen === "2020-21") {
					return {
						season: "2020/21",
						teams: {
							"1s": {
								division: "Premier",
								table: [
									{ team: "Dorkinians 1st XI", position: 1 },
									{ team: "Other FC", position: 2 },
								],
							},
						},
					};
				}
				if (seasonHyphen === "2021-22") {
					return {
						season: "2021/22",
						teams: {
							"1s": {
								division: "Premier",
								table: [
									{ team: "Dorkinians 1st XI", position: 1 },
									{ team: "Other FC", position: 2 },
								],
							},
						},
					};
				}
				return null;
			});

			neo4jService.connect.mockResolvedValue(true);
			neo4jService.runQuery.mockResolvedValue({
				records: [
					{
						get: (k: string) =>
							({ team: "2s", season: "2020/21", competition: "Test Cup A" } as Record<string, string>)[k],
					},
					{
						get: (k: string) =>
							({ team: "1s", season: "2021/22", competition: "Test Cup B" } as Record<string, string>)[k],
					},
				],
			});

			const { GET } = await import("../../app/api/club-achievements/route");
			const res = await GET({} as any);
			const json = await res.json();

			expect(res.status).toBe(200);
			expect(Array.isArray(json.achievements)).toBe(true);

			const types = json.achievements.map((a: { type: string }) => a.type);
			expect(types.filter((t: string) => t === "league").length).toBe(2);
			expect(types.filter((t: string) => t === "cup").length).toBe(2);

			// 1s 2021/22: league before cup (same team + season)
			const idxLeague2122 = json.achievements.findIndex(
				(a: { team: string; season: string; type: string }) =>
					a.team === "1s" && a.season === "2021/22" && a.type === "league",
			);
			const idxCup2122 = json.achievements.findIndex(
				(a: { team: string; season: string; type: string; competition?: string }) =>
					a.team === "1s" && a.season === "2021/22" && a.type === "cup" && a.competition === "Test Cup B",
			);
			expect(idxLeague2122).toBeGreaterThanOrEqual(0);
			expect(idxCup2122).toBeGreaterThanOrEqual(0);
			expect(idxLeague2122).toBeLessThan(idxCup2122);

			// Newer season (2021/22) before older (2020/21) for same team ordering block
			const idx1s2122First = json.achievements.findIndex((a: { team: string; season: string }) => a.team === "1s" && a.season === "2021/22");
			const idx1s2021First = json.achievements.findIndex((a: { team: string; season: string }) => a.team === "1s" && a.season === "2020/21");
			expect(idx1s2122First).toBeLessThan(idx1s2021First);

			// 1s before 2s (team priority)
			const idx2s = json.achievements.findIndex((a: { team: string }) => a.team === "2s");
			expect(idx1s2122First).toBeLessThan(idx2s);
		});
	});

	describe("GET /api/team-season-players", () => {
		test("returns 400 when type=cup and competition is missing", async () => {
			const { GET } = await import("../../app/api/team-season-players/route");
			const req = new NextRequest("http://localhost/api/team-season-players?team=1s&season=2020-21&type=cup");
			const res = await GET(req);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error).toMatch(/competition/i);
		});

		test("cup path queries Cup fixtures with competition param", async () => {
			const { neo4jService } = require("@/lib/neo4j");
			neo4jService.connect.mockResolvedValue(true);
			neo4jService.runQuery
				.mockResolvedValueOnce({
					records: [{ get: (k: string) => ({ playerName: "Test Player", appearances: 3 } as Record<string, unknown>)[k] }],
				})
				.mockResolvedValueOnce({ records: [] });

			const { GET } = await import("../../app/api/team-season-players/route");
			const req = new NextRequest(
				"http://localhost/api/team-season-players?team=1s&season=2020-21&type=cup&competition=Surrey%20Cup",
			);
			const res = await GET(req);
			expect(res.status).toBe(200);

			const squadCall = neo4jService.runQuery.mock.calls[0];
			expect(squadCall[0]).toMatch(/f\.compType = 'Cup'/);
			expect(squadCall[0]).toMatch(/f\.competition = \$competition/);
			expect(squadCall[1]).toMatchObject({
				team: "1st XI",
				season: "2020/21",
				competition: "Surrey Cup",
			});

			const json = await res.json();
			expect(json.players).toEqual([{ playerName: "Test Player", appearances: 3 }]);
		});

		test("league path uses League compType only", async () => {
			const { neo4jService } = require("@/lib/neo4j");
			neo4jService.connect.mockResolvedValue(true);
			neo4jService.runQuery
				.mockResolvedValueOnce({ records: [] })
				.mockResolvedValueOnce({ records: [] });

			const { GET } = await import("../../app/api/team-season-players/route");
			const req = new NextRequest("http://localhost/api/team-season-players?team=2s&season=2019-20");
			const res = await GET(req);
			expect(res.status).toBe(200);

			const squadCall = neo4jService.runQuery.mock.calls[0];
			expect(squadCall[0]).toMatch(/f\.compType = 'League'/);
			expect(squadCall[1]).toMatchObject({
				team: "2nd XI",
				season: "2019/20",
			});
			expect(squadCall[1].competition).toBeUndefined();
		});
	});
});
