"use client";

import React, { useState, useEffect } from "react";

interface Player {
	rank: number;
	playerName: string;
	ftpScore: number;
}

interface PlayerStats {
	appearances: number;
	goals: number;
	assists: number;
	cleanSheets: number;
	matchDetails: MatchDetailWithSummary[];
}

interface MatchDetailWithSummary {
	team: string;
	playerName: string;
	date: string;
	min: number;
	class: string;
	mom: boolean;
	goals: number;
	assists: number;
	yellowCards: number;
	redCards: number;
	saves: number;
	ownGoals: number;
	conceded: number;
	cleanSheets: number;
	penaltiesScored: number;
	penaltiesMissed: number;
	penaltiesConceded: number;
	penaltiesSaved: number;
	matchSummary?: string | null;
	opposition?: string | null;
	result?: string | null;
}

interface FTPBreakdown {
	stat: string;
	value: number | string;
	points: number;
	show: boolean;
}

export default function PlayersOfMonth() {
	const [seasons, setSeasons] = useState<string[]>([]);
	const [selectedSeason, setSelectedSeason] = useState<string>("");
	const [months, setMonths] = useState<string[]>([]);
	const [selectedMonth, setSelectedMonth] = useState<string>("");
	const [players, setPlayers] = useState<Player[]>([]);
	const [loading, setLoading] = useState(true);
	const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
	const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({});
	const [loadingStats, setLoadingStats] = useState<Set<string>>(new Set());

	// Fetch seasons on mount
	useEffect(() => {
		const fetchSeasons = async () => {
			try {
				const response = await fetch("/api/players-of-month/seasons");
				const data = await response.json();
				if (data.seasons) {
					setSeasons(data.seasons);
					if (data.seasons.length > 0) {
						setSelectedSeason(data.seasons[0]);
					}
				}
			} catch (error) {
				console.error("Error fetching seasons:", error);
			} finally {
				setLoading(false);
			}
		};
		fetchSeasons();
	}, []);

	// Fetch months when season changes
	useEffect(() => {
		if (!selectedSeason) return;

		const fetchMonths = async () => {
			try {
				const response = await fetch(`/api/players-of-month/months?season=${encodeURIComponent(selectedSeason)}`);
				const data = await response.json();
				if (data.months) {
					setMonths(data.months);
					if (data.months.length > 0) {
						setSelectedMonth(data.months[data.months.length - 1]);
					} else {
						setSelectedMonth("");
					}
				}
			} catch (error) {
				console.error("Error fetching months:", error);
				setMonths([]);
				setSelectedMonth("");
			}
		};
		fetchMonths();
	}, [selectedSeason]);

	// Fetch month data when season and month are selected
	useEffect(() => {
		if (!selectedSeason || !selectedMonth) {
			console.log(`[PlayersOfMonth] Skipping month data fetch - season: ${selectedSeason}, month: ${selectedMonth}`);
			setPlayers([]);
			return;
		}

		const fetchMonthData = async () => {
			const apiUrl = `/api/players-of-month/month-data?season=${encodeURIComponent(selectedSeason)}&month=${encodeURIComponent(selectedMonth)}`;
			console.log(`[PlayersOfMonth] Fetching month data from: ${apiUrl}`);
			console.log(`[PlayersOfMonth] Month data request parameters:`, {
				season: selectedSeason,
				month: selectedMonth,
			});
			
			setLoading(true);
			try {
				const startTime = performance.now();
				const response = await fetch(apiUrl);
				const endTime = performance.now();
				const duration = endTime - startTime;
				
				console.log(`[PlayersOfMonth] Month data response received after ${duration.toFixed(2)}ms`);
				console.log(`[PlayersOfMonth] Month data response status: ${response.status} ${response.statusText}`);
				
				const data = await response.json();
				console.log(`[PlayersOfMonth] Month data received:`, {
					playersCount: data.players?.length || 0,
					players: data.players,
				});
				
				if (data.players) {
					console.log(`[PlayersOfMonth] Setting ${data.players.length} players for ${selectedMonth} ${selectedSeason}`);
					data.players.forEach((player: Player, index: number) => {
						console.log(`[PlayersOfMonth] Player ${index + 1}:`, {
							rank: player.rank,
							name: player.playerName,
							ftpScore: player.ftpScore,
						});
					});
					setPlayers(data.players);
				} else {
					console.warn(`[PlayersOfMonth] No players in response for ${selectedMonth} ${selectedSeason}`);
					setPlayers([]);
				}
			} catch (error) {
				console.error(`[PlayersOfMonth] Error fetching month data for ${selectedMonth} ${selectedSeason}:`, error);
				setPlayers([]);
			} finally {
				setLoading(false);
				console.log(`[PlayersOfMonth] Month data fetch completed`);
			}
		};
		fetchMonthData();
	}, [selectedSeason, selectedMonth]);

	// Fetch player stats when row is expanded
	const handleRowExpand = async (playerName: string) => {
		console.log(`[PlayersOfMonth] handleRowExpand called for player: ${playerName}`);
		
		if (expandedPlayers.has(playerName)) {
			// Collapse
			console.log(`[PlayersOfMonth] Collapsing row for player: ${playerName}`);
			setExpandedPlayers((prev) => {
				const newSet = new Set(prev);
				newSet.delete(playerName);
				return newSet;
			});
			return;
		}

		// Expand and fetch stats
		console.log(`[PlayersOfMonth] Expanding row for player: ${playerName}`);
		setExpandedPlayers((prev) => new Set(prev).add(playerName));
		
		if (playerStats[playerName]) {
			// Stats already loaded
			console.log(`[PlayersOfMonth] Stats already cached for player: ${playerName}`, playerStats[playerName]);
			return;
		}

		if (!selectedSeason || !selectedMonth) {
			console.warn(`[PlayersOfMonth] Cannot fetch stats - missing season (${selectedSeason}) or month (${selectedMonth})`);
			return;
		}

		const apiUrl = `/api/players-of-month/player-stats?season=${encodeURIComponent(selectedSeason)}&month=${encodeURIComponent(selectedMonth)}&playerName=${encodeURIComponent(playerName)}`;
		console.log(`[PlayersOfMonth] Fetching player stats from: ${apiUrl}`);
		console.log(`[PlayersOfMonth] Request parameters:`, {
			season: selectedSeason,
			month: selectedMonth,
			playerName: playerName,
		});

		setLoadingStats((prev) => new Set(prev).add(playerName));

		try {
			const startTime = performance.now();
			console.log(`[PlayersOfMonth] API request started at ${new Date().toISOString()}`);
			
			const response = await fetch(apiUrl);
			
			const endTime = performance.now();
			const duration = endTime - startTime;
			console.log(`[PlayersOfMonth] API response received after ${duration.toFixed(2)}ms`);
			console.log(`[PlayersOfMonth] Response status: ${response.status} ${response.statusText}`);
			
			if (!response.ok) {
				const errorText = await response.text();
				console.error(`[PlayersOfMonth] API error response:`, errorText);
				throw new Error(`API error: ${response.status} ${response.statusText}`);
			}
			
			const data = await response.json();
			console.log(`[PlayersOfMonth] Response data received:`, {
				appearances: data.appearances,
				goals: data.goals,
				assists: data.assists,
				cleanSheets: data.cleanSheets,
				matchDetailsCount: data.matchDetails?.length || 0,
			});
			
			if (data.matchDetails) {
				console.log(`[PlayersOfMonth] Processing ${data.matchDetails.length} match details for ${playerName}`);
				data.matchDetails.forEach((match: MatchDetailWithSummary, index: number) => {
					console.log(`[PlayersOfMonth] Match ${index + 1}:`, {
						date: match.date,
						team: match.team,
						opposition: match.opposition,
						goals: match.goals,
						assists: match.assists,
						min: match.min,
					});
				});
				
				const stats = {
					appearances: data.appearances || 0,
					goals: data.goals || 0,
					assists: data.assists || 0,
					cleanSheets: data.cleanSheets || 0,
					matchDetails: data.matchDetails || [],
				};
				
				console.log(`[PlayersOfMonth] Setting stats for ${playerName}:`, stats);
				setPlayerStats((prev) => ({
					...prev,
					[playerName]: stats,
				}));
				console.log(`[PlayersOfMonth] Stats successfully set for ${playerName}`);
			} else {
				console.warn(`[PlayersOfMonth] No matchDetails in response for ${playerName}`);
			}
		} catch (error) {
			console.error(`[PlayersOfMonth] Error fetching player stats for ${playerName}:`, error);
			if (error instanceof Error) {
				console.error(`[PlayersOfMonth] Error message: ${error.message}`);
				console.error(`[PlayersOfMonth] Error stack:`, error.stack);
			}
		} finally {
			setLoadingStats((prev) => {
				const newSet = new Set(prev);
				newSet.delete(playerName);
				return newSet;
			});
			console.log(`[PlayersOfMonth] Loading state cleared for ${playerName}`);
		}
	};

	// Calculate FTP breakdown for a single match
	const calculateFTPBreakdown = (match: MatchDetailWithSummary): FTPBreakdown[] => {
		const playerClass = match.class;
		const breakdown: FTPBreakdown[] = [];

		// Minutes played (always show if player appeared)
		const minutes = match.min || 0;
		const minutesPoints = minutes >= 60 ? 2 : minutes > 0 ? 1 : 0;
		breakdown.push({
			stat: "Minutes played",
			value: minutes,
			points: minutesPoints,
			show: true,
		});

		// Man of the Match
		const mom = match.mom ? 1 : 0;
		breakdown.push({
			stat: "Man of the Match",
			value: mom,
			points: mom * 3,
			show: mom > 0,
		});

		// Goals scored (including penalties)
		const goals = (match.goals || 0) + (match.penaltiesScored || 0);
		let goalMultiplier = 0;
		if (playerClass === "GK" || playerClass === "DEF") {
			goalMultiplier = 6;
		} else if (playerClass === "MID") {
			goalMultiplier = 5;
		} else if (playerClass === "FWD") {
			goalMultiplier = 4;
		}
		breakdown.push({
			stat: "Goals scored",
			value: goals,
			points: goals * goalMultiplier,
			show: goals > 0,
		});

		// Assists
		const assists = match.assists || 0;
		breakdown.push({
			stat: "Assists",
			value: assists,
			points: assists * 3,
			show: assists > 0,
		});

		// Clean Sheets / Goals Conceded
		const conceded = match.conceded || 0;
		const cleanSheets = match.cleanSheets || 0;

		if (conceded === 0 && cleanSheets > 0) {
			let cleanSheetMultiplier = 0;
			if (playerClass === "GK" || playerClass === "DEF") {
				cleanSheetMultiplier = 4;
			} else if (playerClass === "MID") {
				cleanSheetMultiplier = 1;
			}
			breakdown.push({
				stat: "Clean Sheets",
				value: cleanSheets,
				points: cleanSheets * cleanSheetMultiplier,
				show: cleanSheets > 0,
			});
		} else if (conceded > 0) {
			if (playerClass === "GK" || playerClass === "DEF") {
				breakdown.push({
					stat: "Goals Conceded",
					value: conceded,
					points: Math.round(conceded * -0.5),
					show: true,
				});
			}
		}

		// Yellow Cards
		const yellowCards = match.yellowCards || 0;
		breakdown.push({
			stat: "Yellow Cards",
			value: yellowCards,
			points: yellowCards * -1,
			show: yellowCards > 0,
		});

		// Red Cards
		const redCards = match.redCards || 0;
		breakdown.push({
			stat: "Red Cards",
			value: redCards,
			points: redCards * -3,
			show: redCards > 0,
		});

		// Saves (for goalkeepers)
		const saves = match.saves || 0;
		breakdown.push({
			stat: "Saves",
			value: saves,
			points: Math.floor(saves * 0.34),
			show: saves > 0,
		});

		// Own Goals
		const ownGoals = match.ownGoals || 0;
		breakdown.push({
			stat: "Own Goals",
			value: ownGoals,
			points: ownGoals * -2,
			show: ownGoals > 0,
		});

		// Penalties Missed
		const penaltiesMissed = match.penaltiesMissed || 0;
		breakdown.push({
			stat: "Penalties Missed",
			value: penaltiesMissed,
			points: penaltiesMissed * -2,
			show: penaltiesMissed > 0,
		});

		// Penalties Conceded
		const penaltiesConceded = match.penaltiesConceded || 0;
		breakdown.push({
			stat: "Penalties Conceded",
			value: penaltiesConceded,
			points: 0,
			show: penaltiesConceded > 0,
		});

		// Penalties Saved
		const penaltiesSaved = match.penaltiesSaved || 0;
		breakdown.push({
			stat: "Penalties Saved",
			value: penaltiesSaved,
			points: penaltiesSaved * 5,
			show: penaltiesSaved > 0,
		});

		return breakdown;
	};

	// Calculate total FTP for all matches
	const calculateTotalFTP = (matchDetails: MatchDetailWithSummary[]): number => {
		return matchDetails.reduce((total, match) => {
			const breakdown = calculateFTPBreakdown(match);
			const matchTotal = breakdown.reduce((sum, stat) => sum + stat.points, 0);
			return total + matchTotal;
		}, 0);
	};

	const isInitialLoading = loading || seasons.length === 0;

	return (
		<div className='flex flex-col p-4 md:p-6 relative'>
			{/* Header */}
			<div className='text-center mb-3'>
				<h1 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-1'>PLAYERS OF THE MONTH</h1>
			</div>

			{/* Loading Spinner - Show during initial load */}
			{isInitialLoading && (
				<div className='flex items-center justify-center py-12'>
					<div className='animate-spin rounded-full h-16 w-16 md:h-20 md:w-20 border-b-2 border-gray-300'></div>
				</div>
			)}

			{/* Filters - Hide during initial load */}
			{!isInitialLoading && (
				<div className='flex flex-row gap-4 mb-6'>
					<div className='w-1/3 md:w-1/2'>
						<select
							value={selectedSeason}
							onChange={(e) => setSelectedSeason(e.target.value)}
							className='w-full text-white px-2 py-2 rounded focus:outline-none focus:ring-2 focus:ring-dorkinians-yellow text-[0.65rem] md:text-sm'
							style={{
								background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))',
								border: 'none',
							}}
						>
							{seasons.map((season) => (
								<option key={season} value={season} style={{ backgroundColor: '#0f0f0f', color: 'white' }}>
									{season}
								</option>
							))}
						</select>
					</div>
					<div className='flex-1 md:w-1/2'>
						<select
							value={selectedMonth}
							onChange={(e) => setSelectedMonth(e.target.value)}
							className='w-full text-white px-2 py-2 rounded focus:outline-none focus:ring-2 focus:ring-dorkinians-yellow text-[0.65rem] md:text-sm'
							style={{
								background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))',
								border: 'none',
							}}
						>
							{months.length === 0 ? (
								<option value=''>Loading...</option>
							) : (
								months.map((month) => (
									<option key={month} value={month} style={{ backgroundColor: '#0f0f0f', color: 'white' }}>
										{month}
									</option>
								))
							)}
						</select>
					</div>
				</div>
			)}

			{/* Players Table */}
			{!loading && players.length > 0 && (
				<div className='overflow-x-auto'>
					<table className='w-full text-white'>
						<thead>
							<tr className='border-b-2 border-dorkinians-yellow'>
								<th className='text-left py-2 px-2 text-xs md:text-sm'>Rank</th>
								<th className='text-left py-2 px-2 text-xs md:text-sm'>Player Name</th>
								<th className='text-center py-2 px-2 text-xs md:text-sm'>FTP Points</th>
							</tr>
						</thead>
						<tbody>
							{players.map((player) => {
								const isExpanded = expandedPlayers.has(player.playerName);
								const stats = playerStats[player.playerName];
								const isLoadingStats = loadingStats.has(player.playerName);

								return (
									<>
										<tr
											key={player.playerName}
											className='border-b border-green-500 cursor-pointer hover:bg-gray-800 transition-colors'
											onClick={() => handleRowExpand(player.playerName)}
										>
											<td className='py-2 px-2 text-xs md:text-sm'>{player.rank}</td>
											<td className='py-2 px-2 text-xs md:text-sm'>{player.playerName}</td>
											<td className='text-center py-2 px-2 text-xs md:text-sm font-bold'>{Math.round(player.ftpScore)}</td>
										</tr>
										{isExpanded && (
											<tr>
												<td colSpan={3} className='py-4 px-2 bg-gray-900'>
													{isLoadingStats ? (
														<div className='flex justify-center py-4'>
															<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300'></div>
														</div>
													) : stats ? (
														<div className='space-y-4'>
															{/* Monthly Stats Summary */}
															<div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
																<div className='text-center'>
																	<p className='text-gray-400 text-xs md:text-sm'>Appearances</p>
																	<p className='text-white text-lg md:text-xl font-bold'>{stats.appearances}</p>
																</div>
																<div className='text-center'>
																	<p className='text-gray-400 text-xs md:text-sm'>Goals</p>
																	<p className='text-white text-lg md:text-xl font-bold'>{stats.goals}</p>
																</div>
																<div className='text-center'>
																	<p className='text-gray-400 text-xs md:text-sm'>Assists</p>
																	<p className='text-white text-lg md:text-xl font-bold'>{stats.assists}</p>
																</div>
																<div className='text-center'>
																	<p className='text-gray-400 text-xs md:text-sm'>Clean Sheets</p>
																	<p className='text-white text-lg md:text-xl font-bold'>{stats.cleanSheets}</p>
																</div>
															</div>

															{/* FTP Breakdown Table */}
															<div className='overflow-x-auto'>
																<table className='w-full text-white'>
																	<thead>
																		<tr className='border-b-2 border-dorkinians-yellow'>
																			<th className='text-left py-2 px-2 text-xs md:text-sm'>Statistics</th>
																			<th className='text-center py-2 px-2 text-xs md:text-sm'>Value</th>
																			<th className='text-center py-2 px-2 text-xs md:text-sm'>Points</th>
																		</tr>
																	</thead>
																	<tbody>
																		{stats.matchDetails.map((match, matchIndex) => {
																			console.log(`[PlayersOfMonth] Calculating FTP breakdown for match ${matchIndex + 1} of ${stats.matchDetails.length}`, {
																				player: player.playerName,
																				date: match.date,
																				team: match.team,
																			});
																			const breakdown = calculateFTPBreakdown(match);
																			const visibleStats = breakdown.filter((stat) => stat.show);
																			const matchTotal = breakdown.reduce((sum, stat) => sum + stat.points, 0);
																			console.log(`[PlayersOfMonth] Match ${matchIndex + 1} FTP breakdown:`, {
																				totalVisibleStats: visibleStats.length,
																				matchTotal: matchTotal,
																				visibleStats: visibleStats.map(s => `${s.stat}: ${s.points}pts`),
																			});

																			return (
																				<React.Fragment key={`match-${matchIndex}`}>
																					{matchIndex > 0 && (
																						<tr>
																							<td colSpan={3} className='py-2 border-t border-gray-600'></td>
																						</tr>
																					)}
																					{visibleStats.map((stat, statIndex) => (
																						<tr key={`${matchIndex}-${statIndex}`} className='border-b border-green-500'>
																							<td className='py-2 px-2 text-xs md:text-sm'>{stat.stat}</td>
																							<td className='text-center py-2 px-2 text-xs md:text-sm'>{stat.value}</td>
																							<td className='text-center py-2 px-2 text-xs md:text-sm'>{stat.points}</td>
																						</tr>
																					))}
																					{stats.matchDetails.length > 1 && (
																						<tr className='border-t-2 border-dorkinians-yellow font-bold'>
																							<td className='py-2 px-2 text-xs md:text-sm'>Match Total</td>
																							<td className='text-center py-2 px-2'></td>
																							<td className='text-center py-2 px-2'>{matchTotal}</td>
																						</tr>
																					)}
																				</React.Fragment>
																			);
																		})}
																		{(() => {
																			const monthlyTotal = calculateTotalFTP(stats.matchDetails);
																			console.log(`[PlayersOfMonth] Monthly total FTP for ${player.playerName}:`, {
																				monthlyTotal: monthlyTotal,
																				matchCount: stats.matchDetails.length,
																			});
																			return (
																				<tr className='border-t-2 border-white font-bold text-lg'>
																					<td className='py-2 px-2 text-xs md:text-sm'>Monthly Total</td>
																					<td className='text-center py-2 px-2'></td>
																					<td className='text-center py-2 px-2'>{monthlyTotal}</td>
																				</tr>
																			);
																		})()}
																	</tbody>
																</table>
															</div>
														</div>
													) : (
														<div className='text-center py-4 text-gray-400'>No stats available</div>
													)}
												</td>
											</tr>
										)}
									</>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			{/* Empty State */}
			{!loading && players.length === 0 && selectedSeason && selectedMonth && (
				<div className='text-center py-8 text-gray-400'>
					<p>No players found for {selectedMonth} {selectedSeason}</p>
				</div>
			)}
		</div>
	);
}
