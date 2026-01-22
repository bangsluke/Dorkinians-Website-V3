import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { Record } from "neo4j-driver";
import { calculateFTPBreakdown, FTPBreakdown } from "@/lib/utils/fantasyPoints";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const season = searchParams.get("season");
		const playerName = searchParams.get("playerName");

		if (!season || !playerName) {
			return NextResponse.json(
				{ error: "Season and playerName parameters are required" },
				{ status: 400, headers: corsHeaders },
			);
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Query aggregated stats for the player
		const statsQuery = season === "All Time"
			? `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				WITH p,
					count(md) as appearances,
					sum(COALESCE(md.goals, 0)) as goals,
					sum(COALESCE(md.assists, 0)) as assists,
					sum(COALESCE(md.cleanSheets, 0)) as cleanSheets,
					sum(COALESCE(md.conceded, 0)) as conceded,
					sum(COALESCE(md.saves, 0)) as saves,
					sum(COALESCE(md.yellowCards, 0)) as yellowCards,
					sum(COALESCE(md.redCards, 0)) as redCards,
					sum(COALESCE(md.ownGoals, 0)) as ownGoals,
					sum(COALESCE(md.penaltiesScored, 0)) as penaltiesScored,
					sum(COALESCE(md.penaltiesMissed, 0)) as penaltiesMissed,
					sum(COALESCE(md.penaltiesConceded, 0)) as penaltiesConceded,
					sum(COALESCE(md.penaltiesSaved, 0)) as penaltiesSaved,
					sum(CASE WHEN md.mom = 1 OR md.mom = true THEN 1 ELSE 0 END) as mom,
					sum(COALESCE(md.minutes, md.min, 0)) as totalMinutes,
					collect(DISTINCT md.class)[0] as playerClass
				RETURN appearances, goals, assists, cleanSheets, conceded, saves, yellowCards, redCards, ownGoals,
					penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, mom, totalMinutes, playerClass
			`
			: `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel, season: $season})
				WITH p,
					count(md) as appearances,
					sum(COALESCE(md.goals, 0)) as goals,
					sum(COALESCE(md.assists, 0)) as assists,
					sum(COALESCE(md.cleanSheets, 0)) as cleanSheets,
					sum(COALESCE(md.conceded, 0)) as conceded,
					sum(COALESCE(md.saves, 0)) as saves,
					sum(COALESCE(md.yellowCards, 0)) as yellowCards,
					sum(COALESCE(md.redCards, 0)) as redCards,
					sum(COALESCE(md.ownGoals, 0)) as ownGoals,
					sum(COALESCE(md.penaltiesScored, 0)) as penaltiesScored,
					sum(COALESCE(md.penaltiesMissed, 0)) as penaltiesMissed,
					sum(COALESCE(md.penaltiesConceded, 0)) as penaltiesConceded,
					sum(COALESCE(md.penaltiesSaved, 0)) as penaltiesSaved,
					sum(CASE WHEN md.mom = 1 OR md.mom = true THEN 1 ELSE 0 END) as mom,
					sum(COALESCE(md.minutes, md.min, 0)) as totalMinutes,
					collect(DISTINCT md.class)[0] as playerClass
				RETURN appearances, goals, assists, cleanSheets, conceded, saves, yellowCards, redCards, ownGoals,
					penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, mom, totalMinutes, playerClass
			`;

		const statsParams = season === "All Time"
			? { graphLabel, playerName }
			: { graphLabel, playerName, season };

		// Query individual match minutes to calculate points per match
		const minutesQuery = season === "All Time"
			? `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				RETURN COALESCE(md.minutes, md.min, 0) as minutes
			`
			: `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel, season: $season})
				RETURN COALESCE(md.minutes, md.min, 0) as minutes
			`;

		// Query individual match goals to calculate points per match based on position
		// Goals points depend on the position (class) played when the goal was scored
		const goalsQuery = season === "All Time"
			? `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				RETURN COALESCE(md.goals, 0) as goals, COALESCE(md.penaltiesScored, 0) as penaltiesScored, md.class as playerClass
			`
			: `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel, season: $season})
				RETURN COALESCE(md.goals, 0) as goals, COALESCE(md.penaltiesScored, 0) as penaltiesScored, md.class as playerClass
			`;

		// Query individual match clean sheets to calculate points per match
		// Clean sheets are awarded per match where conceded = 0 and cleanSheets > 0
		const cleanSheetsQuery = season === "All Time"
			? `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				RETURN md.conceded as conceded, md.cleanSheets as cleanSheets, md.class as playerClass
			`
			: `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel, season: $season})
				RETURN md.conceded as conceded, md.cleanSheets as cleanSheets, md.class as playerClass
			`;

		// Query individual match goals conceded to calculate points per match
		// Goals conceded points are deducted per match where conceded > 0 (only for GK/DEF)
		const goalsConcededQuery = season === "All Time"
			? `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				WHERE md.conceded > 0
				RETURN md.conceded as conceded, md.class as playerClass
			`
			: `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel, season: $season})
				WHERE md.conceded > 0
				RETURN md.conceded as conceded, md.class as playerClass
			`;

		// Query individual match saves to calculate points per match
		// Saves points are calculated per match: floor(saves/3) per match, then summed
		const savesQuery = season === "All Time"
			? `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				WHERE md.saves > 0
				RETURN md.saves as saves
			`
			: `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel, season: $season})
				WHERE md.saves > 0
				RETURN md.saves as saves
			`;

		const [statsResult, minutesResult, goalsResult, cleanSheetsResult, goalsConcededResult, savesResult] = await Promise.all([
			neo4jService.runQuery(statsQuery, statsParams),
			neo4jService.runQuery(minutesQuery, statsParams),
			neo4jService.runQuery(goalsQuery, statsParams),
			neo4jService.runQuery(cleanSheetsQuery, statsParams),
			neo4jService.runQuery(goalsConcededQuery, statsParams),
			neo4jService.runQuery(savesQuery, statsParams),
		]);

		if (statsResult.records.length === 0) {
			return NextResponse.json(
				{ error: "No stats found for player" },
				{ status: 404, headers: corsHeaders },
			);
		}

		const record = statsResult.records[0];
		
		// Extract aggregated stats
		const appearances = Number(record.get("appearances") || 0);
		const goals = Number(record.get("goals") || 0);
		const assists = Number(record.get("assists") || 0);
		const cleanSheets = Number(record.get("cleanSheets") || 0);
		const conceded = Number(record.get("conceded") || 0);
		const saves = Number(record.get("saves") || 0);
		const yellowCards = Number(record.get("yellowCards") || 0);
		const redCards = Number(record.get("redCards") || 0);
		const ownGoals = Number(record.get("ownGoals") || 0);
		const penaltiesScored = Number(record.get("penaltiesScored") || 0);
		const penaltiesMissed = Number(record.get("penaltiesMissed") || 0);
		const penaltiesConceded = Number(record.get("penaltiesConceded") || 0);
		const penaltiesSaved = Number(record.get("penaltiesSaved") || 0);
		const mom = Number(record.get("mom") || 0);
		const totalMinutes = Number(record.get("totalMinutes") || 0);
		const playerClass = String(record.get("playerClass") || "");

		// Calculate total minutes points by summing per-match points
		// For each match: 60+ minutes = 2 points, >0 minutes = 1 point
		let totalMinutesPoints = 0;
		minutesResult.records.forEach((record: Record) => {
			const minutes = Number(record.get("minutes") || 0);
			if (minutes >= 60) {
				totalMinutesPoints += 2;
			} else if (minutes > 0) {
				totalMinutesPoints += 1;
			}
		});

		// Calculate total goal points by summing per-match points based on position
		// For each match: calculate points based on position (class) played when goals were scored
		// Also aggregate goals by position for position-specific breakdown
		let totalGoalPoints = 0;
		const goalsByPosition: { [key: string]: { goals: number; points: number } } = {
			GK: { goals: 0, points: 0 },
			DEF: { goals: 0, points: 0 },
			MID: { goals: 0, points: 0 },
			FWD: { goals: 0, points: 0 },
		};
		goalsResult.records.forEach((record: Record) => {
			const matchGoals = Number(record.get("goals") || 0);
			const matchPenaltiesScored = Number(record.get("penaltiesScored") || 0);
			const matchPlayerClass = String(record.get("playerClass") || "");
			const totalGoalsInMatch = matchGoals + matchPenaltiesScored;
			
			if (totalGoalsInMatch > 0) {
				// Determine goal multiplier based on position
				let goalMultiplier = 0;
				if (matchPlayerClass === "GK" || matchPlayerClass === "DEF") {
					goalMultiplier = 6;
				} else if (matchPlayerClass === "MID") {
					goalMultiplier = 5;
				} else if (matchPlayerClass === "FWD") {
					goalMultiplier = 4;
				}
				totalGoalPoints += totalGoalsInMatch * goalMultiplier;
				
				// Aggregate goals by position
				if (matchPlayerClass === "GK" && goalsByPosition["GK"]) {
					goalsByPosition["GK"].goals += totalGoalsInMatch;
					goalsByPosition["GK"].points += totalGoalsInMatch * 6;
				} else if (matchPlayerClass === "DEF" && goalsByPosition["DEF"]) {
					goalsByPosition["DEF"].goals += totalGoalsInMatch;
					goalsByPosition["DEF"].points += totalGoalsInMatch * 6;
				} else if (matchPlayerClass === "MID" && goalsByPosition["MID"]) {
					goalsByPosition["MID"].goals += totalGoalsInMatch;
					goalsByPosition["MID"].points += totalGoalsInMatch * 5;
				} else if (matchPlayerClass === "FWD" && goalsByPosition["FWD"]) {
					goalsByPosition["FWD"].goals += totalGoalsInMatch;
					goalsByPosition["FWD"].points += totalGoalsInMatch * 4;
				}
			}
		});

		// Calculate total clean sheet points by summing per-match points
		// For each match: if conceded = 0 and cleanSheets > 0, award points based on position
		// Also aggregate clean sheets by position for position-specific breakdown
		let totalCleanSheetPoints = 0;
		const cleanSheetsByPosition: { [key: string]: { cleanSheets: number; points: number } } = {
			GK: { cleanSheets: 0, points: 0 },
			DEF: { cleanSheets: 0, points: 0 },
			MID: { cleanSheets: 0, points: 0 },
		};
		cleanSheetsResult.records.forEach((record: Record) => {
			const matchConceded = Number(record.get("conceded") || 0);
			const matchCleanSheets = Number(record.get("cleanSheets") || 0);
			const matchPlayerClass = String(record.get("playerClass") || "");
			
			if (matchConceded === 0 && matchCleanSheets > 0) {
				// Award clean sheet points based on position
				if (matchPlayerClass === "GK" || matchPlayerClass === "DEF") {
					totalCleanSheetPoints += 4;
					// Aggregate clean sheets by position
					if (matchPlayerClass === "GK" && cleanSheetsByPosition["GK"]) {
						cleanSheetsByPosition["GK"].cleanSheets += matchCleanSheets;
						cleanSheetsByPosition["GK"].points += 4;
					} else if (matchPlayerClass === "DEF" && cleanSheetsByPosition["DEF"]) {
						cleanSheetsByPosition["DEF"].cleanSheets += matchCleanSheets;
						cleanSheetsByPosition["DEF"].points += 4;
					}
				} else if (matchPlayerClass === "MID") {
					totalCleanSheetPoints += 1;
					if (cleanSheetsByPosition["MID"]) {
						cleanSheetsByPosition["MID"].cleanSheets += matchCleanSheets;
						cleanSheetsByPosition["MID"].points += 1;
					}
				}
			}
		});

		// Calculate FTP breakdown from aggregated stats
		// Create a match-like object for the FTP calculation function
		const aggregatedMatch = {
			class: playerClass,
			min: totalMinutes,
			mom: mom > 0,
			goals: goals,
			assists: assists,
			conceded: conceded,
			cleanSheets: cleanSheets,
			yellowCards: yellowCards,
			redCards: redCards,
			saves: saves,
			ownGoals: ownGoals,
			penaltiesScored: penaltiesScored,
			penaltiesMissed: penaltiesMissed,
			penaltiesConceded: penaltiesConceded,
			penaltiesSaved: penaltiesSaved,
		};

		// Calculate FTP breakdown
		let ftpBreakdown = calculateFTPBreakdown(aggregatedMatch);
		
		// Update "Minutes played" points with calculated total (sum of per-match points)
		let minutesPlayedIndex = -1;
		ftpBreakdown = ftpBreakdown.map((stat, index) => {
			if (stat.stat === "Minutes played") {
				minutesPlayedIndex = index;
				return { ...stat, points: totalMinutesPoints };
			}
			return stat;
		});

		// Update "Man of the Match" points with correct calculation (mom count * 3)
		// The calculateFTPBreakdown treats mom as boolean, but we have a count
		const momPoints = mom * 3;
		const momIndex = ftpBreakdown.findIndex(stat => stat.stat === "Man of the Match");
		if (mom > 0) {
			if (momIndex >= 0) {
				// Update existing MoM entry
				ftpBreakdown[momIndex] = {
					...ftpBreakdown[momIndex],
					value: mom,
					points: momPoints,
					show: true,
				};
			} else {
				// Add MoM entry if it doesn't exist - insert right after Minutes played
				const insertIndex = minutesPlayedIndex >= 0 ? minutesPlayedIndex + 1 : 0;
				ftpBreakdown.splice(insertIndex, 0, {
					stat: "Man of the Match",
					value: mom,
					points: momPoints,
					show: true,
				});
			}
		} else if (momIndex >= 0) {
			// Remove MoM entry if no MoM awards
			ftpBreakdown.splice(momIndex, 1);
		}

		// Remove "Goals scored" entry - will be replaced with position-specific entries
		ftpBreakdown = ftpBreakdown.filter(stat => stat.stat !== "Goals scored");

		// Remove "Clean Sheets" entry - will be replaced with position-specific entries
		ftpBreakdown = ftpBreakdown.filter(stat => stat.stat !== "Clean Sheets");

		// Calculate total goals conceded points by summing per-match points
		// Goals conceded points are deducted per match where conceded > 0 (only for GK/DEF, -0.5 per goal)
		let totalGoalsConcededPoints = 0;
		let totalGoalsConceded = 0;
		goalsConcededResult.records.forEach((record: Record) => {
			const matchConceded = Number(record.get("conceded") || 0);
			const matchPlayerClass = String(record.get("playerClass") || "");
			
			if (matchConceded > 0 && (matchPlayerClass === "GK" || matchPlayerClass === "DEF")) {
				const matchPoints = Math.round(matchConceded * -0.5);
				totalGoalsConcededPoints += matchPoints;
				totalGoalsConceded += matchConceded;
			}
		});

		// Calculate total saves points by summing per-match points
		// Saves points are calculated per match: floor(saves/3) per match, then summed
		let totalSavesPoints = 0;
		let totalSaves = 0;
		savesResult.records.forEach((record: Record) => {
			const matchSaves = Number(record.get("saves") || 0);
			if (matchSaves > 0) {
				const matchPoints = Math.floor(matchSaves / 3);
				totalSavesPoints += matchPoints;
				totalSaves += matchSaves;
			}
		});

		// Remove "Goals Conceded" entry - will be replaced with calculated per-match entry
		ftpBreakdown = ftpBreakdown.filter(stat => stat.stat !== "Goals Conceded");

		// Remove "Saves" entry - will be replaced with calculated per-match entry
		ftpBreakdown = ftpBreakdown.filter(stat => stat.stat !== "Saves");

		// Add position-specific goal entries (only for positions with goals > 0)
		Object.entries(goalsByPosition).forEach(([position, data]) => {
			if (data.goals > 0) {
				ftpBreakdown.push({
					stat: `Goals Scored (${position})`,
					value: data.goals,
					points: data.points,
					show: true,
				});
			}
		});

		// Add position-specific clean sheet entries (only for positions with clean sheets > 0)
		Object.entries(cleanSheetsByPosition).forEach(([position, data]) => {
			if (data.cleanSheets > 0) {
				ftpBreakdown.push({
					stat: `Clean Sheets (${position})`,
					value: data.cleanSheets,
					points: data.points,
					show: true,
				});
			}
		});

		// Add Goals Conceded entry (only if totalGoalsConceded > 0)
		if (totalGoalsConceded > 0) {
			ftpBreakdown.push({
				stat: "Goals Conceded",
				value: totalGoalsConceded,
				points: totalGoalsConcededPoints,
				show: true,
			});
		}

		// Add Saves entry (only if totalSaves > 0)
		if (totalSaves > 0) {
			ftpBreakdown.push({
				stat: "Saves",
				value: totalSaves,
				points: totalSavesPoints,
				show: true,
			});
		}

		// Filter out "Penalties Conceded" from the breakdown
		ftpBreakdown = ftpBreakdown.filter(stat => stat.stat !== "Penalties Conceded");
		
		// Ensure MoM entry is present if mom > 0 (double-check after all filtering)
		if (mom > 0) {
			const finalMomIndex = ftpBreakdown.findIndex(stat => stat.stat === "Man of the Match");
			if (finalMomIndex < 0) {
				// MoM entry is missing, add it after Minutes played
				const minutesIndex = ftpBreakdown.findIndex(stat => stat.stat === "Minutes played");
				const insertIndex = minutesIndex >= 0 ? minutesIndex + 1 : 0;
				ftpBreakdown.splice(insertIndex, 0, {
					stat: "Man of the Match",
					value: mom,
					points: mom * 3,
					show: true,
				});
			}
		}
		
		// Define the order of stats to appear in the modal
		const statOrder: { [key: string]: number } = {
			"Minutes played": 1,
			"Man of the Match": 2,
			"Goals Scored (FWD)": 3,
			"Goals Scored (MID)": 4,
			"Goals Scored (DEF)": 5,
			"Goals Scored (GK)": 6,
			"Assists": 7,
			"Clean Sheets (GK)": 8,
			"Clean Sheets (DEF)": 9,
			"Clean Sheets (MID)": 10,
			"Saves": 11,
			"Goals Conceded": 12,
			"Own Goals": 13,
			"Yellow Cards": 14,
			"Red Cards": 15,
			"Penalties Missed": 16,
			"Penalties Saved": 17,
		};

		// Sort the breakdown by the defined order
		ftpBreakdown.sort((a, b) => {
			const orderA = statOrder[a.stat] ?? 999;
			const orderB = statOrder[b.stat] ?? 999;
			return orderA - orderB;
		});
		
		// Calculate total FTP
		const totalFTP = ftpBreakdown.reduce((sum, stat) => sum + stat.points, 0);

		// Query to count IN_WEEKLY_TOTW relationships for the player
		const totwCountQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:IN_WEEKLY_TOTW]->(wt:WeeklyTOTW {graphLabel: $graphLabel})
			RETURN count(r) as totwAppearances
		`;

		const totwCountResult = await neo4jService.runQuery(totwCountQuery, { graphLabel, playerName });
		const totwAppearances = totwCountResult.records.length > 0 
			? Number(totwCountResult.records[0].get("totwAppearances") || 0)
			: 0;

		return NextResponse.json({
			playerName,
			season,
			aggregatedStats: {
				appearances,
				goals,
				assists,
				cleanSheets,
				conceded,
				saves,
				yellowCards,
				redCards,
				ownGoals,
				penaltiesScored,
				penaltiesMissed,
				penaltiesConceded,
				penaltiesSaved,
				mom,
				totalMinutes,
				playerClass,
			},
			ftpBreakdown,
			totalFTP,
			totwAppearances,
		}, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching season player details:", error);
		return NextResponse.json({ error: "Failed to fetch season player details" }, { status: 500, headers: corsHeaders });
	}
}
