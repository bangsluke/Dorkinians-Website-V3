"use client";

import { useState, useEffect } from "react";
import CaptainHistoryPopup from "./CaptainHistoryPopup";
import { getCurrentSeasonFromStorage } from "@/lib/services/currentSeasonService";
import { getCachedCaptainsData } from "@/lib/services/captainsPreloadService";

interface CaptainData {
	team: string;
	captain: string | null;
}

const CAPTAINS_SELECTED_SEASON_KEY = "dorkinians-captains-selected-season";

export default function ClubCaptains() {
	const [seasons, setSeasons] = useState<string[]>([]);
	const [selectedSeason, setSelectedSeason] = useState<string>("");
	const [captainsData, setCaptainsData] = useState<CaptainData[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
	const [showPopup, setShowPopup] = useState(false);

	// Helper function to compare seasons (e.g., "2022/23" vs "2023/24")
	const compareSeasons = (season1: string, season2: string): number => {
		const year1 = parseInt(season1.split("/")[0]);
		const year2 = parseInt(season2.split("/")[0]);
		return year1 - year2;
	};

	// Fetch seasons on mount and set default season
	useEffect(() => {
		const fetchSeasons = async () => {
			try {
				const response = await fetch("/api/captains/seasons");
				if (!response.ok) {
					throw new Error("Failed to fetch seasons");
				}
				const data = await response.json();
				if (data.seasons && data.seasons.length > 0) {
					// Filter out seasons later than current season
					const currentSeason = getCurrentSeasonFromStorage();
					let filteredSeasons = data.seasons;
					
					if (currentSeason) {
						filteredSeasons = data.seasons.filter((season: string) => {
							return compareSeasons(season, currentSeason) <= 0;
						});
					}

					setSeasons(filteredSeasons);

					// Try to restore selected season from localStorage
					const cachedSeason = typeof window !== "undefined" ? localStorage.getItem(CAPTAINS_SELECTED_SEASON_KEY) : null;
					if (cachedSeason && filteredSeasons.includes(cachedSeason)) {
						setSelectedSeason(cachedSeason);
					} else {
						// Default to currentSeason from localStorage, or first season
						if (currentSeason && filteredSeasons.includes(currentSeason)) {
							setSelectedSeason(currentSeason);
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

	// Fetch captain data when season changes
	useEffect(() => {
		if (!selectedSeason) return;

		const fetchCaptainsData = async () => {
			setLoading(true);
			
			// Check cache first
			const cachedData = getCachedCaptainsData(selectedSeason);
			if (cachedData) {
				setCaptainsData(cachedData);
				setLoading(false);
				return;
			}

			// If not in cache, fetch from API
			try {
				const response = await fetch(`/api/captains/data?season=${encodeURIComponent(selectedSeason)}`);
				if (!response.ok) {
					throw new Error("Failed to fetch captain data");
				}
				const data = await response.json();
				setCaptainsData(data.captainsData || []);
			} catch (error) {
				console.error("Error fetching captain data:", error);
				setCaptainsData([]);
			} finally {
				setLoading(false);
			}
		};

		fetchCaptainsData();
	}, [selectedSeason]);

	// Handle captain name click/hover
	const handleCaptainClick = (captainName: string) => {
		setSelectedPlayer(captainName);
		setShowPopup(true);
	};

	const handleCaptainHover = (captainName: string) => {
		// Only show on hover for desktop (screen width >= 768px)
		if (typeof window !== "undefined" && window.innerWidth >= 768) {
			setSelectedPlayer(captainName);
			setShowPopup(true);
		}
	};

	const handleCaptainHoverEnd = () => {
		// Don't close on hover end - let user click to close or use close button
	};

	const handleClosePopup = () => {
		setShowPopup(false);
		setSelectedPlayer(null);
	};

	// Parse captain string to extract individual player names
	const parseCaptains = (captainString: string | null): string[] => {
		if (!captainString) return [];
		
		// Split by comma and ampersand, then trim each name
		return captainString
			.split(/[,&]/)
			.map((name) => name.trim())
			.filter((name) => name.length > 0);
	};

	return (
		<div className='h-full flex flex-col overflow-hidden'>
			<div className='flex-shrink-0 p-6 pb-4'>
				<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-4 text-center'>Club Captains</h2>

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
									localStorage.setItem(CAPTAINS_SELECTED_SEASON_KEY, newSeason);
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
			<div className='flex-1 overflow-y-auto px-6 pb-6 min-h-0'>
				{/* Loading State */}
				{loading && (
					<div className='text-center'>
						<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-gray-300 mx-auto'></div>
						<p className='text-white mt-4 text-sm md:text-base'>Loading captain data...</p>
					</div>
				)}

				{/* Captains Table */}
				{!loading && captainsData.filter(item => item.captain).length > 0 && (
					<div className='overflow-x-auto'>
						<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
							<thead className='sticky top-0 z-10'>
								<tr className='bg-white/20'>
									<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Team</th>
									<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Captain</th>
								</tr>
							</thead>
							<tbody>
								{captainsData.filter(item => item.captain).map((item, index) => (
									<tr key={index} className='border-b border-white/10 hover:bg-white/5 transition-colors'>
										<td className='px-2 md:px-4 py-2 md:py-3 text-white text-xs md:text-sm'>{item.team}</td>
										<td className='px-2 md:px-4 py-2 md:py-3'>
											{item.captain ? (
												<div className='flex flex-wrap gap-1 md:gap-2'>
													{parseCaptains(item.captain).map((playerName, playerIndex, players) => (
														<span key={playerIndex} className='inline-flex items-center'>
															<button
																onClick={() => handleCaptainClick(playerName)}
																onMouseEnter={() => handleCaptainHover(playerName)}
																onMouseLeave={handleCaptainHoverEnd}
																onTouchStart={() => handleCaptainClick(playerName)}
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

				{/* No Data Message */}
				{!loading && captainsData.length === 0 && selectedSeason && (
					<div className='text-center mt-8'>
						<p className='text-sm md:text-base text-gray-300'>No captain data available for {selectedSeason}.</p>
					</div>
				)}
			</div>

			{/* Captain History Popup */}
			{showPopup && selectedPlayer && <CaptainHistoryPopup playerName={selectedPlayer} onClose={handleClosePopup} />}
		</div>
	);
}
