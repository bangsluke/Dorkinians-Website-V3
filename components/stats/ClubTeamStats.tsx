"use client";

import { useNavigationStore, type TeamData } from "@/lib/stores/navigation";
import { statObject, statsPageConfig } from "@/config/config";
import Image from "next/image";
import { useState, useMemo, useEffect, useRef } from "react";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import FilterPills from "@/components/filters/FilterPills";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";


interface TopPlayer {
	playerName: string;
	appearances: number;
	goals: number;
	assists: number;
	cleanSheets: number;
	mom: number;
	penaltiesScored: number;
	saves: number;
	yellowCards: number;
	redCards: number;
	fantasyPoints: number;
	goalInvolvements: number;
	homeGames: number;
	awayGames: number;
	minutes: number;
	ownGoals: number;
	conceded: number;
	penaltiesMissed: number;
	penaltiesConceded: number;
	penaltiesSaved: number;
	distance: number;
}

type StatType = "appearances" | "goals" | "assists" | "cleanSheets" | "mom" | "saves" | "yellowCards" | "redCards" | "penaltiesScored" | "fantasyPoints" | "goalInvolvements" | "minutes" | "ownGoals" | "conceded" | "penaltiesMissed" | "penaltiesConceded" | "penaltiesSaved" | "distance";

function StatRow({ stat, value, teamData }: { stat: any; value: any; teamData: TeamData }) {
	const [showTooltip, setShowTooltip] = useState(false);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	const handleMouseEnter = () => {
		timeoutRef.current = setTimeout(() => {
			setShowTooltip(true);
		}, 1000);
	};

	const handleMouseLeave = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setShowTooltip(false);
	};

	const handleTouchStart = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		timeoutRef.current = setTimeout(() => {
			setShowTooltip(true);
		}, 1000);
	};

	const handleTouchEnd = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setShowTooltip(false);
	};

	return (
		<>
			<tr
				className='border-b border-white/10 hover:bg-white/5 transition-colors relative group cursor-help'
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}>
				<td className='px-2 md:px-4 py-2 md:py-3'>
					<div className='flex items-center justify-center w-6 h-6 md:w-8 md:h-8'>
						<Image
							src={`/stat-icons/${stat.iconName}.svg`}
							alt={stat.displayText}
							width={24}
							height={24}
							className='w-6 h-6 md:w-8 md:h-8 object-contain'
						/>
					</div>
				</td>
				<td className='px-2 md:px-4 py-2 md:py-3'>
					<span className='text-white font-medium text-xs md:text-sm'>{stat.displayText}</span>
				</td>
				<td className='px-2 md:px-4 py-2 md:py-3 text-right'>
					<span className='text-white font-mono text-xs md:text-sm'>
						{formatStatValue(value, stat.statFormat, stat.numberDecimalPlaces, (stat as any).statUnit)}
					</span>
				</td>
			</tr>
			{showTooltip && (
				<div className='fixed z-20 px-3 py-2 text-sm text-white rounded-lg shadow-lg w-64 text-center pointer-events-none' style={{ backgroundColor: '#0f0f0f' }}>
					<div className='absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent mb-1' style={{ borderBottomColor: '#0f0f0f' }}></div>
					{stat.description}
				</div>
			)}
		</>
	);
}

function formatStatValue(value: any, statFormat: string, decimalPlaces: number, statUnit?: string): string {
	if (value === null || value === undefined) return "N/A";

	// Helper to convert Neo4j Integer objects or any value to a number
	const toNumber = (val: any): number => {
		if (val === null || val === undefined) return 0;
		if (typeof val === "number") {
			if (isNaN(val)) return 0;
			return val;
		}
		// Handle Neo4j Integer objects
		if (typeof val === "object") {
			if ("toNumber" in val && typeof val.toNumber === "function") {
				return val.toNumber();
			}
			if ("low" in val && "high" in val) {
				// Neo4j Integer format: low + high * 2^32
				const low = val.low || 0;
				const high = val.high || 0;
				return low + high * 4294967296;
			}
		}
		const num = Number(val);
		return isNaN(num) ? 0 : num;
	};

	const numValue = toNumber(value);

	let formattedValue: string;
	switch (statFormat) {
		case "Integer":
			formattedValue = Math.round(numValue).toString();
			break;
		case "Decimal1":
			formattedValue = numValue.toFixed(1);
			break;
		case "Decimal2":
			formattedValue = numValue.toFixed(decimalPlaces);
			break;
		case "Percentage":
			formattedValue = `${Math.round(numValue)}%`;
			break;
		case "String":
			formattedValue = String(value);
			break;
		default:
			formattedValue = String(value);
	}

	return statUnit ? `${formattedValue} ${statUnit}` : formattedValue;
}

// Helper to convert TeamData values to numbers
function toNumber(val: any): number {
	if (val === null || val === undefined) return 0;
	if (typeof val === "number") {
		if (isNaN(val)) return 0;
		return val;
	}
	if (typeof val === "object") {
		if ("toNumber" in val && typeof val.toNumber === "function") {
			return val.toNumber();
		}
		if ("low" in val && "high" in val) {
			const low = val.low || 0;
			const high = val.high || 0;
			return low + high * 4294967296;
		}
	}
	const num = Number(val);
	return isNaN(num) ? 0 : num;
}

export default function ClubTeamStats() {
	const {
		selectedPlayer,
		cachedPlayerData,
		playerFilters,
		currentStatsSubPage,
		filterData,
	} = useNavigationStore();

	const [teamData, setTeamData] = useState<TeamData | null>(null);
	const [isLoadingTeamData, setIsLoadingTeamData] = useState(false);
	
	// Top players table state
	const [selectedStatType, setSelectedStatType] = useState<StatType>(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("club-stats-top-players-stat-type");
			const validStatTypes: StatType[] = ["appearances", "goals", "assists", "cleanSheets", "mom", "saves", "yellowCards", "redCards", "penaltiesScored", "fantasyPoints", "goalInvolvements", "minutes", "ownGoals", "conceded", "penaltiesMissed", "penaltiesConceded", "penaltiesSaved", "distance"];
			if (saved && validStatTypes.includes(saved as StatType)) {
				return saved as StatType;
			}
		}
		return "appearances";
	});
	const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
	const [isLoadingTopPlayers, setIsLoadingTopPlayers] = useState(false);

	// State for view mode toggle
	const [isDataTableMode, setIsDataTableMode] = useState(false);

	// Determine page heading based on team filter
	const pageHeading = useMemo(() => {
		if (!playerFilters.teams || playerFilters.teams.length === 0) {
			return "Club Stats";
		} else if (playerFilters.teams.length === 1) {
			return "Team Stats";
		} else {
			return "Club Stats";
		}
	}, [playerFilters.teams]);

	// Get stats to display for current page
	const statsToDisplay = useMemo(() => {
		return [...(statsPageConfig[currentStatsSubPage]?.statsToDisplay || [])];
	}, [currentStatsSubPage]);

	// Filter statObject entries to only include stats in statsToDisplay
	const filteredStatEntries = useMemo(() => {
		return Object.entries(statObject).filter(([key]) => statsToDisplay.includes(key as keyof typeof statObject));
	}, [statsToDisplay]);

	// Transform teamData into pie chart data format
	const pieChartData = useMemo(() => {
		if (!teamData) return [];
		
		const wins = teamData.wins || 0;
		const draws = teamData.draws || 0;
		const losses = teamData.losses || 0;
		
		return [
			{ name: "Wins", value: wins, color: "#22c55e" },
			{ name: "Draws", value: draws, color: "#60a5fa" },
			{ name: "Losses", value: losses, color: "#ef4444" },
		].filter(item => item.value > 0);
	}, [teamData]);

	// Save selectedStatType to localStorage when it changes
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem("club-stats-top-players-stat-type", selectedStatType);
		}
	}, [selectedStatType]);

	// Fetch team data when filters are applied
	// Use JSON.stringify to detect filter changes even if object reference doesn't change
	const filtersKey = JSON.stringify(playerFilters);
	
	useEffect(() => {
		const fetchTeamData = async () => {
			setIsLoadingTeamData(true);
			try {
				const response = await fetch("/api/team-data-filtered", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						teamName: "Whole Club",
						filters: playerFilters,
					}),
				});

				if (response.ok) {
					const data = await response.json();
					setTeamData(data.teamData);
				} else {
					console.error("Failed to fetch team data:", response.statusText);
					setTeamData(null);
				}
			} catch (error) {
				console.error("Error fetching team data:", error);
				setTeamData(null);
			} finally {
				setIsLoadingTeamData(false);
			}
		};

		fetchTeamData();
	}, [filtersKey, playerFilters]);

	// Fetch top players when filters or stat type changes
	useEffect(() => {
		const fetchTopPlayers = async () => {
			setIsLoadingTopPlayers(true);
			console.log(`[ClubTeamStats] Fetching top players for statType: ${selectedStatType}`, {
				filters: playerFilters,
				filtersKey,
			});
			
			try {
				const response = await fetch("/api/top-players-stats", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						filters: playerFilters,
						statType: selectedStatType,
					}),
				});

				if (response.ok) {
					const data = await response.json();
					console.log(`[ClubTeamStats] Received ${data.players?.length || 0} players for statType: ${selectedStatType}`, data.players);
					setTopPlayers(data.players || []);
				} else {
					const errorText = await response.text();
					console.error(`[ClubTeamStats] Failed to fetch top players: ${response.statusText}`, errorText);
					setTopPlayers([]);
				}
			} catch (error) {
				console.error("[ClubTeamStats] Error fetching top players:", error);
				setTopPlayers([]);
			} finally {
				setIsLoadingTopPlayers(false);
			}
		};

		fetchTopPlayers();
	}, [filtersKey, selectedStatType, playerFilters]);

	// Handle stat type selection
	const handleStatTypeSelect = (statType: StatType) => {
		setSelectedStatType(statType);
	};

	// Get stat value for a player based on stat type
	const getStatValue = (player: TopPlayer, statType: StatType): number => {
		switch (statType) {
			case "appearances":
				return player.appearances;
			case "goals":
				return player.goals + player.penaltiesScored;
			case "assists":
				return player.assists;
			case "cleanSheets":
				return player.cleanSheets;
			case "mom":
				return player.mom;
			case "saves":
				return player.saves;
			case "yellowCards":
				return player.yellowCards;
			case "redCards":
				return player.redCards;
			case "penaltiesScored":
				return player.penaltiesScored;
			case "fantasyPoints":
				return Math.round(player.fantasyPoints);
			case "goalInvolvements":
				return player.goalInvolvements;
			case "minutes":
				return player.minutes;
			case "ownGoals":
				return player.ownGoals;
			case "conceded":
				return player.conceded;
			case "penaltiesMissed":
				return player.penaltiesMissed;
			case "penaltiesConceded":
				return player.penaltiesConceded;
			case "penaltiesSaved":
				return player.penaltiesSaved;
			case "distance":
				return player.distance;
			default:
				return 0;
		}
	};

	// Format player summary text based on stat type
	const formatPlayerSummary = (player: TopPlayer, statType: StatType): string => {
		const apps = `${player.appearances} ${player.appearances === 1 ? "App" : "Apps"}`;
		
		switch (statType) {
			case "appearances":
				const homeGamesText = `${player.homeGames} ${player.homeGames === 1 ? "Home Game" : "Home Games"}`;
				const awayGamesText = `${player.awayGames} ${player.awayGames === 1 ? "Away Game" : "Away Games"}`;
				return `${homeGamesText} and ${awayGamesText}`;
			case "goals":
				const totalGoals = player.goals + player.penaltiesScored;
				const penaltyText = player.penaltiesScored > 0 ? ` (incl. ${player.penaltiesScored} ${player.penaltiesScored === 1 ? "penalty" : "penalties"})` : "";
				return `${totalGoals} ${totalGoals === 1 ? "Goal" : "Goals"}${penaltyText} in ${apps}`;
			case "assists":
				return `${player.assists} ${player.assists === 1 ? "Assist" : "Assists"} in ${apps}`;
			case "cleanSheets":
				return `${player.cleanSheets} ${player.cleanSheets === 1 ? "Clean Sheet" : "Clean Sheets"} in ${apps}`;
			case "mom":
				return `${player.mom} ${player.mom === 1 ? "Man of the Match" : "Man of the Matches"} in ${apps}`;
			case "saves":
				return `${player.saves} ${player.saves === 1 ? "Save" : "Saves"} in ${apps}`;
			case "yellowCards":
				return `${player.yellowCards} ${player.yellowCards === 1 ? "Yellow Card" : "Yellow Cards"} in ${apps}`;
			case "redCards":
				return `${player.redCards} ${player.redCards === 1 ? "Red Card" : "Red Cards"} in ${apps}`;
			case "penaltiesScored":
				return `${player.penaltiesScored} ${player.penaltiesScored === 1 ? "Penalty Scored" : "Penalties Scored"} in ${apps}`;
			case "fantasyPoints":
				return `${Math.round(player.fantasyPoints)} ${Math.round(player.fantasyPoints) === 1 ? "Fantasy Point" : "Fantasy Points"} in ${apps}`;
			case "goalInvolvements":
				const totalGoalsForInvolvements = player.goals + player.penaltiesScored;
				const goalsText = `${totalGoalsForInvolvements} ${totalGoalsForInvolvements === 1 ? "Goal" : "Goals"}`;
				const assistsText = `${player.assists} ${player.assists === 1 ? "Assist" : "Assists"}`;
				return `${goalsText} and ${assistsText} in ${apps}`;
			case "minutes":
				const formattedMinutes = player.minutes.toLocaleString();
				return `${formattedMinutes} ${player.minutes === 1 ? "Minute" : "Minutes"} in ${apps}`;
			case "ownGoals":
				return `${player.ownGoals} ${player.ownGoals === 1 ? "Own Goal" : "Own Goals"} in ${apps}`;
			case "conceded":
				return `${player.conceded} ${player.conceded === 1 ? "Goal Conceded" : "Goals Conceded"} in ${apps}`;
			case "penaltiesMissed":
				return `${player.penaltiesMissed} ${player.penaltiesMissed === 1 ? "Penalty Missed" : "Penalties Missed"} in ${apps}`;
			case "penaltiesConceded":
				return `${player.penaltiesConceded} ${player.penaltiesConceded === 1 ? "Penalty Conceded" : "Penalties Conceded"} in ${apps}`;
			case "penaltiesSaved":
				return `${player.penaltiesSaved} ${player.penaltiesSaved === 1 ? "Penalty Saved" : "Penalties Saved"} in ${apps}`;
			case "distance":
				const roundedDistance = Math.round(player.distance * 10) / 10;
				return `${roundedDistance} miles travelled to games in ${apps}`;
			default:
				return apps;
		}
	};

	// Get stat type display label
	const getStatTypeLabel = (statType: StatType): string => {
		switch (statType) {
			case "appearances":
				return "Appearances";
			case "goals":
				return "Goals";
			case "assists":
				return "Assists";
			case "cleanSheets":
				return "Clean Sheets";
			case "mom":
				return "Man of the Matches";
			case "saves":
				return "Saves";
			case "yellowCards":
				return "Yellow Cards";
			case "redCards":
				return "Red Cards";
			case "penaltiesScored":
				return "Penalties Scored";
			case "fantasyPoints":
				return "Fantasy Points";
			case "goalInvolvements":
				return "Goal Involvements";
			case "minutes":
				return "Minutes Played";
			case "ownGoals":
				return "Own Goals";
			case "conceded":
				return "Goals Conceded";
			case "penaltiesMissed":
				return "Penalties Missed";
			case "penaltiesConceded":
				return "Penalties Conceded";
			case "penaltiesSaved":
				return "Penalties Saved";
			case "distance":
				return "Distance Travelled";
			default:
				return "Appearances";
		}
	};

	// Format rank as ordinal (1st, 2nd, 3rd, etc.)
	const formatRank = (rank: number): string => {
		const lastDigit = rank % 10;
		const lastTwoDigits = rank % 100;
		
		if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
			return `${rank}th`;
		}
		
		switch (lastDigit) {
			case 1:
				return `${rank}st`;
			case 2:
				return `${rank}nd`;
			case 3:
				return `${rank}rd`;
			default:
				return `${rank}th`;
		}
	};

	// Prepare chart data (must be at top level for hooks)
	const goalsData = useMemo(() => {
		if (!teamData) return [];
		return [
			{ name: "Goals Scored", value: toNumber(teamData.goalsScored) },
			{ name: "Goals Conceded", value: toNumber(teamData.goalsConceded) },
		];
	}, [teamData]);

	const homeAwayData = useMemo(() => {
		if (!teamData) return [];
		return [
			{ name: "Home Games", value: toNumber(teamData.homeGames) },
			{ name: "Home Wins", value: toNumber(teamData.homeWins) },
			{ name: "Home Win %", value: Math.round(toNumber(teamData.homeWinPercentage)) },
			{ name: "Away Games", value: toNumber(teamData.awayGames) },
			{ name: "Away Wins", value: toNumber(teamData.awayWins) },
			{ name: "Away Win %", value: Math.round(toNumber(teamData.awayWinPercentage)) },
		];
	}, [teamData]);

	const keyTeamStatsData = useMemo(() => {
		if (!teamData) return [];
		return [
			{ name: "Games", value: toNumber(teamData.gamesPlayed) },
			{ name: "Clean Sheets", value: toNumber(teamData.cleanSheets) },
			{ name: "Points/Game", value: Number(toNumber(teamData.pointsPerGame).toFixed(2)) },
		];
	}, [teamData]);

	const tooltipStyle = {
		backgroundColor: 'rgb(14, 17, 15)',
		border: '1px solid rgba(249, 237, 50, 0.3)',
		borderRadius: '8px',
		color: '#fff',
	};

	// Custom tooltip formatter to capitalize "value"
	const customTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			const displayLabel = label || payload[0].name || payload[0].payload?.name || '';
			const displayValue = payload[0].value || 0;
			return (
				<div style={tooltipStyle} className='px-3 py-2'>
					<p className='text-white text-sm'>{displayLabel}</p>
					<p className='text-white text-sm'>
						<span className='font-semibold'>Value</span>: {displayValue}
					</p>
				</div>
			);
		}
		return null;
	};

	return (
		<div className='h-full flex flex-col'>
			<div className='flex-shrink-0 p-2 md:p-4'>
				<div className='flex items-center justify-center mb-2 md:mb-4 relative'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow text-center'>{pageHeading}</h2>
				</div>
				<div className='flex justify-center mb-2 md:mb-4'>
					<button
						onClick={() => setIsDataTableMode(!isDataTableMode)}
						className='text-white underline hover:text-white/80 text-sm md:text-base cursor-pointer'>
						{isDataTableMode ? "Switch to data visualisation" : "Switch to data table"}
					</button>
				</div>
				<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
			</div>

			{isLoadingTeamData ? (
				<div className='flex-1 flex items-center justify-center p-4'>
					<p className='text-white text-sm md:text-base'>Loading team data...</p>
				</div>
			) : !teamData ? (
				<div className='flex-1 flex items-center justify-center p-4'>
					<div className='text-center'>
						<p className='text-white text-sm md:text-base'>No team data available</p>
					</div>
				</div>
			) : (
				<div 
					className='flex-1 px-2 md:px-4 pb-4 min-h-0 overflow-y-auto'
					style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
					{(() => {
						const chartContent = (
							<div className='space-y-4 pb-4'>
								{/* Top Players Table */}
								<div className='mb-4 flex-shrink-0'>
									<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Top 5 {getStatTypeLabel(selectedStatType)}</h3>
										<div className='mb-2'>
											<Listbox value={selectedStatType} onChange={handleStatTypeSelect}>
												<div className='relative'>
													<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-xs md:text-sm'>
														<span className='block truncate text-white'>
															{getStatTypeLabel(selectedStatType)}
														</span>
													<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
														<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
													</span>
												</Listbox.Button>
												<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-xs md:text-sm shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
													{([
														"appearances",
														"minutes",
														"mom",
														"goals",
														"assists",
														"goalInvolvements",
														"fantasyPoints",
														"cleanSheets",
														"saves",
														"yellowCards",
														"redCards",
														"penaltiesScored",
														"penaltiesSaved",
														"penaltiesConceded",
														"penaltiesMissed",
														"conceded",
														"ownGoals",
														"distance",
													] as StatType[]).map((statType) => (
														<Listbox.Option
															key={statType}
															className={({ active }) =>
																`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
															}
															value={statType}>
															{({ selected }) => (
																<span className={`block truncate py-1 px-2 ${selected ? "font-medium" : "font-normal"}`}>
																	{getStatTypeLabel(statType)}
																</span>
															)}
														</Listbox.Option>
													))}
												</Listbox.Options>
											</div>
												</Listbox>
										</div>
										{isLoadingTopPlayers ? (
											<div className='p-4'>
												<p className='text-white text-xs md:text-sm text-center'>Loading top players...</p>
											</div>
										) : topPlayers.length > 0 ? (
											<div className='overflow-x-auto'>
												<table className='w-full text-white'>
												<thead>
													<tr className='border-b-2 border-dorkinians-yellow'>
														<th className='text-left py-2 px-2 text-xs md:text-sm w-auto'>
															<div className='flex items-center gap-2'>
																<div className='w-10 md:w-12'></div>
																<div>Player Name</div>
															</div>
														</th>
														<th className='text-center py-2 px-2 text-xs md:text-sm w-20 md:w-24'>{getStatTypeLabel(selectedStatType)}</th>
													</tr>
												</thead>
												<tbody>
													{topPlayers.map((player, index) => {
														const isLastPlayer = index === topPlayers.length - 1;
														const statValue = getStatValue(player, selectedStatType);
														let formattedStatValue: string | number;
														if (selectedStatType === "minutes") {
															formattedStatValue = statValue.toLocaleString();
														} else if (selectedStatType === "distance") {
															formattedStatValue = (Math.round(statValue * 10) / 10).toFixed(1);
														} else {
															formattedStatValue = statValue;
														}
														const summary = formatPlayerSummary(player, selectedStatType);
														
														return (
															<tr
																key={player.playerName}
																className={`${isLastPlayer ? '' : 'border-b border-green-500'}`}
																style={{
																	background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))',
																}}>
																<td className='py-2 px-2 align-top' colSpan={2}>
																	<div className='flex flex-col'>
																		<div className='flex items-center gap-2'>
																			<div className='text-base md:text-lg font-semibold whitespace-nowrap w-10 md:w-12'>{formatRank(index + 1)}</div>
																			<div className='text-base md:text-lg font-semibold flex-1'>{player.playerName}</div>
																			<div className='text-base md:text-lg font-bold w-20 md:w-24 text-center'>{formattedStatValue}</div>
																		</div>
																		<div className='pt-1 pl-[3rem] md:pl-[3.5rem]'>
																			<div className='text-[0.7rem] md:text-[0.8rem] text-gray-300 text-left'>
																				{summary}
																			</div>
																		</div>
																	</div>
																</td>
															</tr>
														);
													})}
												</tbody>
												</table>
											</div>
										) : (
											<div className='p-4'>
												<p className='text-white text-xs md:text-sm text-center'>No players found</p>
											</div>
										)}
									</div>
								</div>

								{/* Win/Draw/Loss Pie Chart */}
								{pieChartData.length > 0 && (() => {
									const wins = toNumber(teamData.wins || 0);
									const draws = toNumber(teamData.draws || 0);
									const losses = toNumber(teamData.losses || 0);
									const gamesPlayed = wins + draws + losses;
									const pointsPerGame = gamesPlayed > 0 ? ((3 * wins) + (1 * draws)) / gamesPlayed : 0;
									const pointsPerGameFormatted = Math.min(3, Math.max(0, pointsPerGame)).toFixed(1);
									
									return (
									<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Match Results</h3>
										<p className='text-white text-sm mb-3 text-center'>Points per game: {pointsPerGameFormatted}</p>
										<div className='chart-container' style={{ touchAction: 'pan-y' }}>
											<ResponsiveContainer width='100%' height={350}>
												<PieChart>
													<Pie
														data={pieChartData}
														cx='50%'
														cy='50%'
														labelLine={false}
														label={({ cx, cy, midAngle, innerRadius, outerRadius, name, value }) => {
															const RADIAN = Math.PI / 180;
															const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
															const x = cx + radius * Math.cos(-midAngle * RADIAN);
															const y = cy + radius * Math.sin(-midAngle * RADIAN);
															
															return (
																<text
																	x={x}
																	y={y}
																	fill="#ffffff"
																	textAnchor={x > cx ? 'start' : 'end'}
																	dominantBaseline="central"
																	fontSize={14}
																	fontWeight='bold'
																>
																	{`${name}: ${value}`}
																</text>
															);
														}}
														outerRadius={100}
														fill='#8884d8'
														dataKey='value'
													>
													{pieChartData.map((entry, index) => (
														<Cell key={`cell-${index}`} fill={entry.color} />
													))}
												</Pie>
												<Tooltip content={customTooltip} />
												<Legend 
													wrapperStyle={{ color: '#fff', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '10px', borderRadius: '8px' }} 
													iconType='circle' 
												/>
												</PieChart>
											</ResponsiveContainer>
										</div>
									</div>
									);
								})()}

								{/* Goals Scored vs Conceded Bar Chart */}
								{(toNumber(teamData.goalsScored) > 0 || toNumber(teamData.goalsConceded) > 0) && (
									<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Goals Scored vs Conceded</h3>
										<div className='chart-container' style={{ touchAction: 'pan-y' }}>
											<ResponsiveContainer width='100%' height={300}>
												<BarChart data={goalsData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
													<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
													<XAxis dataKey='name' stroke='#fff' fontSize={12} />
													<YAxis stroke='#fff' fontSize={12} />
													<Tooltip content={customTooltip} />
													<Bar dataKey='value' fill='#f9ed32' radius={[4, 4, 0, 0]} opacity={0.8} activeBar={{ opacity: 0.5 }} />
												</BarChart>
											</ResponsiveContainer>
										</div>
									</div>
								)}

								{/* Home vs Away Performance Bar Chart */}
								{(toNumber(teamData.homeGames) > 0 || toNumber(teamData.awayGames) > 0) && (
									<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Home vs Away Performance</h3>
										<div className='chart-container' style={{ touchAction: 'pan-y' }}>
											<ResponsiveContainer width='100%' height={300}>
												<BarChart data={homeAwayData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
													<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
													<XAxis dataKey='name' stroke='#fff' fontSize={12} angle={-45} textAnchor='end' height={80} />
													<YAxis stroke='#fff' fontSize={12} />
													<Tooltip content={customTooltip} />
													<Bar dataKey='value' fill='#22c55e' radius={[4, 4, 0, 0]} opacity={0.8} activeBar={{ opacity: 0.5 }} />
												</BarChart>
											</ResponsiveContainer>
										</div>
									</div>
								)}

								{/* Key Team Stats Bar Chart */}
								{toNumber(teamData.gamesPlayed) > 0 && (
									<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Key Team Stats</h3>
										<div className='chart-container' style={{ touchAction: 'pan-y' }}>
											<ResponsiveContainer width='100%' height={300}>
												<BarChart data={keyTeamStatsData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
													<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
													<XAxis dataKey='name' stroke='#fff' fontSize={12} />
													<YAxis stroke='#fff' fontSize={12} />
													<Tooltip content={customTooltip} />
													<Bar dataKey='value' fill='#60a5fa' radius={[4, 4, 0, 0]} opacity={0.8} activeBar={{ opacity: 0.5 }} />
												</BarChart>
											</ResponsiveContainer>
										</div>
									</div>
								)}
							</div>
						);

						const dataTableContent = (
							<div className='overflow-x-auto mt-4 flex flex-col'>
								{/* Team Stats Table */}
								<div className='flex-1 min-h-0'>
									<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
										<thead className='sticky top-0 z-10'>
											<tr className='bg-white/20'>
												<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Icon</th>
												<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Stat</th>
												<th className='px-2 md:px-4 py-2 md:py-3 text-right text-white font-semibold text-xs md:text-sm'>Value</th>
											</tr>
										</thead>
										<tbody>
											{filteredStatEntries.map(([key, stat]) => {
												const value = teamData[stat.statName as keyof TeamData];
												return <StatRow key={key} stat={stat} value={value} teamData={teamData} />;
											})}
										</tbody>
									</table>
								</div>
							</div>
						);

						return (
							<>
								{!isDataTableMode && chartContent}
								{isDataTableMode && dataTableContent}
								<div className='h-4'></div>
							</>
						);
					})()}
				</div>
			)}
		</div>
	);
}

