import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { computeWrappedData } from "@/lib/wrapped/computeWrappedData";
import { wrappedSlugToPlayerName } from "@/lib/wrapped/slug";
import { getSitePublicOrigin } from "@/lib/wrapped/siteOrigin";
import type { WrappedData } from "@/lib/wrapped/types";

export const runtime = "nodejs";

function ordinalSuffix(n: number): string {
	const abs = Math.floor(Math.abs(n));
	const j = abs % 10;
	const k = abs % 100;
	if (j === 1 && k !== 11) return "st";
	if (j === 2 && k !== 12) return "nd";
	if (j === 3 && k !== 13) return "rd";
	return "th";
}

function slideTitle(n: number, data: WrappedData): { title: string; subtitle: string } {
	switch (n) {
		case 1:
			return {
				title: "Season overview",
				subtitle: `${data.totalMatches} apps · ${data.totalGoals} goals · ${data.totalAssists} assists · ${data.totalMom} MoM`,
			};
		case 2:
			return {
				title: "Versus the squad",
				subtitle: `More appearances than ${data.matchesPercentile}% of the club this season`,
			};
		case 3:
			return { title: "Best month", subtitle: `${data.bestMonth} · ${data.bestMonthGoals}G ${data.bestMonthAssists}A` };
		case 4:
			return {
				title: "Teammate chemistry",
				subtitle:
					data.topPartnerName === "—"
						? "Partnership data still loading in the graph"
						: `With ${data.topPartnerName}: ${data.topPartnerWinRate}% wins in ${data.topPartnerMatches} games`,
			};
		case 5:
			return { title: data.playerType, subtitle: data.playerTypeReason };
		case 6:
			return {
				title: "Peak performance",
				subtitle: `${data.peakMatchRating} vs ${data.peakMatchOpposition} (${data.peakMatchGoals}G ${data.peakMatchAssists}A)`,
			};
		case 11: {
			const pos = data.wrappedDominantTeamLeaguePosition;
			const posBit =
				pos != null && pos > 0 ?
					` · ${data.wrappedDominantTeam || "XI"} ${pos}${ordinalSuffix(pos)}`
				:	"";
			return {
				title: "Team season",
				subtitle: `${data.wrappedLeaguePointsContributed} league pts · ${data.wrappedCupTiesAdvanced} cup ties advanced${posBit}`,
			};
		}
		case 7:
			return data.longestStreakType
				? { title: "Streak spotlight", subtitle: `${data.longestStreakType}: ${data.longestStreakValue}` }
				: { title: "Streak spotlight", subtitle: "No 3+ game season streak — room to start one next year" };
		case 8:
			return { title: "Distance", subtitle: data.distanceEquivalent };
		case 10: {
			const n = data.veoFixtures?.length ?? 0;
			return {
				title: "Match videos (Veo)",
				subtitle:
					n > 5
						? `5 most recent of ${n} fixtures with recordings`
						: n > 0
							? `${n} fixture${n === 1 ? "" : "s"} with recordings`
							: "No Veo links this season",
			};
		}
		default:
			return { title: "Dorkinians Wrapped", subtitle: data.wrappedUrl };
	}
}

export async function GET(
	request: NextRequest,
	ctx: { params: Promise<{ playerSlug: string; slideNumber: string }> },
) {
	const { playerSlug, slideNumber } = await ctx.params;
	const name = wrappedSlugToPlayerName(decodeURIComponent(playerSlug));
	if (!name) {
		return new Response("Invalid slug", { status: 400 });
	}

	const n = Math.min(11, Math.max(1, parseInt(slideNumber, 10) || 1));
	const { searchParams } = new URL(request.url);
	const season = searchParams.get("season")?.trim() || undefined;
	const origin = getSitePublicOrigin(request);

	const result = await computeWrappedData({
		playerName: name,
		season,
		sitePublicOrigin: origin,
	});

	if ("error" in result) {
		return new Response(result.error, { status: result.status });
	}

	const data = result.data;
	const { title, subtitle } = slideTitle(n, data);

	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					padding: 48,
					background: "linear-gradient(145deg, #1c2418 0%, #2a3220 45%, #1a2218 100%)",
					color: "#fff",
					fontFamily: "system-ui, sans-serif",
				}}>
				<div style={{ fontSize: 28, color: "rgba(255,255,255,0.55)", marginBottom: 12 }}>Dorkinians FC · {data.season}</div>
				<div style={{ fontSize: 52, fontWeight: 700, marginBottom: 20, color: "#E8C547" }}>{data.playerName}</div>
				<div style={{ fontSize: 40, fontWeight: 600, marginBottom: 16 }}>{title}</div>
				<div style={{ fontSize: 26, color: "rgba(255,255,255,0.82)", maxWidth: 900, lineHeight: 1.35 }}>{subtitle}</div>
				<div style={{ position: "absolute", bottom: 36, left: 48, fontSize: 22, color: "rgba(255,255,255,0.45)" }}>
					dorkiniansfcstats.co.uk/wrapped
				</div>
			</div>
		),
		{ width: 1200, height: 630 },
	);
}
