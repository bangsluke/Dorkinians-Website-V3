export const appConfig = {
	version: "3.0.0",
	name: "Dorkinians FC",
	description: "Comprehensive source for club statistics, player performance, and team insights",
	author: "Luke Bangs",
	contact: "bangsluke@gmail.com",
	forceSkeletonView: false,
	documentationUrl: "https://bangsluke-documentation.netlify.app/docs/projects/dorkinians-website",
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
		id: "most-played-with",
		question: "Who have I played the most games with?",
		description: "See which players you've appeared with most often",
		category: "player",
	},
	{
		id: "most-opposition",
		question: "What opposition have I played against the most?",
		description: "See which teams you've faced most frequently",
		category: "player",
	},
	{
		id: "longest-streak",
		question: "What's the longest consecutive streak of weekends that I've played in a row?",
		description: "See how many consecutive weekends you've played in a row",
		category: "player",
	},
	{
		id: "full-stats",
		question: "What are my full stats?",
		description: "View your complete player statistics",
		category: "player",
	},
];

// All example questions from TBL_TestQuestions CSV
export const allExampleQuestions: string[] = [
	"How many goals have I scored for the 3rd team?",
	"Where did the 2s finish in the 2017/18 season?",
	"What was the highest scoring game that the 1s had in the 2020-2021 season?",
	"How many games have I played with Oli Goddard?",
	"What's the longest consecutive streak of weekends that I've played in a row?",
	"Who did the fourth team play on the first weekend of 2023?",
	"How many double game weeks have I played?",
	"How many clean sheets have I had in a row?",
	"Who will reach the next 100 goal milestone?",
	"How many times have I been in Team of the Week?",
	"What's the highest score I have had in a week?",
	"How many consecutive games have I scored/assisted/had a goal involvement?",
	"How many goals did the 2nd team score during the 2017/18 season?",
	"Which team has conceded the fewest goals in history?",
	"How many awards have I won?",
	"What player have I played with most whilst playing in the 3s?",
	"How many times have I played Old Hamptonians?",
	"How many goals has Craig Kingswell scored in the Premier?",
	"How many assists has Oli Goddard managed at Pixham?",
	"What team have I played for most?",
	"How many penalties has Matt Morley taken?",
	"What is Max Ridler's penalty record?",
	"What is James Whitmarsh's penalty conversion rate?",
	"How many goals have I scored away from home?",
	"Have I played more home or away games?",
	"What percentage of away games have I won?",
	"How many goals have Matt Evans and Ol Wayne got whilst playing together?",
	"How many assists has Arron Oakley got when not playing for the 3s?",
	"Who was the top player in January 2023?",
	"Who made TOTW in the first week of February 2017?",
	"How many games did the 3s play in the 2016/17 season?",
	"How many times has Henry Warne played since 2020?",
	"How many goals did Sam Slade score between 19/08/2017 and 16/09/2019?",
	"How many assists did Charlie Woodman make before the 2020/21 season?",
	"What opposition have I scored the most goals against?",
	"Who has scored the most penalties for the 4s?",
	"Who has the worst penalty record for the 2s?",
	"What is my scoring record for the 5s?",
	"Which was my highest scoring season?",
	"In which season did Oli Goddard score the most goals for the 2s?",
	"How many goals has Sam Slade got for the 4s whilst playing at home between 20/03/2022 and 21/10/24?",
	"Which opposition have I played the most games against?",
	"What player has the most consecutive games played",
	"How many leagues have I won?",
	"How many players have I played with?",
	"Which player have I played the most games with?",
	"What position are the 4s currently?",
	"What position did the 5th XI finish in 2018/19?",
	"What was the 4s goal difference in 2020/21?",
	"Who did I play with most in the 2016/17 season for the 5s?",
	"How many goals have I scored in cup competitions only?",
	"How many assists did I get in games we lost?",
	"Which season did the 3s concede the most goals?",
	"What was the longest unbeaten run the 1s had between 2015 and 2020?",
	"How many players scored 5+ goals for the 2s in the 2022/23 season?",
	"What position is my highest league finish?",
	"Which team had the best defensive record in the 2020/21 season?",
	"How many hattricks have I scored?",
	"How many hat‑tricks were scored across all teams in 2022?",
	"Which player has the highest goal‑per‑game ratio in club history?",
	"Which player has the highest goal‑per‑game ratio who has played more than 5 games?",
	"How many games have I played where both Sam Slade and Shane Tanner also played?",
	"What is the longest run of games where I had no goal involvements?",
	"Who has the most goals for the club?",
	"Which player has the most assists?",
	"What is the highest number of goals a player has scored in one game?",
	"How many hattricks were scored in 2023 by the 1s?",
	"What is my longest goal scoring streak?",
	"What is my longest assisting run of games?",
	"Which season did I play the most minutes?",
	"How many yellow cards have I received?",
	"How many times have I been sent off?",
	"Which season did I record my highest combined goals + assists total?",
	"How many games have I played in cup competitions?",
	"Which season did I appear in the most matches?",
	"How many goals have I scored in matches played on Sundays only?",
	"Which month across my career has the highest total goal involvements?",
	"How many times have I scored or assisted in a game where the team kept a clean sheet?",
	"Which team used the most players in the 2018/19 season?",
	"How many total goals were scored across all teams in 2020?",
	"How many penalties have been scored in penalty shootouts?",
	"What number of penalties have been missed in shootouts?",
	"Which team had the longest unbeaten run in 2022?",
	"How many games have I played where the team conceded 6+ goals?",
	"Which team had the highest average goals per game in 2021/22?",
	"How many clean sheets occurred in games where I played with Lee Shipp?",
	"How many goals did the 3s concede in away games between 2018 and 2020?",
	"Which player have I shared the pitch with in the most cup games?",
	"How many games have I played and scored where the team won by exactly one goal?",
	"Which player have I had the highest win percentage with?",
	"How many games did the 4s play between 01/09/2019 and 01/03/2020?",
	"How many assists did I make in home games during 2023?",
	"How many appearances did I make on Saturdays in 2022?",
	"How many goals were scored across all teams in December 2023?",
	"Which player had the most assists in the 2020/21 season?",
	"Which season did the club record the most total wins across all teams?",
	"How many seasons have I played where I didn't score any goals?",
	"How many players have played only one game for the 5s?",
	"Which player appeared in the most games in 2022/23?",
	"How many games have I played where the team scored zero goals?",
	"How many seasons did the 4s finish with a negative goal difference?",
	"Which player had the most clean‑sheet appearances in 2021/22?",
	"How many players have scored exactly one goal in club history?",
	"What's the most goals we've scored in a game when I was playing?",
	"How many goals did I get last season?",
	"Which team have I kept the most clean sheets against?",
	"Who is in the team of the season?",
	"How many times have I been the team of the season?"
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
		id: "documentation",
		title: "Help",
		url: "https://bangsluke-documentation.netlify.app/docs/projects/dorkinians-website",
		description: "Complete user guide and documentation for the Dorkinians Website",
		category: "other",
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
	| "milestone"
	| "season_totw"
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
		visualizationType: "Chart",
	},
	league_table: {
		displayName: "League Table",
		description: "Questions about league positions and standings",
		hasVisualization: true,
		visualizationType: "Table",
	},
	milestone: {
		displayName: "Milestone Queries",
		description: "Questions about players closest to reaching milestones",
		hasVisualization: true,
		visualizationType: "NumberCard",
	},
	season_totw: {
		displayName: "Team of the Season",
		description: "Questions about team of the season selections and awards",
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
export type VisualizationType = "NumberCard" | "Table" | "Calendar" | "Chart";

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
	Chart: {
		displayName: "Chart Display",
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
		iconName: "Open-Play-Goals-Icon",
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
		iconName: "Saves-Icon",
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
	PenConversionRate: {
		statName: "penaltyConversionRate",
		displayText: "Penalty Conversion Rate", // The text displayed at all times on the page.
		shortText: "Pen Conv %", // Used for short displays such as on the Comparison tab.
		wordedText: "penalty conversion rate", // Used for chatbot responses
		statFormat: "Percentage",
		description: "The percentage of penalties successfully converted (scored / (scored + missed) * 100).",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 1,
		statCategory: "Penalty Stat",
		iconName: "PenaltyConversionRate-Icon"
	},
	'PS-PSC': {
		statName: "penaltyShootoutPenaltiesScored",
		displayText: "Penalties Scored in a Penalty Shootout", // The text displayed at all times on the page.
		shortText: "PS-PSC", // Used for short displays such as on the Comparison tab.
		wordedText: "penalties scored in a penalty shootout", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of penalties scored by the player in a penalty shootout.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Penalty Stat",
		iconName: "PenaltiesScored-Icon",
	},
	'PS-PM': {
		statName: "penaltyShootoutPenaltiesMissed",
		displayText: "Penalties Missed in a Penalty Shootout", // The text displayed at all times on the page.
		shortText: "PS-PM", // Used for short displays such as on the Comparison tab.
		wordedText: "penalties missed in a penalty shootout", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of penalties missed by the player in a penalty shootout.",
		statHigherBetterBoolean: false,
		numberDecimalPlaces: 0,
		statCategory: "Penalty Stat",
		iconName: "PenaltyShootoutPenaltiesMissed-Icon",
	},
	'PS-PSV': {
		statName: "penaltyShootoutPenaltiesSaved",
		displayText: "Penalties Saved in a Penalty Shootout", // The text displayed at all times on the page.
		shortText: "PS-PSV", // Used for short displays such as on the Comparison tab.
		wordedText: "penalties saved in a penalty shootout", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of penalties saved by the player in a penalty shootout.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Penalty Stat",
		iconName: "PenaltyShootoutPenaltiesSaved-Icon",
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
	GIperAPP: {
		statName: "goalInvolvementsPerApp",
		displayText: "Goal Involvement Per Appearance", // The text displayed at all times on the page.
		shortText: "GIperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "goal involvement per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of goal involvements (goals + assists) per appearance by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 2,
		statCategory: "Per App/Minute Stat",
		iconName: "GoalInvolvementsPerAppearance-Icon",
	},
	GperAPP: {
		statName: "goalsPerApp",
		displayText: "Goals Per Appearance", // The text displayed at all times on the page.
		shortText: "GperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "goals per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of goals scored per appearance by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 2,
		statCategory: "Per App/Minute Stat",
		iconName: "GoalsPerAppearance-Icon",
	},
	AperAPP: {
		statName: "assistsPerApp",
		displayText: "Assists Per Appearance", // The text displayed at all times on the page.
		shortText: "AperApp", // Used for short displays such as on the Comparison tab.
		wordedText: "assists per appearance", // Used for chatbot responses
		statFormat: "Decimal2",
		description: "The average number of assists provided per appearance by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 2,
		statCategory: "Per App/Minute Stat",
		iconName: "AssistsPerAppearance-Icon",
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
		statName: "gamesPercentWon",
		displayText: "% Games Won", // The text displayed at all times on the page.
		shortText: "% Won", // Used for short displays such as on the Comparison tab.
		wordedText: "games won", // Used for chatbot responses
		statFormat: "Percentage",
		description: "The percentage of games won by the player.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 1,
		statCategory: "Results Stat",
		iconName: "PercentageGamesWon-Icon"
	},
	WinRateWhenScoring: {
		statName: "winRateWhenScoring",
		displayText: "Win Rate When Scoring", // The text displayed at all times on the page.
		shortText: "Win % When G", // Used for short displays such as on the Comparison tab.
		wordedText: "win rate when scoring", // Used for chatbot responses
		statFormat: "Percentage",
		description: "The percentage of games won when the player scored at least one goal.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 1,
		statCategory: "Results Stat",
		iconName: "WinRateWhenScoring-Icon"
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
		iconName: "PointsPerGame-Icon",
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
	OPP: {
		statName: "oppositionPlayed",
		displayText: "Opposition played", // The text displayed at all times on the page.
		shortText: "Opp", // Used for short displays such as on the Comparison tab.
		wordedText: "opposition played", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of different opposition teams the player has played against.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Appearance Stat",
		iconName: "Opposition-Icon",
	},
	COMP: {
		statName: "competitionsCompeted",
		displayText: "Competitions competed", // The text displayed at all times on the page.
		shortText: "Comp", // Used for short displays such as on the Comparison tab.
		wordedText: "competitions competed in", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of different competitions the player has competed in.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Appearance Stat",
		iconName: "Competition-Icon",
	},
	TEAM: {
		statName: "teammatesPlayedWith",
		displayText: "Teammates played with", // The text displayed at all times on the page.
		shortText: "Teammates", // Used for short displays such as on the Comparison tab.
		wordedText: "teammates played with", // Used for chatbot responses
		statFormat: "Integer",
		description: "The number of different teammates the player has played with.",
		statHigherBetterBoolean: true,
		numberDecimalPlaces: 0,
		statCategory: "Appearance Stat",
		iconName: "Teammates-Icon",
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
		iconName: "TeamAppearance-Icon",
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
		iconName: "Win-Icon",
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
		iconName: "Draws-Icon",
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
		iconName: "Loss-Icon",
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
		iconName: "GoalDifference-Icon",
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
		iconName: "PercentageGamesWon-Icon",
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
		iconName: "PointsPerGame-Icon",
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
		iconName: "GoalsPerAppearance-Icon",
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
		iconName: "ConcededPerAppearance-Icon",
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
		iconName: "HomeGames-Icon",
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
		iconName: "HomeWins-Icon",
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
		iconName: "PercentageHomeGamesWon-Icon",
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
		iconName: "AwayGames-Icon",
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
		iconName: "AwayWins-Icon",
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
		iconName: "PercentageAwayGamesWon-Icon",
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
		iconName: "NumberSeasonsPlayedFor-Icon",
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
			"AperAPP",
			"Y",
			"R",
			"SAVES",
			"OG",
			"C",
			"CLS",
			"PSC",
			"PM",
			"PenConversionRate",
			"PCO",
			"PSV",
			"PS-PSC",
			"PS-PM",
			"PS-PSV",
			"FTP",
			"GI",
			"GIperAPP",
			"GperAPP",
			"CperAPP",
			"MperG",
			"MperCLS",
			"FTPperAPP",
			"MINperAPP",
			"DIST",
			"Games%Won",
			"WinRateWhenScoring",
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
			"OPP",
			"COMP",
			"TEAM",
		],
		availableFilters: ["timeRange", "team", "location", "opposition", "competition", "result", "position"],
	},
	"team-stats": {
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
		availableFilters: ["timeRange", "location", "opposition", "competition", "result"],
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
		availableFilters: ["timeRange", "location", "opposition", "competition", "result"],
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
			"PS-PSC",
			"PS-PM",
			"PS-PSV",
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

export default homepageQuestions;
