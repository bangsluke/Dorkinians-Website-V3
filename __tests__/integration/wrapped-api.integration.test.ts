jest.mock("@/lib/wrapped/computeWrappedData", () => ({
	computeWrappedData: jest.fn(),
	computeWrappedSeasonMetadata: jest.fn(),
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
	totalPenaltiesScored: 1,
	totalAssists: 2,
	totalMom: 1,
	matchesPercentile: 55,
	bestMonth: "Jan 2026",
	bestMonthGoals: 2,
	bestMonthPenaltiesScored: 1,
	bestMonthAssists: 1,
	bestMonthMom: 2,
	bestMonthMatches: 5,
	bestMonthFantasyPoints: 42.5,
	bestMonthMinutes: 410,
	bestMonthStarts: 4,
	bestMonthYellowCards: 1,
	bestMonthRedCards: 0,
	topPartnerName: "Partner Name",
	topPartnerMatches: 8,
	topPartnerWinRate: 62.5,
	playerType: "The Squad Player",
	playerTypeReason: "Reliable",
	peakMatchRating: 8.2,
	peakMatchOpposition: "FC Test",
	peakMatchGoals: 2,
	peakMatchPenaltiesScored: 1,
	peakMatchAssists: 0,
	peakMatchFantasyPoints: 12.5,
	peakMatchMinutes: 90,
	peakMatchStarted: true,
	peakMatchMom: true,
	peakMatchMomCount: 1,
	peakMatchYellowCards: 0,
	peakMatchRedCards: 0,
	peakMatchResultLabel: "Win",
	peakMatchScoreline: "3-1",
	longestStreakType: "Scoring streak",
	longestStreakValue: 4,
	totalYellowCards: 3,
	totalRedCards: 0,
	totalWins: 8,
	totalDraws: 2,
	totalCleanSheets: 4,
	totalDistance: 120,
	distanceEquivalent: "About the same as London to Bristol (~120 mi)",
	wrappedUrl: "https://example.com/wrapped/abc?season=2025%2F26",
	seasonsAvailable: ["2025/26", "2024/25"],
	veoFixtures: [],
	wrappedLeaguePointsContributed: 21,
	wrappedLeagueWinsFromPlayedGames: 6,
	wrappedLeagueDrawsFromPlayedGames: 3,
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
	wrappedTrophiesWon: ["Dorkinians 1st XI Premier Champions 2025/26"],
	wrappedHomeApps: 6,
	wrappedAwayApps: 6,
	wrappedHomeWinRate: 66.7,
	wrappedAwayWinRate: 50.0,
	wrappedHomeGoals: 2,
	wrappedAwayGoals: 1,
	wrappedHomePenaltiesScored: 1,
	wrappedAwayPenaltiesScored: 0,
	wrappedHomeAssists: 1,
	wrappedAwayAssists: 1,
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
