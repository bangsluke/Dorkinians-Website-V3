export interface PlayerTypePercentiles {
	goalsPer90: number;
	assistsPer90: number;
	appearances: number;
	minutes: number;
	cleanSheetsPer90: number;
}

export interface ClassifyPlayerTypeInput {
	numberTeamsPlayedFor: number;
	percentiles: PlayerTypePercentiles;
}

export function classifyPlayerType(input: ClassifyPlayerTypeInput): { type: string; reason: string } {
	const { percentiles, numberTeamsPlayedFor } = input;

	if (percentiles.goalsPer90 >= 80) {
		return {
			type: "The Sharpshooter",
			reason: `Top ${100 - percentiles.goalsPer90}% of the club for goals per 90`,
		};
	}
	if (percentiles.assistsPer90 >= 80) {
		return {
			type: "The Creator",
			reason: `Top ${100 - percentiles.assistsPer90}% of the club for assists per 90`,
		};
	}
	if (percentiles.appearances >= 90 && percentiles.minutes >= 90) {
		return { type: "The Ironman", reason: "Top 10% for both appearances and minutes in the season" };
	}
	if (percentiles.cleanSheetsPer90 >= 80) {
		return {
			type: "The Brick Wall",
			reason: `Top ${100 - percentiles.cleanSheetsPer90}% of the club for clean sheets per 90`,
		};
	}
	if (percentiles.goalsPer90 >= 70 && percentiles.assistsPer90 >= 70) {
		return { type: "The All-Rounder", reason: "Top 30% for both goals and assists per 90" };
	}
	if (numberTeamsPlayedFor >= 4) {
		return { type: "The Journeyman", reason: `Played for ${numberTeamsPlayedFor} different teams` };
	}
	return { type: "The Squad Player", reason: "A reliable member of the squad" };
}
