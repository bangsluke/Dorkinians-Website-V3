import { FALLBACK_FULL_TIME_LEAGUE_EMBED_CODES } from "@/lib/config/fullTimeLeagueEmbeds";
import { calculateCurrentSeason } from "@/lib/utils/leagueSeasonList";

const EMBED_CODE_PATTERN = /^\d{5,12}$/;

const TEAM_KEY_MAP: Record<string, string> = {
	"1st xi": "1s",
	"2nd xi": "2s",
	"3rd xi": "3s",
	"4th xi": "4s",
	"5th xi": "5s",
	"6th xi": "6s",
	"7th xi": "7s",
	"8th xi": "8s",
	"1s": "1s",
	"2s": "2s",
	"3s": "3s",
	"4s": "4s",
	"5s": "5s",
	"6s": "6s",
	"7s": "7s",
	"8s": "8s",
};

interface LeagueSourcesConfig {
	name: string;
	url: string;
}

function getLeagueSourcesUrl(): string | null {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { dataSources } = require("@/config/dataSources.js") as { dataSources: LeagueSourcesConfig[] };
	const source = dataSources.find((entry) => entry.name === "TBL_LeagueSources");
	return source?.url || null;
}

function parseCsvLine(line: string): string[] {
	const cells: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i += 1) {
		const char = line[i];
		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}
		if (char === "," && !inQuotes) {
			cells.push(current.trim());
			current = "";
			continue;
		}
		current += char;
	}
	cells.push(current.trim());
	return cells;
}

function normalizeSeasonKey(season: string): string {
	return season.replace("/", "-").trim();
}

function toTeamKey(team: string): string | null {
	const key = TEAM_KEY_MAP[team.toLowerCase().trim()];
	return key || null;
}

function isValidEmbedCode(value: string): boolean {
	return EMBED_CODE_PATTERN.test(value.trim());
}

/**
 * Read current-season Full-Time table embed codes from the published League Sources sheet.
 * Invalid or missing sheet values fall back to the static map in fullTimeLeagueEmbeds.
 */
export async function getLiveFullTimeLeagueEmbedCodes(
	currentSeason: string = calculateCurrentSeason(),
): Promise<Record<string, string>> {
	const fallback = { ...FALLBACK_FULL_TIME_LEAGUE_EMBED_CODES };
	const url = getLeagueSourcesUrl();
	if (!url) {
		return fallback;
	}

	try {
		const response = await fetch(url, {
			headers: { Accept: "text/csv,*/*" },
			next: { revalidate: 300 },
		});
		if (!response.ok) {
			console.warn(`League Sources fetch failed: ${response.status}`);
			return fallback;
		}

		const csvText = await response.text();
		const lines = csvText
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
		if (lines.length < 2) {
			return fallback;
		}

		const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
		const teamIndex = headers.findIndex((header) => header === "team");
		const embedIndex = headers.findIndex(
			(header) => header === "embed code" || header === "embedcode" || header === "lrcode",
		);
		const seasonIndex = headers.findIndex((header) => header === "season");
		if (teamIndex < 0 || embedIndex < 0) {
			console.warn("League Sources CSV is missing Team or Embed Code columns");
			return fallback;
		}

		const currentKey = normalizeSeasonKey(currentSeason);
		const fromSheet: Record<string, string> = {};

		for (let i = 1; i < lines.length; i += 1) {
			const values = parseCsvLine(lines[i]);
			const teamKey = toTeamKey(values[teamIndex] || "");
			const embedCode = (values[embedIndex] || "").trim();
			if (!teamKey || !isValidEmbedCode(embedCode)) {
				continue;
			}

			if (seasonIndex >= 0) {
				const rowSeason = normalizeSeasonKey(values[seasonIndex] || "");
				if (rowSeason && rowSeason !== currentKey) {
					continue;
				}
			}

			fromSheet[teamKey] = embedCode;
		}

		return { ...fallback, ...fromSheet };
	} catch (error) {
		console.warn("League Sources embed code load failed:", error);
		return fallback;
	}
}
