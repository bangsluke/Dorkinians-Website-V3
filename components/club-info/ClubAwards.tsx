"use client";

import { useState, useEffect, Fragment } from "react";
import AwardHistoryPopup from "./AwardHistoryPopup";
import { getCurrentSeasonFromStorage } from "@/lib/services/currentSeasonService";
import { getCachedAwardsData } from "@/lib/services/awardsPreloadService";

interface AwardData {
	awardName: string;
	receiver: string | null;
}

interface HistoricalAwardEntry {
	awardName: string;
	receiver: string;
	season: string;
	isPlayer: boolean;
}

interface SeasonBreaker {
	type: "season";
	season: string;
}

type AwardDisplayItem = AwardData | HistoricalAwardEntry | SeasonBreaker;

const AWARDS_SELECTED_SEASON_KEY = "dorkinians-awards-selected-season";

export default function ClubAwards() {
	const [seasons, setSeasons] = useState<string[]>([]);
	const [selectedSeason, setSelectedSeason] = useState<string>("");
	const [awardsData, setAwardsData] = useState<AwardData[]>([]);
	const [historicalAwardsData, setHistoricalAwardsData] = useState<AwardDisplayItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
	const [showPopup, setShowPopup] = useState(false);
	const isHistoricalAwards = selectedSeason === "Historical Awards";

	// Helper function to compare seasons (e.g., "2022/23" vs "2023/24")
	const compareSeasons = (season1: string, season2: string): number => {
		const year1 = parseInt(season1.split("/")[0]);
		const year2 = parseInt(season2.split("/")[0]);
		return year1 - year2;
	};

	// Helper function to get previous season (e.g., "2024/25" -> "2023/24")
	const getPreviousSeason = (season: string): string => {
		const [startYear, endYear] = season.split("/").map(Number);
		const prevStartYear = startYear - 1;
		const prevEndYear = endYear - 1;
		return `${prevStartYear}/${prevEndYear.toString().padStart(2, "0")}`;
	};

	// Fetch seasons on mount and set default season
	useEffect(() => {
		const fetchSeasons = async () => {
			try {
				const response = await fetch("/api/awards/seasons");
				if (!response.ok) {
					throw new Error("Failed to fetch seasons");
				}
				const data = await response.json();
				if (data.seasons && data.seasons.length > 0) {
					const currentSeason = getCurrentSeasonFromStorage();
					let filteredSeasons = data.seasons;
					
					// Filter out current season and seasons later than current season
					// Preserve "Historical Awards" option (not a season format)
					if (currentSeason) {
						filteredSeasons = data.seasons.filter((season: string) => {
							// Always include "Historical Awards"
							if (season === "Historical Awards") {
								return true;
							}
							// Only filter actual season strings
							return compareSeasons(season, currentSeason) < 0;
						});
					}

					setSeasons(filteredSeasons);

					// Try to restore selected season from localStorage
					const cachedSeason = typeof window !== "undefined" ? localStorage.getItem(AWARDS_SELECTED_SEASON_KEY) : null;
					if (cachedSeason && filteredSeasons.includes(cachedSeason)) {
						setSelectedSeason(cachedSeason);
					} else {
						// Default to previous season if current season exists, otherwise first season
						if (currentSeason) {
							const previousSeason = getPreviousSeason(currentSeason);
							if (filteredSeasons.includes(previousSeason)) {
								setSelectedSeason(previousSeason);
							} else if (filteredSeasons.length > 0) {
								setSelectedSeason(filteredSeasons[0]);
							}
						} else if (filteredSeasons.length > 0) {
							setSelectedSeason(filteredSeasons[0]);
						}
					}
				}
			} catch (error) {
				console.error("Error fetching seasons:", error);
			}
		};

		fetchSeasons();
	}, []);

	// Fetch award data when season changes
	useEffect(() => {
		if (!selectedSeason) return;

		const fetchAwardsData = async () => {
			setLoading(true);
			
			// Handle historical awards separately
			if (selectedSeason === "Historical Awards") {
				try {
					const response = await fetch(`/api/awards/historical`);
					if (!response.ok) {
						throw new Error("Failed to fetch historical award data");
					}
					const data = await response.json();
					setHistoricalAwardsData(data.awardsData || []);
					setAwardsData([]);
				} catch (error) {
					console.error("Error fetching historical award data:", error);
					setHistoricalAwardsData([]);
					setAwardsData([]);
				} finally {
					setLoading(false);
				}
				return;
			}

			// Regular awards - check cache first
			const cachedData = getCachedAwardsData(selectedSeason);
			if (cachedData) {
				setAwardsData(cachedData);
				setHistoricalAwardsData([]);
				setLoading(false);
				return;
			}

			// If not in cache, fetch from API
			try {
				const response = await fetch(`/api/awards/data?season=${encodeURIComponent(selectedSeason)}`);
				if (!response.ok) {
					throw new Error("Failed to fetch award data");
				}
				const data = await response.json();
				setAwardsData(data.awardsData || []);
				setHistoricalAwardsData([]);
			} catch (error) {
				console.error("Error fetching award data:", error);
				setAwardsData([]);
				setHistoricalAwardsData([]);
			} finally {
				setLoading(false);
			}
		};

		fetchAwardsData();
	}, [selectedSeason]);

	// Handle player name click/hover
	const handlePlayerClick = (playerName: string) => {
		setSelectedPlayer(playerName);
		setShowPopup(true);
	};

	const handlePlayerHover = (playerName: string) => {
		// Only show on hover for desktop (screen width >= 768px)
		if (typeof window !== "undefined" && window.innerWidth >= 768) {
			setSelectedPlayer(playerName);
			setShowPopup(true);
		}
	};

	const handlePlayerHoverEnd = () => {
		// Don't close on hover end - let user click to close or use close button
	};

	const handleClosePopup = () => {
		setShowPopup(false);
		setSelectedPlayer(null);
	};

	// Parse receiver string to extract individual player names
	const parseReceivers = (receiverString: string | null): string[] => {
		if (!receiverString) return [];
		
		// Split by comma and ampersand, then trim each name
		return receiverString
			.split(/[,&]/)
			.map((name) => name.trim())
			.filter((name) => name.length > 0);
	};

	return (
		<div className='h-full flex flex-col overflow-hidden'>
			<div className='flex-shrink-0 p-6 pb-4'>
				<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-4 text-center'>Club Awards</h2>

				{/* Season Dropdown */}
				{seasons.length > 0 && (
					<div className='mb-6'>
						<select
							value={selectedSeason}
							onChange={(e) => {
								const newSeason = e.target.value;
								setSelectedSeason(newSeason);
								// Cache selected season to localStorage
								if (typeof window !== "undefined") {
									localStorage.setItem(AWARDS_SELECTED_SEASON_KEY, newSeason);
								}
							}}
							className='w-full text-white px-2 py-2 rounded focus:outline-none focus:ring-2 focus:ring-dorkinians-yellow text-[0.65rem] md:text-sm'
							style={{
								background: "linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))",
								border: "none",
							}}
						>
							{seasons.map((season) => (
								<option key={season} value={season} style={{ backgroundColor: "#0f0f0f", color: "white" }}>
									{season}
								</option>
							))}
						</select>
					</div>
				)}
			</div>

			{/* Scrollable Content Area */}
			<div 
				className='flex-1 overflow-y-auto px-6 pb-6 min-h-0'
				style={{
					WebkitOverflowScrolling: "touch",
				}}
			>
				{/* Loading State */}
				{loading && (
					<div className='text-center'>
						<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-gray-300 mx-auto'></div>
						<p className='text-white mt-4 text-sm md:text-base'>Loading award data...</p>
					</div>
				)}

				{/* Awards Table - Regular Awards */}
				{!loading && !isHistoricalAwards && awardsData.filter(item => item.receiver).length > 0 && (
					<div className='overflow-x-auto -mx-6 px-6'>
						<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
							<thead className='sticky top-0 z-10'>
								<tr className='bg-white/20'>
									<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Award Name</th>
									<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Receiver</th>
								</tr>
							</thead>
							<tbody>
								{awardsData.filter(item => item.receiver).map((item, index) => (
									<tr key={index} className='border-b border-white/10 hover:bg-white/5 transition-colors'>
										<td className='px-2 md:px-4 py-2 md:py-3 text-white text-xs md:text-sm'>{item.awardName}</td>
										<td className='px-2 md:px-4 py-2 md:py-3'>
											{item.receiver ? (
												<div className='flex flex-wrap gap-1 md:gap-2'>
													{parseReceivers(item.receiver).map((playerName, playerIndex, players) => (
														<span key={playerIndex} className='inline-flex items-center'>
															<button
																onClick={() => handlePlayerClick(playerName)}
																onMouseEnter={() => handlePlayerHover(playerName)}
																onMouseLeave={handlePlayerHoverEnd}
																onTouchStart={() => handlePlayerClick(playerName)}
																className='text-white text-xs md:text-sm underline hover:text-dorkinians-yellow transition-colors cursor-pointer'
															>
																{playerName}
															</button>
															{playerIndex < players.length - 1 && (
																<span className='text-white/70 text-xs md:text-sm mx-1'>
																	{playerIndex === players.length - 2 ? " & " : ", "}
																</span>
															)}
														</span>
													))}
												</div>
											) : (
												<span className='text-white/50 text-xs md:text-sm'>-</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* Historical Awards Table */}
				{!loading && isHistoricalAwards && historicalAwardsData.length > 0 && (() => {
					// Group items by season
					const groupedData: { season: string; awards: HistoricalAwardEntry[] }[] = [];
					let currentSeason = "";
					let currentGroup: HistoricalAwardEntry[] = [];

					historicalAwardsData.forEach((item) => {
						if ('type' in item && item.type === 'season') {
							// Save previous group if it exists
							if (currentSeason && currentGroup.length > 0) {
								groupedData.push({ season: currentSeason, awards: currentGroup });
							}
							// Start new group
							currentSeason = item.season;
							currentGroup = [];
						} else {
							// Add award to current group
							currentGroup.push(item as HistoricalAwardEntry);
						}
					});
					// Add last group
					if (currentSeason && currentGroup.length > 0) {
						groupedData.push({ season: currentSeason, awards: currentGroup });
					}

					return (
						<div className='overflow-x-auto -mx-6 px-6'>
							<table className='w-full bg-transparent' style={{ borderCollapse: 'separate', borderSpacing: '0' }}>
								<thead className='sticky top-0 z-10'>
									<tr className='bg-white/20'>
										<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Award Name</th>
										<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Receiver</th>
									</tr>
								</thead>
								<tbody>
									{groupedData.map((group, groupIndex) => (
										<Fragment key={`group-${groupIndex}`}>
											{/* Season breaker row */}
											<tr>
												<td colSpan={2} className='px-2 md:px-4 py-1 md:py-2 text-white font-bold text-sm md:text-base' style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
													{group.season}
												</td>
											</tr>
											{/* Award rows with background */}
											{group.awards.map((entry, awardIndex) => (
												<tr key={`award-${groupIndex}-${awardIndex}`} className='border-b border-white/10 hover:bg-white/5 transition-colors' style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
													<td className='px-2 md:px-4 py-2 md:py-3 text-white text-xs md:text-sm'>{entry.awardName}</td>
													<td className='px-2 md:px-4 py-2 md:py-3'>
														{entry.isPlayer ? (
															<button
																onClick={() => handlePlayerClick(entry.receiver)}
																onMouseEnter={() => handlePlayerHover(entry.receiver)}
																onMouseLeave={handlePlayerHoverEnd}
																onTouchStart={() => handlePlayerClick(entry.receiver)}
																className='text-white text-xs md:text-sm underline hover:text-dorkinians-yellow transition-colors cursor-pointer'
															>
																{entry.receiver}
															</button>
														) : (
															<span className='text-white text-xs md:text-sm'>{entry.receiver}</span>
														)}
													</td>
												</tr>
											))}
											{/* Gap between season groups */}
											{groupIndex < groupedData.length - 1 && (
												<tr>
													<td colSpan={2} className='py-2' style={{ backgroundColor: 'transparent' }}></td>
												</tr>
											)}
										</Fragment>
									))}
								</tbody>
							</table>
						</div>
					);
				})()}

				{/* No Data Message */}
				{!loading && !isHistoricalAwards && awardsData.length === 0 && selectedSeason && (
					<div className='text-center mt-8'>
						<p className='text-sm md:text-base text-gray-300'>No award data available for {selectedSeason}.</p>
					</div>
				)}
				{!loading && isHistoricalAwards && historicalAwardsData.length === 0 && (
					<div className='text-center mt-8'>
						<p className='text-sm md:text-base text-gray-300'>No historical award data available.</p>
					</div>
				)}
			</div>

			{/* Award History Popup */}
			{showPopup && selectedPlayer && <AwardHistoryPopup playerName={selectedPlayer} onClose={handleClosePopup} />}
		</div>
	);
}
