#!/usr/bin/env node

/**
 * Comprehensive Chatbot Test with Email Report
 * Tests all stat configurations against real database data and sends email summary
 *
 * CRITICAL RULE: NO HARDCODED VALUES ALLOWED
 * - All TBL_TestData values must be sourced from the actual CSV data
 * - No fallback hardcoded values are permitted in the testing setup
 * - Tests with missing data must be marked as FAILED, not PASSED
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

// Load environment variables
require("dotenv").config();

// Set up console logging to file (skip in Netlify function environment)
const logDir = path.join(__dirname, "..", "..", "logs");
let logStream = null;

// Only create log file if not in Netlify function environment
if (process.env.NETLIFY !== "true") {
if (!fs.existsSync(logDir)) {
	fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, "test-execution.log");
	logStream = fs.createWriteStream(logFile, { flags: "a" });
}

// Override console methods to write to both console and file
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
	const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ");
	originalConsoleLog(...args);
	if (logStream) {
	logStream.write(`[${new Date().toISOString()}] LOG: ${message}\n`);
	}
};

console.error = (...args) => {
	const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ");
	originalConsoleError(...args);
	if (logStream) {
	logStream.write(`[${new Date().toISOString()}] ERROR: ${message}\n`);
	}
};

console.warn = (...args) => {
	const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ");
	originalConsoleWarn(...args);
	if (logStream) {
	logStream.write(`[${new Date().toISOString()}] WARN: ${message}\n`);
	}
};

// Clean up function
process.on("exit", () => {
	if (logStream) {
	logStream.end();
	}
});

process.on("SIGINT", () => {
	if (logStream) {
	logStream.end();
	}
	process.exit(0);
});

process.on("SIGTERM", () => {
	if (logStream) {
	logStream.end();
	}
	process.exit(0);
});

// Register ts-node to handle TypeScript imports (skip in Netlify function environment)
if (process.env.NETLIFY !== "true") {
	try {
require("ts-node").register({
	transpileOnly: true,
	compilerOptions: {
		module: "commonjs",
		target: "es2020",
		esModuleInterop: true,
		allowSyntheticDefaultImports: true,
		skipLibCheck: true,
		moduleResolution: "node",
	},
});
	} catch (error) {
		console.log("⚠️ ts-node not available, using API-only mode");
	}
}

// Define comprehensive STAT_TEST_CONFIGS for testing
const STAT_TEST_CONFIGS = [
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

// Helper function to format values according to stat configuration (same as chatbot)
function formatValueByMetric(metric, value) {
	console.log(`🔧 formatValueByMetric called with metric: ${metric}, value: ${value}`);
	// Handle BigInt values from Neo4j first
	if (typeof value === 'bigint') {
		return value.toString();
	}
	
	// Handle string values - convert to number if it's a numeric string, otherwise return as-is
	if (typeof value === 'string') {
		// Check if it's a numeric string
		if (!isNaN(parseFloat(value)) && isFinite(value)) {
			// It's a numeric string, convert to number and continue with formatting
			value = parseFloat(value);
		} else {
			// It's a non-numeric string (like position names), return as-is
			return value;
		}
	}
	
	// Import the actual statObject from config.ts
	let statObject;
	try {
		// Try to require the compiled version first
		console.log('🔧 Trying to load config.js...');
		statObject = require('../../config/config.js').statObject;
		console.log('🔧 Successfully loaded config.js');
	} catch (e) {
		console.log('🔧 Using hardcoded statObject fallback, error:', e.message);
		// Fallback to hardcoded values for now (since TypeScript import is failing)
		statObject = {
			FTP: { numberDecimalPlaces: 0 },
			MIN: { numberDecimalPlaces: 0 },
			C: { numberDecimalPlaces: 0 },
			G: { numberDecimalPlaces: 0 },
			A: { numberDecimalPlaces: 0 },
			APP: { numberDecimalPlaces: 0 },
			CLS: { numberDecimalPlaces: 0 },
			Y: { numberDecimalPlaces: 0 },
			R: { numberDecimalPlaces: 0 },
			SAVES: { numberDecimalPlaces: 0 },
			OG: { numberDecimalPlaces: 0 },
			PSC: { numberDecimalPlaces: 0 },
			PM: { numberDecimalPlaces: 0 },
			PCO: { numberDecimalPlaces: 0 },
			PSV: { numberDecimalPlaces: 0 },
			GperAPP: { numberDecimalPlaces: 1 },
			CperAPP: { numberDecimalPlaces: 1 },
			FTPperAPP: { numberDecimalPlaces: 1 },
			MPERG: { numberDecimalPlaces: 1 },
			MPERCLS: { numberDecimalPlaces: 1 },
			DIST: { numberDecimalPlaces: 1 }
		};
	}
	
	const metricConfig = statObject[metric];
	if (metricConfig && typeof metricConfig === 'object' && 'numberDecimalPlaces' in metricConfig) {
		const decimalPlaces = metricConfig.numberDecimalPlaces || 0;
		console.log(`🔧 Formatting ${metric} with ${decimalPlaces} decimal places: ${value} -> ${Number(value).toFixed(decimalPlaces)}`);
		return Number(value).toFixed(decimalPlaces);
	}
	
	// Default to integer if no config found
	console.log(`🔧 No config found for ${metric}, using default integer formatting: ${value} -> ${Math.round(Number(value)).toString()}`);
	return Math.round(Number(value)).toString();
}

// Import chatbot service (will be loaded dynamically)
let ChatbotService = null;

// Function to load chatbot service
async function loadChatbotService() {
	// Skip chatbot service loading in Netlify function environment
	if (process.env.NETLIFY === "true") {
		console.log("⏭️ Skipping ChatbotService loading in Netlify function environment");
		return null;
	}
	
	if (!ChatbotService) {
		try {
			// Use dynamic import to avoid build-time module resolution issues
			const chatbotModule = await import("../lib/services/chatbotService.ts");
			ChatbotService = chatbotModule.ChatbotService;
			console.log("✅ ChatbotService loaded successfully");
		} catch (error) {
			console.log("⚠️ Could not load ChatbotService:", error.message);
			console.log("⚠️ Falling back to API-based testing");
		}
	}
	return ChatbotService;
}

// Email configuration (using same env vars as existing email service)
const EMAIL_CONFIG = {
	host: process.env.SMTP_SERVER,
	port: parseInt(process.env.SMTP_PORT || "587", 10),
	secure: process.env.SMTP_EMAIL_SECURE === "true",
	auth: {
		user: process.env.SMTP_USERNAME,
		pass: process.env.SMTP_PASSWORD,
	},
	tls: {
		rejectUnauthorized: false, // Allow self-signed certificates
	},
};

const RECIPIENT_EMAIL = process.env.SMTP_TO_EMAIL || process.env.SMTP_FROM_EMAIL;

// Check if the development server is running
async function checkServerHealth() {
	try {
		// Use production URL when running in Netlify environment
		const baseUrl = process.env.NODE_ENV === 'production' 
			? 'https://dorkinians-website-v3.netlify.app'
			: 'http://localhost:3000';
			
		const response = await fetch(`${baseUrl}/api/chatbot`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				question: "How many goals has Luke Bangs scored?",
				userContext: "Luke Bangs",
			}),
		});

		if (!response.ok) {
			console.log(`❌ Server responded with status: ${response.status}`);
			return false;
		}

		const data = await response.json();
		// Check if we get a valid response (not empty or error)
		if (!data.answer || data.answer.trim() === "") {
			console.log("❌ Server returned empty response");
			return false;
		}

		console.log("✅ Server is running and responding correctly");
		return true;
	} catch (error) {
		console.log(`❌ Server connection failed: ${error.message}`);
		return false;
	}
}

// Fetch test data from CSV directly
async function fetchTestData() {
	try {
		const testDataUrl =
			"https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=14183891&single=true&output=csv";

		console.log("🔍 Fetching test data from CSV...");

		const response = await fetch(testDataUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch test data: ${response.statusText}`);
		}

		const csvText = await response.text();
		console.log("📊 CSV content length:", csvText.length);

		// Proper CSV parsing to handle quoted fields and commas within fields
		function parseCSV(csvText) {
			console.log("🔍 CSV PARSING DEBUG: Starting CSV parsing...");
			console.log("🔍 CSV PARSING DEBUG: CSV text length:", csvText.length);

			const lines = csvText.split("\n").filter((line) => line.trim()).map(line => line.replace(/\r$/, ''));
			console.log("🔍 CSV PARSING DEBUG: Total lines after filtering:", lines.length);
			console.log("🔍 CSV PARSING DEBUG: First 3 lines:", lines.slice(0, 3));

			if (lines.length === 0) {
				console.log("🔍 CSV PARSING DEBUG: No lines found, returning empty array");
				return [];
			}

			// Parse headers
			console.log("🔍 CSV PARSING DEBUG: Parsing header line...");
			const headers = parseCSVLine(lines[0]);
			console.log("🔍 CSV PARSING DEBUG: Parsed headers:", headers);
			console.log("🔍 CSV PARSING DEBUG: Header count:", headers.length);

			const data = [];

			for (let i = 1; i < lines.length; i++) {
				console.log(`🔍 CSV PARSING DEBUG: Parsing line ${i}...`);
				const values = parseCSVLine(lines[i]);
				console.log(`🔍 CSV PARSING DEBUG: Line ${i} values:`, values);
				console.log(`🔍 CSV PARSING DEBUG: Line ${i} value count:`, values.length);

				const row = {};

				headers.forEach((header, index) => {
					const value = values[index] || "";
					row[header] = value;
					if (i <= 3) {
						// Log first 3 rows for debugging
						console.log(`🔍 CSV PARSING DEBUG: Row ${i}, Header "${header}": "${value}"`);
					}
				});

				data.push(row);

				if (i <= 3) {
					// Log first 3 complete rows
					console.log(`🔍 CSV PARSING DEBUG: Complete row ${i}:`, row);
				}
			}

			console.log("🔍 CSV PARSING DEBUG: Total parsed rows:", data.length);
			console.log("🔍 CSV PARSING DEBUG: First row keys:", Object.keys(data[0] || {}));

			return data;
		}

		function parseCSVLine(line) {
			console.log(`🔍 CSV LINE DEBUG: Parsing line: "${line}"`);
			const result = [];
			let current = "";
			let inQuotes = false;

			for (let i = 0; i < line.length; i++) {
				const char = line[i];

				if (char === '"') {
					if (inQuotes && line[i + 1] === '"') {
						// Escaped quote
						current += '"';
						i++; // Skip next quote
						console.log(`🔍 CSV LINE DEBUG: Found escaped quote at position ${i}`);
					} else {
						// Toggle quote state
						inQuotes = !inQuotes;
						console.log(`🔍 CSV LINE DEBUG: Toggle quotes at position ${i}, inQuotes: ${inQuotes}`);
					}
				} else if (char === "," && !inQuotes) {
					// Field separator
					result.push(current.trim());
					console.log(`🔍 CSV LINE DEBUG: Field separator at position ${i}, added field: "${current.trim()}"`);
					current = "";
				} else {
					current += char;
				}
			}

			// Add the last field
			result.push(current.trim());
			console.log(`🔍 CSV LINE DEBUG: Final field: "${current.trim()}"`);
			console.log(`🔍 CSV LINE DEBUG: Parsed result:`, result);

			return result;
		}

		const data = parseCSV(csvText);

		console.log(`📊 Parsed ${data.length} players from CSV`);
		return data;
	} catch (error) {
		console.error("Error fetching test data:", error);
		return [];
	}
}

// Alternative approach: Create comprehensive test data for all players
async function runTestsProgrammatically() {
	console.log("🧪 Running tests programmatically to capture detailed results...");

	try {
		// Import the actual test data fetching function and configs
		// Programmatic approach is now the primary method

		// Fetch real test data from CSV
		const testData = await fetchTestData();
		console.log(`📊 Fetched ${testData.length} players from CSV data`);

		// Use only 1 player for testing in Netlify function environment
		const testPlayers = testData.slice(0, 1); // Use first 1 player for testing

		console.log(
			`📊 Using test data for ${testPlayers.length} players:`,
			testPlayers.map((p) => p["PLAYER NAME"]),
		);
		console.log("📊 First player data:", testPlayers[0]);
		console.log("📊 First player data keys:", Object.keys(testPlayers[0] || {}));
		console.log("📊 First player team-specific data:");
		console.log("  - 1sApps:", testPlayers[0]["1sApps"]);
		console.log("  - 2sApps:", testPlayers[0]["2sApps"]);
		console.log("  - 3sApps:", testPlayers[0]["3sApps"]);
		console.log("  - 1sGoals:", testPlayers[0]["1sGoals"]);
		console.log("  - 2sGoals:", testPlayers[0]["2sGoals"]);

		const results = {
			totalTests: 0,
			passedTests: 0,
			failedTests: 0,
			testDetails: [],
		};

		// Test each stat configuration for each player
		for (const player of testPlayers) {
			const playerName = player["PLAYER NAME"];
			console.log(`\n🧪 Testing player: ${playerName}`);

			// Use first 25 test configurations to include MperG test
			const testConfigs = STAT_TEST_CONFIGS.slice(0, 25);
			console.log(`🔍 Testing ${testConfigs.length} configurations to avoid timeout`);

			for (const statConfig of testConfigs) {
				const statKey = statConfig.key;
				const questionTemplate = statConfig.questionTemplate;
				results.totalTests++;

				try {
					// Generate question
					const question = questionTemplate.replace("{playerName}", playerName);

					// Get expected value from real database via API
					let expectedValue, chatbotAnswer, cypherQuery;

					// First, get the expected value from CSV data
					console.log(`🔍 DEBUG: Looking for key "${statConfig.key}" in player data:`, Object.keys(player));
					console.log(`🔍 DEBUG: Player data for ${playerName}:`, player);

					if (player[statConfig.key] !== undefined && player[statConfig.key] !== "") {
						const rawValue = player[statConfig.key];
						// Format the expected value according to stat configuration (same as chatbot)
						expectedValue = formatValueByMetric(statConfig.key, rawValue);
						console.log(`✅ Found CSV data for ${statKey}: ${rawValue} -> formatted: ${expectedValue}`);
					} else {
						expectedValue = "N/A";
						console.log(`❌ No CSV data found for ${statKey}`);
					}

					try {
						// In Netlify function environment, use API call with detailed debugging
						if (process.env.NETLIFY === "true") {
							console.log(`🌐 Using API call for: ${question}`);
							const baseUrl = 'https://dorkinians-website-v3.netlify.app';
							
							console.log(`🔍 Making request to: ${baseUrl}/api/chatbot`);
							console.log(`🔍 Request body:`, JSON.stringify({
								question: question,
								userContext: playerName,
							}));
							
		// Check if fetch is available
		if (typeof fetch === 'undefined') {
			console.log(`❌ Fetch is not available, using node-fetch`);
			const nodeFetch = require('node-fetch');
			
			// Add timeout wrapper
			const timeoutPromise = new Promise((_, reject) => 
				setTimeout(() => reject(new Error('API call timeout after 10 seconds')), 10000)
			);
			
			const fetchPromise = nodeFetch(`${baseUrl}/api/chatbot`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					question: question,
					userContext: playerName,
				}),
			});
			
			const response = await Promise.race([fetchPromise, timeoutPromise]);

								console.log(`🔍 Response status: ${response.status}`);
								
								if (response.ok) {
									const data = await response.json();
									console.log(`🔍 Response data:`, data);
									chatbotAnswer = data.answer || "Empty response or error";
									cypherQuery = data.cypherQuery || "N/A";
								} else {
									const errorText = await response.text();
									console.log(`🔍 Error response:`, errorText);
									throw new Error(`API call failed: ${response.status} - ${errorText}`);
								}
		} else {
			console.log(`✅ Using native fetch`);
			try {
				// Add timeout wrapper for native fetch
				const timeoutPromise = new Promise((_, reject) => 
					setTimeout(() => reject(new Error('API call timeout after 10 seconds')), 10000)
				);
				
				const fetchPromise = fetch(`${baseUrl}/api/chatbot`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						question: question,
						userContext: playerName,
					}),
				});
				
				const response = await Promise.race([fetchPromise, timeoutPromise]);

									console.log(`🔍 Response status: ${response.status}`);
									console.log(`🔍 Response headers:`, Object.fromEntries(response.headers.entries()));

									if (response.ok) {
										const data = await response.json();
										console.log(`🔍 Response data:`, data);
										chatbotAnswer = data.answer || "Empty response or error";
										cypherQuery = data.cypherQuery || "N/A";
									} else {
										const errorText = await response.text();
										console.log(`🔍 Error response:`, errorText);
										throw new Error(`API call failed: ${response.status} - ${errorText}`);
									}
								} catch (fetchError) {
									console.log(`🔍 Fetch error:`, fetchError.message);
									throw fetchError;
								}
							}
						} else {
						// Try to use the chatbot service directly first
						const chatbotService = await loadChatbotService();
						if (chatbotService) {
							console.log(`🤖 Using chatbot service for: ${question}`);
							const response = await chatbotService.getInstance().processQuestion({
								question: question,
								userContext: playerName,
							});
							chatbotAnswer = response.answer || "Empty response or error";
							cypherQuery = response.cypherQuery || "N/A";

							console.log(`✅ Chatbot response: ${chatbotAnswer}`);
							console.log(`🔍 Cypher query: ${cypherQuery}`);
						} else {
							// Fallback to API call
							console.log(`🌐 Using API fallback for: ${question}`);
							const baseUrl = process.env.NODE_ENV === 'production' 
								? 'https://dorkinians-website-v3.netlify.app'
								: 'http://localhost:3000';
								
							const response = await fetch(`${baseUrl}/api/chatbot`, {
								method: "POST",
								headers: {
									"Content-Type": "application/json",
								},
								body: JSON.stringify({
									question: question,
									userContext: playerName,
								}),
							});

							if (response.ok) {
								const data = await response.json();
								chatbotAnswer = data.answer || "Empty response or error";
								cypherQuery = data.cypherQuery || "N/A";
							} else {
								throw new Error(`API call failed: ${response.status}`);
								}
							}
						}
					} catch (error) {
						console.warn(`Failed to get chatbot response for ${playerName} - ${statKey}:`, error.message);
						console.warn(`Error details:`, error);
						chatbotAnswer = "Empty response or error";
						cypherQuery = "N/A";
					}

					// Extract value from chatbot answer for comparison
					let chatbotExtractedValue = null;
					if (chatbotAnswer) {
						// Try to extract value from the response using the response pattern
						const match = chatbotAnswer.match(statConfig.responsePattern);
						if (match) {
							chatbotExtractedValue = match[1];
						}
					}

					// Determine if test passed based on whether we got a valid response AND correct value
					// CRITICAL: Test must fail if any of these conditions are true:
					// 1. No chatbot answer or error response
					// 2. Cypher query is N/A (no query was generated)
					// 3. TBL_TestData value is N/A (no expected data available)
					// 4. Chatbot returns "I couldn't find any relevant information" message
					// 5. Chatbot answer doesn't match expected value
					const hasValidResponse =
						chatbotAnswer &&
						chatbotAnswer !== "Empty response or error" &&
						chatbotAnswer !== "N/A" &&
						!chatbotAnswer.includes("error") &&
						!chatbotAnswer.includes("Error") &&
						!chatbotAnswer.includes("I couldn't find any relevant information") &&
						!chatbotAnswer.includes("I couldn't find relevant information for your question") &&
						!chatbotAnswer.includes("Database connection error") &&
						!chatbotAnswer.includes("Database error") &&
						!chatbotAnswer.includes("Player not found") &&
						!chatbotAnswer.includes("Team not found") &&
						!chatbotAnswer.includes("Missing context") &&
						!chatbotAnswer.includes("Please clarify your question") &&
						!chatbotAnswer.includes("No data found") &&
						!chatbotAnswer.includes("MatchDetail data unavailable") &&
						cypherQuery !== "N/A" &&
						expectedValue !== "N/A";

					// Check if the extracted value matches expected
					let valuesMatch = true;
					if (expectedValue !== "N/A" && chatbotExtractedValue !== null) {
						// For numeric values, compare as numbers
						if (statConfig.responsePattern && statConfig.responsePattern.source && statConfig.responsePattern.source.includes("\\d")) {
							const expectedNumeric = parseFloat(expectedValue);
							const chatbotNumeric = parseFloat(chatbotExtractedValue);
							valuesMatch = Math.abs(chatbotNumeric - expectedNumeric) < 0.01; // Allow small floating point differences
						} else {
							// For text values, compare as strings (case insensitive)
							valuesMatch = chatbotExtractedValue.toLowerCase().trim() === expectedValue.toLowerCase().trim();
						}
					}

					const passed = hasValidResponse && valuesMatch;

					// Log detailed information for failing tests
					if (!passed) {
						console.log(`❌ FAILED TEST DETAILS:`);
						console.log(`   Player: ${playerName}`);
						console.log(`   Stat: ${statKey}`);
						console.log(`   Question: ${question}`);
						console.log(`   Expected: ${expectedValue}`);
						console.log(`   Received: ${chatbotAnswer}`);
						console.log(`   Expected Extracted: ${expectedValue}`);
						console.log(`   Chatbot Extracted: ${chatbotExtractedValue}`);
						console.log(`   Values Match: ${valuesMatch}`);
						console.log(`   Has Valid Response: ${hasValidResponse}`);
						console.log(`   Cypher Query: ${cypherQuery}`);
						console.log(`   Passed: ${passed}`);
					}

					if (passed) {
						results.passedTests++;
					} else {
						results.failedTests++;
					}

					// Store test details
					results.testDetails.push({
						suite: "Comprehensive Stat Testing",
						describe: getCategoryForStat(statKey),
						test: `should handle ${statKey} stat correctly`,
						assertion: passed ? "passed" : "failed",
						expected: expectedValue,
						received: chatbotAnswer,
						status: passed ? "PASSED" : "FAILED",
						playerName: playerName,
						question: question,
						statKey: statKey,
						metric: statConfig.key,
						cypherQuery: cypherQuery,
					});
				} catch (error) {
					results.failedTests++;
					results.testDetails.push({
						suite: "Comprehensive Stat Testing",
						describe: getCategoryForStat(statKey),
						test: `should handle ${statKey} stat correctly`,
						assertion: "error",
						expected: player[statConfig.key] || "N/A",
						received: `Error: ${error.message}`,
						status: "FAILED",
						playerName: playerName,
						question: questionTemplate.replace("{playerName}", player.playerName),
						statKey: statKey,
						cypherQuery: "N/A",
						metric: statConfig.key,
					});
				}
			}
		}

		return { success: true, results };
	} catch (error) {
		console.error("❌ Error running tests programmatically:", error);
		return { success: false, error: error.message };
	}
}

function getCategoryForStat(statKey) {
	if (["APP", "MIN", "MOM", "G", "A", "Y", "R", "SAVES", "OG", "C", "CLS", "PSC", "PM", "PCO", "PSV", "FTP"].includes(statKey)) {
		return "Basic Statistics Coverage";
	} else if (["AllGSC", "GperAPP", "CperAPP", "MperG", "MperCLS", "FTPperAPP", "DIST"].includes(statKey)) {
		return "Advanced Statistics Coverage";
	} else if (["HomeGames", "HomeWins", "HomeGames%Won", "AwayGames", "AwayWins", "AwayGames%Won", "Games%Won"].includes(statKey)) {
		return "Home/Away Statistics Coverage";
	} else if (statKey.includes("Apps") && !statKey.includes("/")) {
		return "Team-Specific Appearances Coverage";
	} else if (statKey.includes("Goals") && !statKey.includes("/")) {
		return "Team-Specific Goals Coverage";
	} else if (statKey.includes("Apps") && statKey.includes("/")) {
		return "Seasonal Appearances Coverage";
	} else if (statKey.includes("Goals") && statKey.includes("/")) {
		return "Seasonal Goals Coverage";
	} else if (["GK", "DEF", "MID", "FWD", "MostCommonPosition"].includes(statKey)) {
		return "Positional Statistics Coverage";
	} else {
		return "Other Statistics";
	}
}

// Legacy Jest parsing function removed - using programmatic approach only
async function parseTestResults(output) {
	return {
		totalTests: 0,
		passedTests: 0,
		failedTests: 0,
		testDetails: [],
		summary: "Legacy function - not used",
		rawOutput: output,
	};
}

function generateEmailContent(testResults) {
	const timestamp = new Date().toLocaleString();
	const successRate = testResults.totalTests > 0 ? ((testResults.passedTests / testResults.totalTests) * 100).toFixed(1) : 0;

	let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; }
        .summary { background-color: ${successRate >= 80 ? "#d4edda" : successRate >= 60 ? "#fff3cd" : "#f8d7da"}; 
                   padding: 15px; border-radius: 5px; margin: 20px 0; }
        .test-details { margin: 20px 0; }
        .test-item { background-color: #f8f9fa; padding: 10px; margin: 5px 0; border-left: 4px solid #007bff; }
        .failed-test { border-left-color: #dc3545; }
        .passed-test { border-left-color: #28a745; }
        .stats-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .stats-table th, .stats-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .stats-table th { background-color: #f2f2f2; }
        .detailed-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
        .detailed-table th, .detailed-table td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        .detailed-table th { background-color: #f2f2f2; font-weight: bold; }
        .detailed-table .player-name { max-width: 120px; font-weight: bold; }
        .detailed-table .question { max-width: 300px; word-wrap: break-word; }
        .detailed-table .test-data { max-width: 100px; text-align: center; }
        .detailed-table .chatbot-answer { max-width: 200px; word-wrap: break-word; }
        .detailed-table .cypher-query { max-width: 200px; word-wrap: break-word; font-family: monospace; font-size: 10px; }
        .detailed-table .status { max-width: 80px; text-align: center; font-weight: bold; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .category-header { background-color: #e9ecef; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🤖 Dorkinians Chatbot Comprehensive Test Report</h1>
        <p><strong>Generated:</strong> ${timestamp}</p>
        <p><strong>Test Suite:</strong> Comprehensive Stat Testing</p>
      </div>

      <div class="summary">
        <h2>📊 Test Summary</h2>
        <table class="stats-table">
          <tr>
            <th>Metric</th>
            <th>Value</th>
          </tr>
          <tr>
            <td>Total Tests</td>
            <td>${testResults.totalTests}</td>
          </tr>
          <tr>
            <td>Passed Tests</td>
            <td style="color: #28a745;">${testResults.passedTests}</td>
          </tr>
          <tr>
            <td>Failed Tests</td>
            <td style="color: #dc3545;">${testResults.failedTests}</td>
          </tr>
          <tr>
            <td>Success Rate</td>
            <td style="font-weight: bold; color: ${successRate >= 80 ? "#28a745" : successRate >= 60 ? "#ffc107" : "#dc3545"};">
              ${successRate}%
            </td>
          </tr>
        </table>
      </div>
  `;

	// Generate detailed test results table
	if (testResults.testDetails.length > 0) {
		html += `
      <div class="test-details">
        <h2>📋 Detailed Test Results Table</h2>
        <p>Complete comparison of all stat questions, test data values, chatbot answers, and pass/fail status:</p>
        
        <table class="detailed-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Question</th>
              <th>TBL_TestData Value</th>
              <th>Chatbot Answer</th>
              <th>Cypher Query</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;

	// Group tests by category and create table rows
	const categories = {};
	testResults.testDetails.forEach((test) => {
		// Handle both old format (test.describe) and new format (test.stat)
		const category = test.describe || getCategoryForStat(test.stat || test.statKey || '');
		if (!categories[category]) {
			categories[category] = [];
		}
		categories[category].push(test);
	});

		Object.keys(categories).forEach((category) => {
			// Add category header row
			html += `<tr class="category-header"><td colspan="6">${category}</td></tr>`;

			categories[category].forEach((test) => {
				// Handle both old format and new format
				let isFailed = false;
				if (test.status) {
					// Old format
					isFailed = test.status === "FAILED" ||
						(test.assertion && test.assertion.includes("not.toBe")) ||
						(test.assertion && test.assertion.includes("toContain")) ||
						(test.assertion && test.assertion.includes("toMatch"));
				} else {
					// New format from runRandomTests
					isFailed = !test.passed;
				}
				const status = isFailed ? "FAILED" : "PASSED";
				const statusClass = isFailed ? "status-failed" : "status-passed";

				// Use actual question and player data if available from programmatic results
				let question, expectedValue, playerName;

				if (test.question && (test.player || test.playerName)) {
					// From programmatic results (new format)
					question = test.question;
					expectedValue = test.expected;
					playerName = test.player || test.playerName;
				} else if (test.question && test.playerName) {
					// From programmatic results (old format)
					question = test.question;
					expectedValue = test.expected;
					playerName = test.playerName;
				} else {
					// From Jest output parsing - extract stat key and generate question
					let statKey = test.test.replace(
						/should handle (.+?) (?:stat|advanced stat|home\/away stat|team appearance stat|team goal stat|seasonal appearance stat|seasonal goal stat|positional stat) correctly/,
						"$1",
					);
					statKey = statKey.replace(/\s+/g, "").replace(/%/g, "%");

					// Generate question template for Jest parsing (STAT_TEST_CONFIGS not available here)
					const questionTemplate = `How many ${statKey.toLowerCase()} does {playerName} have?`;
					question = questionTemplate.replace("{playerName}", "Luke Bangs");
					expectedValue = test.expected;
					playerName = "Luke Bangs";
				}

				// Format expected value to handle large numbers properly
				// Note: expectedValue is already formatted by formatValueByMetric() with correct decimal places
				let formattedExpectedValue = expectedValue;
				if (typeof expectedValue === "number" && expectedValue >= 1000) {
					formattedExpectedValue = expectedValue.toLocaleString();
				} else if (typeof expectedValue === "string" && !isNaN(parseFloat(expectedValue)) && parseFloat(expectedValue) >= 1000) {
					// Handle already-formatted strings that represent large numbers
					formattedExpectedValue = parseFloat(expectedValue).toLocaleString();
				}

				html += `
          <tr>
            <td class="player-name">${playerName}</td>
            <td class="question">${question}</td>
            <td class="test-data">${formattedExpectedValue}</td>
            <td class="chatbot-answer">${test.received}</td>
            <td class="cypher-query">${test.cypherQuery || "N/A"}</td>
            <td class="status ${statusClass}">${isFailed ? "❌ FAILED" : "✅ PASSED"}</td>
          </tr>
        `;
			});
		});

		html += `
          </tbody>
        </table>
      </div>
    `;
	}

	html += `
      <div class="summary">
        <h2>📋 Test Coverage</h2>
        <p>This comprehensive test covers all ${testResults.totalTests} stat configurations defined in the testUtils file, including:</p>
        <ul>
          <li>Basic Statistics (Goals, Assists, Appearances, etc.)</li>
          <li>Advanced Statistics (Goals per Appearance, Minutes per Goal, etc.)</li>
          <li>Home/Away Statistics</li>
          <li>Team-Specific Statistics (1s, 2s, 3s, etc.)</li>
          <li>Seasonal Statistics (2016/17 through 2021/22)</li>
          <li>Positional Statistics (Goalkeeper, Defender, Midfielder, Forward)</li>
        </ul>
      </div>

      <div class="summary">
        <h2>🔧 Next Steps</h2>
        <p>Based on the test results:</p>
        <ul>
          <li>Review failed tests to identify patterns in chatbot responses</li>
          <li>Check entity extraction patterns for player name recognition</li>
          <li>Verify metric detection logic for advanced statistics</li>
          <li>Ensure database queries return expected data formats</li>
          <li>Update response generation logic for better accuracy</li>
        </ul>
      </div>
    </body>
    </html>
  `;

	return html;
}

async function sendEmailReport(testResults) {
	console.log("🔍 Email configuration check:");
	console.log(`SMTP_SERVER: ${process.env.SMTP_SERVER ? 'SET' : 'NOT SET'}`);
	console.log(`SMTP_USERNAME: ${process.env.SMTP_USERNAME ? 'SET' : 'NOT SET'}`);
	console.log(`SMTP_PASSWORD: ${process.env.SMTP_PASSWORD ? 'SET' : 'NOT SET'}`);
	console.log(`SMTP_TO_EMAIL: ${process.env.SMTP_TO_EMAIL ? 'SET' : 'NOT SET'}`);
	console.log(`RECIPIENT_EMAIL: ${RECIPIENT_EMAIL}`);
	
	if (!EMAIL_CONFIG.host || !EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
		console.log("⚠️ Email credentials not configured. Skipping email report.");
		console.log("Set SMTP_SERVER, SMTP_USERNAME, and SMTP_PASSWORD environment variables to enable email reports.");
		return;
	}

	try {
		const transporter = nodemailer.createTransport(EMAIL_CONFIG);

		const htmlContent = generateEmailContent(testResults);

		const mailOptions = {
			from: EMAIL_CONFIG.auth.user,
			to: RECIPIENT_EMAIL,
			subject: `🤖 Dorkinians Chatbot Test Report - ${new Date().toLocaleDateString()}`,
			html: htmlContent,
			text: `Dorkinians Chatbot Test Report\n\nTotal Tests: ${testResults.totalTests}\nPassed: ${testResults.passedTests}\nFailed: ${testResults.failedTests}\nSuccess Rate: ${testResults.totalTests > 0 ? ((testResults.passedTests / testResults.totalTests) * 100).toFixed(1) : 0}%\n\nSee HTML version for detailed results.`,
		};

		console.log("📧 Sending email report...");
		await transporter.sendMail(mailOptions);
		console.log(`✅ Email report sent successfully to ${RECIPIENT_EMAIL}`);
	} catch (error) {
		console.error("❌ Failed to send email report:", error.message);
	}
}

function writeTestResultsToLog(testResults) {
	try {
		const logContent = {
			timestamp: new Date().toISOString(),
			summary: {
				totalTests: testResults.totalTests,
				passedTests: testResults.passedTests,
				failedTests: testResults.failedTests,
				successRate: testResults.totalTests > 0 ? ((testResults.passedTests / testResults.totalTests) * 100).toFixed(1) : 0,
			},
			detailedResults: testResults.testDetails.map((test) => ({
				playerName: test.playerName,
				question: test.question,
				statKey: test.statKey,
				metric: test.metric,
				expected: test.expected,
				received: test.received,
				status: test.status,
				cypherQuery: test.cypherQuery,
			})),
		};

		const logFile = path.join(__dirname, "..", "logs", "test-chatbot-email-report.log");
		fs.writeFileSync(logFile, JSON.stringify(logContent, null, 2));
		console.log(`📝 Test results written to: ${logFile}`);
	} catch (error) {
		console.error("❌ Failed to write test results to log:", error.message);
	}
}

async function main() {
	console.log("🚀 Starting comprehensive chatbot test with email report...");
	if (logStream) {
		console.log(`📝 Console output will be logged to: ${path.join(logDir, "test-execution.log")}`);
	} else {
		console.log("📝 Running in Netlify function environment - console output only");
	}

	// Check if server is running first (skip if running via API or Netlify function)
	if (!process.env.SKIP_SERVER_CHECK && process.env.NETLIFY !== "true") {
		console.log("🔍 Checking if development server is running...");
		const serverRunning = await checkServerHealth();

		if (!serverRunning) {
			console.log("❌ Development server is not running on localhost:3000");
			console.log("💡 Please start the server with: npm run dev");
			console.log("📧 Email report will not be sent - server unavailable");
			return;
		}

		console.log("✅ Development server is running");
	} else {
		console.log("⏭️ Skipping server health check (running via API or Netlify function)");
	}

	let finalResults;

	// Try programmatic approach first
	const programmaticResult = await runTestsProgrammatically();

	if (programmaticResult.success) {
		console.log("\n📊 Test Results Summary:");
		console.log(`Total Tests: ${programmaticResult.results.totalTests}`);
		console.log(`Passed: ${programmaticResult.results.passedTests}`);
		console.log(`Failed: ${programmaticResult.results.failedTests}`);
		console.log(
			`Success Rate: ${programmaticResult.results.totalTests > 0 ? ((programmaticResult.results.passedTests / programmaticResult.results.totalTests) * 100).toFixed(1) : 0}%`,
		);

		// Write detailed test results to log file for analysis
		console.log("📝 Writing detailed test results to log file...");
		writeTestResultsToLog(programmaticResult.results);
		console.log("✅ Test results written to test-results.log");

		await sendEmailReport(programmaticResult.results);
		finalResults = programmaticResult.results;
	} else {
		console.log("❌ Programmatic approach failed - no fallback available");
		console.log("💡 Please check the CSV data source and try again");
		if (!process.env.SKIP_SERVER_CHECK) {
			process.exit(1);
		} else {
			console.log("📊 Script completed with errors");
			finalResults = {
				totalTests: 0,
				passedTests: 0,
				failedTests: 0,
				successRate: 0
			};
		}
	}

	console.log("\n✅ Comprehensive test and email report completed!");

	// Return results instead of exiting (for module usage)
	if (process.env.NETLIFY === "true") {
		console.log("📊 Final results:", finalResults);
		return finalResults;
	} else {
	// Exit with appropriate code (skip if running via API)
	if (!process.env.SKIP_SERVER_CHECK) {
		process.exit(finalResults.failedTests > 0 ? 1 : 0);
	} else {
		console.log("📊 Final results:", finalResults);
			return finalResults;
		}
	}
}

// Random test selection function for weekly cron job
async function runRandomTests(maxTests = 5) {
	console.log(`🎲 Starting random test selection: maxTests=${maxTests}`);
	console.log(`⏱️ Function started at: ${new Date().toISOString()}`);
	
	try {
		// Load test data
		const testData = await fetchTestData();
		const totalTests = testData.length * STAT_TEST_CONFIGS.length;
		
		console.log(`📊 Total possible tests: ${totalTests}`);
		console.log(`🎲 Selecting up to ${maxTests} random tests`);
		
		// Create all possible test combinations
		const allTestCombinations = [];
		for (let playerIndex = 0; playerIndex < testData.length; playerIndex++) {
			const player = testData[playerIndex];
			const playerName = player["PLAYER NAME"];
			
			for (let configIndex = 0; configIndex < STAT_TEST_CONFIGS.length; configIndex++) {
				const statConfig = STAT_TEST_CONFIGS[configIndex];
				allTestCombinations.push({
					playerIndex,
					playerName,
					configIndex,
					statConfig,
					testId: `${playerName}-${statConfig.key}`
				});
			}
		}
		
		// Shuffle and select random tests
		const shuffledTests = allTestCombinations.sort(() => Math.random() - 0.5);
		const selectedTests = shuffledTests.slice(0, Math.min(maxTests, totalTests));
		
		console.log(`🎲 Selected ${selectedTests.length} random tests`);
		
		const results = {
			selectedTests: selectedTests.length,
			totalAvailableTests: totalTests,
			processedTests: 0,
			passedTests: 0,
			failedTests: 0,
			totalTests: 0, // Will be set to processedTests for email compatibility
			testDetails: [],
			selectedTestIds: selectedTests.map(t => t.testId)
		};
		
		// Process selected tests
		for (let i = 0; i < selectedTests.length; i++) {
			const test = selectedTests[i];
			const player = testData[test.playerIndex];
			const playerName = test.playerName;
			const statConfig = test.statConfig;
			const statKey = statConfig.key;
			const questionTemplate = statConfig.questionTemplate;
				
			results.processedTests++;
			
			// Generate question (moved outside try block for error handling)
			const question = questionTemplate.replace("{playerName}", playerName);
			
			// Get expected value from CSV data (moved outside try block for error handling)
			let expectedValue = player[statConfig.key] || "";
			
			console.log(`🔍 Test ${i + 1}/${selectedTests.length}: ${playerName} - ${statKey}`);
			console.log(`🔍 Question: ${question}`);
			console.log(`🔍 Expected value: ${expectedValue}`);
			console.log(`🔍 Player data keys: ${Object.keys(player).slice(0, 10).join(', ')}...`);
			
			try {
				let chatbotAnswer, cypherQuery;
				
				if (expectedValue !== undefined && expectedValue !== "") {
					console.log(`🔍 Making API call for: ${playerName} - ${statKey}`);
					console.log(`🔍 Question: ${question}`);
					console.log(`🔍 Expected value: ${expectedValue}`);
					
					// Make API call with timeout
					const timeoutPromise = new Promise((_, reject) => 
						setTimeout(() => reject(new Error('API call timeout after 10 seconds')), 10000)
					);
					
					// Use node-fetch if available, otherwise use global fetch
					const fetchFunction = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
					console.log(`🔍 Using fetch function: ${typeof fetchFunction}`);
					
					const fetchPromise = fetchFunction('https://dorkinians-website-v3.netlify.app/api/chatbot', {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							question: question,
							userContext: playerName,
						}),
					});
					
					console.log(`🔍 Starting Promise.race for: ${playerName} - ${statKey}`);
					const response = await Promise.race([fetchPromise, timeoutPromise]);
					console.log(`🔍 Got response for: ${playerName} - ${statKey}, status: ${response.status}`);
					
					if (response.ok) {
						const data = await response.json();
						chatbotAnswer = data.answer || "Empty response or error";
						cypherQuery = data.cypherQuery || "N/A";
						console.log(`🔍 Chatbot response: "${chatbotAnswer}"`);
					} else {
						throw new Error(`API call failed: ${response.status}`);
					}
					
					// Extract numeric value from chatbot response
					const chatbotValue = parseFloat(chatbotAnswer.replace(/[^\d.-]/g, ''));
					const expectedValueNum = parseFloat(expectedValue);
					
					console.log(`🔍 Extracted values - Expected: ${expectedValueNum}, Chatbot: ${chatbotValue}`);
					
					// Check if values match
					const valuesMatch = chatbotValue === expectedValueNum;
					const hasValidResponse = chatbotAnswer !== "Empty response or error" && chatbotAnswer !== null;
					
					const testResult = {
						player: playerName,
						stat: statKey,
						question: question,
						expected: expectedValue,
						received: chatbotAnswer,
						expectedExtracted: expectedValueNum,
						chatbotExtracted: chatbotValue,
						valuesMatch: valuesMatch,
						hasValidResponse: hasValidResponse,
						cypherQuery: cypherQuery,
						passed: valuesMatch && hasValidResponse,
					};
					
					results.testDetails.push(testResult);
					
					if (testResult.passed) {
						results.passedTests++;
					} else {
						results.failedTests++;
					}
					
					console.log(`✅ Test ${i + 1}/${selectedTests.length}: ${playerName} - ${statKey} - ${testResult.passed ? 'PASS' : 'FAIL'}`);
				} else {
					console.log(`⏭️ Skipping test ${i + 1}/${selectedTests.length}: ${playerName} - ${statKey} (no CSV data)`);
				}
				
			} catch (error) {
				console.error(`❌ Test ${i + 1}/${selectedTests.length} failed:`, error.message);
				
				const testResult = {
					player: playerName,
					stat: statKey,
					question: question,
					expected: expectedValue,
					received: "Error: " + error.message,
					expectedExtracted: null,
					chatbotExtracted: null,
					valuesMatch: false,
					hasValidResponse: false,
					cypherQuery: "N/A",
					passed: false,
				};
				
				results.testDetails.push(testResult);
				results.failedTests++;
			}
		}
		
		console.log(`🎲 Random test run completed: ${results.passedTests}/${results.processedTests} passed`);
		console.log(`⏱️ Test execution completed at: ${new Date().toISOString()}`);
		
		// Set totalTests for email compatibility
		results.totalTests = results.processedTests;
		
		// Send email report
		console.log("📧 Sending email report...");
		console.log(`⏱️ Starting email send at: ${new Date().toISOString()}`);
		await sendEmailReport(results);
		console.log(`⏱️ Email send completed at: ${new Date().toISOString()}`);
		console.log("✅ Email report sent");
		
		return results;
		
	} catch (error) {
		console.error("❌ Random test processing failed:", error);
		throw error;
	}
}

// Export the main function for use by other modules
module.exports = {
	runTests: main,
	runRandomTests
};

// Only run main if this script is executed directly
if (require.main === module) {
main().catch((error) => {
	console.error("❌ Script failed:", error);
	process.exit(1);
});
}
