import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";

const corsHeaders = getCorsHeadersWithSecurity();

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function formatNeoDate(d: unknown): string {
	if (d == null) return "";
	if (typeof d === "string") return d;
	if (typeof d === "object" && d !== null && "year" in d && "month" in d && "day" in d) {
		const y = (d as { year: number }).year;
		const m = (d as { month: number }).month;
		const day = (d as { day: number }).day;
		return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	}
	return String(d);
}

/**
 * Next upcoming fixture (any XI) in the next few days + squad players on notable active streaks (Feature 5).
 */
export async function GET(_request: NextRequest) {
	try {
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		const nextFixtureQuery = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
			WHERE f.date IS NOT NULL AND date(f.date) >= date() AND date(f.date) <= date() + duration({days: 5})
			WITH f ORDER BY f.date ASC
			LIMIT 1
			RETURN f.team AS team,
			  f.date AS matchDate,
			  f.opposition AS opposition,
			  f.homeOrAway AS homeOrAway
		`;

		const fxResult = await neo4jService.runQuery(nextFixtureQuery, { graphLabel });
		if (fxResult.records.length === 0) {
			return NextResponse.json({ upcoming: null, highlights: [] }, { headers: corsHeaders });
		}

		const fxRec = fxResult.records[0];
		const team = fxRec.get("team");
		if (team == null) {
			return NextResponse.json({ upcoming: null, highlights: [] }, { headers: corsHeaders });
		}

		const teamStr = String(team);
		const playersQuery = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			  AND p.mostPlayedForTeam = $teamName
			  AND (
				coalesce(p.currentScoringStreak, 0) >= 2 OR
				coalesce(p.currentWinStreak, 0) >= 2 OR
				coalesce(p.currentAppearanceStreak, 0) >= 3 OR
				coalesce(p.currentGoalInvolvementStreak, 0) >= 2
			  )
			WITH p
			ORDER BY
			  (coalesce(p.currentScoringStreak, 0) + coalesce(p.currentWinStreak, 0) * 2 + coalesce(p.currentAppearanceStreak, 0)) DESC
			LIMIT 8
			RETURN collect({
			  name: p.playerName,
			  scoring: coalesce(p.currentScoringStreak, 0),
			  win: coalesce(p.currentWinStreak, 0),
			  app: coalesce(p.currentAppearanceStreak, 0),
			  gi: coalesce(p.currentGoalInvolvementStreak, 0)
			}) AS players
		`;

		const pResult = await neo4jService.runQuery(playersQuery, { graphLabel, teamName: teamStr });
		const playersRaw =
			pResult.records.length > 0
				? ((pResult.records[0].get("players") as Array<Record<string, unknown>> | null) ?? null)
				: null;
		const highlights = (playersRaw || [])
			.filter((p) => p && p.name)
			.map((p) => ({
				playerName: String(p.name),
				currentScoringStreak: Number(p.scoring) || 0,
				currentWinStreak: Number(p.win) || 0,
				currentAppearanceStreak: Number(p.app) || 0,
				currentGoalInvolvementStreak: Number(p.gi) || 0,
			}));

		const upcoming = {
			team: teamStr,
			matchDate: formatNeoDate(fxRec.get("matchDate")),
			opposition: String(fxRec.get("opposition") ?? ""),
			homeOrAway: String(fxRec.get("homeOrAway") ?? ""),
		};

		return NextResponse.json({ upcoming, highlights }, { headers: corsHeaders });
	} catch (e) {
		console.error("club-streaks-preview:", e);
		return NextResponse.json({ upcoming: null, highlights: [], error: "preview_unavailable" }, { status: 200, headers: corsHeaders });
	}
}
