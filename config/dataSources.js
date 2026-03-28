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
	// TBL_TestQuestions - SKIPPED (no schema defined, not used for seeding)
	// {
	// 	name: "TBL_TestQuestions",
	// 	url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1744030592&single=true&output=csv",
	// 	type: "StatsData",
	// },
	// TBL_DataSources - SKIPPED for memory optimization (web scraping disabled)
	// {
	// 	name: "TBL_DataSources",
	// 	url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1415487809&single=true&output=csv",
	// 	type: "StatsData",
	// },
	{
		name: "TBL_1stXILeague",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=443390703&single=true&output=csv",
		type: "TableData",
	},
	{
		name: "TBL_2ndXILeague",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1656985095&single=true&output=csv",
		type: "TableData",
	},
	{
		name: "TBL_3rdXILeague",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1005826701&single=true&output=csv",
		type: "TableData",
	},
	{
		name: "TBL_4thXILeague",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=416045207&single=true&output=csv",
		type: "TableData",
	},
	{
		name: "TBL_5thXILeague",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1046199249&single=true&output=csv",
		type: "TableData",
	},
	{
		name: "TBL_6thXILeague",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1780820842&single=true&output=csv",
		type: "TableData",
	},
	{
		name: "TBL_7thXILeague",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=647273768&single=true&output=csv",
		type: "TableData",
	},
	{
		name: "TBL_LeagueSources",
		url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1495269899&single=true&output=csv",
		type: "Metadata",
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
	getDataSourcesByName
};
