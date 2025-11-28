"use client";

import { useState, useEffect, useRef } from "react";
import { Fragment } from "react";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { getCurrentSeasonFromStorage } from "@/lib/services/currentSeasonService";
import { useNavigationStore } from "@/lib/stores/navigation";
import LeagueResultsModal from "./LeagueResultsModal";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import { getDivisionValueFromMapping, getStandardizedDivisionName } from "@/config/divisionMapping";

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

interface TeamLeagueData {
	division: string;
	url: string;
	lastUpdated?: string;
	table: LeagueTableEntry[];
}

interface SeasonLeagueData {
	season: string;
	lastUpdated?: string;
	teams: {
		[key: string]: TeamLeagueData;
	};
}

interface PlayerSeasonTeam {
	season: string;
	team: string;
}

export default function LeagueInformation() {
	const containerRef = useRef<HTMLDivElement>(null);
	const { selectedPlayer } = useNavigationStore();
	const [seasons, setSeasons] = useState<string[]>([]);
	const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
	const [leagueData, setLeagueData] = useState<SeasonLeagueData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [selectedTeamKey, setSelectedTeamKey] = useState<string | null>(null);
	const [selectedTeamDisplayName, setSelectedTeamDisplayName] = useState<string | null>(null);
	const [playerSeasonsData, setPlayerSeasonsData] = useState<PlayerSeasonTeam[] | null>(null);
	const [isMySeasonsMode, setIsMySeasonsMode] = useState(false);
	const [mySeasonsLeagueData, setMySeasonsLeagueData] = useState<Map<string, SeasonLeagueData>>(new Map());
	const [loadingMySeasons, setLoadingMySeasons] = useState(false);
	const [isSeasonProgressMode, setIsSeasonProgressMode] = useState(false);
	const [seasonProgressData, setSeasonProgressData] = useState<Map<string, SeasonLeagueData>>(new Map());
	const [loadingSeasonProgress, setLoadingSeasonProgress] = useState(false);
	const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all");

	// Fetch available seasons on mount
	useEffect(() => {
		const fetchSeasons = async () => {
			try {
				const response = await fetch("/api/league-tables");
				if (response.ok) {
					const data = await response.json();
					const seasonsList = data.seasons || [];
					// Add 2019-20 season if it doesn't exist
					if (!seasonsList.includes("2019-20")) {
						seasonsList.push("2019-20");
						seasonsList.sort().reverse(); // Sort descending (most recent first)
					}
					setSeasons(seasonsList);
					
					// Load selected season from localStorage if available
					if (typeof window !== "undefined") {
						const savedSeason = localStorage.getItem("dorkinians-league-info-selected-season");
						if (savedSeason && (seasonsList.includes(savedSeason) || savedSeason === "my-seasons" || savedSeason === "season-progress")) {
							if (savedSeason === "my-seasons") {
								setIsMySeasonsMode(true);
								setSelectedSeason("my-seasons");
							} else if (savedSeason === "season-progress") {
								setIsSeasonProgressMode(true);
								setSelectedSeason("season-progress");
							} else {
								setIsMySeasonsMode(false);
								setIsSeasonProgressMode(false);
								setSelectedSeason(savedSeason);
							}
						} else if (seasonsList.length > 0) {
							// Select first season (most recent) by default if no saved selection
							setSelectedSeason(seasonsList[0]);
							localStorage.setItem("dorkinians-league-info-selected-season", seasonsList[0]);
						}
					} else if (seasonsList.length > 0) {
						// Select first season (most recent) by default
						setSelectedSeason(seasonsList[0]);
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Fetch player seasons data when selectedPlayer changes
	useEffect(() => {
		if (!selectedPlayer) {
			setPlayerSeasonsData(null);
			if (isMySeasonsMode) {
				setIsMySeasonsMode(false);
				// Load saved season from localStorage or default to first season
				if (typeof window !== "undefined") {
					const savedSeason = localStorage.getItem("dorkinians-league-info-selected-season");
					if (savedSeason && savedSeason !== "my-seasons" && seasons.includes(savedSeason)) {
						setSelectedSeason(savedSeason);
					} else if (seasons.length > 0) {
						setSelectedSeason(seasons[0]);
						localStorage.setItem("dorkinians-league-info-selected-season", seasons[0]);
					} else {
						setSelectedSeason(null);
					}
				} else if (seasons.length > 0) {
					setSelectedSeason(seasons[0]);
				}
			}
			return;
		}

		const fetchPlayerSeasons = async () => {
			try {
				const response = await fetch("/api/player-seasons-teams", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ playerName: selectedPlayer }),
				});

				if (response.ok) {
					const data = await response.json();
					setPlayerSeasonsData(data.playerSeasons || []);
				} else {
					console.error("Failed to fetch player seasons");
					setPlayerSeasonsData([]);
				}
			} catch (err) {
				console.error("Error fetching player seasons:", err);
				setPlayerSeasonsData([]);
			}
		};

		fetchPlayerSeasons();
	}, [selectedPlayer]);

	// Fetch league data when season changes (normal mode)
	useEffect(() => {
		if (!selectedSeason || isMySeasonsMode || isSeasonProgressMode) return;

		// Don't fetch data for 2019-20 season (abandoned due to Covid-19)
		if (selectedSeason === "2019-20") {
			setLoading(false);
			setError(null);
			setLeagueData(null);
			return;
		}

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
	}, [selectedSeason, isMySeasonsMode]);

	// Fetch league data for all player seasons when "My Seasons" mode is active
	useEffect(() => {
		if (!isMySeasonsMode || !playerSeasonsData || playerSeasonsData.length === 0) {
			return;
		}

		const fetchAllMySeasonsData = async () => {
			setLoadingMySeasons(true);
			setError(null);
			const newDataMap = new Map<string, SeasonLeagueData>();

			console.log("🔍 [My Seasons] Starting fetch for player seasons:", playerSeasonsData);

			try {
				// Fetch league data for each season
				const fetchPromises = playerSeasonsData.map(async ({ season, team }) => {
					if (season === "2019-20") {
						// Skip 2019-20 season
						return;
					}

					try {
						console.log(`📡 [My Seasons] Fetching league data for season: ${season}, team: ${team}`);
						const response = await fetch(`/api/league-tables?season=${encodeURIComponent(season)}`);
						if (response.ok) {
							const data = await response.json();
							console.log(`✅ [My Seasons] Received data for season ${season}:`, {
								hasData: !!data.data,
								seasonInData: data.data?.season,
								teamsInData: data.data?.teams ? Object.keys(data.data.teams) : [],
								requestedTeam: team,
								hasRequestedTeam: data.data?.teams ? team in data.data.teams : false,
							});
							if (data.data) {
								// Normalize season format for consistent map key (ensure hyphen format)
								const normalizedSeason = season.replace("/", "-");
								newDataMap.set(normalizedSeason, data.data);
								console.log(`💾 [My Seasons] Stored data with key: ${normalizedSeason}`);
							} else {
								console.warn(`⚠️ [My Seasons] No data.data for season ${season}`);
							}
						} else {
							console.error(`❌ [My Seasons] Failed to fetch season ${season}:`, response.status, response.statusText);
						}
					} catch (err) {
						console.error(`Error fetching league data for season ${season}:`, err);
					}
				});

				await Promise.all(fetchPromises);
				console.log("🗺️ [My Seasons] Final data map:", {
					mapSize: newDataMap.size,
					mapKeys: Array.from(newDataMap.keys()),
					mapContents: Array.from(newDataMap.entries()).map(([key, value]) => ({
						season: key,
						teams: Object.keys(value.teams || {}),
					})),
				});
				setMySeasonsLeagueData(newDataMap);
			} catch (err) {
				console.error("Error fetching my seasons data:", err);
				setError("Error loading my seasons data");
			} finally {
				setLoadingMySeasons(false);
			}
		};

		fetchAllMySeasonsData();
	}, [isMySeasonsMode, playerSeasonsData]);

	// Fetch league data for all seasons when "Season Progress" mode is active
	useEffect(() => {
		if (!isSeasonProgressMode || seasons.length === 0) {
			return;
		}

		const fetchAllSeasonsData = async () => {
			setLoadingSeasonProgress(true);
			setError(null);
			const newDataMap = new Map<string, SeasonLeagueData>();

			try {
				// Fetch league data for each season
				const fetchPromises = seasons.map(async (season) => {
					if (season === "2019-20") {
						// Skip 2019-20 season
						return;
					}

					try {
						const response = await fetch(`/api/league-tables?season=${encodeURIComponent(season)}`);
						if (response.ok) {
							const data = await response.json();
							if (data.data) {
								// Normalize season format for consistent map key (ensure hyphen format)
								const normalizedSeason = season.replace("/", "-");
								newDataMap.set(normalizedSeason, data.data);
							}
						}
					} catch (err) {
						console.error(`Error fetching league data for season ${season}:`, err);
					}
				});

				await Promise.all(fetchPromises);
				setSeasonProgressData(newDataMap);
			} catch (err) {
				console.error("Error fetching season progress data:", err);
				setError("Error loading season progress data");
			} finally {
				setLoadingSeasonProgress(false);
			}
		};

		fetchAllSeasonsData();
	}, [isSeasonProgressMode, seasons]);

	// Format season for display (2019-20 -> 2019/20)
	const formatSeason = (season: string) => {
		return season.replace("-", "/");
	};

	// Check if selected season is the current season
	const isCurrentSeason = (selectedSeason: string | null): boolean => {
		if (!selectedSeason) return false;
		const currentSeason = getCurrentSeasonFromStorage();
		if (!currentSeason) return false;
		// Normalize formats: API returns "YYYY-YY", currentSeason is "YYYY/YY"
		const normalizedSelected = formatSeason(selectedSeason);
		return normalizedSelected === currentSeason;
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
			"8s": "8th XI",
		};
		return teamMap[teamKey] || teamKey;
	};

	// Convert team display name to team key (reverse of getTeamDisplayName)
	const getTeamKeyFromDisplayName = (teamDisplayName: string): string => {
		const teamNameLower = teamDisplayName.toLowerCase().trim();
		const reverseMap: { [key: string]: string } = {
			"1st xi": "1s",
			"2nd xi": "2s",
			"3rd xi": "3s",
			"4th xi": "4s",
			"5th xi": "5s",
			"6th xi": "6s",
			"7th xi": "7s",
			"8th xi": "8s",
		};
		return reverseMap[teamNameLower] || teamDisplayName;
	};

	// Map division names to numeric values for chart Y-axis
	// Uses the configurable mapping file first, then falls back to default logic
	// Note: 1 = top division, higher numbers = lower divisions
	const getDivisionValue = (division: string): number => {
		if (!division || division.trim() === "") return 0;
		
		// First try the configurable mapping
		const mappedValue = getDivisionValueFromMapping(division);
		if (mappedValue !== null) {
			return mappedValue;
		}
		
		// Fallback: try to extract number from division name
		// For numbered divisions, use the number directly (higher number = lower division)
		const divisionLower = division.toLowerCase().trim();
		const numberMatch = divisionLower.match(/(\d+)/);
		if (numberMatch) {
			const num = parseInt(numberMatch[1], 10);
			// Use number directly, but ensure it's at least 1
			// Higher numbers = lower divisions, so we'll use the number as-is
			return Math.max(1, num);
		}
		
		return 0;
	};

	// Get division name from numeric value (for Y-axis labels)
	// Uses standardized names from mapping config
	const getDivisionName = (value: number): string => {
		return getStandardizedDivisionName(value);
	};

	// Find Dorkinians position in a team's table
	const findDorkiniansPosition = (teamData: TeamLeagueData, teamKey: string): number | null => {
		if (!teamData || !teamData.table || teamData.table.length === 0) {
			return null;
		}

		const matchesThisTeam = (entryTeam: string): boolean => {
			const entryTeamLower = entryTeam.toLowerCase().trim();
			if (!entryTeamLower.includes("dorkinians")) return false;
			
			if (teamKey === "1s") {
				return entryTeamLower === "dorkinians" || entryTeamLower.startsWith("dorkinians ");
			}
			
			const matchPatterns: { [key: string]: string[] } = {
				"2s": ["2nd", "ii"],
				"3s": ["3rd", "iii"],
				"4s": ["4th", "iv"],
				"5s": ["5th", "v"],
				"6s": ["6th", "vi"],
				"7s": ["7th", "vii"],
				"8s": ["8th", "viii"],
			};
			const patterns = matchPatterns[teamKey];
			if (patterns) {
				return patterns.some(pattern => entryTeamLower.includes(pattern));
			}
			
			return false;
		};

		const dorkiniansEntry = teamData.table.find(entry => matchesThisTeam(entry.team));
		return dorkiniansEntry ? dorkiniansEntry.position : null;
	};

	// Transform season data into chart format
	const transformDataForChart = () => {
		const teamKeys = ["1s", "2s", "3s", "4s", "5s", "6s", "7s", "8s"];
		const validSeasons = Array.from(seasonProgressData.keys())
			.filter(season => season !== "2019-20")
			.sort(); // Sort seasons chronologically

		// Create data points for each season
		const chartData = validSeasons.map(season => {
			const seasonData = seasonProgressData.get(season);
			const dataPoint: any = {
				season: formatSeason(season),
			};

			// For each team, add division value and position
			teamKeys.forEach(teamKey => {
				if (seasonData && seasonData.teams[teamKey]) {
					const teamData = seasonData.teams[teamKey];
					const divisionValue = getDivisionValue(teamData.division);
					const position = findDorkiniansPosition(teamData, teamKey);
					
					dataPoint[`${teamKey}_division`] = divisionValue;
					dataPoint[`${teamKey}_position`] = position;
				} else {
					dataPoint[`${teamKey}_division`] = null;
					dataPoint[`${teamKey}_position`] = null;
				}
			});

			return dataPoint;
		});

		return chartData;
	};

	// Scroll to top function
	const scrollToTop = () => {
		// Find the scrollable parent container (parent motion.div with overflow-y-auto)
		if (containerRef.current) {
			let parent = containerRef.current.parentElement;
			while (parent) {
				if (parent.classList.contains('overflow-y-auto') && parent.scrollHeight > parent.clientHeight) {
					parent.scrollTo({ top: 0, behavior: "smooth" });
					return;
				}
				parent = parent.parentElement;
			}
		}
		// Fallback to window scroll
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	// Handle show results button click
	const handleShowResults = (teamKey: string) => {
		setSelectedTeamKey(teamKey);
		setSelectedTeamDisplayName(getTeamDisplayName(teamKey));
		setIsModalOpen(true);
	};

	// Handle modal close
	const handleCloseModal = () => {
		setIsModalOpen(false);
		setSelectedTeamKey(null);
		setSelectedTeamDisplayName(null);
	};

	// Handle season selection change
	const handleSeasonChange = (newSeason: string) => {
		if (newSeason === "my-seasons") {
			setIsMySeasonsMode(true);
			setIsSeasonProgressMode(false);
			setSelectedSeason("my-seasons");
		} else if (newSeason === "season-progress") {
			setIsSeasonProgressMode(true);
			setIsMySeasonsMode(false);
			setSelectedSeason("season-progress");
		} else {
			setIsMySeasonsMode(false);
			setIsSeasonProgressMode(false);
			setSelectedSeason(newSeason);
		}
		
		// Save to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-league-info-selected-season", newSeason);
		}
	};

	return (
		<div ref={containerRef} className='px-3 md:px-6 py-6 overflow-y-auto'>
		<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-4 text-center'>
			League Information
		</h2>

		{/* Season Selector */}
			<div className='mb-6'>
				{seasons.length > 0 && (
					<Listbox
						value={selectedSeason || ""}
						onChange={handleSeasonChange}
						disabled={loading || seasons.length === 0}>
						<div className='relative'>
							<Listbox.Button className='relative w-full cursor-default dark-dropdown py-3 pl-4 pr-10 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-sm md:text-base'>
								<span className={`block truncate ${selectedSeason ? "text-white" : "text-yellow-300"}`}>
									{selectedSeason === "my-seasons" 
										? "My Seasons" 
										: selectedSeason === "season-progress"
											? "Season Progress"
											: selectedSeason 
												? formatSeason(selectedSeason) 
												: "Select season..."}
								</span>
								<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
									<ChevronUpDownIcon className='h-5 w-5 text-yellow-300' aria-hidden='true' />
								</span>
							</Listbox.Button>
							<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-sm md:text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
								{/* Season Progress option - always visible */}
								<Listbox.Option
									key="season-progress"
									className={({ active }) =>
										`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
									}
									value="season-progress">
									{({ selected }) => (
										<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
											Season Progress
										</span>
									)}
								</Listbox.Option>
								{/* My Seasons option - only show if player is selected and has seasons */}
								{selectedPlayer && playerSeasonsData && playerSeasonsData.length > 0 && (
									<Listbox.Option
										key="my-seasons"
										className={({ active }) =>
											`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
										}
										value="my-seasons">
										{({ selected }) => (
											<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
												My Seasons
											</span>
										)}
									</Listbox.Option>
								)}
								{seasons.map((season) => (
									<Listbox.Option
										key={season}
										className={({ active }) =>
											`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
										}
										value={season}>
										{({ selected }) => (
											<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
												{formatSeason(season)}
											</span>
										)}
									</Listbox.Option>
								))}
							</Listbox.Options>
						</div>
					</Listbox>
				)}
				{/* Description for My Seasons mode */}
				{isMySeasonsMode && (
					<p className='text-white text-sm md:text-base mt-2 pt-2 text-center'>
						Displays the position the team that you played for most that season finished in
					</p>
				)}
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

			{/* Covid-19 Message for 2019/20 Season */}
			{!loading && !error && selectedSeason === "2019-20" && !isMySeasonsMode && (
				<div className='text-center text-gray-300 py-8'>
					League seasons were abandoned due to Covid-19 during this season
				</div>
			)}

			{/* My Seasons Display */}
			{isMySeasonsMode && !loadingMySeasons && !error && playerSeasonsData && playerSeasonsData.length > 0 && (
				<div className='space-y-8'>
					{playerSeasonsData.map(({ season, team }, seasonIndex) => {
						// Skip 2019-20 season
						if (season === "2019-20") {
							return null;
						}

						// Normalize season format for consistent lookup (ensure hyphen format)
						const normalizedSeason = season.replace("/", "-");
						// Convert team display name to team key (e.g., "3rd XI" -> "3s")
						const teamKey = getTeamKeyFromDisplayName(team);
						console.log(`🔎 [My Seasons] Looking up data for season: ${season} (normalized: ${normalizedSeason}), team: ${team} (key: ${teamKey})`);
						const seasonData = mySeasonsLeagueData.get(normalizedSeason);
						if (!seasonData) {
							console.warn(`⚠️ [My Seasons] No season data found for season: ${normalizedSeason}. Available seasons:`, Array.from(mySeasonsLeagueData.keys()));
							return (
								<div key={season} className='text-center text-gray-400 py-4'>
									No league table data available for {formatSeason(season)}
								</div>
							);
						}

						console.log(`🔎 [My Seasons] Season data found. Available teams:`, Object.keys(seasonData.teams || {}), `Looking for team key: ${teamKey}`);
						
						// Get team data using the normalized team key
						const teamData = seasonData.teams[teamKey];
						
						if (!teamData) {
							console.warn(`⚠️ [My Seasons] No team data found for team: ${team} (key: ${teamKey}) in season: ${normalizedSeason}. Available teams:`, Object.keys(seasonData.teams || {}));
							return (
								<div key={season} className='text-center text-gray-400 py-4'>
									No league table data for {getTeamDisplayName(teamKey)} in {formatSeason(season)}
								</div>
							);
						}

						const hasTableData = teamData && teamData.table && teamData.table.length > 0;
						const dorkiniansEntry = hasTableData ? teamData.table.find((entry) =>
							entry.team.toLowerCase().includes("dorkinians"),
						) : null;
						const currentSeason = isCurrentSeason(season);
						const teamDisplayName = getTeamDisplayName(teamKey);

						// Function to check if entry matches this team
						const matchesThisTeam = (entryTeam: string): boolean => {
							const entryTeamLower = entryTeam.toLowerCase().trim();
							if (!entryTeamLower.includes("dorkinians")) return false;
							
							if (teamKey === "1s") {
								return entryTeamLower === "dorkinians" || entryTeamLower.startsWith("dorkinians ");
							}
							
							// Map team keys to both ordinals and Roman numerals
							const matchPatterns: { [key: string]: string[] } = {
								"2s": ["2nd", "ii"],
								"3s": ["3rd", "iii"],
								"4s": ["4th", "iv"],
								"5s": ["5th", "v"],
								"6s": ["6th", "vi"],
								"7s": ["7th", "vii"],
								"8s": ["8th", "viii"],
							};
							const patterns = matchPatterns[teamKey];
							if (patterns) {
								// Check if entry contains any of the matching patterns
								return patterns.some(pattern => entryTeamLower.includes(pattern));
							}
							
							return false;
						};

						return (
							<Fragment key={season}>
								<div className='w-full'>
									<div className='text-center mb-2'>
										<div className='text-lg md:text-xl font-bold text-white mb-1'>
											{formatSeason(season)}
										</div>
										<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow'>
											{teamDisplayName}
											{teamData.division && teamData.division.trim() !== '' && (
												<span className='ml-2 text-base text-gray-300 font-normal'>
													{teamData.division}
												</span>
											)}
										</h3>
									</div>
									{currentSeason && teamData.lastUpdated && (
										<div className='text-center text-sm text-gray-400 mb-2'>
											Last updated: {new Date(teamData.lastUpdated).toLocaleDateString()}
										</div>
									)}
									{dorkiniansEntry && (
										<div className='text-center text-sm text-gray-400 mb-4'>
											{currentSeason ? "Currently" : "Finished"} {dorkiniansEntry.position}
											{dorkiniansEntry.position === 1
												? "st"
												: dorkiniansEntry.position === 2
													? "nd"
													: dorkiniansEntry.position === 3
														? "rd"
														: "th"}
										</div>
									)}

									{hasTableData ? (
										<div className='overflow-x-auto -mx-3 md:-mx-6 px-3 md:px-6'>
											<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
												<thead className='sticky top-0 z-10'>
													<tr className='bg-white/20'>
														<th className='w-8 px-1.5 py-2 text-left text-white font-semibold text-[10px] md:text-xs'></th>
														<th className='px-2 py-2 text-left text-white font-semibold text-xs md:text-sm'>Team</th>
														<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>P</th>
														<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>W</th>
														<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>D</th>
														<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>L</th>
														<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>F</th>
														<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>A</th>
														<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>GD</th>
														<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>Pts</th>
													</tr>
												</thead>
												<tbody>
													{teamData.table.map((entry, index) => {
														const isThisDorkiniansTeam = matchesThisTeam(entry.team);
														return (
															<tr
																key={index}
																className={`border-b border-white/10 transition-colors ${
																	isThisDorkiniansTeam
																		? "bg-dorkinians-yellow/20 font-semibold"
																		: index % 2 === 0
																			? "bg-gray-800/30"
																			: ""
																} hover:bg-white/5`}
															>
																<td className='px-1.5 py-2 text-white text-[10px] md:text-xs'>{entry.position}</td>
																<td className='px-2 py-2 text-white text-xs md:text-sm'>{entry.team}</td>
																<td className='px-2 py-2 text-center text-white text-xs md:text-sm'>{entry.played}</td>
																<td className='px-2 py-2 text-center text-white text-xs md:text-sm'>{entry.won}</td>
																<td className='px-2 py-2 text-center text-white text-xs md:text-sm'>{entry.drawn}</td>
																<td className='px-2 py-2 text-center text-white text-xs md:text-sm'>{entry.lost}</td>
																<td className='px-2 py-2 text-center text-white text-xs md:text-sm'>{entry.goalsFor}</td>
																<td className='px-2 py-2 text-center text-white text-xs md:text-sm'>{entry.goalsAgainst}</td>
																<td className='px-2 py-2 text-center text-white text-xs md:text-sm'>{entry.goalDifference}</td>
																<td className='px-2 py-2 text-center font-semibold text-dorkinians-yellow text-xs md:text-sm'>
																	{entry.points}
																</td>
															</tr>
														);
													})}
												</tbody>
											</table>
										</div>
									) : (
										<div className='text-center text-gray-300 py-4 mb-4'>
											No table data available. Team was removed from the league.
										</div>
									)}
									{/* League Table Link and Show Results */}
									{(teamData.url && teamData.url.trim() !== '' || season) && (
										<div className='mt-4 text-center'>
											{teamData.url && teamData.url.trim() !== '' && (
												<>
													<a
														href={teamData.url}
														target='_blank'
														rel='noopener noreferrer'
														className='text-dorkinians-yellow hover:text-yellow-400 underline text-sm md:text-base transition-colors'
													>
														League Table Link
													</a>
													{season && <span className='text-dorkinians-yellow mx-2'>|</span>}
												</>
											)}
											{season && (
												<button
													onClick={() => {
														setSelectedTeamKey(teamKey);
														setSelectedTeamDisplayName(teamDisplayName);
														setSelectedSeason(season);
														setIsModalOpen(true);
													}}
													className='text-dorkinians-yellow hover:text-yellow-400 underline text-sm md:text-base transition-colors bg-transparent border-none cursor-pointer'>
													Show Results
												</button>
											)}
										</div>
									)}
								</div>
								{seasonIndex < playerSeasonsData.length - 1 && (
									<hr className='border-t border-white/20 my-8' />
								)}
							</Fragment>
						);
					})}
				</div>
			)}

			{/* Loading state for My Seasons */}
			{isMySeasonsMode && loadingMySeasons && (
				<div className='flex justify-center py-8'>
					<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-dorkinians-yellow'></div>
				</div>
			)}

			{/* Loading state for Season Progress */}
			{isSeasonProgressMode && loadingSeasonProgress && (
				<div className='flex justify-center py-8'>
					<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-dorkinians-yellow'></div>
				</div>
			)}

			{/* Season Progress Chart */}
			{isSeasonProgressMode && !loadingSeasonProgress && !error && seasonProgressData.size > 0 && (() => {
				const chartData = transformDataForChart();
				const teamKeys = ["1s", "2s", "3s", "4s", "5s", "6s", "7s", "8s"];
				const teamColors = [
					"#f9ed32", // 1s - yellow
					"#3b82f6", // 2s - blue
					"#10b981", // 3s - green
					"#f59e0b", // 4s - orange
					"#ef4444", // 5s - red
					"#8b5cf6", // 6s - purple
					"#ec4899", // 7s - pink
					"#06b6d4", // 8s - cyan
				];

				// Build a mapping of division values to actual division names from the data
				const divisionValueToName = new Map<number, string>();
				Array.from(seasonProgressData.entries()).forEach(([season, seasonData]) => {
					teamKeys.forEach(teamKey => {
						if (seasonData.teams[teamKey]) {
							const teamData = seasonData.teams[teamKey];
							const divValue = getDivisionValue(teamData.division);
							if (divValue > 0 && teamData.division && teamData.division.trim() !== "") {
								// Use actual division name from data, or fall back to mapped name
								divisionValueToName.set(divValue, teamData.division);
							}
						}
					});
				});

				// Custom tooltip
				const CustomTooltip = ({ active, payload }: any) => {
					if (active && payload && payload.length) {
						const data = payload[0].payload;
						return (
							<div className='bg-gray-800 border border-yellow-400/30 rounded-lg p-3 shadow-lg'>
								<p className='text-yellow-300 font-semibold mb-2'>{data.season}</p>
								{payload.map((entry: any, index: number) => {
									const teamKey = teamKeys[index];
									const divisionValue = data[`${teamKey}_division`];
									const position = data[`${teamKey}_position`];
									if (divisionValue === null || divisionValue === undefined) return null;
									const divisionName = divisionValueToName.get(divisionValue) || getDivisionName(divisionValue) || `Division ${divisionValue}`;
									return (
										<p key={teamKey} className='text-white text-sm'>
											<span style={{ color: entry.color }} className='font-semibold'>
												{getTeamDisplayName(teamKey)}:
											</span>{" "}
											{divisionName}
											{position !== null && position !== undefined && (
												<span className='text-gray-300'> (Position: {position})</span>
											)}
										</p>
									);
								})}
							</div>
						);
					}
					return null;
				};

				// Custom label for position - receives the data point
				const CustomLabel = (props: any) => {
					const { x, y, payload } = props;
					if (!payload) return null;
					
					// Find which team this label is for by checking which division value exists
					for (const teamKey of teamKeys) {
						const divisionValue = payload[`${teamKey}_division`];
						const position = payload[`${teamKey}_position`];
						if (divisionValue !== null && divisionValue !== undefined && position !== null && position !== undefined) {
							// Check if this is the right point (compare y position)
							const expectedY = y; // This will be calculated by Recharts
							return (
								<text
									x={x}
									y={y - 8}
									fill="#fff"
									fontSize={10}
									textAnchor="middle"
									className="font-semibold"
									style={{ pointerEvents: 'none' }}
								>
									{position}
								</text>
							);
						}
					}
					return null;
				};

				// Y-axis formatter - standardized format: "Prem" for value 1, "Div X" for others
				const formatYAxis = (value: number) => {
					if (value === 1) {
						return "Prem";
					}
					return `Div ${value}`;
				};

				// Get all unique division values for Y-axis domain
				// Note: 1 = top division, higher numbers = lower divisions
				const allDivisionValues = new Set<number>();
				chartData.forEach(data => {
					teamKeys.forEach(teamKey => {
						const value = data[`${teamKey}_division`];
						if (value !== null && value !== undefined && value > 0) {
							allDivisionValues.add(value);
						}
					});
				});
				// Sort ascending (1 = top division, higher numbers = lower divisions)
				const divisionValues = Array.from(allDivisionValues).sort((a, b) => a - b);
				// Y-axis domain: normal range (will be reversed so 1 appears at top)
				const minValue = divisionValues.length > 0 ? Math.min(...divisionValues) : 1;
				const maxValue = divisionValues.length > 0 ? Math.max(...divisionValues) : 10;
				const yAxisDomain = [minValue - 0.5, maxValue + 0.5];
				
				// Create explicit ticks for Y-axis (sorted ascending: 1, 2, 3...)
				// The reversed prop will display them with 1 at top
				const yAxisTicks = divisionValues.length > 0 ? divisionValues : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

				return (
					<div className='bg-white/10 backdrop-blur-sm rounded-lg p-4 md:p-6 mb-4'>
						<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-4 text-center'>
							Season Progress
						</h3>
						{/* Team Filter Dropdown */}
						<div className='mb-4 flex justify-center'>
							<Listbox value={selectedTeamFilter} onChange={setSelectedTeamFilter}>
								<div className='relative w-full max-w-xs'>
									<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-4 pr-10 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-sm md:text-base'>
										<span className='block truncate text-white'>
											{selectedTeamFilter === "all" ? "All Teams" : getTeamDisplayName(selectedTeamFilter)}
										</span>
										<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
											<ChevronUpDownIcon className='h-5 w-5 text-yellow-300' aria-hidden='true' />
										</span>
									</Listbox.Button>
									<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-sm md:text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
										<Listbox.Option
											key="all"
											className={({ active }) =>
												`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
											}
											value="all">
											{({ selected }) => (
												<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
													All Teams
												</span>
											)}
										</Listbox.Option>
										{teamKeys.map((teamKey) => (
											<Listbox.Option
												key={teamKey}
												className={({ active }) =>
													`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
												}
												value={teamKey}>
												{({ selected }) => (
													<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
														{getTeamDisplayName(teamKey)}
													</span>
												)}
											</Listbox.Option>
										))}
									</Listbox.Options>
								</div>
							</Listbox>
						</div>
						<div className='-mx-4 md:-mx-6 pl-2 pb-0'>
							<ResponsiveContainer width="100%" height={500}>
							<LineChart data={chartData} margin={{ top: 20, right: 30, left: -60, bottom: 10 }}>
								<CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
								<XAxis 
									dataKey="season" 
									stroke="#fff" 
									fontSize={12}
									angle={-45}
									textAnchor="end"
									height={80}
									tick={{ fill: '#fff' }}
								/>
								<YAxis 
									stroke="#fff" 
									fontSize={12}
									domain={yAxisDomain}
									tickFormatter={formatYAxis}
									width={100}
									ticks={yAxisTicks}
									tick={{ fill: '#fff', fontSize: 11 }}
									allowDecimals={false}
									reversed={true}
									axisLine={false}
									tickLine={false}
								/>
								<Tooltip content={<CustomTooltip />} />
								<Legend 
									wrapperStyle={{ 
										paddingTop: "10px",
										paddingBottom: "5px",
										backgroundColor: "rgba(255, 255, 255, 0.15)",
										borderRadius: "4px",
										textAlign: "center",
										paddingLeft: "10px",
										paddingRight: "10px"
									}}
									iconType="line"
									formatter={(value) => getTeamDisplayName(value.replace("_division", ""))}
									align="center"
								/>
								{teamKeys
									.filter(teamKey => selectedTeamFilter === "all" || selectedTeamFilter === teamKey)
									.map((teamKey, index) => {
										// Create a custom label component for this specific team
										const TeamLabel = (props: any) => {
											const { x, y, value } = props;
											// value is the position from dataKey
											if (value === null || value === undefined) return null;
											return (
												<text
													x={x}
													y={y - 8}
													fill="#fff"
													fontSize={10}
													textAnchor="middle"
													className="font-semibold"
													style={{ pointerEvents: 'none' }}
												>
													{value}
												</text>
											);
										};

										// Get the actual index for color (not filtered index)
										const actualIndex = teamKeys.indexOf(teamKey);

										return (
											<Line
												key={teamKey}
												type="monotone"
												dataKey={`${teamKey}_division`}
												stroke={teamColors[actualIndex]}
												strokeWidth={2}
											dot={(props: any) => {
												// Only show dot if value is not null/undefined
												if (props.payload[`${teamKey}_division`] === null || props.payload[`${teamKey}_division`] === undefined) {
													return <g />;
												}
												return <circle cx={props.cx} cy={props.cy} r={4} fill={teamColors[actualIndex]} />;
											}}
												activeDot={{ r: 6 }}
												connectNulls={true}
												name={teamKey}
											>
												<LabelList 
													dataKey={`${teamKey}_position`}
													content={<TeamLabel />}
												/>
											</Line>
										);
									})}
							</LineChart>
						</ResponsiveContainer>
						</div>
					</div>
				);
			})()}

			{/* No data message for Season Progress */}
			{isSeasonProgressMode && !loadingSeasonProgress && !error && seasonProgressData.size === 0 && (
				<div className='text-center text-gray-300 py-8'>
					No season progress data available
				</div>
			)}

			{/* League Tables (Normal Mode) */}
			{!isMySeasonsMode && !isSeasonProgressMode && !loading && !error && leagueData && selectedSeason !== "2019-20" && (
				<div className='space-y-8'>
				{/* Display tables for each team */}
				{(() => {
					const allTeams = Object.entries(leagueData.teams);
					return allTeams.map(([teamKey, teamData], teamIndex) => {
						const hasTableData = teamData && teamData.table && teamData.table.length > 0;
						
						// Find Dorkinians position (only if table data exists)
						const dorkiniansEntry = hasTableData ? teamData.table.find((entry) =>
							entry.team.toLowerCase().includes("dorkinians"),
						) : null;
						const currentSeason = isCurrentSeason(selectedSeason);

						// Get the team display name for matching
						const teamDisplayName = getTeamDisplayName(teamKey);
						
						// Function to check if entry matches this team
						const matchesThisTeam = (entryTeam: string): boolean => {
							const entryTeamLower = entryTeam.toLowerCase().trim();
							if (!entryTeamLower.includes("dorkinians")) return false;
							
							// For 1st XI, match "Dorkinians" (without ordinal or Roman numeral)
							if (teamKey === "1s") {
								return entryTeamLower === "dorkinians" || entryTeamLower.startsWith("dorkinians ");
							}
							
							// For other teams, match both ordinals (2nd, 3rd, 4th, etc.) and Roman numerals (II, III, IV, etc.)
							const matchPatterns: { [key: string]: string[] } = {
								"2s": ["2nd", "ii"],
								"3s": ["3rd", "iii"],
								"4s": ["4th", "iv"],
								"5s": ["5th", "v"],
								"6s": ["6th", "vi"],
								"7s": ["7th", "vii"],
								"8s": ["8th", "viii"],
							};
							const patterns = matchPatterns[teamKey];
							if (patterns) {
								// Check if entry contains any of the matching patterns
								return patterns.some(pattern => entryTeamLower.includes(pattern));
							}
							
							return false;
						};
						
						return (
							<Fragment key={teamKey}>
							<div className='w-full'>
								<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-2 text-center'>
									{teamDisplayName}
									{teamData.division && teamData.division.trim() !== '' && (
										<span className='ml-2 text-base text-gray-300 font-normal'>
											{teamData.division}
										</span>
									)}
								</h3>
								{currentSeason && teamData.lastUpdated && (
									<div className='text-center text-sm text-gray-400 mb-2'>
										Last updated: {new Date(teamData.lastUpdated).toLocaleDateString()}
									</div>
								)}
								{dorkiniansEntry && (
									<div className='text-center text-sm text-gray-400 mb-4'>
										{currentSeason ? "Currently" : "Finished"} {dorkiniansEntry.position}
										{dorkiniansEntry.position === 1
											? "st"
											: dorkiniansEntry.position === 2
												? "nd"
												: dorkiniansEntry.position === 3
													? "rd"
													: "th"}
									</div>
								)}

								{hasTableData ? (
									<div className='overflow-x-auto -mx-3 md:-mx-6 px-3 md:px-6'>
										<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
											<thead className='sticky top-0 z-10'>
												<tr className='bg-white/20'>
													<th className='w-8 px-1.5 py-2 text-left text-white font-semibold text-[10px] md:text-xs'></th>
													<th className='px-2 py-2 text-left text-white font-semibold text-xs md:text-sm'>Team</th>
													<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>P</th>
													<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>W</th>
													<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>D</th>
													<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>L</th>
													<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>F</th>
													<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>A</th>
													<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>GD</th>
													<th className='px-2 py-2 text-center text-white font-semibold text-xs md:text-sm'>Pts</th>
												</tr>
											</thead>
											<tbody>
												{teamData.table.map((entry, index) => {
													// Only highlight the Dorkinians team that matches this teamKey
													const isThisDorkiniansTeam = matchesThisTeam(entry.team);
													return (
														<tr
															key={index}
															className={`border-b border-white/10 transition-colors ${
																isThisDorkiniansTeam
																	? "bg-dorkinians-yellow/20 font-semibold"
																	: index % 2 === 0
																		? "bg-gray-800/30"
																		: ""
															} hover:bg-white/5`}
														>
															<td className='px-1.5 py-2 text-white text-[10px] md:text-xs'>{entry.position}</td>
															<td className='px-2 py-2 text-white text-xs md:text-sm'>{entry.team}</td>
															<td className='px-2 py-2 text-center text-white text-xs md:text-sm'>{entry.played}</td>
															<td className='px-2 py-2 text-center text-white text-xs md:text-sm'>{entry.won}</td>
															<td className='px-2 py-2 text-center text-white text-xs md:text-sm'>{entry.drawn}</td>
															<td className='px-2 py-2 text-center text-white text-xs md:text-sm'>{entry.lost}</td>
															<td className='px-2 py-2 text-center text-white text-xs md:text-sm'>{entry.goalsFor}</td>
															<td className='px-2 py-2 text-center text-white text-xs md:text-sm'>{entry.goalsAgainst}</td>
															<td className='px-2 py-2 text-center text-white text-xs md:text-sm'>{entry.goalDifference}</td>
															<td className='px-2 py-2 text-center font-semibold text-dorkinians-yellow text-xs md:text-sm'>
																{entry.points}
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								) : (
									<div className='text-center text-gray-300 py-4 mb-4'>
										No table data available. Team was removed from the league.
									</div>
								)}
								{/* League Table Link and Show Results - shown per team */}
								{(teamData.url && teamData.url.trim() !== '' || selectedSeason) && (
									<div className='mt-4 text-center'>
										{teamData.url && teamData.url.trim() !== '' && (
											<>
												<a
													href={teamData.url}
													target='_blank'
													rel='noopener noreferrer'
													className='text-dorkinians-yellow hover:text-yellow-400 underline text-sm md:text-base transition-colors'
												>
													League Table Link
												</a>
												{selectedSeason && <span className='text-dorkinians-yellow mx-2'>|</span>}
											</>
										)}
										{selectedSeason && (
											<button
												onClick={() => handleShowResults(teamKey)}
												className='text-dorkinians-yellow hover:text-yellow-400 underline text-sm md:text-base transition-colors bg-transparent border-none cursor-pointer'>
												Show Results
											</button>
										)}
									</div>
								)}
							</div>
							{teamIndex < allTeams.length - 1 && (
								<hr className='border-t border-white/20 my-8' />
							)}
						</Fragment>
						);
					});
				})()}

					{/* No teams message */}
					{Object.keys(leagueData.teams).length === 0 && (
						<div className='text-center text-gray-400 py-8'>
							No league table data available for this season
						</div>
					)}
				</div>
			)}

			{/* Back to Top Button - Only show when content is loaded, but not in Season Progress mode */}
			{!loading && !loadingMySeasons && !loadingSeasonProgress && !error && !isSeasonProgressMode && (leagueData || selectedSeason === "2019-20" || (isMySeasonsMode && playerSeasonsData && playerSeasonsData.length > 0)) && (
				<div className='mt-8 flex justify-center'>
					<button
						onClick={scrollToTop}
						className='px-4 py-2 bg-dorkinians-yellow text-black text-sm font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors'>
						Back to Top
					</button>
				</div>
			)}

			{/* League Results Modal */}
			{selectedTeamKey && selectedTeamDisplayName && selectedSeason && selectedSeason !== "my-seasons" && (
				<LeagueResultsModal
					isOpen={isModalOpen}
					onClose={handleCloseModal}
					teamKey={selectedTeamKey}
					teamDisplayName={selectedTeamDisplayName}
					season={selectedSeason}
				/>
			)}
		</div>
	);
}

