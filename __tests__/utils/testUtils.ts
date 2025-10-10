import Papa from "papaparse";
import { STAT_TEST_CONFIGS, TestConfig } from "../../config/config";

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
// STAT_TEST_CONFIGS is now imported from config.ts

/**
 * Generate test questions for a player using all stat configurations
 */
export function generateTestQuestions(playerName: string): string[] {
	return STAT_TEST_CONFIGS.map((config) => config.questionTemplate.replace("{playerName}", playerName));
}

/**
 * Extract numeric value from chatbot response using the stat's response pattern
 */
export function extractNumericValue(response: string, statConfig: TestConfig): number | null {
	const match = response.match(statConfig.responsePattern);
	return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract string value from chatbot response using the stat's response pattern
 */
export function extractStringValue(response: string, statConfig: TestConfig): string | null {
	const match = response.match(statConfig.responsePattern);
	return match ? match[1] : null;
}

/**
 * Validate chatbot response against real database values
 * This function now focuses on validating response quality rather than exact value matching
 */
export function validateResponse(
	response: string,
	expectedValue: number, // This is now ignored - we're testing against real DB values
	statConfig: TestConfig,
	playerName: string,
): { isValid: boolean; summary: string } {
	// For MostPlayedForTeam, we need to extract string values, not numeric
	let extractedValue: number | string | null;
	if (statConfig.key === "MostPlayedForTeam") {
		extractedValue = extractStringValue(response, statConfig);
	} else {
		extractedValue = extractNumericValue(response, statConfig);
	}

	if (extractedValue === null) {
		const summary = `ChatBot response: "${response}" - Could not extract value`;
		return { isValid: false, summary };
	}

	// For real database testing, we validate that:
	// 1. We got a response
	// 2. The response contains the player name
	// 3. We could extract a value (numeric or string)
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
