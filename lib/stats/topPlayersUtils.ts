export interface TopPlayer {
	playerName: string;
	appearances: number;
	goals: number;
	assists: number;
	cleanSheets: number;
	mom: number;
	penaltiesScored: number;
	saves: number;
	yellowCards: number;
	redCards: number;
	fantasyPoints: number;
	goalInvolvements: number;
	homeGames: number;
	awayGames: number;
	minutes: number;
	ownGoals: number;
	conceded: number;
	penaltiesMissed: number;
	penaltiesConceded: number;
	penaltiesSaved: number;
	distance: number;
	starts: number;
	averageMatchRating: number | null;
	matchesRated8Plus: number;
	goalsPer90: number | null;
	assistsPer90: number | null;
	goalInvolvementsPer90: number | null;
	ftpPer90: number | null;
	cleanSheetsPer90: number | null;
	concededPer90: number | null;
	savesPer90: number | null;
	cardsPer90: number | null;
	momPer90: number | null;
	currentFormEwma: number | null;
}

export type TopPlayerWithRank = TopPlayer & { rank: number };

export type TopPlayersStatType =
	| "appearances"
	| "starts"
	| "goals"
	| "assists"
	| "cleanSheets"
	| "mom"
	| "saves"
	| "yellowCards"
	| "redCards"
	| "penaltiesScored"
	| "fantasyPoints"
	| "goalInvolvements"
	| "minutes"
	| "ownGoals"
	| "conceded"
	| "penaltiesMissed"
	| "penaltiesConceded"
	| "penaltiesSaved"
	| "distance"
	| "avgMatchRating"
	| "matchesRated8Plus"
	| "goalsPer90"
	| "assistsPer90"
	| "goalInvolvementsPer90"
	| "ftpPer90"
	| "cleanSheetsPer90"
	| "concededPer90"
	| "savesPer90"
	| "cardsPer90"
	| "momPer90"
	| "bestCurrentForm";

export function normalizeTopPlayer(raw: Partial<TopPlayer>): TopPlayer {
	return {
		...(raw as TopPlayer),
		playerName: raw.playerName ?? "",
		appearances: typeof raw.appearances === "number" ? raw.appearances : 0,
		goals: typeof raw.goals === "number" ? raw.goals : 0,
		assists: typeof raw.assists === "number" ? raw.assists : 0,
		cleanSheets: typeof raw.cleanSheets === "number" ? raw.cleanSheets : 0,
		mom: typeof raw.mom === "number" ? raw.mom : 0,
		penaltiesScored: typeof raw.penaltiesScored === "number" ? raw.penaltiesScored : 0,
		saves: typeof raw.saves === "number" ? raw.saves : 0,
		yellowCards: typeof raw.yellowCards === "number" ? raw.yellowCards : 0,
		redCards: typeof raw.redCards === "number" ? raw.redCards : 0,
		fantasyPoints: typeof raw.fantasyPoints === "number" ? raw.fantasyPoints : 0,
		goalInvolvements: typeof raw.goalInvolvements === "number" ? raw.goalInvolvements : 0,
		homeGames: typeof raw.homeGames === "number" ? raw.homeGames : 0,
		awayGames: typeof raw.awayGames === "number" ? raw.awayGames : 0,
		minutes: typeof raw.minutes === "number" ? raw.minutes : 0,
		ownGoals: typeof raw.ownGoals === "number" ? raw.ownGoals : 0,
		conceded: typeof raw.conceded === "number" ? raw.conceded : 0,
		penaltiesMissed: typeof raw.penaltiesMissed === "number" ? raw.penaltiesMissed : 0,
		penaltiesConceded: typeof raw.penaltiesConceded === "number" ? raw.penaltiesConceded : 0,
		penaltiesSaved: typeof raw.penaltiesSaved === "number" ? raw.penaltiesSaved : 0,
		distance: typeof raw.distance === "number" ? raw.distance : 0,
		starts: typeof raw.starts === "number" ? raw.starts : 0,
		averageMatchRating: raw.averageMatchRating ?? null,
		matchesRated8Plus: typeof raw.matchesRated8Plus === "number" ? raw.matchesRated8Plus : 0,
		goalsPer90: typeof raw.goalsPer90 === "number" ? raw.goalsPer90 : null,
		assistsPer90: typeof raw.assistsPer90 === "number" ? raw.assistsPer90 : null,
		goalInvolvementsPer90: typeof raw.goalInvolvementsPer90 === "number" ? raw.goalInvolvementsPer90 : null,
		ftpPer90: typeof raw.ftpPer90 === "number" ? raw.ftpPer90 : null,
		cleanSheetsPer90: typeof raw.cleanSheetsPer90 === "number" ? raw.cleanSheetsPer90 : null,
		concededPer90: typeof raw.concededPer90 === "number" ? raw.concededPer90 : null,
		savesPer90: typeof raw.savesPer90 === "number" ? raw.savesPer90 : null,
		cardsPer90: typeof raw.cardsPer90 === "number" ? raw.cardsPer90 : null,
		momPer90: typeof raw.momPer90 === "number" ? raw.momPer90 : null,
		currentFormEwma: typeof raw.currentFormEwma === "number" ? raw.currentFormEwma : null,
	};
}

export function getStatValue(player: TopPlayer, statType: TopPlayersStatType): number {
	switch (statType) {
		case "appearances":
			return player.appearances;
		case "starts":
			return player.starts;
		case "goals":
			return player.goals + player.penaltiesScored;
		case "assists":
			return player.assists;
		case "cleanSheets":
			return player.cleanSheets;
		case "mom":
			return player.mom;
		case "saves":
			return player.saves;
		case "yellowCards":
			return player.yellowCards;
		case "redCards":
			return player.redCards;
		case "penaltiesScored":
			return player.penaltiesScored;
		case "fantasyPoints":
			return Math.round(player.fantasyPoints);
		case "goalInvolvements":
			return player.goalInvolvements;
		case "minutes":
			return player.minutes;
		case "ownGoals":
			return player.ownGoals;
		case "conceded":
			return player.conceded;
		case "penaltiesMissed":
			return player.penaltiesMissed;
		case "penaltiesConceded":
			return player.penaltiesConceded;
		case "penaltiesSaved":
			return player.penaltiesSaved;
		case "distance":
			return player.distance;
		case "avgMatchRating":
			return player.averageMatchRating ?? 0;
		case "matchesRated8Plus":
			return player.matchesRated8Plus;
		case "goalsPer90":
			return player.goalsPer90 ?? 0;
		case "assistsPer90":
			return player.assistsPer90 ?? 0;
		case "goalInvolvementsPer90":
			return player.goalInvolvementsPer90 ?? 0;
		case "ftpPer90":
			return player.ftpPer90 ?? 0;
		case "cleanSheetsPer90":
			return player.cleanSheetsPer90 ?? 0;
		case "concededPer90":
			return player.concededPer90 ?? 0;
		case "savesPer90":
			return player.savesPer90 ?? 0;
		case "cardsPer90":
			return player.cardsPer90 ?? 0;
		case "momPer90":
			return player.momPer90 ?? 0;
		case "bestCurrentForm":
			return player.currentFormEwma ?? 0;
		default:
			return 0;
	}
}

export function formatStatValue(player: TopPlayer, statType: TopPlayersStatType): string | number {
	const statValue = getStatValue(player, statType);
	if (statType === "minutes") {
		return statValue.toLocaleString();
	}
	if (statType === "distance") {
		return (Math.round(statValue * 10) / 10).toFixed(1);
	}
	if (statType === "avgMatchRating") {
		return player.averageMatchRating != null ? player.averageMatchRating.toFixed(1) : "-";
	}
	if (
		[
			"goalsPer90",
			"assistsPer90",
			"goalInvolvementsPer90",
			"ftpPer90",
			"cleanSheetsPer90",
			"concededPer90",
			"savesPer90",
			"cardsPer90",
			"momPer90",
		].includes(statType)
	) {
		const per90Value =
			statType === "goalsPer90"
				? player.goalsPer90
				: statType === "assistsPer90"
					? player.assistsPer90
					: statType === "goalInvolvementsPer90"
						? player.goalInvolvementsPer90
						: statType === "ftpPer90"
							? player.ftpPer90
							: statType === "cleanSheetsPer90"
								? player.cleanSheetsPer90
								: statType === "concededPer90"
									? player.concededPer90
									: statType === "savesPer90"
										? player.savesPer90
										: statType === "cardsPer90"
											? player.cardsPer90
											: player.momPer90;
		return per90Value != null ? per90Value.toFixed(2) : "-";
	}
	if (statType === "bestCurrentForm") {
		return player.currentFormEwma != null ? player.currentFormEwma.toFixed(1) : "-";
	}
	return statValue;
}

export function formatPlayerSummary(player: TopPlayer, statType: TopPlayersStatType): string {
	const apps = `${player.appearances} ${player.appearances === 1 ? "App" : "Apps"}`;

	switch (statType) {
		case "appearances": {
			const homeGamesText = `${player.homeGames} ${player.homeGames === 1 ? "Home Game" : "Home Games"}`;
			const awayGamesText = `${player.awayGames} ${player.awayGames === 1 ? "Away Game" : "Away Games"}`;
			return `${homeGamesText} and ${awayGamesText}`;
		}
		case "starts":
			return `${player.starts} ${player.starts === 1 ? "start" : "starts"} in ${apps}`;
		case "goals": {
			const totalGoals = player.goals + player.penaltiesScored;
			const penaltyText =
				player.penaltiesScored > 0
					? ` (incl. ${player.penaltiesScored} ${player.penaltiesScored === 1 ? "penalty" : "penalties"})`
					: "";
			return `${totalGoals} ${totalGoals === 1 ? "Goal" : "Goals"}${penaltyText} in ${apps}`;
		}
		case "assists":
			return `${player.assists} ${player.assists === 1 ? "Assist" : "Assists"} in ${apps}`;
		case "cleanSheets":
			return `${player.cleanSheets} ${player.cleanSheets === 1 ? "Clean Sheet" : "Clean Sheets"} in ${apps}`;
		case "mom":
			return `${player.mom} ${player.mom === 1 ? "Man of the Match" : "Man of the Matches"} in ${apps}`;
		case "saves":
			return `${player.saves} ${player.saves === 1 ? "Save" : "Saves"} in ${apps}`;
		case "yellowCards":
			return `${player.yellowCards} ${player.yellowCards === 1 ? "Yellow Card" : "Yellow Cards"} in ${apps}`;
		case "redCards":
			return `${player.redCards} ${player.redCards === 1 ? "Red Card" : "Red Cards"} in ${apps}`;
		case "penaltiesScored":
			return `${player.penaltiesScored} ${player.penaltiesScored === 1 ? "Penalty Scored" : "Penalties Scored"} in ${apps}`;
		case "fantasyPoints":
			return `${Math.round(player.fantasyPoints)} ${Math.round(player.fantasyPoints) === 1 ? "Fantasy Point" : "Fantasy Points"} in ${apps}`;
		case "goalInvolvements": {
			const totalGoalsForInvolvements = player.goals + player.penaltiesScored;
			const penaltyTextGi =
				player.penaltiesScored > 0
					? ` (incl. ${player.penaltiesScored} ${player.penaltiesScored === 1 ? "penalty" : "penalties"})`
					: "";
			const goalsText = `${totalGoalsForInvolvements} ${totalGoalsForInvolvements === 1 ? "Goal" : "Goals"}${penaltyTextGi}`;
			const assistsText = `${player.assists} ${player.assists === 1 ? "Assist" : "Assists"}`;
			return `${goalsText} and ${assistsText} in ${apps}`;
		}
		case "minutes":
			return `${player.minutes.toLocaleString()} ${player.minutes === 1 ? "Minute" : "Minutes"} in ${apps}`;
		case "ownGoals":
			return `${player.ownGoals} ${player.ownGoals === 1 ? "Own Goal" : "Own Goals"} in ${apps}`;
		case "conceded":
			return `${player.conceded} ${player.conceded === 1 ? "Goal Conceded" : "Goals Conceded"} in ${apps}`;
		case "penaltiesMissed":
			return `${player.penaltiesMissed} ${player.penaltiesMissed === 1 ? "Penalty Missed" : "Penalties Missed"} in ${apps}`;
		case "penaltiesConceded":
			return `${player.penaltiesConceded} ${player.penaltiesConceded === 1 ? "Penalty Conceded" : "Penalties Conceded"} in ${apps}`;
		case "penaltiesSaved":
			return `${player.penaltiesSaved} ${player.penaltiesSaved === 1 ? "Penalty Saved" : "Penalties Saved"} in ${apps}`;
		case "distance": {
			const roundedDistance = Math.round(player.distance * 10) / 10;
			return `${roundedDistance} miles travelled to games in ${apps}`;
		}
		case "avgMatchRating": {
			const ar = player.averageMatchRating;
			return ar != null ? `Average rating ${ar.toFixed(1)} in ${apps}` : apps;
		}
		case "matchesRated8Plus":
			return `${player.matchesRated8Plus} ${player.matchesRated8Plus === 1 ? "game" : "games"} rated 8+ in ${apps}`;
		case "goalsPer90":
			return player.goalsPer90 != null ? `${player.goalsPer90.toFixed(2)} goals per 90 (${apps})` : "Needs 360+ minutes";
		case "assistsPer90":
			return player.assistsPer90 != null ? `${player.assistsPer90.toFixed(2)} assists per 90 (${apps})` : "Needs 360+ minutes";
		case "goalInvolvementsPer90":
			return player.goalInvolvementsPer90 != null
				? `${player.goalInvolvementsPer90.toFixed(2)} GI per 90 (${apps})`
				: "Needs 360+ minutes";
		case "ftpPer90":
			return player.ftpPer90 != null ? `${player.ftpPer90.toFixed(2)} FTP per 90 (${apps})` : "Needs 360+ minutes";
		case "cleanSheetsPer90":
			return player.cleanSheetsPer90 != null
				? `${player.cleanSheetsPer90.toFixed(2)} clean sheets per 90 (${apps})`
				: "Needs 360+ minutes";
		case "concededPer90":
			return player.concededPer90 != null ? `${player.concededPer90.toFixed(2)} conceded per 90 (${apps})` : "Needs 360+ minutes";
		case "savesPer90":
			return player.savesPer90 != null ? `${player.savesPer90.toFixed(2)} saves per 90 (${apps})` : "Needs 360+ minutes";
		case "cardsPer90":
			return player.cardsPer90 != null ? `${player.cardsPer90.toFixed(2)} cards per 90 (${apps})` : "Needs 360+ minutes";
		case "momPer90":
			return player.momPer90 != null ? `${player.momPer90.toFixed(2)} MoM per 90 (${apps})` : "Needs 360+ minutes";
		case "bestCurrentForm":
			return player.currentFormEwma != null ? `Current form ${player.currentFormEwma.toFixed(1)} (${apps})` : apps;
		default:
			return apps;
	}
}

export function getStatTypeLabel(statType: TopPlayersStatType): string {
	switch (statType) {
		case "appearances":
			return "Appearances";
		case "starts":
			return "Starts";
		case "goals":
			return "Goals";
		case "assists":
			return "Assists";
		case "cleanSheets":
			return "Clean Sheets";
		case "mom":
			return "Man of the Matches";
		case "saves":
			return "Saves";
		case "yellowCards":
			return "Yellow Cards";
		case "redCards":
			return "Red Cards";
		case "penaltiesScored":
			return "Penalties Scored";
		case "fantasyPoints":
			return "Fantasy Points";
		case "goalInvolvements":
			return "Goal Involvements";
		case "minutes":
			return "Minutes Played";
		case "ownGoals":
			return "Own Goals";
		case "conceded":
			return "Goals Conceded";
		case "penaltiesMissed":
			return "Penalties Missed";
		case "penaltiesConceded":
			return "Penalties Conceded";
		case "penaltiesSaved":
			return "Penalties Saved";
		case "distance":
			return "Distance Travelled";
		case "avgMatchRating":
			return "Avg match rating";
		case "matchesRated8Plus":
			return "Matches rated 8+";
		case "goalsPer90":
			return "Goals per 90";
		case "assistsPer90":
			return "Assists per 90";
		case "goalInvolvementsPer90":
			return "Goal involvements per 90";
		case "ftpPer90":
			return "FTP per 90";
		case "cleanSheetsPer90":
			return "Clean sheets per 90";
		case "concededPer90":
			return "Conceded per 90";
		case "savesPer90":
			return "Saves per 90";
		case "cardsPer90":
			return "Cards per 90";
		case "momPer90":
			return "MoM per 90";
		case "bestCurrentForm":
			return "Best current form";
		default:
			return "Appearances";
	}
}

export function formatRank(rank: number): string {
	const lastDigit = rank % 10;
	const lastTwoDigits = rank % 100;

	if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
		return `${rank}th`;
	}

	switch (lastDigit) {
		case 1:
			return `${rank}st`;
		case 2:
			return `${rank}nd`;
		case 3:
			return `${rank}rd`;
		default:
			return `${rank}th`;
	}
}
