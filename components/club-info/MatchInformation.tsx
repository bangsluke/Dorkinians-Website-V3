"use client";

import { useState, useEffect } from "react";

interface LeagueTableEntry {
	position: number;
	team: string;
	played: number;
	won: number;
	drawn: number;
	lost: number;
	goalsFor: number;
	goalsAgainst: number;
	goalDifference: number;
	points: number;
}

interface SeasonLeagueData {
	season: string;
	division?: string;
	url?: string;
	lastUpdated?: string;
	teams: {
		[key: string]: LeagueTableEntry[];
	};
}

export default function MatchInformation() {
	const [seasons, setSeasons] = useState<string[]>([]);
	const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
	const [leagueData, setLeagueData] = useState<SeasonLeagueData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Fetch available seasons on mount
	useEffect(() => {
		const fetchSeasons = async () => {
			try {
				const response = await fetch("/api/league-tables");
				if (response.ok) {
					const data = await response.json();
					setSeasons(data.seasons || []);
					// Select first season (most recent) by default
					if (data.seasons && data.seasons.length > 0) {
						setSelectedSeason(data.seasons[0]);
					}
				} else {
					setError("Failed to fetch available seasons");
				}
			} catch (err) {
				console.error("Error fetching seasons:", err);
				setError("Error loading seasons");
			} finally {
				setLoading(false);
			}
		};

		fetchSeasons();
	}, []);

	// Fetch league data when season changes
	useEffect(() => {
		if (!selectedSeason) return;

		const fetchLeagueData = async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await fetch(`/api/league-tables?season=${encodeURIComponent(selectedSeason)}`);
				if (response.ok) {
					const data = await response.json();
					setLeagueData(data.data);
				} else {
					const errorData = await response.json();
					setError(errorData.error || "Failed to fetch league table data");
				}
			} catch (err) {
				console.error("Error fetching league data:", err);
				setError("Error loading league table data");
			} finally {
				setLoading(false);
			}
		};

		fetchLeagueData();
	}, [selectedSeason]);

	// Format season for display (2019-20 -> 2019/20)
	const formatSeason = (season: string) => {
		return season.replace("-", "/");
	};

	// Get team display name
	const getTeamDisplayName = (teamKey: string) => {
		const teamMap: { [key: string]: string } = {
			"1s": "1st XI",
			"2s": "2nd XI",
			"3s": "3rd XI",
			"4s": "4th XI",
			"5s": "5th XI",
			"6s": "6th XI",
			"7s": "7th XI",
		};
		return teamMap[teamKey] || teamKey;
	};

	return (
		<div className='p-6 overflow-y-auto'>
			<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-4 text-center'>
				Match Information
			</h2>
			<p className='text-sm md:text-base text-gray-300 text-center mb-8'>
				League tables and standings for all Dorkinians teams
			</p>

			{/* Season Selector */}
			<div className='mb-6 flex flex-col sm:flex-row items-center justify-center gap-4'>
				<label htmlFor='season-select' className='text-sm md:text-base text-gray-300 font-medium'>
					Select Season:
				</label>
				<select
					id='season-select'
					value={selectedSeason || ""}
					onChange={(e) => setSelectedSeason(e.target.value)}
					className='px-4 py-2 bg-gray-800 text-gray-200 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-dorkinians-yellow min-w-[150px]'
					disabled={loading || seasons.length === 0}
				>
					{seasons.length === 0 ? (
						<option value=''>No seasons available</option>
					) : (
						seasons.map((season) => (
							<option key={season} value={season}>
								{formatSeason(season)}
							</option>
						))
					)}
				</select>
			</div>

			{/* Error Message */}
			{error && (
				<div className='mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-200 text-center'>
					{error}
				</div>
			)}

			{/* Loading State */}
			{loading && (
				<div className='flex justify-center py-8'>
					<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-dorkinians-yellow'></div>
				</div>
			)}

			{/* League Tables */}
			{!loading && !error && leagueData && (
				<div className='space-y-8'>
					{/* Season Info */}
					{(leagueData.division || leagueData.lastUpdated || leagueData.url) && (
						<div className='text-center text-sm text-gray-400 mb-4'>
							{leagueData.division && (
								<div className='font-semibold text-dorkinians-yellow'>{leagueData.division}</div>
							)}
							{leagueData.lastUpdated && (
								<div className='mt-1'>
									Last updated: {new Date(leagueData.lastUpdated).toLocaleDateString()}
								</div>
							)}
							{/* League Table Link - shown once at season level */}
							{leagueData.url && (
								<div className='mt-2'>
									<a
										href={leagueData.url}
										target='_blank'
										rel='noopener noreferrer'
										className='text-dorkinians-yellow hover:text-yellow-400 underline text-sm transition-colors'
									>
										League Table Link
									</a>
								</div>
							)}
						</div>
					)}

					{/* Display tables for each team */}
					{Object.entries(leagueData.teams).map(([teamKey, entries]) => {
						if (!entries || entries.length === 0) return null;

						// Find Dorkinians position
						const dorkiniansEntry = entries.find((entry) =>
							entry.team.toLowerCase().includes("dorkinians"),
						);

						return (
							<div key={teamKey} className='bg-gray-800/50 rounded-lg p-4 md:p-6'>
								<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-4 text-center'>
									{getTeamDisplayName(teamKey)} - {formatSeason(leagueData.season)}
									{dorkiniansEntry && (
										<span className='ml-2 text-base text-gray-300'>
											(Finished {dorkiniansEntry.position}
											{dorkiniansEntry.position === 1
												? "st"
												: dorkiniansEntry.position === 2
													? "nd"
													: dorkiniansEntry.position === 3
														? "rd"
														: "th"})
										</span>
									)}
								</h3>

								<div className='overflow-x-auto'>
									<table className='w-full text-sm md:text-base'>
										<thead>
											<tr className='bg-gray-700/50'>
												<th className='px-2 py-2 text-left font-semibold text-dorkinians-yellow'>Pos</th>
												<th className='px-2 py-2 text-left font-semibold text-dorkinians-yellow'>Team</th>
												<th className='px-2 py-2 text-center font-semibold text-dorkinians-yellow'>P</th>
												<th className='px-2 py-2 text-center font-semibold text-dorkinians-yellow'>W</th>
												<th className='px-2 py-2 text-center font-semibold text-dorkinians-yellow'>D</th>
												<th className='px-2 py-2 text-center font-semibold text-dorkinians-yellow'>L</th>
												<th className='px-2 py-2 text-center font-semibold text-dorkinians-yellow'>F</th>
												<th className='px-2 py-2 text-center font-semibold text-dorkinians-yellow'>A</th>
												<th className='px-2 py-2 text-center font-semibold text-dorkinians-yellow'>GD</th>
												<th className='px-2 py-2 text-center font-semibold text-dorkinians-yellow'>Pts</th>
											</tr>
										</thead>
										<tbody>
											{entries.map((entry, index) => {
												const isDorkinians = entry.team.toLowerCase().includes("dorkinians");
												return (
													<tr
														key={index}
														className={`border-b border-gray-700/30 ${
															isDorkinians
																? "bg-dorkinians-yellow/20 font-semibold"
																: index % 2 === 0
																	? "bg-gray-800/30"
																	: ""
														}`}
													>
														<td className='px-2 py-2 text-gray-200'>{entry.position}</td>
														<td className='px-2 py-2 text-gray-200'>{entry.team}</td>
														<td className='px-2 py-2 text-center text-gray-200'>{entry.played}</td>
														<td className='px-2 py-2 text-center text-gray-200'>{entry.won}</td>
														<td className='px-2 py-2 text-center text-gray-200'>{entry.drawn}</td>
														<td className='px-2 py-2 text-center text-gray-200'>{entry.lost}</td>
														<td className='px-2 py-2 text-center text-gray-200'>{entry.goalsFor}</td>
														<td className='px-2 py-2 text-center text-gray-200'>{entry.goalsAgainst}</td>
														<td className='px-2 py-2 text-center text-gray-200'>{entry.goalDifference}</td>
														<td className='px-2 py-2 text-center font-semibold text-dorkinians-yellow'>
															{entry.points}
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</div>
						);
					})}

					{/* No teams message */}
					{Object.keys(leagueData.teams).length === 0 && (
						<div className='text-center text-gray-400 py-8'>
							No league table data available for this season
						</div>
					)}
				</div>
			)}
		</div>
	);
}
