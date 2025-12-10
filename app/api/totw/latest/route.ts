import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const toNativeValue = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.map((item) => toNativeValue(item));
	}

	if (value && typeof value === "object" && "toNumber" in value && typeof (value as any).toNumber === "function") {
		try {
			return (value as any).toNumber();
		} catch {
			return Number((value as any).low ?? 0);
		}
	}

	return value;
};

const serializeNode = (node: any) => {
	if (!node?.properties) {
		return null;
	}

	return Object.entries(node.properties).reduce<Record<string, unknown>>((acc, [key, val]) => {
		acc[key] = toNativeValue(val);
		return acc;
	}, {});
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(_request: NextRequest) {
	try {
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json(
				{ error: "Database connection failed" },
				{ status: 500, headers: corsHeaders },
			);
		}

		const params = { graphLabel: neo4jService.getGraphLabel() };

		const weeklyQuery = `
			MATCH (t:TOTW {graphLabel: $graphLabel})
			RETURN t
			ORDER BY t.dateLookup DESC
			LIMIT 1
		`;

		const seasonQuery = `
			MATCH (st:SeasonTOTW {graphLabel: $graphLabel})
			RETURN st
			ORDER BY st.seasonMonthRef DESC
			LIMIT 3
		`;

		const [weeklyResult, seasonResult] = await Promise.all([
			neo4jService.runQuery(weeklyQuery, params),
			neo4jService.runQuery(seasonQuery, params),
		]);

		const weeklyNode = weeklyResult.records[0]?.get("t");
		const seasonalNodes = seasonResult.records.map((record) => record.get("st"));

		return NextResponse.json(
			{
				weekly: serializeNode(weeklyNode),
				recentSeasonal: seasonalNodes.map((node: any) => serializeNode(node)).filter(Boolean),
			},
			{ headers: corsHeaders },
		);
	} catch (error) {
		console.error("Error fetching TOTW data:", error);
		return NextResponse.json(
			{ error: "Failed to load Team of the Week data" },
			{ status: 500, headers: corsHeaders },
		);
	}
}
