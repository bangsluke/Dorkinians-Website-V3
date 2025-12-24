"use client";

import { useNavigationStore, type TeamData } from "@/lib/stores/navigation";
import { statObject, statsPageConfig, appConfig } from "@/config/config";
import Image from "next/image";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import FilterPills from "@/components/filters/FilterPills";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart, Line, LabelList } from "recharts";
import { ResponsiveSankey } from "@nivo/sankey";
import HomeAwayGauge from "./HomeAwayGauge";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/utils/pwaDebug";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { StatCardSkeleton, ChartSkeleton, TopPlayersTableSkeleton, RadarChartSkeleton, SankeyChartSkeleton, GameDetailsTableSkeleton, DataTableSkeleton } from "@/components/skeletons";


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
	const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; placement: 'above' | 'below' } | null>(null);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const rowRef = useRef<HTMLTableRowElement>(null);
	const tooltipRef = useRef<HTMLDivElement | null>(null);

	// Find all scroll containers up the DOM tree
	const findScrollContainers = (element: HTMLElement | null): HTMLElement[] => {
		const containers: HTMLElement[] = [];
		let current: HTMLElement | null = element;
		
		while (current && current !== document.body) {
			const style = window.getComputedStyle(current);
			const overflowY = style.overflowY;
			const overflowX = style.overflowX;
			
			if (overflowY === 'auto' || overflowY === 'scroll' || overflowX === 'auto' || overflowX === 'scroll') {
				containers.push(current);
			}
			
			current = current.parentElement;
		}
		
		return containers;
	};

	const updateTooltipPosition = () => {
		if (!rowRef.current) return;
		
		const rect = rowRef.current.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;
		
		// Find scroll containers
		const scrollContainers = findScrollContainers(rowRef.current);
		
		// Calculate tooltip dimensions - use actual if available, otherwise estimate
		let tooltipHeight = 60; // Default estimate
		const tooltipWidth = 256; // w-64 = 16rem = 256px
		
		// Try to measure actual tooltip if it exists
		if (tooltipRef.current) {
			const tooltipRect = tooltipRef.current.getBoundingClientRect();
			tooltipHeight = tooltipRect.height || 60;
		}
		
		// Calculate available space above and below
		const spaceBelow = viewportHeight - rect.bottom;
		const spaceAbove = rect.top;
		const margin = 10; // Minimum margin from viewport edge
		const arrowHeight = 8; // Height of arrow
		const spacing = 8; // Space between row and tooltip
		
		// Determine placement based on available space
		let placement: 'above' | 'below' = 'below';
		let top: number;
		
		const neededSpaceBelow = tooltipHeight + arrowHeight + spacing + margin;
		const neededSpaceAbove = tooltipHeight + arrowHeight + spacing + margin;
		
		if (spaceBelow < neededSpaceBelow && spaceAbove > neededSpaceAbove) {
			// Show above if not enough space below but enough above
			placement = 'above';
			top = rect.top + window.scrollY - tooltipHeight - arrowHeight - spacing;
		} else if (spaceBelow >= neededSpaceBelow) {
			// Show below if enough space
			placement = 'below';
			top = rect.bottom + window.scrollY + spacing;
		} else {
			// Default to above if neither has enough space (prefer above to avoid going off bottom)
			placement = 'above';
			top = Math.max(margin, rect.top + window.scrollY - tooltipHeight - arrowHeight - spacing);
		}
		
		// Calculate horizontal position (center on row, but keep within viewport)
		let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipWidth / 2);
		
		// Ensure tooltip stays within viewport with margin
		if (left < window.scrollX + margin) {
			left = window.scrollX + margin;
		} else if (left + tooltipWidth > window.scrollX + viewportWidth - margin) {
			left = window.scrollX + viewportWidth - tooltipWidth - margin;
		}
		
		setTooltipPosition({ top, left, placement });
	};

	// Update position when tooltip becomes visible (to measure actual dimensions)
	useEffect(() => {
		if (showTooltip) {
			// Use a small delay to ensure tooltip is rendered and we can measure it
			const timeoutId = setTimeout(() => {
				updateTooltipPosition();
			}, 0);
			return () => clearTimeout(timeoutId);
		}
	}, [showTooltip]);

	// Add scroll listeners
	useEffect(() => {
		if (!showTooltip || !rowRef.current) return;
		
		const scrollContainers = findScrollContainers(rowRef.current);
		const handleScroll = () => {
			updateTooltipPosition();
		};
		
		// Add listeners to window and all scroll containers
		window.addEventListener('scroll', handleScroll, true);
		scrollContainers.forEach(container => {
			container.addEventListener('scroll', handleScroll, true);
		});
		
		return () => {
			window.removeEventListener('scroll', handleScroll, true);
			scrollContainers.forEach(container => {
				container.removeEventListener('scroll', handleScroll, true);
			});
		};
	}, [showTooltip]);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	const handleMouseEnter = () => {
		updateTooltipPosition();
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
		setTooltipPosition(null);
	};

	const handleTouchStart = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		updateTooltipPosition();
		timeoutRef.current = setTimeout(() => {
			setShowTooltip(true);
		}, 500);
	};

	const handleTouchEnd = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setShowTooltip(false);
		setTooltipPosition(null);
	};

	return (
		<>
			<tr
				ref={rowRef}
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
			{showTooltip && tooltipPosition && typeof document !== 'undefined' && createPortal(
				<div 
					ref={tooltipRef}
					className='fixed z-[9999] px-3 py-2 text-sm text-white rounded-lg shadow-lg w-64 text-center pointer-events-none' 
					style={{ 
						backgroundColor: '#0f0f0f',
						top: `${tooltipPosition.top}px`,
						left: `${tooltipPosition.left}px`
					}}>
					{tooltipPosition.placement === 'above' ? (
						<div className='absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent mt-1' style={{ borderTopColor: '#0f0f0f' }}></div>
					) : (
						<div className='absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent mb-1' style={{ borderBottomColor: '#0f0f0f' }}></div>
					)}
					{stat.description}
				</div>,
				document.body
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
			formattedValue = Math.round(numValue).toLocaleString();
			break;
		case "Decimal1":
			formattedValue = numValue.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
			break;
		case "Decimal2":
			formattedValue = numValue.toLocaleString('en-US', { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces });
			break;
		case "Percentage":
			formattedValue = `${Math.round(numValue).toLocaleString()}%`;
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

export default function ClubStats() {
	const {
		selectedPlayer,
		cachedPlayerData,
		playerFilters,
		currentStatsSubPage,
		filterData,
		shouldShowDataTable,
		setDataTableMode,
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

	// State for view mode toggle - initialize from localStorage
	const [isDataTableMode, setIsDataTableMode] = useState<boolean>(() => {
		if (typeof window !== "undefined") {
			const saved = safeLocalStorageGet("club-stats-view-mode");
			if (saved === "true") return true;
			if (saved === "false") return false;
		}
		return false;
	});

	// Handle data table mode from navigation store
	useEffect(() => {
		if (shouldShowDataTable) {
			setIsDataTableMode(true);
			setDataTableMode(false); // Clear the flag after use
		}
	}, [shouldShowDataTable, setDataTableMode]);

	// Persist view mode to localStorage when it changes
	useEffect(() => {
		if (typeof window !== "undefined") {
			safeLocalStorageSet("club-stats-view-mode", isDataTableMode ? "true" : "false");
		}
	}, [isDataTableMode]);

	// Team comparison state
	const [teamComparisonData, setTeamComparisonData] = useState<any[]>([]);
	const [isLoadingTeamComparison, setIsLoadingTeamComparison] = useState(false);
	const [visibleTeams, setVisibleTeams] = useState<Set<string>>(new Set());
	const [clickedCategory, setClickedCategory] = useState<string | null>(null);

	// Player distribution state
	const [playerDistributionData, setPlayerDistributionData] = useState<any>(null);
	const [isLoadingPlayerDistribution, setIsLoadingPlayerDistribution] = useState(false);

	// Player tenure state
	const [playerTenureData, setPlayerTenureData] = useState<number[]>([]);
	const [isLoadingPlayerTenure, setIsLoadingPlayerTenure] = useState(false);

	// Position stats state
	const [positionStatsData, setPositionStatsData] = useState<any[]>([]);
	const [isLoadingPositionStats, setIsLoadingPositionStats] = useState(false);
	const [selectedPositionStat, setSelectedPositionStat] = useState<string>("appearances");

	// State for seasonal performance chart
	const [seasonalSelectedStat, setSeasonalSelectedStat] = useState<string>("Games");
	const [seasonalStats, setSeasonalStats] = useState<any[]>([]);
	const [isLoadingSeasonalStats, setIsLoadingSeasonalStats] = useState(false);
	const [showTrend, setShowTrend] = useState(true);

	// State for game details
	const [gameDetails, setGameDetails] = useState<any>(null);
	const [isLoadingGameDetails, setIsLoadingGameDetails] = useState(false);

	// State for unique player stats
	const [uniquePlayerStats, setUniquePlayerStats] = useState<any>(null);
	const [isLoadingUniqueStats, setIsLoadingUniqueStats] = useState(false);

	// Track last fetched filters to implement caching
	const lastFetchedFiltersRef = useRef<string | null>(null);

	// Hard-coded page heading
	const pageHeading = "Club Stats";

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
	const filtersKey = JSON.stringify(playerFilters || {});
	
	useEffect(() => {
		if (!playerFilters) return;
		
		// Check if we already have data for this filter combination
		if (teamData && lastFetchedFiltersRef.current === filtersKey) {
			return; // Data already loaded for these filters, skip fetch
		}

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
					lastFetchedFiltersRef.current = filtersKey; // Store the filters key for this data
				} else {
					console.error("Failed to fetch team data:", response.statusText);
					setTeamData(null);
					lastFetchedFiltersRef.current = null;
				}
			} catch (error) {
				console.error("Error fetching team data:", error);
				setTeamData(null);
				lastFetchedFiltersRef.current = null;
			} finally {
				setIsLoadingTeamData(false);
			}
		};

		fetchTeamData();
	}, [filtersKey, playerFilters]);

	// Fetch top players when filters or stat type changes
	useEffect(() => {
		if (!playerFilters) return;
		
		const fetchTopPlayers = async () => {
			setIsLoadingTopPlayers(true);
				console.log(`[ClubStats] Fetching top players for statType: ${selectedStatType}`, {
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
					console.log(`[ClubStats] Received ${data.players?.length || 0} players for statType: ${selectedStatType}`, data.players);
					setTopPlayers(data.players || []);
				} else {
					const errorText = await response.text();
					console.error(`[ClubStats] Failed to fetch top players: ${response.statusText}`, errorText);
					setTopPlayers([]);
				}
			} catch (error) {
				console.error("[ClubStats] Error fetching top players:", error);
				setTopPlayers([]);
			} finally {
				setIsLoadingTopPlayers(false);
			}
		};

		fetchTopPlayers();
	}, [filtersKey, selectedStatType, playerFilters]);

	// Check if all seasons are selected
	const allSeasonsSelected = useMemo(() => {
		if (playerFilters?.timeRange?.type === "allTime") return true;
		if (playerFilters?.timeRange?.type === "season" && filterData?.seasons) {
			const selectedSeasons = playerFilters.timeRange.seasons || [];
			const allSeasons = filterData.seasons.map((s: any) => s.season || s);
			return selectedSeasons.length === allSeasons.length && 
				allSeasons.every((season: string) => selectedSeasons.includes(season));
		}
		return false;
	}, [playerFilters?.timeRange, filterData]);

	// Stat options for seasonal chart dropdown
	const statOptions = useMemo(() => [
		{ value: "Games", label: "Games", statKey: "gamesPlayed" },
		{ value: "Wins", label: "Wins", statKey: "wins" },
		{ value: "Goals", label: "Goals", statKey: "goalsScored" },
		{ value: "Goals Conceded", label: "Goals Conceded", statKey: "goalsConceded" },
		{ value: "Clean Sheets", label: "Clean Sheets", statKey: "teamCleanSheets" },
		{ value: "Appearances", label: "Appearances", statKey: "appearances" },
		{ value: "Minutes", label: "Minutes", statKey: "minutes" },
		{ value: "MoM", label: "MoM", statKey: "mom" },
		{ value: "Assists", label: "Assists", statKey: "assists" },
		{ value: "Fantasy Points", label: "Fantasy Points", statKey: "fantasyPoints" },
		{ value: "Yellow Cards", label: "Yellow Cards", statKey: "yellowCards" },
		{ value: "Red Cards", label: "Red Cards", statKey: "redCards" },
		{ value: "Saves", label: "Saves", statKey: "saves" },
		{ value: "Conceded", label: "Conceded", statKey: "conceded" },
		{ value: "Own Goals", label: "Own Goals", statKey: "ownGoals" },
		{ value: "Penalties Scored", label: "Penalties Scored", statKey: "penaltiesScored" },
		{ value: "Penalties Missed", label: "Penalties Missed", statKey: "penaltiesMissed" },
		{ value: "Penalties Conceded", label: "Penalties Conceded", statKey: "penaltiesConceded" },
		{ value: "Penalties Saved", label: "Penalties Saved", statKey: "penaltiesSaved" },
		{ value: "Distance Travelled", label: "Distance Travelled", statKey: "distance" },
	], []);

	// Fetch seasonal stats when all seasons selected
	useEffect(() => {
		if (!allSeasonsSelected || !playerFilters) {
			setSeasonalStats([]);
			return;
		}

		const fetchSeasonalStats = async () => {
			setIsLoadingSeasonalStats(true);
			try {
				const response = await fetch("/api/team-seasonal-stats", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						teamName: "Whole Club",
						filters: playerFilters,
					}),
				});
				if (response.ok) {
					const data = await response.json();
					setSeasonalStats(data.seasonalStats || []);
				}
			} catch (error) {
				console.error("Error fetching seasonal stats:", error);
			} finally {
				setIsLoadingSeasonalStats(false);
			}
		};

		fetchSeasonalStats();
	}, [allSeasonsSelected, playerFilters]);

	// Fetch game details when filters change
	useEffect(() => {
		if (!playerFilters) {
			setGameDetails(null);
			return;
		}

		const fetchGameDetails = async () => {
			setIsLoadingGameDetails(true);
			try {
				const response = await fetch("/api/team-game-details", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						teamName: "Whole Club",
						filters: playerFilters,
					}),
				});
				if (response.ok) {
					const data = await response.json();
					setGameDetails(data);
				}
			} catch (error) {
				console.error("Error fetching game details:", error);
				setGameDetails(null);
			} finally {
				setIsLoadingGameDetails(false);
			}
		};

		fetchGameDetails();
	}, [playerFilters]);

	// Fetch unique player stats when filters change
	useEffect(() => {
		if (!playerFilters) {
			setUniquePlayerStats(null);
			return;
		}

		const fetchUniqueStats = async () => {
			setIsLoadingUniqueStats(true);
			try {
				const response = await fetch("/api/unique-player-stats", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						teamName: "Whole Club",
						filters: playerFilters,
					}),
				});
				if (response.ok) {
					const data = await response.json();
					setUniquePlayerStats(data);
				}
			} catch (error) {
				console.error("Error fetching unique player stats:", error);
				setUniquePlayerStats(null);
			} finally {
				setIsLoadingUniqueStats(false);
			}
		};

		fetchUniqueStats();
	}, [playerFilters]);

	// Calculate linear regression for trendline
	const calculateTrendline = (data: Array<{ name: string; value: number }>) => {
		if (data.length < 2) return [];
		
		const n = data.length;
		let sumX = 0;
		let sumY = 0;
		let sumXY = 0;
		let sumX2 = 0;
		
		data.forEach((point, index) => {
			const x = index;
			const y = point.value;
			sumX += x;
			sumY += y;
			sumXY += x * y;
			sumX2 += x * x;
		});
		
		const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
		const intercept = (sumY - slope * sumX) / n;
		
		return data.map((point, index) => ({
			name: point.name,
			value: slope * index + intercept,
		}));
	};

	// Prepare seasonal chart data with trendline
	const seasonalChartData = useMemo(() => {
		if (!seasonalStats.length) return [];
		const selectedOption = statOptions.find(opt => opt.value === seasonalSelectedStat);
		if (!selectedOption) return [];
		
		const baseData = seasonalStats.map(stat => ({
			name: stat.season,
			value: toNumber(stat[selectedOption.statKey] || 0),
		}));

		// Add trendline values if enabled
		if (showTrend && baseData.length >= 2) {
			const trendlinePoints = calculateTrendline(baseData);
			return baseData.map((point, index) => ({
				...point,
				trendline: trendlinePoints[index]?.value || 0,
			}));
		}

		return baseData;
	}, [seasonalStats, seasonalSelectedStat, statOptions, showTrend]);

	// Fetch team comparison data
	useEffect(() => {
		if (!playerFilters) return;

		const fetchTeamComparison = async () => {
			setIsLoadingTeamComparison(true);
			try {
				const teams = ["1st XI", "2nd XI", "3rd XI", "4th XI", "5th XI", "6th XI", "7th XI", "8th XI"];
				const promises = teams.map(async (teamName) => {
					try {
						const response = await fetch("/api/team-data-filtered", {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								teamName: teamName,
								filters: playerFilters,
							}),
						});

						if (response.ok) {
							const data = await response.json();
							return { team: teamName, data: data.teamData };
						}
						return null;
					} catch (error) {
						console.error(`Error fetching data for ${teamName}:`, error);
						return null;
					}
				});

				const results = await Promise.all(promises);
				const validResults = results.filter((r) => r !== null);
				setTeamComparisonData(validResults);
				// Initialize visible teams with all teams
				setVisibleTeams(new Set(validResults.map((r: any) => r.team)));
			} catch (error) {
				console.error("Error fetching team comparison data:", error);
				setTeamComparisonData([]);
			} finally {
				setIsLoadingTeamComparison(false);
			}
		};

		fetchTeamComparison();
	}, [filtersKey, playerFilters]);

	// Fetch player distribution data
	useEffect(() => {
		if (!playerFilters) return;

		const fetchPlayerDistribution = async () => {
			setIsLoadingPlayerDistribution(true);
			try {
				const response = await fetch("/api/club-player-distribution", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						filters: playerFilters,
					}),
				});

				if (response.ok) {
					const data = await response.json();
					setPlayerDistributionData(data);
				} else {
					console.error("Failed to fetch player distribution:", response.statusText);
					setPlayerDistributionData(null);
				}
			} catch (error) {
				console.error("Error fetching player distribution:", error);
				setPlayerDistributionData(null);
			} finally {
				setIsLoadingPlayerDistribution(false);
			}
		};

		fetchPlayerDistribution();
	}, [filtersKey, playerFilters]);

	// Fetch player tenure data
	useEffect(() => {
		if (!playerFilters) return;

		const fetchPlayerTenure = async () => {
			setIsLoadingPlayerTenure(true);
			try {
				const response = await fetch("/api/club-player-tenure", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						filters: playerFilters,
					}),
				});

				if (response.ok) {
					const data = await response.json();
					setPlayerTenureData(data.tenures || []);
				} else {
					console.error("Failed to fetch player tenure:", response.statusText);
					setPlayerTenureData([]);
				}
			} catch (error) {
				console.error("Error fetching player tenure:", error);
				setPlayerTenureData([]);
			} finally {
				setIsLoadingPlayerTenure(false);
			}
		};

		fetchPlayerTenure();
	}, [filtersKey, playerFilters]);

	// Fetch position stats data
	useEffect(() => {
		if (!playerFilters) return;

		const fetchPositionStats = async () => {
			setIsLoadingPositionStats(true);
			try {
				const response = await fetch("/api/club-position-stats", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						filters: playerFilters,
						statType: selectedPositionStat,
					}),
				});

				if (response.ok) {
					const data = await response.json();
					setPositionStatsData(data.stats || []);
				} else {
					console.error("Failed to fetch position stats:", response.statusText);
					setPositionStatsData([]);
				}
			} catch (error) {
				console.error("Error fetching position stats:", error);
				setPositionStatsData([]);
			} finally {
				setIsLoadingPositionStats(false);
			}
		};

		fetchPositionStats();
	}, [filtersKey, selectedPositionStat, playerFilters]);


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
		const goalsScored = toNumber(teamData.goalsScored);
		const goalsConceded = toNumber(teamData.goalsConceded);
		const gamesPlayed = toNumber(teamData.gamesPlayed);
		const goalsScoredPerGame = gamesPlayed > 0 ? (goalsScored / gamesPlayed).toFixed(2) : "0.00";
		const goalsConcededPerGame = gamesPlayed > 0 ? (goalsConceded / gamesPlayed).toFixed(2) : "0.00";
		return [
			{ name: "Goals Scored", value: goalsScored, fill: "#22c55e", perGame: goalsScoredPerGame },
			{ name: "Goals Conceded", value: goalsConceded, fill: "#ef4444", perGame: goalsConcededPerGame },
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

	// Custom tooltip formatter to capitalize "value" and show per game
	const customTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			const displayLabel = label || payload[0].name || payload[0].payload?.name || '';
			const displayValue = payload[0].value || 0;
			// Get perGame from the payload data
			const dataEntry = goalsData.find((e: any) => e.name === displayLabel);
			const perGame = dataEntry?.perGame || payload[0].payload?.perGame || "0.00";
			const gamesPlayed = teamData?.gamesPlayed || 0;
			const uniqueGoalscorers = uniquePlayerStats?.playersWhoScored || 0;
			
			return (
				<div style={tooltipStyle} className='px-3 py-2'>
					<p className='text-white text-sm'>{displayLabel}</p>
					<p className='text-white text-sm'>
						<span className='font-semibold'>Value</span>: {displayValue}
					</p>
					<p className='text-white text-sm'>
						<span className='font-semibold'>Per Game</span>: {perGame}
					</p>
					<p className='text-white text-sm'>
						<span className='font-semibold'>Games</span>: {gamesPlayed}
					</p>
					{displayLabel === "Goals Scored" && uniqueGoalscorers > 0 && (
						<p className='text-white text-sm'>
							<span className='font-semibold'>Unique Goalscorers</span>: {uniqueGoalscorers}
						</p>
					)}
				</div>
			);
		}
		return null;
	};

	// Custom tooltip for Stats Distribution with comma formatting
	const statsDistributionTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			const displayLabel = label || payload[0].name || payload[0].payload?.name || '';
			const displayValue = payload[0].value || 0;
			const formattedValue = typeof displayValue === 'number' ? displayValue.toLocaleString('en-US') : displayValue;
			return (
				<div style={tooltipStyle} className='px-3 py-2'>
					<p className='text-white text-sm'>{displayLabel}</p>
					<p className='text-white text-sm'>
						<span className='font-semibold'>Value</span>: {formattedValue}
					</p>
				</div>
			);
		}
		return null;
	};

	// Helper function to get tooltip content for a category
	const getTooltipContentForCategory = (category: string) => {
		if (!radarChartData.length) return null;
		
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
		
		// Find the data point for this category
		const categoryData = radarChartData.find((d: any) => d.category === category);
		if (!categoryData) return null;

		// Get all visible teams and their values
		const visibleTeamEntries = teamComparisonData
			.filter(({ team }: any) => visibleTeams.has(team))
			.map(({ team }: any) => {
				const teamKey = team.replace(" XI", "s");
				const originalIndex = teamComparisonData.findIndex((t: any) => t.team === team);
				const color = teamColors[originalIndex % teamColors.length];
				
				// Get the actual value (not scaled) for display
				const teamData = teamComparisonData.find((t: any) => t.team === team)?.data;
				let actualValue = 0;
				if (teamData) {
					switch (category) {
						case "Games":
							actualValue = toNumber(teamData.gamesPlayed);
							break;
						case "Goals Scored":
							actualValue = toNumber(teamData.goalsScored);
							break;
						case "Goals Conceded":
							actualValue = toNumber(teamData.goalsConceded);
							break;
						case "Distance (Miles)":
							actualValue = toNumber(teamData.totalDistance);
							break;
						case "Wins":
							actualValue = toNumber(teamData.wins);
							break;
						case "Points per Game":
							actualValue = Number(toNumber(teamData.pointsPerGame).toFixed(2));
							break;
						case "Clean Sheets":
							actualValue = toNumber(teamData.cleanSheets);
							break;
						case "Competitions":
							actualValue = toNumber(teamData.numberOfCompetitions);
							break;
						case "Fantasy Points":
							actualValue = toNumber(teamData.totalFantasyPoints);
							break;
					}
				}
				
				return { team, teamKey, color, value: actualValue };
			});

		// Sort entries by value (descending)
		const sortedEntries = visibleTeamEntries.sort((a, b) => b.value - a.value);
		
		return { category, entries: sortedEntries };
	};

	// Custom tooltip for radar chart showing all visible teams
	const radarTooltip = ({ active, payload, label }: any) => {
		const category = (active && label) ? label : clickedCategory;
		if (!category) return null;
		
		const tooltipContent = getTooltipContentForCategory(category);
		if (!tooltipContent) return null;

		return (
			<div style={tooltipStyle} className='px-3 py-2'>
				<p className='text-white text-sm font-semibold mb-2'>{tooltipContent.category}</p>
				{tooltipContent.entries.map(({ team, color, value }) => {
					// Format distance values to 0 decimal places with comma separators
					// Format Fantasy Points with comma separators
					let displayValue: string | number = value;
					if (tooltipContent.category === "Distance (Miles)") {
						displayValue = Math.round(value).toLocaleString('en-US');
					} else if (tooltipContent.category === "Fantasy Points") {
						displayValue = Math.round(value).toLocaleString('en-US');
					}
					return (
						<p key={team} className='text-white text-sm' style={{ color: color }}>
							{team}: {displayValue}
						</p>
					);
				})}
			</div>
		);
	};

	// Handle label click to show tooltip
	const handleLabelClick = (category: string) => {
		setClickedCategory(category);
		// Clear after 3 seconds
		setTimeout(() => {
			setClickedCategory(null);
		}, 3000);
	};

	// Custom tooltip for Player Tenure (shows "X players" instead of "Value: X")
	const tenureTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			const displayValue = payload[0].value || 0;
			return (
				<div style={tooltipStyle} className='px-3 py-2'>
					<p className='text-white text-sm'>{displayValue} {displayValue === 1 ? 'player' : 'players'}</p>
				</div>
			);
		}
		return null;
	};


	// Transform team comparison data for radar chart with per-category scaling
	const radarChartData = useMemo(() => {
		if (!teamComparisonData || teamComparisonData.length === 0) return [];

		// Get all stat categories
		const categories = ["Games", "Goals Scored", "Goals Conceded", "Distance (Miles)", "Wins", "Points per Game", "Clean Sheets", "Competitions", "Fantasy Points"];

		// Filter to only visible teams
		const visibleTeamData = teamComparisonData.filter(({ team }: any) => visibleTeams.has(team));
		// If no teams are visible, return empty data structure with categories so chart can still render
		if (visibleTeamData.length === 0) {
			return categories.map((category) => ({ category }));
		}

		// Find max values per category (only for visible teams)
		const maxValues: { [key: string]: number } = {};
		visibleTeamData.forEach(({ data }: any) => {
			if (data) {
				maxValues.Games = Math.max(maxValues.Games || 0, toNumber(data.gamesPlayed));
				maxValues["Goals Scored"] = Math.max(maxValues["Goals Scored"] || 0, toNumber(data.goalsScored));
				maxValues["Goals Conceded"] = Math.max(maxValues["Goals Conceded"] || 0, toNumber(data.goalsConceded));
				maxValues["Distance (Miles)"] = Math.max(maxValues["Distance (Miles)"] || 0, toNumber(data.totalDistance));
				maxValues.Wins = Math.max(maxValues.Wins || 0, toNumber(data.wins));
				maxValues["Points per Game"] = Math.max(maxValues["Points per Game"] || 0, toNumber(data.pointsPerGame));
				maxValues["Clean Sheets"] = Math.max(maxValues["Clean Sheets"] || 0, toNumber(data.cleanSheets));
				maxValues.Competitions = Math.max(maxValues.Competitions || 0, toNumber(data.numberOfCompetitions));
				maxValues["Fantasy Points"] = Math.max(maxValues["Fantasy Points"] || 0, toNumber(data.totalFantasyPoints));
			}
		});

		// Create data points for each category with per-category scaling
		return categories.map((category) => {
			const dataPoint: any = { category };
			visibleTeamData.forEach(({ team, data }: any) => {
				if (data) {
					let value = 0;
					switch (category) {
						case "Games":
							value = toNumber(data.gamesPlayed);
							break;
						case "Goals Scored":
							value = toNumber(data.goalsScored);
							break;
						case "Goals Conceded":
							value = toNumber(data.goalsConceded);
							break;
						case "Distance (Miles)":
							value = toNumber(data.totalDistance);
							break;
						case "Wins":
							value = toNumber(data.wins);
							break;
						case "Points per Game":
							value = toNumber(data.pointsPerGame);
							break;
						case "Clean Sheets":
							value = toNumber(data.cleanSheets);
							break;
						case "Competitions":
							value = toNumber(data.numberOfCompetitions);
							break;
						case "Fantasy Points":
							value = toNumber(data.totalFantasyPoints);
							break;
					}
					// Scale per category to 0-100 (each category has its own max)
					const max = maxValues[category] || 1;
					const teamKey = team.replace(" XI", "s");
					dataPoint[teamKey] = max > 0 ? (value / max) * 100 : 0;
				}
			});
			return dataPoint;
		});
	}, [teamComparisonData, visibleTeams]);

	// Transform player distribution data for sankey
	const sankeyData = useMemo(() => {
		if (!playerDistributionData || !playerDistributionData.distribution) return null;

		const distribution = playerDistributionData.distribution;
		const validTeams = ["1s", "2s", "3s", "4s", "5s", "6s", "7s", "8s"];

		// Filter distribution to only include valid teams
		const filteredDistribution = distribution.filter((item: any) => 
			validTeams.includes(item.team) && item.count > 0
		);

		if (filteredDistribution.length === 0) return null;

		// Create links first to calculate counts
		const links: any[] = [];
		filteredDistribution.forEach((item: any) => {
			if (item.count > 0 && validTeams.includes(item.team)) {
				links.push({
					source: "Players",
					target: item.team,
					value: item.count,
				});
			}
		});

		// Use total players count from teamData (same as Key Performance Stats)
		const totalPlayers = teamData ? toNumber(teamData.numberOfPlayers) : 0;

		// Create nodes with labels that include player counts
		const teamIds: string[] = filteredDistribution.map((item: any) => item.team);
		const nodes = teamIds.map((team: string) => {
			const playerCount = links.find(link => link.target === team)?.value || 0;
			return {
				id: team,
				label: team,
				playerCount: playerCount,
			};
		});

		// Add source node with player count
		nodes.unshift({ id: "Players", label: `Players (${totalPlayers})`, playerCount: totalPlayers });

		return { nodes, links, totalPlayers };
	}, [playerDistributionData, teamData]);

	// Transform player tenure data for histogram
	const tenureHistogramData = useMemo(() => {
		if (!playerTenureData || playerTenureData.length === 0) return [];

		// Create bins
		const bins: { [key: number]: number } = {};
		playerTenureData.forEach((tenure) => {
			bins[tenure] = (bins[tenure] || 0) + 1;
		});

		// Convert to array format
		const maxTenure = Math.max(...playerTenureData, 0);
		const histogram = [];
		for (let i = 1; i <= maxTenure; i++) {
			histogram.push({
				seasons: `${i} ${i === 1 ? "Season" : "Seasons"}`,
				players: bins[i] || 0,
			});
		}

		return histogram;
	}, [playerTenureData]);

	// Get position stat label
	const getPositionStatLabel = (statType: string): string => {
		switch (statType) {
			case "goals":
				return "Goals";
			case "assists":
				return "Assists";
			case "appearances":
				return "Appearances";
			case "cleanSheets":
				return "Clean Sheets";
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
			case "minutes":
				return "Minutes";
			case "mom":
				return "Man of the Matches";
			default:
				return "Goals";
		}
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

			{(isLoadingTeamData || appConfig.forceSkeletonView) ? (
				<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
					<div className='flex-1 px-2 md:px-4 pb-4 min-h-0 overflow-y-auto space-y-4 md:space-y-0 player-stats-masonry'>
						<div className='md:break-inside-avoid md:mb-4'>
							<StatCardSkeleton />
						</div>
						<div className='md:break-inside-avoid md:mb-4'>
							<RadarChartSkeleton />
						</div>
						<div className='md:break-inside-avoid md:mb-4'>
							<TopPlayersTableSkeleton />
						</div>
						<div className='md:break-inside-avoid md:mb-4'>
							<ChartSkeleton />
						</div>
					</div>
				</SkeletonTheme>
			) : !teamData ? (
				<div className='flex-1 flex items-center justify-center p-4'>
					<div className='text-center'>
						<p className='text-white text-sm md:text-base'>No team data available</p>
					</div>
				</div>
			) : (
				<div 
					className='flex-1 px-2 md:px-4 pb-4 min-h-0 overflow-y-auto overflow-x-hidden'
					style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
					{(() => {
						const chartContent = (
							<div className='space-y-4 pb-4 md:space-y-0 player-stats-masonry'>
								{/* Key Performance Stats */}
								{!isDataTableMode && (
									<div id='club-key-performance-stats' className='mb-4 md:break-inside-avoid md:mb-4'>
										<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
							<h3 className='text-white font-semibold text-sm md:text-base mb-3'>Key Club Stats</h3>
							<div className='grid grid-cols-2 md:grid-cols-2 gap-2 md:gap-4'>
								<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
									<div className='flex-shrink-0'>
										<Image
											src='/stat-icons/Teammates-Icon.svg'
											alt='Players'
											width={40}
											height={40}
											className='w-8 h-8 md:w-10 md:h-10 object-contain'
										/>
									</div>
									<div className='flex-1 min-w-0'>
										<div className='text-white/70 text-sm md:text-base mb-1'>Players</div>
										<div className='text-white font-bold text-xl md:text-2xl'>{toNumber(teamData.numberOfPlayers).toLocaleString()}</div>
									</div>
								</div>
								<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
									<div className='flex-shrink-0'>
										<Image
											src='/stat-icons/TeamAppearance-Icon.svg'
											alt='Games'
											width={40}
											height={40}
											className='w-8 h-8 md:w-10 md:h-10 object-contain'
										/>
									</div>
									<div className='flex-1 min-w-0'>
										<div className='text-white/70 text-sm md:text-base mb-1'>Games</div>
										<div className='text-white font-bold text-xl md:text-2xl'>{toNumber(teamData.gamesPlayed).toLocaleString()}</div>
									</div>
								</div>
								<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
									<div className='flex-shrink-0'>
										<Image
											src='/stat-icons/Win-Icon.svg'
											alt='Wins'
											width={40}
											height={40}
											className='w-8 h-8 md:w-10 md:h-10 object-contain'
										/>
									</div>
									<div className='flex-1 min-w-0'>
										<div className='text-white/70 text-sm md:text-base mb-1'>Wins</div>
										<div className='text-white font-bold text-xl md:text-2xl'>{toNumber(teamData.wins).toLocaleString()}</div>
									</div>
								</div>
								<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
									<div className='flex-shrink-0'>
										<Image
											src='/stat-icons/Goals-Icon.svg'
											alt='Goals'
											width={40}
											height={40}
											className='w-8 h-8 md:w-10 md:h-10 object-contain'
										/>
									</div>
									<div className='flex-1 min-w-0'>
										<div className='text-white/70 text-sm md:text-base mb-1'>Goals</div>
										<div className='text-white font-bold text-xl md:text-2xl'>{toNumber(teamData.goalsScored).toLocaleString()}</div>
									</div>
								</div>
								<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
									<div className='flex-shrink-0'>
										<Image
											src='/stat-icons/Competition-Icon.svg'
											alt='Competitions'
											width={40}
											height={40}
											className='w-8 h-8 md:w-10 md:h-10 object-contain'
										/>
									</div>
									<div className='flex-1 min-w-0'>
										<div className='text-white/70 text-sm md:text-base mb-1'>Competitions</div>
										<div className='text-white font-bold text-xl md:text-2xl'>{toNumber(teamData.numberOfCompetitions).toLocaleString()}</div>
									</div>
								</div>
								<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
									<div className='flex-shrink-0'>
										<Image
											src='/stat-icons/CleanSheet-Icon.svg'
											alt='Clean Sheets'
											width={40}
											height={40}
											className='w-8 h-8 md:w-10 md:h-10 object-contain'
										/>
									</div>
									<div className='flex-1 min-w-0'>
										<div className='text-white/70 text-sm md:text-base mb-1'>Clean Sheets</div>
										<div className='text-white font-bold text-xl md:text-2xl'>{toNumber(teamData.cleanSheets).toLocaleString()}</div>
									</div>
								</div>
										</div>
									</div>
								</div>
								)}

								{/* Team Comparison Section */}
					{!isDataTableMode && (isLoadingTeamComparison ? (
						<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
							<RadarChartSkeleton />
						</SkeletonTheme>
					) : !isLoadingTeamComparison && teamComparisonData.length > 0 && (
						<div id='club-team-comparison' className='mb-4 md:break-inside-avoid md:mb-4'>
							<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
								<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Team Comparison</h3>
								{/* Team visibility checkboxes */}
								<div className='mb-3 flex flex-wrap gap-3 justify-center bg-white/25 rounded-lg p-2'>
									{teamComparisonData.map(({ team }, index) => {
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
										const color = teamColors[index % teamColors.length];
										const isVisible = visibleTeams.has(team);
										return (
											<label key={team} className='flex items-center gap-2 cursor-pointer'>
												<input
													type='checkbox'
													checked={isVisible}
													onChange={(e) => {
														const newVisibleTeams = new Set(visibleTeams);
														if (e.target.checked) {
															newVisibleTeams.add(team);
														} else {
															newVisibleTeams.delete(team);
														}
														setVisibleTeams(newVisibleTeams);
													}}
													className='team-comparison-checkbox w-4 h-4 rounded'
													style={{ 
														borderColor: color,
														backgroundColor: isVisible ? color : 'transparent',
													}}
												/>
												<span className='text-white text-sm' style={{ color: color }}>
													{team}
												</span>
											</label>
										);
									})}
								</div>
								<div className='chart-container -my-2' style={{ touchAction: 'pan-y' }}>
									<ResponsiveContainer width='100%' height={300}>
										<RadarChart 
											data={radarChartData}
											margin={{ top: 0, right: 25, bottom: 0, left: 25 }}
										>
											<PolarGrid />
											<PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
											{teamComparisonData
												.filter(({ team }) => visibleTeams.has(team))
												.map(({ team }, index) => {
													const teamKey = team.replace(" XI", "s");
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
													// Find original index for color consistency
													const originalIndex = teamComparisonData.findIndex((t: any) => t.team === team);
													return (
														<Radar
															key={team}
															name={teamKey}
															dataKey={teamKey}
															stroke={teamColors[originalIndex % teamColors.length]}
															fill={teamColors[originalIndex % teamColors.length]}
															fillOpacity={0.3}
														/>
													);
												})}
											<PolarAngleAxis 
												dataKey='category' 
												tick={(props: any) => {
													const { x, y, payload } = props;
													return (
														<g transform={`translate(${x},${y})`}>
															<text
																x={0}
																y={0}
																dy={16}
																textAnchor="middle"
																fill="#fff"
																fontSize={12}
																style={{ cursor: 'pointer' }}
																onClick={(e) => {
																	e.stopPropagation();
																	handleLabelClick(payload.value);
																}}
															>
																{payload.value}
															</text>
														</g>
													);
												}}
											/>
											<Tooltip 
												content={radarTooltip}
											/>
										</RadarChart>
									</ResponsiveContainer>
								</div>
							</div>
						</div>
									))}

								{/* Top Players Table */}
								{!isDataTableMode && (
								<div id='club-top-players' className='mb-4 flex-shrink-0 md:break-inside-avoid md:mb-4'>
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
											<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
												<TopPlayersTableSkeleton />
											</SkeletonTheme>
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
								)}

								{/* Win/Draw/Loss Pie Chart */}
								{pieChartData.length > 0 && (() => {
									const wins = toNumber(teamData.wins || 0);
									const draws = toNumber(teamData.draws || 0);
									const losses = toNumber(teamData.losses || 0);
									const gamesPlayed = wins + draws + losses;
									const pointsPerGame = gamesPlayed > 0 ? ((3 * wins) + (1 * draws)) / gamesPlayed : 0;
									const pointsPerGameFormatted = Math.min(3, Math.max(0, pointsPerGame)).toFixed(1);
									
									return (
									<div id='club-match-results' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Match Results</h3>
										<p className='text-white text-sm mb-2 text-center'>Points per game: {pointsPerGameFormatted}</p>
										<div className='chart-container -my-2' style={{ touchAction: 'pan-y' }}>
											<ResponsiveContainer width='100%' height={220}>
												<PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
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
														outerRadius={90}
														fill='#8884d8'
														dataKey='value'
													>
													{pieChartData.map((entry, index) => (
														<Cell key={`cell-${index}`} fill={entry.color} />
													))}
												</Pie>
												<Tooltip content={customTooltip} />
												</PieChart>
											</ResponsiveContainer>
										</div>
							</div>
						);
								})()}

								{/* Game Details Section */}
								{isLoadingGameDetails ? (
									<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
										<GameDetailsTableSkeleton />
									</SkeletonTheme>
								) : !isLoadingGameDetails && gameDetails && (
									<div id='club-game-details' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-4'>Game Details</h3>
										
										{/* CompType Table */}
										<div className='mb-6'>
											<table className='w-full text-white text-sm'>
												<thead>
													<tr className='border-b border-white/20'>
														<th className='text-left py-2 px-2'>Type</th>
														<th className='text-right py-2 px-2'>Count</th>
														<th className='text-right py-2 px-2'>% Won</th>
													</tr>
												</thead>
												<tbody>
													{(gameDetails.leagueGames || 0) > 0 && (
														<tr className='border-b border-white/10'>
															<td className='py-2 px-2'>
																<span className='px-2 py-1 rounded text-xs font-medium mr-2 bg-blue-600/30 text-blue-300'>League</span>
															</td>
															<td className='text-right py-2 px-2 font-mono'>{gameDetails.leagueGames || 0}</td>
															<td className='text-right py-2 px-2 font-mono'>
																{gameDetails.leagueGames > 0 
																	? ((gameDetails.leagueWins || 0) / gameDetails.leagueGames * 100).toFixed(1) + '%'
																	: '0.0%'}
															</td>
														</tr>
													)}
													{(gameDetails.cupGames || 0) > 0 && (
														<tr className='border-b border-white/10'>
															<td className='py-2 px-2'>
																<span className='px-2 py-1 rounded text-xs font-medium mr-2 bg-purple-600/30 text-purple-300'>Cup</span>
															</td>
															<td className='text-right py-2 px-2 font-mono'>{gameDetails.cupGames || 0}</td>
															<td className='text-right py-2 px-2 font-mono'>
																{gameDetails.cupGames > 0 
																	? ((gameDetails.cupWins || 0) / gameDetails.cupGames * 100).toFixed(1) + '%'
																	: '0.0%'}
															</td>
														</tr>
													)}
													{(gameDetails.friendlyGames || 0) > 0 && (
														<tr>
															<td className='py-2 px-2'>
																<span className='px-2 py-1 rounded text-xs font-medium mr-2 bg-green-600/30 text-green-300'>Friendly</span>
															</td>
															<td className='text-right py-2 px-2 font-mono'>{gameDetails.friendlyGames || 0}</td>
															<td className='text-right py-2 px-2 font-mono'>
																{gameDetails.friendlyGames > 0 
																	? ((gameDetails.friendlyWins || 0) / gameDetails.friendlyGames * 100).toFixed(1) + '%'
																	: '0.0%'}
															</td>
														</tr>
													)}
												</tbody>
											</table>
										</div>

										{/* Home/Away Table */}
										<div className='mb-6'>
											<table className='w-full text-white text-sm'>
												<thead>
													<tr className='border-b border-white/20'>
														<th className='text-left py-2 px-2'>Location</th>
														<th className='text-right py-2 px-2'>Count</th>
														<th className='text-right py-2 px-2'>% Won</th>
													</tr>
												</thead>
												<tbody>
													{(gameDetails.homeGames || 0) > 0 && (
														<tr className='border-b border-white/10'>
															<td className='py-2 px-2'>
																<span className='px-2 py-1 rounded text-xs font-medium mr-2 bg-dorkinians-yellow/20 text-dorkinians-yellow'>Home</span>
															</td>
															<td className='text-right py-2 px-2 font-mono'>{gameDetails.homeGames || 0}</td>
															<td className='text-right py-2 px-2 font-mono'>
																{gameDetails.homeGames > 0 
																	? ((gameDetails.homeWins || 0) / gameDetails.homeGames * 100).toFixed(1) + '%'
																	: '0.0%'}
															</td>
														</tr>
													)}
													{(gameDetails.awayGames || 0) > 0 && (
														<tr>
															<td className='py-2 px-2'>
																<span className='px-2 py-1 rounded text-xs font-medium mr-2 bg-gray-700 text-gray-300'>Away</span>
															</td>
															<td className='text-right py-2 px-2 font-mono'>{gameDetails.awayGames || 0}</td>
															<td className='text-right py-2 px-2 font-mono'>
																{gameDetails.awayGames > 0 
																	? ((gameDetails.awayWins || 0) / gameDetails.awayGames * 100).toFixed(1) + '%'
																	: '0.0%'}
															</td>
														</tr>
													)}
												</tbody>
											</table>
										</div>

										{/* Unique Counts */}
										<div className='space-y-2'>
											<p className='text-white text-sm'>
												<span className='text-white'>Opposition played against: </span>
												<span className='font-mono font-bold'>{gameDetails.uniqueOpponents || 0}</span>
											</p>
											<p className='text-white text-sm'>
												<span className='text-white'>Competitions competed in: </span>
												<span className='font-mono font-bold'>{gameDetails.uniqueCompetitions || 0}</span>
											</p>
										</div>
									</div>
								)}

								{/* Big Club Numbers Section */}
								{teamData && (
									<div id='club-big-club-numbers' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-3'>Big Club Numbers</h3>
										<div className='grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4'>
											{teamData.totalMinutes && toNumber(teamData.totalMinutes) > 0 && (
												<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
													<div className='flex-shrink-0'>
														<Image
															src='/stat-icons/Minutes-Icon.svg'
															alt='Total Minutes'
															width={40}
															height={40}
															className='w-8 h-8 md:w-10 md:h-10 object-contain'
														/>
													</div>
													<div className='flex-1 min-w-0'>
														<div className='text-white/70 text-sm md:text-base mb-1'>Total Minutes Played</div>
														<div className='text-white font-bold text-xl md:text-2xl'>
															{(toNumber(teamData.totalMinutes) / 525600).toFixed(2)} years
														</div>
														<div className='text-white/60 text-xs mt-1'>
															{toNumber(teamData.totalMinutes).toLocaleString()} minutes
														</div>
													</div>
												</div>
											)}
											{teamData.totalDistance && toNumber(teamData.totalDistance) > 0 && (
												<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
													<div className='flex-shrink-0'>
														<Image
															src='/stat-icons/DistanceTravelled-Icon.svg'
															alt='Total Distance'
															width={40}
															height={40}
															className='w-8 h-8 md:w-10 md:h-10 object-contain'
														/>
													</div>
													<div className='flex-1 min-w-0'>
														<div className='text-white/70 text-sm md:text-base mb-1'>Distance Travelled</div>
														<div className='text-white font-bold text-xl md:text-2xl'>
															{(toNumber(teamData.totalDistance) / 238900).toFixed(2)}x to the moon
														</div>
														<div className='text-white/60 text-xs mt-1'>
															{Math.round(toNumber(teamData.totalDistance)).toLocaleString()} miles
														</div>
													</div>
												</div>
											)}
											{(teamData.totalYellowCards || teamData.totalRedCards) && 
												(toNumber(teamData.totalYellowCards || 0) > 0 || toNumber(teamData.totalRedCards || 0) > 0) && (
												<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
													<div className='flex-shrink-0'>
														<Image
															src='/stat-icons/RedCard-Icon.svg'
															alt='Total Cards Cost'
															width={40}
															height={40}
															className='w-8 h-8 md:w-10 md:h-10 object-contain'
														/>
													</div>
													<div className='flex-1 min-w-0'>
														<div className='text-white/70 text-sm md:text-base mb-1'>Total Cards Cost</div>
														<div className='text-white font-bold text-xl md:text-2xl'>
															£{((toNumber(teamData.totalYellowCards || 0) * 13.5) + (toNumber(teamData.totalRedCards || 0) * 55)).toLocaleString()}
														</div>
														<div className='text-white/60 text-xs mt-1'>
															Yellow + Red cards combined
														</div>
													</div>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Goals Scored vs Conceded Waterfall Chart */}
								{(toNumber(teamData.goalsScored) > 0 || toNumber(teamData.goalsConceded) > 0) && (
									<div id='club-goals-scored-conceded' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Goals Scored vs Conceded</h3>
										<div className='chart-container' style={{ touchAction: 'pan-y' }}>
											<ResponsiveContainer width='100%' height={300}>
												<ComposedChart data={goalsData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
													<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
													<XAxis dataKey='name' stroke='#fff' fontSize={12} />
													<YAxis stroke='#fff' fontSize={12} />
													<Tooltip content={customTooltip} />
													<Bar dataKey='value' radius={[4, 4, 0, 0]} opacity={0.8} activeBar={{ opacity: 0.5 }}>
														{goalsData.map((entry, index) => (
															<Cell key={`cell-${index}`} fill={entry.fill} />
														))}
													<LabelList 
														dataKey="value"
														position="inside"
														content={(props: any) => {
															const { x, y, width, height, name, index, value } = props;
															if (value === undefined || value === null || height <= 0) return null;
															// Access perGame from the data entry using index or name
															const dataEntry = typeof index === 'number' && index >= 0 ? goalsData[index] : goalsData.find((e: any) => e.name === name);
															const perGame = dataEntry?.perGame || "0.00";
															// Calculate center position accounting for two-line layout
															const lineHeight = 14;
															const centerY = y + height / 2;
															const startY = centerY - lineHeight / 2;
															return (
																<g>
																	<text
																		x={x + width / 2}
																		y={startY}
																		fill="#ffffff"
																		fontSize={12}
																		fontWeight="bold"
																		textAnchor="middle"
																		dominantBaseline="middle"
																		style={{ pointerEvents: 'none', userSelect: 'none' }}
																	>
																		{value}
																	</text>
																	<text
																		x={x + width / 2}
																		y={startY + lineHeight}
																		fill="#ffffff"
																		fontSize={11}
																		fontWeight="normal"
																		textAnchor="middle"
																		dominantBaseline="middle"
																		style={{ pointerEvents: 'none', userSelect: 'none' }}
																	>
																		{perGame} per game
																	</text>
																</g>
															);
														}}
													/>
													</Bar>
												</ComposedChart>
											</ResponsiveContainer>
										</div>
									</div>
								)}

								{/* Home vs Away Performance Dual Gauge */}
								{(toNumber(teamData.homeGames) > 0 || toNumber(teamData.awayGames) > 0) && (
									<div id='club-home-away-performance' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Home vs Away Performance</h3>
										<HomeAwayGauge 
											homeWinPercentage={toNumber(teamData.homeWinPercentage)} 
											awayWinPercentage={toNumber(teamData.awayWinPercentage)} 
										/>
									</div>
								)}

								{/* Key Team Stats KPI Cards */}
								{toNumber(teamData.gamesPlayed) > 0 && (
									<div id='club-key-team-stats' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-3'>Key Club Stats</h3>
										<div className='grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4'>
											<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
												<div className='flex-shrink-0'>
													<Image
														src='/stat-icons/TeamAppearance-Icon.svg'
														alt='Games'
														width={40}
														height={40}
														className='w-8 h-8 md:w-10 md:h-10 object-contain'
													/>
												</div>
												<div className='flex-1 min-w-0'>
													<div className='text-white/70 text-sm md:text-base mb-1'>Games</div>
													<div className='text-white font-bold text-xl md:text-2xl'>{toNumber(teamData.gamesPlayed).toLocaleString()}</div>
												</div>
											</div>
											<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
												<div className='flex-shrink-0'>
													<Image
														src='/stat-icons/CleanSheet-Icon.svg'
														alt='Clean Sheets'
														width={40}
														height={40}
														className='w-8 h-8 md:w-10 md:h-10 object-contain'
													/>
												</div>
												<div className='flex-1 min-w-0'>
													<div className='text-white/70 text-sm md:text-base mb-1'>Clean Sheets</div>
													<div className='text-white font-bold text-xl md:text-2xl'>{toNumber(teamData.cleanSheets).toLocaleString()}</div>
												</div>
											</div>
											<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
												<div className='flex-shrink-0'>
													<Image
														src='/stat-icons/PointsPerGame-Icon.svg'
														alt='Points/Game'
														width={40}
														height={40}
														className='w-8 h-8 md:w-10 md:h-10 object-contain'
													/>
												</div>
												<div className='flex-1 min-w-0'>
													<div className='text-white/70 text-sm md:text-base mb-1'>Points/Game</div>
													<div className='text-white font-bold text-xl md:text-2xl'>{toNumber(teamData.pointsPerGame).toFixed(2)}</div>
												</div>
											</div>
											<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
												<div className='flex-shrink-0'>
													<Image
														src='/stat-icons/GoalsPerAppearance-Icon.svg'
														alt='Goals/Game'
														width={40}
														height={40}
														className='w-8 h-8 md:w-10 md:h-10 object-contain'
													/>
												</div>
												<div className='flex-1 min-w-0'>
													<div className='text-white/70 text-sm md:text-base mb-1'>Goals/Game</div>
													<div className='text-white font-bold text-xl md:text-2xl'>{toNumber(teamData.goalsPerGame).toFixed(2)}</div>
												</div>
											</div>
											<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
												<div className='flex-shrink-0'>
													<Image
														src='/stat-icons/ConcededPerAppearance-Icon.svg'
														alt='Conceded/Game'
														width={40}
														height={40}
														className='w-8 h-8 md:w-10 md:h-10 object-contain'
													/>
												</div>
												<div className='flex-1 min-w-0'>
													<div className='text-white/70 text-sm md:text-base mb-1'>Conceded/Game</div>
													<div className='text-white font-bold text-xl md:text-2xl'>{toNumber(teamData.goalsConcededPerGame).toFixed(2)}</div>
												</div>
											</div>
											<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
												<div className='flex-shrink-0'>
													<Image
														src='/stat-icons/PercentageGamesWon-Icon.svg'
														alt='Win %'
														width={40}
														height={40}
														className='w-8 h-8 md:w-10 md:h-10 object-contain'
													/>
												</div>
												<div className='flex-1 min-w-0'>
													<div className='text-white/70 text-sm md:text-base mb-1'>Win %</div>
													<div className='text-white font-bold text-xl md:text-2xl'>{Math.round(toNumber(teamData.winPercentage))}%</div>
												</div>
											</div>
											<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
												<div className='flex-shrink-0'>
													<Image
														src='/stat-icons/GoalDifference-Icon.svg'
														alt='Goal Difference'
														width={40}
														height={40}
														className='w-8 h-8 md:w-10 md:h-10 object-contain'
													/>
												</div>
												<div className='flex-1 min-w-0'>
													<div className='text-white/70 text-sm md:text-base mb-1'>Goal Diff</div>
													<div className='text-white font-bold text-xl md:text-2xl'>{toNumber(teamData.goalDifference).toLocaleString()}</div>
												</div>
											</div>
											{teamData.totalFantasyPoints && toNumber(teamData.totalFantasyPoints) > 0 && (
												<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
													<div className='flex-shrink-0'>
														<Image
															src='/stat-icons/FantasyPoints-Icon.svg'
															alt='Fantasy Points'
															width={40}
															height={40}
															className='w-8 h-8 md:w-10 md:h-10 object-contain'
														/>
													</div>
													<div className='flex-1 min-w-0'>
														<div className='text-white/70 text-sm md:text-base mb-1'>Fantasy Points</div>
														<div className='text-white font-bold text-xl md:text-2xl'>{Math.round(toNumber(teamData.totalFantasyPoints)).toLocaleString()}</div>
													</div>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Unique Player Stats Section */}
								{isLoadingUniqueStats ? (
									<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
										<div id='club-unique-player-stats' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
											<Skeleton height={20} width="40%" className="mb-2" />
											<Skeleton height={16} width="60%" className="mb-3" />
											<div className='overflow-x-auto'>
												<table className='w-full text-white text-sm'>
													<thead>
														<tr className='border-b border-white/20'>
															<th className='text-left py-2 px-2'><Skeleton height={16} width={80} /></th>
															<th className='text-right py-2 px-2'><Skeleton height={16} width={100} className="ml-auto" /></th>
														</tr>
													</thead>
													<tbody>
														{[...Array(5)].map((_, i) => (
															<tr key={i} className='border-b border-white/10'>
																<td className='py-2 px-2'><Skeleton height={14} width="70%" /></td>
																<td className='text-right py-2 px-2'><Skeleton height={14} width={30} className="ml-auto" /></td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
									</SkeletonTheme>
								) : !isLoadingUniqueStats && uniquePlayerStats && (
									<div id='club-unique-player-stats' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Unique Player Stats</h3>
										<p className='text-white text-sm md:text-base mb-3'>
											Unique players for the Club: <span className='font-bold'>{toNumber(teamData.numberOfPlayers).toLocaleString()}</span>
										</p>
										<div className='overflow-x-auto'>
											<table className='w-full text-white text-sm'>
												<thead>
													<tr className='border-b border-white/20'>
														<th className='text-left py-2 px-2'>Stat</th>
														<th className='text-right py-2 px-2'>Unique Players</th>
													</tr>
												</thead>
												<tbody>
													{uniquePlayerStats.playersWhoScored > 0 && (
														<tr className='border-b border-white/10'>
															<td className='py-2 px-2'>Players Who Scored</td>
															<td className='text-right py-2 px-2 font-mono font-bold'>{uniquePlayerStats.playersWhoScored}</td>
														</tr>
													)}
													{uniquePlayerStats.playersWhoAssisted > 0 && (
														<tr className='border-b border-white/10'>
															<td className='py-2 px-2'>Players Who Assisted</td>
															<td className='text-right py-2 px-2 font-mono font-bold'>{uniquePlayerStats.playersWhoAssisted}</td>
														</tr>
													)}
													{uniquePlayerStats.playersWithOwnGoals > 0 && (
														<tr className='border-b border-white/10'>
															<td className='py-2 px-2'>Players With Own Goals</td>
															<td className='text-right py-2 px-2 font-mono font-bold'>{uniquePlayerStats.playersWithOwnGoals}</td>
														</tr>
													)}
													{uniquePlayerStats.playersWithCleanSheets > 0 && (
														<tr className='border-b border-white/10'>
															<td className='py-2 px-2'>Players With Clean Sheets</td>
															<td className='text-right py-2 px-2 font-mono font-bold'>{uniquePlayerStats.playersWithCleanSheets}</td>
														</tr>
													)}
													{uniquePlayerStats.playersWithMoM > 0 && (
														<tr className='border-b border-white/10'>
															<td className='py-2 px-2'>Players With MoM</td>
															<td className='text-right py-2 px-2 font-mono font-bold'>{uniquePlayerStats.playersWithMoM}</td>
														</tr>
													)}
													{uniquePlayerStats.playersWithSaves > 0 && (
														<tr className='border-b border-white/10'>
															<td className='py-2 px-2'>Players With Saves</td>
															<td className='text-right py-2 px-2 font-mono font-bold'>{uniquePlayerStats.playersWithSaves}</td>
														</tr>
													)}
													{uniquePlayerStats.playersWithYellowCards > 0 && (
														<tr className='border-b border-white/10'>
															<td className='py-2 px-2'>Players With Yellow Cards</td>
															<td className='text-right py-2 px-2 font-mono font-bold'>{uniquePlayerStats.playersWithYellowCards}</td>
														</tr>
													)}
													{uniquePlayerStats.playersWithRedCards > 0 && (
														<tr className='border-b border-white/10'>
															<td className='py-2 px-2'>Players With Red Cards</td>
															<td className='text-right py-2 px-2 font-mono font-bold'>{uniquePlayerStats.playersWithRedCards}</td>
														</tr>
													)}
													{uniquePlayerStats.playersWhoScoredPenalties > 0 && (
														<tr className='border-b border-white/10'>
															<td className='py-2 px-2'>Players Who Scored Penalties</td>
															<td className='text-right py-2 px-2 font-mono font-bold'>{uniquePlayerStats.playersWhoScoredPenalties}</td>
														</tr>
													)}
													{uniquePlayerStats.playersWhoSavedPenalties > 0 && (
														<tr className='border-b border-white/10'>
															<td className='py-2 px-2'>Players Who Saved Penalties</td>
															<td className='text-right py-2 px-2 font-mono font-bold'>{uniquePlayerStats.playersWhoSavedPenalties}</td>
														</tr>
													)}
													{uniquePlayerStats.playersWhoConcededPenalties > 0 && (
														<tr>
															<td className='py-2 px-2'>Players Who Conceded Penalties</td>
															<td className='text-right py-2 px-2 font-mono font-bold'>{uniquePlayerStats.playersWhoConcededPenalties}</td>
														</tr>
													)}
												</tbody>
											</table>
										</div>
									</div>
								)}
							</div>
						);

						const dataTableContent = (
							<div className='overflow-x-auto flex flex-col'>
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
								{isDataTableMode && (
									isLoadingTeamData ? (
										<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
											<DataTableSkeleton />
										</SkeletonTheme>
									) : (
										dataTableContent
									)
								)}
								<div className='mt-4'></div>
							</>
						);
					})()}

					{/* Seasonal Performance Section */}
					{!isDataTableMode && allSeasonsSelected && (
						<div id='club-seasonal-performance' className='mb-4 md:break-inside-avoid md:mb-4 single-column-section'>
							<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
								<div className='flex items-center justify-between mb-2 gap-2'>
									<h3 className='text-white font-semibold text-sm md:text-base flex-shrink-0'>Seasonal Performance</h3>
									<div className='flex-1 max-w-[45%]'>
										<Listbox value={seasonalSelectedStat} onChange={setSeasonalSelectedStat}>
											<div className='relative'>
												<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-xs md:text-sm'>
													<span className='block truncate text-white'>
														{statOptions.find(opt => opt.value === seasonalSelectedStat)?.label || seasonalSelectedStat}
													</span>
													<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
														<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
													</span>
												</Listbox.Button>
												<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-xs md:text-sm shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
													{statOptions.map((option) => (
														<Listbox.Option
															key={option.value}
															className={({ active }) =>
																`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
															}
															value={option.value}>
															{({ selected }) => (
																<span className={`block truncate py-1 px-2 ${selected ? "font-medium" : "font-normal"}`}>
																	{option.label}
																</span>
															)}
														</Listbox.Option>
													))}
												</Listbox.Options>
											</div>
										</Listbox>
									</div>
								</div>
								<div className='flex items-center justify-center gap-2 mb-2'>
									<input 
										type='checkbox' 
										checked={showTrend} 
										onChange={(e) => setShowTrend(e.target.checked)}
										className='w-4 h-4 accent-dorkinians-yellow cursor-pointer'
										id='show-trend-checkbox-club'
										style={{ accentColor: '#f9ed32' }}
									/>
									<label htmlFor='show-trend-checkbox-club' className='text-white text-xs md:text-sm cursor-pointer'>Show trend</label>
								</div>
								{(isLoadingSeasonalStats || appConfig.forceSkeletonView) ? (
									<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
										<ChartSkeleton />
									</SkeletonTheme>
								) : seasonalChartData.length > 0 ? (
									<div className='chart-container' style={{ touchAction: 'pan-y' }}>
										<ResponsiveContainer width='100%' height={240}>
											<ComposedChart 
												data={seasonalChartData} 
												margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
											>
												<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
												<XAxis dataKey='name' stroke='#fff' fontSize={12} />
												<YAxis stroke='#fff' fontSize={12} />
												<Tooltip content={customTooltip} />
												<Bar 
													dataKey='value' 
													fill='#f9ed32' 
													radius={[4, 4, 0, 0]} 
													opacity={0.9} 
													activeBar={{ fill: '#f9ed32', opacity: 1, stroke: 'none' }}
												/>
												{showTrend && (
													<Line 
														type='linear' 
														dataKey='trendline' 
														stroke='#ffffff' 
														strokeWidth={2}
														strokeDasharray='5 5'
														dot={false}
														activeDot={false}
														isAnimationActive={false}
														connectNulls={false}
													/>
												)}
											</ComposedChart>
										</ResponsiveContainer>
									</div>
								) : (
									<div className='flex items-center justify-center h-64'>
										<p className='text-white text-sm'>No seasonal data available</p>
									</div>
								)}
							</div>
						</div>
					)}

					{/* Player Distribution Section */}
					{!isDataTableMode && (isLoadingPlayerDistribution ? (
						<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
							<div id='club-player-distribution' className='mb-4 md:break-inside-avoid md:mb-4 single-column-section'>
								<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
									<SankeyChartSkeleton />
								</div>
							</div>
						</SkeletonTheme>
					) : !isLoadingPlayerDistribution && sankeyData && sankeyData.nodes.length > 1 && sankeyData.links.length > 0 && (() => {
						// Validate that all links reference existing nodes
						const nodeIds = new Set(sankeyData.nodes.map((n: any) => n.id));
						const validLinks = sankeyData.links.filter((link: any) => 
							nodeIds.has(link.source) && nodeIds.has(link.target)
						);
						
						if (validLinks.length === 0) return null;
						
						// Custom label layer component that shows player count for team nodes
						const CustomLabelLayer = ({ nodes, links: nivoLinks }: any) => {
							return (
								<g>
									{nodes.map((node: any) => {
										const nodeX = (node.x0 + node.x1) / 2;
										const nodeY = node.y0;
										const nodeHeight = node.y1 - node.y0;
										
										if (node.id === "Players") {
											// Look up original node from sankeyData to get label with count
											const originalNode = sankeyData.nodes.find((n: any) => n.id === "Players");
											const labelText = originalNode?.label || node.label || "Players";
											
											// For Players node, show horizontal label at the top
											return (
												<g key={node.id}>
													<text
														x={nodeX}
														y={nodeY - 10}
														textAnchor="middle"
														dominantBaseline="middle"
														fill="#fff"
														fontSize={12}
														fontWeight="bold"
													>
														{labelText}
													</text>
												</g>
											);
										}
										// For team nodes, show label and player count below
										// Find the link that targets this node to get the correct count
										// First try to get from node's playerCount property (set in sankeyData)
										// Then try from validLinks (original data)
										// Finally try from Nivo's processed links
										let playerCount = node.playerCount;
										if (!playerCount) {
											// Try from original validLinks first (most reliable)
											const originalLink = validLinks.find((l: any) => l.target === node.id);
											if (originalLink) {
												playerCount = originalLink.value;
											} else {
												// Fall back to Nivo's processed links
												const matchingLink = nivoLinks.find((link: any) => {
													const targetId = typeof link.target === 'object' ? (link.target.id ?? link.target) : link.target;
													return targetId === node.id;
												});
												playerCount = matchingLink?.data?.value ?? matchingLink?.value ?? matchingLink?.thickness ?? 0;
											}
										}
										return (
											<g key={node.id}>
												<text
													x={nodeX}
													y={nodeY + nodeHeight + 25}
													textAnchor="middle"
													dominantBaseline="middle"
													fill="#fff"
													fontSize={12}
													fontWeight="bold"
												>
													{node.label}
												</text>
												<text
													x={nodeX}
													y={nodeY + nodeHeight + 40}
													textAnchor="middle"
													dominantBaseline="middle"
													fill="#fff"
													fontSize={11}
												>
													{playerCount}
												</text>
											</g>
										);
									})}
								</g>
							);
						};
						
						return (
						<div id='club-player-distribution' className='mb-4 md:break-inside-avoid md:mb-4 single-column-section'>
							<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
								<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Player Distribution</h3>
								<div className='chart-container' style={{ touchAction: 'pan-y', height: '320px' }}>
									<ResponsiveSankey
										data={{ nodes: sankeyData.nodes, links: validLinks }}
										margin={{ top: 40, right: 20, bottom: 60, left: 20 }}
										layout="vertical"
										align="justify"
										colors={{ scheme: 'set3' }}
										nodeOpacity={0.8}
										nodeThickness={18}
										nodeSpacing={24}
										nodeBorderWidth={0}
										nodeBorderColor={{ from: 'color', modifiers: [['darker', 0.8]] }}
										linkOpacity={0.4}
										linkHoverOthersOpacity={0.1}
										enableLinkGradient={true}
										labelPosition="outside"
										labelOrientation="horizontal"
										labelPadding={8}
										labelTextColor={{ from: 'color', modifiers: [['darker', 1]] }}
										nodeTooltip={() => null}
										linkTooltip={() => null}
										isInteractive={false}
										layers={['links', 'nodes', CustomLabelLayer as any, 'legends']}
										theme={{
											text: { fill: '#fff', fontSize: 12 },
										}}
									/>
								</div>
							</div>
						</div>
						);
					})())}

					{/* Player Tenure Section */}
					{!isDataTableMode && (isLoadingPlayerTenure ? (
						<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
							<div id='club-player-tenure' className='mb-4 md:break-inside-avoid md:mb-4 single-column-section'>
								<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
									<Skeleton height={20} width="40%" className="mb-2" />
									<ChartSkeleton />
								</div>
							</div>
						</SkeletonTheme>
					) : !isLoadingPlayerTenure && tenureHistogramData.length > 0 && (
						<div id='club-player-tenure' className='mb-4 md:break-inside-avoid md:mb-4 single-column-section'>
							<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
								<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Player Tenure</h3>
								<div className='chart-container' style={{ touchAction: 'pan-y' }}>
									<ResponsiveContainer width='100%' height={300}>
										<BarChart data={tenureHistogramData} layout="vertical" margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
											<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
											<XAxis type="number" stroke='#fff' fontSize={12} />
											<YAxis type="category" dataKey='seasons' stroke='#fff' fontSize={12} width={120} />
											<Tooltip content={tenureTooltip} />
											<Bar dataKey='players' fill='#f9ed32' radius={[0, 4, 4, 0]} opacity={0.8} activeBar={{ opacity: 0.5 }} />
										</BarChart>
									</ResponsiveContainer>
								</div>
							</div>
						</div>
					))}

					{/* Stats Distribution Section */}
					{!isDataTableMode && (
					<div id='club-stats-distribution' className='mb-4 md:break-inside-avoid md:mb-4 single-column-section'>
						<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
							<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Stats Distribution</h3>
							<div className='mb-2'>
								<Listbox value={selectedPositionStat} onChange={setSelectedPositionStat}>
									<div className='relative'>
										<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-xs md:text-sm'>
											<span className='block truncate text-white'>
												{getPositionStatLabel(selectedPositionStat)}
											</span>
											<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
												<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
											</span>
										</Listbox.Button>
										<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-xs md:text-sm shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
											{["goals", "assists", "appearances", "cleanSheets", "saves", "yellowCards", "redCards", "penaltiesScored", "fantasyPoints", "minutes", "mom"].map((statType) => (
												<Listbox.Option
													key={statType}
													className={({ active }) =>
														`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
													}
													value={statType}>
													{({ selected }) => (
														<span className={`block truncate py-1 px-2 ${selected ? "font-medium" : "font-normal"}`}>
															{getPositionStatLabel(statType)}
														</span>
													)}
												</Listbox.Option>
											))}
										</Listbox.Options>
									</div>
								</Listbox>
							</div>
							{isLoadingPositionStats ? (
								<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
									<ChartSkeleton />
								</SkeletonTheme>
							) : positionStatsData.length > 0 ? (
								<div className='chart-container' style={{ touchAction: 'pan-y' }}>
									<ResponsiveContainer width='100%' height={300}>
										<BarChart data={positionStatsData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
											<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
											<XAxis dataKey='position' stroke='#fff' fontSize={12} />
											<YAxis 
												stroke='#fff' 
												fontSize={12} 
												tickFormatter={(value) => value.toLocaleString('en-US')}
											/>
											<Tooltip content={statsDistributionTooltip} />
											<Bar dataKey='value' fill='#22c55e' radius={[4, 4, 0, 0]} opacity={0.8} activeBar={{ opacity: 0.5 }} />
										</BarChart>
									</ResponsiveContainer>
								</div>
							) : (
								<div className='chart-container flex items-center justify-center' style={{ touchAction: 'pan-y', height: '300px' }}>
									<p className='text-white text-sm'>No data available</p>
								</div>
							)}
						</div>
					</div>
					)}
				</div>
			)}
		</div>
	);
}

