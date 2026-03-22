/**
 * Umami helpers for stats block / team selection — keep keys aligned with weekly report.
 */

import { UmamiEvents } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/utils/trackEvent";

export type StatsSubPageForLeaderboard = "player-stats" | "team-stats" | "club-stats";

/** Block ids match DOM anchors / StatsNavigationMenu. */
export type StatsBlockId =
	| "seasonal-performance"
	| "team-performance"
	| "monthly-performance"
	| "team-top-players"
	| "team-seasonal-performance"
	| "club-top-players"
	| "club-seasonal-performance"
	| "club-stats-distribution";

export function trackStatsStatSelected(
	statsSubPage: StatsSubPageForLeaderboard,
	blockId: StatsBlockId,
	statKey: string,
): void {
	const raw = String(statKey);
	const segment = raw.replace(/\//g, "_");
	const statsLeaderKey = `${statsSubPage}/${blockId}/${segment}`;
	trackEvent(UmamiEvents.StatsStatSelected, {
		statsLeaderKey,
		statsSubPage,
		blockId,
		statKey: raw,
	});
}

export function trackTeamStatsTeamSelected(teamLabel: string): void {
	trackEvent(UmamiEvents.TeamStatsTeamSelected, { teamLabel });
}
