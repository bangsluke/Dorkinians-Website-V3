"use client";

import { useState, useEffect, Fragment } from "react";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/20/solid";
import AwardHistoryPopup from "./AwardHistoryPopup";
import { getCurrentSeasonFromStorage } from "@/lib/services/currentSeasonService";
import { useNavigationStore } from "@/lib/stores/navigation";
import { cachedFetch, generatePageCacheKey } from "@/lib/utils/pageCache";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { AwardsTableSkeleton } from "@/components/skeletons";
import { appConfig } from "@/config/config";
import { UmamiEvents } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/utils/trackEvent";

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

export default function ClubAwardsSection({ embedded = false }: { embedded?: boolean }) {
	const { getCachedPageData, setCachedPageData } = useNavigationStore();
	const [seasons, setSeasons] = useState<string[]>([]);
	const [selectedSeason, setSelectedSeason] = useState<string>("");
	const [awardsData, setAwardsData] = useState<AwardData[]>([]);
	const [historicalAwardsData, setHistoricalAwardsData] = useState<AwardDisplayItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
	const [showPopup, setShowPopup] = useState(false);
	const isHistoricalAwards = selectedSeason === "Historical Awards";

	const compareSeasons = (season1: string, season2: string): number => {
		const year1 = parseInt(season1.split("/")[0]);
		const year2 = parseInt(season2.split("/")[0]);
		return year1 - year2;
	};

	const getPreviousSeason = (season: string): string => {
		const [startYear, endYear] = season.split("/").map(Number);
		const prevStartYear = startYear - 1;
		const prevEndYear = endYear - 1;
		return `${prevStartYear}/${prevEndYear.toString().padStart(2, "0")}`;
	};

	useEffect(() => {
		const fetchSeasons = async () => {
			try {
				const cacheKey = generatePageCacheKey("club-info", "club-awards", "seasons", {});
				const data = await cachedFetch("/api/awards/seasons", {
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
							if (season === "Historical Awards") {
								return true;
							}
							return compareSeasons(season, currentSeason) < 0;
						});
					}

					setSeasons(filteredSeasons);

					const cachedSeason = typeof window !== "undefined" ? localStorage.getItem(AWARDS_SELECTED_SEASON_KEY) : null;
					if (cachedSeason && filteredSeasons.includes(cachedSeason)) {
						setSelectedSeason(cachedSeason);
					} else {
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

	useEffect(() => {
		if (!selectedSeason) return;

		const fetchAwardsData = async () => {
			setLoading(true);

			if (selectedSeason === "Historical Awards") {
				try {
					const cacheKey = generatePageCacheKey("club-info", "club-awards", "historical-awards", {});
					const data = await cachedFetch(`/api/awards/historical`, {
						method: "GET",
						cacheKey,
						getCachedPageData,
						setCachedPageData,
					});
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

			const cacheKey = generatePageCacheKey("club-info", "club-awards", "awards-data", { season: selectedSeason });
			const cached = getCachedPageData(cacheKey);
			if (cached) {
				setAwardsData(cached.data.awardsData || cached.data || []);
				setHistoricalAwardsData([]);
				setLoading(false);
				return;
			}

			try {
				const data = await cachedFetch(`/api/awards/data?season=${encodeURIComponent(selectedSeason)}`, {
					method: "GET",
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
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
	}, [selectedSeason, getCachedPageData, setCachedPageData]);

	const handlePlayerClick = (playerName: string) => {
		trackEvent(UmamiEvents.AwardHistoryOpened, { playerName, source: "click" });
		setSelectedPlayer(playerName);
		setShowPopup(true);
	};

	const handleClosePopup = () => {
		setShowPopup(false);
		setSelectedPlayer(null);
	};

	const parseReceivers = (receiverString: string | null): string[] => {
		if (!receiverString) return [];

		return receiverString
			.split(/[,&]/)
			.map((name) => name.trim())
			.filter((name) => name.length > 0);
	};

	return (
		<div className={embedded ? "rounded-lg bg-white/10 backdrop-blur-sm p-3 md:p-4" : "h-full flex flex-col overflow-hidden"}>
			<div className={embedded ? "md:max-w-2xl md:mx-auto w-full" : "flex-shrink-0 p-2 md:p-4 md:max-w-2xl md:mx-auto w-full"}>
				{embedded ? (
					<h3 className='text-lg md:text-xl font-semibold text-white mb-3 text-center'>Club Awards</h3>
				) : (
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-4 text-center'>Club Awards</h2>
				)}

				<div className='mb-2'>
					{loading || seasons.length === 0 ? (
						<div className='w-[60%] md:w-full mx-auto'>
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
									localStorage.setItem(AWARDS_SELECTED_SEASON_KEY, newSeason);
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

			<div className={embedded ? "px-0 pb-0" : "flex-1 overflow-y-auto px-6 pb-6 min-h-0"} style={{ WebkitOverflowScrolling: "touch" }}>
				{(loading || appConfig.forceSkeletonView) && (
					<SkeletonTheme baseColor='var(--skeleton-base)' highlightColor='var(--skeleton-highlight)'>
						<AwardsTableSkeleton />
					</SkeletonTheme>
				)}

				{!loading && !appConfig.forceSkeletonView && !isHistoricalAwards && awardsData.filter((item) => item.receiver).length > 0 && (
					<div className='overflow-x-auto -mx-6 px-6'>
						<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
							<thead className='sticky top-0 z-10'>
								<tr className='bg-white/20'>
									<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Award Name</th>
									<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Receiver</th>
								</tr>
							</thead>
							<tbody>
								{awardsData
									.filter((item) => item.receiver)
									.map((item, index) => (
										<tr key={index} className='border-b border-white/10 hover:bg-white/5 transition-colors'>
											<td className='px-2 md:px-4 py-2 md:py-3 text-white text-xs md:text-sm'>{item.awardName}</td>
											<td className='px-2 md:px-4 py-2 md:py-3 text-left'>
												{item.receiver ? (
													<div className='flex flex-wrap gap-1 md:gap-2 justify-start'>
														{parseReceivers(item.receiver).map((playerName, playerIndex, players) => (
															<span key={playerIndex} className='inline-flex items-center'>
																<button
																	onClick={() => handlePlayerClick(playerName)}
																	onTouchStart={() => handlePlayerClick(playerName)}
																	className='text-white text-xs md:text-sm underline hover:text-dorkinians-yellow transition-colors cursor-pointer text-left'>
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

				{!loading && !appConfig.forceSkeletonView && isHistoricalAwards && historicalAwardsData.length > 0 && (() => {
					const groupedData: { season: string; awards: HistoricalAwardEntry[] }[] = [];
					let currentSeason = "";
					let currentGroup: HistoricalAwardEntry[] = [];

					historicalAwardsData.forEach((item) => {
						if ("type" in item && item.type === "season") {
							if (currentSeason && currentGroup.length > 0) {
								groupedData.push({ season: currentSeason, awards: currentGroup });
							}
							currentSeason = item.season;
							currentGroup = [];
						} else {
							currentGroup.push(item as HistoricalAwardEntry);
						}
					});
					if (currentSeason && currentGroup.length > 0) {
						groupedData.push({ season: currentSeason, awards: currentGroup });
					}

					return (
						<div className='overflow-x-auto -mx-6 px-6'>
							<table className='w-full bg-transparent' style={{ borderCollapse: "separate", borderSpacing: "0" }}>
								<thead className='sticky top-0 z-10'>
									<tr className='bg-white/20'>
										<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Award Name</th>
										<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Receiver</th>
									</tr>
								</thead>
								<tbody>
									{groupedData.map((group, groupIndex) => (
										<Fragment key={`group-${groupIndex}`}>
											<tr>
												<td colSpan={2} className='px-2 md:px-4 py-1 md:py-2 text-white font-bold text-sm md:text-base' style={{ backgroundColor: "rgba(255, 255, 255, 0.15)" }}>
													{group.season}
												</td>
											</tr>
											{group.awards.map((entry, awardIndex) => (
												<tr key={`award-${groupIndex}-${awardIndex}`} className='border-b border-white/10 hover:bg-white/5 transition-colors' style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}>
													<td className='px-2 md:px-4 py-2 md:py-3 text-white text-xs md:text-sm'>{entry.awardName}</td>
													<td className='px-2 md:px-4 py-2 md:py-3 text-left'>
														{entry.isPlayer ? (
															<button
																onClick={() => handlePlayerClick(entry.receiver)}
																onTouchStart={() => handlePlayerClick(entry.receiver)}
																className='text-white text-xs md:text-sm underline hover:text-dorkinians-yellow transition-colors cursor-pointer text-left block w-full'>
																{entry.receiver}
															</button>
														) : (
															<span className='text-white text-xs md:text-sm'>{entry.receiver}</span>
														)}
													</td>
												</tr>
											))}
											{groupIndex < groupedData.length - 1 && (
												<tr>
													<td colSpan={2} className='py-2' style={{ backgroundColor: "transparent" }}></td>
												</tr>
											)}
										</Fragment>
									))}
								</tbody>
							</table>
						</div>
					);
				})()}

				{!loading && !appConfig.forceSkeletonView && !isHistoricalAwards && awardsData.length === 0 && selectedSeason && (
					<div className='text-center mt-8'>
						<p className='text-sm md:text-base text-gray-300'>No award data available for {selectedSeason}.</p>
					</div>
				)}
				{!loading && !appConfig.forceSkeletonView && isHistoricalAwards && historicalAwardsData.length === 0 && (
					<div className='text-center mt-8'>
						<p className='text-sm md:text-base text-gray-300'>No historical award data available.</p>
					</div>
				)}
			</div>

			{showPopup && selectedPlayer && <AwardHistoryPopup playerName={selectedPlayer} onClose={handleClosePopup} />}
		</div>
	);
}
