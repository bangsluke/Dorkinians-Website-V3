// Centralized zero-stat phrasing so chatbot + QA stay in sync
export interface ZeroStatResponseContext {
	playerName?: string;
	metric?: string;
	metricDisplayName?: string;
	question?: string;
}

export interface ZeroStatResponseRule {
	id: string;
	matcher: RegExp;
	phrase: string;
	buildMessage?: (context: ZeroStatResponseContext) => string;
}

export const ZERO_STAT_RESPONSE_RULES: ZeroStatResponseRule[] = [
	{
		id: "APPS_ZERO",
		matcher: /(APP|APPS|APPEARANCES)/i,
		phrase: "has not made an appearance yet",
	},
	{
		id: "GOALS_ZERO",
		matcher: /(GOALS?|ALLGSC|OPENPLAYGOALS|TOTALGOALS)/i,
		phrase: "has not scored a goal",
	},
	{
		id: "ASSISTS_ZERO",
		matcher: /ASSIST/i,
		phrase: "has not recorded an assist",
	},
	{
		id: "MOM_ZERO",
		matcher: /(MOM|MANOFTHEMATCH|PLAYEROFMATCH)/i,
		phrase: "has not received a Player of the Match award",
	},
	{
		id: "YELLOW_CARDS_ZERO",
		matcher: /(Y|YC|YELLOW)/i,
		phrase: "has not received a yellow card",
	},
	{
		id: "RED_CARDS_ZERO",
		matcher: /(R|RC|RED)/i,
		phrase: "has not received a red card",
	},
	{
		id: "OWN_GOALS_ZERO",
		matcher: /(OG|OWNGOAL)/i,
		phrase: "has not scored an own goal",
	},
	{
		id: "CLEAN_SHEET_ZERO",
		matcher: /(MPERCLS|CLS|CLEAN\s*SHEETS?)/i,
		phrase: "has not kept a clean sheet",
	},
	{
		id: "SAVES_ZERO",
		matcher: /SAVES?/i,
		phrase: "has not made a save",
	},
	{
		id: "PENALTIES_SCORED_ZERO",
		matcher: /(PSC|PENALTIESSCORED|PENALTIES_SCORED)/i,
		phrase: "has not scored a penalty",
	},
	{
		id: "PENALTIES_SAVED_ZERO",
		matcher: /(PSV|PENALTIESSAVED|PENALTIES_SAVED)/i,
		phrase: "has not saved a penalty",
	},
	{
		id: "PENALTIES_MISSED_ZERO",
		matcher: /(PM|PENALTIESMISSED|PENALTIES_MISSED)/i,
		phrase: "has not missed a penalty",
	},
	{
		id: "PENALTIES_CONCEDED_ZERO",
		matcher: /(PCO|PENALTIESCONCEDED|PENALTIES_CONCEDED)/i,
		phrase: "has not conceded a penalty",
	},
	{
		id: "CONCEDED_ZERO",
		matcher: /(C|CONCEDED|CperAPP)/i,
		phrase: "has not conceded a goal",
	},
	{
		id: "MINUTES_ZERO",
		matcher: /(MIN|MINUTES)/i,
		phrase: "has not played any minutes yet",
	},
	{
		id: "FANTASY_POINTS_ZERO",
		matcher: /(FTP|FTPperAPP|FANTASYPOINTS|POINTS)/i,
		phrase: "has not recorded any fantasy points",
	},
];

const buildDefaultMessage = (playerName: string, phrase: string): string => {
	const trimmed = phrase.trim().replace(/\.+$/, "");
	return `${playerName} ${trimmed}.`;
};

export function getZeroStatResponse(
	metric: string,
	playerName: string,
	options: ZeroStatResponseContext = { playerName },
): string | null {
	if (!playerName) {
		return null;
	}

	const normalizedMetric = (metric || "").toUpperCase();

	for (const rule of ZERO_STAT_RESPONSE_RULES) {
		if (rule.matcher.test(normalizedMetric)) {
			return rule.buildMessage
				? rule.buildMessage({ ...options, playerName, metric })
				: buildDefaultMessage(playerName, rule.phrase);
		}
	}

	return null;
}

export function messageMatchesZeroStatPhrase(message: string): boolean {
	if (!message) {
		return false;
	}
	const lower = message.toLowerCase();
	return ZERO_STAT_RESPONSE_RULES.some((rule) => lower.includes(rule.phrase.toLowerCase()));
}

