import { NextRequest, NextResponse } from "next/server";
import type { Record as NeoRecord, Node as Neo4jNode } from "neo4j-driver";
import { neo4jService } from "@/lib/neo4j";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { dataApiRateLimiter } from "@/lib/middleware/rateLimiter";
import { logError } from "@/lib/utils/logger";
import { BADGE_DEFINITIONS } from "@/lib/badges/catalog";
import { playerPropsFromNeo4j, type BadgePlayer } from "@/lib/badges/neo4jProps";
import { evaluateAllBadges, getBadgeProgress, highestTierFromEarned } from "@/lib/badges/evaluate";

const corsHeaders = getCorsHeadersWithSecurity();

const VALID_TIERS = new Set(["bronze", "silver", "gold", "diamond"]);

export function parseBadgeId(badgeId: string): { badgeKey: string; tier: string } | null {
	const parts = String(badgeId).split("_");
	const tier = parts[parts.length - 1] ?? "";
	if (!VALID_TIERS.has(tier)) return null;
	const badgeKey = parts.slice(0, -1).join("_");
	return badgeKey ? { badgeKey, tier } : null;
}

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function str(v: unknown): string {
	if (v == null) return "";
	return String(v);
}

function num(v: unknown): number {
	if (v == null) return 0;
	if (typeof v === "number" && Number.isFinite(v)) return v;
	if (typeof v === "object" && v !== null && "toNumber" in v && typeof (v as { toNumber: () => number }).toNumber === "function") {
		return (v as { toNumber: () => number }).toNumber();
	}
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}

function parseFixtureDate(value: string): Date | null {
	const raw = value.trim();
	if (!raw) return null;
	const iso = new Date(raw);
	if (!Number.isNaN(iso.getTime())) return iso;
	const parts = raw.split("/");
	if (parts.length === 3) {
		const [d, m, y] = parts.map((p) => Number(p));
		if (Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y)) {
			const dt = new Date(y, m - 1, d);
			if (!Number.isNaN(dt.getTime())) return dt;
		}
	}
	return null;
}

export function isFirstXiLabel(value: string): boolean {
	const normalized = value.trim().toLowerCase();
	return normalized === "1s" || normalized === "1st xi" || normalized === "1st";
}

function normalizeNameForCompare(value: string): string {
	return value.trim().toLowerCase();
}

function splitAwardPlayerNames(value: string): string[] {
	const raw = value.trim();
	if (!raw) return [];
	const lower = raw.toLowerCase();
	if (["n/a", "na", "tbc", "tbd", "pending"].includes(lower)) return [];
	return raw
		.split(/\s*,\s*|\s*&\s*|\s+and\s+|\s*\/\s*/i)
		.map((n) => normalizeNameForCompare(n))
		.filter((n) => n.length > 0 && !["n/a", "na", "tbc", "tbd", "pending"].includes(n));
}

function isoWeekKey(date: Date): string {
	const dt = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const day = dt.getUTCDay() || 7;
	dt.setUTCDate(dt.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
	const week = Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
	return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
	const rateLimitResponse = await dataApiRateLimiter(request);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	const { searchParams } = new URL(request.url);
	const playerName = searchParams.get("playerName")?.trim();
	if (!playerName) {
		return NextResponse.json({ error: "playerName is required" }, { status: 400, headers: corsHeaders });
	}

	try {
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			WHERE p.allowOnSite = true
			OPTIONAL MATCH (p)-[:HAS_BADGE]->(pb:PlayerBadge {graphLabel: $graphLabel})
			RETURN properties(p) AS props, collect(DISTINCT pb) AS badgeNodes
		`;
		const result = await neo4jService.runQuery(query, { graphLabel, playerName });

		if (!result.records.length) {
			return NextResponse.json({ error: "Player not found" }, { status: 404, headers: corsHeaders });
		}

		const record = result.records[0] as NeoRecord;
		const rawProps = record.get("props") as Record<string, unknown>;
		const badgeNodes = record.get("badgeNodes") as Array<Neo4jNode | null>;

		const player = playerPropsFromNeo4j(rawProps);

		const derivedRowsResult = await neo4jService.runQuery(
			`
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			WHERE p.allowOnSite = true
			OPTIONAL MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})<-[:HAS_MATCH_DETAILS]-(f:Fixture {graphLabel: $graphLabel})
			RETURN
				coalesce(md.date, "") AS matchDate,
				coalesce(f.season, "") AS season,
				coalesce(md.seasonWeek, "") AS seasonWeek,
				coalesce(f.result, "") AS result,
				coalesce(f.opposition, "") AS opposition,
				coalesce(f.homeOrAway, "") AS homeOrAway,
				toUpper(coalesce(f.compType, "")) AS compType,
				coalesce(md.team, "") AS team,
				toUpper(coalesce(md.class, "")) AS classCode,
				coalesce(md.assists, 0) AS assists,
				coalesce(md.yellowCards, 0) AS yellowCards,
				coalesce(md.redCards, 0) AS redCards,
				coalesce(md.conceded, 0) AS conceded,
				coalesce(f.veoLink, "") AS veoLink,
				coalesce(md.penaltyShootoutPenaltiesScored, 0) AS pssc,
				coalesce(md.penaltyShootoutPenaltiesSaved, 0) AS pssv
			`,
			{ graphLabel, playerName },
		);

		let weekdayGames = 0;
		let leagueWins = 0;
		let cupWins = 0;
		let friendlyWins = 0;
		let penaltyShootoutWins = 0;
		let veoLinkedGames = 0;
		let firstXiGames = 0;
		let derbyWinsReigations = 0;
		let betrayalWinsDorkinians = 0;
		let gkAppearances = 0;
		let defAppearances = 0;
		let midAppearances = 0;
		let fwdAppearances = 0;
		let gkConceded = 0;
		let defConceded = 0;
		let assistGames2Plus = 0;
		let penaltyShootoutPenaltiesSaved = 0;
		const gamesByWeekKey = new Map<string, number>();
		const seasonDiscipline = new Map<string, { apps: number; cards: number }>();

		for (const row of derivedRowsResult.records) {
			const matchDate = str(row.get("matchDate"));
			const dt = parseFixtureDate(matchDate);
			const day = dt?.getDay();
			if (day != null && day >= 1 && day <= 5) weekdayGames += 1;

			const resultValue = str(row.get("result")).toUpperCase();
			const opposition = str(row.get("opposition")).toLowerCase();
			const compType = str(row.get("compType"));
			if (resultValue === "W") {
				if (compType === "LEAGUE") leagueWins += 1;
				else if (compType === "CUP") cupWins += 1;
				else if (compType === "FRIENDLY") friendlyWins += 1;
				if (opposition.includes("reigations")) derbyWinsReigations += 1;
				if (opposition.includes("dorkinian")) betrayalWinsDorkinians += 1;
			}

			const pssc = num(row.get("pssc"));
			const pssv = num(row.get("pssv"));
			penaltyShootoutPenaltiesSaved += pssv;
			if (resultValue === "W" && (pssc > 0 || pssv > 0)) penaltyShootoutWins += 1;
			if (num(row.get("assists")) >= 2) assistGames2Plus += 1;

			const season = str(row.get("season")).trim();
			if (season) {
				const existing = seasonDiscipline.get(season) ?? { apps: 0, cards: 0 };
				existing.apps += 1;
				existing.cards += num(row.get("yellowCards")) + num(row.get("redCards"));
				seasonDiscipline.set(season, existing);
			}

			const seasonWeek = str(row.get("seasonWeek")).trim();
			const weekKey = seasonWeek || (dt ? `${season}:${isoWeekKey(dt)}` : "");
			if (weekKey) {
				gamesByWeekKey.set(weekKey, (gamesByWeekKey.get(weekKey) ?? 0) + 1);
			}

			if (str(row.get("veoLink")).trim() !== "") veoLinkedGames += 1;
			if (isFirstXiLabel(str(row.get("team")))) firstXiGames += 1;
			const classCode = str(row.get("classCode")).trim().toUpperCase();
			const conceded = num(row.get("conceded"));
			if (classCode === "GK") {
				gkAppearances += 1;
				gkConceded += conceded;
			} else if (classCode === "DEF") {
				defAppearances += 1;
				defConceded += conceded;
			}
			else if (classCode === "MID") midAppearances += 1;
			else if (classCode === "FWD") fwdAppearances += 1;
		}
		const weeksWithMultiGames = Array.from(gamesByWeekKey.values()).filter((count) => count > 1).length;
		const cleanSeasonCount = Array.from(seasonDiscipline.values()).filter((s) => s.apps > 0 && s.cards === 0).length;

		const potmWinnerResult = await neo4jService.runQuery(
			`
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:IN_PLAYER_OF_THE_MONTH]->(:PlayersOfTheMonth {graphLabel: $graphLabel})
			RETURN sum(CASE WHEN toLower(coalesce(r.position, "")) = "player 1" THEN 1 ELSE 0 END) AS potmWinnerCount
			`,
			{ graphLabel, playerName },
		);
		const potmWinnerCount = potmWinnerResult.records.length ? num(potmWinnerResult.records[0].get("potmWinnerCount")) : 0;

		const titleRows = await neo4jService.runQuery(
			`
			MATCH (ca:CaptainsAndAwards {graphLabel: $graphLabel})
			WHERE toLower(coalesce(ca.itemName, "")) CONTAINS "squad"
				AND (toLower(coalesce(ca.itemName, "")) CONTAINS "league" OR toLower(coalesce(ca.itemName, "")) CONTAINS "cup")
			RETURN ca.itemName AS itemName, properties(ca) AS props
			`,
			{ graphLabel },
		);
		const playerNameKey = normalizeNameForCompare(playerName);
		const leagueTitleKeys = new Set<string>();
		const cupTitleKeys = new Set<string>();
		for (const row of titleRows.records) {
			const itemName = str(row.get("itemName")).trim();
			const itemNameLower = itemName.toLowerCase();
			const isLeague = itemNameLower.includes("league");
			const isCup = itemNameLower.includes("cup");
			if (!isLeague && !isCup) continue;
			const props = (row.get("props") as Record<string, unknown>) ?? {};
			for (const [propKey, propValue] of Object.entries(props)) {
				if (!/^season\d{6}$/.test(propKey)) continue;
				const names = splitAwardPlayerNames(str(propValue));
				if (!names.includes(playerNameKey)) continue;
				const key = `${propKey}::${itemNameLower}`;
				if (isLeague) leagueTitleKeys.add(key);
				if (isCup) cupTitleKeys.add(key);
			}
		}

		const enrichedPlayer: BadgePlayer = {
			...player,
			weekdayGames,
			leagueWins,
			cupWins,
			friendlyWins,
			penaltyShootoutWins,
			veoLinkedGames,
			firstXiGames,
			derbyWinsReigations,
			betrayalWinsDorkinians,
			gkAppearances,
			defAppearances,
			midAppearances,
			fwdAppearances,
			gkConceded,
			defConceded,
			potmWinnerCount,
			assistGames2Plus,
			penaltyShootoutPenaltiesSaved,
			weeksWithMultiGames,
			cleanSeasonCount,
			leagueTitles: leagueTitleKeys.size,
			cupTitles: cupTitleKeys.size,
		};

		const earnedFromDb: Array<{
			badgeId: string;
			badgeKey: string;
			badgeName: string;
			badgeCategory: string;
			tier: string;
			description: string;
			earnedDate: string | null;
		}> = [];

		for (const node of badgeNodes) {
			if (!node || !node.properties) continue;
			const p = node.properties as Record<string, unknown>;
			const badgeId = str(p.badgeId);
			const parsed = parseBadgeId(badgeId);
			if (!parsed) continue;
			earnedFromDb.push({
				badgeId,
				badgeKey: parsed.badgeKey,
				badgeName: str(p.badgeName),
				badgeCategory: str(p.badgeCategory),
				tier: str(p.tier) || parsed.tier,
				description: str(p.description),
				earnedDate: p.earnedDate != null ? str(p.earnedDate) : null,
			});
		}

		const earnedDateByBadgeId = new Map<string, string | null>();
		for (const row of earnedFromDb) {
			if (!earnedDateByBadgeId.has(row.badgeId)) {
				earnedDateByBadgeId.set(row.badgeId, row.earnedDate);
			}
		}

		const evaluatedEarned = evaluateAllBadges(enrichedPlayer);
		const earned: Array<{
			badgeId: string;
			badgeKey: string;
			badgeName: string;
			badgeCategory: string;
			tier: string;
			description: string;
			earnedDate: string | null;
		}> = evaluatedEarned.map((row) => ({
			badgeId: row.badgeId,
			badgeKey: row.badgeKey,
			badgeName: row.badgeName,
			badgeCategory: row.badgeCategory,
			tier: row.tier,
			description: row.description,
			earnedDate: earnedDateByBadgeId.get(row.badgeId) ?? null,
		}));

		const progress = getBadgeProgress(enrichedPlayer);
		const totalBadges = earned.length;
		const highestBadgeTier = highestTierFromEarned(earned);
		const achieverCountsByBadgeKey: Record<string, number> = {};

		const achieverQuery = `
			MATCH (pb:PlayerBadge {graphLabel: $graphLabel})
			WITH pb.playerName as playerName, split(pb.badgeId, "_") as parts
			WITH playerName, parts[0..size(parts)-1] as keyParts
			WITH playerName, reduce(k = "", part IN keyParts | k + CASE WHEN k = "" THEN "" ELSE "_" END + part) as badgeKey
			WHERE badgeKey <> ""
			RETURN badgeKey, count(DISTINCT playerName) as achieverCount
		`;
		const achieverResult = await neo4jService.runQuery(achieverQuery, { graphLabel });
		for (const row of achieverResult.records) {
			const badgeKey = str(row.get("badgeKey")).trim();
			if (!badgeKey) continue;
			const raw = row.get("achieverCount");
			let achieverCount = 0;
			if (typeof raw === "number") {
				achieverCount = Number.isFinite(raw) ? raw : 0;
			} else if (raw && typeof raw === "object" && "toNumber" in raw && typeof (raw as { toNumber: () => number }).toNumber === "function") {
				achieverCount = (raw as { toNumber: () => number }).toNumber();
			} else {
				const n = Number(raw);
				achieverCount = Number.isFinite(n) ? n : 0;
			}
			achieverCountsByBadgeKey[badgeKey] = achieverCount;
		}

		const pbRows = await neo4jService.runQuery(
			`
			MATCH (pb:PlayerBadge {graphLabel: $graphLabel})
			RETURN pb.badgeId AS badgeId, pb.playerName AS playerName
			`,
			{ graphLabel },
		);
		const tierSets: Record<string, Record<string, Set<string>>> = {};
		for (const row of pbRows.records) {
			const badgeId = str(row.get("badgeId"));
			const pn = str(row.get("playerName"));
			const parsed = parseBadgeId(badgeId);
			if (!parsed) continue;
			const { badgeKey, tier } = parsed;
			if (!tierSets[badgeKey]) tierSets[badgeKey] = {};
			if (!tierSets[badgeKey][tier]) tierSets[badgeKey][tier] = new Set();
			tierSets[badgeKey][tier].add(pn);
		}
		const tierCountsByBadgeKey: Record<string, Record<string, number>> = {};
		for (const bk of Object.keys(tierSets)) {
			tierCountsByBadgeKey[bk] = {};
			for (const t of Object.keys(tierSets[bk])) {
				tierCountsByBadgeKey[bk][t] = tierSets[bk][t].size;
			}
		}

		const milestoneValuesByBadgeKey: Record<string, number> = {};
		for (const [badgeKey, definition] of Object.entries(BADGE_DEFINITIONS)) {
			const raw = definition.evaluate(enrichedPlayer as BadgePlayer);
			const v = typeof raw === "number" && !Number.isNaN(raw) ? raw : raw ? 1 : 0;
			milestoneValuesByBadgeKey[badgeKey] = v;
		}

		const allForLeaders = await neo4jService.runQuery(
			`
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE coalesce(p.allowOnSite, true) = true
			OPTIONAL MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})<-[:HAS_MATCH_DETAILS]-(f:Fixture {graphLabel: $graphLabel})
			WITH
				p,
				sum(CASE WHEN f.homeOrAway = "Home" AND f.result = "W" THEN 1 ELSE 0 END) AS homeWins,
				sum(CASE WHEN f.homeOrAway = "Away" AND f.result = "W" THEN 1 ELSE 0 END) AS awayWins,
				sum(CASE WHEN toUpper(coalesce(f.compType, "")) = "LEAGUE" AND f.result = "W" THEN 1 ELSE 0 END) AS leagueWins,
				sum(CASE WHEN toUpper(coalesce(f.compType, "")) = "CUP" AND f.result = "W" THEN 1 ELSE 0 END) AS cupWins,
				sum(CASE WHEN toUpper(coalesce(f.compType, "")) = "FRIENDLY" AND f.result = "W" THEN 1 ELSE 0 END) AS friendlyWins,
				sum(CASE WHEN f.result = "W" AND (coalesce(md.penaltyShootoutPenaltiesScored, 0) > 0 OR coalesce(md.penaltyShootoutPenaltiesSaved, 0) > 0) THEN 1 ELSE 0 END) AS penaltyShootoutWins,
				sum(CASE WHEN f.result = "W" AND toLower(coalesce(f.opposition, "")) CONTAINS "reigations" THEN 1 ELSE 0 END) AS derbyWinsReigations,
				sum(CASE WHEN f.result = "W" AND toLower(coalesce(f.opposition, "")) CONTAINS "dorkinian" THEN 1 ELSE 0 END) AS betrayalWinsDorkinians,
				sum(CASE WHEN trim(coalesce(f.veoLink, "")) <> "" THEN 1 ELSE 0 END) AS veoLinkedGames,
				sum(CASE WHEN toLower(trim(coalesce(md.team, ""))) IN ['1s', '1st xi', '1st'] THEN 1 ELSE 0 END) AS firstXiGames,
				sum(CASE WHEN toUpper(trim(coalesce(md.class, ""))) = "GK" THEN 1 ELSE 0 END) AS gkAppearances,
				sum(CASE WHEN toUpper(trim(coalesce(md.class, ""))) = "DEF" THEN 1 ELSE 0 END) AS defAppearances,
				sum(CASE WHEN toUpper(trim(coalesce(md.class, ""))) = "MID" THEN 1 ELSE 0 END) AS midAppearances,
				sum(CASE WHEN toUpper(trim(coalesce(md.class, ""))) = "FWD" THEN 1 ELSE 0 END) AS fwdAppearances,
				sum(CASE WHEN toUpper(trim(coalesce(md.class, ""))) = "GK" THEN coalesce(md.conceded, 0) ELSE 0 END) AS gkConceded,
				sum(CASE WHEN toUpper(trim(coalesce(md.class, ""))) = "DEF" THEN coalesce(md.conceded, 0) ELSE 0 END) AS defConceded,
				sum(CASE WHEN coalesce(md.assists, 0) >= 2 THEN 1 ELSE 0 END) AS assistGames2Plus,
				sum(coalesce(md.penaltyShootoutPenaltiesSaved, 0)) AS penaltyShootoutPenaltiesSaved,
				collect(coalesce(md.date, "")) AS matchDates
			RETURN
				p.playerName AS playerName,
				properties(p) AS props,
				homeWins,
				awayWins,
				leagueWins,
				cupWins,
				friendlyWins,
				penaltyShootoutWins,
				derbyWinsReigations,
				betrayalWinsDorkinians,
				veoLinkedGames,
				firstXiGames,
				gkAppearances,
				defAppearances,
				midAppearances,
				fwdAppearances,
				gkConceded,
				defConceded,
				assistGames2Plus,
				penaltyShootoutPenaltiesSaved,
				matchDates
			`,
			{ graphLabel },
		);
		const milestoneLeadersByBadgeKey: Record<string, { playerName: string; value: number }> = {};
		for (const [badgeKey, definition] of Object.entries(BADGE_DEFINITIONS)) {
			let bestName = "";
			let bestVal = Number.NEGATIVE_INFINITY;
			for (const row of allForLeaders.records) {
				const nm = str(row.get("playerName"));
				const props = row.get("props") as Record<string, unknown>;
				const pl = playerPropsFromNeo4j(props);
				const matchDates = (row.get("matchDates") as unknown[] | null) ?? [];
				const weekdayGames = matchDates.reduce<number>((count, d) => {
					const dt = parseFixtureDate(str(d));
					const day = dt?.getDay();
					return day != null && day >= 1 && day <= 5 ? count + 1 : count;
				}, 0);
				const enrichedLeaderPlayer: BadgePlayer = {
					...pl,
					homeWins: num(row.get("homeWins")),
					awayWins: num(row.get("awayWins")),
					leagueWins: num(row.get("leagueWins")),
					cupWins: num(row.get("cupWins")),
					friendlyWins: num(row.get("friendlyWins")),
					penaltyShootoutWins: num(row.get("penaltyShootoutWins")),
					derbyWinsReigations: num(row.get("derbyWinsReigations")),
					betrayalWinsDorkinians: num(row.get("betrayalWinsDorkinians")),
					veoLinkedGames: num(row.get("veoLinkedGames")),
					firstXiGames: num(row.get("firstXiGames")),
					gkAppearances: num(row.get("gkAppearances")),
					defAppearances: num(row.get("defAppearances")),
					midAppearances: num(row.get("midAppearances")),
					fwdAppearances: num(row.get("fwdAppearances")),
					gkConceded: num(row.get("gkConceded")),
					defConceded: num(row.get("defConceded")),
					assistGames2Plus: num(row.get("assistGames2Plus")),
					penaltyShootoutPenaltiesSaved: num(row.get("penaltyShootoutPenaltiesSaved")),
					weekdayGames,
				};
				const raw = definition.evaluate(enrichedLeaderPlayer as BadgePlayer);
				const v = typeof raw === "number" && !Number.isNaN(raw) ? raw : raw ? 1 : 0;
				if (v > bestVal) {
					bestVal = v;
					bestName = nm;
				}
			}
			milestoneLeadersByBadgeKey[badgeKey] = {
				playerName: bestName,
				value: bestVal === Number.NEGATIVE_INFINITY ? 0 : bestVal,
			};
		}

		return NextResponse.json(
			{
				playerName,
				totalBadges,
				highestBadgeTier,
				earned,
				progress,
				achieverCountsByBadgeKey,
				tierCountsByBadgeKey,
				milestoneValuesByBadgeKey,
				milestoneLeadersByBadgeKey,
			},
			{ headers: corsHeaders },
		);
	} catch (error) {
		logError("player-badges GET", error);
		return NextResponse.json({ error: "Failed to load badges", earned: [], progress: [] }, { status: 500, headers: corsHeaders });
	}
}
