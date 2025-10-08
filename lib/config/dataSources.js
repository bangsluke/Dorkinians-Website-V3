/**
 * Data Sources Configuration for Dorkinians Website
 *
 * ⚠️  DO NOT MODIFY THIS FILE DIRECTLY ⚠️
 * This file is automatically copied from database-dorkinians/config/dataSources.js
 *
 * To update data sources:
 * 1. Edit the file in database-dorkinians/config/dataSources.js
 * 2. Run: npm run sync-config
 * 3. This file will be automatically updated
 *
 * Auto-synced on 2025-10-03T17:27:34.875Z
 */
/**
 * Master
 * Data Sources Configuration for Dorkinians Database
 *
 * This file defines:
 * 1. CSV data source URLs for Google Sheets
 * 2. Data source types and metadata
 * 3. Helper functions for filtering and querying
 *
 * TEST: Git hook should now work with batch file (enhanced debugging)
 */

const dataSources = [
	// Stats Data (Google Sheets CSVs)
	{
		name: "TBL_SiteDetails",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=77050817&single=true&output=csv",
		type: "StatsData",
	},
	{
		name: "TBL_Players",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1796371215&single=true&output=csv",
		type: "StatsData",
	},
	{
		name: "TBL_FixturesAndResults",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=103750289&single=true&output=csv",
		type: "StatsData",
	},
	{
		name: "TBL_MatchDetails",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=564691931&single=true&output=csv",
		type: "StatsData",
	},
	{
		name: "TBL_WeeklyTOTW",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1985336995&single=true&output=csv",
		type: "StatsData",
	},
	{
		name: "TBL_SeasonTOTW",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=91372781&single=true&output=csv",
		type: "StatsData",
	},
	{
		name: "TBL_PlayersOfTheMonth",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=2007852556&single=true&output=csv",
		type: "StatsData",
	},
	{
		name: "TBL_CaptainsAndAwards",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1753413613&single=true&output=csv",
		type: "StatsData",
	},
	{
		name: "TBL_OppositionDetails",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1977394709&single=true&output=csv",
		type: "StatsData",
	},
	{
		name: "TBL_TestData",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=14183891&single=true&output=csv",
		type: "StatsData",
	},
	// FA Site Data (The FA Full Time)
	{
		name: "FA_2016-17_1stXI_Results",
		url: "https://fulltime.thefa.com/results.html?selectedSeason=559712266&selectedFixtureGroupKey=&selectedRelatedFixtureOption=2&selectedClub=938244043&selectedTeam=506738919&selectedDateCode=all&previousSelectedFixtureGroupAgeGroup=&previousSelectedFixtureGroupKey=&previousSelectedClub=938244043",
		type: "FASiteData",
		season: "2016-17",
		team: "1st XI",
		category: "results",
	},
	{
		name: "FA_2016-17_1stXI_Table",
		url: "https://fulltime.thefa.com/table.html?selectedSeason=559712266&selectedDivision=8368223&ftsTablePageContent.fixtureAnalysisForm.standingsTableDay=15&ftsTablePageContent.fixtureAnalysisForm.standingsTableMonth=7&ftsTablePageContent.fixtureAnalysisForm.standingsTableYear=2025&activeTab=1",
		type: "FASiteData",
		season: "2016-17",
		team: "1st XI",
		category: "league",
	},
	{
		name: "FA_2016-17_2ndXI_Results",
		url: "TBC",
		type: "FASiteData",
		season: "2016-17",
		team: "2nd XI",
		category: "results",
	},
	{
		name: "FA_2016-17_2ndXI_Table",
		url: "TBC",
		type: "FASiteData",
		season: "2016-17",
		team: "2nd XI",
		category: "league",
	},
	{
		name: "FA_2024-25_1stXI_Table",
		url: "https://fulltime.thefa.com/table.html?selectedSeason=538136488&selectedDivision=921408008&ftsTablePageContent.fixtureAnalysisForm.standingsTableDay=5&ftsTablePageContent.fixtureAnalysisForm.standingsTableMonth=8&ftsTablePageContent.fixtureAnalysisForm.standingsTableYear=2025&activeTab=1",
		type: "FASiteData",
		season: "2024-25",
		team: "1st XI",
		category: "league",
	},
];

const getDataSourcesByType = (type) => {
	return dataSources.filter((source) => source.type === type);
};

const getDataSourcesByName = (names) => {
	return dataSources.filter((source) => names.includes(source.name));
};

module.exports = {
	dataSources,
	getDataSourcesByType,
	getDataSourcesByName,
};
