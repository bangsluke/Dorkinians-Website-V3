"use client";

import { useNavigationStore, type TeamData } from "@/lib/stores/navigation";
import { statObject, statsPageConfig, appConfig } from "@/config/config";
import Image from "next/image";
import { useState, useMemo, useEffect, useRef } from "react";
import { cachedFetch, generatePageCacheKey } from "@/lib/utils/pageCache";
import { createPortal } from "react-dom";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import FilterPills from "@/components/filters/FilterPills";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line, LabelList } from "recharts";
import RecentGamesForm from "./RecentGamesForm";
import { safeLocalStorageGet, safeLocalStorageSet, getPWADebugInfo } from "@/lib/utils/pwaDebug";
import HomeAwayGauge from "./HomeAwayGauge";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { StatCardSkeleton, ChartSkeleton, TableSkeleton, TopPlayersTableSkeleton, BestSeasonFinishSkeleton, RecentGamesSkeleton, DataTableSkeleton } from "@/components/skeletons";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/StateComponents";
import { useToast } from "@/lib/hooks/useToast";
import { log } from "@/lib/utils/logger";
import Button from "@/components/ui/Button";


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
		
		try {
			while (current && typeof document !== 'undefined' && current !== document.body) {
				try {
					const style = window.getComputedStyle(current);
					const overflowY = style.overflowY;
					const overflowX = style.overflowX;
					
					if (overflowY === 'auto' || overflowY === 'scroll' || overflowX === 'auto' || overflowX === 'scroll') {
						containers.push(current);
					}
				} catch (e) {
					// Element may not be in DOM or computed style unavailable
					break;
				}
				
				current = current.parentElement;
			}
		} catch (e) {
			// Silently fail if DOM traversal fails
		}
		
		return containers;
	};

	const updateTooltipPosition = () => {
		if (!rowRef.current || typeof window === 'undefined') return;
		
		try {
			const rect = rowRef.current.getBoundingClientRect();
			const viewportHeight = window.innerHeight || 0;
			const viewportWidth = window.innerWidth || 0;
			const scrollY = window.scrollY || 0;
			const scrollX = window.scrollX || 0;
			
			// Find scroll containers
			const scrollContainers = findScrollContainers(rowRef.current);
			
			// Calculate tooltip dimensions - use actual if available, otherwise estimate
			let tooltipHeight = 60; // Default estimate
			const tooltipWidth = 256; // w-64 = 16rem = 256px
			
			// Try to measure actual tooltip if it exists
			if (tooltipRef.current) {
				try {
					const tooltipRect = tooltipRef.current.getBoundingClientRect();
					tooltipHeight = tooltipRect.height || 60;
				} catch (e) {
					// Tooltip not yet rendered or not measurable
				}
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
				top = rect.top + scrollY - tooltipHeight - arrowHeight - spacing;
			} else if (spaceBelow >= neededSpaceBelow) {
				// Show below if enough space
				placement = 'below';
				top = rect.bottom + scrollY + spacing;
			} else {
				// Default to above if neither has enough space (prefer above to avoid going off bottom)
				placement = 'above';
				top = Math.max(margin, rect.top + scrollY - tooltipHeight - arrowHeight - spacing);
			}
			
			// Calculate horizontal position (center on row, but keep within viewport)
			let left = rect.left + scrollX + (rect.width / 2) - (tooltipWidth / 2);
			
			// Ensure tooltip stays within viewport with margin
			if (left < scrollX + margin) {
				left = scrollX + margin;
			} else if (left + tooltipWidth > scrollX + viewportWidth - margin) {
				left = scrollX + viewportWidth - tooltipWidth - margin;
			}
			
			setTooltipPosition({ top, left, placement });
		} catch (e) {
			// Silently fail if positioning fails
			console.error('Error updating tooltip position:', e);
		}
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
		// Use animation token: --delay-tooltip-mouse (300ms)
		timeoutRef.current = setTimeout(() => {
			setShowTooltip(true);
		}, 300);
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
				<td className='px-3 md:px-4 py-2 md:py-3'>
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
				<td className='px-3 md:px-4 py-2 md:py-3'>
					<span className='text-white font-medium text-xs md:text-sm'>{stat.displayText}</span>
				</td>
				<td className='px-3 md:px-4 py-2 md:py-3 text-right'>
					<span className='text-white font-mono text-xs md:text-sm'>
						{formatStatValue(value, stat.statFormat, stat.numberDecimalPlaces, (stat as any).statUnit)}
					</span>
				</td>
			</tr>
			{showTooltip && tooltipPosition && typeof document !== 'undefined' && document.body && createPortal(
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

export default function TeamStats() {
	const {
		selectedPlayer,
		cachedPlayerData,
		playerFilters,
		currentStatsSubPage,
		filterData,
		shouldShowDataTable,
		setDataTableMode,
		getCachedPageData,
		setCachedPageData,
	} = useNavigationStore();

	// Initialize selected team from localStorage, player's most played team, or first available team
	const [selectedTeam, setSelectedTeam] = useState<string>(() => {
		if (typeof window !== "undefined" && selectedPlayer) {
			const storageKey = `team-stats-selected-team-${selectedPlayer}`;
			const saved = safeLocalStorageGet(storageKey);
			if (saved) {
				return saved;
			}
		}
		return "";
	});
	const [teamData, setTeamData] = useState<TeamData | null>(null);
	const [isLoadingTeamData, setIsLoadingTeamData] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { showError } = useToast();
	
	// Top players table state
	const [selectedStatType, setSelectedStatType] = useState<StatType>(() => {
		if (typeof window !== "undefined") {
			const saved = safeLocalStorageGet("team-stats-top-players-stat-type");
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
			const saved = safeLocalStorageGet("team-stats-view-mode");
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
			safeLocalStorageSet("team-stats-view-mode", isDataTableMode ? "true" : "false");
		}
	}, [isDataTableMode]);

	// State for seasonal performance chart
	const [seasonalSelectedStat, setSeasonalSelectedStat] = useState<string>("Games");
	const [seasonalStats, setSeasonalStats] = useState<any[]>([]);
	const [isLoadingSeasonalStats, setIsLoadingSeasonalStats] = useState(false);
	const [showTrend, setShowTrend] = useState(true);

	// State for unique player stats
	const [uniquePlayerStats, setUniquePlayerStats] = useState<any>(null);
	const [isLoadingUniqueStats, setIsLoadingUniqueStats] = useState(false);

	// State for best season finish
	const [bestSeasonFinishData, setBestSeasonFinishData] = useState<{
		season: string;
		division: string;
		table: Array<{
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
		}>;
		captains: string[];
		teamKey?: string;
	} | null>(null);
	const [isLoadingBestSeasonFinish, setIsLoadingBestSeasonFinish] = useState(false);
	const [bestSeasonFinishError, setBestSeasonFinishError] = useState<string | null>(null);

	// Track previous player to detect changes
	const previousPlayerRef = useRef<string | null>(selectedPlayer);
	
	// Track last fetched filters to implement caching
	const lastFetchedFiltersRef = useRef<string | null>(null);

	// Initialize or reset selected team when player or teams data changes
	useEffect(() => {
		if (!selectedPlayer || !filterData.teams || filterData.teams.length === 0) {
			if (!selectedPlayer) {
				setSelectedTeam("");
				previousPlayerRef.current = null;
			}
			return;
		}

		const playerChanged = previousPlayerRef.current !== selectedPlayer;
		previousPlayerRef.current = selectedPlayer;
		
		// Reset cache when player changes
		if (playerChanged) {
			lastFetchedFiltersRef.current = null;
			setTeamData(null);
		}

		const storageKey = `team-stats-selected-team-${selectedPlayer}`;
		const savedTeam = typeof window !== "undefined" ? safeLocalStorageGet(storageKey) : null;
		
		// Check if saved team is valid
		if (savedTeam && filterData.teams.some(team => team.name === savedTeam)) {
			// Use saved team if it exists and is valid
			setSelectedTeam(savedTeam);
		} else {
			// No saved team or saved team is invalid, use most played team or first available
			const defaultTeam = cachedPlayerData?.playerData?.mostPlayedForTeam || filterData.teams[0]?.name || "";
			if (defaultTeam && filterData.teams.some(team => team.name === defaultTeam)) {
				setSelectedTeam(defaultTeam);
			}
		}
	}, [selectedPlayer, filterData.teams, cachedPlayerData?.playerData?.mostPlayedForTeam]);

	// Save selected team to localStorage when it changes (only if player is selected)
	useEffect(() => {
		if (selectedPlayer && selectedTeam && typeof window !== "undefined") {
			const storageKey = `team-stats-selected-team-${selectedPlayer}`;
			const success = safeLocalStorageSet(storageKey, selectedTeam);
			if (!success) {
				// Log PWA debug info if localStorage write fails
				const pwaDebugInfo = getPWADebugInfo();
				log("warn", '[TeamStats] Failed to save selected team to localStorage. PWA Debug Info:', pwaDebugInfo);
			}
		}
	}, [selectedTeam, selectedPlayer]);

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
			const success = safeLocalStorageSet("team-stats-top-players-stat-type", selectedStatType);
			if (!success) {
				// Log PWA debug info if localStorage write fails
				const pwaDebugInfo = getPWADebugInfo();
				console.warn('[TeamStats] Failed to save selected stat type to localStorage. PWA Debug Info:', pwaDebugInfo);
			}
		}
	}, [selectedStatType]);

	// Build filters for API calls (exclude team filter from playerFilters, add selected team)
	const apiFilters = useMemo(() => {
		if (!playerFilters) return null;
		if (!selectedTeam) return playerFilters;
		
		return {
			...playerFilters,
			teams: [selectedTeam],
		};
	}, [selectedTeam, playerFilters]);

	// Priority 1: Above fold on mobile - Key Performance Stats and Recent Form sections
	// Fetch team data when selected team or filters change
	const filtersKey = JSON.stringify({ selectedTeam, playerFilters: apiFilters || {} });
	
	useEffect(() => {
		if (!selectedTeam || !playerFilters) return;

		// Check if we already have data for this filter combination
		if (teamData && lastFetchedFiltersRef.current === filtersKey) {
			return; // Data already loaded for these filters, skip fetch
		}

		const fetchTeamData = async () => {
			setIsLoadingTeamData(true);
			try {
				const { getCsrfHeaders } = await import("@/lib/middleware/csrf");
				const csrfHeaders = getCsrfHeaders();
				
				const requestBody = {
					teamName: selectedTeam,
					filters: {
						...playerFilters,
						teams: [], // Don't pass teams in filters, use teamName instead
					},
				};
				
				const cacheKey = generatePageCacheKey("stats", "team-stats", "team-data-filtered", {
					teamName: selectedTeam,
					filters: requestBody.filters,
				});
				
				const data = await cachedFetch("/api/team-data-filtered", {
					method: "POST",
					body: requestBody,
					headers: csrfHeaders,
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				
				setTeamData(data.teamData);
				lastFetchedFiltersRef.current = filtersKey; // Store the filters key for this data
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : "Failed to load team data";
				setError(errorMessage);
				console.error("Error fetching team data:", error);
				// Log PWA debug info on error
				const pwaDebugInfo = getPWADebugInfo();
				console.error("[TeamStats] PWA Debug Info on team data fetch error:", pwaDebugInfo);
				setTeamData(null);
				lastFetchedFiltersRef.current = null;
			} finally {
				setIsLoadingTeamData(false);
			}
		};

		fetchTeamData();
	}, [filtersKey, selectedTeam, playerFilters]);

	// Priority 1: Above fold on mobile - Top Players section
	// Fetch top players when selected team, filters or stat type changes
	useEffect(() => {
		if (!selectedTeam || !apiFilters) return;

		const fetchTopPlayers = async () => {
			setIsLoadingTopPlayers(true);
			log("info", `[TeamStats] Fetching top players for statType: ${selectedStatType}`, {
				selectedTeam,
				filters: apiFilters,
			});
			
			try {
				const requestBody = {
					filters: apiFilters,
					statType: selectedStatType,
				};
				
				const cacheKey = generatePageCacheKey("stats", "team-stats", "top-players-stats", {
					...requestBody,
					selectedTeam,
				});
				
				const data = await cachedFetch("/api/top-players-stats", {
					method: "POST",
					body: requestBody,
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				
				log("info", `[TeamStats] Received ${data.players?.length || 0} players for statType: ${selectedStatType}`, data.players);
				setTopPlayers(data.players || []);
			} catch (error) {
				log("error", "[TeamStats] Error fetching top players:", error);
				// Log PWA debug info on error
				const pwaDebugInfo = getPWADebugInfo();
				log("error", "[TeamStats] PWA Debug Info on top players fetch error:", pwaDebugInfo);
				setTopPlayers([]);
			} finally {
				setIsLoadingTopPlayers(false);
			}
		};

		fetchTopPlayers();
	}, [filtersKey, selectedStatType, selectedTeam, apiFilters]);

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

	// Filter detection for best season finish section
	const isSeasonFilter = useMemo(() => {
		return playerFilters?.timeRange?.type === "season" && 
			playerFilters.timeRange.seasons?.length === 1;
	}, [playerFilters?.timeRange]);

	const isDateRangeFilter = useMemo(() => {
		return ["betweenDates", "beforeDate", "afterDate"].includes(
			playerFilters?.timeRange?.type || ""
		);
	}, [playerFilters?.timeRange?.type]);

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

	// Priority 3: Below fold - Unique Player Stats section
	// Fetch unique player stats when team selected and filters change
	useEffect(() => {
		if (!selectedTeam || !apiFilters) {
			setUniquePlayerStats(null);
			return;
		}

		const fetchUniqueStats = async () => {
			setIsLoadingUniqueStats(true);
			try {
				const requestBody = {
					teamName: selectedTeam,
					filters: apiFilters,
				};
				const cacheKey = generatePageCacheKey("stats", "team-stats", "unique-player-stats", requestBody);
				const data = await cachedFetch("/api/unique-player-stats", {
					method: "POST",
					body: requestBody,
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				setUniquePlayerStats(data);
			} catch (error) {
				log("error", "Error fetching unique player stats:", error);
				setUniquePlayerStats(null);
			} finally {
				setIsLoadingUniqueStats(false);
			}
		};

		fetchUniqueStats();
	}, [selectedTeam, apiFilters]);

	// Priority 3: Below fold - Best Season Finish section
	// Fetch best season finish data when team selected and filters change
	useEffect(() => {
		if (!selectedTeam) {
			setBestSeasonFinishData(null);
			setBestSeasonFinishError(null);
			return;
		}

		// Don't fetch if date range filter is active
		if (isDateRangeFilter) {
			setBestSeasonFinishData(null);
			setBestSeasonFinishError(null);
			return;
		}

		const fetchBestSeasonFinish = async () => {
			setIsLoadingBestSeasonFinish(true);
			setBestSeasonFinishError(null);
			try {
				const season = isSeasonFilter ? playerFilters?.timeRange?.seasons?.[0] : null;
				const requestBody = {
					teamName: selectedTeam,
					season: season || undefined,
				};
				const cacheKey = generatePageCacheKey("stats", "team-stats", "team-best-season-finish", requestBody);
				const data = await cachedFetch("/api/team-best-season-finish", {
					method: "POST",
					body: requestBody,
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				setBestSeasonFinishData(data);
			} catch (error: any) {
				log("error", "Error fetching best season finish:", error);
				setBestSeasonFinishError(error?.error || "Failed to fetch best season finish");
				setBestSeasonFinishData(null);
			} finally {
				setIsLoadingBestSeasonFinish(false);
			}
		};

		fetchBestSeasonFinish();
	}, [selectedTeam, isSeasonFilter, isDateRangeFilter, playerFilters?.timeRange?.seasons]);

	// Priority 3: Below fold - Seasonal Performance section
	// Fetch seasonal stats when team selected and all seasons selected
	useEffect(() => {
		if (!selectedTeam || !allSeasonsSelected || !apiFilters) {
			setSeasonalStats([]);
			return;
		}

		const fetchSeasonalStats = async () => {
			setIsLoadingSeasonalStats(true);
			try {
				const requestBody = {
					teamName: selectedTeam,
					filters: apiFilters,
				};
				const cacheKey = generatePageCacheKey("stats", "team-stats", "team-seasonal-stats", requestBody);
				const data = await cachedFetch("/api/team-seasonal-stats", {
					method: "POST",
					body: requestBody,
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				setSeasonalStats(data.seasonalStats || []);
			} catch (error) {
				log("error", "Error fetching seasonal stats:", error);
			} finally {
				setIsLoadingSeasonalStats(false);
			}
		};

		fetchSeasonalStats();
	}, [selectedTeam, allSeasonsSelected, apiFilters]);

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

	// Show loading state
	if (isLoadingTeamData && !teamData) {
		return (
			<div className='h-full flex flex-col'>
				<div className='flex-shrink-0 p-2 md:p-4'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow text-center mb-4'>Team Stats</h2>
				</div>
				<div className='flex-1 px-2 md:px-4 pb-4'>
					<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
						<StatCardSkeleton />
					</SkeletonTheme>
				</div>
			</div>
		);
	}

	// Show error state
	if (error && !teamData) {
		return (
			<div className='h-full flex flex-col'>
				<div className='flex-shrink-0 p-2 md:p-4'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow text-center mb-4'>Team Stats</h2>
				</div>
				<div className='flex-1 px-2 md:px-4 pb-4 flex items-center justify-center'>
					<ErrorState 
						message="Failed to load team stats" 
						error={error}
						onShowToast={showError}
						showToast={true}
						onRetry={() => {
							setError(null);
							// Data will refresh when selectedTeam or filters change
						}}
					/>
				</div>
			</div>
		);
	}

	// Show empty state if no team selected
	if (!selectedTeam) {
		return (
			<div className='h-full flex flex-col'>
				<div className='flex-shrink-0 p-2 md:p-4'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow text-center mb-4'>Team Stats</h2>
				</div>
				<div className='flex-1 px-2 md:px-4 pb-4 flex items-center justify-center'>
					<EmptyState 
						title="No team selected"
						message="Please select a team from the dropdown above to view team statistics."
					/>
				</div>
			</div>
		);
	}

	return (
		<div className='h-full flex flex-col'>
			<div className='flex-shrink-0 p-2 md:p-4'>
				<div className='flex items-center justify-center mb-2 md:mb-4 relative'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow text-center'>Team Stats</h2>
				</div>
				{/* Team Selection Dropdown */}
				<div className='mb-2 md:mb-4 flex justify-center'>
					<div className='w-full max-w-xs'>
						<Listbox value={selectedTeam} onChange={setSelectedTeam}>
							<div className='relative'>
								<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-xs md:text-sm'>
									<span className='block truncate text-white'>
										{selectedTeam || "Select a team"}
									</span>
									<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
										<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
									</span>
								</Listbox.Button>
								<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-xs md:text-sm shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
									{filterData.teams && filterData.teams.length > 0 ? (
										filterData.teams.map((team) => (
											<Listbox.Option
												key={team.name}
												className={({ active }) =>
													`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
												}
												value={team.name}>
												{({ selected }) => (
													<span className={`block truncate py-1 px-2 ${selected ? "font-medium" : "font-normal"}`}>
														{team.name}
													</span>
												)}
											</Listbox.Option>
										))
									) : (
										<div className='py-1 px-2 text-white text-xs'>Loading teams...</div>
									)}
								</Listbox.Options>
							</div>
						</Listbox>
					</div>
				</div>
				<div className='flex justify-center mb-2 md:mb-4'>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setIsDataTableMode(!isDataTableMode)}
						className='underline'>
						{isDataTableMode ? "Switch to data visualisation" : "Switch to data table"}
					</Button>
				</div>
				<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
			</div>

			{!selectedTeam ? (
				<div className='flex-1 flex items-center justify-center p-4'>
					<div className='text-center'>
						<p className='text-white text-sm md:text-base'>Please select a team to view stats</p>
					</div>
				</div>
			) : (isLoadingTeamData || appConfig.forceSkeletonView) ? (
				<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
					<div className='flex-1 px-2 md:px-4 pb-4 min-h-0 overflow-y-auto space-y-4 md:space-y-0 player-stats-masonry'>
						<div className='md:break-inside-avoid md:mb-4'>
							<TopPlayersTableSkeleton />
						</div>
						<div className='md:break-inside-avoid md:mb-4'>
							<StatCardSkeleton />
						</div>
						<div className='md:break-inside-avoid md:mb-4'>
							<RecentGamesSkeleton />
						</div>
						<div className='md:break-inside-avoid md:mb-4'>
							<ChartSkeleton showDropdown={true} showTrend={true} noContainer={false} />
						</div>
						<div className='md:break-inside-avoid md:mb-4'>
							<ChartSkeleton showDropdown={false} showTrend={false} noContainer={false} />
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
								{/* Key Performance Stats - Only show in data visualisation mode */}
								{!isDataTableMode && (
									<div id='team-key-performance-stats' className='md:break-inside-avoid md:mb-4'>
										<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
											<h3 className='text-white font-semibold text-sm md:text-base mb-3'>Key Performance Stats</h3>
											<div className='grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4'>
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

								{/* Recent Games Form */}
								{!isDataTableMode && selectedTeam && apiFilters && (
									<div id='team-recent-games' className='md:break-inside-avoid md:mb-4'>
										<RecentGamesForm teamName={selectedTeam} filters={apiFilters} />
									</div>
								)}
								{/* Top Players Table */}
								<div id='team-top-players' className='mb-4 flex-shrink-0 md:break-inside-avoid md:mb-4'>
									<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-2' data-testid="team-top-players-heading">Top 5 {getStatTypeLabel(selectedStatType)}</h3>
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

								{/* Seasonal Performance Section */}
								{allSeasonsSelected && (
									<div id='team-seasonal-performance' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
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
												id='show-trend-checkbox-team'
												style={{ accentColor: '#f9ed32' }}
											/>
											<label htmlFor='show-trend-checkbox-team' className='text-white text-xs md:text-sm cursor-pointer'>Show trend</label>
										</div>
										{(isLoadingSeasonalStats || appConfig.forceSkeletonView) ? (
											<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
												<ChartSkeleton showDropdown={true} noContainer={true} />
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
									<div id='team-match-results' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
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

								{/* Goals Scored vs Conceded Waterfall Chart */}
								{(toNumber(teamData.goalsScored) > 0 || toNumber(teamData.goalsConceded) > 0) && (
									<div id='team-goals-scored-conceded' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
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
									<div id='team-home-away-performance' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Home vs Away Performance</h3>
										<HomeAwayGauge 
											homeWinPercentage={toNumber(teamData.homeWinPercentage)} 
											awayWinPercentage={toNumber(teamData.awayWinPercentage)} 
										/>
									</div>
								)}

								{/* Key Team Stats KPI Cards */}
								{toNumber(teamData.gamesPlayed) > 0 && (
									<div id='team-key-team-stats' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-3'>Key Team Stats</h3>
										<div className='grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4'>
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
										<div id='team-unique-player-stats' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
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
								) : uniquePlayerStats && (
									<div id='team-unique-player-stats' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
										<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Unique Player Stats</h3>
										<p className='text-white text-sm md:text-base mb-3'>
											Unique players for the {selectedTeam || "2s"}: <span className='font-bold'>{toNumber(teamData.numberOfPlayers).toLocaleString()}</span>
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

								{/* Best Season Finish Section */}
								{selectedTeam && (
									<div id='team-best-season-finish' className='md:break-inside-avoid md:mb-4'>
										{isDateRangeFilter ? (
											<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
												<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Best Season Finish</h3>
												<p className='text-white text-sm md:text-base text-center py-4'>
													Unfilter time frame to see Best Season Finish
												</p>
											</div>
										) : (
											<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
												<h3 className='text-white font-semibold text-sm md:text-base mb-4'>
													{isSeasonFilter ? "Season Finish" : "Best Season Finish"}
												</h3>
												{isLoadingBestSeasonFinish ? (
													<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
														<BestSeasonFinishSkeleton />
													</SkeletonTheme>
												) : bestSeasonFinishError ? (
													<div className='flex items-center justify-center py-8'>
														<p className='text-white text-sm md:text-base text-center'>{bestSeasonFinishError}</p>
													</div>
												) : bestSeasonFinishData ? (
													<>
														{/* League name and season */}
														<div className='text-center mb-4'>
															<div className='text-lg md:text-xl font-bold text-white mb-1'>
																{bestSeasonFinishData.season}
															</div>
															{bestSeasonFinishData.division && bestSeasonFinishData.division.trim() !== '' && (
																<h4 className='text-lg md:text-xl font-bold text-dorkinians-yellow'>
																	{bestSeasonFinishData.division}
																</h4>
															)}
														</div>

														{/* Captains */}
														{bestSeasonFinishData.captains && bestSeasonFinishData.captains.length > 0 && (
															<div className='mb-4 text-center'>
																<p className='text-white text-sm md:text-base mb-1'>
																	<span className='text-gray-300'>Captains: </span>
																	<span className='font-semibold'>{bestSeasonFinishData.captains.join(", ")}</span>
																</p>
															</div>
														)}

														{/* League Table */}
														{bestSeasonFinishData.table && bestSeasonFinishData.table.length > 0 ? (
															<div className='overflow-x-auto -mx-3 md:-mx-6 px-3 md:px-6'>
																<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden text-[10px] md:text-xs'>
																	<thead className='sticky top-0 z-10'>
																		<tr className='bg-white/20'>
																			<th className='w-6 px-0.5 py-1.5 text-left text-white font-semibold'></th>
																			<th className='px-1.5 py-1.5 text-left text-white font-semibold max-w-[120px]'>Team</th>
																			<th className='w-8 px-0.5 py-1.5 text-center text-white font-semibold'>P</th>
																			<th className='w-8 px-0.5 py-1.5 text-center text-white font-semibold'>W</th>
																			<th className='w-8 px-0.5 py-1.5 text-center text-white font-semibold'>D</th>
																			<th className='w-8 px-0.5 py-1.5 text-center text-white font-semibold'>L</th>
																			<th className='w-10 px-0.5 py-1.5 text-center text-white font-semibold'>F</th>
																			<th className='w-10 px-0.5 py-1.5 text-center text-white font-semibold'>A</th>
																			<th className='w-10 px-0.5 py-1.5 text-center text-white font-semibold'>GD</th>
																			<th className='w-10 px-0.5 py-1.5 text-center text-white font-semibold'>Pts</th>
																		</tr>
																	</thead>
																	<tbody>
																		{bestSeasonFinishData.table.map((entry, index) => {
																			// Match only the specific team being queried, not all Dorkinians teams
																			const teamKey = bestSeasonFinishData.teamKey || selectedTeam;
																			const teamNameLower = entry.team.toLowerCase();
																			
																			// Check if this is the specific Dorkinians team
																			let isSpecificTeam = false;
																			if (teamNameLower.includes("dorkinians")) {
																				if (teamKey === "1s") {
																					// 1st XI can be just "Dorkinians" or "Dorkinians 1st"
																					isSpecificTeam = teamNameLower === "dorkinians" || 
																						(teamNameLower.startsWith("dorkinians ") && 
																						!teamNameLower.match(/\b(2nd|3rd|4th|5th|6th|7th|8th|ii|iii|iv|v|vi|vii|viii)\b/));
																				} else {
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
																						isSpecificTeam = patterns.some(pattern => {
																							// Use word boundary for Roman numerals and ordinals
																							const regex = new RegExp(`\\b${pattern}\\b`, 'i');
																							return regex.test(teamNameLower);
																						});
																					}
																				}
																			}
																			
																			return (
																				<tr
																					key={index}
																					className={`border-b border-white/10 transition-colors ${
																						isSpecificTeam
																							? "bg-dorkinians-yellow/20 font-semibold"
																							: index % 2 === 0
																								? "bg-gray-800/30"
																								: ""
																					} hover:bg-white/5`}
																				>
																					<td className='pl-2 pr-0.5 py-1.5 text-white'>{entry.position}</td>
																					<td className='px-1.5 py-1.5 text-white max-w-[120px] truncate' title={entry.team}>{entry.team}</td>
																					<td className='px-0.5 py-1.5 text-center text-white'>{entry.played}</td>
																					<td className='px-0.5 py-1.5 text-center text-white'>{entry.won}</td>
																					<td className='px-0.5 py-1.5 text-center text-white'>{entry.drawn}</td>
																					<td className='px-0.5 py-1.5 text-center text-white'>{entry.lost}</td>
																					<td className='px-0.5 py-1.5 text-center text-white'>{entry.goalsFor}</td>
																					<td className='px-0.5 py-1.5 text-center text-white'>{entry.goalsAgainst}</td>
																					<td className='px-0.5 py-1.5 text-center text-white'>{entry.goalDifference}</td>
																					<td className='px-0.5 py-1.5 text-center font-semibold text-dorkinians-yellow'>
																						{entry.points}
																					</td>
																				</tr>
																			);
																		})}
																	</tbody>
																</table>
															</div>
														) : (
															<div className='text-center text-gray-300 py-4'>
																No table data available.
															</div>
														)}
													</>
												) : null}
											</div>
										)}
									</div>
								)}
							</div>
						);

						const dataTableContent = (
							<div className='overflow-x-auto pb-4 flex flex-col'>
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
						</>
					);
					})()}
				</div>
			)}
		</div>
	);
}

