/**
 * Central Umami event names and property keys for Dorkinians V3.
 * Keep names stable — weekly report and dashboards depend on them.
 */

export const UmamiEvents = {
	// Existing baseline
	AppVersion: "App Version",

	// Navigation
	SubpageViewed: "Subpage Viewed",
	SettingsOpened: "Settings Opened",

	// Player
	PlayerSelected: "Player Selected",
	PlayerEditStarted: "Player Edit Started",

	// Chatbot
	ChatbotQuestionSubmitted: "Chatbot Question Submitted",
	ChatbotError: "Chatbot Error",
	ChatbotCtaClicked: "Chatbot CTA Clicked",

	// Stats / filters
	TeamStatsTeamSelected: "Team Stats Team Selected",
	FiltersApplied: "Filters Applied",
	FiltersReset: "Filters Reset",
	StatsShared: "Stats Shared",

	// TOTW / POM
	TotwPlayerOpened: "TOTW Player Opened",
	PlayersOfMonthRowExpanded: "PlayersOfMonth Row Expanded",

	// Club info
	LeagueTeamFocused: "League Team Focused",
	LeagueResultsOpened: "League Results Opened",
	CaptainHistoryOpened: "Captain History Opened",
	AwardHistoryOpened: "Award History Opened",
	UsefulLinkClicked: "Useful Link Clicked",

	// Settings / feedback
	ShareSiteTriggered: "Share Site Triggered",
	FeedbackModalOpened: "Feedback Modal Opened",
	FeedbackSubmitted: "Feedback Submitted",
	DataPrivacyModalOpened: "Data Privacy Modal Opened",
	DataRemovalSubmitted: "Data Removal Submitted",
} as const;

export type UmamiEventName = (typeof UmamiEvents)[keyof typeof UmamiEvents];

/** Section keys used in weekly report scoring (must match report mapping). */
export const AnalyticsSections = {
	home: "home",
	stats: "stats",
	totw: "totw",
	clubInfo: "club-info",
	settings: "settings",
	global: "global",
} as const;
