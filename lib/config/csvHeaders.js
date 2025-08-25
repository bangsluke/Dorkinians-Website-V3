// CommonJS version of CSV header configuration for Netlify Functions compatibility

const csvHeaderConfigs = [
	{
		name: "TBL_SiteDetails",
		expectedHeaders: [
			"Version Number",
			"Version Release Details",
			"Updates To Come",
			"Last Updated Stats",
			"Page Details Last Refreshed",
			"Current Season",
			"Stat Limitations",
			"Stat Details",
			"Games Counted",
			"Games without all goals accounted",
			"Game rate with all goals accounted.",
			"Games without a MoM provided",
			"Game rate with a MoM accounted.",
			"Dorkinians Goals Scored",
			"Dorkinians Goals Conceded",
		],
		description: "Website configuration and metadata",
	},
	{
		name: "TBL_Players",
		expectedHeaders: ["ID","PLAYER NAME", "ALLOW ON SITE", "MOST PLAYED FOR TEAM", "MOST COMMON POSITION"],
		description: "Player information with privacy flags and team/position data",
	},
	{
		name: "TBL_FixturesAndResults",
		expectedHeaders: ["DATE", "OPPOSITION", "COMP TYPE", "HOME/AWAY", "SCORE", "RESULT"],
		description: "Match fixtures and results data",
	},
	{
		name: "TBL_MatchDetails",
		expectedHeaders: ["PLAYER NAME", "G", "A", "MOM", "DATE", "OPPOSITION"],
		description: "Individual player performance in matches",
	},
	{
		name: "TBL_WeeklyTOTW",
		expectedHeaders: ["WEEK", "STAR MAN", "REASON", "DATE"],
		description: "Weekly team of the week selections",
	},
	{
		name: "TBL_SeasonTOTW",
		expectedHeaders: ["SEASON", "STAR MAN", "REASON", "VOTES"],
		description: "Season-end team of the year selections",
	},
	{
		name: "TBL_PlayersOfTheMonth",
		expectedHeaders: ["DATE", "#1 Name", "#2 Name", "#3 Name", "VOTES"],
		description: "Monthly player of the month awards",
	},
	{
		name: "TBL_CaptainsAndAwards",
		expectedHeaders: ["Item", "Description", "Season"],
		description: "Captain appointments and special awards",
	},
	{
		name: "TBL_OppositionDetails",
		expectedHeaders: ["OPPOSITION", "LOCATION", "CONTACT", "NOTES"],
		description: "Opposition team information and details",
	},
	{
		name: "TBL_TestData",
		expectedHeaders: ["PLAYER NAME", "TEST VALUE", "DATE"],
		description: "Test data for development and debugging",
	}
];

function getCSVHeaderConfig(name) {
	return csvHeaderConfigs.find((config) => config.name === name);
}

function getAllCSVHeaderConfigs() {
	return csvHeaderConfigs;
}

module.exports = {
	getCSVHeaderConfig,
	getAllCSVHeaderConfigs,
	csvHeaderConfigs
};
