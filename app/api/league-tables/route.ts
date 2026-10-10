import { NextRequest, NextResponse } from 'next/server';
import {
	getAvailableSeasons,
	getSeasonDataFromJSON,
	getCurrentSeasonDataFromNeo4j,
	getTeamSeasonData,
} from '@/lib/services/leagueTableService';
import { PUBLIC_CACHE_MEDIUM, withNoStore, withPublicCache } from '@/lib/utils/publicCacheHeaders';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

const publicHeaders = withPublicCache(corsHeaders, PUBLIC_CACHE_MEDIUM);

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const season = searchParams.get('season');
		const team = searchParams.get('team');

		// Get list of available seasons
		if (!season && !team) {
			const seasons = await getAvailableSeasons();
			
			// Also check Neo4j for current season
			const currentSeasonData = await getCurrentSeasonDataFromNeo4j();
			if (currentSeasonData && currentSeasonData.season) {
				const seasonKey = currentSeasonData.season.replace('/', '-');
				if (!seasons.includes(seasonKey)) {
					seasons.unshift(seasonKey); // Add current season at the beginning
				}
			}

			return NextResponse.json({ seasons }, { headers: publicHeaders });
		}

		// Get specific team/season data
		if (team && season) {
			const teamData = await getTeamSeasonData(team, season);
			if (!teamData) {
				return NextResponse.json(
					{ error: `No league table data found for ${team} in ${season}` },
					{ status: 404, headers: withNoStore(corsHeaders) },
				);
			}
			return NextResponse.json({ team, season, data: teamData }, { headers: publicHeaders });
		}

		// Get all teams for a season
		if (season) {
			// Normalize season format (2019/20 -> 2019-20 for file lookup, but try both)
			const seasonNormalized = season.replace('/', '-');
			const seasonOriginal = season.replace('-', '/');

			// Try JSON file first (past seasons)
			let seasonData = await getSeasonDataFromJSON(seasonNormalized);
			
			// If not found, try Neo4j (current season)
			if (!seasonData) {
				seasonData = await getCurrentSeasonDataFromNeo4j();
				// Check if the season matches
				if (seasonData && seasonData.season !== seasonOriginal && seasonData.season !== season) {
					seasonData = null;
				}
			}

			if (!seasonData) {
				return NextResponse.json(
					{ error: `No league table data found for season ${season}` },
					{ status: 404, headers: withNoStore(corsHeaders) },
				);
			}

			return NextResponse.json({ season, data: seasonData }, { headers: publicHeaders });
		}

		// Get current season (default)
		const currentSeasonData = await getCurrentSeasonDataFromNeo4j();
		if (!currentSeasonData) {
			return NextResponse.json(
				{ error: 'No current season league table data available' },
				{ status: 404, headers: withNoStore(corsHeaders) },
			);
		}

		return NextResponse.json({ season: currentSeasonData.season, data: currentSeasonData }, { headers: publicHeaders });
	} catch (error) {
		console.error('Error fetching league tables:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch league table data' },
			{ status: 500, headers: withNoStore(corsHeaders) },
		);
	}
}

