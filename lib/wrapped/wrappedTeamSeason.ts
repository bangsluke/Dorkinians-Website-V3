import { neo4jService } from "@/lib/neo4j";
import {
	getSeasonDataFromJSON,
	normalizeSeasonFormat,
	type LeagueTableEntry,
} from "@/lib/services/leagueTableService";

/** Map fixture `f.team` labels to `LeagueTable.teamName` keys (`1s`…`8s`). */
export function fixtureDisplayTeamToLeagueTableKey(team: string): string {
	const t = (team || "").trim();
	if (!t) return "";
	const lower = t.toLowerCase();
	const map: Record<string, string> = {
		"1st xi": "1s",
		"2nd xi": "2s",
		"3rd xi": "3s",
		"4th xi": "4s",
		"5th xi": "5s",
		"6th xi": "6s",
		"7th xi": "7s",
		"8th xi": "8s",
	};
	return map[lower] ?? t;
}

function normalizeFixtureResult(raw: string): "W" | "D" | "L" | "" {
	const u = (raw || "").trim().toUpperCase().replace(/\s+/g, "");
	if (u === "W" || u.startsWith("WIN")) return "W";
	if (u === "D" || u.startsWith("DRAW")) return "D";
	if (u === "L" || u.startsWith("LOS")) return "L";
	return "";
}

/** Cup tie advanced: win, or draw with penalty-shootout progression (heuristic on `fullResult`). */
export function isCupTieAdvanced(result: string, fullResult: string): boolean {
	const r = normalizeFixtureResult(result);
	if (r === "W") return true;
	if (r !== "D") return false;
	const fr = (fullResult || "").toLowerCase();
	if (!fr.includes("pen")) return false;
	return (
		fr.includes("won") ||
		fr.includes(" win") ||
		fr.includes("dorkinians") ||
		fr.includes("beat") ||
		fr.includes("through")
	);
}

function toNumber(value: unknown): number {
	if (value === null || value === undefined) return 0;
	if (typeof value === "number") return Number.isNaN(value) ? 0 : value;
	if (typeof value === "object") {
		const o = value as { toNumber?: () => number; low?: number; high?: number };
		if (typeof o.toNumber === "function") return o.toNumber();
		if ("low" in o && "high" in o) return (o.low || 0) + (o.high || 0) * 4294967296;
	}
	const n = Number(value);
	return Number.isNaN(n) ? 0 : n;
}

export async function fetchDorkiniansLeagueFinishForTeamSeason(options: {
	graphLabel: string;
	seasonNorm: string;
	seasonHyphen: string;
	leagueTableTeamKey: string;
}): Promise<{ position: number | null; division: string }> {
	const { graphLabel, seasonNorm, seasonHyphen, leagueTableTeamKey } = options;
	if (!leagueTableTeamKey) {
		return { position: null, division: "" };
	}

	const ltRes = await neo4jService.runQuery(
		`
		MATCH (lt:LeagueTable {graphLabel: $graphLabel, teamName: $leagueKey})
		WHERE lt.season = $seasonNorm OR lt.season = $seasonHyphen
		  AND toLower(coalesce(lt.team, '')) CONTAINS 'dorkinians'
		RETURN lt.position AS position, lt.division AS division
		LIMIT 1
		`,
		{ graphLabel, seasonNorm, seasonHyphen, leagueKey: leagueTableTeamKey },
	);

	const rec = ltRes.records[0];
	if (rec) {
		const pos = rec.get("position");
		const div = rec.get("division");
		const position = pos != null ? Math.round(toNumber(pos)) : null;
		const division = div != null ? String(div).trim() : "";
		if (position != null && position > 0) {
			return { position, division };
		}
	}

	const hyphenFileSeason = normalizeSeasonFormat(seasonNorm, "hyphen");
	const seasonData = await getSeasonDataFromJSON(hyphenFileSeason);
	if (!seasonData?.teams?.[leagueTableTeamKey]?.table?.length) {
		return { position: null, division: "" };
	}
	const teamData = seasonData.teams[leagueTableTeamKey];
	const division = (teamData.division || "").trim();
	const dorkiniansEntry = teamData.table.find((entry) => entry.team.toLowerCase().includes("dorkinians"));
	if (!dorkiniansEntry || dorkiniansEntry.position == null) {
		return { position: null, division };
	}
	return { position: dorkiniansEntry.position, division };
}

/** Full league-table row for Dorkinians in the given XI's league file (JSON), when available. */
export async function fetchDorkiniansLeagueTableRowForTeamSeason(options: {
	seasonNorm: string;
	leagueTableTeamKey: string;
}): Promise<LeagueTableEntry | null> {
	const { seasonNorm, leagueTableTeamKey } = options;
	if (!leagueTableTeamKey) return null;
	const hyphenFileSeason = normalizeSeasonFormat(seasonNorm, "hyphen");
	const seasonData = await getSeasonDataFromJSON(hyphenFileSeason);
	if (!seasonData?.teams?.[leagueTableTeamKey]?.table?.length) {
		return null;
	}
	const teamData = seasonData.teams[leagueTableTeamKey];
	const dorkiniansEntry = teamData.table.find((entry) => entry.team.toLowerCase().includes("dorkinians"));
	return dorkiniansEntry ?? null;
}
