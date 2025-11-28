"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigationStore } from "@/lib/stores/navigation";
import { getCurrentSeasonFromStorage } from "@/lib/services/currentSeasonService";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/20/solid";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

interface Player {
	rank: number;
	playerName: string;
	ftpScore: number;
}

interface PlayerStats {
	appearances: number;
	goals: number;
	assists: number;
	cleanSheets: number;
	mom: number;
	yellowCards: number;
	redCards: number;
	saves: number;
	ownGoals: number;
	conceded: number;
	penaltiesScored: number;
	penaltiesMissed: number;
	penaltiesSaved: number;
	matchDetails: MatchDetailWithSummary[];
}

interface MatchDetailWithSummary {
	team: string;
	playerName: string;
	date: string;
	min: number;
	class: string;
	mom: boolean;
	goals: number;
	assists: number;
	yellowCards: number;
	redCards: number;
	saves: number;
	ownGoals: number;
	conceded: number;
	cleanSheets: number;
	penaltiesScored: number;
	penaltiesMissed: number;
	penaltiesConceded: number;
	penaltiesSaved: number;
	matchSummary?: string | null;
	opposition?: string | null;
	result?: string | null;
}

interface FTPBreakdown {
	stat: string;
	value: number | string;
	points: number;
	show: boolean;
}

export default function PlayersOfMonth() {
	const {
		cachePOMSeasons,
		cachePOMMonths,
		cachePOMMonthData,
		cachePOMPlayerStats,
		getCachedPOMSeasons,
		getCachedPOMMonths,
		getCachedPOMMonthData,
		getCachedPOMPlayerStats,
	} = useNavigationStore();

	const [seasons, setSeasons] = useState<string[]>([]);
	const [selectedSeason, setSelectedSeason] = useState<string>("");
	const [months, setMonths] = useState<string[]>([]);
	const [selectedMonth, setSelectedMonth] = useState<string>("");
	const [players, setPlayers] = useState<Player[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingStats, setLoadingStats] = useState(true);
	const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
	const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({});
	const [loadingIndividualStats, setLoadingIndividualStats] = useState<Set<string>>(new Set());
	const [isFetchingMonthData, setIsFetchingMonthData] = useState(false);
	const [isMonthValidating, setIsMonthValidating] = useState(false);
	const previousSeasonRef = useRef<string>("");
	const isMonthValidatingRef = useRef<boolean>(false);
	const validatedMonthRef = useRef<string | null>(null);

	// Fetch seasons on mount - check cache first
	useEffect(() => {
		const cachedSeasons = getCachedPOMSeasons();
		if (cachedSeasons) {
			setSeasons(cachedSeasons.seasons);
			if (cachedSeasons.seasons.length > 0) {
				setSelectedSeason(cachedSeasons.seasons[0]);
			}
			return;
		}

		const fetchSeasons = async () => {
			try {
				const response = await fetch("/api/players-of-month/seasons");
				const data = await response.json();
				if (data.seasons) {
					setSeasons(data.seasons);
					// Use currentSeason from localStorage, or first season
					const currentSeason = getCurrentSeasonFromStorage();
					if (currentSeason && data.seasons.includes(currentSeason)) {
						setSelectedSeason(currentSeason);
					} else if (data.seasons.length > 0) {
						setSelectedSeason(data.seasons[0]);
					}
					cachePOMSeasons(data.seasons);
				}
			} catch (error) {
				console.error("Error fetching seasons:", error);
			}
		};
		fetchSeasons();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Fetch months when season changes - check cache first
	useEffect(() => {
		if (!selectedSeason) return;

		const seasonChanged = previousSeasonRef.current !== selectedSeason;
		const previousSeason = previousSeasonRef.current;
		previousSeasonRef.current = selectedSeason;

		console.log(`[PlayersOfMonth] Month fetch effect triggered. Season changed: ${seasonChanged}, from "${previousSeason}" to "${selectedSeason}"`);

		// Clear months state when season changes to prevent using stale data
		if (seasonChanged) {
			console.log(`[PlayersOfMonth] Season changed - clearing months state to prevent stale data`);
			setMonths([]);
		}

		// Set validation flag to indicate month validation is in progress (both ref and state)
		isMonthValidatingRef.current = true;
		setIsMonthValidating(true);
		console.log(`[PlayersOfMonth] Setting validation flag to true`);

		const validateAndSetMonth = (availableMonths: string[]) => {
			console.log(`[PlayersOfMonth] validateAndSetMonth called with ${availableMonths.length} months. Current selectedMonth: "${selectedMonth}"`);
			
			if (availableMonths.length === 0) {
				setSelectedMonth("");
				console.log(`[PlayersOfMonth] No months available for season ${selectedSeason}`);
				// Clear validation flag immediately
				isMonthValidatingRef.current = false;
				setIsMonthValidating(false);
				validatedMonthRef.current = null;
				return;
			}

			let monthToSet: string;
			// If season changed, validate month exists in new season
			if (seasonChanged) {
				if (selectedMonth && availableMonths.includes(selectedMonth)) {
					// Month exists in new season, keep it
					monthToSet = selectedMonth;
					console.log(`[PlayersOfMonth] Season changed to ${selectedSeason}, keeping month: ${monthToSet}`);
				} else {
					// Month doesn't exist in new season, select most recent
					monthToSet = availableMonths[availableMonths.length - 1];
					console.log(`[PlayersOfMonth] Season changed to ${selectedSeason}, month "${selectedMonth}" not available. Selecting most recent: ${monthToSet}`);
				}
			} else {
				// Season didn't change, just ensure we have a month selected
				if (!selectedMonth && availableMonths.length > 0) {
					monthToSet = availableMonths[availableMonths.length - 1];
					console.log(`[PlayersOfMonth] No month selected, selecting most recent: ${monthToSet}`);
				} else {
					monthToSet = selectedMonth;
				}
			}
			
			// Set the month and clear validation flag immediately
			setSelectedMonth(monthToSet);
			console.log(`[PlayersOfMonth] Month validation complete. Setting month to "${monthToSet}". Clearing validation flag.`);
			
			// Clear validation flag immediately - React will batch the state updates
			isMonthValidatingRef.current = false;
			setIsMonthValidating(false);
			validatedMonthRef.current = null;
		};

		const cachedMonths = getCachedPOMMonths(selectedSeason);
		if (cachedMonths) {
			console.log(`[PlayersOfMonth] Using cached months for season ${selectedSeason}`);
			setMonths(cachedMonths);
			validateAndSetMonth(cachedMonths);
			return;
		}

		const fetchMonths = async () => {
			console.log(`[PlayersOfMonth] Fetching months from API for season ${selectedSeason}`);
			try {
				const response = await fetch(`/api/players-of-month/months?season=${encodeURIComponent(selectedSeason)}`);
				const data = await response.json();
				if (data.months) {
					console.log(`[PlayersOfMonth] Received ${data.months.length} months from API`);
					setMonths(data.months);
					validateAndSetMonth(data.months);
					cachePOMMonths(selectedSeason, data.months);
				} else {
					console.log(`[PlayersOfMonth] No months in API response`);
					validatedMonthRef.current = "";
					setSelectedMonth("");
					isMonthValidatingRef.current = false;
					setIsMonthValidating(false);
				}
			} catch (error) {
				console.error("Error fetching months:", error);
				setMonths([]);
				validatedMonthRef.current = "";
				setSelectedMonth("");
				isMonthValidatingRef.current = false;
				setIsMonthValidating(false);
			}
		};
		fetchMonths();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedSeason]);

	// Fetch month data when season and month are selected - check cache first
	useEffect(() => {
		console.log(`[PlayersOfMonth] Month data fetch effect triggered. Season: "${selectedSeason}", Month: "${selectedMonth}", isMonthValidating: ${isMonthValidating}, isMonthValidatingRef: ${isMonthValidatingRef.current}`);
		
		if (!selectedSeason) {
			setPlayers([]);
			setPlayerStats({});
			console.log(`[PlayersOfMonth] Skipping data fetch - no season selected`);
			return;
		}

		// Wait for month validation to complete before proceeding (check both state and ref)
		if (isMonthValidating || isMonthValidatingRef.current) {
			console.log(`[PlayersOfMonth] Month validation in progress (state: ${isMonthValidating}, ref: ${isMonthValidatingRef.current}). Waiting...`);
			setPlayers([]);
			setPlayerStats({});
			return;
		}


		// Get available months for validation - ALWAYS use cached months for the current season
		// Don't use the months state as it may contain stale data from previous season
		const cachedMonths = getCachedPOMMonths(selectedSeason);
		const availableMonths = cachedMonths;
		
		console.log(`[PlayersOfMonth] Available months for season ${selectedSeason}: ${availableMonths ? availableMonths.length : 0}, cached months: [${availableMonths ? availableMonths.join(", ") : "none"}]`);
		
		// If months aren't loaded yet, wait
		if (!availableMonths || availableMonths.length === 0) {
			console.log(`[PlayersOfMonth] Months not yet loaded for season ${selectedSeason}. Waiting...`);
			setPlayers([]);
			setPlayerStats({});
			return;
		}

		// Determine the correct month to use
		// If selectedMonth is invalid for this season, use the most recent month instead
		let monthToUse = selectedMonth;
		const isMonthValid = selectedMonth && availableMonths.includes(selectedMonth);
		console.log(`[PlayersOfMonth] Checking month validity. selectedMonth: "${selectedMonth}", isMonthValid: ${isMonthValid}, availableMonths: [${availableMonths.join(", ")}]`);
		
		if (!isMonthValid) {
			monthToUse = availableMonths[availableMonths.length - 1];
			console.log(`[PlayersOfMonth] Month "${selectedMonth || "none"}" not valid for season ${selectedSeason}. Using most recent: ${monthToUse}`);
			// Update the state to the correct month
			if (selectedMonth !== monthToUse) {
				console.log(`[PlayersOfMonth] Updating selectedMonth from "${selectedMonth}" to "${monthToUse}" and returning early`);
				setSelectedMonth(monthToUse);
				// Return early - this effect will run again with the updated month
				return;
			}
		}

		if (!monthToUse) {
			setPlayers([]);
			setPlayerStats({});
			console.log(`[PlayersOfMonth] Skipping data fetch - no valid month for season ${selectedSeason}`);
			return;
		}

		// Double-check that the month is still valid (in case validation just completed)
		if (!availableMonths.includes(monthToUse)) {
			console.log(`[PlayersOfMonth] Month "${monthToUse}" is not in available months. This should not happen. Waiting for correction...`);
			setPlayers([]);
			setPlayerStats({});
			return;
		}

		console.log(`[PlayersOfMonth] Displaying data for season: ${selectedSeason}, month: ${monthToUse}`);

		// Clear player stats and players when month/season changes to force refresh
		// Clear players first to prevent stats fetch from using stale data
		setPlayers([]);
		setPlayerStats({});
		setExpandedPlayers(new Set()); // Also collapse any expanded players

		const cachedMonthData = getCachedPOMMonthData(selectedSeason, monthToUse);
		if (cachedMonthData) {
			console.log(`[PlayersOfMonth] Using cached data for ${monthToUse} ${selectedSeason}`);
			// Set players after clearing to ensure stats fetch uses correct data
			setPlayers(cachedMonthData.players);
			// Ensure fetching flag is cleared so stats can load
			setIsFetchingMonthData(false);
			// Don't set loading to false here - let the stats fetching effect handle it
			return;
		}

		// Set loading state immediately when month changes
		setLoading(true);
		setIsFetchingMonthData(true);

		const fetchMonthData = async () => {
			const apiUrl = `/api/players-of-month/month-data?season=${encodeURIComponent(selectedSeason)}&month=${encodeURIComponent(monthToUse)}`;
			console.log(`[PlayersOfMonth] Fetching data from API: ${apiUrl}`);
			try {
				const response = await fetch(apiUrl);
				const data = await response.json();
				
				if (data.players) {
					console.log(`[PlayersOfMonth] Received ${data.players.length} players for ${monthToUse} ${selectedSeason}: [${data.players.map((p: Player) => p.playerName).join(", ")}]`);
					// Clear old stats before setting new players
					setPlayerStats({});
					setPlayers(data.players);
					cachePOMMonthData(selectedSeason, monthToUse, data.players);
				} else {
					console.log(`[PlayersOfMonth] No players found for ${monthToUse} ${selectedSeason}`);
					setPlayers([]);
					setPlayerStats({});
				}
				setIsFetchingMonthData(false);
			} catch (error) {
				console.error(`[PlayersOfMonth] Error fetching month data for ${monthToUse} ${selectedSeason}:`, error);
				setPlayers([]);
				setPlayerStats({});
				setIsFetchingMonthData(false);
				setLoading(false);
				setLoadingStats(false);
			}
		};
		fetchMonthData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedSeason, selectedMonth, months, isMonthValidating]);

	// Fetch stats for all players when players list changes - check cache first
	useEffect(() => {
		const playerNames = players.map(p => p.playerName).join(", ");
		console.log(`[PlayersOfMonth] Stats fetch effect triggered. Season: "${selectedSeason}", Month: "${selectedMonth}", players: ${players.length} [${playerNames}], isFetchingMonthData: ${isFetchingMonthData}`);
		
		if (!selectedSeason || !selectedMonth || players.length === 0) {
			setLoadingStats(false);
			if (players.length === 0 && !isFetchingMonthData) {
				setLoading(false);
			}
			return;
		}

		// Verify players match current season/month to prevent using stale data
		const cachedMonthData = getCachedPOMMonthData(selectedSeason, selectedMonth);
		if (cachedMonthData && cachedMonthData.players.length > 0) {
			const cachedPlayerNames = cachedMonthData.players.map((p: Player) => p.playerName).sort().join(", ");
			const currentPlayerNames = players.map(p => p.playerName).sort().join(", ");
			if (cachedPlayerNames !== currentPlayerNames) {
				console.log(`[PlayersOfMonth] Player mismatch detected! Cached: [${cachedPlayerNames}], Current: [${currentPlayerNames}]. Waiting for correct players...`);
				return;
			}
		}

		const fetchAllPlayerStats = async () => {
			console.log(`[PlayersOfMonth] Fetching stats for ${players.length} players: [${playerNames}]`);
			setLoadingStats(true);
			setLoading(true);
			
			// Collect all stats in a single object to batch state update
			const newStats: Record<string, PlayerStats> = {};
			
			const statsPromises = players.map(async (player) => {
				// Always fetch fresh stats from API (no caching)
				const apiUrl = `/api/players-of-month/player-stats?season=${encodeURIComponent(selectedSeason)}&month=${encodeURIComponent(selectedMonth)}&playerName=${encodeURIComponent(player.playerName)}`;
				console.log(`[PlayersOfMonth] Fetching stats from API for ${player.playerName}: ${apiUrl}`);
				
				try {
					const response = await fetch(apiUrl);
					if (!response.ok) {
						console.error(`[PlayersOfMonth] Failed to fetch stats for ${player.playerName}`);
						return;
					}

					const data = await response.json();
					console.log(`[PlayersOfMonth] Received stats for ${player.playerName}: goals=${data.goals}, assists=${data.assists}, appearances=${data.appearances}`);
					if (data.matchDetails) {
						const stats: PlayerStats = {
							appearances: data.appearances || 0,
							goals: data.goals || 0,
							assists: data.assists || 0,
							cleanSheets: data.cleanSheets || 0,
							mom: data.mom || 0,
							yellowCards: data.yellowCards || 0,
							redCards: data.redCards || 0,
							saves: data.saves || 0,
							ownGoals: data.ownGoals || 0,
							conceded: data.conceded || 0,
							penaltiesScored: data.penaltiesScored || 0,
							penaltiesMissed: data.penaltiesMissed || 0,
							penaltiesSaved: data.penaltiesSaved || 0,
							matchDetails: data.matchDetails || [],
						};

						newStats[player.playerName] = stats;
						// No caching - always fetch fresh stats
					}
				} catch (error) {
					console.error(`[PlayersOfMonth] Error fetching stats for ${player.playerName}:`, error);
				}
			});

			await Promise.all(statsPromises);
			
			// Batch update all stats at once
			console.log(`[PlayersOfMonth] Stats fetch complete. Loaded stats for ${Object.keys(newStats).length} players`);
			setPlayerStats(newStats);
		};

		fetchAllPlayerStats();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [players, selectedSeason, selectedMonth, isFetchingMonthData]);

	// Check if all stats are loaded
	useEffect(() => {
		// Only check if we have a season and month selected (meaning we've attempted a fetch)
		if (!selectedSeason || !selectedMonth) {
			return;
		}

		if (players.length === 0 && !isFetchingMonthData) {
			// Only set loading to false if we've actually attempted to fetch and it's complete
			// Use a small delay to ensure the fetch has completed
			const timer = setTimeout(() => {
				setLoadingStats(false);
				setLoading(false);
			}, 100);
			return () => clearTimeout(timer);
		}

		const allStatsLoaded = players.length === 5 && players.every((player) => {
			return playerStats[player.playerName] !== undefined;
		});

		if (allStatsLoaded) {
			setLoadingStats(false);
			setLoading(false);
		}
	}, [playerStats, players, selectedSeason, selectedMonth, isFetchingMonthData]);

	// Fetch player stats when row is expanded - check cache first
	const handleRowExpand = async (playerName: string) => {
		if (expandedPlayers.has(playerName)) {
			// Collapse
			setExpandedPlayers((prev) => {
				const newSet = new Set(prev);
				newSet.delete(playerName);
				return newSet;
			});
			return;
		}

		// Expand and fetch stats
		setExpandedPlayers((prev) => new Set(prev).add(playerName));
		
		// Check local state first
		if (playerStats[playerName]) {
			// Stats already loaded
			return;
		}

		if (!selectedSeason || !selectedMonth) {
			return;
		}

		// Always fetch fresh stats from API (no caching)

		const apiUrl = `/api/players-of-month/player-stats?season=${encodeURIComponent(selectedSeason)}&month=${encodeURIComponent(selectedMonth)}&playerName=${encodeURIComponent(playerName)}`;

		setLoadingIndividualStats((prev) => new Set(prev).add(playerName));

		try {
			const response = await fetch(apiUrl);
			
			if (!response.ok) {
				throw new Error(`API error: ${response.status} ${response.statusText}`);
			}
			
			const data = await response.json();
			
			if (data.matchDetails) {
				const stats: PlayerStats = {
					appearances: data.appearances || 0,
					goals: data.goals || 0,
					assists: data.assists || 0,
					cleanSheets: data.cleanSheets || 0,
					mom: data.mom || 0,
					yellowCards: data.yellowCards || 0,
					redCards: data.redCards || 0,
					saves: data.saves || 0,
					ownGoals: data.ownGoals || 0,
					conceded: data.conceded || 0,
					penaltiesScored: data.penaltiesScored || 0,
					penaltiesMissed: data.penaltiesMissed || 0,
					penaltiesSaved: data.penaltiesSaved || 0,
					matchDetails: data.matchDetails || [],
				};
				
				setPlayerStats((prev) => ({
					...prev,
					[playerName]: stats,
				}));
				// No caching - always fetch fresh stats
			}
		} catch (error) {
			console.error(`[PlayersOfMonth] Error fetching player stats for ${playerName}:`, error);
		} finally {
			setLoadingIndividualStats((prev) => {
				const newSet = new Set(prev);
				newSet.delete(playerName);
				return newSet;
			});
		}
	};

	// Calculate FTP breakdown for a single match
	const calculateFTPBreakdown = useCallback((match: MatchDetailWithSummary): FTPBreakdown[] => {
		const playerClass = match.class;
		const breakdown: FTPBreakdown[] = [];

		// Minutes played (always show if player appeared)
		const minutes = match.min || 0;
		const minutesPoints = minutes >= 60 ? 2 : minutes > 0 ? 1 : 0;
		breakdown.push({
			stat: "Minutes played",
			value: minutes,
			points: minutesPoints,
			show: true,
		});

		// Man of the Match
		const mom = match.mom ? 1 : 0;
		breakdown.push({
			stat: "Man of the Match",
			value: mom,
			points: mom * 3,
			show: mom > 0,
		});

		// Goals scored (including penalties)
		const goals = (match.goals || 0) + (match.penaltiesScored || 0);
		let goalMultiplier = 0;
		if (playerClass === "GK" || playerClass === "DEF") {
			goalMultiplier = 6;
		} else if (playerClass === "MID") {
			goalMultiplier = 5;
		} else if (playerClass === "FWD") {
			goalMultiplier = 4;
		}
		breakdown.push({
			stat: "Goals scored",
			value: goals,
			points: goals * goalMultiplier,
			show: goals > 0,
		});

		// Assists
		const assists = match.assists || 0;
		breakdown.push({
			stat: "Assists",
			value: assists,
			points: assists * 3,
			show: assists > 0,
		});

		// Clean Sheets / Goals Conceded
		const conceded = match.conceded || 0;
		const cleanSheets = match.cleanSheets || 0;

		if (conceded === 0 && cleanSheets > 0) {
			let cleanSheetMultiplier = 0;
			if (playerClass === "GK" || playerClass === "DEF") {
				cleanSheetMultiplier = 4;
			} else if (playerClass === "MID") {
				cleanSheetMultiplier = 1;
			}
			breakdown.push({
				stat: "Clean Sheets",
				value: cleanSheets,
				points: cleanSheets * cleanSheetMultiplier,
				show: cleanSheets > 0,
			});
		} else if (conceded > 0) {
			if (playerClass === "GK" || playerClass === "DEF") {
				breakdown.push({
					stat: "Goals Conceded",
					value: conceded,
					points: Math.round(conceded * -0.5),
					show: true,
				});
			}
		}

		// Yellow Cards
		const yellowCards = match.yellowCards || 0;
		breakdown.push({
			stat: "Yellow Cards",
			value: yellowCards,
			points: yellowCards * -1,
			show: yellowCards > 0,
		});

		// Red Cards
		const redCards = match.redCards || 0;
		breakdown.push({
			stat: "Red Cards",
			value: redCards,
			points: redCards * -3,
			show: redCards > 0,
		});

		// Saves (for goalkeepers)
		const saves = match.saves || 0;
		breakdown.push({
			stat: "Saves",
			value: saves,
			points: Math.floor(saves * 0.34),
			show: saves > 0,
		});

		// Own Goals
		const ownGoals = match.ownGoals || 0;
		breakdown.push({
			stat: "Own Goals",
			value: ownGoals,
			points: ownGoals * -2,
			show: ownGoals > 0,
		});

		// Penalties Missed
		const penaltiesMissed = match.penaltiesMissed || 0;
		breakdown.push({
			stat: "Penalties Missed",
			value: penaltiesMissed,
			points: penaltiesMissed * -2,
			show: penaltiesMissed > 0,
		});

		// Penalties Conceded
		const penaltiesConceded = match.penaltiesConceded || 0;
		breakdown.push({
			stat: "Penalties Conceded",
			value: penaltiesConceded,
			points: 0,
			show: penaltiesConceded > 0,
		});

		// Penalties Saved
		const penaltiesSaved = match.penaltiesSaved || 0;
		breakdown.push({
			stat: "Penalties Saved",
			value: penaltiesSaved,
			points: penaltiesSaved * 5,
			show: penaltiesSaved > 0,
		});

		return breakdown;
	}, []);

	// Calculate total FTP for all matches
	const calculateTotalFTP = useCallback((matchDetails: MatchDetailWithSummary[]): number => {
		return matchDetails.reduce((total, match) => {
			const breakdown = calculateFTPBreakdown(match);
			const matchTotal = breakdown.reduce((sum, stat) => sum + stat.points, 0);
			return total + matchTotal;
		}, 0);
	}, [calculateFTPBreakdown]);

	// Format date for display
	const formatDate = (dateStr: string): string => {
		if (!dateStr) return "";
		
		try {
			// Try to parse various date formats
			let date: Date | null = null;
			
			if (dateStr.includes("T")) {
				date = new Date(dateStr);
			} else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
				// YYYY-MM-DD format
				date = new Date(dateStr + "T00:00:00");
			} else if (dateStr.includes("/")) {
				// Handle DD/MM/YY or DD/MM/YYYY format
				const parts = dateStr.split("/");
				if (parts.length === 3) {
					const first = parseInt(parts[0], 10);
					const second = parseInt(parts[1], 10);
					let year = parseInt(parts[2], 10);
					if (year < 100) {
						year = year + 2000;
					}
					if (first > 12) {
						date = new Date(year, second - 1, first);
					} else {
						date = new Date(year, second - 1, first);
					}
				}
			} else {
				date = new Date(dateStr);
			}
			
			if (date && !isNaN(date.getTime())) {
				// Format as DD/MM/YY
				const day = String(date.getDate()).padStart(2, "0");
				const month = String(date.getMonth() + 1).padStart(2, "0");
				const year = String(date.getFullYear()).slice(-2);
				return `${day}/${month}/${year}`;
			}
		} catch (error) {
			console.error("Error formatting date:", error);
		}
		
		// Fallback: return original string
		return dateStr;
	};

	const isInitialLoading = seasons.length === 0;

	return (
		<div className='flex flex-col p-4 md:p-6 relative'>
			{/* Header */}
			<div className='text-center mb-3'>
				<h1 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-1'>Players of the Month</h1>
			</div>

			{/* Loading Spinner - Show during initial load */}
			{isInitialLoading && (
				<div className='flex items-center justify-center py-12'>
					<div className='animate-spin rounded-full h-16 w-16 md:h-20 md:w-20 border-b-2 border-gray-300'></div>
				</div>
			)}

			{/* Filters - Hide during initial load */}
			{!isInitialLoading && (
				<div className='flex flex-row gap-4 mb-6'>
					<div className='w-1/3 md:w-1/2'>
						<Listbox value={selectedSeason} onChange={setSelectedSeason}>
							<div className='relative'>
								<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-[0.65rem] md:text-sm'>
									<span className={`block truncate ${selectedSeason ? "text-white" : "text-yellow-300"}`}>
										{selectedSeason || "Select season..."}
									</span>
									<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
										<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
									</span>
								</Listbox.Button>
								<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none text-[0.65rem] md:text-sm'>
									{seasons.map((season) => (
										<Listbox.Option
											key={season}
											className={({ active }) =>
												`relative cursor-default select-none dark-dropdown-option py-2 pl-3 pr-9 ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
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
					</div>
					<div className='flex-1 md:w-1/2'>
						<Listbox value={selectedMonth} onChange={(newMonth) => {
							console.log(`[PlayersOfMonth] User selected month: "${newMonth}"`);
							// Clear validation state when user manually changes month
							validatedMonthRef.current = null;
							isMonthValidatingRef.current = false;
							setIsMonthValidating(false);
							setSelectedMonth(newMonth);
						}}>
							<div className='relative'>
								<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-[0.65rem] md:text-sm'>
									<span className={`block truncate ${selectedMonth ? "text-white" : "text-yellow-300"}`}>
										{months.length === 0 ? "Loading..." : selectedMonth || "Select month..."}
									</span>
									<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
										<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
									</span>
								</Listbox.Button>
								<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none text-[0.65rem] md:text-sm'>
									{months.length === 0 ? (
										<Listbox.Option value="" className='relative cursor-default select-none dark-dropdown-option py-2 pl-3 pr-9 text-white'>
											Loading...
										</Listbox.Option>
									) : (
										months.map((month) => (
											<Listbox.Option
												key={month}
												className={({ active }) =>
													`relative cursor-default select-none dark-dropdown-option py-2 pl-3 pr-9 ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
												}
												value={month}>
												{({ selected }) => (
													<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
														{month}
													</span>
												)}
											</Listbox.Option>
										))
									)}
								</Listbox.Options>
							</div>
						</Listbox>
					</div>
				</div>
			)}

			{/* Loading Spinner - Show when loading month data */}
			{!isInitialLoading && (loading || loadingStats) && (
				<div className='flex items-center justify-center py-12'>
					<div className='animate-spin rounded-full h-16 w-16 md:h-20 md:w-20 border-b-2 border-gray-300'></div>
				</div>
			)}

			{/* Players Table */}
			{!loading && !loadingStats && players.length > 0 && (
				<div className='overflow-x-auto'>
					<table className='w-full text-white'>
						<thead>
							<tr className='border-b-2 border-dorkinians-yellow'>
								<th className='w-[8.33%] text-left py-2 px-2 text-xs md:text-sm'></th>
								<th className='text-left py-2 px-2 text-xs md:text-sm'>Player Name</th>
								<th className='w-[8.33%] text-right py-2 px-2 text-xs md:text-sm whitespace-nowrap'>FTP Points</th>
							</tr>
						</thead>
						<tbody>
							{players.map((player, index) => {
								const isExpanded = expandedPlayers.has(player.playerName);
								const stats = playerStats[player.playerName];
								const isLoadingStats = loadingIndividualStats.has(player.playerName);
								const isLastPlayer = index === players.length - 1;

								return (
									<React.Fragment key={player.playerName}>
										<tr
											className={`cursor-pointer hover:bg-gray-800 transition-colors ${isLastPlayer ? '' : 'border-b border-green-500'}`}
											style={{
												background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))',
											}}
											onClick={() => handleRowExpand(player.playerName)}
										>
											<td colSpan={3} className='p-0 relative'>
												<div className='flex flex-col'>
													<div className='flex items-center py-2 px-2'>
														<div className='w-1/12 text-base md:text-lg'>{player.rank}</div>
														<div className='flex-1 text-base md:text-lg'>{player.playerName}</div>
														<div className='w-1/12 text-center text-base md:text-lg font-bold'>{Math.round(player.ftpScore)}</div>
													</div>
													{stats && (
														<div className='py-1 px-2 pl-6 md:pl-8 pb-4'>
															<div className='flex flex-nowrap gap-x-2 md:gap-x-3 gap-y-1 text-[0.6rem] md:text-[0.7rem] text-gray-300 justify-end pl-3 md:pl-4'>
																{stats.appearances > 0 && <span>Apps: <span className='text-white font-semibold'>{stats.appearances}</span></span>}
																{stats.mom > 0 && <span>MoM: <span className='text-white font-semibold'>{stats.mom}</span></span>}
																{stats.goals > 0 && <span>Goals: <span className='text-white font-semibold'>{stats.goals}</span></span>}
																{stats.assists > 0 && <span>Assists: <span className='text-white font-semibold'>{stats.assists}</span></span>}
																{stats.cleanSheets > 0 && <span>Clean Sheets: <span className='text-white font-semibold'>{stats.cleanSheets}</span></span>}
															</div>
														</div>
													)}
													{!isExpanded && (
														<div className='absolute bottom-1 left-2'>
															<ChevronDownIcon className='h-4 w-4 text-yellow-300' />
														</div>
													)}
												</div>
											</td>
										</tr>
										{isExpanded && (
											<tr>
												<td colSpan={3} className='py-4 px-2 relative' style={{ backgroundColor: '#0f0f0f' }}>
													<div className='absolute top-2 left-2'>
														<ChevronUpIcon className='h-4 w-4 text-yellow-300' />
													</div>
													{isLoadingStats ? (
														<div className='flex justify-center py-4'>
															<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300'></div>
														</div>
													) : stats ? (
														<div className='space-y-4'>
															{/* Monthly Stats Summary */}
															<div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
																<div className='text-center'>
																	<p className='text-gray-400 text-xs md:text-sm'>Appearances</p>
																	<p className='text-white text-lg md:text-xl font-bold'>{stats.appearances}</p>
																</div>
																<div className='text-center'>
																	<p className='text-gray-400 text-xs md:text-sm'>Goals</p>
																	<p className='text-white text-lg md:text-xl font-bold'>{stats.goals}</p>
																</div>
																<div className='text-center'>
																	<p className='text-gray-400 text-xs md:text-sm'>Assists</p>
																	<p className='text-white text-lg md:text-xl font-bold'>{stats.assists}</p>
																</div>
																<div className='text-center'>
																	<p className='text-gray-400 text-xs md:text-sm'>Clean Sheets</p>
																	<p className='text-white text-lg md:text-xl font-bold'>{stats.cleanSheets}</p>
																</div>
															</div>

															{/* FTP Breakdown Table */}
															<div className='overflow-x-auto'>
																<table className='w-full text-white'>
																	<thead>
																		<tr className='border-b-2 border-dorkinians-yellow'>
																			<th className='text-left py-2 px-2 text-xs md:text-sm'>Statistics</th>
																			<th className='text-center py-2 px-2 text-xs md:text-sm'>Value</th>
																			<th className='text-center py-2 px-2 text-xs md:text-sm'>Points</th>
																		</tr>
																	</thead>
																	<tbody>
																		{stats.matchDetails.map((match, matchIndex) => {
																			const breakdown = calculateFTPBreakdown(match);
																			const visibleStats = breakdown.filter((stat) => stat.show);
																			const matchTotal = breakdown.reduce((sum, stat) => sum + stat.points, 0);

																			// Get match summary
																			const team = match.team || "";
																			const opposition = match.opposition || "";
																			const result = match.result || "";
																			let score = match.matchSummary || "";
																			
																			// Remove duplicate result prefix from score if present
																			if (result && score && score.trim().toUpperCase().startsWith(result.trim().toUpperCase())) {
																				score = score.trim().substring(result.trim().length).trim();
																			}

																			return (
																				<React.Fragment key={`match-${matchIndex}`}>
																					{matchIndex > 0 && (
																						<tr>
																							<td colSpan={3} className='py-2 border-t border-gray-600'></td>
																						</tr>
																					)}
																					{/* Match Details Header */}
																					<tr>
																						<td colSpan={3} className='py-2 px-2'>
																							<div className='text-center mb-2'>
																								{match.date && (
																									<p className='text-gray-400 text-xs md:text-sm mb-1'>{formatDate(match.date)}</p>
																								)}
																								{team && opposition ? (
																									<p className='text-white text-xs md:text-sm font-normal'>{team} vs {opposition}</p>
																								) : (
																									<p className='text-white text-xs md:text-sm font-normal'>Fixture details TBC</p>
																								)}
																								{result && score && (
																									<p className='text-white text-sm md:text-base font-semibold mt-1'>{result} {score}</p>
																								)}
																							</div>
																						</td>
																					</tr>
																					{visibleStats.map((stat, statIndex) => (
																						<tr key={`${matchIndex}-${statIndex}`} className='border-b border-green-500'>
																							<td className='py-2 px-2 text-xs md:text-sm'>{stat.stat}</td>
																							<td className='text-center py-2 px-2 text-xs md:text-sm'>{stat.value}</td>
																							<td className='text-center py-2 px-2 text-xs md:text-sm'>{stat.points}</td>
																						</tr>
																					))}
																					{stats.matchDetails.length > 1 && (
																						<tr className='border-t-2 border-dorkinians-yellow font-bold'>
																							<td className='py-2 px-2 text-xs md:text-sm'>Match Total</td>
																							<td className='text-center py-2 px-2'></td>
																							<td className='text-center py-2 px-2'>{matchTotal}</td>
																						</tr>
																					)}
																				</React.Fragment>
																			);
																		})}
																		<tr className='border-t-2 border-white font-bold text-lg'>
																			<td className='py-2 px-2 text-xs md:text-sm'>Monthly Total</td>
																			<td className='text-center py-2 px-2'></td>
																			<td className='text-center py-2 px-2'>{calculateTotalFTP(stats.matchDetails)}</td>
																		</tr>
																	</tbody>
																</table>
															</div>
														</div>
													) : (
														<div className='text-center py-4 text-gray-400'>No stats available</div>
													)}
												</td>
											</tr>
										)}
									</React.Fragment>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			{/* Empty State */}
			{!loading && !loadingStats && players.length === 0 && selectedSeason && selectedMonth && !isFetchingMonthData && (
				<div className='text-center py-8 text-gray-400'>
					<p>No players found for {selectedMonth} {selectedSeason}</p>
				</div>
			)}
		</div>
	);
}
