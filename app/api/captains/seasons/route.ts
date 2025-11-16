import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";

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
		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Fetch all CaptainsAndAwards nodes
		const query = `
			MATCH (ca:CaptainsAndAwards {graphLabel: $graphLabel})
			RETURN ca
		`;

		const result = await neo4jService.runQuery(query, { graphLabel });

		// Extract unique seasons from node properties
		const seasonSet = new Set<string>();
		const seasonPattern = /^season(\d{4})(\d{2})$/;

		result.records.forEach((record) => {
			const node = record.get("ca");
			const properties = node.properties;

			// Check all properties for season pattern
			Object.keys(properties).forEach((key) => {
				const match = key.match(seasonPattern);
				if (match) {
					const year1 = match[1];
					const year2 = match[2];
					// Convert season201920 to "2019/20"
					const season = `${year1}/${year2}`;
					seasonSet.add(season);
				}
			});
		});

		// Convert to array and sort (newest first)
		const seasons = Array.from(seasonSet).sort((a, b) => {
			const aYear = parseInt(a.split("/")[0]);
			const bYear = parseInt(b.split("/")[0]);
			return bYear - aYear;
		});

		return NextResponse.json({ seasons }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching captain seasons:", error);
		return NextResponse.json({ error: "Failed to fetch seasons" }, { status: 500, headers: corsHeaders });
	}
}

