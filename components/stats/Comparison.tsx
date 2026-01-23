"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigationStore, type PlayerData } from "@/lib/stores/navigation";
import { PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";
import PenOnPaperIcon from "@/components/icons/PenOnPaperIcon";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/20/solid";
import FilterPills from "@/components/filters/FilterPills";
import { statObject, statsPageConfig } from "@/config/config";
import { TeamMappingUtils } from "@/lib/services/chatbotUtils/teamMappingUtils";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { createPortal } from "react-dom";
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from "@/lib/utils/pwaDebug";
import { cachedFetch, generatePageCacheKey } from "@/lib/utils/pageCache";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, ResponsiveContainer } from "recharts";
import { RadarChartSkeleton } from "@/components/skeletons";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import Button from "@/components/ui/Button";

interface Player {
	playerName: string;
	mostPlayedForTeam: string;
}

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

function formatStatValue(value: any, statFormat: string, decimalPlaces: number, statUnit?: string): string {
	if (value === null || value === undefined) return "N/A";

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
			formattedValue = `${numValue.toFixed(1)}%`;
			break;
		case "String":
			formattedValue = String(value);
			break;
		default:
			formattedValue = String(value);
	}

	return statUnit ? `${formattedValue} ${statUnit}` : formattedValue;
}

function getStatValue(playerData: PlayerData | null, statKey: string): number {
	if (!playerData) return 0;
	
	const stat = statObject[statKey as keyof typeof statObject];
	if (!stat) return 0;
	
	const value = playerData[stat.statName as keyof PlayerData];
	return toNumber(value);
}

function ComparisonStatRow({ 
	statKey, 
	stat, 
	player1Data, 
	player2Data,
	player1Name,
	player2Name
}: { 
	statKey: string; 
	stat: any; 
	player1Data: PlayerData | null; 
	player2Data: PlayerData | null;
	player1Name: string | null;
	player2Name: string | null;
}) {
	const [showTooltip, setShowTooltip] = useState(false);
	const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; placement: 'above' | 'below' } | null>(null);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const rowRef = useRef<HTMLDivElement>(null);
	const tooltipRef = useRef<HTMLDivElement | null>(null);
	const isInView = useInView(rowRef, { once: true, margin: "-100px" });

	// Helper function to convert team name from "1st XI" to "1s" format
	const formatTeamNameForDisplay = (teamName: string): string => {
		if (!teamName) return "";
		const teamNameLower = teamName.toLowerCase().trim();
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
		return reverseMap[teamNameLower] || teamName;
	};

	const player1Value = getStatValue(player1Data, statKey);
	const player2Value = getStatValue(player2Data, statKey);
	
	const statHigherBetter = stat.statHigherBetterBoolean;
	const maxValue = Math.max(player1Value, player2Value, 1);
	
	let player1IsWinner = false;
	let player2IsWinner = false;
	let player1DisplayValue: string | number = player1Value;
	let player2DisplayValue: string | number = player2Value;
	
	// Special handling for MostPlayedForTeam: compare by team priority (higher team = better)
	// Higher team means lower priority number (1s = 1, 2s = 2, etc.)
	if (statKey === "MostPlayedForTeam") {
		const player1Team = player1Data?.mostPlayedForTeam || "";
		const player2Team = player2Data?.mostPlayedForTeam || "";
		const player1Appearances = player1Data?.mostPlayedForTeamAppearances || 0;
		const player2Appearances = player2Data?.mostPlayedForTeamAppearances || 0;
		
		// Set display values to team names in short format
		player1DisplayValue = formatTeamNameForDisplay(player1Team);
		player2DisplayValue = formatTeamNameForDisplay(player2Team);
		
		// Compare team priorities (lower priority number = higher team = better)
		// For this stat, higher team always wins, regardless of appearance counts
		const player1Priority = TeamMappingUtils.getTeamPriority(player1Team);
		const player2Priority = TeamMappingUtils.getTeamPriority(player2Team);
		
		if (player1Priority < player2Priority) {
			// Player 1 has higher team (lower priority number, e.g., 1s vs 2s)
			player1IsWinner = true;
		} else if (player2Priority < player1Priority) {
			// Player 2 has higher team (lower priority number)
			player2IsWinner = true;
		} else {
			// If teams are equal (same team), both win (both bars yellow)
			player1IsWinner = true;
			player2IsWinner = true;
		}
	} else if (statKey === "MostScoredForTeam") {
		const player1Team = player1Data?.mostScoredForTeam || "";
		const player2Team = player2Data?.mostScoredForTeam || "";
		const player1Goals = player1Data?.mostScoredForTeamGoals || 0;
		const player2Goals = player2Data?.mostScoredForTeamGoals || 0;
		
		// Set display values to team names in short format
		player1DisplayValue = formatTeamNameForDisplay(player1Team);
		player2DisplayValue = formatTeamNameForDisplay(player2Team);
		
		// Compare team priorities (lower priority number = higher team = better)
		// For this stat, higher team always wins, regardless of goal counts
		const player1Priority = TeamMappingUtils.getTeamPriority(player1Team);
		const player2Priority = TeamMappingUtils.getTeamPriority(player2Team);
		
		if (player1Priority < player2Priority) {
			// Player 1 has higher team (lower priority number, e.g., 1s vs 2s)
			player1IsWinner = true;
		} else if (player2Priority < player1Priority) {
			// Player 2 has higher team (lower priority number)
			player2IsWinner = true;
		} else {
			// If teams are equal (same team), both win (both bars yellow)
			player1IsWinner = true;
			player2IsWinner = true;
		}
	} else if (statHigherBetter) {
		if (player1Value > player2Value) {
			player1IsWinner = true;
		} else if (player2Value > player1Value) {
			player2IsWinner = true;
		} else {
			// Values are equal, both win (both bars yellow)
			player1IsWinner = true;
			player2IsWinner = true;
		}
	} else {
		if (player1Value < player2Value) {
			player1IsWinner = true;
		} else if (player2Value < player1Value) {
			player2IsWinner = true;
		} else {
			// Values are equal, both win (both bars yellow)
			player1IsWinner = true;
			player2IsWinner = true;
		}
	}
	
	// For MostPlayedForTeam and MostScoredForTeam, use appropriate values for width calculation
	let player1Width = 0;
	let player2Width = 0;
	if (statKey === "MostPlayedForTeam") {
		const player1Appearances = player1Data?.mostPlayedForTeamAppearances || 0;
		const player2Appearances = player2Data?.mostPlayedForTeamAppearances || 0;
		const maxAppearances = Math.max(player1Appearances, player2Appearances, 1);
		player1Width = maxAppearances > 0 ? (player1Appearances / maxAppearances) * 100 : 0;
		player2Width = maxAppearances > 0 ? (player2Appearances / maxAppearances) * 100 : 0;
	} else if (statKey === "MostScoredForTeam") {
		const player1Goals = player1Data?.mostScoredForTeamGoals || 0;
		const player2Goals = player2Data?.mostScoredForTeamGoals || 0;
		const maxGoals = Math.max(player1Goals, player2Goals, 1);
		player1Width = maxGoals > 0 ? (player1Goals / maxGoals) * 100 : 0;
		player2Width = maxGoals > 0 ? (player2Goals / maxGoals) * 100 : 0;
	} else {
		player1Width = maxValue > 0 ? (player1Value / maxValue) * 100 : 0;
		player2Width = maxValue > 0 ? (player2Value / maxValue) * 100 : 0;
	}

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
		
		const scrollContainers = findScrollContainers(rowRef.current);
		
		let tooltipHeight = 60;
		const tooltipWidth = 256;
		
		if (tooltipRef.current) {
			const tooltipRect = tooltipRef.current.getBoundingClientRect();
			tooltipHeight = tooltipRect.height || 60;
		}
		
		const spaceBelow = viewportHeight - rect.bottom;
		const spaceAbove = rect.top;
		const margin = 10;
		const arrowHeight = 8;
		const spacing = 8;
		
		let placement: 'above' | 'below' = 'below';
		let top: number;
		
		const neededSpaceBelow = tooltipHeight + arrowHeight + spacing + margin;
		const neededSpaceAbove = tooltipHeight + arrowHeight + spacing + margin;
		
		if (spaceBelow < neededSpaceBelow && spaceAbove > neededSpaceAbove) {
			placement = 'above';
			top = rect.top + window.scrollY - tooltipHeight - arrowHeight - spacing;
		} else if (spaceBelow >= neededSpaceBelow) {
			placement = 'below';
			top = rect.bottom + window.scrollY + spacing;
		} else {
			placement = 'above';
			top = Math.max(margin, rect.top + window.scrollY - tooltipHeight - arrowHeight - spacing);
		}
		
		let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipWidth / 2);
		
		if (left < window.scrollX + margin) {
			left = window.scrollX + margin;
		} else if (left + tooltipWidth > window.scrollX + viewportWidth - margin) {
			left = window.scrollX + viewportWidth - tooltipWidth - margin;
		}
		
		setTooltipPosition({ top, left, placement });
	};

	useEffect(() => {
		if (showTooltip) {
			const timeoutId = setTimeout(() => {
				updateTooltipPosition();
			}, 0);
			return () => clearTimeout(timeoutId);
		}
	}, [showTooltip]);

	useEffect(() => {
		if (!showTooltip || !rowRef.current) return;
		
		const scrollContainers = findScrollContainers(rowRef.current);
		const handleScroll = () => {
			updateTooltipPosition();
		};
		
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

	// For MostPlayedForTeam and MostScoredForTeam, use the team name directly; otherwise format the numeric value
	const player1Formatted = (statKey === "MostPlayedForTeam" || statKey === "MostScoredForTeam")
		? String(player1DisplayValue || "N/A")
		: formatStatValue(player1Value, stat.statFormat, stat.numberDecimalPlaces, (stat as any).statUnit);
	const player2Formatted = (statKey === "MostPlayedForTeam" || statKey === "MostScoredForTeam")
		? String(player2DisplayValue || "N/A")
		: formatStatValue(player2Value, stat.statFormat, stat.numberDecimalPlaces, (stat as any).statUnit);

	return (
		<>
			<div
				ref={rowRef}
				className='grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-4 items-center py-2 md:py-3 border-b border-white/10 hover:bg-white/5 transition-colors relative group cursor-help'
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}
			>
				{/* Player 1 Bar */}
				<div className='flex items-center justify-end h-8 md:h-10 relative'>
					{player1Data && player2Data && (
						<motion.div
							initial={{ width: 0 }}
							animate={isInView ? { width: `${player1Width}%` } : { width: 0 }}
							transition={{ duration: 0.8, ease: "easeOut" }}
							className={`h-full rounded-l-md flex items-center justify-end pr-2 md:pr-3 relative ${
								player1IsWinner ? 'bg-dorkinians-yellow' : 'bg-white'
							}`}
							style={{ minWidth: player1Width > 0 ? '40px' : '0' }}
						>
							{((statKey === "MostPlayedForTeam" || statKey === "MostScoredForTeam") ? player1DisplayValue : player1Value > 0) && (
								<span className={`text-xs md:text-sm font-mono font-semibold ${
									player1IsWinner ? 'text-black' : 'text-black'
								}`}>
									{player1Formatted}
								</span>
							)}
						</motion.div>
					)}
				</div>

				{/* Icon */}
				<div className='flex items-center justify-center w-8 h-8 md:w-10 md:h-10 flex-shrink-0'>
					<Image
						src={`/stat-icons/${stat.iconName}.svg`}
						alt={stat.displayText}
						width={32}
						height={32}
						className='w-6 h-6 md:w-8 md:h-8 object-contain'
					/>
				</div>

				{/* Player 2 Bar */}
				<div className='flex items-center justify-start h-8 md:h-10 relative'>
					{player2Data && (
						<motion.div
							initial={{ width: 0 }}
							animate={isInView ? { width: `${player2Width}%` } : { width: 0 }}
							transition={{ duration: 0.8, ease: "easeOut" }}
							className={`h-full rounded-r-md flex items-center justify-start pl-2 md:pl-3 relative ${
								player2IsWinner ? 'bg-dorkinians-yellow' : 'bg-white'
							}`}
							style={{ minWidth: player2Width > 0 ? '40px' : '0' }}
						>
							{((statKey === "MostPlayedForTeam" || statKey === "MostScoredForTeam") ? player2DisplayValue : player2Value > 0) && (
								<span className={`text-xs md:text-sm font-mono font-semibold ${
									player2IsWinner ? 'text-black' : 'text-black'
								}`}>
									{player2Formatted}
								</span>
							)}
						</motion.div>
					)}
				</div>
			</div>
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
					<div className='font-semibold mb-1'>{stat.displayText}</div>
					<div className='text-xs text-white/80 mb-2'>{stat.description}</div>
					{player1Name && player2Name && (
						<div className='text-xs text-white/90 mt-2 pt-2 border-t border-white/20'>
							<div className='mb-1'>{player1Name}: <span className='font-mono'>{player1Formatted}</span></div>
							<div>{player2Name}: <span className='font-mono'>{player2Formatted}</span></div>
						</div>
					)}
				</div>,
				document.body
			)}
		</>
	);
}

export default function Comparison() {
	const { selectedPlayer, enterEditMode, setMainPage, playerFilters, filterData, currentStatsSubPage, cachedPlayerData, getCachedPageData, setCachedPageData, hasUnsavedFilters, isFilterSidebarOpen } = useNavigationStore();
	
	const [secondPlayer, setSecondPlayer] = useState<string | null>(() => {
		if (typeof window !== "undefined") {
			return safeLocalStorageGet("comparison-second-player");
		}
		return null;
	});
	const [secondPlayerData, setSecondPlayerData] = useState<PlayerData | null>(() => {
		if (typeof window !== "undefined") {
			const storedPlayer = safeLocalStorageGet("comparison-second-player");
			if (storedPlayer) {
				const stored = safeLocalStorageGet("comparison-second-player-data");
				if (stored) {
					try {
						return JSON.parse(stored);
					} catch (e) {
						return null;
					}
				}
			}
		}
		return null;
	});
	const [isLoadingSecondPlayer, setIsLoadingSecondPlayer] = useState(false);
	const [allPlayers, setAllPlayers] = useState<Player[]>([]);
	const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
	const [playersLoaded, setPlayersLoaded] = useState(false);
	const [query, setQuery] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const [selectedStatCategory, setSelectedStatCategory] = useState<string>("Appearance Stats");

	const player1Data: PlayerData | null = cachedPlayerData?.playerData || null;

	const statsToDisplay = useMemo(() => {
		return [...(statsPageConfig["player-stats"]?.statsToDisplay || [])];
	}, []);

	const filteredStatEntries = useMemo(() => {
		const statsToDisplaySet = new Set(statsToDisplay);
		return Object.entries(statObject).filter(([key]) => statsToDisplaySet.has(key as any));
	}, [statsToDisplay]);

	// Stat category mapping configuration
	const statCategoryMapping: { [key: string]: Array<{ displayName: string; statKey: string | null; statName: string }> } = {
		"Appearance Stats": [
			{ displayName: "Appearances", statKey: "APP", statName: "appearances" },
			{ displayName: "Minutes", statKey: "MIN", statName: "minutes" },
			{ displayName: "Average Minutes Per Appearance", statKey: "MINperAPP", statName: "minutesPerApp" },
			{ displayName: "Distance Travelled", statKey: "DIST", statName: "distance" },
			{ displayName: "Teammates played with", statKey: "TEAM", statName: "teammatesPlayedWith" },
			{ displayName: "Number Teams Played For", statKey: "NumberTeamsPlayedFor", statName: "numberTeamsPlayedFor" },
			{ displayName: "Number Seasons Played For", statKey: "NumberSeasonsPlayedFor", statName: "numberSeasonsPlayedFor" }
		],
		"Performance Stats": [
			{ displayName: "MoM", statKey: "MOM", statName: "mom" },
			{ displayName: "Fantasy Points Achieved", statKey: "FTP", statName: "fantasyPoints" },
			{ displayName: "Fantasy Points Per Appearance", statKey: "FTPperAPP", statName: "fantasyPointsPerApp" },
			{ displayName: "Yellow Cards", statKey: "Y", statName: "yellowCards" },
			{ displayName: "Red Cards", statKey: "R", statName: "redCards" },
			{ displayName: "% Games Won", statKey: "Games%Won", statName: "gamesPercentWon" },
			{ displayName: "Points Per Game", statKey: "PlayerPointsPerGame", statName: "pointsPerGame" }
		],
		"Attacking Stats": [
			{ displayName: "All Goals Scored", statKey: "AllGSC", statName: "allGoalsScored" },
			{ displayName: "Goals Per Appearance", statKey: "GperAPP", statName: "goalsPerApp" },
			{ displayName: "Minutes Per Goal", statKey: "MperG", statName: "minutesPerGoal" },
			{ displayName: "Assists", statKey: "A", statName: "assists" },
			{ displayName: "Assists Per Appearance", statKey: "AperAPP", statName: "assistsPerApp" },
			{ displayName: "Goal Involvements", statKey: "GI", statName: "goalInvolvements" },
			{ displayName: "Goal Involvements Per Appearance", statKey: "GIperAPP", statName: "goalInvolvementsPerApp" }
		],
		"Defensive Stats": [
			{ displayName: "Clean Sheets", statKey: "CLS", statName: "cleanSheets" },
			{ displayName: "Conceded", statKey: "C", statName: "conceded" },
			{ displayName: "OGs", statKey: "OG", statName: "ownGoals" },
			{ displayName: "Penalties Conceded", statKey: "PCO", statName: "penaltiesConceded" },
			{ displayName: "Conceded Per Appearance", statKey: "CperAPP", statName: "concededPerApp" },
			{ displayName: "Minutes Per Clean Sheet", statKey: "MperCLS", statName: "minutesPerCleanSheet" }
		],
		"Penalty Stats": [
			{ displayName: "Penalties Taken", statKey: null, statName: "penaltiesTaken" },
			{ displayName: "Penalties Scored", statKey: "PSC", statName: "penaltiesScored" },
			{ displayName: "Penalties Missed", statKey: "PM", statName: "penaltiesMissed" },
			{ displayName: "Penalties Conceded", statKey: "PCO", statName: "penaltiesConceded" },
			{ displayName: "Penalties Saved", statKey: "PSV", statName: "penaltiesSaved" },
			{ displayName: "Penalty Conversion Rate", statKey: "PenConversionRate", statName: "penaltyConversionRate" },
			{ displayName: "Penalties Scored in a Penalty Shootout", statKey: "PS-PSC", statName: "penaltyShootoutPenaltiesScored" },
			{ displayName: "Penalties Missed in a Penalty Shootout", statKey: "PS-PM", statName: "penaltyShootoutPenaltiesMissed" },
			{ displayName: "Penalties Saved in a Penalty Shootout", statKey: "PS-PSV", statName: "penaltyShootoutPenaltiesSaved" }
		],
		"Goalkeeping Stats": [
			{ displayName: "Saves", statKey: "SAVES", statName: "saves" },
			{ displayName: "Saves Per Appearance", statKey: "SAVESperAPP", statName: "savesPerApp" },
			{ displayName: "Clean Sheets", statKey: "CLS", statName: "cleanSheets" },
			{ displayName: "Conceded", statKey: "C", statName: "conceded" },
			{ displayName: "Penalties Saved", statKey: "PSV", statName: "penaltiesSaved" },
			{ displayName: "Penalties Saved in a Penalty Shootout", statKey: "PS-PSV", statName: "penaltyShootoutPenaltiesSaved" }
		]
	};

	// Helper function to get stat value from player data
	const getPlayerStatValue = (playerData: PlayerData | null, statMapping: { displayName: string; statKey: string | null; statName: string }): number => {
		if (!playerData) return 0;
		
		// Special case for "Penalties Taken" - sum of scored and missed
		if (statMapping.displayName === "Penalties Taken") {
			const scored = toNumber(playerData.penaltiesScored);
			const missed = toNumber(playerData.penaltiesMissed);
			return scored + missed;
		}
		
		// If statKey exists, use getStatValue function
		if (statMapping.statKey) {
			return getStatValue(playerData, statMapping.statKey);
		}
		
		// Otherwise, access directly from PlayerData
		const value = playerData[statMapping.statName as keyof PlayerData];
		return toNumber(value);
	};

	// Build radar chart data
	const radarChartData = useMemo(() => {
		if (!player1Data || !secondPlayerData) return [];

		const categoryStats = statCategoryMapping[selectedStatCategory];
		if (!categoryStats || categoryStats.length === 0) return [];

		// Get all stat values for both players
		const statValues: { [key: string]: { player1: number; player2: number } } = {};
		categoryStats.forEach((statMapping) => {
			const player1Value = getPlayerStatValue(player1Data, statMapping);
			const player2Value = getPlayerStatValue(secondPlayerData, statMapping);
			statValues[statMapping.displayName] = {
				player1: player1Value,
				player2: player2Value
			};
		});

		// Find max and min values per stat for normalization
		const maxValues: { [key: string]: number } = {};
		const minValues: { [key: string]: number } = {};
		Object.entries(statValues).forEach(([statName, values]) => {
			maxValues[statName] = Math.max(values.player1, values.player2, 1);
			minValues[statName] = Math.min(values.player1, values.player2);
		});

		// Create data points with normalized values (0-100)
		return categoryStats.map((statMapping) => {
			const { player1, player2 } = statValues[statMapping.displayName];
			const max = maxValues[statMapping.displayName] || 1;
			const min = minValues[statMapping.displayName] || 1;
			
			// Get stat object to check if lower is better
			const stat = statMapping.statKey ? statObject[statMapping.statKey as keyof typeof statObject] : null;
			const statHigherBetter = stat && 'statHigherBetterBoolean' in stat 
				? (stat as any).statHigherBetterBoolean 
				: stat && 'statHigherBetterBooleanArray' in stat
					? Array.isArray((stat as any).statHigherBetterBooleanArray) && (stat as any).statHigherBetterBooleanArray.length > 0
						? (stat as any).statHigherBetterBooleanArray[0]
						: true
					: true;
			const isLowerBetter = statHigherBetter === false;
			
			let normalizedPlayer1: number;
			let normalizedPlayer2: number;
			
			if (isLowerBetter) {
				// For lower-is-better stats: lower value becomes 100%, higher value scales relative to it
				normalizedPlayer1 = min > 0 ? (min / player1) * 100 : 0;
				normalizedPlayer2 = min > 0 ? (min / player2) * 100 : 0;
			} else {
				// For higher-is-better stats: normalize relative to max (0-100)
				normalizedPlayer1 = max > 0 ? (player1 / max) * 100 : 0;
				normalizedPlayer2 = max > 0 ? (player2 / max) * 100 : 0;
			}
			
			return {
				category: statMapping.displayName,
				player1: normalizedPlayer1,
				player2: normalizedPlayer2,
				player1Raw: player1,
				player2Raw: player2
			};
		});
	}, [player1Data, secondPlayerData, selectedStatCategory]);

	// Custom tooltip for radar chart
	const radarTooltip = ({ active, payload, label }: any) => {
		if (!active || !payload || !payload.length) return null;

		const data = payload[0].payload;
		if (!data) return null;

		return (
			<div className='bg-black/90 px-3 py-2 rounded-lg shadow-lg border border-yellow-400/20'>
				<p className='text-white text-sm font-semibold mb-2'>{label}</p>
				{payload.map((entry: any, index: number) => {
					// Determine which player based on dataKey
					const isPlayer1 = entry.dataKey === "player1";
					const playerName = isPlayer1 ? (selectedPlayer || "Player 1") : (secondPlayer || "Player 2");
					const rawValue = isPlayer1 ? data.player1Raw : data.player2Raw;
					const color = entry.color;
					
					// Format the raw value
					let displayValue: string | number = rawValue;
					if (typeof rawValue === 'number') {
						if (rawValue % 1 !== 0) {
							displayValue = rawValue.toFixed(2);
						} else {
							displayValue = rawValue.toLocaleString('en-US');
						}
					}
					
					return (
						<p key={index} className='text-white text-xs' style={{ color: color }}>
							{playerName}: {displayValue}
						</p>
					);
				})}
			</div>
		);
	};

	useEffect(() => {
		const fetchAllPlayers = async () => {
			if (playersLoaded) return;

			setIsLoadingPlayers(true);
			try {
				const cacheKey = generatePageCacheKey("stats", "comparison", "players", {});
				const data = await cachedFetch("/api/players", {
					method: "GET",
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				setAllPlayers(data.players || []);
				setPlayersLoaded(true);
			} catch (error) {
				console.error("Error fetching players:", error);
				setAllPlayers([]);
			} finally {
				setIsLoadingPlayers(false);
			}
		};

		fetchAllPlayers();
	}, [playersLoaded, getCachedPageData, setCachedPageData]);

	useEffect(() => {
		if (secondPlayer && typeof window !== "undefined") {
			safeLocalStorageSet("comparison-second-player", secondPlayer);
		} else if (!secondPlayer && typeof window !== "undefined") {
			safeLocalStorageRemove("comparison-second-player");
			safeLocalStorageRemove("comparison-second-player-data");
		}
	}, [secondPlayer]);

	useEffect(() => {
		if (secondPlayerData && typeof window !== "undefined") {
			safeLocalStorageSet("comparison-second-player-data", JSON.stringify(secondPlayerData));
		} else if (!secondPlayerData && typeof window !== "undefined") {
			safeLocalStorageRemove("comparison-second-player-data");
		}
	}, [secondPlayerData]);

	useEffect(() => {
		const fetchSecondPlayerData = async () => {
			if (!secondPlayer) {
				setSecondPlayerData(null);
				if (typeof window !== "undefined") {
					safeLocalStorageRemove("comparison-second-player-data");
				}
				return;
			}
			if (hasUnsavedFilters || isFilterSidebarOpen) return; // Skip API calls while editing filters or sidebar is open

			setIsLoadingSecondPlayer(true);
			try {
				const { getCsrfHeaders } = await import("@/lib/middleware/csrf");
				const csrfHeaders = getCsrfHeaders();
				
				const requestBody = {
					playerName: secondPlayer,
					filters: playerFilters,
				};
				const cacheKey = generatePageCacheKey("stats", "comparison", "player-data-filtered", requestBody);
				const data = await cachedFetch("/api/player-data-filtered", {
					method: "POST",
					body: requestBody,
					headers: csrfHeaders,
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				setSecondPlayerData(data.playerData);
			} catch (error) {
				console.error("Error fetching second player data:", error);
				setSecondPlayerData(null);
				if (typeof window !== "undefined") {
					safeLocalStorageRemove("comparison-second-player-data");
				}
			} finally {
				setIsLoadingSecondPlayer(false);
			}
		};

		fetchSecondPlayerData();
	}, [secondPlayer, playerFilters, hasUnsavedFilters, isFilterSidebarOpen, getCachedPageData, setCachedPageData]);

	const handleClearSecondPlayer = () => {
		setSecondPlayer(null);
		setSecondPlayerData(null);
		setQuery("");
		if (typeof window !== "undefined") {
			safeLocalStorageRemove("comparison-second-player");
			safeLocalStorageRemove("comparison-second-player-data");
		}
	};

	const getFilteredPlayers = () => {
		if (query.length < 3) {
			return [];
		}
		return allPlayers.filter((player) => 
			player.playerName && 
			player.playerName.toLowerCase().includes(query.toLowerCase()) &&
			player.playerName !== selectedPlayer
		);
	};

	const handleEditClick = () => {
		enterEditMode();
		setMainPage("home");
	};

	if (!selectedPlayer) {
		return (
			<div className='h-full flex items-center justify-center p-4'>
				<div className='text-center'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-2 md:mb-4'>Player Comparison</h2>
					<p className='text-white text-sm md:text-base mb-4'>Select a player to display data here</p>
					<button
						onClick={handleEditClick}
						className='flex items-center justify-center mx-auto w-8 h-8 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors'
						title='Select a player'>
						<PencilIcon className='h-4 w-4 md:h-5 md:w-5' />
					</button>
				</div>
			</div>
		);
	}

	const handleDropdownOpen = () => {
		setTimeout(() => {
			if (inputRef.current) {
				inputRef.current.focus();
			}
		}, 100);
	};

	return (
		<div className='h-full flex flex-col overflow-hidden'>
			<div className='flex-shrink-0 p-2 md:p-4 md:max-w-2xl md:mx-auto w-full' style={{ overflow: 'visible' }}>
				<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-4 text-center'>Player Comparison</h2>
				
				<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
				
				{/* Player Selection */}
				<div className='flex flex-row gap-3 md:gap-4 mb-4'>
					{/* Player 1 (Current Selection) - 40% width */}
					<div className='flex-1' style={{ flexBasis: '40%', minWidth: 0 }}>
						<div className='flex items-center gap-2 mb-2'>
							<label className='text-sm md:text-base font-medium text-white/90'>First Player</label>
							<Button
								variant="icon"
								size="sm"
								onClick={handleEditClick}
								title='Edit player selection'
								className='w-8 h-8 md:w-8 md:h-8 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 flex-shrink-0'
								icon={<PenOnPaperIcon className='h-4 w-4 md:h-5 md:w-5' />} />
						</div>
						<div className='py-3 text-left text-yellow-300 text-sm md:text-base truncate'>
							{selectedPlayer}
						</div>
					</div>

					{/* Player 2 Selection - 60% width */}
					<div className='flex-1' style={{ flexBasis: '60%', minWidth: 0 }}>
						<div className='flex items-center gap-2 mb-2'>
							<label className='text-sm md:text-base font-medium text-white/90 mt-1 mb-2'>Select Second Player</label>
							{secondPlayer && (
								<button
									onClick={handleClearSecondPlayer}
									className='flex items-center justify-center w-5 h-5 md:w-6 md:h-6 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors flex-shrink-0'
									title='Clear player 2 selection'>
									<XMarkIcon className='h-3 w-3 md:h-4 md:w-4' />
								</button>
							)}
						</div>
						<Listbox 
							value={secondPlayer} 
							onChange={setSecondPlayer}>
							<div className='relative w-full'>
								<Listbox.Button 
									onClick={handleDropdownOpen}
									aria-label="Select Second Player"
									className='relative w-full cursor-default dark-dropdown py-3 pl-4 pr-10 text-left shadow-md focus:outline-none focus-visible:ring-1 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-1 focus-visible:ring-offset-yellow-300 text-sm md:text-base'>
									<span className={`block truncate ${secondPlayer ? "text-white" : "text-yellow-300"}`}>
										{secondPlayer || "Choose a player..."}
									</span>
									<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
										<ChevronUpDownIcon className='h-5 w-5 text-yellow-300' aria-hidden='true' />
									</span>
								</Listbox.Button>
								<Listbox.Options
									className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-sm md:text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none hide-scrollbar'
									onKeyDown={(e) => {
										if (e.key === " " || e.key.length === 1) {
											e.stopPropagation();
										}
									}}>
									<div className='px-3 py-2'>
										<input
											ref={inputRef}
											type='text'
											placeholder={query.length < 3 ? "Type at least 3 characters..." : "Type to filter players..."}
											value={query}
											onChange={(e) => setQuery(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === " " || e.key.length === 1) {
													e.stopPropagation();
												}
											}}
											onKeyUp={(e) => {
												if (e.key === " " || e.key.length === 1) {
													e.stopPropagation();
												}
											}}
											onInput={(e) => {
												const target = e.target as HTMLInputElement;
												setQuery(target.value);
											}}
											enterKeyHint='search'
											className='dark-input w-full text-sm'
										/>
									</div>
									{!playersLoaded && isLoadingPlayers && <div className='px-3 py-2 text-yellow-300 text-sm'>Loading players...</div>}
									{playersLoaded && query.length < 3 && (
										<div className='px-3 py-2 text-yellow-300 text-sm'>Type at least 3 characters to filter players</div>
									)}
									{playersLoaded && query.length >= 3 && getFilteredPlayers().length === 0 && (
										<div className='px-3 py-2 text-yellow-300 text-sm'>No players found</div>
									)}
									{getFilteredPlayers().map((player, playerIdx) => (
										<Listbox.Option
											key={playerIdx}
											className={({ active }) =>
												`relative cursor-default select-none dark-dropdown-option ${active ? "bg-yellow-400/10 text-yellow-300" : "text-white"}`
											}
											value={player.playerName}>
											{({ selected }) => (
												<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
													{player.playerName} ({player.mostPlayedForTeam || "Unknown"})
												</span>
											)}
										</Listbox.Option>
									))}
								</Listbox.Options>
							</div>
						</Listbox>
					</div>
				</div>
			</div>
			
			<div className='flex-1 px-2 md:px-4 pb-4 min-h-0 overflow-y-auto overflow-x-hidden' style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
				{isLoadingSecondPlayer ? (
					<div className='flex items-center justify-center h-64'>
						<p className='text-sm md:text-base text-gray-300'>Loading comparison data...</p>
					</div>
				) : !secondPlayer ? (
					<div className='flex items-center justify-center h-full'>
						<p className='text-white text-sm md:text-base text-center'>Select Second Player to begin the comparison</p>
					</div>
				) : (
					<div className='space-y-1'>
						{/* Radar Comparison Header and Radar Chart */}
						<div id='comparison-radar-chart' className='mb-6'>
							<h3 className='text-white font-semibold text-sm md:text-base mb-4'>Radar Comparison</h3>
									
									{/* Stat Category Dropdown */}
									<div className='mb-4'>
										<Listbox value={selectedStatCategory} onChange={setSelectedStatCategory}>
											<div className='relative'>
												<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-sm md:text-base'>
													<span className='block truncate text-white'>
														{selectedStatCategory}
													</span>
													<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
														<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
													</span>
												</Listbox.Button>
												<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-sm md:text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
													{["Appearance Stats", "Performance Stats", "Attacking Stats", "Defensive Stats", "Penalty Stats", "Goalkeeping Stats"].map((category) => (
														<Listbox.Option
															key={category}
															className={({ active }) =>
																`relative cursor-default select-none dark-dropdown-option ${active ? "bg-yellow-400/10 text-yellow-300" : "text-white"}`
															}
															value={category}>
															{({ selected }) => (
																<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
																	{category}
																</span>
															)}
														</Listbox.Option>
													))}
												</Listbox.Options>
											</div>
										</Listbox>
									</div>

									{/* Legend */}
									<div className='flex items-center justify-center gap-4 md:gap-6 mb-4'>
										<div className='flex items-center gap-2'>
											<div className='w-4 h-4 rounded' style={{ backgroundColor: '#1C8841' }}></div>
											<span className='text-white text-xs md:text-sm'>{selectedPlayer || "Player 1"}</span>
										</div>
										<div className='flex items-center gap-2'>
											<div className='w-4 h-4 rounded' style={{ backgroundColor: '#F9ED32' }}></div>
											<span className='text-white text-xs md:text-sm'>{secondPlayer || "Player 2"}</span>
										</div>
									</div>

									{/* Radar Chart */}
									{radarChartData.length > 0 ? (
										<div className='chart-container -my-2' style={{ touchAction: 'pan-y' }}>
											<ResponsiveContainer width='100%' height={300}>
												<RadarChart 
													data={radarChartData}
													margin={{ top: 0, right: 25, bottom: 0, left: 25 }}
												>
													<PolarGrid />
													<PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
													<Radar
														name={selectedPlayer || "Player 1"}
														dataKey="player1"
														stroke="#1C8841"
														fill="#1C8841"
														fillOpacity={0.3}
													/>
													<Radar
														name={secondPlayer || "Player 2"}
														dataKey="player2"
														stroke="#F9ED32"
														fill="#F9ED32"
														fillOpacity={0.3}
													/>
													<PolarAngleAxis 
														dataKey='category' 
														tick={(props: any) => {
															const { x, y, payload } = props;
															const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
															const text = payload.value;
															
															// Aggressive wrapping for mobile - split on spaces and limit characters per line
															const splitText = (str: string, maxChars: number): string[] => {
																if (!isMobile) return [str];
																const words = str.split(' ');
																const lines: string[] = [];
																let currentLine = '';
																
																words.forEach((word, index) => {
																	if (currentLine.length + word.length + 1 <= maxChars || currentLine === '') {
																		currentLine += (currentLine ? ' ' : '') + word;
																	} else {
																		if (currentLine) lines.push(currentLine);
																		currentLine = word;
																	}
																	if (index === words.length - 1 && currentLine) {
																		lines.push(currentLine);
																	}
																});
																
																return lines.length > 0 ? lines : [str];
															};
															
															const lines = splitText(text, isMobile ? 8 : 20);
															const lineHeight = isMobile ? 10 : 12;
															const startY = -(lines.length - 1) * lineHeight / 2;
															
															return (
																<g transform={`translate(${x},${y})`}>
																	<text
																		x={0}
																		y={startY}
																		dy={16}
																		textAnchor="middle"
																		fill="#fff"
																		fontSize={isMobile ? 10 : 12}
																	>
																		{lines.map((line, index) => (
																			<tspan
																				key={index}
																				x={0}
																				dy={index === 0 ? 0 : lineHeight}
																				textAnchor="middle"
																			>
																				{line}
																			</tspan>
																		))}
																	</text>
																</g>
															);
														}}
													/>
													<Tooltip content={radarTooltip} />
												</RadarChart>
											</ResponsiveContainer>
										</div>
									) : (
										<div className='flex items-center justify-center h-64'>
											<p className='text-white text-sm'>No data available for comparison</p>
										</div>
									)}
						</div>

						<div id='comparison-full-comparison'>
							<h3 className='text-white font-semibold text-sm md:text-base mb-4'>Full Comparison</h3>

							<div className='text-xs md:text-sm text-white/70 italic mb-4 text-center'>
								<span className='md:hidden'>Press and hold on any stat row to see an explanation of the stat</span>
								<span className='hidden md:inline'>Click on any stat row to see an explanation of the stat</span>
							</div>
						</div>
						{filteredStatEntries.map(([key, stat]) => (
							<ComparisonStatRow
								key={key}
								statKey={key}
								stat={stat}
								player1Data={player1Data}
								player2Data={secondPlayerData}
								player1Name={selectedPlayer}
								player2Name={secondPlayer}
							/>
						))}
						<div className='pb-8 md:pb-12'></div>
					</div>
				)}
			</div>
		</div>
	);
}
