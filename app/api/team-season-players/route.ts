import { NextRequest, NextResponse } from 'next/server';
import { neo4jService } from '@/lib/neo4j';
import { normalizeSeasonFormat } from '@/lib/services/leagueTableService';
import { TeamMappingUtils } from '@/lib/services/chatbotUtils/teamMappingUtils';

// Normalize season format (2019-20 <-> 2019/20)
function normalizeSeason(season: string): string {
	return season.replace("-", "/");
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

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const team = searchParams.get('team');
		const season = searchParams.get('season');

		if (!team || !season) {
			return NextResponse.json(
				{ error: 'Team and season parameters are required' },
				{ status: 400, headers: corsHeaders },
			);
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json(
				{ error: 'Database connection failed' },
				{ status: 500, headers: corsHeaders },
			);
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Normalize season format - Neo4j stores seasons in slash format (e.g., "2023/24")
		const normalizedSeason = normalizeSeasonFormat(season, 'slash');

		// Map team key (e.g., "1s", "2s") to database format (e.g., "1st XI", "2nd XI")
		const mappedTeam = TeamMappingUtils.mapTeamName(team);

		// Query to get all players who made appearances for the specified team in the specified season
		// Only count League games (not cup games)
		// Count appearances per player and order by appearance count descending
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE md.team = $team AND f.season = $season AND f.compType = 'League'
			WITH p.playerName as playerName, count(md) as appearances
			RETURN playerName, appearances
			ORDER BY appearances DESC, playerName ASC
		`;

		const params = {
			graphLabel,
			team: mappedTeam,
			season: normalizedSeason,
		};

		const result = await neo4jService.runQuery(query, params);

		// Extract players with appearance counts from results
		const players: { playerName: string; appearances: number }[] = [];
		for (const record of result.records) {
			const playerName = record.get('playerName');
			const appearances = record.get('appearances');
			if (playerName) {
				const appearancesNum = typeof appearances === 'number'
					? appearances
					: appearances?.toNumber ? appearances.toNumber() : Number(appearances) || 0;
				players.push({
					playerName: String(playerName),
					appearances: appearancesNum,
				});
			}
		}

		// Fetch captains for this team and season (use normalized season)
		const captains = await getCaptainsForTeam(team, normalizedSeason);

		return NextResponse.json({ players, captains }, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching team season players:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch team season players' },
			{ status: 500, headers: corsHeaders },
		);
	}
}

