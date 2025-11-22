import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { buildFilterConditions } from "../player-data/route";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

interface MatchDetail {
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
	seasonWeek?: string;
	seasonMonth?: string;
	season?: string;
	week?: number | string;
	month?: string;
	date?: string;
	team?: string;
	opposition?: string;
	result?: string;
	matchSummary?: string;
}

interface FTPBreakdown {
	stat: string;
	value: number | string;
	points: number;
	show: boolean;
}

// Calculate FTP breakdown for a single match
function calculateFTPBreakdown(match: MatchDetail): FTPBreakdown[] {
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
	const saves = match.saves || 0;
	breakdown.push({
		stat: "Saves",
		value: saves,
		points: Math.floor(saves * 0.34),
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

// Helper to convert Neo4j values to numbers
function toNumber(val: any): number {
	if (val === null || val === undefined) return 0;
	if (typeof val === "number") {
		if (isNaN(val)) return 0;
		return val;
	}
	if (typeof val === "object") {
		if ("toNumber" in val && typeof val.toNumber === "function") {
			return val.toNumber();
		}
		if ("low" in val && "high" in val) {
			const low = val.low || 0;
			const high = val.high || 0;
			return low + high * 4294967296;
		}
		if ("toString" in val) {
			const num = Number(val.toString());
			return isNaN(num) ? 0 : num;
		}
	}
	const num = Number(val);
	return isNaN(num) ? 0 : num;
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { playerName, filters } = body;

		if (!playerName || typeof playerName !== "string" || playerName.trim() === "") {
			return NextResponse.json({ error: "Valid player name is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const params: any = {
			graphLabel,
			playerName,
		};

		// Build base query to fetch all match details
		let query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			OPTIONAL MATCH (f:Fixture {graphLabel: $graphLabel})-[r:HAS_MATCH_DETAILS]->(md)
		`;

		// Build filter conditions
		const conditions = buildFilterConditions(filters || null, params);
		if (conditions.length > 0) {
			query += ` WHERE ${conditions.join(" AND ")}`;
		}

		query += `
			RETURN md, 
				f.fullResult as matchSummary, 
				f.opposition as opposition, 
				f.result as result,
				md.seasonWeek as seasonWeek,
				md.seasonMonth as seasonMonth,
				md.season as season,
				md.week as week,
				md.month as month,
				md.date as date,
				md.team as team
			ORDER BY md.date ASC
		`;

		const result = await neo4jService.runQuery(query, params);

		if (result.records.length === 0) {
			return NextResponse.json(
				{
					totalFantasyPoints: 0,
					breakdown: {},
					highestScoringWeek: null,
					highestScoringMonth: null,
					matches: [],
				},
				{ headers: corsHeaders }
			);
		}

		// Process matches
		const matches: MatchDetail[] = result.records.map((record) => {
			const md = record.get("md");
			const properties = md.properties;
			return {
				class: properties.class,
				min: toNumber(properties.min || properties.minutes || 0),
				mom: properties.mom === true || properties.mom === 1,
				goals: toNumber(properties.goals),
				assists: toNumber(properties.assists),
				conceded: toNumber(properties.conceded),
				cleanSheets: toNumber(properties.cleanSheets),
				yellowCards: toNumber(properties.yellowCards),
				redCards: toNumber(properties.redCards),
				saves: toNumber(properties.saves),
				ownGoals: toNumber(properties.ownGoals),
				penaltiesScored: toNumber(properties.penaltiesScored),
				penaltiesMissed: toNumber(properties.penaltiesMissed),
				penaltiesConceded: toNumber(properties.penaltiesConceded),
				penaltiesSaved: toNumber(properties.penaltiesSaved),
				seasonWeek: properties.seasonWeek || null,
				seasonMonth: properties.seasonMonth || null,
				season: properties.season || null,
				week: properties.week || null,
				month: properties.month || null,
				date: properties.date || null,
				team: properties.team || null,
				opposition: record.get("opposition") || null,
				result: record.get("result") || null,
				matchSummary: record.get("matchSummary") || null,
			};
		});

		// Calculate breakdown for all matches and aggregate
		const breakdownTotals: Record<string, number> = {};
		const breakdownValues: Record<string, number> = {};
		let totalFantasyPoints = 0;

		// Group by week and month
		const weekGroups: Record<string, { matches: MatchDetail[]; totalPoints: number }> = {};
		const monthGroups: Record<string, { matches: MatchDetail[]; totalPoints: number }> = {};

		matches.forEach((match) => {
			const matchBreakdown = calculateFTPBreakdown(match);
			const matchTotal = matchBreakdown.reduce((sum, stat) => sum + stat.points, 0);
			totalFantasyPoints += matchTotal;

			// Aggregate breakdown totals and values
			matchBreakdown.forEach((stat) => {
				if (stat.show) {
					breakdownTotals[stat.stat] = (breakdownTotals[stat.stat] || 0) + stat.points;
					// For stat values, sum the numeric value (not points)
					// Convert value to number if it's a string
					let statValue = 0;
					if (typeof stat.value === "number") {
						statValue = stat.value;
					} else if (typeof stat.value === "string") {
						statValue = parseFloat(stat.value) || 0;
					}
					breakdownValues[stat.stat] = (breakdownValues[stat.stat] || 0) + statValue;
				}
			});

			// Group by week
			if (match.seasonWeek) {
				if (!weekGroups[match.seasonWeek]) {
					weekGroups[match.seasonWeek] = { matches: [], totalPoints: 0 };
				}
				weekGroups[match.seasonWeek].matches.push(match);
				weekGroups[match.seasonWeek].totalPoints += matchTotal;
			}

			// Group by month
			if (match.seasonMonth) {
				if (!monthGroups[match.seasonMonth]) {
					monthGroups[match.seasonMonth] = { matches: [], totalPoints: 0 };
				}
				monthGroups[match.seasonMonth].matches.push(match);
				monthGroups[match.seasonMonth].totalPoints += matchTotal;
			}
		});

		// Find highest scoring week
		let highestScoringWeek: {
			seasonWeek: string;
			season: string;
			week: number | string;
			weekAdjusted: string;
			dateLookup: string;
			date: string | null;
			totalPoints: number;
			matches: MatchDetail[];
		} | null = null;

		// Process week groups to find highest scoring week
		for (const [seasonWeek, data] of Object.entries(weekGroups)) {
			if (!highestScoringWeek || data.totalPoints > highestScoringWeek.totalPoints) {
				const firstMatch = data.matches[0];
				// Extract week number from seasonWeek (format: "season-week")
				const weekMatch = seasonWeek.match(/-(\d+)$/);
				const weekNumber = weekMatch ? weekMatch[1] : (firstMatch.week || "");
				const season = firstMatch.season || "";
				
				// Try to get dateLookup from WeeklyTOTW
				let dateLookup = "";
				let weekAdjusted = weekNumber.toString();
				try {
					const weekQuery = `
						MATCH (wt:WeeklyTOTW {graphLabel: $graphLabel, season: $season})
						WHERE (wt.week = $weekNumber OR wt.week = $weekString)
						RETURN COALESCE(wt.dateLookup, '') as dateLookup,
						       COALESCE(wt.weekAdjusted, toString(wt.week)) as weekAdjusted
						LIMIT 1
					`;
					const weekNumberNum = parseInt(weekNumber.toString(), 10);
					const weekString = weekNumber.toString();
					const weekResult = await neo4jService.runQuery(weekQuery, { 
						graphLabel, 
						season, 
						weekNumber: weekNumberNum, 
						weekString 
					});
					if (weekResult.records.length > 0) {
						dateLookup = String(weekResult.records[0].get("dateLookup") || "");
						weekAdjusted = String(weekResult.records[0].get("weekAdjusted") || weekNumber.toString());
					}
				} catch (error) {
					console.error("Error fetching week dateLookup:", error);
				}
				
				// Fallback to formatting first match date if dateLookup not available
				let formattedDate = "";
				if (!dateLookup && firstMatch.date) {
					try {
						const dateStr = String(firstMatch.date);
						let date: Date;
						if (dateStr.includes("T")) {
							date = new Date(dateStr);
						} else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
							date = new Date(dateStr + "T00:00:00");
						} else {
							date = new Date(dateStr);
						}
						if (!isNaN(date.getTime())) {
							const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
							const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
							const dayName = days[date.getDay()];
							const day = date.getDate();
							const monthName = months[date.getMonth()];
							const year = date.getFullYear();
							formattedDate = `${dayName}, ${day} ${monthName} ${year}`;
						}
					} catch (error) {
						console.error("Error formatting date:", error);
					}
				}
				
				highestScoringWeek = {
					seasonWeek,
					season,
					week: weekNumber,
					weekAdjusted,
					dateLookup: dateLookup || formattedDate,
					date: firstMatch.date || null,
					totalPoints: data.totalPoints,
					matches: data.matches,
				};
			}
		}

		// Find highest scoring month
		let highestScoringMonth: {
			seasonMonth: string;
			season: string;
			month: string;
			year: number | null;
			totalPoints: number;
			matches: MatchDetail[];
		} | null = null;

		Object.entries(monthGroups).forEach(([seasonMonth, data]) => {
			if (!highestScoringMonth || data.totalPoints > highestScoringMonth.totalPoints) {
				const firstMatch = data.matches[0];
				// Extract month name from seasonMonth (format: "season-month")
				const monthMatch = seasonMonth.match(/-(.+)$/);
				let monthName = monthMatch ? monthMatch[1] : (firstMatch.month || "");
				
				// Get year from first match date
				let year: number | null = null;
				if (firstMatch.date) {
					try {
						const dateStr = String(firstMatch.date);
						let date: Date;
						if (dateStr.includes("T")) {
							date = new Date(dateStr);
						} else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
							date = new Date(dateStr + "T00:00:00");
						} else {
							date = new Date(dateStr);
						}
						if (!isNaN(date.getTime())) {
							year = date.getFullYear();
							// If month name is not available, extract from date
							if (!monthName) {
								const monthNames = ["January", "February", "March", "April", "May", "June", 
									"July", "August", "September", "October", "November", "December"];
								monthName = monthNames[date.getMonth()];
							}
						}
					} catch (error) {
						console.error("Error extracting month/year from date:", error);
					}
				}
				
				highestScoringMonth = {
					seasonMonth,
					season: firstMatch.season || "",
					month: monthName,
					year,
					totalPoints: data.totalPoints,
					matches: data.matches,
				};
			}
		});

		// Prepare highest scoring week response
		const highestScoringWeekResponse = highestScoringWeek
			? {
					season: highestScoringWeek.season,
					week: highestScoringWeek.week,
					weekAdjusted: highestScoringWeek.weekAdjusted,
					dateLookup: highestScoringWeek.dateLookup,
					totalPoints: Math.round(highestScoringWeek.totalPoints),
					matches: highestScoringWeek.matches.map((m: MatchDetail) => ({
						team: m.team,
						opposition: m.opposition,
						result: m.result,
						matchSummary: m.matchSummary,
						date: m.date,
						min: m.min || 0,
						goals: (m.goals || 0) + (m.penaltiesScored || 0),
						assists: m.assists || 0,
					})),
			  }
			: null;

		// Prepare highest scoring month response
		let highestScoringMonthResponse: {
			season: string;
			month: string;
			year: number | null;
			totalPoints: number;
			matches: Array<{
				team: string | null;
				opposition: string | null;
				result: string | null;
				matchSummary: string | null;
				date: string | null;
				min: number;
				goals: number;
				assists: number;
			}>;
		} | null = null;
		
		if (highestScoringMonth !== null) {
			const month = highestScoringMonth as {
				seasonMonth: string;
				season: string;
				month: string;
				year: number | null;
				totalPoints: number;
				matches: MatchDetail[];
			};
			highestScoringMonthResponse = {
				season: month.season,
				month: month.month,
				year: month.year,
				totalPoints: Math.round(month.totalPoints),
				matches: month.matches.map((m: MatchDetail) => ({
					team: m.team ?? null,
					opposition: m.opposition ?? null,
					result: m.result ?? null,
					matchSummary: m.matchSummary ?? null,
					date: m.date ?? null,
					min: m.min || 0,
					goals: (m.goals || 0) + (m.penaltiesScored || 0),
					assists: m.assists || 0,
				})),
			};
		}

		return NextResponse.json(
			{
				totalFantasyPoints: Math.round(totalFantasyPoints),
				breakdown: breakdownTotals,
				breakdownValues: breakdownValues,
				highestScoringWeek: highestScoringWeekResponse,
				highestScoringMonth: highestScoringMonthResponse,
			},
			{ headers: corsHeaders }
		);
	} catch (error) {
		console.error("Error fetching fantasy breakdown:", error);
		return NextResponse.json({ error: "Failed to fetch fantasy breakdown" }, { status: 500, headers: corsHeaders });
	}
}

