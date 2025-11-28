export const appConfig = {
	version: "1.1.19",
	name: "Dorkinians FC",
	description: "Comprehensive source for club statistics, player performance, and team insights",
	author: "Luke Bangs",
	contact: "bangsluke@gmail.com",
} as const;

export type AppConfig = typeof appConfig;

export interface HomepageQuestion {
	id: string;
	question: string;
	description: string;
	category: "player" | "team" | "general";
}

export interface UsefulLink {
	id: string;
	title: string;
	url: string;
	description: string;
	category: "official" | "league" | "sponsor" | "social" | "other";
}

export const homepageQuestions: HomepageQuestion[] = [
	{
		id: "most-prolific-season",
		question: "What was my most prolific season?",
		description: "See how many goals you have scored each season",
		category: "player",
	},
	{
		id: "fantasy-points",
		question: "What is my total Fantasy Points count?",
		description: "Check your total Fantasy Points count",
		category: "player",
	},
];

export const usefulLinks: UsefulLink[] = [
	{
		id: "main-website",
		title: "Dorkinians FC Official Website",
		url: "https://www.dorkiniansfc.co.uk/",
		description: "Official club website with news, fixtures, and team information",
		category: "official",
	},
	{
		id: "kit-store",
		title: "Dorkinian Shop",
		url: "https://www.dorkiniansfc.co.uk/shop",
		description: "For annual membership payments and payment plans",
		category: "official",
	},

	{
		id: "twitter",
		title: "Club Twitter",
		url: "https://www.twitter.com/dorkiniansfc",
		description: "Follow us on Twitter for news and updates",
		category: "social",
	},
	{
		id: "instagram",
		title: "Club Instagram",
		url: "https://www.instagram.com/dorkiniansfc",
		description: "Follow us on Instagram for photos and stories",
		category: "social",
	},
	{
		id: "facebook",
		title: "Club Facebook",
		url: "https://www.facebook.com/groups/234447916584875",
		description: "Join us on Facebook for latest updates",
		category: "social",
	},
	{
		id: "the-fa",
		title: "The Football Association",
		url: "https://www.thefa.com/",
		description: "Official FA website with rules and regulations",
		category: "other",
	},
	{
		id: "surrey-fa",
		title: "Surrey FA",
		url: "https://www.surreyfa.com/",
		description: "Surrey County Football Association",
		category: "other",
	},
];

// Question type definitions for chatbot system
export type QuestionType =
	| "player"
	| "team"
	| "club"
	| "fixture"
	| "comparison"
	| "streak"
	| "double_game"
	| "temporal"
	| "general"
	| "ranking"
	| "league_table"
	| "clarification_needed";

export const questionTypes: Record<
	QuestionType,
	{ displayName: string; description: string; hasVisualization: boolean; visualizationType?: VisualizationType }
> = {
	player: {
		displayName: "Player Statistics",
		description: "Questions about individual player performance and statistics",
		hasVisualization: true,
		visualizationType: "NumberCard",
	},
	team: {
		displayName: "Team Performance",
		description: "Questions about team standings, results, and performance",
		hasVisualization: true,
		visualizationType: "Table",
	},
	club: {
		displayName: "Club Information",
		description: "Questions about club-wide information and general statistics",
		hasVisualization: true,
		visualizationType: "Table",
	},
	fixture: {
		displayName: "Fixture Details",
		description: "Questions about specific matches and fixtures",
		hasVisualization: true,
		visualizationType: "Table",
	},
	comparison: {
		displayName: "Player Comparison",
		description: "Questions comparing multiple players or teams",
		hasVisualization: true,
		visualizationType: "Table",
	},
	streak: {
		displayName: "Streak Analysis",
		description: "Questions about consecutive performances or records",
		hasVisualization: true,
		visualizationType: "Calendar",
	},
	double_game: {
		displayName: "Double Game Weeks",
		description: "Questions about double game week performances",
		hasVisualization: true,
		visualizationType: "NumberCard",
	},
	temporal: {
		displayName: "Time-based Queries",
		description: "Questions about performance over specific time periods",
		hasVisualization: true,
		visualizationType: "NumberCard",
	},
	general: {
		displayName: "General Information",
		description: "General questions about the club or football",
		hasVisualization: false,
	},
	ranking: {
		displayName: "Rankings & Records",
		description: "Questions about who has the highest/lowest statistics",
		hasVisualization: true,
		visualizationType: "Record",
	},
	league_table: {
		displayName: "League Table",
		description: "Questions about league positions and standings",
		hasVisualization: true,
		visualizationType: "Table",
	},
	clarification_needed: {
		displayName: "Clarification Required",
		description: "Questions that need clarification before processing",
		hasVisualization: false,
	},
};

// Visualization type definitions
export type VisualizationType = "NumberCard" | "Table" | "Calendar" | "Record";

export const visualizationTypes: Record<VisualizationType, { displayName: string; description: string; useCase: string }> = {
	NumberCard: {
		displayName: "Number Card",
		description: "Simple numeric display for single values or counts",
		useCase: "Goals scored, appearances, clean sheets, etc.",
	},
	Table: {
		displayName: "Data Table",
		description: "Tabular display for multiple records or comparisons",
		useCase: "League tables, player comparisons, team standings, etc.",
	},
	Calendar: {
		displayName: "Calendar View",
		description: "Time-based visualization for streaks and temporal data",
		useCase: "Consecutive games, scoring streaks, performance over time, etc.",
	},
	Record: {
		displayName: "Record Display",
		description: "Specialized display for records and achievements",
		useCase: "Personal bests, season records, milestone achievements, etc.",
	},
};

// Function to generate league links from dataSources
export const generateLeagueLinks = (): UsefulLink[] => {
	// Import dataSources dynamically to avoid circular dependencies
	const { dataSources } = require("../lib/config/dataSources.js");

	// Get current season (2024-25) and previous season (2023-24)
	const currentSeason = "2024-25";
	const previousSeason = "2023-24";

	// Filter FA site data sources for league tables
	const leagueSources = dataSources.filter(
		(source: any) =>
			source.type === "FASiteData" &&
			source.category === "league" &&
			source.url !== "TBC" &&
			(source.season === currentSeason || source.season === previousSeason),
	);

	// Group by team and get the most recent season for each team
	const teamLeagues = leagueSources.reduce((acc: any, source: any) => {
		const team = source.team;
		const season = source.season;

		if (!acc[team] || season === currentSeason) {
			acc[team] = source;
		}
		return acc;
	}, {});

	// Convert to UsefulLink format
	return Object.values(teamLeagues).map((source: any) => ({
		id: `league-${source.team.toLowerCase().replace(/\s+/g, "-")}`,
		title: `${source.team} League Table (${source.season})`,
		url: source.url,
		description: `View ${source.team} league standings and results for ${source.season} season`,
		category: "league" as const,
	}));
};

// Globally define an object containing stat objects that can be referenced in other functions.
export const statObject = {
	APP: {
		statName: "appearances",
		displayText: "Appearances", // The text displayed at all times on the page.
		shortText: "Apps", // Used for short displays such as on the Comparison tab.
		wordedText: "appearances", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of appearances made by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Appearance Stat",
		iconName: "Appearance-Icon",
	},
	MIN: {
		statName: "minutes",
		displayText: "Minutes played", // The text displayed at all times on the page.
		shortText: "Mins", // Used for short displays such as on the Comparison tab.
		wordedText: "minutes played", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of minutes played by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Appearance Stat",
		iconName: "Minutes-Icon",
		statUnit: "mins",
	},
	MOM: {
		statName: "mom",
		displayText: "Man of the Matches", // The text displayed at all times on the page.
		shortText: "MoMs", // Used for short displays such as on the Comparison tab.
		wordedText: "man of the match awards", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of man of the match performances achieved by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Performance Stat",
		iconName: "MoM-Icon",
	},
	AllGSC: {
		statName: "allGoalsScored",
		displayText: "All Goals Scored", // The text displayed at all times on the page.
		shortText: "Goals", // Used for short displays such as on the Comparison tab.
		wordedText: "goals", // Used for chatbot responses
		statFormat: "Integer",
		description: "The total number of goals scored by the player, including open play goals and penalties.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Performance Stat",
		iconName: "Goals-Icon",
	},
	G: {
		statName: "openPlayGoalsScored",
		displayText: "Open Play Goals Scored", // The text displayed at all times on the page.
		shortText: "OP Goals", // Used for short displays such as on the Comparison tab.
		wordedText: "open play goals", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of goals scored by the player in open play (not including penalties).",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Performance Stat",
		iconName: "Goals-Icon",
	},
	A: {
		statName: "assists",
		displayText: "Assists provided", // The text displayed at all times on the page.
		shortText: "Assists", // Used for short displays such as on the Comparison tab.
		wordedText: "assists", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of assists provided by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Performance Stat",
		iconName: "Assists-Icon",
	},
	Y: {
		statName: "yellowCards",
		displayText: "Yellow Cards Received", // The text displayed at all times on the page.
		shortText: "Yel", // Used for short displays such as on the Comparison tab.
		wordedText: "yellow cards", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of yellow cards received by the player.",
		statHigherBetterBooleanArray: false,
		numberDecimalPlaces: 0,
		statCategory: "Performance Stat",
		iconName: "YellowCard-Icon",
	},
	R: {
		statName: "redCards",
		displayText: "Red Cards Received", // The text displayed at all times on the page.
		shortText: "Red", // Used for short displays such as on the Comparison tab.
		wordedText: "red cards", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of red cards received by the player.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 0,
		statCategory: "Performance Stat",
		iconName: "RedCard-Icon",
	},
	SAVES: {
		statName: "saves",
		displayText: "Saves Produced", // The text displayed at all times on the page.
		shortText: "Saves", // Used for short displays such as on the Comparison tab.
		wordedText: "saves", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of saves made whilst playing as a Keeper.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Performance Stat",
		iconName: "PenaltiesSaved-Icon",
	},
	OG: {
		statName: "ownGoals",
		displayText: "Own Goals Scored", // The text displayed at all times on the page.
		shortText: "OGs", // Used for short displays such as on the Comparison tab.
		wordedText: "own goals", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of own goals scored by the player.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 0,
		statCategory: "Performance Stat",
		iconName: "OwnGoal-Icon",
	},
	C: {
		statName: "conceded",
		displayText: "Goals Conceded", // The text displayed at all times on the page.
		shortText: "Con", // Used for short displays such as on the Comparison tab.
		wordedText: "goals", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of goals conceded whilst the player has been playing.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 0,
		statCategory: "Performance Stat",
		iconName: "Conceded-Icon",
	},
	CLS: {
		statName: "cleanSheets",
		displayText: "Clean Sheets Achieved", // The text displayed at all times on the page.
		shortText: "CLS", // Used for short displays such as on the Comparison tab.
		wordedText: "clean sheets", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of clean sheets achieved by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Performance Stat",
		iconName: "CleanSheet-Icon",
	},
	PSC: {
		statName: "penaltiesScored",
		displayText: "Penalties Scored", // The text displayed at all times on the page.
		shortText: "Pens", // Used for short displays such as on the Comparison tab.
		wordedText: "penalties", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of penalties scored by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Penalty Stat",
		iconName: "PenaltiesScored-Icon",
	},
	PM: {
		statName: "penaltiesMissed",
		displayText: "Penalties Missed", // The text displayed at all times on the page.
		shortText: "Pens Mis", // Used for short displays such as on the Comparison tab.
		wordedText: "penalties", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of penalties missed by the player.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 0,
		statCategory: "Penalty Stat",
		iconName: "PenaltiesMissed-Icon",
	},
	PCO: {
		statName: "penaltiesConceded",
		displayText: "Penalties Conceded", // The text displayed at all times on the page.
		shortText: "Pens Con", // Used for short displays such as on the Comparison tab.
		wordedText: "penalties", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of penalties conceded by the player.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 0,
		statCategory: "Penalty Stat",
		iconName: "PenaltiesConceded-Icon",
	},
	PSV: {
		statName: "penaltiesSaved",
		displayText: "Penalties Saved", // The text displayed at all times on the page.
		shortText: "Pens Save", // Used for short displays such as on the Comparison tab.
		wordedText: "penalties", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of penalties saved by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Penalty Stat",
		iconName: "PenaltiesSaved-Icon",
	},
	FTP: {
		statName: "fantasyPoints",
		displayText: "Fantasy Points Achieved", // The text displayed at all times on the page.
		shortText: "FTP", // Used for short displays such as on the Comparison tab.
		wordedText: "fantasy points", // Used for chatbot responses
		statFormat: "Decimal",
		description: "The number of fantasy points achieved by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Performance Stat",
		iconName: "FantasyPoints-Icon",
	},
	GI: {
		statName: "goalInvolvements",
		displayText: "Goal Involvements", // The text displayed at all times on the page.
		shortText: "GI", // Used for short displays such as on the Comparison tab.
		wordedText: "goal involvements", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of goal involvements achieved by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Performance Stat",
		iconName: "GoalInvolvements-Icon",
	},
	GperAPP: {
		statName: "goalsPerApp",
		displayText: "Goals Per Appearance", // The text displayed at all times on the page.
		shortText: "GperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "goals per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of goals scored per appearance by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 1,
		statCategory: "Per App/Minute Stat",
		iconName: "GoalsPerAppearance-Icon",
	},
	CperAPP: {
		statName: "concededPerApp",
		displayText: "Goals Conceded Per Appearance", // The text displayed at all times on the page.
		shortText: "CperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "goals conceded per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of goals conceded per appearance by the player.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 1,
		statCategory: "Per App/Minute Stat",
		iconName: "ConcededPerAppearance-Icon",
	},
	MperG: {
		statName: "minutesPerGoal",
		displayText: "Minutes Per Goal Scored", // The text displayed at all times on the page.
		shortText: "MperG", // Used for short displays such as on the Comparison tab.
		wordedText: "minutes per goal scored", // Used for chatbot responses
		statFormat: "Integer",
		description: "The average number of minutes needed by the player to score a goal.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 0,
		statCategory: "Per App/Minute Stat",
		iconName: "MinutesPerGoal-Icon",
		statUnit: "mins",
	},
	MperCLS: {
		statName: "minutesPerCleanSheet",
		displayText: "Minutes Per Clean Sheet", // The text displayed at all times on the page.
		shortText: "MperCLS", // Used for short displays such as on the Comparison tab.
		wordedText: "minutes per clean sheet", // Used for chatbot responses
		statFormat: "Integer",
		description: "The average number of minutes needed by the player to achieve a clean sheet.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 0,
		statCategory: "Per App/Minute Stat",
		iconName: "MinutesPerCleanSheet-Icon",
		statUnit: "mins",
	},
	FTPperAPP: {
		statName: "fantasyPointsPerApp",
		displayText: "Fantasy Points Per Appearance", // The text displayed at all times on the page.
		shortText: "FTPperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "fantasy points per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of fantasy points scored per appearance by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 1,
		statCategory: "Per App/Minute Stat",
		iconName: "FantasyPointsPerAppearance-Icon",
	},
	MINperAPP: {
		statName: "minutesPerApp",
		displayText: "Average Minutes Per Appearance", // The text displayed at all times on the page.
		shortText: "MINperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "minutes per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of minutes played per appearance by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 1,
		statCategory: "Per App/Minute Stat",
		iconName: "MinutesPerAppearance-Icon",
		statUnit: "mins",
	},
	MOMperAPP: {
		statName: "momPerApp",
		displayText: "Man of the Match Per Appearance", // The text displayed at all times on the page.
		shortText: "MOMperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "man of the match per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of man of the match awards per appearance by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 2,
		statCategory: "Per App/Minute Stat",
		iconName: "MOMPerAppearance-Icon",
	},
	YperAPP: {
		statName: "yellowCardsPerApp",
		displayText: "Yellow Cards Per Appearance", // The text displayed at all times on the page.
		shortText: "YperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "yellow cards per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of yellow cards received per appearance by the player.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 2,
		statCategory: "Per App/Minute Stat",
		iconName: "YellowCardsPerAppearance-Icon",
	},
	RperAPP: {
		statName: "redCardsPerApp",
		displayText: "Red Cards Per Appearance", // The text displayed at all times on the page.
		shortText: "RperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "red cards per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of red cards received per appearance by the player.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 2,
		statCategory: "Per App/Minute Stat",
		iconName: "RedCardsPerAppearance-Icon",
	},
	SAVESperAPP: {
		statName: "savesPerApp",
		displayText: "Saves Per Appearance", // The text displayed at all times on the page.
		shortText: "SAVESperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "saves per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of saves made per appearance by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 2,
		statCategory: "Per App/Minute Stat",
		iconName: "SavesPerAppearance-Icon",
	},
	OGperAPP: {
		statName: "ownGoalsPerApp",
		displayText: "Own Goals Per Appearance", // The text displayed at all times on the page.
		shortText: "OGperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "own goals per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of own goals scored per appearance by the player.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 2,
		statCategory: "Per App/Minute Stat",
		iconName: "OwnGoalsPerAppearance-Icon",
	},
	CLSperAPP: {
		statName: "cleanSheetsPerApp",
		displayText: "Clean Sheets Per Appearance", // The text displayed at all times on the page.
		shortText: "CLSperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "clean sheets per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of clean sheets achieved per appearance by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 2,
		statCategory: "Per App/Minute Stat",
		iconName: "CleanSheetsPerAppearance-Icon",
	},
	PSCperAPP: {
		statName: "penaltiesScoredPerApp",
		displayText: "Penalties Scored Per Appearance", // The text displayed at all times on the page.
		shortText: "PSCperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "penalties scored per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of penalties scored per appearance by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 2,
		statCategory: "Per App/Minute Stat",
		iconName: "PenaltiesScoredPerAppearance-Icon",
	},
	PMperAPP: {
		statName: "penaltiesMissedPerApp",
		displayText: "Penalties Missed Per Appearance", // The text displayed at all times on the page.
		shortText: "PMperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "penalties missed per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of penalties missed per appearance by the player.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 2,
		statCategory: "Per App/Minute Stat",
		iconName: "PenaltiesMissedPerAppearance-Icon",
	},
	PCOperAPP: {
		statName: "penaltiesConcededPerApp",
		displayText: "Penalties Conceded Per Appearance", // The text displayed at all times on the page.
		shortText: "PCOperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "penalties conceded per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of penalties conceded per appearance by the player.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 2,
		statCategory: "Per App/Minute Stat",
		iconName: "PenaltiesConcededPerAppearance-Icon",
	},
	PSVperAPP: {
		statName: "penaltiesSavedPerApp",
		displayText: "Penalties Saved Per Appearance", // The text displayed at all times on the page.
		shortText: "PSVperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "penalties saved per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of penalties saved per appearance by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 2,
		statCategory: "Per App/Minute Stat",
		iconName: "PenaltiesSavedPerAppearance-Icon",
	},
	DIST: {
		statName: "distance",
		displayText: "Distance Travelled", // The text displayed at all times on the page.
		shortText: "Dist", // Used for short displays such as on the Comparison tab.
		wordedText: "miles travelled", // Used for chatbot responses
		statFormat: "Decimal1",
		description: "The distance travelled in miles by the player getting to away games.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 1,
		statCategory: "Appearance Stat",
		iconName: "DistanceTravelled-Icon",
		statUnit: "miles",
	},
	"Games%Won": {
		statName: "gamesWon",
		displayText: "% Games Won", // The text displayed at all times on the page.
		shortText: "% Won", // Used for short displays such as on the Comparison tab.
		wordedText: "games won", // Used for chatbot responses
		statFormat: "Percentage",
		description: "The percentage of games won by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 1,
		statCategory: "Results Stat",
		iconName: "PercentageGamesWon-Icon",
		statUnit: "%",
	},
	HomeGames: {
		statName: "homeGames",
		displayText: "Home Games", // The text displayed at all times on the page.
		shortText: "H Apps", // Used for short displays such as on the Comparison tab.
		wordedText: "home games", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of home games played by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Results Stat",
		iconName: "HomeGames-Icon",
	},
	HomeWins: {
		statName: "homeWins",
		displayText: "Home Wins", // The text displayed at all times on the page.
		shortText: "H Wins", // Used for short displays such as on the Comparison tab.
		wordedText: "home games", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of home games won by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Results Stat",
		iconName: "HomeWins-Icon",
	},
	"HomeGames%Won": {
		statName: "homeGamesPercentWon",
		displayText: "% Home Games Won", // The text displayed at all times on the page.
		shortText: "% H Won", // Used for short displays such as on the Comparison tab.
		wordedText: "home games won", // Used for chatbot responses
		statFormat: "Percentage",
		description: "The percentage of home games won by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 1,
		statCategory: "Results Stat",
		iconName: "PercentageHomeGamesWon-Icon",
		statUnit: "%",
	},
	AwayGames: {
		statName: "awayGames",
		displayText: "Away Games", // The text displayed at all times on the page.
		shortText: "A Apps", // Used for short displays such as on the Comparison tab.
		wordedText: "away games", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of away games played by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Results Stat",
		iconName: "AwayGames-Icon",
	},
	AwayWins: {
		statName: "awayWins",
		displayText: "Away Wins", // The text displayed at all times on the page.
		shortText: "A Wins", // Used for short displays such as on the Comparison tab.
		wordedText: "away games", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of away games won by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Results Stat",
		iconName: "AwayWins-Icon",
	},
	"AwayGames%Won": {
		statName: "awayGamesPercentWon",
		displayText: "% Away Games Won", // The text displayed at all times on the page.
		shortText: "% A Won", // Used for short displays such as on the Comparison tab.
		wordedText: "away games won", // Used for chatbot responses
		statFormat: "Percentage",
		description: "The percentage of away games won by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 1,
		statCategory: "Results Stat",
		iconName: "PercentageAwayGamesWon-Icon",
		statUnit: "%",
	},
	PlayerPointsPerGame: {
		statName: "pointsPerGame",
		displayText: "Points Per Game", // The text displayed at all times on the page.
		shortText: "PPG", // Used for short displays such as on the Comparison tab.
		wordedText: "points per game", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average points per game achieved by the player (3 for win, 1 for draw, 0 for loss).",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 2,
		statCategory: "Results Stat",
		iconName: "Goals-Icon",
	},
	MostPlayedForTeam: {
		statName: "mostPlayedForTeam",
		displayText: "Most Played For Team", // The text displayed at all times on the page.
		shortText: "Most Play", // Used for short displays such as on the Comparison tab.
		wordedText: "most played for team", // Used for chatbot responses
		statFormat: "String",
		description: "The Dorkinians team that the player has appeared for most.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 0,
		statCategory: "Appearance Stat",
		iconName: "MostPlayedForTeam-Icon",
	},
	NumberTeamsPlayedFor: {
		statName: "numberTeamsPlayedFor",
		displayText: "Number Teams Played For", // The text displayed at all times on the page.
		shortText: "# Teams", // Used for short displays such as on the Comparison tab.
		wordedText: "number teams played for", // Used for chatbot responses
		statFormat: "String",
		description: "The number of Dorkinians teams that the player has appeared for.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Appearance Stat",
		iconName: "NumberTeamsPlayedFor-Icon",
	},
	NumberSeasonsPlayedFor: {
		statName: "numberSeasonsPlayedFor",
		displayText: "Number Seasons Played For", // The text displayed at all times on the page.
		shortText: "# Seasons", // Used for short displays such as on the Comparison tab.
		wordedText: "number seasons played for", // Used for chatbot responses
		statFormat: "String",
		description: "The number of seasons that the player has played for Dorkinians since stats records began.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Appearance Stat",
		iconName: "NumberSeasonsPlayedFor-Icon",
	},
	MostScoredForTeam: {
		statName: "mostScoredForTeam",
		displayText: "Most Scored For Team", // The text displayed at all times on the page.
		shortText: "Most G", // Used for short displays such as on the Comparison tab.
		wordedText: "most scored for team", // Used for chatbot responses
		statFormat: "String",
		description: "The Dorkinians team that the player has scored the most for.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 0,
		statCategory: "Appearance Stat",
		iconName: "MostScoredForTeam-Icon",
	},
	// Team Stats
	TeamGamesPlayed: {
		statName: "gamesPlayed",
		displayText: "Games Played",
		shortText: "Games",
		wordedText: "games played",
		statFormat: "Integer",
		description: "The total number of games played by the team.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Appearance-Icon",
	},
	TeamWins: {
		statName: "wins",
		displayText: "Wins",
		shortText: "W",
		wordedText: "wins",
		statFormat: "Integer",
		description: "The total number of wins achieved by the team.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Goals-Icon",
	},
	TeamDraws: {
		statName: "draws",
		displayText: "Draws",
		shortText: "D",
		wordedText: "draws",
		statFormat: "Integer",
		description: "The total number of draws achieved by the team.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Assists-Icon",
	},
	TeamLosses: {
		statName: "losses",
		displayText: "Losses",
		shortText: "L",
		wordedText: "losses",
		statFormat: "Integer",
		description: "The total number of losses suffered by the team.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Conceded-Icon",
	},
	TeamGoalsScored: {
		statName: "goalsScored",
		displayText: "Goals Scored",
		shortText: "GS",
		wordedText: "goals scored",
		statFormat: "Integer",
		description: "The total number of goals scored by the team.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Goals-Icon",
	},
	TeamGoalsConceded: {
		statName: "goalsConceded",
		displayText: "Goals Conceded",
		shortText: "GC",
		wordedText: "goals conceded",
		statFormat: "Integer",
		description: "The total number of goals conceded by the team.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Conceded-Icon",
	},
	TeamGoalDifference: {
		statName: "goalDifference",
		displayText: "Goal Difference",
		shortText: "GD",
		wordedText: "goal difference",
		statFormat: "Integer",
		description: "The goal difference (goals scored minus goals conceded) for the team.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Goals-Icon",
	},
	TeamCleanSheets: {
		statName: "cleanSheets",
		displayText: "Clean Sheets",
		shortText: "CS",
		wordedText: "clean sheets",
		statFormat: "Integer",
		description: "The total number of clean sheets achieved by the team.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "CleanSheet-Icon",
	},
	TeamWinPercentage: {
		statName: "winPercentage",
		displayText: "Win Percentage",
		shortText: "Win %",
		wordedText: "win percentage",
		statFormat: "Percentage",
		description: "The percentage of games won by the team.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Goals-Icon",
	},
	TeamPointsPerGame: {
		statName: "pointsPerGame",
		displayText: "Points Per Game",
		shortText: "PPG",
		wordedText: "points per game",
		statFormat: "Decimal2",
		description: "The average points per game achieved by the team (3 for win, 1 for draw, 0 for loss).",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 2,
		statCategory: "Team Stat",
		iconName: "Goals-Icon",
	},
	TeamGoalsPerGame: {
		statName: "goalsPerGame",
		displayText: "Goals Per Game",
		shortText: "GPG",
		wordedText: "goals per game",
		statFormat: "Decimal2",
		description: "The average number of goals scored per game by the team.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 2,
		statCategory: "Team Stat",
		iconName: "Goals-Icon",
	},
	TeamGoalsConcededPerGame: {
		statName: "goalsConcededPerGame",
		displayText: "Goals Conceded Per Game",
		shortText: "GC/G",
		wordedText: "goals conceded per game",
		statFormat: "Decimal2",
		description: "The average number of goals conceded per game by the team.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 2,
		statCategory: "Team Stat",
		iconName: "Conceded-Icon",
	},
	TeamHomeGames: {
		statName: "homeGames",
		displayText: "Home Games",
		shortText: "Home",
		wordedText: "home games",
		statFormat: "Integer",
		description: "The total number of home games played by the team.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Appearance-Icon",
	},
	TeamHomeWins: {
		statName: "homeWins",
		displayText: "Home Wins",
		shortText: "HW",
		wordedText: "home wins",
		statFormat: "Integer",
		description: "The total number of home wins achieved by the team.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Goals-Icon",
	},
	TeamHomeWinPercentage: {
		statName: "homeWinPercentage",
		displayText: "Home Win Percentage",
		shortText: "H Win %",
		wordedText: "home win percentage",
		statFormat: "Percentage",
		description: "The percentage of home games won by the team.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Goals-Icon",
	},
	TeamAwayGames: {
		statName: "awayGames",
		displayText: "Away Games",
		shortText: "Away",
		wordedText: "away games",
		statFormat: "Integer",
		description: "The total number of away games played by the team.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Appearance-Icon",
	},
	TeamAwayWins: {
		statName: "awayWins",
		displayText: "Away Wins",
		shortText: "AW",
		wordedText: "away wins",
		statFormat: "Integer",
		description: "The total number of away wins achieved by the team.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Goals-Icon",
	},
	TeamAwayWinPercentage: {
		statName: "awayWinPercentage",
		displayText: "Away Win Percentage",
		shortText: "A Win %",
		wordedText: "away win percentage",
		statFormat: "Percentage",
		description: "The percentage of away games won by the team.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Goals-Icon",
	},
	TeamNumberOfSeasons: {
		statName: "numberOfSeasons",
		displayText: "Number of Seasons",
		shortText: "# Seasons",
		wordedText: "number of seasons",
		statFormat: "Integer",
		description: "The number of seasons the team has played in.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Team Stat",
		iconName: "Appearance-Icon",
	},
};

// Stats Page Configuration
// Defines which stats to display and which filters are available for each stats sub-page
export const statsPageConfig = {
	"player-stats": {
		statsToDisplay: [
			"APP",
			"MIN",
			"MOM",
			"AllGSC",
			"G",
			"A",
			"Y",
			"R",
			"SAVES",
			"OG",
			"C",
			"CLS",
			"PSC",
			"PM",
			"PCO",
			"PSV",
			"FTP",
			"GI",
			"GperAPP",
			"CperAPP",
			"MperG",
			"MperCLS",
			"FTPperAPP",
			"MINperAPP",
			"DIST",
			"Games%Won",
			"PlayerPointsPerGame",
			"HomeGames",
			"HomeWins",
			"HomeGames%Won",
			"AwayGames",
			"AwayWins",
			"AwayGames%Won",
			"MostPlayedForTeam",
			"NumberTeamsPlayedFor",
			"NumberSeasonsPlayedFor",
			"MostScoredForTeam",
		],
		availableFilters: ["timeRange", "team", "location", "opposition", "competition", "result", "position"],
	},
	"club-stats": {
		statsToDisplay: [
			"TeamGamesPlayed",
			"TeamWins",
			"TeamDraws",
			"TeamLosses",
			"TeamGoalsScored",
			"TeamGoalsConceded",
			"TeamGoalDifference",
			"TeamCleanSheets",
			"TeamWinPercentage",
			"TeamPointsPerGame",
			"TeamGoalsPerGame",
			"TeamGoalsConcededPerGame",
			"TeamHomeGames",
			"TeamHomeWins",
			"TeamHomeWinPercentage",
			"TeamAwayGames",
			"TeamAwayWins",
			"TeamAwayWinPercentage",
			"TeamNumberOfSeasons",
		],
		availableFilters: ["timeRange", "team", "location", "opposition", "competition", "result"],
	},
	"comparison": {
		statsToDisplay: [
			"APP",
			"MIN",
			"MOM",
			"AllGSC",
			"G",
			"A",
			"Y",
			"R",
			"SAVES",
			"OG",
			"C",
			"CLS",
			"PSC",
			"PM",
			"PCO",
			"PSV",
			"FTP",
			"GI",
			"GperAPP",
			"CperAPP",
			"MperG",
			"MperCLS",
			"FTPperAPP",
			"MINperAPP",
			"MOMperAPP",
			"YperAPP",
			"RperAPP",
			"SAVESperAPP",
			"OGperAPP",
			"CLSperAPP",
			"PSCperAPP",
			"PMperAPP",
			"PCOperAPP",
			"PSVperAPP",
			"DIST",
			"Games%Won",
			"HomeGames",
			"HomeWins",
			"HomeGames%Won",
			"AwayGames",
			"AwayWins",
			"AwayGames%Won",
			"MostPlayedForTeam",
			"NumberTeamsPlayedFor",
			"NumberSeasonsPlayedFor",
			"MostScoredForTeam",
		],
		availableFilters: ["timeRange", "team", "location", "opposition", "competition", "result", "position"],
	},
} as const;

// Test Configuration Interface
export interface TestConfig {
	key: string;
	metric: string;
	questionTemplate: string;
	responsePattern: RegExp;
	description: string;
}

// Comprehensive test configurations for chatbot testing
export const STAT_TEST_CONFIGS: TestConfig[] = [
	{
		key: "APP",
		metric: "appearances",
		questionTemplate: "How many appearances has {playerName} made?",
		responsePattern: /(\d+)/,
		description: "Appearances",
	},
	{
		key: "MIN",
		metric: "minutes",
		questionTemplate: "How many minutes of football has {playerName} played?",
		responsePattern: /(\d+)/,
		description: "Minutes",
	},
	{
		key: "MOM",
		metric: "mom",
		questionTemplate: "How many MoMs has {playerName} received?",
		responsePattern: /(\d+)/,
		description: "Man of the Match awards",
	},
	{
		key: "G",
		metric: "goals",
		questionTemplate: "How many goals has {playerName} scored from open play?",
		responsePattern: /(\d+)/,
		description: "Goals",
	},
	{
		key: "A",
		metric: "assists",
		questionTemplate: "How many assists has {playerName} achieved?",
		responsePattern: /(\d+)/,
		description: "Assists",
	},
	{
		key: "Y",
		metric: "yellowCards",
		questionTemplate: "How many yellow cards has {playerName} received?",
		responsePattern: /(\d+)/,
		description: "Yellow Cards",
	},
	{
		key: "R",
		metric: "redCards",
		questionTemplate: "How many red cards has {playerName} received?",
		responsePattern: /(\d+)/,
		description: "Red Cards",
	},
	{
		key: "SAVES",
		metric: "saves",
		questionTemplate: "How many saves has {playerName} made?",
		responsePattern: /(\d+)/,
		description: "Saves",
	},
	{
		key: "OG",
		metric: "ownGoals",
		questionTemplate: "How many own goals has {playerName} scored?",
		responsePattern: /(\d+)/,
		description: "Own Goals",
	},
	{
		key: "C",
		metric: "conceded",
		questionTemplate: "How many goals has {playerName} conceded?",
		responsePattern: /(\d+)/,
		description: "Goals Conceded",
	},
	{
		key: "CLS",
		metric: "cleanSheets",
		questionTemplate: "How many clean sheets has {playerName} achieved?",
		responsePattern: /(\d+)/,
		description: "Clean Sheets",
	},
	{
		key: "PSC",
		metric: "penaltiesScored",
		questionTemplate: "How many penalties has {playerName} scored?",
		responsePattern: /(\d+)/,
		description: "Penalties Scored",
	},
	{
		key: "PM",
		metric: "penaltiesMissed",
		questionTemplate: "How many penalties has {playerName} missed?",
		responsePattern: /(\d+)/,
		description: "Penalties Missed",
	},
	{
		key: "PCO",
		metric: "penaltiesConceded",
		questionTemplate: "How many penalties has {playerName} conceded?",
		responsePattern: /(\d+)/,
		description: "Penalties Conceded",
	},
	{
		key: "PSV",
		metric: "penaltiesSaved",
		questionTemplate: "How many penalties has {playerName} saved?",
		responsePattern: /(\d+)/,
		description: "Penalties Saved",
	},
	{
		key: "FTP",
		metric: "fantasyPoints",
		questionTemplate: "How many fantasy points does {playerName} have?",
		responsePattern: /(-?\d+)/,
		description: "Fantasy Points",
	},
	// Advanced Statistics
	{
		key: "AllGSC",
		metric: "allGoals",
		questionTemplate: "How many goals has {playerName} scored?",
		responsePattern: /(\d+)/,
		description: "All Goals Scored",
	},
	{
		key: "GperAPP",
		metric: "goalsPerAppearance",
		questionTemplate: "How many goals on average has {playerName} scored per appearance?",
		responsePattern: /(\d+(?:\.\d+)?)/,
		description: "Goals per Appearance",
	},
	{
		key: "CperAPP",
		metric: "concededPerAppearance",
		questionTemplate: "How many goals on average does {playerName} concede per match?",
		responsePattern: /(\d+(?:\.\d+)?)/,
		description: "Goals Conceded per Appearance",
	},
	{
		key: "MperG",
		metric: "minutesPerGoal",
		questionTemplate: "How many minutes does it take on average for {playerName} to score?",
		responsePattern: /(\d+(?:\.\d+)?)/,
		description: "Minutes per Goal",
	},
	{
		key: "MperCLS",
		metric: "minutesPerCleanSheet",
		questionTemplate: "On average, how many minutes does {playerName} need to get a clean sheet?",
		responsePattern: /(\d+(?:\.\d+)?)/,
		description: "Minutes per Clean Sheet",
	},
	{
		key: "FTPperAPP",
		metric: "fantasyPointsPerAppearance",
		questionTemplate: "How many fantasy points does {playerName} score per appearance?",
		responsePattern: /(-?\d+(?:\.\d+)?)/,
		description: "Fantasy Points per Appearance",
	},
	{
		key: "DIST",
		metric: "distance",
		questionTemplate: "How far has {playerName} travelled to get to games?",
		responsePattern: /(\d+(?:\.\d+)?)/,
		description: "Distance Travelled",
	},
	// Home/Away Statistics
	{
		key: "HomeGames",
		metric: "homeGames",
		questionTemplate: "How many home games has {playerName} played?",
		responsePattern: /(\d+)/,
		description: "Home Games",
	},
	{
		key: "HomeWins",
		metric: "homeWins",
		questionTemplate: "How many home games has {playerName} won?",
		responsePattern: /(\d+)/,
		description: "Home Wins",
	},
	{
		key: "HomeGames%Won",
		metric: "homeGamesPercentWon",
		questionTemplate: "What percentage of home games has {playerName} won?",
		responsePattern: /(\d+(?:\.\d+)?)/,
		description: "Home Games % Won",
	},
	{
		key: "AwayGames",
		metric: "awayGames",
		questionTemplate: "How many away games has {playerName} played?",
		responsePattern: /(\d+)/,
		description: "Away Games",
	},
	{
		key: "AwayWins",
		metric: "awayWins",
		questionTemplate: "How many away games have {playerName} won?",
		responsePattern: /(\d+)/,
		description: "Away Wins",
	},
	{
		key: "AwayGames%Won",
		metric: "awayGamesPercentWon",
		questionTemplate: "What percent of away games has {playerName} won?",
		responsePattern: /(\d+(?:\.\d+)?)/,
		description: "Away Games % Won",
	},
	{
		key: "Games%Won",
		metric: "gamesPercentWon",
		questionTemplate: "What % of games has {playerName} won?",
		responsePattern: /(\d+(?:\.\d+)?)/,
		description: "Games % Won",
	},
	// Team-Specific Appearances
	{
		key: "1sApps",
		metric: "firstTeamApps",
		questionTemplate: "How many appearances has {playerName} made for the 1s?",
		responsePattern: /(\d+)/,
		description: "1st Team Appearances",
	},
	{
		key: "2sApps",
		metric: "secondTeamApps",
		questionTemplate: "How many apps has {playerName} made for the 2s?",
		responsePattern: /(\d+)/,
		description: "2nd Team Appearances",
	},
	{
		key: "3sApps",
		metric: "thirdTeamApps",
		questionTemplate: "How many times has {playerName} played for the 3s?",
		responsePattern: /(\d+)/,
		description: "3rd Team Appearances",
	},
	{
		key: "4sApps",
		metric: "fourthTeamApps",
		questionTemplate: "What is the appearance count for {playerName} playing for the 4s?",
		responsePattern: /(\d+)/,
		description: "4th Team Appearances",
	},
	{
		key: "5sApps",
		metric: "fifthTeamApps",
		questionTemplate: "How many games for the 5s has {playerName} played?",
		responsePattern: /(\d+)/,
		description: "5th Team Appearances",
	},
	{
		key: "6sApps",
		metric: "sixthTeamApps",
		questionTemplate: "How many appearances for the 6s has {playerName} made?",
		responsePattern: /(\d+)/,
		description: "6th Team Appearances",
	},
	{
		key: "7sApps",
		metric: "seventhTeamApps",
		questionTemplate: "How many apps for the 7s has {playerName} achieved?",
		responsePattern: /(\d+)/,
		description: "7th Team Appearances",
	},
	{
		key: "8sApps",
		metric: "eighthTeamApps",
		questionTemplate: "Provide me with {playerName} appearance count for the 8s.",
		responsePattern: /(\d+)/,
		description: "8th Team Appearances",
	},
	{
		key: "MostPlayedForTeam",
		metric: "mostPlayedForTeam",
		questionTemplate: "What team has {playerName} made the most appearances for?",
		responsePattern: /has made the most appearances for the (\d+s)/,
		description: "Most Played For Team",
	},
	{
		key: "NumberTeamsPlayedFor",
		metric: "numberTeamsPlayedFor",
		questionTemplate: "How many of the clubs teams has {playerName} played for?",
		responsePattern: /(\d+\/\d+)/,
		description: "Number of Teams Played For",
	},
	// Team-Specific Goals
	{
		key: "1sGoals",
		metric: "firstTeamGoals",
		questionTemplate: "How many goals has {playerName} scored for the 1s?",
		responsePattern: /(\d+)/,
		description: "1st Team Goals",
	},
	{
		key: "2sGoals",
		metric: "secondTeamGoals",
		questionTemplate: "What is the goal count of {playerName} for the 2nd team?",
		responsePattern: /(\d+)/,
		description: "2nd Team Goals",
	},
	{
		key: "3sGoals",
		metric: "thirdTeamGoals",
		questionTemplate: "How many goals in total has {playerName} scored for the 3s?",
		responsePattern: /(\d+)/,
		description: "3rd Team Goals",
	},
	{
		key: "4sGoals",
		metric: "fourthTeamGoals",
		questionTemplate: "How many goals have I scored for the 4s?",
		responsePattern: /(\d+)/,
		description: "4th Team Goals",
	},
	{
		key: "5sGoals",
		metric: "fifthTeamGoals",
		questionTemplate: "How many goals has {playerName} scored for the 5th XI?",
		responsePattern: /(\d+)/,
		description: "5th Team Goals",
	},
	{
		key: "6sGoals",
		metric: "sixthTeamGoals",
		questionTemplate: "What are the goal stats for {playerName} for the 6s?",
		responsePattern: /(\d+)/,
		description: "6th Team Goals",
	},
	{
		key: "7sGoals",
		metric: "seventhTeamGoals",
		questionTemplate: "How many goals have {playerName} got for the 7s?",
		responsePattern: /(\d+)/,
		description: "7th Team Goals",
	},
	{
		key: "8sGoals",
		metric: "eighthTeamGoals",
		questionTemplate: "How many goals has {playerName} scored for the 8s?",
		responsePattern: /(\d+)/,
		description: "8th Team Goals",
	},
	{
		key: "MostScoredForTeam",
		metric: "mostScoredForTeam",
		questionTemplate: "Which team has {playerName} scored the most goals for?",
		responsePattern: /has scored the most goals for the (\d+s)/,
		description: "Most Scored For Team",
	},
	// Seasonal Appearances
	{
		key: "2016/17Apps",
		metric: "season2016_17Apps",
		questionTemplate: "How many appearances did {playerName} make in the 2016/17 season?",
		responsePattern: /(\d+)/,
		description: "2016/17 Season Appearances",
	},
	{
		key: "2017/18Apps",
		metric: "season2017_18Apps",
		questionTemplate: "How many apps did {playerName} make in 2017/18?",
		responsePattern: /(\d+)/,
		description: "2017/18 Season Appearances",
	},
	{
		key: "2018/19Apps",
		metric: "season2018_19Apps",
		questionTemplate: "How many games did {playerName} play in in 2018-19?",
		responsePattern: /(\d+)/,
		description: "2018/19 Season Appearances",
	},
	{
		key: "2019/20Apps",
		metric: "season2019_20Apps",
		questionTemplate: "How many apps did {playerName} have in 2019/20?",
		responsePattern: /(\d+)/,
		description: "2019/20 Season Appearances",
	},
	{
		key: "2020/21Apps",
		metric: "season2020_21Apps",
		questionTemplate: "How many games did {playerName} appear in in 2020/21?",
		responsePattern: /(\d+)/,
		description: "2020/21 Season Appearances",
	},
	{
		key: "2021/22Apps",
		metric: "season2021_22Apps",
		questionTemplate: "How many appearances did {playerName} make in 2021 to 2022?",
		responsePattern: /(\d+)/,
		description: "2021/22 Season Appearances",
	},
	{
		key: "NumberSeasonsPlayedFor",
		metric: "numberSeasonsPlayedFor",
		questionTemplate: "How many seasons has {playerName} played in?",
		responsePattern: /(\d+)/,
		description: "Number of Seasons Played For",
	},
	// Seasonal Goals
	{
		key: "2016/17Goals",
		metric: "season2016_17Goals",
		questionTemplate: "How many goals did {playerName} score in the 2016/17 season?",
		responsePattern: /(\d+)/,
		description: "2016/17 Season Goals",
	},
	{
		key: "2017/18Goals",
		metric: "season2017_18Goals",
		questionTemplate: "How many goals did {playerName} score in the 2017-18 season?",
		responsePattern: /(\d+)/,
		description: "2017/18 Season Goals",
	},
	{
		key: "2018/19Goals",
		metric: "season2018_19Goals",
		questionTemplate: "How many goals did {playerName} get in the 2018/2019 season?",
		responsePattern: /(\d+)/,
		description: "2018/19 Season Goals",
	},
	{
		key: "2019/20Goals",
		metric: "season2019_20Goals",
		questionTemplate: "How many goals did {playerName} score in 2019/20?",
		responsePattern: /(\d+)/,
		description: "2019/20 Season Goals",
	},
	{
		key: "2020/21Goals",
		metric: "season2020_21Goals",
		questionTemplate: "How many goals did {playerName} score in the 20/21 season?",
		responsePattern: /(\d+)/,
		description: "2020/21 Season Goals",
	},
	{
		key: "2021/22Goals",
		metric: "season2021_22Goals",
		questionTemplate: "How many goals did {playerName} score in 21/22?",
		responsePattern: /(\d+)/,
		description: "2021/22 Season Goals",
	},
	{
		key: "MostProlificSeason",
		metric: "mostProlificSeason",
		questionTemplate: "What was {playerName}'s most prolific season?",
		responsePattern: /([A-Za-z0-9\-\/]+)/,
		description: "Most Prolific Season",
	},
	// Positional Statistics
	{
		key: "GK",
		metric: "goalkeeperApps",
		questionTemplate: "How many times has {playerName} played as a goalkeeper?",
		responsePattern: /(\d+)/,
		description: "Goalkeeper Appearances",
	},
	{
		key: "DEF",
		metric: "defenderApps",
		questionTemplate: "How many games has {playerName} played as a defender?",
		responsePattern: /(\d+)/,
		description: "Defender Appearances",
	},
	{
		key: "MID",
		metric: "midfielderApps",
		questionTemplate: "How many times has {playerName} been a midfielder?",
		responsePattern: /(\d+)/,
		description: "Midfielder Appearances",
	},
	{
		key: "FWD",
		metric: "forwardApps",
		questionTemplate: "How many games has {playerName} been a forward?",
		responsePattern: /(\d+)/,
		description: "Forward Appearances",
	},
	{
		key: "MostCommonPosition",
		metric: "mostCommonPosition",
		questionTemplate: "What is {playerName}'s most common position played?",
		responsePattern: /([A-Za-z]+)/,
		description: "Most Common Position",
	},
];

export default homepageQuestions;
