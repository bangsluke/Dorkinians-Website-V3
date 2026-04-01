export interface PlayerTypePercentiles {
	goalsPer90: number;
	assistsPer90: number;
	appearances: number;
	minutes: number;
	cleanSheetsPer90: number;
	/** Club percentile for FTP (fantasy points) per 90 in the wrapped season cohort. */
	ftpPer90?: number;
	/** Club percentile for total distance in the wrapped season cohort. */
	distance?: number;
	/** Club percentile for MoM per 90 (season cohort, min minutes for per-90). */
	momPer90?: number;
	/** Club percentile for start rate (starts ÷ appearances), cohort with 5+ apps. */
	startRate?: number;
}

export interface ClassifyPlayerTypeInput {
	numberTeamsPlayedFor: number;
	percentiles: PlayerTypePercentiles;
}

/**
 * Rule-based “player type” for Season Wrapped. Higher rules win (order matters).
 * Extend here when adding new archetypes; unit tests in `__tests__/unit/wrapped/classifyPlayerType.test.ts`.
 */
export function classifyPlayerType(input: ClassifyPlayerTypeInput): { type: string; reason: string } {
	const { percentiles, numberTeamsPlayedFor } = input;
	const ftp = percentiles.ftpPer90 ?? 0;
	const dist = percentiles.distance ?? 0;
	const mom = percentiles.momPer90 ?? 0;
	const sr = percentiles.startRate ?? 0;
	const g = percentiles.goalsPer90;
	const a = percentiles.assistsPer90;
	const apps = percentiles.appearances;
	const mins = percentiles.minutes;
	const cs = percentiles.cleanSheetsPer90;

	if (g >= 80) {
		return {
			type: "The Sharpshooter",
			reason: `Top ${100 - g}% of the club for goals per 90`,
		};
	}
	if (a >= 80) {
		return {
			type: "The Creator",
			reason: `Top ${100 - a}% of the club for assists per 90`,
		};
	}
	if (cs >= 80) {
		return {
			type: "The Brick Wall",
			reason: `Top ${100 - cs}% of the club for clean sheets per 90`,
		};
	}
	if (ftp >= 82) {
		return {
			type: "The Point Machine",
			reason: `Top ${100 - ftp}% of the club for fantasy points per 90`,
		};
	}
	if (mom >= 83) {
		return {
			type: "The MoM Magnet",
			reason: `Top ${100 - mom}% of the club for Man of the Match points per 90`,
		};
	}
	if (g >= 70 && a >= 70) {
		return { type: "The All-Rounder", reason: "Top 30% for both goals and assists per 90" };
	}
	if (g >= 65 && g < 80) {
		return {
			type: "The Finisher",
			reason: `Top ${100 - g}% for goals per 90`,
		};
	}
	if (a >= 65 && a < 80) {
		return {
			type: "The Playmaker",
			reason: `Top ${100 - a}% for assists per 90`,
		};
	}
	if (a >= 52 && a < 65 && g >= 40 && g < 70 && ftp < 78) {
		return {
			type: "The Bridge",
			reason: "Strong link-up play - assists stack up without elite goal volume",
		};
	}
	if (g >= 58 && g < 70 && apps < 52) {
		return {
			type: "The Sniper",
			reason: "Ruthless in limited outings - goals per 90 stand out in a smaller sample",
		};
	}
	if (ftp >= 70 && ftp < 82) {
		return {
			type: "The Engine",
			reason: `Strong fantasy output - top ${100 - ftp}% for FTP per 90`,
		};
	}
	if (ftp >= 48 && ftp < 70 && g < 58 && a < 58 && apps >= 44 && mins >= 44) {
		return {
			type: "The Metronome",
			reason: "Steady fantasy returns week to week without headline goals or assists",
		};
	}
	if (mins >= 85 && apps < 88) {
		return {
			type: "The Marathon Runner",
			reason: "Huge minutes load - among the club’s busiest players this season",
		};
	}
	if (sr >= 87 && sr > 0 && apps >= 48 && apps < 90) {
		return {
			type: "The First XI Lock",
			reason: "Almost always in the starting lineup when you’re named",
		};
	}
	if (apps >= 75 && apps < 90) {
		return {
			type: "The Ever-Present",
			reason: "One of the most reliable names on the team sheet",
		};
	}
	if (sr <= 34 && sr > 0 && apps >= 32 && (g >= 40 || a >= 40)) {
		return {
			type: "The Bench Impact",
			reason: "Mostly from the bench but your numbers still move the needle",
		};
	}
	if (cs >= 65 && cs < 80) {
		return {
			type: "The Defensive Anchor",
			reason: "Strong defensive contribution for your minutes",
		};
	}
	if (cs >= 58 && cs < 80 && g < 52 && a < 52) {
		return {
			type: "The Ice Pack",
			reason: "Shutouts and discipline up front - not chasing goals or assists",
		};
	}
	if (dist >= 82) {
		return {
			type: "The Road Warrior",
			reason: `Top ${100 - dist}% of the club for miles travelled this season`,
		};
	}
	if (dist >= 70 && dist < 82 && ftp > 0 && ftp <= 54) {
		return {
			type: "The Ghost Runner",
			reason: "Covering huge ground - distance ranks high while FTP stays modest",
		};
	}
	if (g >= 55 && a >= 55) {
		return {
			type: "The Two-Way Threat",
			reason: "Above average in both goals and assists per 90",
		};
	}
	if (dist >= 58 && dist < 70 && mins >= 62 && ftp > 0 && ftp <= 56) {
		return {
			type: "The Yard Dog",
			reason: "Non-stop running - strong mileage with workmanlike attacking returns",
		};
	}
	if (apps < 42 && mins < 48 && (g >= 45 || a >= 45)) {
		return {
			type: "The Cameo",
			reason: "Fewer minutes than most - but your per-90 impact still shows",
		};
	}
	if (mins >= 80 && apps < 78 && apps >= 28 && g >= 48 && g < 70 && a < 75) {
		return {
			type: "The Closer",
			reason: "Heavy minutes when you play - carrying a goal threat deep into games",
		};
	}
	if (apps >= 38 && apps <= 62 && mins >= 38 && mins <= 62 && g < 65 && a < 65 && ftp >= 35 && ftp <= 65 && mom < 80) {
		return {
			type: "The Middle Mile",
			reason: "Right in the pack across appearances, minutes, and output - the squad’s glue",
		};
	}
	if (numberTeamsPlayedFor >= 4) {
		return { type: "The Journeyman", reason: `Played for ${numberTeamsPlayedFor} different teams` };
	}
	if (numberTeamsPlayedFor >= 3) {
		return {
			type: "The Utility Belt",
			reason: `Turned out for ${numberTeamsPlayedFor} different XIs this season`,
		};
	}
	if (apps >= 90 && mins >= 90) {
		return { type: "The Ironman", reason: "Top 10% for both appearances and minutes in the season" };
	}
	return { type: "The Squad Player", reason: "A reliable member of the squad" };
}
