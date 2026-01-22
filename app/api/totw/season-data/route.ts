import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { Record } from "neo4j-driver";
import { WeeklyTOTW } from "@/types";

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

			// Calculate FTP score for the player
			// For "All Time", sum all MatchDetail fantasyPoints across all seasons
			// For specific season, sum all MatchDetail fantasyPoints for that season
			const ftpQuery = season === "All Time"
				? `
					MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
					MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
					RETURN sum(COALESCE(md.fantasyPoints, 0)) as totalFtpScore
				`
				: `
					MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
					MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel, season: $season})
					RETURN sum(COALESCE(md.fantasyPoints, 0)) as totalFtpScore
				`;

			const ftpParams = season === "All Time"
				? { graphLabel, playerName }
				: { graphLabel, playerName, season };

			const ftpResult = await neo4jService.runQuery(ftpQuery, ftpParams);

			let ftpScore = 0;
			if (ftpResult.records.length > 0) {
				const ftpValue = ftpResult.records[0].get("totalFtpScore");
				if (ftpValue !== null && ftpValue !== undefined) {
					ftpScore = typeof ftpValue.toNumber === 'function' 
						? ftpValue.toNumber() 
						: Number(ftpValue);
				}
			}

			players.push({
				playerName: String(playerName),
				ftpScore: Math.round(ftpScore),
				position: position,
			});
		}

		console.log(`[API] SeasonTOTW players with FTP scores:`, players.map((p) => `${p.playerName}: ${p.ftpScore}`));

		return NextResponse.json({ totwData, players }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching season data:", error);
		return NextResponse.json({ error: "Failed to fetch season data" }, { status: 500, headers: corsHeaders });
	}
}
