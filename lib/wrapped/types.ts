/** Fixtures in the wrapped season where the player played and a Veo/video URL exists. */
export interface WrappedVeoFixture {
	fixtureId: string;
	team: string;
	opposition: string;
	date: string;
	veoLink: string;
	result: string;
	goalsScored: number;
	goalsConceded: number;
}

export interface WrappedData {
	playerName: string;
	season: string;
	/** Distinct seasons (normalized `YYYY/YY` labels) the player has appearances in, newest first. */
	seasonsAvailable: string[];
	/** Veo-linked fixtures for this player in the wrapped `season` only; empty when none. */
	veoFixtures: WrappedVeoFixture[];
	totalMatches: number;
	totalGoals: number;
	totalAssists: number;
	totalMom: number;
	matchesPercentile: number;
	bestMonth: string;
	bestMonthGoals: number;
	bestMonthAssists: number;
	topPartnerName: string;
	topPartnerMatches: number;
	topPartnerWinRate: number;
	playerType: string;
	playerTypeReason: string;
	peakMatchRating: number;
	peakMatchOpposition: string;
	peakMatchGoals: number;
	peakMatchAssists: number;
	longestStreakType: string | null;
	longestStreakValue: number | null;
	totalDistance: number;
	distanceEquivalent: string;
	wrappedUrl: string;
	/** League points (3 win, 1 draw) from league fixtures the player played in this season. */
	wrappedLeaguePointsContributed: number;
	/** Cup fixtures played where the club advanced (win or draw + penalty heuristic). */
	wrappedCupTiesAdvanced: number;
	/** XI / team string with the most appearances this season (tie-break: minutes, then name). */
	wrappedDominantTeam: string;
	/** Final league table position for Dorkinians for that XI in this season, if known. */
	wrappedDominantTeamLeaguePosition: number | null;
	/** Division label from league table data when available. */
	wrappedDominantTeamLeagueDivision: string;
}
