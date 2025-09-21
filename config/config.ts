export const appConfig = {
	version: "1.1.7",
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
		id: "goals-scored",
		question: "How many goals have I scored?",
		description: "Get your total goal count across all teams and seasons",
		category: "player",
	},
	{
		id: "team-performance",
		question: "How did my team perform this season?",
		description: "View team standings, results, and key statistics",
		category: "team",
	},
	{
		id: "totw-appearances",
		question: "How many times have I been in Team of the Week?",
		description: "Check your Team of the Week appearances and recognition",
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
export type QuestionType = "player" | "team" | "club" | "fixture" | "comparison" | "streak" | "double_game" | "temporal" | "general" | "ranking" | "clarification_needed";

export const questionTypes: Record<QuestionType, { displayName: string; description: string; hasVisualization: boolean; visualizationType?: VisualizationType }> = {
	player: {
		displayName: "Player Statistics",
		description: "Questions about individual player performance and statistics",
		hasVisualization: true,
		visualizationType: "NumberCard"
	},
	team: {
		displayName: "Team Performance",
		description: "Questions about team standings, results, and performance",
		hasVisualization: true,
		visualizationType: "Table"
	},
	club: {
		displayName: "Club Information",
		description: "Questions about club-wide information and general statistics",
		hasVisualization: true,
		visualizationType: "Table"
	},
	fixture: {
		displayName: "Fixture Details",
		description: "Questions about specific matches and fixtures",
		hasVisualization: true,
		visualizationType: "Table"
	},
	comparison: {
		displayName: "Player Comparison",
		description: "Questions comparing multiple players or teams",
		hasVisualization: true,
		visualizationType: "Table"
	},
	streak: {
		displayName: "Streak Analysis",
		description: "Questions about consecutive performances or records",
		hasVisualization: true,
		visualizationType: "Calendar"
	},
	double_game: {
		displayName: "Double Game Weeks",
		description: "Questions about double game week performances",
		hasVisualization: true,
		visualizationType: "NumberCard"
	},
	temporal: {
		displayName: "Time-based Queries",
		description: "Questions about performance over specific time periods",
		hasVisualization: true,
		visualizationType: "Calendar"
	},
	general: {
		displayName: "General Information",
		description: "General questions about the club or football",
		hasVisualization: false
	},
	ranking: {
		displayName: "Rankings & Records",
		description: "Questions about who has the highest/lowest statistics",
		hasVisualization: true,
		visualizationType: "Record"
	},
	clarification_needed: {
		displayName: "Clarification Required",
		description: "Questions that need clarification before processing",
		hasVisualization: false
	}
};

// Visualization type definitions
export type VisualizationType = "NumberCard" | "Table" | "Calendar" | "Record";

export const visualizationTypes: Record<VisualizationType, { displayName: string; description: string; useCase: string }> = {
	NumberCard: {
		displayName: "Number Card",
		description: "Simple numeric display for single values or counts",
		useCase: "Goals scored, appearances, clean sheets, etc."
	},
	Table: {
		displayName: "Data Table",
		description: "Tabular display for multiple records or comparisons",
		useCase: "League tables, player comparisons, team standings, etc."
	},
	Calendar: {
		displayName: "Calendar View",
		description: "Time-based visualization for streaks and temporal data",
		useCase: "Consecutive games, scoring streaks, performance over time, etc."
	},
	Record: {
		displayName: "Record Display",
		description: "Specialized display for records and achievements",
		useCase: "Personal bests, season records, milestone achievements, etc."
	}
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
		statFormat: "Integer",
		description: "The number of fantasy points achieved by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Performance Stat",
		iconName: "FantasyPoints-Icon",
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
		numberDecimalPlaces: 0,
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
		numberDecimalPlaces: 0,
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
		numberDecimalPlaces: 0,
		statCategory: "Results Stat",
		iconName: "PercentageAwayGamesWon-Icon",
		statUnit: "%",
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
};

export default homepageQuestions;
