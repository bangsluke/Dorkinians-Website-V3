import { NextRequest, NextResponse } from "next/server";
import { getAvailableSeasons, getSeasonDataFromJSON, getCurrentSeasonDataFromNeo4j, normalizeSeasonFormat, type LeagueTableEntry, type TeamLeagueData } from "@/lib/services/leagueTableService";
import { neo4jService } from "@/lib/neo4j";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET() {
	return NextResponse.json({ 
		message: "Route is working", 
		endpoint: "/api/team-best-season-finish",
		timestamp: new Date().toISOString()
	}, { headers: corsHeaders });
}

// Normalize season format (2019-20 <-> 2019/20)
function normalizeSeason(season: string): string {
	return season.replace("-", "/");
}

// Convert season format for comparison (2019/20 -> 2019-20)
function normalizeSeasonForFile(season: string): string {
	return season.replace("/", "-");
}

// Convert team name to team key (e.g., "8th XI" -> "8s", "1st XI" -> "1s")
function normalizeTeamNameToKey(teamName: string): string {
	if (!teamName) return teamName;
	
	// Convert to lowercase and trim
	const normalized = teamName.toLowerCase().trim();
	
	// Use the same mapping as in leagueTableService.ts
	const mapping: { [key: string]: string } = {
		'1st xi': '1s',
		'2nd xi': '2s',
		'3rd xi': '3s',
		'4th xi': '4s',
		'5th xi': '5s',
		'6th xi': '6s',
		'7th xi': '7s',
		'8th xi': '8s',
		'1st': '1s',
		'2nd': '2s',
		'3rd': '3s',
		'4th': '4s',
		'5th': '5s',
		'6th': '6s',
		'7th': '7s',
		'8th': '8s',
	};
	
	// Check mapping first
	if (mapping[normalized]) {
		return mapping[normalized];
	}
	
	// Handle formats like "8s", "1s" (already in correct format)
	if (/^\d+s$/.test(normalized)) {
		return normalized;
	}
	
	// Handle numeric patterns like "8", "1"
	const numericMatch = normalized.match(/^(\d+)$/);
	if (numericMatch) {
		return `${numericMatch[1]}s`;
	}
	
	// If no pattern matches, return as-is (might already be in correct format)
	return teamName;
}

// Get captains for a specific team and season
async function getCaptainsForTeam(teamKey: string, season: string): Promise<string[]> {
	try {
		// Convert team key to captain item name (e.g., "1s" -> "1st XI Captain(s)")
		const teamToCaptainItem: { [key: string]: string } = {
			"1s": "1st XI Captain(s)",
			"2s": "2nd XI Captain(s)",
			"3s": "3rd XI Captain(s)",
			"4s": "4th XI Captain(s)",
			"5s": "5th XI Captain(s)",
			"6s": "6th XI Captain(s)",
			"7s": "7th XI Captain(s)",
			"8s": "8th XI Captain(s)",
		};

		const captainItem = teamToCaptainItem[teamKey];
		if (!captainItem) {
			return [];
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return [];
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Convert season format: "2019/20" → "season201920"
		const normalizedSeason = normalizeSeason(season);
		const seasonPropName = `season${normalizedSeason.replace(/\//g, "")}`;

		// Fetch captain data from Neo4j
		const query = `
			MATCH (ca:CaptainsAndAwards {graphLabel: $graphLabel})
			WHERE ca.itemName = $captainItem
			RETURN ca
		`;

		const result = await neo4jService.runQuery(query, {
			graphLabel,
			captainItem,
		});

		if (result.records.length === 0) {
			return [];
		}

		const node = result.records[0].get("ca");
		const properties = node.properties;
		const captain = properties[seasonPropName];

		if (!captain) {
			return [];
		}

		const captainStr = String(captain).trim();
		const lowerValue = captainStr.toLowerCase();
		
		// Filter out placeholder values
		if (captainStr === "" || ['n/a', 'na', 'tbc', 'tbd', 'pending'].includes(lowerValue)) {
			return [];
		}

		// Parse captain string to extract individual names
		return captainStr
			.split(/[,&]/)
			.map((name) => name.trim())
			.filter((name) => name.length > 0);
	} catch (error) {
		console.error("Error fetching captains:", error);
		return [];
	}
}

// Get league table data for a specific team and season
async function getTeamLeagueDataForSeason(teamKey: string, season: string): Promise<{ season: string; division: string; table: LeagueTableEntry[] } | null> {
	try {
		// Normalize season format for file lookup (hyphen format for JSON filenames)
		const normalizedSeasonForFile = normalizeSeasonFormat(season, 'hyphen');
		// Normalize season format for return (slash format for consistency)
		const normalizedSeasonForReturn = normalizeSeasonFormat(season, 'slash');

		// Try JSON files first (for past seasons)
		const seasonData = await getSeasonDataFromJSON(normalizedSeasonForFile);
		if (seasonData) {
			const teamData = seasonData.teams[teamKey];
			if (teamData && teamData.table && teamData.table.length > 0) {
				return {
					season: normalizedSeasonForReturn,
					division: teamData.division || "",
					table: teamData.table,
				};
			}
		}

		// Try Neo4j for current season
		const currentSeasonData = await getCurrentSeasonDataFromNeo4j();
		if (currentSeasonData) {
			// Normalize both seasons to slash format for comparison
			const normalizedCurrentSeason = normalizeSeasonFormat(currentSeasonData.season, 'slash');
			const normalizedRequestSeason = normalizeSeasonFormat(season, 'slash');
			
			if (normalizedCurrentSeason === normalizedRequestSeason) {
				const teamData = currentSeasonData.teams[teamKey];
				if (teamData && teamData.table && teamData.table.length > 0) {
					return {
						season: normalizedSeasonForReturn,
						division: teamData.division || "",
						table: teamData.table,
					};
				}
			}
		}

		return null;
	} catch (error) {
		console.error(`Error fetching team league data for ${teamKey} in ${season}:`, error);
		return null;
	}
}

// Find best season finish for a team (excluding current season)
async function findBestSeasonFinish(teamKey: string): Promise<{ season: string; division: string; table: LeagueTableEntry[]; teamCount: number } | null> {
	try {
		// Get current season from Neo4j (most recent season in database)
		const currentSeasonData = await getCurrentSeasonDataFromNeo4j();
		const currentSeason = currentSeasonData ? normalizeSeasonFormat(currentSeasonData.season, 'slash') : null;
		
		const allSeasons = await getAvailableSeasons();
		
		// Get all historical positions for this team
		const positions: Array<{
			season: string;
			position: number;
			division: string;
			table: LeagueTableEntry[];
			teamCount: number;
		}> = [];

		for (const seasonFile of allSeasons) {
			// Normalize season formats for comparison (both to slash format)
			const normalizedFileSeason = normalizeSeasonFormat(seasonFile, 'slash');
			const normalizedCurrentSeason = currentSeason ? normalizeSeasonFormat(currentSeason, 'slash') : null;

			// Skip current season
			if (normalizedCurrentSeason && normalizedFileSeason === normalizedCurrentSeason) {
				continue;
			}

			const leagueData = await getTeamLeagueDataForSeason(teamKey, seasonFile);
			if (!leagueData || !leagueData.table || leagueData.table.length === 0) {
				continue;
			}

			// Find Dorkinians entry
			const dorkiniansEntry = leagueData.table.find((entry) =>
				entry.team.toLowerCase().includes("dorkinians")
			);

			if (dorkiniansEntry) {
				positions.push({
					season: normalizedFileSeason,
					position: dorkiniansEntry.position,
					division: leagueData.division,
					table: leagueData.table,
					teamCount: leagueData.table.length,
				});
			}
		}

		if (positions.length === 0) {
			return null;
		}

		// Find best position (lowest number = highest finish)
		// Tiebreaker 1: More teams in league
		// Tiebreaker 2: Earlier season
		const best = positions.reduce((best, current) => {
			if (current.position < best.position) {
				return current;
			} else if (current.position === best.position) {
				// Tiebreaker 1: More teams
				if (current.teamCount > best.teamCount) {
					return current;
				} else if (current.teamCount === best.teamCount) {
					// Tiebreaker 2: Earlier season
					const currentYear = parseInt(current.season.split("/")[0]);
					const bestYear = parseInt(best.season.split("/")[0]);
					if (currentYear < bestYear) {
						return current;
					}
				}
			}
			return best;
		}, positions[0]);

		return {
			season: best.season,
			division: best.division,
			table: best.table,
			teamCount: best.teamCount,
		};
	} catch (error) {
		console.error("Error finding best season finish:", error);
		return null;
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { teamName, season } = body;

		if (!teamName) {
			return NextResponse.json({ error: "Team name is required" }, { status: 400, headers: corsHeaders });
		}

		// Convert team name to team key (e.g., "8th XI" -> "8s", "1st XI" -> "1s")
		const teamKey = normalizeTeamNameToKey(teamName);

		let leagueData: { season: string; division: string; table: LeagueTableEntry[] } | null = null;

		if (season) {
			// Get specific season's data
			leagueData = await getTeamLeagueDataForSeason(teamKey, season);
			if (!leagueData) {
				return NextResponse.json(
					{ error: `No league data found for ${teamName} in ${season}` },
					{ status: 404, headers: corsHeaders }
				);
			}
		} else {
			// Find best season finish
			const bestFinish = await findBestSeasonFinish(teamKey);
			if (!bestFinish) {
				return NextResponse.json(
					{ error: `No historical league data found for ${teamName}` },
					{ status: 404, headers: corsHeaders }
				);
			}
			leagueData = {
				season: bestFinish.season,
				division: bestFinish.division,
				table: bestFinish.table,
			};
		}

		// Get captains for the season
		const captains = await getCaptainsForTeam(teamKey, leagueData.season);

		return NextResponse.json(
			{
				season: leagueData.season,
				division: leagueData.division,
				table: leagueData.table,
				captains,
				teamKey,
			},
			{ headers: corsHeaders }
		);
	} catch (error) {
		console.error("Error in team-best-season-finish API:", error);
		return NextResponse.json(
			{ 
				error: "Failed to fetch best season finish data",
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500, headers: corsHeaders }
		);
	}
}
