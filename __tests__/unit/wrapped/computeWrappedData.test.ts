const runQueryMock = jest.fn();
const fetchLeagueFinishMock = jest.fn();
const fetchLeagueRowMock = jest.fn();

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		getGraphLabel: jest.fn().mockReturnValue("dorkinians"),
		runQuery: runQueryMock,
	},
}));

jest.mock("@/lib/wrapped/wrappedTeamSeason", () => ({
	fetchDorkiniansLeagueFinishForTeamSeason: (...args: unknown[]) => fetchLeagueFinishMock(...args),
	fetchDorkiniansLeagueTableRowForTeamSeason: (...args: unknown[]) => fetchLeagueRowMock(...args),
	fixtureDisplayTeamToLeagueTableKey: jest.fn((team?: string | null) => {
		if (!team) return null;
		return "1s";
	}),
	isCupTieAdvanced: jest.fn(() => false),
}));

import { computeWrappedData } from "@/lib/wrapped/computeWrappedData";

function rec(values: Record<string, unknown>) {
	return {
		get: (key: string) => values[key],
	};
}

function queryResult(rows: Array<Record<string, unknown>>) {
	return { records: rows.map((row) => rec(row)) };
}

function makeRunQueryHandler(currentSeasonRaw: string) {
	return async (query: unknown) => {
		const q = String(query);
		if (q.includes("MATCH (sd:SiteDetail")) {
			return queryResult([{ currentSeason: currentSeasonRaw }]);
		}
		if (q.includes("RETURN p.playerName AS playerName")) {
			return queryResult([
				{
					playerName: "Test Player",
					allowOnSite: true,
					numberTeamsPlayedFor: 1,
					seasonBestScoringStreak: 0,
					seasonBestAssistStreak: 0,
					seasonBestCleanSheetStreak: 0,
					seasonBestAppearanceStreak: 0,
					seasonBestDisciplineStreak: 0,
					seasonBestWinStreak: 0,
				},
			]);
		}
		if (q.includes("RETURN collect(DISTINCT toString(raw)) AS seasons")) {
			return queryResult([{ seasons: ["2025/26"] }]);
		}
		if (q.includes("RETURN count(md) AS apps")) {
			return queryResult([
				{
					apps: 10,
					goals: 0,
					penaltiesScored: 0,
					assists: 0,
					mom: 0,
					minutes: 900,
					distance: 0,
					yellowCards: 0,
					redCards: 0,
					cleanSheets: 0,
					wins: 3,
					draws: 2,
					starts: 10,
					peakRating: 7.2,
				},
			]);
		}
		if (q.includes("RETURN collect({nm: nm")) {
			return queryResult([
				{
					rows: [
						{
							nm: "Test Player",
							apps: 10,
							mins: 900,
							goals: 0,
							assists: 0,
							cs: 0,
							ftp: 50,
							dist: 0,
							mom: 0,
							starts: 10,
						},
					],
				},
			]);
		}
		if (q.includes("RETURN ym, monthApps")) {
			return queryResult([
				{
					ym: "2025-08",
					monthApps: 2,
					g: 0,
					psc: 0,
					a: 0,
					monthMom: 0,
					ftp: 10,
					mins: 180,
					starts: 2,
					yellowCards: 0,
					redCards: 0,
				},
			]);
		}
		if (q.includes("AS peakRating") && q.includes("peakConceded")) {
			return queryResult([
				{
					peakRating: 7.2,
					opposition: "Opponent",
					peakGoals: 0,
					peakPenaltiesScored: 0,
					peakAssists: 0,
					peakMom: 0,
					peakFantasyPoints: 5,
					peakMinutes: 90,
					peakStarted: true,
					peakYellowCards: 0,
					peakRedCards: 0,
					peakResult: "W",
					peakDorkiniansGoals: 1,
					peakConceded: 0,
				},
			]);
		}
		if (q.includes("RETURN cls, c")) {
			return queryResult([{ cls: "DEF", c: 10 }]);
		}
		if (q.includes("RETURN partner, games, wins")) {
			return queryResult([]);
		}
		if (q.includes("AS fixtureId")) {
			return queryResult([]);
		}
		if (q.includes("RETURN team, apps, mins")) {
			return queryResult([{ team: "1st XI", apps: 10, mins: 900 }]);
		}
		if (q.includes("AS leaguePts")) {
			return queryResult([{ leaguePts: 11, leagueWins: 3, leagueDraws: 2 }]);
		}
		if (q.includes("RETURN loc, apps, goals, penaltiesScored, assists, wins")) {
			return queryResult([
				{ loc: "Home", apps: 5, goals: 0, penaltiesScored: 0, assists: 0, wins: 2 },
				{ loc: "Away", apps: 5, goals: 0, penaltiesScored: 0, assists: 0, wins: 1 },
			]);
		}
		if (q.includes("AS result, coalesce(f.fullResult, '') AS fullResult")) {
			return queryResult([]);
		}
		if (q.includes("RETURN collect(DISTINCT coalesce(f.team, '')) AS teams")) {
			return queryResult([{ teams: ["1st XI"] }]);
		}
		throw new Error(`Unhandled query: ${q.slice(0, 80)}`);
	};
}

describe("computeWrappedData trophies", () => {
	beforeEach(() => {
		const neo4jMock = jest.requireMock("@/lib/neo4j").neo4jService as {
			connect: jest.Mock;
			getGraphLabel: jest.Mock;
			runQuery: jest.Mock;
		};
		neo4jMock.connect.mockResolvedValue(true);
		neo4jMock.getGraphLabel.mockReturnValue("dorkinians");
		neo4jMock.runQuery.mockImplementation(runQueryMock);
		runQueryMock.mockReset();
		fetchLeagueFinishMock.mockReset();
		fetchLeagueRowMock.mockReset();
		fetchLeagueFinishMock.mockResolvedValue({ position: 1, division: "Premier" });
		fetchLeagueRowMock.mockResolvedValue(null);
	});

	test("suppresses wrapped trophies for current season", async () => {
		runQueryMock.mockImplementation(makeRunQueryHandler("2025-26"));

		const result = await computeWrappedData({
			playerName: "Test Player",
			season: "2025/26",
			sitePublicOrigin: "https://example.com",
		});

		if ("error" in result) {
			throw new Error(`Unexpected error: ${result.error}`);
		}
		expect(result.data.wrappedTrophiesWon).toEqual([]);
		expect(fetchLeagueFinishMock).toHaveBeenCalledTimes(1);
	});
});
