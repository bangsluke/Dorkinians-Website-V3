jest.mock("@/lib/wrapped/computeWrappedData", () => ({
	computeWrappedData: jest.fn(),
}));

import { playerNameToWrappedSlug } from "@/lib/wrapped/slug";
import type { WrappedData } from "@/lib/wrapped/types";

const computeWrappedData = jest.requireMock("@/lib/wrapped/computeWrappedData").computeWrappedData as jest.Mock;

const sample: WrappedData = {
	playerName: "Test Player",
	season: "2025/26",
	totalMatches: 12,
	totalMinutes: 900,
	totalStarts: 10,
	mostPlayedPosition: "Midfielder",
	totalGoals: 3,
	totalAssists: 2,
	totalMom: 1,
	matchesPercentile: 55,
	bestMonth: "Jan 2026",
	bestMonthGoals: 2,
	bestMonthAssists: 1,
	bestMonthMatches: 5,
	bestMonthFantasyPoints: 42.5,
	topPartnerName: "Partner Name",
	topPartnerMatches: 8,
	topPartnerWinRate: 62.5,
	playerType: "The Squad Player",
	playerTypeReason: "Reliable",
	peakMatchRating: 8.2,
	peakMatchOpposition: "FC Test",
	peakMatchGoals: 2,
	peakMatchAssists: 0,
	peakMatchResultLabel: "Win",
	peakMatchScoreline: "3-1",
	longestStreakType: "Scoring streak",
	longestStreakValue: 4,
	totalDistance: 120,
	distanceEquivalent: "About the same as London to Bristol (~120 mi)",
	wrappedUrl: "https://example.com/wrapped/abc?season=2025%2F26",
	seasonsAvailable: ["2025/26", "2024/25"],
	veoFixtures: [],
	wrappedLeaguePointsContributed: 21,
	wrappedCupTiesAdvanced: 2,
	wrappedDominantTeam: "1st XI",
	wrappedDominantTeamLeaguePosition: 4,
	wrappedDominantTeamLeagueDivision: "Premier",
	wrappedDominantTeamLeagueRow: {
		position: 4,
		team: "Dorkinians 1st XI",
		played: 20,
		won: 12,
		drawn: 4,
		lost: 4,
		goalsFor: 40,
		goalsAgainst: 28,
		goalDifference: 12,
		points: 40,
	},
};

describe("GET /api/wrapped/[playerSlug]", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns JSON when compute succeeds", async () => {
		computeWrappedData.mockResolvedValue({ data: sample });
		const slug = playerNameToWrappedSlug("Test Player");
		const { GET } = await import("../../app/api/wrapped/[playerSlug]/route");
		const req = new Request(`http://localhost/api/wrapped/${slug}`, {
			headers: { host: "example.com" },
		});
		const res = await GET(req as any, { params: Promise.resolve({ playerSlug: slug }) });
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.playerName).toBe("Test Player");
		expect(json.totalMatches).toBe(12);
	});

	it("returns 400 for invalid slug", async () => {
		const { GET } = await import("../../app/api/wrapped/[playerSlug]/route");
		const req = new Request("http://localhost/api/wrapped/", {
			headers: { host: "example.com" },
		});
		const res = await GET(req as any, { params: Promise.resolve({ playerSlug: "" }) });
		expect(res.status).toBe(400);
	});

	it("forwards error status from computeWrappedData", async () => {
		computeWrappedData.mockResolvedValue({ error: "Player not found", status: 404 });
		const slug = playerNameToWrappedSlug("Nobody Here");
		const { GET } = await import("../../app/api/wrapped/[playerSlug]/route");
		const req = new Request(`http://localhost/api/wrapped/${slug}`, {
			headers: { host: "example.com" },
		});
		const res = await GET(req as any, { params: Promise.resolve({ playerSlug: slug }) });
		expect(res.status).toBe(404);
	});
});
