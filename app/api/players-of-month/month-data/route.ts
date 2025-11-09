import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const monthNames = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December"
];

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const season = searchParams.get("season");
		const month = searchParams.get("month");

		if (!season || !month) {
			return NextResponse.json(
				{ error: "Season and month parameters are required" },
				{ status: 400, headers: corsHeaders },
			);
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Find month index
		const monthIndex = monthNames.findIndex((m) => m.toLowerCase() === month.toLowerCase());
		if (monthIndex === -1) {
			return NextResponse.json({ error: "Invalid month name" }, { status: 400, headers: corsHeaders });
		}

		// Fetch PlayersOfTheMonth node matching season and month
		// We need to check if the date's month matches the requested month
		const monthDataQuery = `
			MATCH (pm:PlayersOfTheMonth {graphLabel: $graphLabel, season: $season})
			WHERE pm.date IS NOT NULL
			WITH pm, pm.date as dateStr
			WHERE dateStr CONTAINS '-' OR dateStr CONTAINS '/'
			WITH pm, 
			     CASE 
			       WHEN dateStr CONTAINS 'T' THEN substring(dateStr, 0, size(dateStr) - size(split(dateStr, 'T')[1]) - 1)
			       ELSE dateStr
			     END as dateOnly
			WITH pm, dateOnly,
			     CASE 
			       WHEN dateOnly CONTAINS '-' THEN split(dateOnly, '-')[1]
			       WHEN dateOnly CONTAINS '/' THEN split(dateOnly, '/')[1]
			       ELSE ''
			     END as monthPart
			WHERE monthPart = $monthNum
			RETURN pm
			LIMIT 1
		`;

		// Combine season and month into format "season-month" (e.g., "2025/26-October")
		const seasonMonth = `${season}-${month}`;

		// Helper function to calculate ftpScore from MatchDetail nodes
		const calculateFtpScore = async (playerName: string): Promise<number> => {
			const ftpQuery = `
				MATCH (md:MatchDetail {graphLabel: $graphLabel, playerName: $playerName, seasonMonth: $seasonMonth})
				RETURN sum(COALESCE(md.fantasyPoints, 0)) as totalFtpScore
			`;

			const ftpResult = await neo4jService.runQuery(ftpQuery, {
				graphLabel,
				playerName,
				seasonMonth,
			});

			if (ftpResult.records.length > 0) {
				const totalFtpScore = ftpResult.records[0].get("totalFtpScore");
				return totalFtpScore !== null && totalFtpScore !== undefined
					? Number(totalFtpScore)
					: 0;
			}

			return 0;
		};

		const monthNum = String(monthIndex + 1).padStart(2, "0");
		const result = await neo4jService.runQuery(monthDataQuery, { graphLabel, season, monthNum });

		if (result.records.length === 0) {
			// Try alternative approach: fetch all and filter in JavaScript
			const allMonthsQuery = `
				MATCH (pm:PlayersOfTheMonth {graphLabel: $graphLabel, season: $season})
				WHERE pm.date IS NOT NULL
				RETURN pm
			`;

			const allResult = await neo4jService.runQuery(allMonthsQuery, { graphLabel, season });
			
			// Filter by month in JavaScript
			const matchingRecord = allResult.records.find((record) => {
				const pmNode = record.get("pm");
				const dateValue = pmNode.properties.date;
				if (!dateValue) return false;

				let dateStr = String(dateValue);
				let date: Date;

				if (dateStr.includes("T")) {
					date = new Date(dateStr);
				} else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
					date = new Date(dateStr + "T00:00:00");
				} else {
					date = new Date(dateStr);
				}

				if (isNaN(date.getTime())) return false;
				return date.getMonth() === monthIndex;
			});

			if (!matchingRecord) {
				return NextResponse.json({ players: [] }, { headers: corsHeaders });
			}

			const pmNode = matchingRecord.get("pm");
			const properties = pmNode.properties;

			const players = [];
			for (let i = 1; i <= 5; i++) {
				const playerName = properties[`player${i}Name`];
				if (playerName) {
					const ftpScore = await calculateFtpScore(String(playerName));
					players.push({
						rank: i,
						playerName: String(playerName),
						ftpScore: ftpScore,
					});
				}
			}

			return NextResponse.json({ players }, { headers: corsHeaders });
		}

		const pmNode = result.records[0].get("pm");
		const properties = pmNode.properties;

		const players = [];
		for (let i = 1; i <= 5; i++) {
			const playerName = properties[`player${i}Name`];
			if (playerName) {
				const ftpScore = await calculateFtpScore(String(playerName));
				players.push({
					rank: i,
					playerName: String(playerName),
					ftpScore: ftpScore,
				});
			}
		}

		return NextResponse.json({ players }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching month data:", error);
		return NextResponse.json({ error: "Failed to fetch month data" }, { status: 500, headers: corsHeaders });
	}
}

