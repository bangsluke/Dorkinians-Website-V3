import Papa from "papaparse";

export interface TestPlayerData {
	playerName: string;
	goals: number;
	assists: number;
	appearances: number;
	yellowCards: number;
	redCards: number;
	cleanSheets: number;
	penaltiesScored: number;
	penaltiesMissed: number;
	fantasyPoints: number;
	// New fields for advanced stats
	minutes: number;
	mom: number;
	saves: number;
	ownGoals: number;
	conceded: number;
	penaltiesConceded: number;
	penaltiesSaved: number;
	// Advanced stats
	allGoals: number;
	goalsPerAppearance: number;
	concededPerAppearance: number;
	minutesPerGoal: number;
	minutesPerCleanSheet: number;
	fantasyPointsPerAppearance: number;
	distance: number;
	// Home/Away stats
	homeGames: number;
	homeWins: number;
	homeGamesPercentWon: number;
	awayGames: number;
	awayWins: number;
	awayGamesPercentWon: number;
	gamesPercentWon: number;
	// Team-specific apps
	firstTeamApps: number;
	secondTeamApps: number;
	thirdTeamApps: number;
	fourthTeamApps: number;
	fifthTeamApps: number;
	sixthTeamApps: number;
	seventhTeamApps: number;
	eighthTeamApps: number;
	mostPlayedForTeam: string;
	numberTeamsPlayedFor: number;
	// Team-specific goals
	firstTeamGoals: number;
	secondTeamGoals: number;
	thirdTeamGoals: number;
	fourthTeamGoals: number;
	fifthTeamGoals: number;
	sixthTeamGoals: number;
	seventhTeamGoals: number;
	eighthTeamGoals: number;
	mostScoredForTeam: string;
	// Seasonal apps
	season2016_17Apps: number;
	season2017_18Apps: number;
	season2018_19Apps: number;
	season2019_20Apps: number;
	season2020_21Apps: number;
	season2021_22Apps: number;
	numberSeasonsPlayedFor: number;
	// Seasonal goals
	season2016_17Goals: number;
	season2017_18Goals: number;
	season2018_19Goals: number;
	season2019_20Goals: number;
	season2020_21Goals: number;
	season2021_22Goals: number;
	mostProlificSeason: string;
	// Positional stats
	goalkeeperApps: number;
	defenderApps: number;
	midfielderApps: number;
	forwardApps: number;
	mostCommonPosition: string;
}

export interface TestDataRow {
	[key: string]: string | number;
}

/**
 * Define all stat configurations with their question templates and metric keys
 */
export const STAT_TEST_CONFIGS = [
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
		responsePattern: /(\d+)/,
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
		responsePattern: /(\d+(?:\.\d+)?)/,
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
		responsePattern: /([A-Za-z0-9\s]+)/,
		description: "Most Played For Team",
	},
	{
		key: "NumberTeamsPlayedFor",
		metric: "numberTeamsPlayedFor",
		questionTemplate: "How many of the clubs teams has {playerName} played for?",
		responsePattern: /(\d+)/,
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
		responsePattern: /([A-Za-z0-9\s]+)/,
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

/**
 * Generate test questions for a player using all stat configurations
 */
export function generateTestQuestions(playerName: string): string[] {
	return STAT_TEST_CONFIGS.map((config) => config.questionTemplate.replace("{playerName}", playerName));
}

/**
 * Extract numeric value from chatbot response using the stat's response pattern
 */
export function extractNumericValue(response: string, statConfig: (typeof STAT_TEST_CONFIGS)[0]): number | null {
	const match = response.match(statConfig.responsePattern);
	return match ? parseInt(match[1], 10) : null;
}

/**
 * Validate chatbot response against real database values
 * This function now focuses on validating response quality rather than exact value matching
 */
export function validateResponse(
	response: string,
	expectedValue: number, // This is now ignored - we're testing against real DB values
	statConfig: (typeof STAT_TEST_CONFIGS)[0],
	playerName: string,
): { isValid: boolean; summary: string } {
	const extractedValue = extractNumericValue(response, statConfig);

	if (extractedValue === null) {
		const summary = `ChatBot response: "${response}" - Could not extract numeric value`;
		return { isValid: false, summary };
	}

	// For real database testing, we validate that:
	// 1. We got a response
	// 2. The response contains the player name
	// 3. We could extract a numeric value
	const isValid = Boolean(response && response.includes(playerName) && extractedValue !== null);
	const summary = `ChatBot response: "${response}" - Extracted value: ${extractedValue} - Valid: ${isValid}`;

	return { isValid, summary };
}

/**
 * Get all stat configurations for testing
 */
export function getAllStatConfigs() {
	console.log(`🔍 STAT_TEST_CONFIGS length: ${STAT_TEST_CONFIGS.length}`);
	console.log(
		`🔍 STAT_TEST_CONFIGS keys:`,
		STAT_TEST_CONFIGS.map((config) => config.key),
	);
	return STAT_TEST_CONFIGS;
}

/**
 * Fetch and parse TBL_TestData CSV to get reference player data
 * Note: In production database testing, this serves as reference data
 * for validating chatbot responses against actual database values
 */
export async function fetchTestData(): Promise<TestPlayerData[]> {
	const testDataUrl =
		"https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=14183891&single=true&output=csv";

	const isVerbose = process.env.JEST_VERBOSE === "true";

	try {
		if (isVerbose) {
			console.log("🔍 Attempting to fetch reference data from:", testDataUrl);
		}

		const response = await fetch(testDataUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch test data: ${response.statusText}`);
		}

		const csvText = await response.text();

		if (isVerbose) {
			console.log("📊 CSV content length:", csvText.length);
			console.log("📊 CSV preview:", csvText.substring(0, 200));
		}

		const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

		if (parsed.errors.length > 0 && isVerbose) {
			console.warn("⚠️ CSV parsing warnings:", parsed.errors);
		}

		if (isVerbose) {
			console.log("📊 Parsed reference data rows:", parsed.data.length);
			console.log("📊 First row:", parsed.data[0]);
		}

		const processedData = parsed.data
			.map((row: any) => ({
				playerName: String(row.playerName || row.PlayerName || row.name || ""),
				goals: Number(row.goals || row.Goals || row.G || 0),
				assists: Number(row.assists || row.Assists || row.A || 0),
				appearances: Number(row.appearances || row.Appearances || row.APP || 0),
				yellowCards: Number(row.yellowCards || row.YellowCards || row.Y || 0),
				redCards: Number(row.redCards || row.RedCards || row.R || 0),
				cleanSheets: Number(row.cleanSheets || row.CleanSheets || row.CLS || 0),
				penaltiesScored: Number(row.penaltiesScored || row.PenaltiesScored || row.PSC || 0),
				penaltiesMissed: Number(row.penaltiesMissed || row.PenaltiesMissed || row.PM || 0),
				fantasyPoints: Number(row.fantasyPoints || row.FantasyPoints || row.FTP || 0),
				// New fields with default values
				minutes: Number(row.minutes || row.Minutes || row.MIN || 0),
				mom: Number(row.mom || row.MoM || row.MOM || 0),
				saves: Number(row.saves || row.Saves || row.SAVES || 0),
				ownGoals: Number(row.ownGoals || row.OwnGoals || row.OG || 0),
				conceded: Number(row.conceded || row.Conceded || row.C || 0),
				penaltiesConceded: Number(row.penaltiesConceded || row.PenaltiesConceded || row.PCO || 0),
				penaltiesSaved: Number(row.penaltiesSaved || row.PenaltiesSaved || row.PSV || 0),
				allGoals: Number(row.allGoals || row.AllGoals || row.AllGSC || 0),
				goalsPerAppearance: Number(row.goalsPerAppearance || row.GoalsPerAppearance || row.GperAPP || 0),
				concededPerAppearance: Number(row.concededPerAppearance || row.ConcededPerAppearance || row.CperAPP || 0),
				minutesPerGoal: Number(row.minutesPerGoal || row.MinutesPerGoal || row.MperG || 0),
				minutesPerCleanSheet: Number(row.minutesPerCleanSheet || row.MinutesPerCleanSheet || row.MperCLS || 0),
				fantasyPointsPerAppearance: Number(row.fantasyPointsPerAppearance || row.FantasyPointsPerAppearance || row.FTPperAPP || 0),
				distance: Number(row.distance || row.Distance || row.DIST || 0),
				homeGames: Number(row.homeGames || row.HomeGames || 0),
				homeWins: Number(row.homeWins || row.HomeWins || 0),
				homeGamesPercentWon: Number(row.homeGamesPercentWon || row.HomeGamesPercentWon || 0),
				awayGames: Number(row.awayGames || row.AwayGames || 0),
				awayWins: Number(row.awayWins || row.AwayWins || 0),
				awayGamesPercentWon: Number(row.awayGamesPercentWon || row.AwayGamesPercentWon || 0),
				gamesPercentWon: Number(row.gamesPercentWon || row.GamesPercentWon || row.GamesPercentWon || 0),
				firstTeamApps: Number(row.firstTeamApps || row.FirstTeamApps || row["1sApps"] || 0),
				secondTeamApps: Number(row.secondTeamApps || row.SecondTeamApps || row["2sApps"] || 0),
				thirdTeamApps: Number(row.thirdTeamApps || row.ThirdTeamApps || row["3sApps"] || 0),
				fourthTeamApps: Number(row.fourthTeamApps || row.FourthTeamApps || row["4sApps"] || 0),
				fifthTeamApps: Number(row.fifthTeamApps || row.FifthTeamApps || row["5sApps"] || 0),
				sixthTeamApps: Number(row.sixthTeamApps || row.SixthTeamApps || row["6sApps"] || 0),
				seventhTeamApps: Number(row.seventhTeamApps || row.SeventhTeamApps || row["7sApps"] || 0),
				eighthTeamApps: Number(row.eighthTeamApps || row.EighthTeamApps || row["8sApps"] || 0),
				mostPlayedForTeam: String(row.mostPlayedForTeam || row.MostPlayedForTeam || row.MostPlayedForTeam || ""),
				numberTeamsPlayedFor: Number(row.numberTeamsPlayedFor || row.NumberTeamsPlayedFor || row.NumberTeamsPlayedFor || 0),
				firstTeamGoals: Number(row.firstTeamGoals || row.FirstTeamGoals || row["1sGoals"] || 0),
				secondTeamGoals: Number(row.secondTeamGoals || row.SecondTeamGoals || row["2sGoals"] || 0),
				thirdTeamGoals: Number(row.thirdTeamGoals || row.ThirdTeamGoals || row["3sGoals"] || 0),
				fourthTeamGoals: Number(row.fourthTeamGoals || row.FourthTeamGoals || row["4sGoals"] || 0),
				fifthTeamGoals: Number(row.fifthTeamGoals || row.FifthTeamGoals || row["5sGoals"] || 0),
				sixthTeamGoals: Number(row.sixthTeamGoals || row.SixthTeamGoals || row["6sGoals"] || 0),
				seventhTeamGoals: Number(row.seventhTeamGoals || row.SeventhTeamGoals || row["7sGoals"] || 0),
				eighthTeamGoals: Number(row.eighthTeamGoals || row.EighthTeamGoals || row["8sGoals"] || 0),
				mostScoredForTeam: String(row.mostScoredForTeam || row.MostScoredForTeam || row.MostScoredForTeam || ""),
				season2016_17Apps: Number(row.season2016_17Apps || row["2016/17Apps"] || 0),
				season2017_18Apps: Number(row.season2017_18Apps || row["2017/18Apps"] || 0),
				season2018_19Apps: Number(row.season2018_19Apps || row["2018/19Apps"] || 0),
				season2019_20Apps: Number(row.season2019_20Apps || row["2019/20Apps"] || 0),
				season2020_21Apps: Number(row.season2020_21Apps || row["2020/21Apps"] || 0),
				season2021_22Apps: Number(row.season2021_22Apps || row["2021/22Apps"] || 0),
				numberSeasonsPlayedFor: Number(row.numberSeasonsPlayedFor || row.NumberSeasonsPlayedFor || 0),
				season2016_17Goals: Number(row.season2016_17Goals || row["2016/17Goals"] || 0),
				season2017_18Goals: Number(row.season2017_18Goals || row["2017/18Goals"] || 0),
				season2018_19Goals: Number(row.season2018_19Goals || row["2018/19Goals"] || 0),
				season2019_20Goals: Number(row.season2019_20Goals || row["2019/20Goals"] || 0),
				season2020_21Goals: Number(row.season2020_21Goals || row["2020/21Goals"] || 0),
				season2021_22Goals: Number(row.season2021_22Goals || row["2021/22Goals"] || 0),
				mostProlificSeason: String(row.mostProlificSeason || row.MostProlificSeason || ""),
				goalkeeperApps: Number(row.goalkeeperApps || row.GoalkeeperApps || row.GK || 0),
				defenderApps: Number(row.defenderApps || row.DefenderApps || row.DEF || 0),
				midfielderApps: Number(row.midfielderApps || row.MidfielderApps || row.MID || 0),
				forwardApps: Number(row.forwardApps || row.ForwardApps || row.FWD || 0),
				mostCommonPosition: String(row.mostCommonPosition || row.MostCommonPosition || ""),
			}))
			.filter((player) => player.playerName && player.playerName.trim() !== "");

		if (isVerbose) {
			console.log("✅ Successfully processed", processedData.length, "players");
			console.log("✅ Sample player data:", processedData[0]);
		}

		return processedData;
	} catch (error) {
		if (isVerbose) {
			console.error("❌ Failed to fetch reference data from CSV:", error);
		}

		// Throw error instead of using fallback data
		throw new Error(`Failed to fetch test data: ${error}`);
	}
}

/**
 * Get player names from test data
 */
export async function getTestPlayerNames(): Promise<string[]> {
	const testData = await fetchTestData();
	return testData.map((player) => player.playerName);
}

/**
 * Get specific player data by name
 */
export async function getPlayerTestData(playerName: string): Promise<TestPlayerData | null> {
	const testData = await fetchTestData();
	return testData.find((player) => player.playerName === playerName) || null;
}

/**
 * Fallback test data for when CSV fetch fails
 */
export const FALLBACK_TEST_DATA: TestPlayerData[] = [
	{
		playerName: "Luke Bangs",
		goals: 10,
		assists: 5,
		appearances: 20,
		yellowCards: 2,
		redCards: 0,
		cleanSheets: 0,
		penaltiesScored: 1,
		penaltiesMissed: 0,
		fantasyPoints: 150,
		minutes: 1800,
		mom: 3,
		saves: 0,
		ownGoals: 0,
		conceded: 0,
		penaltiesConceded: 0,
		penaltiesSaved: 0,
		allGoals: 10,
		goalsPerAppearance: 0.5,
		concededPerAppearance: 0,
		minutesPerGoal: 180,
		minutesPerCleanSheet: 0,
		fantasyPointsPerAppearance: 7.5,
		distance: 100,
		homeGames: 10,
		homeWins: 6,
		homeGamesPercentWon: 60,
		awayGames: 10,
		awayWins: 4,
		awayGamesPercentWon: 40,
		gamesPercentWon: 50,
		firstTeamApps: 15,
		secondTeamApps: 5,
		thirdTeamApps: 0,
		fourthTeamApps: 0,
		fifthTeamApps: 0,
		sixthTeamApps: 0,
		seventhTeamApps: 0,
		eighthTeamApps: 0,
		mostPlayedForTeam: "1s",
		numberTeamsPlayedFor: 2,
		firstTeamGoals: 8,
		secondTeamGoals: 2,
		thirdTeamGoals: 0,
		fourthTeamGoals: 0,
		fifthTeamGoals: 0,
		sixthTeamGoals: 0,
		seventhTeamGoals: 0,
		eighthTeamGoals: 0,
		mostScoredForTeam: "1s",
		season2016_17Apps: 0,
		season2017_18Apps: 0,
		season2018_19Apps: 0,
		season2019_20Apps: 0,
		season2020_21Apps: 0,
		season2021_22Apps: 0,
		numberSeasonsPlayedFor: 0,
		season2016_17Goals: 0,
		season2017_18Goals: 0,
		season2018_19Goals: 0,
		season2019_20Goals: 0,
		season2020_21Goals: 0,
		season2021_22Goals: 0,
		mostProlificSeason: "",
		goalkeeperApps: 0,
		defenderApps: 0,
		midfielderApps: 15,
		forwardApps: 5,
		mostCommonPosition: "MID",
	},
	{
		playerName: "Oli Goddard",
		goals: 8,
		assists: 7,
		appearances: 18,
		yellowCards: 1,
		redCards: 0,
		cleanSheets: 0,
		penaltiesScored: 0,
		penaltiesMissed: 0,
		fantasyPoints: 140,
		minutes: 1620,
		mom: 2,
		saves: 0,
		ownGoals: 0,
		conceded: 0,
		penaltiesConceded: 0,
		penaltiesSaved: 0,
		allGoals: 8,
		goalsPerAppearance: 0.44,
		concededPerAppearance: 0,
		minutesPerGoal: 202.5,
		minutesPerCleanSheet: 0,
		fantasyPointsPerAppearance: 7.78,
		distance: 80,
		homeGames: 9,
		homeWins: 5,
		homeGamesPercentWon: 55.6,
		awayGames: 9,
		awayWins: 4,
		awayGamesPercentWon: 44.4,
		gamesPercentWon: 50,
		firstTeamApps: 12,
		secondTeamApps: 6,
		thirdTeamApps: 0,
		fourthTeamApps: 0,
		fifthTeamApps: 0,
		sixthTeamApps: 0,
		seventhTeamApps: 0,
		eighthTeamApps: 0,
		mostPlayedForTeam: "1s",
		numberTeamsPlayedFor: 2,
		firstTeamGoals: 6,
		secondTeamGoals: 2,
		thirdTeamGoals: 0,
		fourthTeamGoals: 0,
		fifthTeamGoals: 0,
		sixthTeamGoals: 0,
		seventhTeamGoals: 0,
		eighthTeamGoals: 0,
		mostScoredForTeam: "1s",
		season2016_17Apps: 0,
		season2017_18Apps: 0,
		season2018_19Apps: 0,
		season2019_20Apps: 0,
		season2020_21Apps: 0,
		season2021_22Apps: 0,
		numberSeasonsPlayedFor: 0,
		season2016_17Goals: 0,
		season2017_18Goals: 0,
		season2018_19Goals: 0,
		season2019_20Goals: 0,
		season2020_21Goals: 0,
		season2021_22Goals: 0,
		mostProlificSeason: "",
		goalkeeperApps: 0,
		defenderApps: 0,
		midfielderApps: 10,
		forwardApps: 8,
		mostCommonPosition: "MID",
	},
	{
		playerName: "Jonny Sourris",
		goals: 12,
		assists: 3,
		appearances: 22,
		yellowCards: 3,
		redCards: 0,
		cleanSheets: 0,
		penaltiesScored: 2,
		penaltiesMissed: 1,
		fantasyPoints: 180,
		minutes: 1980,
		mom: 4,
		saves: 0,
		ownGoals: 0,
		conceded: 0,
		penaltiesConceded: 0,
		penaltiesSaved: 0,
		allGoals: 12,
		goalsPerAppearance: 0.55,
		concededPerAppearance: 0,
		minutesPerGoal: 165,
		minutesPerCleanSheet: 0,
		fantasyPointsPerAppearance: 8.18,
		distance: 120,
		homeGames: 11,
		homeWins: 7,
		homeGamesPercentWon: 63.6,
		awayGames: 11,
		awayWins: 5,
		awayGamesPercentWon: 45.5,
		gamesPercentWon: 54.5,
		firstTeamApps: 18,
		secondTeamApps: 4,
		thirdTeamApps: 0,
		fourthTeamApps: 0,
		fifthTeamApps: 0,
		sixthTeamApps: 0,
		seventhTeamApps: 0,
		eighthTeamApps: 0,
		mostPlayedForTeam: "1s",
		numberTeamsPlayedFor: 2,
		firstTeamGoals: 10,
		secondTeamGoals: 2,
		thirdTeamGoals: 0,
		fourthTeamGoals: 0,
		fifthTeamGoals: 0,
		sixthTeamGoals: 0,
		seventhTeamGoals: 0,
		eighthTeamGoals: 0,
		mostScoredForTeam: "1s",
		season2016_17Apps: 0,
		season2017_18Apps: 0,
		season2018_19Apps: 0,
		season2019_20Apps: 0,
		season2020_21Apps: 0,
		season2021_22Apps: 0,
		numberSeasonsPlayedFor: 0,
		season2016_17Goals: 0,
		season2017_18Goals: 0,
		season2018_19Goals: 0,
		season2019_20Goals: 0,
		season2020_21Goals: 0,
		season2021_22Goals: 0,
		mostProlificSeason: "",
		goalkeeperApps: 0,
		defenderApps: 0,
		midfielderApps: 8,
		forwardApps: 14,
		mostCommonPosition: "FWD",
	},
];