"use client";

import { useNavigationStore, type TeamData } from "@/lib/stores/navigation";
import { statObject, statsPageConfig } from "@/config/config";
import Image from "next/image";
import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
	} = useNavigationStore();

	// Initialize selected team from localStorage, player's most played team, or first available team
	const [selectedTeam, setSelectedTeam] = useState<string>(() => {
		if (typeof window !== "undefined" && selectedPlayer) {
			try {
				const storageKey = `team-stats-selected-team-${selectedPlayer}`;
				const saved = localStorage.getItem(storageKey);
				if (saved) {
					return saved;
				}
			} catch (e) {
				// localStorage may be unavailable (private mode, quota exceeded, etc.)
				console.warn('Failed to read from localStorage:', e);
			}
		}
		return "";
	});
	const [teamData, setTeamData] = useState<TeamData | null>(null);
	const [isLoadingTeamData, setIsLoadingTeamData] = useState(false);
	
	// Top players table state
	const [selectedStatType, setSelectedStatType] = useState<StatType>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem("team-stats-top-players-stat-type");
				const validStatTypes: StatType[] = ["appearances", "goals", "assists", "cleanSheets", "mom", "saves", "yellowCards", "redCards", "penaltiesScored", "fantasyPoints", "goalInvolvements", "minutes", "ownGoals", "conceded", "penaltiesMissed", "penaltiesConceded", "penaltiesSaved", "distance"];
				if (saved && validStatTypes.includes(saved as StatType)) {
					return saved as StatType;
				}
			} catch (e) {
				// localStorage may be unavailable
				console.warn('Failed to read from localStorage:', e);
			}
		}
		return "appearances";
	});
	const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
	const [isLoadingTopPlayers, setIsLoadingTopPlayers] = useState(false);

	// State for view mode toggle
	const [isDataTableMode, setIsDataTableMode] = useState(false);

	// Track previous player to detect changes
	const previousPlayerRef = useRef<string | null>(selectedPlayer);

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

		const storageKey = `team-stats-selected-team-${selectedPlayer}`;
		let savedTeam: string | null = null;
		if (typeof window !== "undefined") {
			try {
				savedTeam = localStorage.getItem(storageKey);
			} catch (e) {
				console.warn('Failed to read from localStorage:', e);
			}
		}
		
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
			try {
				const storageKey = `team-stats-selected-team-${selectedPlayer}`;
				localStorage.setItem(storageKey, selectedTeam);
			} catch (e) {
				console.warn('Failed to write to localStorage:', e);
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
			try {
				localStorage.setItem("team-stats-top-players-stat-type", selectedStatType);
			} catch (e) {
				console.warn('Failed to write to localStorage:', e);
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

	// Fetch team data when selected team or filters change
	const filtersKey = JSON.stringify({ selectedTeam, playerFilters: apiFilters || {} });
	
	useEffect(() => {
		if (!selectedTeam || !playerFilters) return;

		const fetchTeamData = async () => {
			setIsLoadingTeamData(true);
			try {
				const response = await fetch("/api/team-data-filtered", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						teamName: selectedTeam,
						filters: {
							...playerFilters,
							teams: [], // Don't pass teams in filters, use teamName instead
						},
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
	}, [filtersKey, selectedTeam, playerFilters]);

	// Fetch top players when selected team, filters or stat type changes
	useEffect(() => {
		if (!selectedTeam || !apiFilters) return;

		const fetchTopPlayers = async () => {
			setIsLoadingTopPlayers(true);
			console.log(`[TeamStats] Fetching top players for statType: ${selectedStatType}`, {
				selectedTeam,
				filters: apiFilters,
			});
			
			try {
				const response = await fetch("/api/top-players-stats", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						filters: apiFilters,
						statType: selectedStatType,
					}),
				});

				if (response.ok) {
					const data = await response.json();
					console.log(`[TeamStats] Received ${data.players?.length || 0} players for statType: ${selectedStatType}`, data.players);
					setTopPlayers(data.players || []);
				} else {
					const errorText = await response.text();
					console.error(`[TeamStats] Failed to fetch top players: ${response.statusText}`, errorText);
					setTopPlayers([]);
				}
			} catch (error) {
				console.error("[TeamStats] Error fetching top players:", error);
				setTopPlayers([]);
			} finally {
				setIsLoadingTopPlayers(false);
			}
		};

		fetchTopPlayers();
	}, [filtersKey, selectedStatType, selectedTeam, apiFilters]);

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
					<button
						onClick={() => setIsDataTableMode(!isDataTableMode)}
						className='text-white underline hover:text-white/80 text-sm md:text-base cursor-pointer'>
						{isDataTableMode ? "Switch to data visualisation" : "Switch to data table"}
					</button>
				</div>
				<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
			</div>

			{!selectedTeam ? (
				<div className='flex-1 flex items-center justify-center p-4'>
					<div className='text-center'>
						<p className='text-white text-sm md:text-base'>Please select a team to view stats</p>
					</div>
				</div>
			) : isLoadingTeamData ? (
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
					{/* Key Performance Stats - Only show in data visualisation mode */}
					{!isDataTableMode && (
						<div className='mb-4'>
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

