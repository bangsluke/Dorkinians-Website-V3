import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { buildFilterConditions } from "@/app/api/player-data/route";

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

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { playerName, filters } = body;

		if (!playerName) {
			return NextResponse.json({ error: "Player name is required" }, { status: 400, headers: corsHeaders });
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

		// Base query - match player and join to MatchDetail and Fixture
		let query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		`;

		// Build filter conditions (excluding date filters since we're grouping by month)
		const filterConditions = filters ? buildFilterConditions(filters, params) : [];
		const conditionsWithoutDate = filterConditions.filter(cond => 
			!cond.includes("f.date") && 
			!cond.includes("md.date") && 
			!cond.includes("beforeDate") && 
			!cond.includes("afterDate") && 
			!cond.includes("startDate") && 
			!cond.includes("endDate")
		);
		
		// Combine all WHERE conditions
		const allConditions = [...conditionsWithoutDate, "md.date IS NOT NULL"];
		if (allConditions.length > 0) {
			query += ` WHERE ${allConditions.join(" AND ")}`;
		}

		// Group by month and aggregate stats
		query += `
			WITH md, f,
			     CASE 
			       WHEN toString(md.date) CONTAINS 'T' THEN substring(toString(md.date), 0, size(toString(md.date)) - size(split(toString(md.date), 'T')[1]) - 1)
			       ELSE toString(md.date)
			     END as dateOnly
			WITH md, f, dateOnly,
			     CASE 
			       WHEN dateOnly CONTAINS '-' THEN split(dateOnly, '-')[1]
			       WHEN dateOnly CONTAINS '/' THEN split(dateOnly, '/')[1]
			       ELSE ''
			     END as monthNum
			WHERE monthNum IS NOT NULL AND monthNum <> ''
			WITH md, f, monthNum,
			     CASE 
			       WHEN monthNum = '01' THEN 'January'
			       WHEN monthNum = '02' THEN 'February'
			       WHEN monthNum = '03' THEN 'March'
			       WHEN monthNum = '04' THEN 'April'
			       WHEN monthNum = '05' THEN 'May'
			       WHEN monthNum = '06' THEN 'June'
			       WHEN monthNum = '07' THEN 'July'
			       WHEN monthNum = '08' THEN 'August'
			       WHEN monthNum = '09' THEN 'September'
			       WHEN monthNum = '10' THEN 'October'
			       WHEN monthNum = '11' THEN 'November'
			       WHEN monthNum = '12' THEN 'December'
			       ELSE 'Unknown'
			     END as monthName
			WHERE monthName <> 'Unknown'
			WITH monthName,
				count(md) as appearances,
				sum(coalesce(md.minutes, 0)) as minutes,
				sum(coalesce(md.mom, 0)) as mom,
				sum(coalesce(md.goals, 0)) as goals,
				sum(coalesce(md.assists, 0)) as assists,
				sum(coalesce(md.yellowCards, 0)) as yellowCards,
				sum(coalesce(md.redCards, 0)) as redCards,
				sum(coalesce(md.saves, 0)) as saves,
				sum(coalesce(md.cleanSheets, 0)) as cleanSheets,
				sum(coalesce(md.conceded, 0)) as conceded,
				sum(coalesce(md.ownGoals, 0)) as ownGoals,
				sum(coalesce(md.penaltiesScored, 0)) as penaltiesScored,
				sum(coalesce(md.penaltiesMissed, 0)) as penaltiesMissed,
				sum(coalesce(md.penaltiesConceded, 0)) as penaltiesConceded,
				sum(coalesce(md.penaltiesSaved, 0)) as penaltiesSaved,
				sum(coalesce(md.fantasyPoints, 0)) as fantasyPoints,
				sum(coalesce(md.distance, 0)) as distance
			RETURN monthName,
				coalesce(appearances, 0) as appearances,
				coalesce(minutes, 0) as minutes,
				coalesce(mom, 0) as mom,
				coalesce(goals, 0) as goals,
				coalesce(assists, 0) as assists,
				coalesce(yellowCards, 0) as yellowCards,
				coalesce(redCards, 0) as redCards,
				coalesce(saves, 0) as saves,
				coalesce(cleanSheets, 0) as cleanSheets,
				coalesce(conceded, 0) as conceded,
				coalesce(ownGoals, 0) as ownGoals,
				coalesce(penaltiesScored, 0) as penaltiesScored,
				coalesce(penaltiesMissed, 0) as penaltiesMissed,
				coalesce(penaltiesConceded, 0) as penaltiesConceded,
				coalesce(penaltiesSaved, 0) as penaltiesSaved,
				coalesce(fantasyPoints, 0) as fantasyPoints,
				coalesce(distance, 0) as distance
			ORDER BY 
				CASE monthName
					WHEN 'January' THEN 1
					WHEN 'February' THEN 2
					WHEN 'March' THEN 3
					WHEN 'April' THEN 4
					WHEN 'May' THEN 5
					WHEN 'June' THEN 6
					WHEN 'July' THEN 7
					WHEN 'August' THEN 8
					WHEN 'September' THEN 9
					WHEN 'October' THEN 10
					WHEN 'November' THEN 11
					WHEN 'December' THEN 12
					ELSE 13
				END ASC
		`;

		const result = await neo4jService.runQuery(query, params);

		// Helper function to convert Neo4j Integer/Float to JavaScript number
		const toNumber = (value: any): number => {
			if (value === null || value === undefined) return 0;
			if (typeof value === "number") {
				if (isNaN(value)) return 0;
				return value;
			}
			if (typeof value === "object") {
				if ("toNumber" in value && typeof value.toNumber === "function") {
					return value.toNumber();
				}
				if ("low" in value && "high" in value) {
					const low = value.low || 0;
					const high = value.high || 0;
					return low + high * 4294967296;
				}
				if ("toString" in value) {
					const num = Number(value.toString());
					return isNaN(num) ? 0 : num;
				}
			}
			const num = Number(value);
			return isNaN(num) ? 0 : num;
		};

		const monthlyStats = result.records.map((record) => ({
			month: record.get("monthName"),
			appearances: toNumber(record.get("appearances")),
			minutes: toNumber(record.get("minutes")),
			mom: toNumber(record.get("mom")),
			goals: toNumber(record.get("goals")),
			assists: toNumber(record.get("assists")),
			fantasyPoints: toNumber(record.get("fantasyPoints")),
			yellowCards: toNumber(record.get("yellowCards")),
			redCards: toNumber(record.get("redCards")),
			saves: toNumber(record.get("saves")),
			cleanSheets: toNumber(record.get("cleanSheets")),
			conceded: toNumber(record.get("conceded")),
			ownGoals: toNumber(record.get("ownGoals")),
			penaltiesScored: toNumber(record.get("penaltiesScored")),
			penaltiesMissed: toNumber(record.get("penaltiesMissed")),
			penaltiesConceded: toNumber(record.get("penaltiesConceded")),
			penaltiesSaved: toNumber(record.get("penaltiesSaved")),
			distance: toNumber(record.get("distance")),
		}));

		// Ensure all months are present (fill with zeros if missing)
		const allMonths = monthNames.map(month => {
			const existing = monthlyStats.find(stat => stat.month === month);
			if (existing) return existing;
			return {
				month,
				appearances: 0,
				minutes: 0,
				mom: 0,
				goals: 0,
				assists: 0,
				fantasyPoints: 0,
				yellowCards: 0,
				redCards: 0,
				saves: 0,
				cleanSheets: 0,
				conceded: 0,
				ownGoals: 0,
				penaltiesScored: 0,
				penaltiesMissed: 0,
				penaltiesConceded: 0,
				penaltiesSaved: 0,
				distance: 0,
			};
		});

		return NextResponse.json({ monthlyStats: allMonths }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching player monthly stats:", error);
		return NextResponse.json({ error: "Failed to fetch player monthly stats" }, { status: 500, headers: corsHeaders });
	}
}
