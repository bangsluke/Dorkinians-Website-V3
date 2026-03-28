export interface WrappedData {
	playerName: string;
	season: string;
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
}
