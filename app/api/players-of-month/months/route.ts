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

		if (!season) {
			return NextResponse.json({ error: "Season parameter is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Fetch PlayersOfTheMonth nodes for the season and extract month from date
		const monthsQuery = `
			MATCH (pm:PlayersOfTheMonth {graphLabel: $graphLabel, season: $season})
			WHERE pm.date IS NOT NULL
			RETURN DISTINCT pm.date as date
			ORDER BY pm.date ASC
		`;

		const monthsResult = await neo4jService.runQuery(monthsQuery, { graphLabel, season });

		// Extract month names from dates and create unique list
		const monthMap = new Map<string, { monthName: string; date: string }>();
		
		monthsResult.records.forEach((record) => {
			const dateValue = record.get("date");
			if (!dateValue) return;

			let dateStr = String(dateValue);
			let date: Date;

			// Handle different date formats
			if (dateStr.includes("T")) {
				date = new Date(dateStr);
			} else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
				date = new Date(dateStr + "T00:00:00");
			} else {
				date = new Date(dateStr);
			}

			if (isNaN(date.getTime())) return;

			const monthIndex = date.getMonth();
			const monthName = monthNames[monthIndex];
			const year = date.getFullYear();
			const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

			// Store the earliest date for each month
			if (!monthMap.has(monthKey) || date < new Date(monthMap.get(monthKey)!.date)) {
				monthMap.set(monthKey, { monthName, date: dateStr });
			}
		});

		// Convert to array and sort chronologically, then deduplicate month names
		const monthEntries = Array.from(monthMap.values())
			.sort((a, b) => a.date.localeCompare(b.date));
		
		// Deduplicate month names, keeping the most recent occurrence
		const seenMonths = new Set<string>();
		const months: string[] = [];
		
		// Iterate in reverse to keep the most recent year for each month
		for (let i = monthEntries.length - 1; i >= 0; i--) {
			const monthName = monthEntries[i].monthName;
			if (!seenMonths.has(monthName)) {
				seenMonths.add(monthName);
				months.unshift(monthName); // Add to beginning to maintain chronological order
			}
		}

		return NextResponse.json({ months }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching months:", error);
		return NextResponse.json({ error: "Failed to fetch months" }, { status: 500, headers: corsHeaders });
	}
}

