/**
 * Player streak metrics (Feature 5): maps chatbot / ranking metric keys to Neo4j Player property names.
 */
export const STREAK_METRIC_TO_PLAYER_PROP: Record<string, string> = {
	CURRENT_SCORING_STREAK: "currentScoringStreak",
	CURRENT_GOAL_INVOLVEMENT_STREAK: "currentGoalInvolvementStreak",
	CURRENT_ASSIST_STREAK: "currentAssistStreak",
	CURRENT_CLEAN_SHEET_STREAK: "currentCleanSheetStreak",
	CURRENT_APPEARANCE_STREAK: "currentAppearanceStreak",
	CURRENT_WIN_STREAK: "currentWinStreak",
	ALL_TIME_BEST_SCORING_STREAK: "allTimeBestScoringStreak",
	ALL_TIME_BEST_APPEARANCE_STREAK: "allTimeBestAppearanceStreak",
	ALL_TIME_BEST_CLEAN_SHEET_STREAK: "allTimeBestCleanSheetStreak",
	ALL_TIME_BEST_WIN_STREAK: "allTimeBestWinStreak",
};

export function playerPropForStreakMetric(metricKey: string): string | undefined {
	return STREAK_METRIC_TO_PLAYER_PROP[metricKey];
}

export function isStreakMetricKey(metricKey: string): boolean {
	return metricKey in STREAK_METRIC_TO_PLAYER_PROP;
}
