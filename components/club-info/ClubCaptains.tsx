"use client";

import { useState, useEffect } from "react";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/20/solid";
import CaptainHistoryPopup from "./CaptainHistoryPopup";
import { getCurrentSeasonFromStorage } from "@/lib/services/currentSeasonService";
import { getCachedCaptainsData } from "@/lib/services/captainsPreloadService";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { CaptainsTableSkeleton } from "@/components/skeletons";
import { appConfig } from "@/config/config";

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
			<div className='flex-shrink-0 p-2 md:p-4'>
				<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-4 text-center'>Club Captains</h2>

				{/* Season Dropdown */}
				<div className='mb-2'>
					{(loading || seasons.length === 0) ? (
						<div className='w-[60%] md:w-full mx-auto'>
							<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
								<Skeleton height={48} className='rounded-md' />
							</SkeletonTheme>
						</div>
					) : (
						<Listbox
							value={selectedSeason}
							onChange={(newSeason) => {
								setSelectedSeason(newSeason);
								// Cache selected season to localStorage
								if (typeof window !== "undefined") {
									localStorage.setItem(CAPTAINS_SELECTED_SEASON_KEY, newSeason);
								}
							}}>
							<div className='relative w-[60%] md:w-full mx-auto'>
								<Listbox.Button className='relative w-full cursor-default dark-dropdown py-3 pl-4 pr-10 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-sm md:text-base'>
									<span className={`block truncate ${selectedSeason ? "text-white" : "text-yellow-300"}`}>
										{selectedSeason || "Select season..."}
									</span>
									<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
										<ChevronUpDownIcon className='h-5 w-5 text-yellow-300' aria-hidden='true' />
									</span>
								</Listbox.Button>
								<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-sm md:text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
									{seasons.map((season) => (
										<Listbox.Option
											key={season}
											className={({ active }) =>
												`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
											}
											value={season}>
											{({ selected }) => (
												<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
													{season}
												</span>
											)}
										</Listbox.Option>
									))}
								</Listbox.Options>
							</div>
						</Listbox>
					)}
				</div>
			</div>

			{/* Scrollable Content Area */}
			<div 
				className='flex-1 overflow-y-auto px-6 pb-6 min-h-0'
				style={{ WebkitOverflowScrolling: 'touch' }}>
				{/* Loading State */}
				{(loading || appConfig.forceSkeletonView) && (
					<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
						<CaptainsTableSkeleton />
					</SkeletonTheme>
				)}

				{/* Captains Table */}
				{!loading && !appConfig.forceSkeletonView && captainsData.filter(item => item.captain).length > 0 && (
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
																<span className='text-white/70 text-xs md:text-sm pl-1'>
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
				{!loading && !appConfig.forceSkeletonView && captainsData.length === 0 && selectedSeason && (
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
