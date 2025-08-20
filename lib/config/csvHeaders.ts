export interface CSVHeaderConfig {
	name: string;
	expectedHeaders: string[];
	description: string;
}

export const csvHeaderConfigs: CSVHeaderConfig[] = [
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
		],
		description: "Website configuration and metadata",
	},
	{
		name: "TBL_Players",
		expectedHeaders: ["PLAYER NAME", "ALLOW ON SITE", "MOST PLAYED FOR TEAM", "MOST COMMON POSITION"],
		description: "Player information with privacy flags and team/position data",
	},
	{
		name: "TBL_FixturesAndResults",
		expectedHeaders: [
			"SEASON FIX ID",
			"DATE",
			"TEAM",
			"COMP TYPE",
			"COMPETITION",
			"OPPOSITION",
			"HOME/AWAY",
			"RESULT",
			"HOME SCORE",
			"AWAY SCORE",
			"STATUS",
			"OPPO OWN GOALS",
			"FULL RESULT",
			"DORKINIANS GOALS",
			"CONCEDED",
		],
		description: "Fixture schedule and results with competition details",
	},
	{
		name: "TBL_MatchDetails",
		expectedHeaders: ["SEASON FIX ID", "TEAM", "PLAYER NAME", "DATE", "MIN", "CLASS", "MOM", "G", "A", "Y", "R", "SAVES", "OG", "PSC", "PM", "PCO", "PSV"],
		description: "Individual player performance data for each match",
	},
	{
		name: "TBL_WeeklyTOTW",
		expectedHeaders: [
			"SEASONWEEKNUMREF",
			"TOTW SCORE",
			"PLAYER COUNT",
			"STAR MAN",
			"STAR MAN SCORE",
			"GK1",
			"DEF1",
			"DEF2",
			"DEF3",
			"DEF4",
			"DEF5",
			"MID1",
			"MID2",
			"MID3",
			"MID4",
			"MID5",
			"FWD1",
			"FWD2",
			"FWD3",
		],
		description: "Weekly team of the week selections with player positions",
	},
	{
		name: "TBL_SeasonTOTW",
		expectedHeaders: [
			"DATE LOOKUP",
			"TOTW SCORE",
			"STAR MAN",
			"STAR MAN SCORE",
			"GK1",
			"DEF1",
			"DEF2",
			"DEF3",
			"DEF4",
			"DEF5",
			"MID1",
			"MID2",
			"MID3",
			"MID4",
			"MID5",
			"FWD1",
			"FWD2",
			"FWD3",
		],
		description: "Season-end team of the year selections",
	},
	{
		name: "TBL_PlayersOfTheMonth",
		expectedHeaders: [
			"SEASONMONTHREF",
			"#1 Name",
			"#1 Points",
			"#2 Name",
			"#2 Points",
			"#3 Name",
			"#3 Points",
			"#4 Name",
			"#4 Points",
			"#5 Name",
			"#5 Points",
		],
		description: "Monthly player awards with rankings and points",
	},
	{
		name: "TBL_OppositionDetails",
		expectedHeaders: ["OPPOSITION", "SHORT TEAM NAME", "ADDRESS", "DISTANCE (MILES)"],
		description: "Opposition team information and contact details",
	},

	{
		name: "TBL_CaptainsAndAwards",
		expectedHeaders: [
			"Item",
			"HTML ID",
			"2016/17",
			"2017/18",
			"2018/19",
			"2019/20",
			"2020/21",
			"2021/22",
			"2022/23",
			"2023/24",
			"2024/25",
			"2025/26",
			"2026/27",
		],
		description: "Season awards and captain information",
	},
];

export const getCSVHeaderConfig = (name: string): CSVHeaderConfig | undefined => {
	return csvHeaderConfigs.find((config) => config.name === name);
};

export const getAllCSVHeaderConfigs = (): CSVHeaderConfig[] => {
	return csvHeaderConfigs;
};
