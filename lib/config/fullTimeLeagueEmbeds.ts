/**
 * Official Full-Time embed codes published on southernamateurleague.co.uk.
 * Each code is the division table widget, not the results or fixtures widget.
 */
const FULL_TIME_LEAGUE_EMBED_CODES: Record<string, string> = {
	"1s": "896241272",
	"2s": "279911149",
	"3s": "101303859",
	"4s": "941630242",
	"5s": "466534258",
	"6s": "103794436",
	"7s": "258432344",
};

export function getFullTimeLeagueEmbedCode(teamKey: string): string | undefined {
	return FULL_TIME_LEAGUE_EMBED_CODES[teamKey];
}

export function getFullTimeLeagueTeamKeys(): string[] {
	return Object.keys(FULL_TIME_LEAGUE_EMBED_CODES);
}
