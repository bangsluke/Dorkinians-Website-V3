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

/** One row from the JSON league table (Dorkinians row for the dominant XI), when available. */
export interface WrappedLeagueTableRow {
	position: number;
	team: string;
	played: number;
	won: number;
	drawn: number;
	lost: number;
	goalsFor: number;
	goalsAgainst: number;
	goalDifference: number;
	points: number;
}

export interface WrappedData {
	playerName: string;
	season: string;
	/** Distinct seasons (normalized `YYYY/YY` labels) the player has appearances in, newest first. */
	seasonsAvailable: string[];
	/** Veo-linked fixtures for this player in the wrapped `season` only; empty when none. */
	veoFixtures: WrappedVeoFixture[];
	totalMatches: number;
	/** Minutes played in the wrapped season. */
	totalMinutes: number;
	/** Starts in the wrapped season (`MatchDetail.started`). */
	totalStarts: number;
	/** Most common position class in the wrapped season (e.g. `MID`). */
	mostPlayedPosition: string;
	totalGoals: number;
	totalAssists: number;
	totalMom: number;
	matchesPercentile: number;
	bestMonth: string;
	bestMonthGoals: number;
	bestMonthAssists: number;
	/** Appearances in the player’s best month bucket. */
	bestMonthMatches: number;
	/** Sum of fantasy (FTP) points in the best month bucket. */
	bestMonthFantasyPoints: number;
	topPartnerName: string;
	topPartnerMatches: number;
	topPartnerWinRate: number;
	playerType: string;
	playerTypeReason: string;
	peakMatchRating: number;
	peakMatchOpposition: string;
	peakMatchGoals: number;
	peakMatchAssists: number;
	/** Short result label for the peak match (e.g. Win / Draw / Loss). */
	peakMatchResultLabel: string;
	/** Scoreline from the club’s perspective (e.g. `3-1`). */
	peakMatchScoreline: string;
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
	/** Dorkinians’ league table row for that XI/league file when available. */
	wrappedDominantTeamLeagueRow: WrappedLeagueTableRow | null;
}
