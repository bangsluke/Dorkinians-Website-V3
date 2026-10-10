import { NextRequest } from "next/server";

jest.mock("@/app/api/player-data/route", () => ({
	GET: jest.fn(),
}));
jest.mock("@/app/api/player-seasonal-stats/route", () => ({
	POST: jest.fn(),
}));
jest.mock("@/app/api/player-team-stats/route", () => ({
	POST: jest.fn(),
}));
jest.mock("@/app/api/player-awards/route", () => ({
	GET: jest.fn(),
}));
jest.mock("@/app/api/captains/player-history/route", () => ({
	GET: jest.fn(),
}));
jest.mock("@/app/api/awards/player-history/route", () => ({
	GET: jest.fn(),
}));

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("player-stats-bootstrap API", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.resetModules();
	});

	test("aggregates handler results into one payload", async () => {
		const { GET: getPlayerData } = await import("@/app/api/player-data/route");
		const { POST: postSeasonal } = await import("@/app/api/player-seasonal-stats/route");
		const { POST: postTeam } = await import("@/app/api/player-team-stats/route");
		const { GET: getPlayerAwards } = await import("@/app/api/player-awards/route");
		const { GET: getCaptains } = await import("@/app/api/captains/player-history/route");
		const { GET: getAwards } = await import("@/app/api/awards/player-history/route");

		(getPlayerData as jest.Mock).mockResolvedValue(jsonResponse({ playerData: { appearances: 5 } }));
		(postSeasonal as jest.Mock).mockResolvedValue(jsonResponse({ seasonalStats: [{ season: "2025/26" }] }));
		(postTeam as jest.Mock).mockResolvedValue(jsonResponse({ teamStats: [{ team: "1st XI" }] }));
		(getPlayerAwards as jest.Mock).mockResolvedValue(jsonResponse({ awards: [] }));
		(getCaptains as jest.Mock).mockResolvedValue(jsonResponse({ captaincies: [{ season: "2024/25", team: "1s" }], totalCaptaincies: 1 }));
		(getAwards as jest.Mock).mockResolvedValue(jsonResponse({ awards: [{ season: "2023/24", awardName: "POTS" }], totalAwards: 1 }));

		const { apiCache } = await import("@/lib/utils/apiCache");
		apiCache.clear();

		const { GET } = await import("@/app/api/player-stats-bootstrap/route");
		const res = await GET(new NextRequest("http://localhost/api/player-stats-bootstrap?playerName=Luke%20Bangs"));
		const json = await res.json();

		expect(res.status).toBe(200);
		expect(json.playerData).toEqual({ appearances: 5 });
		expect(json.seasonalStats).toEqual([{ season: "2025/26" }]);
		expect(json.teamStats).toEqual([{ team: "1st XI" }]);
		expect(json.totalCaptaincies).toBe(1);
		expect(json.totalAwards).toBe(1);
		expect(getPlayerData).toHaveBeenCalled();
		expect(postSeasonal).toHaveBeenCalled();
	});

	test("requires playerName", async () => {
		const { GET } = await import("@/app/api/player-stats-bootstrap/route");
		const res = await GET(new NextRequest("http://localhost/api/player-stats-bootstrap"));
		expect(res.status).toBe(400);
	});
});
