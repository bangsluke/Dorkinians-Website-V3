import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { Record } from "neo4j-driver";
import { WeeklyTOTW } from "@/types";
import { calculateFTPBreakdown } from "@/lib/utils/fantasyPoints";

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

		if (!season) {
			return NextResponse.json({ error: "Season parameter is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Query SeasonTOTW node for the specified season
		const totwQuery = `
			MATCH (st:SeasonTOTW {graphLabel: $graphLabel, season: $season})
			RETURN st
			LIMIT 1
		`;

		const totwResult = await neo4jService.runQuery(totwQuery, { graphLabel, season });

		if (totwResult.records.length === 0) {
			console.log(`[API] No SeasonTOTW data found for season: ${season}`);
			return NextResponse.json({ totwData: null, players: [] }, { headers: corsHeaders });
		}

		const stNode = totwResult.records[0].get("st");
		const properties = stNode.properties;

		// Build WeeklyTOTW-compatible object from SeasonTOTW
		// Map SeasonTOTW properties to WeeklyTOTW structure for reuse of existing rendering logic
		const totwData: WeeklyTOTW = {
			season: String(properties.season || ""),
			week: 0, // SeasonTOTW doesn't have week
			seasonWeekNumRef: "",
			dateLookup: "",
			seasonMonthRef: String(properties.seasonMonthRef || ""),
			weekAdjusted: "",
			bestFormation: String(properties.bestFormation || ""),
			totwScore: Number(properties.totwScore || 0),
			playerCount: Number(properties.playerCount || 0),
			starMan: String(properties.starMan || ""),
			starManScore: Number(properties.starManScore || 0),
			playerLookups: String(properties.playerLookups || ""),
			gk1: String(properties.gk1 || ""),
			def1: String(properties.def1 || ""),
			def2: String(properties.def2 || ""),
			def3: String(properties.def3 || ""),
			def4: String(properties.def4 || ""),
			def5: String(properties.def5 || ""),
			mid1: String(properties.mid1 || ""),
			mid2: String(properties.mid2 || ""),
			mid3: String(properties.mid3 || ""),
			mid4: String(properties.mid4 || ""),
			mid5: String(properties.mid5 || ""),
			fwd1: String(properties.fwd1 || ""),
			fwd2: String(properties.fwd2 || ""),
			fwd3: String(properties.fwd3 || ""),
		};

		// Get bestFormation to determine which positions to include
		const bestFormation = totwData.bestFormation || "";
		let numDef = 4;
		let numMid = 4;
		let numFwd = 2;

		if (bestFormation) {
			const formationParts = bestFormation.split("-");
			if (formationParts.length >= 3) {
				numDef = parseInt(formationParts[0], 10) || 4;
				numMid = parseInt(formationParts[1], 10) || 4;
				numFwd = parseInt(formationParts[2], 10) || 2;
			}
		}

		// Build position fields based on bestFormation
		const positionFields: Array<{ field: string; position: string }> = [];
		positionFields.push({ field: "gk1", position: "GK" });
		for (let i = 1; i <= numDef; i++) {
			positionFields.push({ field: `def${i}`, position: "DEF" });
		}
		for (let i = 1; i <= numMid; i++) {
			positionFields.push({ field: `mid${i}`, position: "MID" });
		}
		for (let i = 1; i <= numFwd; i++) {
			positionFields.push({ field: `fwd${i}`, position: "FWD" });
		}

		// Fetch player relationships and calculate FTP scores
		const players: Array<{ playerName: string; ftpScore: number; position: string }> = [];

		for (const { field, position } of positionFields) {
			const playerName = totwData[field as keyof WeeklyTOTW] as string;
			if (!playerName || String(playerName).trim() === "") continue;

			// Calculate FTP score for the player by fetching all matches and calculating on-the-fly
			// This ensures MoM points are included correctly (stored fantasyPoints may be outdated)
			const matchesQuery = season === "All Time"
				? `
					MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
					MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
					RETURN md.minutes as minutes, md.min as min, md.mom as mom, md.goals as goals, 
						md.assists as assists, md.conceded as conceded, md.cleanSheets as cleanSheets,
						md.yellowCards as yellowCards, md.redCards as redCards, md.saves as saves,
						md.ownGoals as ownGoals, md.penaltiesScored as penaltiesScored,
						md.penaltiesMissed as penaltiesMissed, md.penaltiesConceded as penaltiesConceded,
						md.penaltiesSaved as penaltiesSaved, md.class as class
				`
				: `
					MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
					MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel, season: $season})
					RETURN md.minutes as minutes, md.min as min, md.mom as mom, md.goals as goals, 
						md.assists as assists, md.conceded as conceded, md.cleanSheets as cleanSheets,
						md.yellowCards as yellowCards, md.redCards as redCards, md.saves as saves,
						md.ownGoals as ownGoals, md.penaltiesScored as penaltiesScored,
						md.penaltiesMissed as penaltiesMissed, md.penaltiesConceded as penaltiesConceded,
						md.penaltiesSaved as penaltiesSaved, md.class as class
				`;

			const matchesParams = season === "All Time"
				? { graphLabel, playerName }
				: { graphLabel, playerName, season };

			const matchesResult = await neo4jService.runQuery(matchesQuery, matchesParams);

			// Calculate FTP score by summing points from each match
			let ftpScore = 0;
			let totalMoMPoints = 0;
			let momCount = 0;
			let totalMinutesPoints = 0;
			let totalGoalPoints = 0;
			let totalAssistPoints = 0;
			let totalCleanSheetPoints = 0;
			let totalGoalsConcededPoints = 0;
			let totalYellowCardPoints = 0;
			let totalRedCardPoints = 0;
			let totalOwnGoalPoints = 0;
			let totalPenaltiesMissedPoints = 0;
			let totalSavesPoints = 0;
			let totalPenaltiesSavedPoints = 0;
			let totalPenaltiesScoredPoints = 0;
			matchesResult.records.forEach((record: Record) => {
				const rawMom = record.get("mom");
				const matchData = {
					class: String(record.get("class") || ""),
					min: Number(record.get("minutes") || record.get("min") || 0),
					mom: rawMom === 1 || rawMom === true,
					goals: Number(record.get("goals") || 0),
					assists: Number(record.get("assists") || 0),
					conceded: Number(record.get("conceded") || 0),
					cleanSheets: Number(record.get("cleanSheets") || 0),
					yellowCards: Number(record.get("yellowCards") || 0),
					redCards: Number(record.get("redCards") || 0),
					saves: Number(record.get("saves") || 0),
					ownGoals: Number(record.get("ownGoals") || 0),
					penaltiesScored: Number(record.get("penaltiesScored") || 0),
					penaltiesMissed: Number(record.get("penaltiesMissed") || 0),
					penaltiesConceded: Number(record.get("penaltiesConceded") || 0),
					penaltiesSaved: Number(record.get("penaltiesSaved") || 0),
				};

				if (matchData.mom) {
					momCount++;
				}

				const breakdown = calculateFTPBreakdown(matchData);
				const matchPoints = breakdown.reduce((sum, stat) => sum + stat.points, 0);
				const momPoints = breakdown.find(s => s.stat === "Man of the Match")?.points || 0;
				const minutesPoints = breakdown.find(s => s.stat === "Minutes played")?.points || 0;
				const goalPoints = breakdown.find(s => s.stat === "Goals scored")?.points || 0;
				const assistPoints = breakdown.find(s => s.stat === "Assists")?.points || 0;
				const cleanSheetPoints = breakdown.find(s => s.stat === "Clean Sheets")?.points || 0;
				const goalsConcededPoints = breakdown.find(s => s.stat === "Goals Conceded")?.points || 0;
				const yellowCardPoints = breakdown.find(s => s.stat === "Yellow Cards")?.points || 0;
				const redCardPoints = breakdown.find(s => s.stat === "Red Cards")?.points || 0;
				const ownGoalPoints = breakdown.find(s => s.stat === "Own Goals")?.points || 0;
				const penaltiesMissedPoints = breakdown.find(s => s.stat === "Penalties Missed")?.points || 0;
				const penaltiesScoredPoints = breakdown.find(s => s.stat === "Penalties Scored")?.points || 0;
				const savesPoints = breakdown.find(s => s.stat === "Saves")?.points || 0;
				const penaltiesSavedPoints = breakdown.find(s => s.stat === "Penalties Saved")?.points || 0;
				
				totalMoMPoints += momPoints;
				totalMinutesPoints += minutesPoints;
				totalGoalPoints += goalPoints;
				totalAssistPoints += assistPoints;
				totalCleanSheetPoints += cleanSheetPoints;
				totalGoalsConcededPoints += goalsConcededPoints;
				totalYellowCardPoints += yellowCardPoints;
				totalRedCardPoints += redCardPoints;
				totalOwnGoalPoints += ownGoalPoints;
				totalPenaltiesMissedPoints += penaltiesMissedPoints;
				totalPenaltiesScoredPoints += penaltiesScoredPoints;
				totalSavesPoints += savesPoints;
				totalPenaltiesSavedPoints += penaltiesSavedPoints;
				ftpScore += matchPoints;
			});

			players.push({
				playerName: String(playerName),
				ftpScore: Math.round(ftpScore),
				position: position,
			});
		}

		console.log(`[API] SeasonTOTW players with FTP scores:`, players.map((p) => `${p.playerName}: ${p.ftpScore}`));

		// Calculate total TOTW score as sum of all player scores
		const calculatedTotwScore = players.reduce((sum, player) => sum + player.ftpScore, 0);
		totwData.totwScore = calculatedTotwScore;

		// Update starMan and starManScore to be the player with the highest score
		if (players.length > 0) {
			const highestScoringPlayer = players.reduce((highest, current) => 
				current.ftpScore > highest.ftpScore ? current : highest
			);
			totwData.starMan = highestScoringPlayer.playerName;
			totwData.starManScore = highestScoringPlayer.ftpScore;
		}

		// Calculate playerCount by counting distinct players who competed in the season (or all time)
		const playerCountQuery = season === "All Time"
			? `
				MATCH (p:Player {graphLabel: $graphLabel})
				WHERE p.allowOnSite = true
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				RETURN count(DISTINCT p.playerName) as playerCount
			`
			: `
				MATCH (p:Player {graphLabel: $graphLabel})
				WHERE p.allowOnSite = true
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel, season: $season})
				RETURN count(DISTINCT p.playerName) as playerCount
			`;

		const playerCountParams = season === "All Time"
			? { graphLabel }
			: { graphLabel, season };

		const playerCountResult = await neo4jService.runQuery(playerCountQuery, playerCountParams);
		const calculatedPlayerCount = playerCountResult.records.length > 0
			? Number(playerCountResult.records[0].get("playerCount") || 0)
			: 0;

		// Update playerCount with calculated value
		totwData.playerCount = calculatedPlayerCount;

		return NextResponse.json({ totwData, players }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching season data:", error);
		return NextResponse.json({ error: "Failed to fetch season data" }, { status: 500, headers: corsHeaders });
	}
}
