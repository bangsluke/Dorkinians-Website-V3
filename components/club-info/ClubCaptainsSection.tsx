"use client";

import { useState, useEffect } from "react";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/20/solid";
import CaptainHistoryPopup from "./CaptainHistoryPopup";
import { getCurrentSeasonFromStorage } from "@/lib/services/currentSeasonService";
import { useNavigationStore } from "@/lib/stores/navigation";
import { cachedFetch, generatePageCacheKey } from "@/lib/utils/pageCache";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { CaptainsTableSkeleton } from "@/components/skeletons";
import { appConfig } from "@/config/config";
import { UmamiEvents } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/utils/trackEvent";

interface CaptainData {
	team: string;
	captain: string | null;
}

const CAPTAINS_SELECTED_SEASON_KEY = "dorkinians-captains-selected-season";

export default function ClubCaptainsSection({ embedded = false }: { embedded?: boolean }) {
	const { getCachedPageData, setCachedPageData } = useNavigationStore();
	const [seasons, setSeasons] = useState<string[]>([]);
	const [selectedSeason, setSelectedSeason] = useState<string>("");
	const [captainsData, setCaptainsData] = useState<CaptainData[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
	const [showPopup, setShowPopup] = useState(false);

	const compareSeasons = (season1: string, season2: string): number => {
		const year1 = parseInt(season1.split("/")[0]);
		const year2 = parseInt(season2.split("/")[0]);
		return year1 - year2;
	};

	useEffect(() => {
		const fetchSeasons = async () => {
			try {
				const cacheKey = generatePageCacheKey("club-info", "club-captains", "seasons", {});
				const data = await cachedFetch("/api/captains/seasons", {
					method: "GET",
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				if (data.seasons && data.seasons.length > 0) {
					const currentSeason = getCurrentSeasonFromStorage();
					let filteredSeasons = data.seasons;

					if (currentSeason) {
						filteredSeasons = data.seasons.filter((season: string) => {
							return compareSeasons(season, currentSeason) <= 0;
						});
					}

					setSeasons(filteredSeasons);

					const cachedSeason = typeof window !== "undefined" ? localStorage.getItem(CAPTAINS_SELECTED_SEASON_KEY) : null;
					if (cachedSeason && filteredSeasons.includes(cachedSeason)) {
						setSelectedSeason(cachedSeason);
					} else {
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

	useEffect(() => {
		if (!selectedSeason) return;

		const fetchCaptainsData = async () => {
			setLoading(true);

			const cacheKey = generatePageCacheKey("club-info", "club-captains", "captains-data", { season: selectedSeason });
			const cached = getCachedPageData(cacheKey);
			if (cached) {
				setCaptainsData(cached.data.captainsData || cached.data || []);
				setLoading(false);
				return;
			}

			try {
				const data = await cachedFetch(`/api/captains/data?season=${encodeURIComponent(selectedSeason)}`, {
					method: "GET",
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				setCaptainsData(data.captainsData || []);
			} catch (error) {
				console.error("Error fetching captain data:", error);
				setCaptainsData([]);
			} finally {
				setLoading(false);
			}
		};

		fetchCaptainsData();
	}, [selectedSeason, getCachedPageData, setCachedPageData]);

	const handleCaptainClick = (captainName: string) => {
		trackEvent(UmamiEvents.CaptainHistoryOpened, { playerName: captainName, source: "click" });
		setSelectedPlayer(captainName);
		setShowPopup(true);
	};

	const handleClosePopup = () => {
		setShowPopup(false);
		setSelectedPlayer(null);
	};

	const parseCaptains = (captainString: string | null): string[] => {
		if (!captainString) return [];

		return captainString
			.split(/[,&]/)
			.map((name) => name.trim())
			.filter((name) => name.length > 0);
	};

	return (
		<div className={embedded ? "rounded-lg bg-white/10 backdrop-blur-sm p-3 md:p-4" : "h-full flex flex-col overflow-hidden"}>
			<div className={embedded ? "md:max-w-2xl md:mx-auto w-full" : "flex-shrink-0 p-2 md:p-4 md:max-w-2xl md:mx-auto w-full"}>
				{embedded ? (
					<h3 className='text-lg md:text-xl font-semibold text-white mb-3 text-center'>Club Captains</h3>
				) : (
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-4 text-center'>Club Captains</h2>
				)}

				<div className='mb-6'>
					{loading || seasons.length === 0 ? (
						<div className='w-full max-w-[14rem] mx-auto'>
							<SkeletonTheme baseColor='var(--skeleton-base)' highlightColor='var(--skeleton-highlight)'>
								<Skeleton height={48} className='rounded-md' />
							</SkeletonTheme>
						</div>
					) : (
						<Listbox
							value={selectedSeason}
							onChange={(newSeason) => {
								setSelectedSeason(newSeason);
								if (typeof window !== "undefined") {
									localStorage.setItem(CAPTAINS_SELECTED_SEASON_KEY, newSeason);
								}
							}}>
							<div className='relative w-full max-w-[14rem] mx-auto'>
								<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-[0.65rem] md:text-sm'>
									<span className={`block truncate ${selectedSeason ? "text-white" : "text-yellow-300"}`}>
										{selectedSeason || "Select season..."}
									</span>
									<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
										<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
									</span>
								</Listbox.Button>
								<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-[0.65rem] md:text-sm shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
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

			<div className={embedded ? "px-0 pb-0" : "flex-1 overflow-y-auto px-6 pb-6 min-h-0"} style={{ WebkitOverflowScrolling: "touch" }}>
				{(loading || appConfig.forceSkeletonView) && (
					<SkeletonTheme baseColor='var(--skeleton-base)' highlightColor='var(--skeleton-highlight)'>
						<CaptainsTableSkeleton />
					</SkeletonTheme>
				)}

				{!loading && !appConfig.forceSkeletonView && captainsData.filter((item) => item.captain).length > 0 && (
					<div className='overflow-x-auto'>
						<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
							<thead className='sticky top-0 z-10'>
								<tr className='bg-white/20'>
									<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Team</th>
									<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Captain</th>
								</tr>
							</thead>
							<tbody>
								{captainsData
									.filter((item) => item.captain)
									.map((item, index) => (
										<tr key={index} className='border-b border-white/10 hover:bg-white/5 transition-colors'>
											<td className='px-2 md:px-4 py-2 md:py-3 text-white text-xs md:text-sm'>{item.team}</td>
											<td className='px-2 md:px-4 py-2 md:py-3'>
												{item.captain ? (
													<div className='flex flex-wrap gap-1 md:gap-2'>
														{parseCaptains(item.captain).map((playerName, playerIndex, players) => (
															<span key={playerIndex} className='inline-flex items-center'>
																<button
																	onClick={() => handleCaptainClick(playerName)}
																	onTouchStart={() => handleCaptainClick(playerName)}
																	className='text-white text-xs md:text-sm underline hover:text-dorkinians-yellow transition-colors cursor-pointer'>
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

				{!loading && !appConfig.forceSkeletonView && captainsData.length === 0 && selectedSeason && (
					<div className='text-center mt-8'>
						<p className='text-sm md:text-base text-gray-300'>No captain data available for {selectedSeason}.</p>
					</div>
				)}
			</div>

			{showPopup && selectedPlayer && <CaptainHistoryPopup playerName={selectedPlayer} onClose={handleClosePopup} />}
		</div>
	);
}
