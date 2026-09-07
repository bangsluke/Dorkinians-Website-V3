"use client";

import { useNavigationStore, type TeamData } from "@/lib/stores/navigation";
import { statObject, statsPageConfig, appConfig, featureFlags } from "@/config/config";
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
import Skeleton from "react-loading-skeleton";
import { StatCardSkeleton, ChartSkeleton, TableSkeleton, TopPlayersTableSkeleton, BestSeasonFinishSkeleton, RecentGamesSkeleton, DataTableSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/ui/StateComponents";
import { TooltipSurface, TooltipArrow, ChartTooltip, FloatingTooltipTrigger, HoverTooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/lib/hooks/useToast";
import { log } from "@/lib/utils/logger";
import Button from "@/components/ui/Button";
import { UmamiEvents } from "@/lib/analytics/events";
import { trackStatsStatSelected, trackTeamStatsTeamSelected } from "@/lib/analytics/statsTracking";
import { trackEvent } from "@/lib/utils/trackEvent";
import RecordingsSection from "@/components/stats/RecordingsSection";
import TopPlayersTable from "@/components/stats/TopPlayersTable";
import TopPlayersModal from "@/components/stats/TopPlayersModal";
import {
	getStatTypeLabel,
	normalizeTopPlayer,
	type TopPlayer,
	type TopPlayersStatType,
} from "@/lib/stats/topPlayersUtils";
import type { RecordingFixture } from "@/lib/utils/recordingsDisplay";

type StatType = TopPlayersStatType;

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
				<TooltipSurface
					ref={tooltipRef}
					className='fixed z-[9999] w-64 text-center pointer-events-none'
					style={{
						top: `${tooltipPosition.top}px`,
						left: `${tooltipPosition.left}px`
					}}>
					<TooltipArrow placement={tooltipPosition.placement === 'above' ? 'above' : 'below'} />
					{stat.description}
				</TooltipSurface>,
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

function formatStreakDate(dateIso: string | null | undefined): string {
	if (!dateIso) return "";
	const [year, month, day] = String(dateIso).split("-");
	if (!year || !month || !day) return String(dateIso);
	return `${day}/${month}/${year}`;
}

function formatStreakRange(startDate: string | null | undefined, endDate: string | null | undefined): string {
	const start = formatStreakDate(startDate);
	const end = formatStreakDate(endDate);
	if (!start && !end) return "";
	if (start && end) return start === end ? ` (${start})` : ` (${start} - ${end})`;
	return ` (${start || end})`;
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
		hasUnsavedFilters,
		isFilterSidebarOpen,
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
			const validStatTypes: StatType[] = ["appearances", "starts", "goals", "assists", "cleanSheets", "mom", "saves", "yellowCards", "redCards", "penaltiesScored", "fantasyPoints", "goalInvolvements", "minutes", "ownGoals", "conceded", "penaltiesMissed", "penaltiesConceded", "penaltiesSaved", "distance", "avgMatchRating", "matchesRated8Plus", "goalsPer90", "assistsPer90", "goalInvolvementsPer90", "ftpPer90", "cleanSheetsPer90", "concededPer90", "savesPer90", "cardsPer90", "momPer90", "bestCurrentForm"];
			if (saved && validStatTypes.includes(saved as StatType)) {
				return saved as StatType;
			}
		}
		return "appearances";
	});
	const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
	const [isLoadingTopPlayers, setIsLoadingTopPlayers] = useState(false);
	const [isTopPlayersModalOpen, setIsTopPlayersModalOpen] = useState(false);

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

	// Veo / match recordings for current team + filters
	const [teamRecordings, setTeamRecordings] = useState<RecordingFixture[]>([]);

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
		if (!filterData.teams || filterData.teams.length === 0) {
			setSelectedTeam("");
			previousPlayerRef.current = selectedPlayer || null;
			return;
		}

		// No selected player: still allow browsing team stats via dropdown/default team.
		if (!selectedPlayer) {
			previousPlayerRef.current = null;
			setSelectedTeam((current) => {
				if (current && filterData.teams.some((team) => team.name === current)) {
					return current;
				}
				return filterData.teams[0]?.name || "";
			});
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
		if (hasUnsavedFilters || isFilterSidebarOpen) return; // Skip API calls while editing filters or sidebar is open

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
	}, [filtersKey, selectedTeam, playerFilters, hasUnsavedFilters, isFilterSidebarOpen]);


	// Priority 1: Above fold on mobile - Top Players section
	// Fetch top players when selected team, filters or stat type changes
	useEffect(() => {
		if (!selectedTeam || !apiFilters) return;
		if (hasUnsavedFilters || isFilterSidebarOpen) return; // Skip API calls while editing filters or sidebar is open

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
				const raw = (data.players || []) as Partial<TopPlayer>[];
				setTopPlayers(raw.map((p) => normalizeTopPlayer(p)));
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
	}, [filtersKey, selectedStatType, selectedTeam, apiFilters, hasUnsavedFilters, isFilterSidebarOpen]);

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
		if (hasUnsavedFilters || isFilterSidebarOpen) return; // Skip API calls while editing filters or sidebar is open

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
	}, [selectedTeam, apiFilters, hasUnsavedFilters, isFilterSidebarOpen]);

	// Team recordings (fixtures with Veo/video links) for current team + filters
	useEffect(() => {
		if (!selectedTeam || !playerFilters) {
			setTeamRecordings([]);
			return;
		}
		if (!featureFlags.teamStatsTeamRecordings) {
			setTeamRecordings([]);
			return;
		}
		if (hasUnsavedFilters || isFilterSidebarOpen) return;

		const fetchTeamRecordings = async () => {
			setTeamRecordings([]);
			try {
				const requestBody = {
					teamName: selectedTeam,
					filters: {
						...playerFilters,
						teams: [],
					},
				};
				const cacheKey = generatePageCacheKey("stats", "team-stats", "team-recordings", requestBody);
				const data = await cachedFetch("/api/team-recordings", {
					method: "POST",
					body: requestBody,
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				setTeamRecordings((data.fixtures || []) as RecordingFixture[]);
			} catch (err) {
				log("error", "Error fetching team recordings:", err);
				setTeamRecordings([]);
			}
		};

		fetchTeamRecordings();
	}, [selectedTeam, playerFilters, hasUnsavedFilters, isFilterSidebarOpen, getCachedPageData, setCachedPageData]);

	useEffect(() => {
		if (!featureFlags.teamStatsStreakAndForm && selectedStatType === "bestCurrentForm") {
			setSelectedStatType("appearances");
		}
	}, [selectedStatType]);

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
		if (hasUnsavedFilters || isFilterSidebarOpen) return; // Skip API calls while editing filters or sidebar is open

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
	}, [selectedTeam, allSeasonsSelected, apiFilters, hasUnsavedFilters, isFilterSidebarOpen]);

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
				trendline: Math.max(0, trendlinePoints[index]?.value || 0),
			}));
		}

		return baseData;
	}, [seasonalStats, seasonalSelectedStat, statOptions, showTrend]);

	// Handle stat type selection
	const handleStatTypeSelect = (statType: StatType) => {
		setSelectedStatType(statType);
		trackStatsStatSelected("team-stats", "team-top-players", statType);
	};

	const handleTeamSelect = (team: string) => {
		setSelectedTeam(team);
		trackTeamStatsTeamSelected(team);
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

	const formationRecommendation = useMemo(() => {
		const rows = teamData?.formationBreakdown;
		if (!rows || rows.length === 0) return null;
		const sorted = [...rows].sort((a, b) => {
			const wp = toNumber(b.winPercentage) - toNumber(a.winPercentage);
			if (wp !== 0) return wp;
			const g = toNumber(b.games) - toNumber(a.games);
			if (g !== 0) return g;
			return toNumber(b.wins) - toNumber(a.wins);
		});
		const top = sorted[0];
		if (!top?.formation) return null;
		const games = toNumber(top.games);
		const lowSample = games < 5;
		return { formation: top.formation, winPercentage: toNumber(top.winPercentage), games, wins: toNumber(top.wins), lowSample };
	}, [teamData]);

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
				<TooltipSurface>
					<p className='mb-1 font-medium text-white/90'>{displayLabel}</p>
					<p className='text-white/80'>
						<span className='font-medium text-white/60'>Value:</span> {displayValue}
					</p>
					<p className='text-white/80'>
						<span className='font-medium text-white/60'>Per Game:</span> {perGame}
					</p>
					<p className='text-white/80'>
						<span className='font-medium text-white/60'>Games:</span> {gamesPlayed}
					</p>
					{displayLabel === "Goals Scored" && uniqueGoalscorers > 0 && (
						<p className='text-white/80'>
							<span className='font-medium text-white/60'>Unique Goalscorers:</span> {uniqueGoalscorers}
						</p>
					)}
				</TooltipSurface>
			);
		}
		return null;
	};

	// Show loading state
	// Removed early return - now handled in main render with full skeleton layout

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

	return (
		<div className='h-full flex flex-col'>
			<div className='flex-shrink-0 p-2 md:p-4'>
				<div className='flex items-center justify-center mb-2 md:mb-4 relative'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow text-center'>Team Stats</h2>
				</div>
				{/* Team Selection Dropdown */}
				<div className='mb-2 md:mb-4 flex justify-center'>
					<div className='w-full max-w-xs'>
						<Listbox value={selectedTeam} onChange={handleTeamSelect}>
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
						onClick={() => {
							const next = !isDataTableMode;
							setIsDataTableMode(next);
						}}
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
				<div data-testid="loading-skeleton" className='flex-1 flex flex-col md:min-h-0'>
					<div className='flex-1 px-2 md:px-4 pb-6 md:overflow-y-auto md:min-h-0 space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4'>
						<div className='mb-4 md:mb-0'>
							<StatCardSkeleton />
						</div>
						<div className='mb-4 md:mb-0'>
							<RecentGamesSkeleton />
						</div>
						<div className='mb-4 md:mb-0'>
							<TopPlayersTableSkeleton />
						</div>
						<div className='mb-4 md:mb-0'>
							<ChartSkeleton showDropdown={true} showTrend={true} noContainer={false} />
						</div>
						<div className='mb-4 md:mb-0'>
							<ChartSkeleton showDropdown={false} showTrend={false} noContainer={false} />
						</div>
						<div className='mb-4 md:mb-0'>
							<ChartSkeleton showDropdown={false} showTrend={false} noContainer={false} />
						</div>
						<div className='mb-4 md:mb-0'>
							<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
								<Skeleton height={20} width="35%" className="mb-3" />
								<div className='grid grid-cols-5 gap-2 md:gap-3'>
									{[...Array(5)].map((_, i) => (
										<div key={i} className='bg-white/5 rounded-lg p-2 md:p-3'>
											<Skeleton height={30} width={30} circle className="mb-2 mx-auto" />
											<Skeleton height={10} width="70%" className="mx-auto mb-1" />
											<Skeleton height={14} width="50%" className="mx-auto" />
										</div>
									))}
								</div>
							</div>
						</div>
						<div className='mb-4 md:mb-0'>
							<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
								<Skeleton height={20} width="40%" className="mb-3" />
								<TableSkeleton rows={4} />
							</div>
						</div>
						<div className='mb-4 md:mb-0'>
							<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
								<Skeleton height={20} width="45%" className="mb-3" />
								<div className='grid grid-cols-2 gap-2 md:gap-4'>
									<div className='bg-white/5 rounded-lg p-3'>
										<Skeleton height={12} width="55%" className="mb-3" />
										<Skeleton height={120} width="100%" />
									</div>
									<div className='bg-white/5 rounded-lg p-3'>
										<Skeleton height={12} width="55%" className="mb-3" />
										<Skeleton height={120} width="100%" />
									</div>
								</div>
							</div>
						</div>
						<div className='mb-4 md:mb-0'>
							<StatCardSkeleton count={8} />
						</div>
						<div className='mb-4 md:mb-0'>
							<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
								<Skeleton height={20} width="50%" className="mb-3" />
								<TableSkeleton rows={6} />
							</div>
						</div>
						<div className='mb-4 md:mb-0'>
							<BestSeasonFinishSkeleton />
						</div>
					</div>
				</div>
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

								{/* Seasonal Performance Section */}
								{allSeasonsSelected && (
									<div id='team-seasonal-performance' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
										<div className='flex items-center justify-between mb-2 gap-2'>
											<h3 className='text-white font-semibold text-sm md:text-base flex-shrink-0'>Seasonal Performance</h3>
											<div className='flex-1 max-w-[45%]'>
												<Listbox
													value={seasonalSelectedStat}
													onChange={(v) => {
														setSeasonalSelectedStat(v);
														trackStatsStatSelected("team-stats", "team-seasonal-performance", v);
													}}>
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
											<ChartSkeleton showDropdown={true} noContainer={true} />
										) : seasonalChartData.length > 0 ? (
											<div className='chart-container' style={{ touchAction: 'pan-y' }}>
												<ResponsiveContainer width='100%' height={240}>
													<ComposedChart 
														data={seasonalChartData} 
														margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
													>
														<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
														<XAxis dataKey='name' stroke='#fff' fontSize={12} />
														<YAxis stroke='#fff' fontSize={12} domain={[0, 'auto']} allowDecimals={false} />
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
									<div id='team-match-results' className='relative z-10 bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
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

								{!isDataTableMode &&
									featureFlags.teamStatsFormationsUsed &&
									teamData.formationBreakdown &&
									teamData.formationBreakdown.length > 0 && (
									<div id='team-formation-breakdown' className='md:break-inside-avoid md:mb-4'>
										<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
											<div className='flex items-center gap-2 mb-4'>
												<h3 className='text-white font-semibold text-sm md:text-base'>Formations Used</h3>
												<FloatingTooltipTrigger
													className='inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border border-white/40 text-white/80 cursor-help outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow/80'
													tooltip={
														<>
															Games and win rate by inferred formation from the starting XI.
															<br />
															Only fixtures with at least 11 starters are included.
														</>
													}
												>
													i
												</FloatingTooltipTrigger>
											</div>
											<div className='chart-container' style={{ touchAction: 'pan-y' }}>
												<ResponsiveContainer width='100%' height={280}>
													<BarChart
														data={teamData.formationBreakdown}
														margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
														<CartesianGrid strokeDasharray='3 3' stroke='#ffffff22' />
														<XAxis
															dataKey='formation'
															tick={{ fill: '#e5e5e5', fontSize: 10 }}
															interval={0}
															angle={-30}
															textAnchor='end'
															height={56}
														/>
														<YAxis
															yAxisId='games'
															tick={{ fill: '#d4a012', fontSize: 11 }}
															allowDecimals={false}
															width={40}
															tickMargin={8}
															label={{
																value: 'Games',
																angle: -90,
																position: 'left',
																offset: 0,
																style: { textAnchor: 'middle', fill: '#d4a012', fontSize: 10 },
															}}
														/>
														<YAxis
															yAxisId='pct'
															orientation='right'
															tick={{ fill: '#22c55e', fontSize: 11 }}
															domain={[0, 100]}
															width={48}
															tickMargin={8}
															unit='%'
															label={{
																value: 'Win %',
																angle: 90,
																position: 'right',
																offset: 0,
																style: { textAnchor: 'middle', fill: '#22c55e', fontSize: 10 },
															}}
														/>
														<Tooltip
															content={
																<ChartTooltip
																	formatValue={(entry) =>
																		entry.name === 'Win %' ? `${entry.value}%` : `${entry.value ?? '-'}`
																	}
																/>
															}
														/>
														<Bar yAxisId='games' dataKey='games' name='Games' fill='#d4a012' radius={[4, 4, 0, 0]} />
														<Bar yAxisId='pct' dataKey='winPercentage' name='Win %' fill='#22c55e' radius={[4, 4, 0, 0]} />
													</BarChart>
												</ResponsiveContainer>
											</div>
											{formationRecommendation ? (
												<div
													data-testid='formation-recommendation'
													className='relative z-10 mt-0 rounded-lg border border-white/40 bg-white/[0.07] px-3 py-2 flex flex-col gap-0.5'
												>
													<span className='text-dorkinians-yellow text-xs font-semibold'>Suggested setup</span>
													<span className='text-white font-semibold text-sm md:text-base'>
														{formationRecommendation.formation}
													</span>
													<span className='text-white/90 text-xs md:text-sm'>
														Best win rate in this sample ({formationRecommendation.winPercentage.toFixed(1)}% over{" "}
														{formationRecommendation.games} game
														{formationRecommendation.games === 1 ? "" : "s"}, {formationRecommendation.wins} win
														{formationRecommendation.wins === 1 ? "" : "s"}).
													</span>
													{formationRecommendation.lowSample ? (
														<span className='text-white/55 text-[10px] md:text-xs'>
															Low sample size - treat as a hint, not a rule.
														</span>
													) : null}
												</div>
											) : null}
										</div>
									</div>
								)}

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
														alt='Goals / Game'
														width={40}
														height={40}
														className='w-8 h-8 md:w-10 md:h-10 object-contain'
													/>
												</div>
												<div className='flex-1 min-w-0'>
													<div className='text-white/70 text-sm md:text-base mb-1'>Goals / Game</div>
													<div className='text-white font-bold text-xl md:text-2xl'>{toNumber(teamData.goalsPerGame).toFixed(2)}</div>
												</div>
											</div>
											<div className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
												<div className='flex-shrink-0'>
													<Image
														src='/stat-icons/ConcededPerAppearance-Icon.svg'
														alt='Conceded / Game'
														width={40}
														height={40}
														className='w-8 h-8 md:w-10 md:h-10 object-contain'
													/>
												</div>
												<div className='flex-1 min-w-0'>
													<div className='text-white/70 text-sm md:text-base mb-1'>Conceded / Game</div>
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

								{/* Top Players Table */}
								<div id='team-top-players' className='relative z-30 mb-4 flex-shrink-0 md:break-inside-avoid md:mb-4'>
									<div className='relative z-30 bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
										<div className='flex items-center justify-between mb-2 gap-2'>
											<h3 className='text-white font-semibold text-sm md:text-base flex-shrink-0' data-testid="team-top-players-heading">Top 5</h3>
											<div className='relative z-40 flex-1 max-w-[45%]'>
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
																"starts",
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
																"avgMatchRating",
																"matchesRated8Plus",
																"goalsPer90",
																"assistsPer90",
																"goalInvolvementsPer90",
																"ftpPer90",
																"cleanSheetsPer90",
																"concededPer90",
																"savesPer90",
																"cardsPer90",
																"momPer90",
																...(featureFlags.teamStatsStreakAndForm ? (["bestCurrentForm"] as const) : []),
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
										</div>
										{isLoadingTopPlayers ? (
											<TopPlayersTableSkeleton />
										) : topPlayers.length > 0 ? (
											<>
												<TopPlayersTable
													players={topPlayers}
													statType={selectedStatType}
													highlightPlayerName={selectedPlayer}
												/>
												{featureFlags.statsTopPlayersShowAll && (
													<button
														type='button'
														className='mt-3 w-full text-center text-white underline text-sm hover:text-white/80 min-h-[44px]'
														onClick={() => setIsTopPlayersModalOpen(true)}>
														Show all
													</button>
												)}
											</>
										) : (
											<div className='p-4'>
												<p className='text-white text-xs md:text-sm text-center'>No players found</p>
											</div>
										)}
									</div>
								</div>

								{featureFlags.statsTopPlayersShowAll && apiFilters && (
									<TopPlayersModal
										isOpen={isTopPlayersModalOpen}
										onClose={() => setIsTopPlayersModalOpen(false)}
										statType={selectedStatType}
										filters={apiFilters}
										contextLabel={selectedTeam ? `${selectedTeam} — Team Stats` : "Team Stats"}
										highlightPlayerName={selectedPlayer}
										pageSource='team-stats'
										cacheScopeKey={selectedTeam}
										getCachedPageData={getCachedPageData}
										setCachedPageData={setCachedPageData}
									/>
								)}

								{/* Unique Player Stats Section */}
								{isLoadingUniqueStats ? (
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

								{featureFlags.teamStatsTeamRecordings && selectedTeam && teamRecordings.length > 0 && (
									<RecordingsSection
										id='team-recordings'
										title='Team Recordings'
										subtitle='All matches with a recording link for the selected team and current filters.'
										fixtures={teamRecordings}
										enableSeasonFilter
										testIdPrefix='team-recording'
									/>
								)}

								{!isDataTableMode &&
									featureFlags.teamStatsXiStreakCards &&
									teamData.teamStreaks && (
									<div id='team-streaks-section' className='md:break-inside-avoid md:mb-4'>
										<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
											<div className='flex items-center gap-2 mb-2'>
												<h3 className='text-white font-semibold text-sm md:text-base'>Streaks</h3>
												<FloatingTooltipTrigger
													className='inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border border-white/40 text-white/80 cursor-help outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow/80'
													tooltip={
														<>
															Streaks are based on the selected XI and current filter scope.
														</>
													}
												>
													i
												</FloatingTooltipTrigger>
											</div>
											{(() => {
												const cards = [
													{
														key: "wins",
														label: "Wins",
														tip: "Consecutive games won by this XI. A draw or loss resets the run.",
														singular: "win",
														plural: "wins",
													},
													{
														key: "unbeaten",
														label: "Unbeaten",
														tip: "Consecutive games without a loss for this XI (wins or draws). A loss resets the run.",
														singular: "game",
														plural: "games",
													},
													{
														key: "goalsScored",
														label: "Goals Scored",
														tip: "Consecutive games where this XI scores at least one goal. A blank resets the run.",
														singular: "game",
														plural: "games",
													},
													{
														key: "cleanSheets",
														label: "Clean Sheets",
														tip: "Consecutive games where this XI concedes zero goals. Conceding resets the run.",
														singular: "clean sheet",
														plural: "clean sheets",
													},
													{
														key: "noCards",
														label: "No Cards",
														tip: "Consecutive games where all playing players avoid yellow/red cards. Any card resets the run.",
														singular: "game",
														plural: "games",
													},
												] as const;
												const orderedCards = [...cards].sort((a, b) => {
													const aVal = toNumber(teamData.teamStreaks?.[a.key]?.current);
													const bVal = toNumber(teamData.teamStreaks?.[b.key]?.current);
													return Number(bVal > 0) - Number(aVal > 0);
												});
												return (
													<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2'>
														{orderedCards.map(({ key, label, tip, singular, plural }) => {
															const metric = teamData.teamStreaks?.[key];
															if (!metric) return null;
															const currentVal = toNumber(metric.current);
															const seasonBestVal = toNumber(metric.seasonBest);
															const allTimeBestVal = toNumber(metric.allTimeBest);
															const currentLabel = currentVal === 1 ? singular : plural;
															const seasonBestLabel = seasonBestVal === 1 ? singular : plural;
															const allTimeBestLabel = allTimeBestVal === 1 ? singular : plural;
															const lit = currentVal > 0;
															return (
																<FloatingTooltipTrigger
																	key={key}
																	className={`rounded-lg p-2 flex flex-col items-center text-center cursor-help outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow/80 ${
																		lit ? "bg-white/12" : "bg-white/5 opacity-75"
																	}`}
																	tooltip={
																		<>
																			<p className='text-white/95 leading-snug'>{tip}</p>
																			<div className='mt-2 pt-2 border-t border-white/20 space-y-1 text-white/90'>
																				<p>
																					Current: {currentVal} {currentLabel}
																					{formatStreakRange(metric.currentRange?.startDate, metric.currentRange?.endDate)}
																				</p>
																				<p>
																					Season best: {seasonBestVal} {seasonBestLabel}
																					{formatStreakRange(metric.seasonBestRange?.startDate, metric.seasonBestRange?.endDate)}
																				</p>
																				<p>
																					All-time best: {allTimeBestVal} {allTimeBestLabel}
																					{formatStreakRange(metric.allTimeBestRange?.startDate, metric.allTimeBestRange?.endDate)}
																				</p>
																			</div>
																		</>
																	}
																>
																	<div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ${
																		lit ? "bg-dorkinians-yellow text-black" : "bg-white/15 text-white/80"
																	}`}>
																		{currentVal}
																	</div>
																	<p className='text-white/90 text-[11px] md:text-xs leading-tight mt-1'>{label}</p>
																	<p className='text-white/55 text-[10px] leading-tight'>Season best: {seasonBestVal}</p>
																	<p className='text-white/55 text-[10px] leading-tight'>All-time best: {allTimeBestVal}</p>
																</FloatingTooltipTrigger>
															);
														})}
													</div>
												);
											})()}
										</div>
									</div>
								)}

								{!isDataTableMode &&
									featureFlags.teamStatsStreakAndForm &&
									((teamData.streakLeaders && teamData.streakLeaders.length > 0) ||
										(teamData.streakLeadersAllTime && teamData.streakLeadersAllTime.length > 0)) && (
									<div id='team-streak-leaders' className='md:break-inside-avoid md:mb-4'>
										<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
											<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Team Streaks</h3>
											{teamData.streakLeaders && teamData.streakLeaders.length > 0 && (
												<>
													<div className='flex items-center gap-2 mb-2'>
														<h4 className='text-white/85 font-medium text-xs md:text-sm'>Longest Active Streaks</h4>
														<FloatingTooltipTrigger
															className='inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border border-white/40 text-white/80 cursor-help outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow/80'
															tooltip={
																<>
																	Shows the player with the longest current run for each category in this XI context.
																</>
															}
														>
															i
														</FloatingTooltipTrigger>
													</div>
													<div className='grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3'>
														{teamData.streakLeaders.map((row) => {
															const tipByCategory: Record<string, string> = {
																wins: "Consecutive player appearances in this XI where the result is a win.",
																unbeaten: "Consecutive player appearances in this XI without a loss (wins or draws).",
																goalsScored: "Consecutive player appearances in this XI where that player scores at least one goal or penalty.",
																cleanSheets: "Consecutive player appearances in this XI where the team concedes zero.",
																noCards: "Consecutive player appearances in this XI where the player receives no yellow/red card.",
															};
															const tip = tipByCategory[row.category] ?? "Current active run for this streak category.";
															return (
																<FloatingTooltipTrigger
																	key={`active-${row.category}`}
																	className='bg-white/5 rounded-lg px-3 py-2 flex flex-col gap-0.5 cursor-help outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow/80'
																	tooltip={
																		<>
																			<p className='text-white/95 leading-snug'>{tip}</p>
																			<div className='mt-2 pt-2 border-t border-white/20 space-y-1 text-white/90'>
																				<p>Player: {row.playerName}</p>
																				<p>Active run: {row.value} in a row</p>
																				<p>Date range: {formatStreakRange(row.startDate, row.endDate) || "-"}</p>
																			</div>
																		</>
																	}
																>
																	<span className='text-white/70 text-xs'>{row.label}</span>
																	<span className='text-white font-semibold text-sm md:text-base'>{row.playerName}</span>
																	<span className='text-dorkinians-yellow text-xs md:text-sm'>
																		{row.value} in a row{formatStreakRange(row.startDate, row.endDate)}
																	</span>
																</FloatingTooltipTrigger>
															);
														})}
													</div>
												</>
											)}
											{teamData.streakLeadersAllTime && teamData.streakLeadersAllTime.length > 0 && (
												<>
													<div className='flex items-center gap-2 mb-2'>
														<h4 className='text-white/85 font-medium text-xs md:text-sm'>Longest All Time Streaks</h4>
														<FloatingTooltipTrigger
															className='inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border border-white/40 text-white/80 cursor-help outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow/80'
															tooltip={
																<>
																	Shows the player with the longest historical run for each category in this XI context.
																</>
															}
														>
															i
														</FloatingTooltipTrigger>
													</div>
													<div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
														{teamData.streakLeadersAllTime.map((row) => {
															const tipByCategory: Record<string, string> = {
																wins: "Longest historical run of consecutive player appearances in this XI where the result is a win.",
																unbeaten: "Longest historical run of consecutive player appearances in this XI without a loss (wins or draws).",
																goalsScored: "Longest historical run of consecutive player appearances in this XI where that player scores at least one goal or penalty.",
																cleanSheets: "Longest historical run of consecutive player appearances in this XI where the team concedes zero.",
																noCards: "Longest historical run of consecutive player appearances in this XI where the player receives no yellow/red card.",
															};
															const tip = tipByCategory[row.category] ?? "Longest all-time run for this streak category.";
															return (
																<FloatingTooltipTrigger
																	key={`alltime-${row.category}`}
																	className='bg-white/[0.07] border border-white/20 rounded-lg px-3 py-2 flex flex-col gap-0.5 cursor-help outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow/80'
																	tooltip={
																		<>
																			<p className='text-white/95 leading-snug'>{tip}</p>
																			<div className='mt-2 pt-2 border-t border-white/20 space-y-1 text-white/90'>
																				<p>Player: {row.playerName}</p>
																				<p>All-time run: {row.value} in a row</p>
																				<p>Date range: {formatStreakRange(row.startDate, row.endDate) || "-"}</p>
																			</div>
																		</>
																	}
																>
																	<span className='text-white/70 text-xs'>{row.label}</span>
																	<span className='text-white font-semibold text-sm md:text-base'>{row.playerName}</span>
																	<span className='text-white/90 text-xs md:text-sm'>
																		{row.value} in a row{formatStreakRange(row.startDate, row.endDate)}
																	</span>
																</FloatingTooltipTrigger>
															);
														})}
													</div>
												</>
											)}
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
													<BestSeasonFinishSkeleton />
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
																					<td className='px-1.5 py-1.5 text-white max-w-[120px]'>
																						<HoverTooltip content={entry.team} className='block min-w-0'>
																							<span className='block truncate'>{entry.team}</span>
																						</HoverTooltip>
																					</td>
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
									<DataTableSkeleton />
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

