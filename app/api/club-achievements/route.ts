import { NextRequest, NextResponse } from 'next/server';
import {
	getAvailableSeasons,
	getSeasonDataFromJSON,
} from '@/lib/services/leagueTableService';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

export interface ClubAchievement {
	team: string;
	division: string;
	season: string;
}

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
	try {
		const achievements: ClubAchievement[] = [];

		// Get all seasons from JSON files
		const seasons = await getAvailableSeasons();

		// Scan all historical seasons
		for (const season of seasons) {
			const seasonData = await getSeasonDataFromJSON(season);
			if (!seasonData) continue;

			// Iterate through all teams in this season
			for (const [teamKey, teamData] of Object.entries(seasonData.teams)) {
				if (!teamData || !teamData.table || teamData.table.length === 0) continue;

				// Find Dorkinians entry in this team's table
				const dorkiniansEntry = teamData.table.find((entry) =>
					entry.team.toLowerCase().includes('dorkinians'),
				);

				// Check if Dorkinians finished in 1st place
				if (dorkiniansEntry && dorkiniansEntry.position === 1) {
					achievements.push({
						team: teamKey,
						division: teamData.division || '',
						season: seasonData.season, // Already in slash format from getSeasonDataFromJSON
					});
				}
			}
		}

		// Helper function to get team priority (1st XI = 1, 2nd XI = 2, etc.)
		const getTeamPriority = (team: string): number => {
			const teamMap: { [key: string]: number } = {
				"1s": 1,
				"2s": 2,
				"3s": 3,
				"4s": 4,
				"5s": 5,
				"6s": 6,
				"7s": 7,
				"8s": 8,
			};
			return teamMap[team] || 999;
		};

		// Sort by team priority first (1st XI highest), then by season descending
		achievements.sort((a, b) => {
			const priorityDiff = getTeamPriority(a.team) - getTeamPriority(b.team);
			if (priorityDiff !== 0) return priorityDiff;
			// Then sort by season descending (most recent first)
			const seasonA = parseInt(a.season.replace('/', ''));
			const seasonB = parseInt(b.season.replace('/', ''));
			return seasonB - seasonA;
		});

		return NextResponse.json({ achievements }, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching club achievements:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch club achievements' },
			{ status: 500, headers: corsHeaders },
		);
	}
}

