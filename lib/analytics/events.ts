/**
 * Central Umami event names and property keys for Dorkinians V3.
 * Keep names stable — weekly report and dashboards depend on them.
 */

export const UmamiEvents = {
	// Existing baseline
	AppVersion: "App Version",
	WebVital: "Web Vital",

	// Navigation
	PageViewed: "Page Viewed",
	SubpageViewed: "Subpage Viewed",
	SettingsOpened: "Settings Opened",
	FilterOpened: "Filter Opened",
	StatsMenuOpened: "Stats Menu Opened",

	// Player
	PlayerSelected: "Player Selected",
	PlayerEditStarted: "Player Edit Started",
	RecentPlayerSelected: "Recent Player Selected",

	// Chatbot
	ChatbotQuestionSubmitted: "Chatbot Question Submitted",
	ChatbotResponseRendered: "Chatbot Response Rendered",
	ChatbotError: "Chatbot Error",
	ExampleQuestionsOpened: "Example Questions Opened",
	ExampleQuestionSelected: "Example Question Selected",
	ChatbotCtaClicked: "Chatbot CTA Clicked",

	// Stats / filters
	StatsStatSelected: "Stats Stat Selected",
	TeamStatsTeamSelected: "Team Stats Team Selected",
	StatsSectionNavigated: "Stats Section Navigated",
	StatsSubpageSwitched: "Stats Subpage Switched",
	FiltersApplied: "Filters Applied",
	FiltersReset: "Filters Reset",
	FilterPresetApplied: "Filter Preset Applied",
	AllGamesModalOpened: "All Games Modal Opened",
	DataTableToggled: "Data Table Toggled",
	StatsShared: "Stats Shared",

	// TOTW / POM
	TotwWeekChanged: "TOTW Week Changed",
	TotwPlayerOpened: "TOTW Player Opened",
	TotwPlayerModalClosed: "TOTW Player Modal Closed",
	PlayersOfMonthMonthChanged: "PlayersOfMonth Month Changed",
	PlayersOfMonthRowExpanded: "PlayersOfMonth Row Expanded",

	// Club info
	ClubInfoSubpageViewed: "ClubInfo Subpage Viewed",
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
