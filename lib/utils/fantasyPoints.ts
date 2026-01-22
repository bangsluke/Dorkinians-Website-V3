// Shared utility for calculating fantasy points breakdown

export interface FTPBreakdown {
	stat: string;
	value: number | string;
	points: number;
	show: boolean;
}

export interface MatchDetailForFTP {
	class?: string;
	min?: number;
	mom?: boolean;
	goals?: number;
	assists?: number;
	conceded?: number;
	cleanSheets?: number;
	yellowCards?: number;
	redCards?: number;
	saves?: number;
	ownGoals?: number;
	penaltiesScored?: number;
	penaltiesMissed?: number;
	penaltiesConceded?: number;
	penaltiesSaved?: number;
}

// Calculate FTP breakdown for a single match
export function calculateFTPBreakdown(match: MatchDetailForFTP): FTPBreakdown[] {
	const playerClass = match.class;
	const breakdown: FTPBreakdown[] = [];

	// Minutes played (always show if player appeared)
	const minutes = match.min || 0;
	const minutesPoints = minutes >= 60 ? 2 : minutes > 0 ? 1 : 0;
	breakdown.push({
		stat: "Minutes played",
		value: minutes,
		points: minutesPoints,
		show: true,
	});

	// Man of the Match
	const mom = match.mom ? 1 : 0;
	breakdown.push({
		stat: "Man of the Match",
		value: mom,
		points: mom * 3,
		show: mom > 0,
	});

	// Goals scored (including penalties)
	const goals = (match.goals || 0) + (match.penaltiesScored || 0);
	let goalMultiplier = 0;
	if (playerClass === "GK" || playerClass === "DEF") {
		goalMultiplier = 6;
	} else if (playerClass === "MID") {
		goalMultiplier = 5;
	} else if (playerClass === "FWD") {
		goalMultiplier = 4;
	}
	breakdown.push({
		stat: "Goals scored",
		value: goals,
		points: goals * goalMultiplier,
		show: goals > 0,
	});

	// Assists
	const assists = match.assists || 0;
	breakdown.push({
		stat: "Assists",
		value: assists,
		points: assists * 3,
		show: assists > 0,
	});

	// Clean Sheets / Goals Conceded
	const conceded = match.conceded || 0;
	const cleanSheets = match.cleanSheets || 0;

	if (conceded === 0 && cleanSheets > 0) {
		// Show clean sheet
		let cleanSheetMultiplier = 0;
		if (playerClass === "GK" || playerClass === "DEF") {
			cleanSheetMultiplier = 4;
		} else if (playerClass === "MID") {
			cleanSheetMultiplier = 1;
		}
		breakdown.push({
			stat: "Clean Sheets",
			value: cleanSheets,
			points: cleanSheets * cleanSheetMultiplier,
			show: cleanSheets > 0,
		});
	} else if (conceded > 0) {
		// Show goals conceded (only for GK and DEF)
		if (playerClass === "GK" || playerClass === "DEF") {
			breakdown.push({
				stat: "Goals Conceded",
				value: conceded,
				points: Math.round(conceded * -0.5),
				show: true,
			});
		}
	}

	// Yellow Cards
	const yellowCards = match.yellowCards || 0;
	breakdown.push({
		stat: "Yellow Cards",
		value: yellowCards,
		points: yellowCards * -1,
		show: yellowCards > 0,
	});

	// Red Cards
	const redCards = match.redCards || 0;
	breakdown.push({
		stat: "Red Cards",
		value: redCards,
		points: redCards * -3,
		show: redCards > 0,
	});

	// Saves (for goalkeepers)
	// Calculate points per match: floor(saves/3)
	const saves = match.saves || 0;
	breakdown.push({
		stat: "Saves",
		value: saves,
		points: Math.floor(saves / 3),
		show: saves > 0,
	});

	// Own Goals
	const ownGoals = match.ownGoals || 0;
	breakdown.push({
		stat: "Own Goals",
		value: ownGoals,
		points: ownGoals * -2,
		show: ownGoals > 0,
	});

	// Penalties Missed
	const penaltiesMissed = match.penaltiesMissed || 0;
	breakdown.push({
		stat: "Penalties Missed",
		value: penaltiesMissed,
		points: penaltiesMissed * -2,
		show: penaltiesMissed > 0,
	});

	// Penalties Conceded
	const penaltiesConceded = match.penaltiesConceded || 0;
	breakdown.push({
		stat: "Penalties Conceded",
		value: penaltiesConceded,
		points: 0,
		show: penaltiesConceded > 0,
	});

	// Penalties Saved
	const penaltiesSaved = match.penaltiesSaved || 0;
	breakdown.push({
		stat: "Penalties Saved",
		value: penaltiesSaved,
		points: penaltiesSaved * 5,
		show: penaltiesSaved > 0,
	});

	return breakdown;
}

