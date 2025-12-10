import { NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const defaultStats = {
	players: 0,
	games: 0,
	wins: 0,
	goals: 0,
	competitions: 0,
	cleanSheets: 0,
};

const toNumber = (value: any): number => {
	if (value === null || value === undefined) {
		return 0;
	}
	if (typeof value.toNumber === "function") {
		return value.toNumber();
	}
	return Number(value) || 0;
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET() {
	try {
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json(
				{ error: "Database connection failed" },
				{ status: 500, headers: corsHeaders }
			);
		}

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE coalesce(p.allowOnSite, false) = true
			WITH count(DISTINCT p) as playerCount
			OPTIONAL MATCH (f:Fixture {graphLabel: $graphLabel})
			WITH playerCount,
				 count(f) as gameCount,
				 sum(coalesce(f.dorkiniansGoals, 0)) as goalCount,
				 sum(CASE WHEN toUpper(coalesce(f.result, '')) IN ['W', 'WIN'] THEN 1 ELSE 0 END) as winCount,
				 sum(CASE WHEN coalesce(f.conceded, 0) = 0 THEN 1 ELSE 0 END) as cleanSheetCount,
				 count(DISTINCT CASE WHEN f.competition IS NOT NULL AND trim(f.competition) <> '' THEN f.competition END) as competitionCount
			RETURN playerCount, gameCount, goalCount, winCount, competitionCount, cleanSheetCount
		`;

		const params = { graphLabel: neo4jService.getGraphLabel() };
		const result = await neo4jService.runQuery(query, params);

		if (result.records.length === 0) {
			return NextResponse.json({ stats: defaultStats }, { headers: corsHeaders });
		}

		const record = result.records[0];
		const stats = {
			players: toNumber(record.get("playerCount")),
			games: toNumber(record.get("gameCount")),
			wins: toNumber(record.get("winCount")),
			goals: toNumber(record.get("goalCount")),
			competitions: toNumber(record.get("competitionCount")),
			cleanSheets: toNumber(record.get("cleanSheetCount")),
		};

		return NextResponse.json({ stats }, { headers: corsHeaders });
	} catch (error) {
		console.error("Failed to fetch club stats:", error);
		return NextResponse.json(
			{ error: "Failed to fetch club stats" },
			{ status: 500, headers: corsHeaders }
		);
	}
}
