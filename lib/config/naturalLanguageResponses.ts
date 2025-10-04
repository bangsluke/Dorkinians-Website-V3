export interface VerbMapping {
	verb: string;
	alternativeVerbs: string[];
	context: string;
}

export interface ResponseTemplate {
	template: string;
	context: string;
	examples: string[];
}

export interface MetricLanguageConfig {
	metric: string;
	displayName: string;
	verbMappings: VerbMapping[];
	responseTemplates: ResponseTemplate[];
	pluralForm: string;
	singularForm: string;
}

// Verb mappings for different metric types
export const verbMappings: { [key: string]: VerbMapping[] } = {
	G: [{ verb: "scored", alternativeVerbs: ["scored", "got", "achieved"], context: "goals" }],
	A: [{ verb: "provided", alternativeVerbs: ["achieved", "got", "assisted"], context: "assists" }],
	APP: [{ verb: "played", alternativeVerbs: ["played", "made", "appeared in", "achieved"], context: "appearances" }],
	MIN: [
		{ verb: "played", alternativeVerbs: ["played", "accumulated", "logged"], context: "minutes" },
		{ verb: "played", alternativeVerbs: ["played", "accumulated", "logged"], context: "minutes" },
	],
	MOM: [
		{ verb: "won", alternativeVerbs: ["won", "received", "earned"], context: "man of the match awards" },
		{ verb: "won", alternativeVerbs: ["won", "received", "earned"], context: "man of the match awards" },
	],
	Y: [
		{ verb: "received", alternativeVerbs: ["received", "got", "was shown"], context: "yellow cards" },
		{ verb: "received", alternativeVerbs: ["received", "got", "was shown"], context: "yellow cards" },
	],
	R: [
		{ verb: "received", alternativeVerbs: ["received", "got", "was shown"], context: "red cards" },
		{ verb: "received", alternativeVerbs: ["received", "got", "was shown"], context: "red cards" },
	],
	SAVES: [
		{ verb: "made", alternativeVerbs: ["made", "saved", "stopped"], context: "saves" },
		{ verb: "made", alternativeVerbs: ["made", "saved", "stopped"], context: "saves" },
	],
	OG: [
		{ verb: "scored", alternativeVerbs: ["scored", "conceded", "put through"], context: "own goals" },
		{ verb: "scored", alternativeVerbs: ["scored", "conceded", "put through"], context: "own goals" },
	],
	C: [
		{ verb: "conceded", alternativeVerbs: ["conceded", "let in", "allowed"], context: "goals" },
		{ verb: "conceded", alternativeVerbs: ["conceded", "let in", "allowed"], context: "goals" },
	],
	CLS: [
		{ verb: "kept", alternativeVerbs: ["kept", "achieved", "maintained"], context: "clean sheets" },
		{ verb: "kept", alternativeVerbs: ["kept", "achieved", "maintained"], context: "clean sheets" },
	],
	PSC: [
		{ verb: "scored", alternativeVerbs: ["scored", "converted", "scored"], context: "penalties" },
		{ verb: "scored", alternativeVerbs: ["scored", "converted", "scored"], context: "penalties" },
	],
	PM: [
		{ verb: "missed", alternativeVerbs: ["missed", "failed to convert", "missed"], context: "penalties" },
		{ verb: "missed", alternativeVerbs: ["missed", "failed to convert", "missed"], context: "penalties" },
	],
	PCO: [
		{ verb: "conceded", alternativeVerbs: ["conceded", "gave away", "allowed"], context: "penalties" },
		{ verb: "conceded", alternativeVerbs: ["conceded", "gave away", "allowed"], context: "penalties" },
	],
	PSV: [
		{ verb: "saved", alternativeVerbs: ["saved", "stopped", "saved"], context: "penalties" },
		{ verb: "saved", alternativeVerbs: ["saved", "stopped", "saved"], context: "penalties" },
	],
	FTP: [
		{ verb: "earned", alternativeVerbs: ["earned", "scored", "accumulated"], context: "fantasy points" },
		{ verb: "earned", alternativeVerbs: ["earned", "scored", "accumulated"], context: "fantasy points" },
	],
	GperAPP: [{ verb: "averaged", alternativeVerbs: ["averaged", "scored"], context: "goals per appearance" }],
	CperAPP: [{ verb: "averaged", alternativeVerbs: ["averaged", "conceded"], context: "goals conceded per appearance" }],
	MperG: [{ verb: "takes", alternativeVerbs: ["takes", "requires"], context: "minutes per goal" }],
	MperCLS: [{ verb: "takes", alternativeVerbs: ["takes", "requires"], context: "minutes per clean sheet" }],
	FTPperAPP: [{ verb: "averaged", alternativeVerbs: ["averaged", "earned"], context: "fantasy points per appearance" }],
	MINperAPP: [{ verb: "averaged", alternativeVerbs: ["averaged", "played"], context: "minutes per appearance" }],
	MOMperAPP: [{ verb: "averaged", alternativeVerbs: ["averaged", "won"], context: "man of the match per appearance" }],
	YperAPP: [{ verb: "averaged", alternativeVerbs: ["averaged", "received"], context: "yellow cards per appearance" }],
	RperAPP: [{ verb: "averaged", alternativeVerbs: ["averaged", "received"], context: "red cards per appearance" }],
	SAVESperAPP: [{ verb: "averaged", alternativeVerbs: ["averaged", "made"], context: "saves per appearance" }],
	OGperAPP: [{ verb: "averaged", alternativeVerbs: ["averaged", "scored"], context: "own goals per appearance" }],
	CLSperAPP: [{ verb: "averaged", alternativeVerbs: ["averaged", "kept"], context: "clean sheets per appearance" }],
	PSCperAPP: [{ verb: "averaged", alternativeVerbs: ["averaged", "scored"], context: "penalties scored per appearance" }],
	PMperAPP: [{ verb: "averaged", alternativeVerbs: ["averaged", "missed"], context: "penalties missed per appearance" }],
	PCOperAPP: [{ verb: "averaged", alternativeVerbs: ["averaged", "conceded"], context: "penalties conceded per appearance" }],
	PSVperAPP: [{ verb: "averaged", alternativeVerbs: ["averaged", "saved"], context: "penalties saved per appearance" }],
	DIST: [{ verb: "travelled", alternativeVerbs: ["travelled", "covered"], context: "distance" }],
};

// Response templates for different question types
export const responseTemplates: { [key: string]: ResponseTemplate[] } = {
	player_stats: [
		{
			template: "{playerName} has {verb} {value} {metricName}.",
			context: "Basic player statistics",
			examples: ["Luke Bangs has scored 7 goals.", "Luke Bangs has provided 3 assists."],
		},
		{
			template: "{playerName} has {verb} {value} {metricName} so far.",
			context: "Season/career statistics",
			examples: ["Luke Bangs has scored 7 goals so far.", "Luke Bangs has provided 3 assists so far."],
		},
		{
			template: "{playerName} has {verb} {value} {metricName} this season.",
			context: "Season-specific statistics",
			examples: ["Luke Bangs has scored 7 goals this season.", "Luke Bangs has provided 3 assists this season."],
		},
		{
			template: "{playerName} has {verb} {value} {metricName} in {appearances} appearances.",
			context: "Player statistics with appearances context",
			examples: ["Luke Bangs has scored 29 goals in 78 appearances.", "Luke Bangs has received 5 yellow cards in 45 appearances."],
		},
		{
			template: "{playerName} has {verb} {value} {metricName}.",
			context: "Per appearance statistics",
			examples: ["Luke Bangs has averaged 0.17 goals per appearance.", "Luke Bangs has averaged 2 goals conceded per appearance."],
		},
		{
			template: "It takes {value} minutes on average for {playerName} to score a goal.",
			context: "Minutes per goal",
			examples: ["It takes 500 minutes on average for Luke Bangs to score a goal."],
		},
		{
			template: "{playerName} takes {value} minutes per clean sheet in {appearances} appearances.",
			context: "Minutes per clean sheet",
			examples: ["Luke Bangs takes 453 minutes per clean sheet in 171 appearances."],
		},
		{
			template: "{playerName} has {verb} {value} miles to get to games.",
			context: "Distance travelled",
			examples: ["Luke Bangs has travelled 3,535 miles to get to games."],
		},
	],
	team_specific: [
		{
			template: "For the {teamName}, {playerName} has {verb} {value} {metricName}.",
			context: "Team-specific player statistics",
			examples: ["For the 3rd XI, Luke Bangs has scored 8 goals."],
		},
		{
			template: "In the {teamName}, {playerName} has {verb} {value} {metricName}.",
			context: "Alternative team-specific format",
			examples: ["In the 3rd XI, Luke Bangs has scored 8 goals."],
		},
	],
	comparison: [
		{
			template: "{playerName} has {verb} the most {metricName} with {value}.",
			context: "Player comparison (highest)",
			examples: ["Luke Bangs has scored the most goals with 8."],
		},
		{
			template: "{playerName} leads the team with {value} {metricName}.",
			context: "Alternative comparison format",
			examples: ["Luke Bangs leads the team with 8 goals."],
		},
	],
};

// Helper function to get appropriate verb for a metric
export function getAppropriateVerb(metric: string, value: number): string {
	const mappings = verbMappings[metric];
	if (!mappings || mappings.length === 0) {
		return ""; // Empty string to avoid "has has" duplication
	}

	// Use the first mapping for now, could be enhanced with context
	return mappings[0].verb;
}

// Helper function to get response template
export function getResponseTemplate(type: string, context?: string): ResponseTemplate | null {
	const templates = responseTemplates[type];
	if (!templates || templates.length === 0) {
		return null;
	}

	// If context is provided, try to find a matching template
	if (context) {
		const matchingTemplate = templates.find((t) => t.context.includes(context));
		if (matchingTemplate) {
			return matchingTemplate;
		}
	}

	// Return the first template as fallback
	return templates[0];
}

// Helper function to format response with natural language
export function formatNaturalResponse(
	template: string,
	playerName: string,
	metric: string,
	value: number,
	metricName: string,
	teamName?: string,
	appearances?: number,
): string {
	const verb = getAppropriateVerb(metric, value);

	let response = template
		.replace("{playerName}", playerName)
		.replace("{verb}", verb)
		.replace("{value}", value.toString())
		.replace("{metricName}", metricName);

	// Clean up extra spaces that might be left by empty verbs
	response = response.replace(/\s+/g, " ").trim();

	if (teamName) {
		response = response.replace("{teamName}", teamName);
	}

	if (appearances !== undefined) {
		response = response.replace("{appearances}", appearances.toString());
	}

	return response;
}
