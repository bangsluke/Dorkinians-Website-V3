import nlp from "compromise";
import { EntityNameResolver } from "../services/entityNameResolver";

export interface EntityExtractionResult {
	entities: EntityInfo[];
	statTypes: StatTypeInfo[];
	statIndicators: StatIndicatorInfo[];
	questionTypes: QuestionTypeInfo[];
	negativeClauses: NegativeClauseInfo[];
	locations: LocationInfo[];
	timeFrames: TimeFrameInfo[];
	competitionTypes: CompetitionTypeInfo[];
	competitions: CompetitionInfo[];
	results: ResultInfo[];
	opponentOwnGoals: boolean;
	goalInvolvements: boolean;
}

export interface EntityInfo {
	value: string;
	type:
		| "player"
		| "team"
		| "fixture"
		| "weeklyTOTW"
		| "seasonTOTW"
		| "playersOfTheMonth"
		| "captainAndAwards"
		| "league"
		| "opposition"
		| "competitionType"
		| "competition"
		| "result";
	originalText: string;
	position: number;
}

export interface StatTypeInfo {
	value: string;
	originalText: string;
	position: number;
}

export interface StatIndicatorInfo {
	value: "highest" | "lowest" | "longest" | "shortest" | "most" | "least" | "average";
	originalText: string;
	position: number;
}

export interface QuestionTypeInfo {
	value: "how" | "how_many" | "where" | "where_did" | "what" | "whats" | "who" | "who_did" | "which";
	originalText: string;
	position: number;
}

export interface NegativeClauseInfo {
	value: string;
	originalText: string;
	position: number;
}

export interface LocationInfo {
	value: string;
	type: "home" | "away" | "ground";
	originalText: string;
	position: number;
}

export interface TimeFrameInfo {
	value: string;
	type: "date" | "season" | "weekend" | "gameweek" | "consecutive" | "range" | "ordinal_weekend" | "since" | "before";
	originalText: string;
	position: number;
}

export interface CompetitionTypeInfo {
	value: string;
	type: "league" | "cup" | "friendly";
	originalText: string;
	position: number;
}

export interface CompetitionInfo {
	value: string;
	originalText: string;
	position: number;
}

export interface ResultInfo {
	value: string;
	type: "win" | "draw" | "loss" | "W" | "D" | "L";
	originalText: string;
	position: number;
}

// Entity pseudonyms and antonyms
export const ENTITY_PSEUDONYMS = {
	// Player references
	I: ["i", "i've", "me", "my", "myself"],
	Pixham: ["pixham", "home ground", "our ground"],

	// Teams
	"1s": ["1s", "1st", "first team", "firsts", "1st team"],
	"2s": ["2s", "2nd", "second team", "seconds", "2nd team"],
	"3s": ["3s", "3rd", "third team", "thirds", "3rd team"],
	"4s": ["4s", "4th", "fourth team", "fourths", "4th team"],
	"5s": ["5s", "5th", "fifth team", "fifths", "5th team"],
	"6s": ["6s", "6th", "sixth team", "sixths", "6th team"],
	"7s": ["7s", "7th", "seventh team", "sevenths", "7th team"],
	"8s": ["8s", "8th", "eighth team", "eighths", "8th team"],

	// Leagues
	Premier: ["premier", "premier league", "prem"],
	"Intermediate South": ["intermediate"],
	"League One": ["league one", "league 1", "l1"],
	"League Two": ["league two", "league 2", "l2"],
	Conference: ["conference", "conf"],
	"National League": ["national league", "national"],
};

// Stat type pseudonyms and antonyms
export const STAT_TYPE_PSEUDONYMS = {
	"Own Goals": ["own goals scored", "own goal scored", "own goals", "own goal", "og"],
	"Goals Conceded": ["goals has conceded", "goals have conceded", "goals conceded", "conceded goals", "goals against"],
	Goals: [
		"goals(?!\\s+(?:on\\s+average\\s+does|conceded|from\\s+open\\s+play|in\\s+open\\s+play))",
		"scoring",
		"prolific",
		"strikes",
		"finishes",
		"netted",
		"scored",
		"get",
		"got",
		"goal stats",
		"goal count",
		"score",
	],
	"Open Play Goals": [
		"open play goals",
		"open play goal",
		"goals from open play",
		"goals in open play",
		"goals scored from open play",
		"goals scored in open play",
		"scored from open play",
		"scored in open play",
		"non-penalty goals",
		"non penalty goals",
	],
	Assists: ["assists made", "assists provided", "assists", "assist", "assisting", "assisted", "get", "got"],
	Apps: [
		"apps",
		"played in",
		"played with",
		"Appearances",
		"total appearances",
		"number of appearances",
		"how many appearances",
		"appearances made",
		"appearances played",
	],
	Minutes: ["minutes of football", "minutes played", "playing time", "time played", "minutes", "minute", "mins"],
	"Yellow Cards": ["yellow cards", "yellow card", "yellows", "bookings", "cautions"],
	"Red Cards": ["red cards", "red card", "reds", "dismissals", "sendings off", "sent off", "been sent off", "getting sent off", "got sent off"],
	Saves: ["goalkeeper saves", "saves made", "saves", "save", "saved", "get", "got"],
	"Clean Sheets": ["clean sheet kept", "clean sheets", "clean sheet", "shutouts", "kept clean", "clean sheets scored"],
	"Minutes Per Clean Sheet": [
		"minutes does.*need to get a clean sheet",
		"minutes per clean sheet",
		"mins per clean sheet",
		"time per clean sheet",
		"minutes on average.*clean sheet",
		"average minutes.*clean sheet",
	],
	"Penalties Scored": [
		"penalties have scored",
		"penalties has scored",
		"penalties scored",
		"penalty scored",
		"penalty goals",
		"pen scored",
		"penalties.*scored",
	],
	"Penalties Missed": [
		"penalties have missed",
		"penalties has missed",
		"penalties missed",
		"penalty missed",
		"missed penalties",
		"pen missed",
		"penalties.*missed",
	],
	"Penalties Conceded": [
		"penalties conceded",
		"penalty conceded",
		"pen conceded",
		"conceded penalties",
		"penalties has conceded",
		"penalties have conceded",
		"penalties.*conceded",
	],
	"Penalties Saved": [
		"penalties have saved",
		"penalties has saved",
		"penalties saved",
		"penalty saved",
		"saved penalties",
		"pen saved",
		"penalties.*saved",
	],
	"Penalties Scored in Penalty Shootout": [
		"penalties scored in penalty shootout",
		"penalty scored in penalty shootout",
		"penalty shootout scored",
		"penalty shootout goals",
		"ps scored",
		"shootout penalty scored",
		"penalty shootout conversion",
		"ps-psc",
	],
	"Penalties Missed in Penalty Shootout": [
		"penalties missed in penalty shootout",
		"penalty missed in penalty shootout",
		"penalty shootout missed",
		"ps missed",
		"shootout penalty missed",
		"penalty shootout failure",
		"ps failure",
		"ps-pm",
	],
	"Penalties Saved in Penalty Shootout": [
		"penalties saved in penalty shootout",
		"penalty saved in penalty shootout",
		"penalty shootout saved",
		"ps saved",
		"shootout penalty saved",
		"penalty shootout stop",
		"ps stop",
		"ps-psv",
	],
	"Goal Involvements": ["goal involvements", "goal involvement", "goals and assists", "contributions"],
	"Man of the Match": ["man of the match", "player of the match", "best player", "mom", "moms"],
	"Double Game Weeks": ["double game weeks", "double games", "dgw", "double weeks"],
	"Team of the Week": ["team of the week", "totw", "weekly selection", "weekly team"],
	"Season Team of the Week": ["season team of the week", "season totw", "seasonal selection"],
	"Player of the Month": ["player of the month", "potm", "monthly award"],
	"Captain Awards": ["captain awards", "captain honors", "captaincy", "captain"],
	"Co Players": ["co players", "teammates", "played with", "team mates"],
	Opponents: ["opponents", "played against", "faced", "versus"],
	"Fantasy Points": ["fantasy points", "fantasy score", "fantasy point", "points", "ftp", "fp"],
	"Goals Per Appearance": ["goals per game", "goals per match", "goals on average scored", "average goals scored", "goals on average.*scored per appearance", "goals.*average.*per appearance"],
	"Conceded Per Appearance": [
		"goals on average does.*concede per match",
		"goals on average does.*concede per game",
		"conceded on average does",
		"conceded per app",
		"conceded per game",
		"conceded per match",
		"conceded on average",
		"average conceded",
	],
	"Minutes Per Goal": [
		"minutes does it take on average.*to score",
		"minutes does it take.*to score",
		"minutes does it take on average",
		"minutes does it take",
		"minutes per goal",
		"mins per goal",
		"time per goal",
		"minutes on average.*to score",
		"average minutes.*to score",
		"minutes on average",
		"average minutes",
	],
	Score: ["goals scored", "scores", "scoring", "score"],
	Awards: ["awards", "prizes", "honors", "honours", "recognition"],
	Leagues: ["leagues", "league titles", "championships", "titles"],
	"Penalty record": ["penalty conversion rate", "penalty record", "spot kick record", "pen conversion"],
	Home: ["home games", "home matches", "at home"],
	Away: ["away games", "away matches", "away from home", "on the road", "away"],
	"Home Wins": [
		"home wins",
		"home victories",
		"home games won",
		"wins at home",
		"home matches won",
		"home games has.*won",
		"home games have.*won",
		"home games ha(?:s|ve).*won",
	],
	"Away Wins": [
		"away wins",
		"away victories",
		"away games won",
		"wins away",
		"away matches won",
		"away games has.*won",
		"away games have.*won",
		"away games ha(?:s|ve).*won",
	],
	"Home Games % Won": [
		"home games percentage won",
		"home games percent won",
		"home games % won",
		"percentage of home games won",
		"percent of home games won",
		"% of home games won",
		"home win rate",
		"home success rate",
	],
	"Away Games % Won": [
		"away games percentage won",
		"away games percent won",
		"away games % won",
		"percentage of away games won",
		"percent of away games won",
		"% of away games won",
		"away win rate",
		"away success rate",
	],
	"Games % Won": [
		"games percentage won",
		"games percent won",
		"games % won",
		"percentage of games won",
		"percent of games won",
		"% of games won",
		"win rate",
		"success rate",
		"overall win rate",
	],
	"Number Teams Played For": [
		"teams count",
		"team count",
		"club teams",
		"clubs teams",
		"club's teams",
		"club team count",
		"how many of the clubs teams",
		"how many of the club's teams",
		"how many of the club teams",
		"how many of the clubs team",
		"how many of the club's team",
		"how many of the club team",
	],
	"Most Prolific Season": [
		"most prolific season",
		"best season",
		"top season",
		"highest scoring season",
		"prolific season",
		"was most prolific season",
		"most prolific season was",
		"what was most prolific season",
		"most prolific season what",
		"prolific season was",
		"was prolific season",
		"season I scored the most goals",
		"season I scored most goals",
		"season did I score the most goals",
		"season did I score most goals",
		"when did I score the most goals",
		"when did I score most goals",
		"what was the season I scored the most goals",
		"which was the season I scored the most goals",
		"what season did I score the most goals",
		"which season did I score the most goals",
		"season with the most goals",
		"season with most goals",
	],
	"Assists Per Appearance": [
		"assists per app",
		"assists per game",
		"assisting rate",
		"assists on average",
		"average assists",
		"assists per match",
	],
	"Fantasy Points Per Appearance": [
		"fantasy points does.*score per appearance",
		"fantasy points per appearance",
		"fantasy points per app",
		"fantasy points per game",
		"fantasy rate",
		"fantasy points on average",
		"average fantasy points",
		"fantasy points per match",
	],
	"Goals Conceded Per Appearance": [
		"goals conceded per app",
		"goals conceded per game",
		"conceding rate",
		"goals conceded on average",
		"average goals conceded",
		"goals conceded per match",
	],
	"Minutes Per Appearance": [
		"minutes per appearance",
		"minutes per app",
		"minutes per game",
		"time per appearance",
		"time per app",
		"time per game",
		"minutes on average",
		"average minutes",
	],
	"Man of the Match Per Appearance": [
		"mom per appearance",
		"mom per app",
		"mom per game",
		"man of the match per appearance",
		"man of the match per app",
		"man of the match per game",
		"mom on average",
		"average mom",
	],
	"Yellow Cards Per Appearance": [
		"yellow cards per appearance",
		"yellow cards per app",
		"yellow cards per game",
		"yellows per appearance",
		"yellows per app",
		"yellows per game",
		"yellow cards on average",
		"average yellow cards",
	],
	"Red Cards Per Appearance": [
		"red cards per appearance",
		"red cards per app",
		"red cards per game",
		"reds per appearance",
		"reds per app",
		"reds per game",
		"red cards on average",
		"average red cards",
	],
	"Saves Per Appearance": [
		"saves per appearance",
		"saves per app",
		"saves per game",
		"save per appearance",
		"save per app",
		"save per game",
		"saves on average",
		"average saves",
	],
	"Own Goals Per Appearance": [
		"own goals per appearance",
		"own goals per app",
		"own goals per game",
		"own goal per appearance",
		"own goal per app",
		"own goal per game",
		"own goals on average",
		"average own goals",
	],
	"Clean Sheets Per Appearance": [
		"clean sheets per appearance",
		"clean sheets per app",
		"clean sheets per game",
		"clean sheet per appearance",
		"clean sheet per app",
		"clean sheet per game",
		"clean sheets on average",
		"average clean sheets",
	],
	"Penalties Scored Per Appearance": [
		"penalties scored per appearance",
		"penalties scored per app",
		"penalties scored per game",
		"penalty scored per appearance",
		"penalty scored per app",
		"penalty scored per game",
		"penalties scored on average",
		"average penalties scored",
	],
	"Penalties Missed Per Appearance": [
		"penalties missed per appearance",
		"penalties missed per app",
		"penalties missed per game",
		"penalty missed per appearance",
		"penalty missed per app",
		"penalty missed per game",
		"penalties missed on average",
		"average penalties missed",
	],
	"Penalties Conceded Per Appearance": [
		"penalties conceded per appearance",
		"penalties conceded per app",
		"penalties conceded per game",
		"penalty conceded per appearance",
		"penalty conceded per app",
		"penalty conceded per game",
		"penalties conceded on average",
		"average penalties conceded",
	],
	"Penalties Saved Per Appearance": [
		"penalties saved per appearance",
		"penalties saved per app",
		"penalties saved per game",
		"penalty saved per appearance",
		"penalty saved per app",
		"penalty saved per game",
		"penalties saved on average",
		"average penalties saved",
	],
	"Team Analysis": ["most appearances for", "most goals for", "played for", "teams played for", "teams played in", "how many teams", "how many of the teams"],
	"Season Analysis": ["seasons played in", "seasons", "years played"],
	"Season Count With Total": ["how many of the seasons", "how many of the clubs seasons", "how many of the clubs recorded seasons", "how many of the clubs stat recorded seasons", "seasons played for", "seasons played in"],
	"Season Count Simple": ["how many seasons has", "for how many seasons has", "how many seasons did", "for how many seasons did"],
	"Distance Travelled": [
		"distance travelled",
		"distance traveled",
		"miles travelled",
		"miles traveled",
		"how far",
		"travelled",
		"traveled",
		"distance",
		"miles",
	],
	// Position-related stat types
	"Goalkeeper Appearances": [
		"goalkeeper appearances",
		"goalkeeper appearance",
		"gk appearances",
		"gk appearance",
		"keeper appearances",
		"keeper appearance",
		"goalie appearances",
		"goalie appearance",
		"been a goalkeeper",
		"played as goalkeeper",
		"goalkeeper games",
		"goalkeeper games played",
		"times played as goalkeeper",
		"games played as goalkeeper",
		"played as a goalkeeper",
		"times has played as goalkeeper",
		"games has played as goalkeeper",
	],
	"Defender Appearances": [
		"defender appearances",
		"defender appearance",
		"def appearances",
		"def appearance",
		"defence appearances",
		"defence appearance",
		"defense appearances",
		"defense appearance",
		"been a defender",
		"played as defender",
		"defender games",
		"defender games played",
		"times played as defender",
		"games played as defender",
		"played as a defender",
		"times has played as defender",
		"games has played as defender",
	],
	"Midfielder Appearances": [
		"midfielder appearances",
		"midfielder appearance",
		"mid appearances",
		"mid appearance",
		"center mid appearances",
		"center mid appearance",
		"central midfielder appearances",
		"central midfielder appearance",
		"been a midfielder",
		"played as midfielder",
		"midfielder games",
		"midfielder games played",
	],
	"Forward Appearances": [
		"forward appearances",
		"forward appearance",
		"fwd appearances",
		"fwd appearance",
		"striker appearances",
		"striker appearance",
		"attacker appearances",
		"attacker appearance",
		"been a forward",
		"played as forward",
		"forward games",
		"forward games played",
	],
	"Most Common Position": [
		"most common position",
		"favorite position",
		"main position",
		"primary position",
		"position played most",
		"most played position",
		"commonest position",
		"usual position",
		"position has played most",
		"what position has played most",
		"position played the most",
		"most frequent position",
		"position most often",
	],

	// Team-specific appearances
	"1st XI Apps": [
		"1st team appearances",
		"1st team apps",
		"1st team games",
		"1s appearances",
		"1s apps",
		"1s games",
		"appearances for 1s",
		"apps for 1s",
		"games for 1s",
		"appearances for 1st",
		"apps for 1st",
		"games for 1st",
		"appearances for the 1s",
		"apps for the 1s",
		"games for the 1s",
		"appearances for the 1st",
		"apps for the 1st",
		"games for the 1st",
	],
	"2nd XI Apps": [
		"2nd team appearances",
		"2nd team apps",
		"2nd team games",
		"2s appearances",
		"2s apps",
		"2s games",
		"appearances for 2s",
		"apps for 2s",
		"games for 2s",
		"appearances for 2nd",
		"apps for 2nd",
		"games for 2nd",
		"appearances for the 2s",
		"apps for the 2s",
		"games for the 2s",
		"appearances for the 2nd",
		"apps for the 2nd",
		"games for the 2nd",
	],
	"3rd XI Apps": [
		"3rd team appearances",
		"3rd team apps",
		"3rd team games",
		"3s appearances",
		"3s apps",
		"3s games",
		"appearances for 3s",
		"apps for 3s",
		"games for 3s",
		"appearances for 3rd",
		"apps for 3rd",
		"games for 3rd",
		"appearances for the 3s",
		"apps for the 3s",
		"games for the 3s",
		"appearances for the 3rd",
		"apps for the 3rd",
		"games for the 3rd",
	],
	"4th XI Apps": [
		"4th team appearances",
		"4th team apps",
		"4th team games",
		"4s appearances",
		"4s apps",
		"4s games",
		"appearances for 4s",
		"apps for 4s",
		"games for 4s",
		"appearances for 4th",
		"apps for 4th",
		"games for 4th",
		"appearances for the 4s",
		"apps for the 4s",
		"games for the 4s",
		"appearances for the 4th",
		"apps for the 4th",
		"games for the 4th",
	],
	"5th XI Apps": [
		"5th team appearances",
		"5th team apps",
		"5th team games",
		"5s appearances",
		"5s apps",
		"5s games",
		"appearances for 5s",
		"apps for 5s",
		"games for 5s",
		"appearances for 5th",
		"apps for 5th",
		"games for 5th",
		"appearances for the 5s",
		"apps for the 5s",
		"games for the 5s",
		"appearances for the 5th",
		"apps for the 5th",
		"games for the 5th",
	],
	"6th XI Apps": [
		"6th team appearances",
		"6th team apps",
		"6th team games",
		"6s appearances",
		"6s apps",
		"6s games",
		"appearances for 6s",
		"apps for 6s",
		"games for 6s",
		"appearances for 6th",
		"apps for 6th",
		"games for 6th",
		"appearances for the 6s",
		"apps for the 6s",
		"games for the 6s",
		"appearances for the 6th",
		"apps for the 6th",
		"games for the 6th",
	],
	"7th XI Apps": [
		"7th team appearances",
		"7th team apps",
		"7th team games",
		"7s appearances",
		"7s apps",
		"7s games",
		"appearances for 7s",
		"apps for 7s",
		"games for 7s",
		"appearances for 7th",
		"apps for 7th",
		"games for 7th",
		"appearances for the 7s",
		"apps for the 7s",
		"games for the 7s",
		"appearances for the 7th",
		"apps for the 7th",
		"games for the 7th",
	],
	"8th XI Apps": [
		"8th team appearances",
		"8th team apps",
		"8th team games",
		"8s appearances",
		"8s apps",
		"8s games",
		"appearances for 8s",
		"apps for 8s",
		"games for 8s",
		"appearances for 8th",
		"apps for 8th",
		"games for 8th",
		"appearances for the 8s",
		"apps for the 8s",
		"games for the 8s",
		"appearances for the 8th",
		"apps for the 8th",
		"games for the 8th",
	],
	// Season-specific appearances
	"2016/17 Apps": [
		"2016/17 appearances",
		"appearances in 2016/17",
		"apps in 2016/17",
		"games in 2016/17",
		"appear in 2016/17",
		"2016/17 apps",
		"2016/17 games",
		"2016/17 season appearances",
		"2016/17 season apps",
		"2016/17 season games",
		"appearances in 2016-17",
		"apps in 2016-17",
		"games in 2016-17",
		"appear in 2016-17",
		"2016-17 appearances",
		"2016-17 apps",
		"2016-17 games",
		"appearances in 16/17",
		"apps in 16/17",
		"games in 16/17",
		"appear in 16/17",
		"16/17 appearances",
		"16/17 apps",
		"16/17 games",
		"appearances in 16-17",
		"apps in 16-17",
		"games in 16-17",
		"appear in 16-17",
		"16-17 appearances",
		"16-17 apps",
		"16-17 games",
	],
	"2017/18 Apps": [
		"2017/18 appearances",
		"appearances in 2017/18",
		"apps in 2017/18",
		"games in 2017/18",
		"appear in 2017/18",
		"2017/18 apps",
		"2017/18 games",
		"2017/18 season appearances",
		"2017/18 season apps",
		"2017/18 season games",
		"appearances in 2017-18",
		"apps in 2017-18",
		"games in 2017-18",
		"appear in 2017-18",
		"2017-18 appearances",
		"2017-18 apps",
		"2017-18 games",
		"appearances in 17/18",
		"apps in 17/18",
		"games in 17/18",
		"appear in 17/18",
		"17/18 appearances",
		"17/18 apps",
		"17/18 games",
		"appearances in 17-18",
		"apps in 17-18",
		"games in 17-18",
		"appear in 17-18",
		"17-18 appearances",
		"17-18 apps",
		"17-18 games",
	],
	"2018/19 Apps": [
		"2018/19 appearances",
		"appearances in 2018/19",
		"apps in 2018/19",
		"games in 2018/19",
		"appear in 2018/19",
		"2018/19 apps",
		"2018/19 games",
		"2018/19 season appearances",
		"2018/19 season apps",
		"2018/19 season games",
		"appearances in 2018-19",
		"apps in 2018-19",
		"games in 2018-19",
		"appear in 2018-19",
		"2018-19 appearances",
		"2018-19 apps",
		"2018-19 games",
		"appearances in 18/19",
		"apps in 18/19",
		"games in 18/19",
		"appear in 18/19",
		"18/19 appearances",
		"18/19 apps",
		"18/19 games",
		"appearances in 18-19",
		"apps in 18-19",
		"games in 18-19",
		"appear in 18-19",
		"18-19 appearances",
		"18-19 apps",
		"18-19 games",
	],
	"2019/20 Apps": [
		"2019/20 appearances",
		"appearances in 2019/20",
		"apps in 2019/20",
		"games in 2019/20",
		"appear in 2019/20",
		"2019/20 apps",
		"2019/20 games",
		"2019/20 season appearances",
		"2019/20 season apps",
		"2019/20 season games",
		"appearances in 2019-20",
		"apps in 2019-20",
		"games in 2019-20",
		"appear in 2019-20",
		"2019-20 appearances",
		"2019-20 apps",
		"2019-20 games",
		"appearances in 19/20",
		"apps in 19/20",
		"games in 19/20",
		"appear in 19/20",
		"19/20 appearances",
		"19/20 apps",
		"19/20 games",
		"appearances in 19-20",
		"apps in 19-20",
		"games in 19-20",
		"appear in 19-20",
		"19-20 appearances",
		"19-20 apps",
		"19-20 games",
	],
	"2020/21 Apps": [
		"2020/21 appearances",
		"appearances in 2020/21",
		"apps in 2020/21",
		"games in 2020/21",
		"appear in 2020/21",
		"2020/21 apps",
		"2020/21 games",
		"2020/21 season appearances",
		"2020/21 season apps",
		"2020/21 season games",
		"appearances in 2020-21",
		"apps in 2020-21",
		"games in 2020-21",
		"appear in 2020-21",
		"2020-21 appearances",
		"2020-21 apps",
		"2020-21 games",
		"appearances in 20/21",
		"apps in 20/21",
		"games in 20/21",
		"appear in 20/21",
		"20/21 appearances",
		"20/21 apps",
		"20/21 games",
		"appearances in 20-21",
		"apps in 20-21",
		"games in 20-21",
		"appear in 20-21",
		"20-21 appearances",
		"20-21 apps",
		"20-21 games",
	],
	"2021/22 Apps": [
		"2021/22 appearances",
		"appearances in 2021/22",
		"apps in 2021/22",
		"games in 2021/22",
		"appear in 2021/22",
		"2021/22 apps",
		"2021/22 games",
		"2021/22 season appearances",
		"2021/22 season apps",
		"2021/22 season games",
		"appearances in 2021-22",
		"apps in 2021-22",
		"games in 2021-22",
		"appear in 2021-22",
		"2021-22 appearances",
		"2021-22 apps",
		"2021-22 games",
		"appearances in 21/22",
		"apps in 21/22",
		"games in 21/22",
		"appear in 21/22",
		"21/22 appearances",
		"21/22 apps",
		"21/22 games",
		"appearances in 21-22",
		"apps in 21-22",
		"games in 21-22",
		"appear in 21-22",
		"21-22 appearances",
		"21-22 apps",
		"21-22 games",
	],
};

// Stat indicator pseudonyms and antonyms
export const STAT_INDICATOR_PSEUDONYMS = {
	highest: ["highest", "most", "maximum", "top", "best", "greatest", "peak"],
	lowest: ["lowest", "least", "minimum", "bottom", "worst", "smallest", "fewest"],
	longest: ["longest", "most", "maximum", "greatest", "biggest"],
	shortest: ["shortest", "least", "minimum", "smallest", "briefest"],
	average: ["average", "mean", "typical", "normal", "regular"],
};

// Question type pseudonyms
export const QUESTION_TYPE_PSEUDONYMS = {
	how: ["how", "how do", "how does", "how did", "how can", "how will"],
	how_many: ["how many", "how much", "how often", "how frequently"],
	where: ["where", "where do", "where does", "where did"],
	where_did: ["where did", "where have", "where has"],
	what: ["what", "what do", "what does", "what did", "what have", "what has"],
	whats: ["what's", "what is", "what are", "what was", "what were"],
	who: ["who", "who do", "who does", "who did", "who have", "who has"],
	who_did: ["who did", "who have", "who has", "who made", "who created"],
	which: ["which", "which do", "which does", "which did", "which have", "which has"],
};

// Negative clause pseudonyms
export const NEGATIVE_CLAUSE_PSEUDONYMS = {
	not: ["not", "no", "never", "none", "nobody", "nothing"],
	excluding: ["excluding", "except", "apart from", "other than", "besides"],
	without: ["without", "lacking", "missing", "devoid of"],
};

// Location pseudonyms
export const LOCATION_PSEUDONYMS = {
	home: ["home", "at home", "home ground", "our ground", "pixham"],
	away: ["away", "away from home", "on the road", "away ground", "their ground"],
	Pixham: ["pixham", "home ground", "our ground", "the ground"],
};

// Time frame pseudonyms
export const TIME_FRAME_PSEUDONYMS = {
	week: ["week", "weekly", "a week"],
	month: ["month", "monthly", "a month"],
	game: ["game", "match", "a game", "a match"],
	weekend: ["weekend", "a weekend", "weekends"],
	season: ["season", "yearly", "annual", "a season"],
	consecutive: ["consecutive", "in a row", "straight", "running"],
	first_week: ["first week", "opening week", "week one"],
	second_week: ["second week", "week two"],
	between_dates: ["between", "from", "to", "until", "since"],
};

// Competition type pseudonyms
export const COMPETITION_TYPE_PSEUDONYMS = {
	league: ["league", "leagues", "league games", "league matches"],
	cup: ["cup", "cups", "cup games", "cup matches", "cup competition", "cup competitions"],
	friendly: ["friendly", "friendlies", "friendly games", "friendly matches", "friendly competition", "friendly competitions"],
};

// Competition pseudonyms (specific competition names)
export const COMPETITION_PSEUDONYMS = {
	Premier: ["premier", "premier division", "premier league"],
	"Intermediate South": ["intermediate south", "intermediate", "inter south"],
	"Seven South": ["seven south", "7 south", "7s south"],
	Intermediate: ["intermediate", "inter"],
	Seven: ["seven", "7s", "7"],
	South: ["south"],
	North: ["north"],
	East: ["east"],
	West: ["west"],
};

// Result pseudonyms
export const RESULT_PSEUDONYMS = {
	win: ["win", "wins", "won", "winning", "victory", "victories"],
	draw: ["draw", "draws", "drew", "drawing", "tie", "ties", "tied", "tying"],
	loss: ["loss", "losses", "lost", "losing", "defeat", "defeats", "defeated"],
	W: ["w", "wins"],
	D: ["d", "draws"],
	L: ["l", "losses"],
};

export class EntityExtractor {
	private question: string;
	private lowerQuestion: string;
	private nlpDoc: any;
	private entityResolver: EntityNameResolver;

	constructor(question: string) {
		this.question = question;
		this.lowerQuestion = question.toLowerCase();
		try {
			this.nlpDoc = nlp(question);
		} catch (error) {
			console.error("❌ NLP Error:", error);
			// Fallback to basic text processing if NLP fails
			this.nlpDoc = { match: () => ({ out: () => [] }) };
		}
		this.entityResolver = EntityNameResolver.getInstance();
	}

	async extractEntities(): Promise<EntityExtractionResult> {
		// Extract independent entity types in parallel for better performance
		// Synchronous extractions can run in parallel using Promise.all
		const [
			entities,
			statTypes,
			statIndicators,
			questionTypes,
			negativeClauses,
			locations,
			timeFrames,
			competitionTypes,
			competitions,
			results,
		] = await Promise.all([
			Promise.resolve(this.extractEntityInfo()),
			this.extractStatTypes(),
			Promise.resolve(this.extractStatIndicators()),
			Promise.resolve(this.extractQuestionTypes()),
			Promise.resolve(this.extractNegativeClauses()),
			Promise.resolve(this.extractLocations()),
			Promise.resolve(this.extractTimeFrames()),
			Promise.resolve(this.extractCompetitionTypes()),
			Promise.resolve(this.extractCompetitions()),
			Promise.resolve(this.extractResults()),
		]);

		// These are simple boolean checks, can run in parallel
		const [opponentOwnGoals, goalInvolvements] = await Promise.all([
			Promise.resolve(this.detectOpponentOwnGoals()),
			Promise.resolve(this.detectGoalInvolvements()),
		]);

		return {
			entities,
			statTypes,
			statIndicators,
			questionTypes,
			negativeClauses,
			locations,
			timeFrames,
			competitionTypes,
			competitions,
			results,
			opponentOwnGoals,
			goalInvolvements,
		};
	}

	private extractEntityInfo(): EntityInfo[] {
		const entities: EntityInfo[] = [];
		let position = 0;

		// Extract "I" references
		const iMatches = this.findMatches(/\b(i|i've|me|my|myself)\b/gi);
		iMatches.forEach((match) => {
			entities.push({
				value: "I",
				type: "player",
				originalText: match.text,
				position: match.position,
			});
		});

		// Extract team references BEFORE player names (if no "I" references found)
		// This ensures team patterns like "2s" are captured as teams, not players
		const hasPlayerContext = entities.some((e) => e.type === "player" && e.value === "I");
		
		// Extract team references (with or without "team" word)
		const teamMatches = this.findMatches(
			/\b(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)(?:\s+(team|teams))?\b/gi,
		);
		const extractedTeamNames = new Set<string>();
		teamMatches.forEach((match) => {
			// Extract just the team number/name part
			const teamName = match.text.replace(/\s+(team|teams)$/i, "");
			extractedTeamNames.add(teamName.toLowerCase());
			entities.push({
				value: teamName,
				type: "team",
				originalText: match.text,
				position: match.position,
			});
		});

		// Extract player names using compromise NLP for better accuracy
		// Only extract if we have player context ("I" reference) or no team entities were found
		// This prevents team patterns from being misclassified as player names
		if (hasPlayerContext || extractedTeamNames.size === 0) {
			const playerNames = this.extractPlayerNamesWithNLP(extractedTeamNames);
			const addedPlayers = new Set<string>();
			playerNames.forEach((player) => {
				const normalizedName = player.text.toLowerCase();
				if (!addedPlayers.has(normalizedName)) {
					addedPlayers.add(normalizedName);
					entities.push({
						value: player.text,
						type: "player",
						originalText: player.text,
						position: player.position,
					});
				}
			});
		}

		// Extract league references (detect league-related terms dynamically)
		// Look for patterns that typically indicate league names
		const leagueMatches = this.findMatches(/\b(league|premier|championship|conference|national|division|tier|level)\b/gi);
		leagueMatches.forEach((match) => {
			// Extract the full league name by looking for surrounding context
			const contextStart = Math.max(0, match.position - 20);
			const contextEnd = Math.min(this.question.length, match.position + match.text.length + 20);
			const context = this.question.substring(contextStart, contextEnd);

			// Try to extract a more complete league name from context
			const fullLeagueMatch = context.match(
				/\b([A-Z][a-z]*(?:\s+[A-Z][a-z]*)*\s+(?:league|premier|championship|conference|national|division|tier|level))\b/gi,
			);
			if (fullLeagueMatch) {
				const leagueName = fullLeagueMatch[0].trim();
				entities.push({
					value: leagueName,
					type: "league",
					originalText: leagueName,
					position: match.position,
				});
			} else {
				// Fallback to just the matched term
				entities.push({
					value: match.text,
					type: "league",
					originalText: match.text,
					position: match.position,
				});
			}
		});

		// Extract opposition team references (detect capitalized team names that aren't players)
		// This will catch any capitalized team names that appear in the question
		const oppositionMatches = this.findMatches(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
		oppositionMatches.forEach((match) => {
			// Skip common words and known player names
			const commonWords = [
				"how",
				"what",
				"where",
				"when",
				"why",
				"which",
				"who",
				"the",
				"and",
				"or",
				"but",
				"for",
				"with",
				"from",
				"to",
				"in",
				"on",
				"at",
				"by",
				"of",
				"a",
				"an",
				"is",
				"are",
				"was",
				"were",
				"be",
				"been",
				"being",
				"have",
				"has",
				"had",
				"do",
				"does",
				"did",
				"will",
				"would",
				"could",
				"should",
				"may",
				"might",
				"must",
				"can",
				"shall",
			];
			const knownPlayers = ["Luke", "Bangs", "Oli", "Goddard", "Kieran", "Mackrell"]; // Add more known players as needed

			// Check if this matches any existing player entities (to avoid duplicates)
			const isPlayerEntity = entities.some(
				(e) =>
					e.type === "player" &&
					(e.value.toLowerCase().includes(match.text.toLowerCase()) || match.text.toLowerCase().includes(e.value.toLowerCase())),
			);

			// Skip team numbers in various formats (3s, 3rd, etc.)
			const isTeamNumber = match.text.match(/^\d+(st|nd|rd|th)?$/) || 
			                     match.text.match(/^\d+s$/) ||
			                     extractedTeamNames.has(match.text.toLowerCase());

			if (
				!commonWords.includes(match.text.toLowerCase()) &&
				!knownPlayers.includes(match.text) &&
				!isTeamNumber && // Skip team numbers like "3s", "4th", "3rd"
				!isPlayerEntity
			) {
				// Skip if it's already a player entity
				entities.push({
					value: match.text,
					type: "opposition",
					originalText: match.text,
					position: match.position,
				});
			}
		});

		return entities;
	}

	private async extractStatTypes(): Promise<StatTypeInfo[]> {
		const statTypes: StatTypeInfo[] = [];

		// Debug logging (commented out for production)
		// console.log('🔍 Stat Type Debug - Question:', this.question);
		// console.log('🔍 Stat Type Debug - Lower question:', this.lowerQuestion);

		// CRITICAL FIX: Get player entities to filter out matches that are part of player names
		const playerEntities = this.extractEntityInfo().filter(e => e.type === "player");
		const playerNameWords = new Set<string>();
		playerEntities.forEach(entity => {
			// Split player names into individual words for checking
			entity.value.toLowerCase().split(/\s+/).forEach(word => {
				playerNameWords.add(word);
			});
		});

		// Check for goal involvements first
		if (this.lowerQuestion.includes("goal involvements") || this.lowerQuestion.includes("goal involvement")) {
			statTypes.push({
				value: "goal involvements",
				originalText: "goal involvements",
				position: this.lowerQuestion.indexOf("goal involvements"),
			});
		}

		// Extract other stat types - sort pseudonyms by length (longest first) to prioritize longer matches
		Object.entries(STAT_TYPE_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			// Sort pseudonyms by length (longest first) to ensure longer matches are found first
			const sortedPseudonyms = [...pseudonyms].sort((a, b) => b.length - a.length);

			sortedPseudonyms.forEach((pseudonym) => {
				// Use word boundaries only for single words, not for phrases with spaces
				const hasSpaces = pseudonym.includes(" ");
				// Check if this is a regex pattern (contains .* or similar)
				const isRegexPattern = pseudonym.includes(".*") || pseudonym.includes("\\d") || pseudonym.includes("\\w");

				let regex;
				if (isRegexPattern) {
					// Don't escape regex patterns, use them as-is
					regex = new RegExp(pseudonym, "gi");
				} else if (hasSpaces) {
					// Escape special characters for literal matching
					regex = new RegExp(pseudonym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
				} else {
					// Use word boundaries for single words
					regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
				}

				const matches = this.findMatches(regex);
				// if (matches.length > 0 && pseudonym.includes('appearance')) {
				// 	console.log(`🔍 Stat Type Debug - Found matches for "${pseudonym}":`, matches);
				// 	console.log(`🔍 Stat Type Debug - Regex:`, regex);
				// }
				matches.forEach((match) => {
					// CRITICAL FIX: Skip matches that are part of player names
					const matchTextLower = match.text.toLowerCase();
					if (playerNameWords.has(matchTextLower)) {
						return; // Skip this match
					}
					
					statTypes.push({
						value: key,
						originalText: match.text,
						position: match.position,
					});
				});
			});
		});

		// Add fuzzy matching for stat types
		await this.addFuzzyStatTypeMatches(statTypes);

		// console.log('🔍 Stat Type Debug - Final stat types:', statTypes);
		return statTypes;
	}

	private async addFuzzyStatTypeMatches(existingStatTypes: StatTypeInfo[]): Promise<void> {
		// Get all potential stat type words from the question
		const words = this.question
			.toLowerCase()
			.split(/\s+/)
			.map((word) => word.replace(/^[^\w]+|[^\w]+$/g, "").replace(/[^\w]/g, ""))
			.filter((word) => word.length > 0);

		// Get extracted player entities to check against
		const playerEntities = this.extractEntityInfo().filter(e => e.type === "player");
		const playerNameWords = new Set<string>();
		playerEntities.forEach(entity => {
			// Split player names into individual words for checking
			entity.value.toLowerCase().split(/\s+/).forEach(word => {
				playerNameWords.add(word);
			});
		});

		// Check each word for potential stat type matches
		for (const word of words) {
			// Skip if it's already been matched exactly
			const alreadyMatched = existingStatTypes.some((stat) => stat.originalText.toLowerCase() === word);

			if (alreadyMatched || word.length < 3) continue;

			// CRITICAL FIX: Skip words that are part of player names
			if (playerNameWords.has(word)) {
				continue;
			}

			// Try to find fuzzy matches for this word with context awareness
			const bestMatch = await this.findBestStatTypeMatchWithContext(word, existingStatTypes);
			if (bestMatch) {
				// Check if this word appears in the original question
				const position = this.question.toLowerCase().indexOf(word);
				if (position !== -1) {
					existingStatTypes.push({
						value: bestMatch,
						originalText: word,
						position: position,
					});
				}
			}
		}
	}

	private async findBestStatTypeMatchWithContext(word: string, existingStatTypes: StatTypeInfo[]): Promise<string | null> {
		// Skip question words - they should never match to stat types
		const questionWords = ["how", "what", "which", "who", "where", "when", "why", "has", "have", "did", "does", "was", "were", "is", "are"];
		if (questionWords.includes(word.toLowerCase())) {
			return null;
		}

		// Get all stat type pseudonyms
		const allPseudonyms: string[] = [];
		Object.values(STAT_TYPE_PSEUDONYMS).forEach((pseudonyms) => {
			allPseudonyms.push(...pseudonyms);
		});

		// Find the best match using the entity resolver
		const bestMatch = await this.entityResolver.getBestMatch(word, "stat_type");

		// Special handling: If bestMatch is "Home" or "Away", verify there's actual location context
		if (bestMatch === "Home" || bestMatch === "Away") {
			// Check if question explicitly mentions home/away with location keywords
			const explicitLocationPatterns = [
				/\bhome\s+games?\b/i,
				/\baway\s+games?\b/i,
				/\bat\s+home\b/i,
				/\baway\s+from\s+home\b/i,
				/\bon\s+the\s+road\b/i,
				/\bhome\s+ground\b/i,
				/\baway\s+ground\b/i,
			];
			const hasExplicitLocation = explicitLocationPatterns.some(pattern => pattern.test(this.lowerQuestion));
			
			// Only allow Home/Away stat type if there's explicit location context
			// Don't match if it's just the word "home" or "away" without context
			if (!hasExplicitLocation) {
				return null;
			}
		}

		// If no match found, try manual fuzzy matching with context awareness
		if (!bestMatch) {
			let bestScore = 0;
			let bestStatType = null;

			// Special handling for "appearance" - only match if we have context
			if (word === "appearance") {
				// Check if this is a team-specific appearance query - if so, don't map to per-appearance stats
				const teamAppearancePatterns = [
					/appearances?.*?for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i,
					/(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth).*?appearances?/i,
					/appearance\s+count.*?for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i,
					/(?:provide|give).*?appearance.*?for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i,
					/(?:how\s+many\s+times|times).*?played\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i,
					/(?:games?|appearances?|apps?)\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i
				];

				const isTeamSpecificAppearance = teamAppearancePatterns.some(pattern => pattern.test(this.lowerQuestion));
				
				if (isTeamSpecificAppearance) {
					// Don't map to per-appearance stats for team-specific appearance queries
					return null;
				}

				// Map all MatchDetails stats to their corresponding "Per Appearance" stat types
				const matchDetailsStats = [
					{ stat: "minutes", statType: "Minutes Per Appearance" },
					{ stat: "mom", statType: "Man of the Match Per Appearance" },
					{ stat: "goals", statType: "Goals Per Appearance" },
					{ stat: "assists", statType: "Assists Per Appearance" },
					{ stat: "yellowCards", statType: "Yellow Cards Per Appearance" },
					{ stat: "redCards", statType: "Red Cards Per Appearance" },
					{ stat: "saves", statType: "Saves Per Appearance" },
					{ stat: "ownGoals", statType: "Own Goals Per Appearance" },
					{ stat: "conceded", statType: "Conceded Per Appearance" },
					{ stat: "cleanSheets", statType: "Clean Sheets Per Appearance" },
					{ stat: "penaltiesScored", statType: "Penalties Scored Per Appearance" },
					{ stat: "penaltiesMissed", statType: "Penalties Missed Per Appearance" },
					{ stat: "penaltiesConceded", statType: "Penalties Conceded Per Appearance" },
					{ stat: "penaltiesSaved", statType: "Penalties Saved Per Appearance" },
					{ stat: "fantasyPoints", statType: "Fantasy Points Per Appearance" },
				];

				// Check for context clues in the question text
				for (const { stat, statType } of matchDetailsStats) {
					// Check for various forms of the stat name in the question
					const statPatterns = this.getStatPatterns(stat);
					const hasContext = statPatterns.some((pattern) => this.lowerQuestion.includes(pattern));

					if (hasContext) {
						return statType;
					}
				}

				// If no specific context found, don't match "appearance" by itself
				return null;
			}

			// For other words, use normal fuzzy matching
			for (const [statType, pseudonyms] of Object.entries(STAT_TYPE_PSEUDONYMS)) {
				for (const pseudonym of pseudonyms) {
					const score = this.calculateSimilarity(word, pseudonym);
					if (score > bestScore && score > 0.7) {
						// Threshold for fuzzy matching
						bestScore = score;
						bestStatType = statType;
					}
				}
			}

			return bestStatType;
		}

		return bestMatch;
	}

	/**
	 * Get various patterns for a stat name to check for context
	 * Reuses existing patterns from STAT_TYPE_PSEUDONYMS to avoid duplication
	 */
	private getStatPatterns(stat: string): string[] {
		// Map internal stat names to their corresponding STAT_TYPE_PSEUDONYMS keys
		const statMapping: { [key: string]: string } = {
			minutes: "Minutes",
			mom: "Man of the Match",
			goals: "Goals",
			assists: "Assists",
			yellowCards: "Yellow Cards",
			redCards: "Red Cards",
			saves: "Saves",
			ownGoals: "Own Goals",
			conceded: "Goals Conceded",
			cleanSheets: "Clean Sheets",
			penaltiesScored: "Penalties Scored",
			penaltiesMissed: "Penalties Missed",
			penaltiesConceded: "Penalties Conceded",
			penaltiesSaved: "Penalties Saved",
			fantasyPoints: "Fantasy Points",
		};

		const mappedStat = statMapping[stat];
		if (mappedStat && mappedStat in STAT_TYPE_PSEUDONYMS) {
			return STAT_TYPE_PSEUDONYMS[mappedStat as keyof typeof STAT_TYPE_PSEUDONYMS];
		}

		// Fallback to the original stat name if no mapping found
		return [stat];
	}

	private async findBestStatTypeMatch(word: string): Promise<string | null> {
		// Get all stat type pseudonyms
		const allPseudonyms: string[] = [];
		Object.values(STAT_TYPE_PSEUDONYMS).forEach((pseudonyms) => {
			allPseudonyms.push(...pseudonyms);
		});

		// Find the best match using the entity resolver
		const bestMatch = await this.entityResolver.getBestMatch(word, "stat_type");

		// If no match found, try manual fuzzy matching
		if (!bestMatch) {
			let bestScore = 0;
			let bestStatType = null;

			for (const [statType, pseudonyms] of Object.entries(STAT_TYPE_PSEUDONYMS)) {
				for (const pseudonym of pseudonyms) {
					const score = this.calculateSimilarity(word, pseudonym);
					if (score > bestScore && score > 0.7) {
						// Threshold for fuzzy matching
						bestScore = score;
						bestStatType = statType;
					}
				}
			}

			return bestStatType;
		}

		return bestMatch;
	}

	private calculateSimilarity(str1: string, str2: string): number {
		// Simple Jaro-Winkler similarity
		const longer = str1.length > str2.length ? str1 : str2;
		const shorter = str1.length > str2.length ? str2 : str1;

		if (longer.length === 0) return 1.0;

		const distance = this.levenshteinDistance(longer, shorter);
		return (longer.length - distance) / longer.length;
	}

	private levenshteinDistance(str1: string, str2: string): number {
		const matrix = Array(str2.length + 1)
			.fill(null)
			.map(() => Array(str1.length + 1).fill(null));

		for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
		for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

		for (let j = 1; j <= str2.length; j++) {
			for (let i = 1; i <= str1.length; i++) {
				const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
				matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
			}
		}

		return matrix[str2.length][str1.length];
	}

	private extractStatIndicators(): StatIndicatorInfo[] {
		const indicators: StatIndicatorInfo[] = [];

		Object.entries(STAT_INDICATOR_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			pseudonyms.forEach((pseudonym) => {
				const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
				const matches = this.findMatches(regex);
				matches.forEach((match) => {
					indicators.push({
						value: key as any,
						originalText: match.text,
						position: match.position,
					});
				});
			});
		});

		return indicators;
	}

	private extractQuestionTypes(): QuestionTypeInfo[] {
		const questionTypes: QuestionTypeInfo[] = [];

		Object.entries(QUESTION_TYPE_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			pseudonyms.forEach((pseudonym) => {
				const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
				const matches = this.findMatches(regex);
				matches.forEach((match) => {
					questionTypes.push({
						value: key as any,
						originalText: match.text,
						position: match.position,
					});
				});
			});
		});

		return questionTypes;
	}

	private extractNegativeClauses(): NegativeClauseInfo[] {
		const clauses: NegativeClauseInfo[] = [];

		Object.entries(NEGATIVE_CLAUSE_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			pseudonyms.forEach((pseudonym) => {
				const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
				const matches = this.findMatches(regex);
				matches.forEach((match) => {
					clauses.push({
						value: key,
						originalText: match.text,
						position: match.position,
					});
				});
			});
		});

		return clauses;
	}

	private extractLocations(): LocationInfo[] {
		const locations: LocationInfo[] = [];

		// CRITICAL: Extract longer phrases first to avoid conflicts (e.g., "away from home" should take priority over "home")
		// Sort pseudonyms by length (longest first) to ensure longer phrases are matched before shorter ones
		const sortedPseudonyms: Array<{ key: string; pseudonym: string }> = [];
		Object.entries(LOCATION_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			pseudonyms.forEach((pseudonym) => {
				sortedPseudonyms.push({ key, pseudonym });
			});
		});
		sortedPseudonyms.sort((a, b) => b.pseudonym.length - a.pseudonym.length);

		const matchedPositions = new Set<number>();

		// Match longer phrases first
		sortedPseudonyms.forEach(({ key, pseudonym }) => {
			const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
			const matches = this.findMatches(regex);
			matches.forEach((match) => {
				// Check if this position overlaps with an already matched longer phrase
				const positionOverlaps = Array.from(matchedPositions).some((pos) => {
					const matchStart = match.position;
					const matchEnd = match.position + match.text.length;
					const existingStart = pos;
					const existingEnd = pos + 50; // Approximate length for existing match
					return (matchStart >= existingStart && matchStart < existingEnd) ||
						(matchEnd > existingStart && matchEnd <= existingEnd) ||
						(matchStart <= existingStart && matchEnd >= existingEnd);
				});

				if (!positionOverlaps) {
					locations.push({
						value: key,
						type: key === "Pixham" ? "ground" : (key as any),
						originalText: match.text,
						position: match.position,
					});
					// Mark this position range as matched
					for (let i = match.position; i < match.position + match.text.length; i++) {
						matchedPositions.add(i);
					}
				}
			});
		});

		return locations;
	}

	private extractTimeFrames(): TimeFrameInfo[] {
		const timeFrames: TimeFrameInfo[] = [];
		const matchedPositions = new Set<number>();

		// Extract "before [SEASON]" patterns first (e.g., "before the 2020/21 season", "before 2020/21")
		// This must come before general season extraction to avoid double-matching
		const beforeSeasonRegex = /\bbefore\s+(?:the\s+)?(20\d{2}[/-]?\d{2}|20\d{2}\s*[/-]\s*20\d{2})\b/gi;
		let beforeSeasonMatch;
		while ((beforeSeasonMatch = beforeSeasonRegex.exec(this.question)) !== null) {
			const seasonValue = beforeSeasonMatch[1];
			const seasonPosition = beforeSeasonMatch.index + beforeSeasonMatch[0].indexOf(seasonValue);
			// Mark all character positions of this season as matched
			for (let i = seasonPosition; i < seasonPosition + seasonValue.length; i++) {
				matchedPositions.add(i);
			}
			timeFrames.push({
				value: seasonValue,
				type: "before",
				originalText: beforeSeasonMatch[0],
				position: seasonPosition,
			});
		}

		// Extract season references (but exclude those already matched as "before")
		const seasonMatches = this.findMatches(/\b(20\d{2}[/-]?\d{2}|20\d{2}\s*[/-]\s*20\d{2})\b/g);
		seasonMatches.forEach((match) => {
			// Check if any character of this season match was already matched as "before"
			let isBeforeSeason = false;
			for (let i = match.position; i < match.position + match.text.length; i++) {
				if (matchedPositions.has(i)) {
					isBeforeSeason = true;
					break;
				}
			}
			
			if (!isBeforeSeason) {
				// Regular season (not matched as "before")
				timeFrames.push({
					value: match.text,
					type: "season",
					originalText: match.text,
					position: match.position,
				});
			}
		});

		// Extract date references (including date ranges)
		const dateMatches = this.findMatches(
			/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b/gi,
		);
		dateMatches.forEach((match) => {
			timeFrames.push({
				value: match.text,
				type: "date",
				originalText: match.text,
				position: match.position,
			});
		});

		// Extract date ranges (between X and Y)
		const dateRangeRegex = /\bbetween\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+and\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/gi;
		let dateRangeMatch;
		while ((dateRangeMatch = dateRangeRegex.exec(this.question)) !== null) {
			timeFrames.push({
				value: `${dateRangeMatch[1]} to ${dateRangeMatch[2]}`,
				type: "range",
				originalText: dateRangeMatch[0],
				position: dateRangeMatch.index,
			});
		}

		// Extract "since [YEAR]" patterns (e.g., "since 2020")
		const sinceYearRegex = /\bsince\s+(\d{4})\b/gi;
		let sinceYearMatch;
		while ((sinceYearMatch = sinceYearRegex.exec(this.question)) !== null) {
			const year = parseInt(sinceYearMatch[1], 10);
			timeFrames.push({
				value: year.toString(),
				type: "since",
				originalText: sinceYearMatch[0],
				position: sinceYearMatch.index,
			});
		}

		// Extract ordinal weekend patterns (e.g., "first weekend of 2023", "second weekend of 2022")
		const ordinalWeekendRegex = /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th)\s+weekend\s+of\s+(\d{4})\b/gi;
		let ordinalWeekendMatch;
		while ((ordinalWeekendMatch = ordinalWeekendRegex.exec(this.question)) !== null) {
			const ordinalText = ordinalWeekendMatch[1].toLowerCase();
			const year = parseInt(ordinalWeekendMatch[2], 10);
			
			// Map ordinal text to number
			const ordinalMap: Record<string, number> = {
				first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
				sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
				"1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5,
				"6th": 6, "7th": 7, "8th": 8, "9th": 9, "10th": 10,
			};
			
			const ordinalNumber = ordinalMap[ordinalText] || 1;
			
			timeFrames.push({
				value: `weekend_${ordinalNumber}_${year}`,
				type: "ordinal_weekend",
				originalText: ordinalWeekendMatch[0],
				position: ordinalWeekendMatch.index,
			});
		}

		// Extract other time frame references
		Object.entries(TIME_FRAME_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			pseudonyms.forEach((pseudonym) => {
				const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
				const matches = this.findMatches(regex);
				matches.forEach((match) => {
					timeFrames.push({
						value: key,
						type: key === "between_dates" ? "range" : (key as any),
						originalText: match.text,
						position: match.position,
					});
				});
			});
		});

		return timeFrames;
	}

	private extractCompetitionTypes(): CompetitionTypeInfo[] {
		const competitionTypes: CompetitionTypeInfo[] = [];

		Object.entries(COMPETITION_TYPE_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			pseudonyms.forEach((pseudonym) => {
				const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
				const matches = this.findMatches(regex);
				matches.forEach((match) => {
					competitionTypes.push({
						value: key,
						type: key as any,
						originalText: match.text,
						position: match.position,
					});
				});
			});
		});

		return competitionTypes;
	}

	private extractCompetitions(): CompetitionInfo[] {
		const competitions: CompetitionInfo[] = [];

		Object.entries(COMPETITION_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			pseudonyms.forEach((pseudonym) => {
				const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
				const matches = this.findMatches(regex);
				matches.forEach((match) => {
					competitions.push({
						value: key,
						originalText: match.text,
						position: match.position,
					});
				});
			});
		});

		return competitions;
	}

	private extractResults(): ResultInfo[] {
		const results: ResultInfo[] = [];

		Object.entries(RESULT_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			pseudonyms.forEach((pseudonym) => {
				const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
				const matches = this.findMatches(regex);
				matches.forEach((match) => {
					results.push({
						value: key,
						type: key as any,
						originalText: match.text,
						position: match.position,
					});
				});
			});
		});

		return results;
	}

	private detectOpponentOwnGoals(): boolean {
		return (
			this.lowerQuestion.includes("opponent own goals") ||
			this.lowerQuestion.includes("opponent own goal") ||
			this.lowerQuestion.includes("oppo own goals") ||
			this.lowerQuestion.includes("oppo own goal")
		);
	}

	private detectGoalInvolvements(): boolean {
		return this.lowerQuestion.includes("goal involvements") || this.lowerQuestion.includes("goal involvement");
	}

	private findMatches(regex: RegExp): Array<{ text: string; position: number }> {
		const matches: Array<{ text: string; position: number }> = [];
		let match;

		while ((match = regex.exec(this.question)) !== null) {
			matches.push({
				text: match[0],
				position: match.index,
			});
		}

		return matches;
	}

	/**
	 * Extract player names using compromise NLP for better accuracy
	 * @param extractedTeamNames Set of team names already extracted to filter out from player names
	 */
	private extractPlayerNamesWithNLP(extractedTeamNames: Set<string> = new Set()): Array<{ text: string; position: number }> {
		const players: Array<{ text: string; position: number }> = [];

		try {
			// Get all proper nouns (potential player names)
			const properNouns = this.nlpDoc.match("#ProperNoun+").out("array");

			// Get all nouns that might be player names
			const nouns = this.nlpDoc.match("#Noun+").out("array");

			// Debug logging (commented out for production)
			// console.log('🔍 NLP Debug - Question:', this.question);
			// console.log('🔍 NLP Debug - Proper nouns:', properNouns);
			// console.log('🔍 NLP Debug - Nouns:', nouns);

			// Combine and filter potential player names
			const potentialNames = [...properNouns, ...nouns];

			// Common words to exclude
			const commonWords = [
				"how",
				"what",
				"where",
				"when",
				"why",
				"which",
				"who",
				"the",
				"and",
				"or",
				"but",
				"for",
				"with",
				"from",
				"to",
				"in",
				"on",
				"at",
				"by",
				"of",
				"a",
				"an",
				"is",
				"are",
				"was",
				"were",
				"be",
				"been",
				"being",
				"have",
				"has",
				"had",
				"do",
				"does",
				"did",
				"will",
				"would",
				"could",
				"should",
				"may",
				"might",
				"must",
				"can",
				"shall",
				"goals",
				"assists",
				"appearances",
				"minutes",
				"cards",
				"saves",
				"clean",
				"sheets",
				"penalties",
				"fantasy",
				"points",
				"team",
				"teams",
				"season",
				"week",
				"month",
				"year",
				"game",
				"games",
				"match",
				"matches",
				"league",
				"premier",
				"championship",
				"conference",
				"national",
				"division",
				"tier",
				"level",
				"home",
				"away",
				"playing",
				"whilst",
				"between",
				"and",
				"got",
				"has",
				"have",
				"open play goals",
				"open play goal",
				"play goals",
				"play goal",
				"football",
				"soccer",
				"sport",
				"sports",
				// Additional common words that were causing entity extraction issues
				"it",
				"its",
				"this",
				"that",
				"these",
				"those",
				"they",
				"them",
				"their",
				"there",
				"times",
				"time",
				"count",
				"total",
				"stats",
				"stat",
				"percentage",
				"percent",
				"%",
				"clubs",
				"club",
				"clubs teams",
				"appearance",
				"appearance count",
				"goal",
				"average",
				"score",
				"take",
				"takes",
				"many",
			];

			// Find positions of potential names in the original text
			for (const name of potentialNames) {
				const normalizedName = name.trim();

				// Skip if it's a common word or too short
				if (commonWords.includes(normalizedName.toLowerCase()) || normalizedName.length < 2) {
					continue;
				}

				// Skip if it's a stat type (check against all stat type pseudonyms)
				const isStatType = Object.values(STAT_TYPE_PSEUDONYMS).some((pseudonyms) =>
					pseudonyms.some((pseudonym) => this.calculateSimilarity(normalizedName.toLowerCase(), pseudonym.toLowerCase()) > 0.7),
				);

				if (isStatType) {
					continue;
				}

				// Skip if it's a number or team reference
				if (normalizedName.match(/^\d+(st|nd|rd|th)?$/) || normalizedName.match(/^\d+s$/)) {
					continue;
				}

				// Skip if it matches an already extracted team name
				if (extractedTeamNames.has(normalizedName.toLowerCase())) {
					continue;
				}

				// Find the position of this name in the original text
				const position = this.question.toLowerCase().indexOf(normalizedName.toLowerCase());
				if (position !== -1) {
					players.push({
						text: normalizedName,
						position: position,
					});
				}
			}

			// Combine adjacent proper nouns to form full names (e.g., "Luke" + "Bangs" = "Luke Bangs")
			const combinedPlayers: Array<{ text: string; position: number }> = [];
			const sortedPlayers = players.sort((a, b) => a.position - b.position);

			// Common verbs that indicate the end of a player name
			const verbBoundaryWords = /\b(got|have|has|playing|whilst|while|together|for|with|in|at|on|by|from|to|when|where|what|which|who|how|and|or|but|scored|got|achieved|made|did|does|do)\b/i;

			for (let i = 0; i < sortedPlayers.length; i++) {
				const currentPlayer = sortedPlayers[i];
				let combinedName = currentPlayer.text;
				let combinedPosition = currentPlayer.position;

				// Look for adjacent players (within 1 word distance)
				for (let j = i + 1; j < sortedPlayers.length; j++) {
					const nextPlayer = sortedPlayers[j];
					const distance = nextPlayer.position - (currentPlayer.position + currentPlayer.text.length);

					// Check if there's a verb boundary between current and next player
					const textBetween = this.question.substring(
						currentPlayer.position + currentPlayer.text.length,
						nextPlayer.position
					).toLowerCase().trim();

					// If the next player is within 1 word distance AND no verb boundary exists, combine them
					if (distance <= 1 && !verbBoundaryWords.test(textBetween)) {
						combinedName += " " + nextPlayer.text;
						i = j; // Skip the next player since we've combined it
					} else {
						break; // No more adjacent players or verb boundary detected
					}
				}

				// Trim the combined name at verb boundaries
				const verbMatch = combinedName.match(verbBoundaryWords);
				const trimmedName = verbMatch && verbMatch.index !== undefined
					? combinedName.substring(0, verbMatch.index).trim()
					: combinedName.trim();

				combinedPlayers.push({
					text: trimmedName,
					position: combinedPosition,
				});
			}

			// Use combined players instead of individual ones
			players.length = 0;
			players.push(...combinedPlayers);

			// Remove duplicates and sort by position
			const uniquePlayers = players.filter((player, index, self) => index === self.findIndex((p) => p.text === player.text));

			// console.log('🔍 Player Debug - Final players:', uniquePlayers);
			return uniquePlayers.sort((a, b) => a.position - b.position);
		} catch (error) {
			console.error("❌ NLP Processing Error:", error);
			// Fallback to basic word extraction if NLP fails
			const words = this.question.split(/\s+/);
			const potentialNames = words.filter(
				(word) => {
					const normalized = word.toLowerCase();
					return word.length >= 2 && 
						/^[A-Z]/.test(word) && 
						!["How", "What", "Where", "When", "Why", "Which", "Who"].includes(word) &&
						!extractedTeamNames.has(normalized) &&
						!normalized.match(/^\d+(st|nd|rd|th)?$/) &&
						!normalized.match(/^\d+s$/);
				},
			);

			return potentialNames.map((name, index) => ({
				text: name,
				position: this.question.indexOf(name),
			}));
		}
	}

	/**
	 * Resolve all entities with fuzzy matching
	 */
	public async resolveEntitiesWithFuzzyMatching(): Promise<EntityExtractionResult> {
		const baseResult = await this.extractEntities();
		
		// Early exit: If no entities and no stat types found, skip fuzzy matching
		const namedEntities = baseResult.entities.filter(
			(e) => e.type === "player" || e.type === "team" || e.type === "opposition" || e.type === "league",
		);
		if (namedEntities.length === 0 && baseResult.statTypes.length === 0) {
			// Return early without fuzzy matching to save processing time
			return baseResult;
		}
		
		const resolvedEntities: EntityInfo[] = [];

		// Process each entity with fuzzy matching
		for (const entity of baseResult.entities) {
			let resolvedName = entity.value;
			let wasResolved = false;

			// Try to resolve based on entity type
			switch (entity.type) {
				case "player":
					const resolvedPlayer = await this.entityResolver.getBestMatch(entity.value, "player");
					if (resolvedPlayer) {
						resolvedName = resolvedPlayer;
						wasResolved = true;
					}
					break;
				case "team":
					const resolvedTeam = await this.entityResolver.getBestMatch(entity.value, "team");
					if (resolvedTeam) {
						resolvedName = resolvedTeam;
						wasResolved = true;
					}
					break;
				case "opposition":
					const resolvedOpposition = await this.entityResolver.getBestMatch(entity.value, "opposition");
					if (resolvedOpposition) {
						resolvedName = resolvedOpposition;
						wasResolved = true;
					}
					break;
				case "league":
					const resolvedLeague = await this.entityResolver.getBestMatch(entity.value, "league");
					if (resolvedLeague) {
						resolvedName = resolvedLeague;
						wasResolved = true;
					}
					break;
			}

			// Add resolved entity
			resolvedEntities.push({
				...entity,
				value: resolvedName,
				originalText: wasResolved ? `${entity.originalText} (resolved to: ${resolvedName})` : entity.originalText,
			});
		}

		return {
			...baseResult,
			entities: resolvedEntities,
		};
	}
}
