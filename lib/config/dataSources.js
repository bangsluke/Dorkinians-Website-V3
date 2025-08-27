/**
 * Data Sources Configuration for Dorkinians Website
 * 
 * ⚠️  DO NOT MODIFY THIS FILE DIRECTLY ⚠️
 * This file is automatically copied from netlify/functions/lib/config/dataSources.js
 * 
 * To update data sources:
 * 1. Edit the file in netlify/functions/lib/config/dataSources.js
 * 2. Commit the changes
 * 3. This file will be automatically updated
 * 
 * Auto-synced on 2025-08-27T13:38:00.000Z
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
