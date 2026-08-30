"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigationStore } from "@/lib/stores/navigation";
import { getCurrentSeasonFromStorage } from "@/lib/services/currentSeasonService";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { ChevronDownIcon, ChevronUpIcon, PencilIcon } from "@heroicons/react/24/outline";
import Skeleton from "react-loading-skeleton";
import { PlayerStatsExpansionSkeleton, RankingTableSkeleton } from "@/components/skeletons";
import { appConfig } from "@/config/config";
import { log } from "@/lib/utils/logger";
import { cachedFetch, generatePageCacheKey } from "@/lib/utils/pageCache";
import { UmamiEvents } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/utils/trackEvent";
import { HoverTooltip } from "@/components/ui/Tooltip";

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

function getRankingTableRows(
	rankings: Array<{rank: number; playerName: string; score: number}>,
	selectedPlayerName: string,
): Array<{rank: number | null; playerName: string; score: number | null; isDots?: boolean; isSelected?: boolean}> {
	const selectedIndex = rankings.findIndex((p) => p.playerName === selectedPlayerName);
	if (selectedIndex === -1) return [];

	const rows: Array<{rank: number | null; playerName: string; score: number | null; isDots?: boolean; isSelected?: boolean}> = [];

	// Always render top 5 first, highlighting the selected player when present.
	const topFiveRows = rankings.slice(0, 5).map((row) => ({
		...row,
		isSelected: row.playerName === selectedPlayerName,
	}));
	rows.push(...topFiveRows);

	// If selected player is already in top 5, avoid appending duplicate rows.
	if (selectedIndex < 5) {
		return rows;
	}

	rows.push({ playerName: "...", score: null, rank: null, isDots: true });

	// Add immediate neighbors and selected row for out-of-top-5 selections.
	if (selectedIndex > 0) {
		const abovePlayer = rankings[selectedIndex - 1];
		if (abovePlayer.rank > 5) {
			rows.push(abovePlayer);
		}
	}

	rows.push({ ...rankings[selectedIndex], isSelected: true });

	if (selectedIndex < rankings.length - 1) {
		const belowPlayer = rankings[selectedIndex + 1];
		if (belowPlayer.rank > 5) {
			rows.push(belowPlayer);
		}
	}

	return rows;
}

export default function PlayersOfMonth() {
	const {
		cachePOMSeasons,
		cachePOMMonths,
		getCachedPOMSeasons,
		getCachedPOMMonths,
		selectedPlayer,
		enterEditMode,
		setMainPage,
		getCachedPageData,
		setCachedPageData,
	} = useNavigationStore();

	const [seasons, setSeasons] = useState<string[]>([]);
	const [selectedSeason, setSelectedSeason] = useState<string>("");
	const [months, setMonths] = useState<string[]>([]);
	const [selectedMonth, setSelectedMonth] = useState<string>("");
	const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
	const [expandedSeasonPlayers, setExpandedSeasonPlayers] = useState<Set<string>>(new Set());
	const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({});
	const [seasonPlayerStats, setSeasonPlayerStats] = useState<Record<string, PlayerStats>>({});
	const [loadingIndividualStats, setLoadingIndividualStats] = useState<Set<string>>(new Set());
	const [loadingSeasonIndividualStats, setLoadingSeasonIndividualStats] = useState<Set<string>>(new Set());
	const [isMonthValidating, setIsMonthValidating] = useState(false);
	const [showSelectedPlayerContext, setShowSelectedPlayerContext] = useState(true);
	const [showSeasonSelectedPlayerContext, setShowSeasonSelectedPlayerContext] = useState(true);
	const previousSeasonRef = useRef<string>("");
	const isMonthValidatingRef = useRef<boolean>(false);
	const validatedMonthRef = useRef<string | null>(null);
	const [monthRankings, setMonthRankings] = useState<Array<{rank: number; playerName: string; score: number}>>([]);
	const [seasonRankings, setSeasonRankings] = useState<Array<{rank: number; playerName: string; score: number}>>([]);
	const [loadingMonthRankings, setLoadingMonthRankings] = useState(false);
	const [loadingSeasonRankings, setLoadingSeasonRankings] = useState(false);

	const monthRows = useMemo(() => {
		if (monthRankings.length === 0) return [];
		if (!showSelectedPlayerContext) {
			return monthRankings.slice(0, 5).map((row) => ({
				...row,
				isSelected: row.playerName === selectedPlayer,
			}));
		}
		if (!selectedPlayer) return monthRankings.slice(0, 5);

		const selectedIndex = monthRankings.findIndex((p) => p.playerName === selectedPlayer);
		if (selectedIndex === -1) return monthRankings.slice(0, 5);

		const topFiveRows = monthRankings.slice(0, 5).map((row) => ({
			...row,
			isSelected: row.playerName === selectedPlayer,
		}));

		// Top 4 selection: top 5 only
		if (selectedIndex < 4) {
			return topFiveRows;
		}

		// 5th place selection: top 5 plus one below (if available)
		if (selectedIndex === 4) {
			const belowPlayer = monthRankings[selectedIndex + 1];
			if (belowPlayer && belowPlayer.rank > 5) {
				return [...topFiveRows, belowPlayer];
			}
			return topFiveRows;
		}

		const rows: Array<{rank: number | null; playerName: string; score: number | null; isDots?: boolean; isSelected?: boolean}> = [...topFiveRows];
		rows.push({ playerName: "...", score: null, rank: null, isDots: true });

		const abovePlayer = monthRankings[selectedIndex - 1];
		if (abovePlayer && abovePlayer.rank > 5) {
			rows.push(abovePlayer);
		}

		rows.push({ ...monthRankings[selectedIndex], isSelected: true });

		const belowPlayer = monthRankings[selectedIndex + 1];
		if (belowPlayer && belowPlayer.rank > 5) {
			rows.push(belowPlayer);
		}

		return rows;
	}, [monthRankings, selectedPlayer, showSelectedPlayerContext]);

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
				const cacheKey = generatePageCacheKey("totw", "players-of-month", "seasons", {});
				const data = await cachedFetch("/api/players-of-month/seasons", {
					method: "GET",
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
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

		log("info", `[PlayersOfMonth] Month fetch effect triggered. Season changed: ${seasonChanged}, from "${previousSeason}" to "${selectedSeason}"`);

		// Clear months state when season changes to prevent using stale data
		if (seasonChanged) {
			log("info", `[PlayersOfMonth] Season changed - clearing months state to prevent stale data`);
			setMonths([]);
		}

		// Set validation flag to indicate month validation is in progress (both ref and state)
		isMonthValidatingRef.current = true;
		setIsMonthValidating(true);
		log("info", `[PlayersOfMonth] Setting validation flag to true`);

		const validateAndSetMonth = (availableMonths: string[]) => {
			log("info", `[PlayersOfMonth] validateAndSetMonth called with ${availableMonths.length} months. Current selectedMonth: "${selectedMonth}"`);
			
			if (availableMonths.length === 0) {
				setSelectedMonth("");
				log("info", `[PlayersOfMonth] No months available for season ${selectedSeason}`);
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
					log("info", `[PlayersOfMonth] Season changed to ${selectedSeason}, keeping month: ${monthToSet}`);
				} else {
					// Month doesn't exist in new season, select most recent
					monthToSet = availableMonths[availableMonths.length - 1];
					log("info", `[PlayersOfMonth] Season changed to ${selectedSeason}, month "${selectedMonth}" not available. Selecting most recent: ${monthToSet}`);
				}
			} else {
				// Season didn't change, just ensure we have a month selected
				if (!selectedMonth && availableMonths.length > 0) {
					monthToSet = availableMonths[availableMonths.length - 1];
					log("info", `[PlayersOfMonth] No month selected, selecting most recent: ${monthToSet}`);
				} else {
					monthToSet = selectedMonth;
				}
			}
			
			// Set the month and clear validation flag immediately
			setSelectedMonth(monthToSet);
			log("info", `[PlayersOfMonth] Month validation complete. Setting month to "${monthToSet}". Clearing validation flag.`);
			
			// Clear validation flag immediately - React will batch the state updates
			isMonthValidatingRef.current = false;
			setIsMonthValidating(false);
			validatedMonthRef.current = null;
		};

		const cachedMonths = getCachedPOMMonths(selectedSeason);
		if (cachedMonths) {
			log("info", `[PlayersOfMonth] Using cached months for season ${selectedSeason}`);
			setMonths(cachedMonths);
			validateAndSetMonth(cachedMonths);
			return;
		}

		const fetchMonths = async () => {
			log("info", `[PlayersOfMonth] Fetching months from API for season ${selectedSeason}`);
			try {
				const cacheKey = generatePageCacheKey("totw", "players-of-month", "months", { season: selectedSeason });
				const data = await cachedFetch(`/api/players-of-month/months?season=${encodeURIComponent(selectedSeason)}`, {
					method: "GET",
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				if (data.months) {
					log("info", `[PlayersOfMonth] Received ${data.months.length} months from API`);
					setMonths(data.months);
					validateAndSetMonth(data.months);
					cachePOMMonths(selectedSeason, data.months);
				} else {
					log("info", `[PlayersOfMonth] No months in API response`);
					validatedMonthRef.current = "";
					setSelectedMonth("");
					isMonthValidatingRef.current = false;
					setIsMonthValidating(false);
				}
			} catch (error) {
				log("error", "Error fetching months:", error);
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

	// Validate selected month for the current season (no month-data fetch — rankings drive the UI)
	useEffect(() => {
		log("info", `[PlayersOfMonth] Month selection effect. Season: "${selectedSeason}", Month: "${selectedMonth}", isMonthValidating: ${isMonthValidating}, isMonthValidatingRef: ${isMonthValidatingRef.current}`);

		if (!selectedSeason) {
			setPlayerStats({});
			setExpandedPlayers(new Set());
			setMonthRankings([]);
			log("info", `[PlayersOfMonth] Skipping month validation - no season selected`);
			return;
		}

		if (isMonthValidating || isMonthValidatingRef.current) {
			log("info", `[PlayersOfMonth] Month validation in progress — waiting`);
			return;
		}

		const availableMonths = getCachedPOMMonths(selectedSeason);
		log("info", `[PlayersOfMonth] Available months for season ${selectedSeason}: ${availableMonths ? availableMonths.length : 0}, cached months: [${availableMonths ? availableMonths.join(", ") : "none"}]`);

		if (!availableMonths || availableMonths.length === 0) {
			log("info", `[PlayersOfMonth] Months not yet loaded for season ${selectedSeason}. Waiting...`);
			return;
		}

		let monthToUse = selectedMonth;
		const isMonthValid = Boolean(selectedMonth && availableMonths.includes(selectedMonth));
		log("info", `[PlayersOfMonth] Checking month validity. selectedMonth: "${selectedMonth}", isMonthValid: ${isMonthValid}, availableMonths: [${availableMonths.join(", ")}]`);

		if (!isMonthValid) {
			monthToUse = availableMonths[availableMonths.length - 1];
			log("info", `[PlayersOfMonth] Month "${selectedMonth || "none"}" not valid for season ${selectedSeason}. Using most recent: ${monthToUse}`);
			if (selectedMonth !== monthToUse) {
				log("info", `[PlayersOfMonth] Updating selectedMonth from "${selectedMonth}" to "${monthToUse}"`);
				setSelectedMonth(monthToUse);
				return;
			}
		}

		if (!monthToUse || !availableMonths.includes(monthToUse)) {
			log("info", `[PlayersOfMonth] No valid month for season ${selectedSeason}`);
			return;
		}

		log("info", `[PlayersOfMonth] Month selection ready for season: ${selectedSeason}, month: ${monthToUse}`);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedSeason, selectedMonth, months, isMonthValidating]);

	// Reset local PoM UI when season or calendar month changes
	useEffect(() => {
		setPlayerStats({});
		setSeasonPlayerStats({});
		setExpandedPlayers(new Set());
		setExpandedSeasonPlayers(new Set());
		setShowSelectedPlayerContext(true);
		setShowSeasonSelectedPlayerContext(true);
	}, [selectedSeason, selectedMonth]);

	const displayedSeasonRows = useMemo(() => {
		if (seasonRankings.length === 0) return [];
		if (!selectedPlayer) return seasonRankings.slice(0, 5).map((row) => ({ ...row, isSelected: false }));
		if (!showSeasonSelectedPlayerContext) {
			return seasonRankings.slice(0, 5).map((row) => ({
				...row,
				isSelected: row.playerName === selectedPlayer,
			}));
		}
		return getRankingTableRows(seasonRankings, selectedPlayer);
	}, [seasonRankings, selectedPlayer, showSeasonSelectedPlayerContext]);

	// Fetch month rankings when season and month are ready (does not depend on selected player)
	useEffect(() => {
		if (!selectedSeason || !selectedMonth) {
			setMonthRankings([]);
			return;
		}

		if (isMonthValidating || isMonthValidatingRef.current) {
			return;
		}

		const availableMonths = getCachedPOMMonths(selectedSeason);
		if (!availableMonths || availableMonths.length === 0 || !availableMonths.includes(selectedMonth)) {
			return;
		}

		const fetchMonthRankings = async () => {
			setLoadingMonthRankings(true);
			try {
				const cacheKey = generatePageCacheKey("totw", "players-of-month", "month-rankings", {
					season: selectedSeason,
					month: selectedMonth,
				});
				const data = await cachedFetch(`/api/players-of-month/month-rankings?season=${encodeURIComponent(selectedSeason)}&month=${encodeURIComponent(selectedMonth)}`, {
					method: "GET",
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				setMonthRankings(data.rankings || []);
			} catch (error) {
				log("error", "Error fetching month rankings:", error);
				setMonthRankings([]);
			} finally {
				setLoadingMonthRankings(false);
			}
		};

		const timeoutId = setTimeout(() => {
			fetchMonthRankings();
		}, 100);

		return () => clearTimeout(timeoutId);
	}, [selectedSeason, selectedMonth, months, isMonthValidating]);

	// Priority 3: Below fold - This Season FTP Ranking section
	// Fetch season rankings when season changes (de-prioritized - async)
	useEffect(() => {
		if (!selectedSeason || !selectedPlayer) {
			setSeasonRankings([]);
			return;
		}

		const fetchSeasonRankings = async () => {
			setLoadingSeasonRankings(true);
			try {
				const cacheKey = generatePageCacheKey("totw", "players-of-month", "season-rankings", { 
					season: selectedSeason,
					playerName: selectedPlayer,
				});
				const data = await cachedFetch(`/api/players-of-month/season-rankings?season=${encodeURIComponent(selectedSeason)}`, {
					method: "GET",
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				setSeasonRankings(data.rankings || []);
			} catch (error) {
				log("error", "Error fetching season rankings:", error);
				setSeasonRankings([]);
			} finally {
				setLoadingSeasonRankings(false);
			}
		};

		// Defer rankings fetch to not block initial render
		const timeoutId = setTimeout(() => {
			fetchSeasonRankings();
		}, 150);

		return () => clearTimeout(timeoutId);
	}, [selectedSeason, selectedPlayer]);

	// Prefetch player stats for visible month-ranking rows (compact summary under FTP points)
	useEffect(() => {
		if (!selectedSeason || !selectedMonth || monthRankings.length === 0) {
			return;
		}

		const names = monthRows
			.filter((row) => !("isDots" in row && row.isDots) && row.playerName)
			.map((row) => row.playerName);
		if (names.length === 0) {
			return;
		}

		let cancelled = false;

		const fetchAllPlayerStats = async () => {
			log("info", `[PlayersOfMonth] Prefetching stats for ${names.length} players: [${names.join(", ")}]`);

			const newStats: Record<string, PlayerStats> = {};

			await Promise.all(
				names.map(async (playerName) => {
					const apiUrl = `/api/players-of-month/player-stats?season=${encodeURIComponent(selectedSeason)}&month=${encodeURIComponent(selectedMonth)}&playerName=${encodeURIComponent(playerName)}`;
					try {
						const cacheKey = generatePageCacheKey("totw", "players-of-month", "player-stats", {
							season: selectedSeason,
							month: selectedMonth,
							playerName,
						});
						const data = await cachedFetch(apiUrl, {
							method: "GET",
							cacheKey,
							getCachedPageData,
							setCachedPageData,
						});
						if (data.matchDetails) {
							newStats[playerName] = {
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
						}
					} catch (error) {
						log("error", `[PlayersOfMonth] Error prefetching stats for ${playerName}:`, error);
					}
				}),
			);

			if (cancelled) return;
			log("info", `[PlayersOfMonth] Prefetch stats complete for ${Object.keys(newStats).length} players`);
			setPlayerStats((prev) => ({ ...prev, ...newStats }));
		};

		void fetchAllPlayerStats();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [monthRows, selectedSeason, selectedMonth]);

	// Prefetch player stats for visible season-ranking rows
	useEffect(() => {
		if (!selectedSeason || !selectedPlayer || seasonRankings.length === 0) {
			return;
		}

		const names = displayedSeasonRows
			.filter((row) => !("isDots" in row && row.isDots) && row.playerName)
			.map((row) => row.playerName);
		if (names.length === 0) {
			return;
		}

		let cancelled = false;

		const fetchAllSeasonPlayerStats = async () => {
			const newStats: Record<string, PlayerStats> = {};
			await Promise.all(
				names.map(async (playerName) => {
					const apiUrl = `/api/players-of-month/player-stats?season=${encodeURIComponent(selectedSeason)}&playerName=${encodeURIComponent(playerName)}`;
					try {
						const cacheKey = generatePageCacheKey("totw", "players-of-month", "player-stats-season", {
							season: selectedSeason,
							playerName,
						});
						const data = await cachedFetch(apiUrl, {
							method: "GET",
							cacheKey,
							getCachedPageData,
							setCachedPageData,
						});
						if (data.matchDetails) {
							newStats[playerName] = {
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
						}
					} catch (error) {
						log("error", `[PlayersOfMonth] Error prefetching season stats for ${playerName}:`, error);
					}
				}),
			);

			if (cancelled) return;
			setSeasonPlayerStats((prev) => ({ ...prev, ...newStats }));
		};

		void fetchAllSeasonPlayerStats();
		return () => {
			cancelled = true;
		};
	}, [displayedSeasonRows, selectedSeason, selectedPlayer, getCachedPageData, setCachedPageData]);

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
		trackEvent(UmamiEvents.PlayersOfMonthRowExpanded, {
			playerName,
			season: selectedSeason,
			month: selectedMonth,
			totwSubPage: "players-of-month",
		});
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

	const handleSeasonRowExpand = async (playerName: string) => {
		if (expandedSeasonPlayers.has(playerName)) {
			setExpandedSeasonPlayers((prev) => {
				const newSet = new Set(prev);
				newSet.delete(playerName);
				return newSet;
			});
			return;
		}

		setExpandedSeasonPlayers((prev) => new Set(prev).add(playerName));

		if (seasonPlayerStats[playerName] || !selectedSeason) {
			return;
		}

		const apiUrl = `/api/players-of-month/player-stats?season=${encodeURIComponent(selectedSeason)}&playerName=${encodeURIComponent(playerName)}`;
		setLoadingSeasonIndividualStats((prev) => new Set(prev).add(playerName));

		try {
			const response = await fetch(apiUrl);
			if (!response.ok) {
				throw new Error(`API error: ${response.status} ${response.statusText}`);
			}
			const data = await response.json();
			if (data.matchDetails) {
				setSeasonPlayerStats((prev) => ({
					...prev,
					[playerName]: {
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
					},
				}));
			}
		} catch (error) {
			console.error(`[PlayersOfMonth] Error fetching season player stats for ${playerName}:`, error);
		} finally {
			setLoadingSeasonIndividualStats((prev) => {
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
				// Format as DD/MM/YYYY
				const day = String(date.getDate()).padStart(2, "0");
				const month = String(date.getMonth() + 1).padStart(2, "0");
				const year = String(date.getFullYear());
				return `${day}/${month}/${year}`;
			}
		} catch (error) {
			console.error("Error formatting date:", error);
		}
		
		// Fallback: return original string
		return dateStr;
	};

	const renderExpandedStatsSection = (
		stats: PlayerStats | undefined,
		isLoadingStats: boolean,
		totalLabel: string = "Monthly Total",
	) => {
		if (isLoadingStats) {
			return (
				<PlayerStatsExpansionSkeleton />
			);
		}
		if (!stats) {
			return <div className='text-center py-4 text-gray-400'>No stats available</div>;
		}
		return (
			<div className='space-y-4'>
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

								const team = match.team || "";
								const opposition = match.opposition || "";
								const result = match.result || "";
								let score = match.matchSummary || "";

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
								<td className='py-2 px-2 text-xs md:text-sm'>{totalLabel}</td>
								<td className='text-center py-2 px-2'></td>
								<td className='text-center py-2 px-2'>{calculateTotalFTP(stats.matchDetails)}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		);
	};

	const handleEditClick = () => {
		enterEditMode();
		setMainPage("home");
	};

	const isInitialLoading = seasons.length === 0;
	const cachedMonthsForPom = selectedSeason ? getCachedPOMMonths(selectedSeason) : null;
	const monthSelectionReady = Boolean(
		selectedSeason &&
			selectedMonth &&
			cachedMonthsForPom &&
			cachedMonthsForPom.includes(selectedMonth) &&
			!isMonthValidating &&
			!isMonthValidatingRef.current,
	);
	const shouldShowRankingsSkeleton =
		appConfig.forceSkeletonView || !monthSelectionReady || loadingMonthRankings;

	const monthFtpHeading =
		selectedMonth && selectedSeason ? `${selectedMonth} ${selectedSeason} FTP Ranking` : "FTP Ranking";
	const seasonFtpHeading = selectedSeason ? `${selectedSeason} FTP Ranking` : "FTP Ranking";

	const selectedInMonthRankings = Boolean(
		selectedPlayer && monthRankings.some((p) => p.playerName === selectedPlayer),
	);

	return (
		<div className='flex flex-col p-2 md:p-4 relative md:max-w-2xl md:mx-auto lg:max-w-6xl lg:mx-auto w-full'>
			{/* Header */}
			<div className='text-center mb-3'>
				<h1 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-1'>Players of the Month</h1>
			</div>

			{/* Loading Skeleton - Show during initial load */}
			{isInitialLoading && (
				<>
					<div className='flex flex-row justify-center gap-4 mb-6 w-full'>
						<div className='w-full max-w-[14rem]'>
							<Skeleton height={36} width="100%" className="rounded-md" />
						</div>
						<div className='w-full max-w-[14rem]'>
							<Skeleton height={36} width="100%" className="rounded-md" />
						</div>
					</div>
					<div data-testid="loading-skeleton" className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
						<div className='lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-10 lg:space-y-0'>
							<div className='min-w-0'>
								<div className='mb-4'>
									<Skeleton height={24} width="60%" />
								</div>
								<RankingTableSkeleton />
							</div>
							<div className='min-w-0'>
								<div className='mb-4'>
									<Skeleton height={24} width="55%" />
								</div>
								<RankingTableSkeleton />
							</div>
						</div>
					</div>
				</>
			)}

			{/* Filters - Hide during initial load */}
			{!isInitialLoading && (
				<div className='flex flex-row justify-center gap-4 mb-4 w-full'>
					<div className='w-full max-w-[14rem]'>
						<Listbox value={selectedSeason} onChange={(newSeason) => {
							log("info", `[PlayersOfMonth] User selected season: "${newSeason}"`);
							setSelectedSeason(newSeason);
						}}>
							<div className='relative'>
								<Listbox.Button data-testid="players-of-month-season-selector" className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-[0.65rem] md:text-sm'>
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
					<div className='w-full max-w-[14rem]'>
						<Listbox value={selectedMonth} onChange={(newMonth) => {
							log("info", `[PlayersOfMonth] User selected month: "${newMonth}"`);
							// Clear validation state when user manually changes month
							validatedMonthRef.current = null;
							isMonthValidatingRef.current = false;
							setIsMonthValidating(false);
							setSelectedMonth(newMonth);
						}}>
							<div className='relative'>
								<Listbox.Button data-testid="players-of-month-month-selector" className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-[0.65rem] md:text-sm'>
								<span className={`block truncate ${selectedMonth ? "text-white" : "text-yellow-300"}`}>
									{selectedMonth || "Select month..."}
								</span>
									<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
										<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
									</span>
								</Listbox.Button>
								<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none text-[0.65rem] md:text-sm'>
									{months.length === 0 ? (
										<Listbox.Option value="" className='relative cursor-default select-none dark-dropdown-option py-2 pl-3 pr-9 text-white'>
											<Skeleton height={16} width={100} />
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

			{/* FTP rankings (month + season) */}
			{!isInitialLoading && (
				shouldShowRankingsSkeleton ? (
					<div data-testid="loading-skeleton" className='mt-0'>
						<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
							<div className='lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-10 lg:space-y-0'>
								<div className='min-w-0'>
									<div className='mb-4'>
										<Skeleton height={24} width="70%" />
									</div>
									<RankingTableSkeleton />
								</div>
								<div className='min-w-0'>
									<div className='mb-4'>
										<Skeleton height={24} width="55%" />
									</div>
									<RankingTableSkeleton />
								</div>
							</div>
						</div>
					</div>
				) : (
					<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
						<div className='lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-10 lg:space-y-0'>
							{/* Month FTP — first on mobile, left on desktop */}
							<div className='min-w-0' data-testid='players-of-month-month-column'>
								<div className='mb-4'>
									<h2
										data-testid='players-of-month-month-heading'
										className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-1 text-center lg:text-left'>
										{monthFtpHeading}
									</h2>
								</div>
								{selectedPlayer && monthRankings.length > 0 && !selectedInMonthRankings && (
									<p className='text-center text-gray-400 text-sm mb-3'>
										{selectedPlayer} has no fantasy points for {selectedMonth} {selectedSeason}
									</p>
								)}
								{monthRankings.length === 0 ? (
									<div className='text-center py-6 text-gray-400'>
										<p>No rankings available for {selectedMonth} {selectedSeason}</p>
									</div>
								) : (
									<>
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
													{monthRows.map((row, index) => {
														if ("isDots" in row && row.isDots) {
															return (
																<tr
																	key={`month-dots-${index}`}
																	className='border-b border-green-500'
																	style={{
																		background: "linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))",
																	}}>
																	<td className='py-1 px-2 text-xs md:text-sm'></td>
																	<td className='py-1 px-2 text-xs md:text-sm text-center text-gray-400'>...</td>
																	<td className='text-right py-1 px-2 text-xs md:text-sm'></td>
																</tr>
															);
														}

														const isExpanded = expandedPlayers.has(row.playerName);
														const stats = playerStats[row.playerName];
														const isLoadingStats = loadingIndividualStats.has(row.playerName);
														const isLastRow = index === monthRows.length - 1;
														const isSelected = Boolean(selectedPlayer && row.playerName === selectedPlayer);
														return (
															<React.Fragment key={row.playerName}>
																<tr
																	className={`cursor-pointer hover:bg-gray-800 transition-colors ${isLastRow ? "" : "border-b border-green-500"} ${isSelected ? "bg-yellow-400/20" : ""}`}
																	style={
																		isSelected
																			? {}
																			: {
																					background:
																						"linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))",
																				}
																	}
																	onClick={() => handleRowExpand(row.playerName)}
																	role='button'
																	tabIndex={0}
																	onKeyDown={(e) => {
																		if (e.key === "Enter" || e.key === " ") {
																			e.preventDefault();
																			handleRowExpand(row.playerName);
																		}
																	}}
																>
																	<td colSpan={3} className='p-0 relative'>
																		<div className='flex flex-col'>
																			<div className='flex items-center py-2 px-2'>
																				<div className='w-1/12 text-base md:text-lg'>{row.rank}</div>
																				<div className='flex-1 text-base md:text-lg'>{row.playerName}</div>
																				<div className='w-1/12 text-center text-base md:text-lg font-bold'>
																					{row.score !== null ? Math.round(row.score) : "-"}
																				</div>
																			</div>
																			{stats && (
																				<div className='py-1 px-2 pl-6 md:pl-8 pb-4'>
																					<div className='flex flex-nowrap gap-x-2 md:gap-x-3 gap-y-1 text-[0.6rem] md:text-[0.7rem] text-gray-300 justify-end pl-3 md:pl-4'>
																						{stats.appearances > 0 && (
																							<span>
																								Apps:{" "}
																								<span className='text-white font-semibold'>{stats.appearances}</span>
																							</span>
																						)}
																						{stats.mom > 0 && (
																							<span>
																								MoM: <span className='text-white font-semibold'>{stats.mom}</span>
																							</span>
																						)}
																						{stats.goals > 0 && (
																							<span>
																								Goals:{" "}
																								<span className='text-white font-semibold'>{stats.goals}</span>
																							</span>
																						)}
																						{stats.assists > 0 && (
																							<span>
																								Assists:{" "}
																								<span className='text-white font-semibold'>{stats.assists}</span>
																							</span>
																						)}
																						{stats.cleanSheets > 0 && (
																							<span>
																								Clean Sheets:{" "}
																								<span className='text-white font-semibold'>{stats.cleanSheets}</span>
																							</span>
																						)}
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
																		<td colSpan={3} className='py-4 px-2 relative' style={{ backgroundColor: "#0f0f0f" }}>
																			<div className='absolute top-2 left-2'>
																				<ChevronUpIcon className='h-4 w-4 text-yellow-300' />
																			</div>
																			{renderExpandedStatsSection(stats, isLoadingStats)}
																		</td>
																	</tr>
																)}
															</React.Fragment>
														);
													})}
												</tbody>
											</table>
										</div>
										{selectedPlayer && monthRankings.length > 5 && (
											<button
												type='button'
												data-testid='players-of-month-toggle-extra'
												className='mt-4 w-full text-center text-sm text-white underline underline-offset-2'
												onClick={() => setShowSelectedPlayerContext((prev) => !prev)}>
												{showSelectedPlayerContext ? "Hide extra players" : "Show selected player"}
											</button>
										)}
									</>
								)}
							</div>

							{/* Season FTP — below on mobile, right on desktop */}
							<div className='min-w-0 mt-8 lg:mt-0' data-testid='players-of-month-season-column'>
								<div className='mb-4'>
									<h2
										data-testid='players-of-month-season-heading'
										className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-1 text-center lg:text-left'>
										{seasonFtpHeading}
									</h2>
								</div>
								{selectedPlayer ? (
									<>
										{loadingSeasonRankings ? (
											<RankingTableSkeleton />
										) : seasonRankings.length > 0 ? (
											(() => {
												const selectedInSeason = seasonRankings.findIndex((p) => p.playerName === selectedPlayer) !== -1;

												if (!selectedInSeason) {
													return (
														<div className='text-center py-8 text-gray-400'>
															<p>{selectedPlayer} has no fantasy points for {selectedSeason}</p>
														</div>
													);
												}

												return (
													<>
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
																{displayedSeasonRows.map((row, index) => {
																	if (row.isDots) {
																		return (
																			<tr
																				key={`dots-${index}`}
																				className='border-b border-green-500'
																				style={{
																					background:
																						"linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))",
																				}}>
																				<td className='py-1 px-2 text-xs md:text-sm'></td>
																				<td className='py-1 px-2 text-xs md:text-sm text-center text-gray-400'>...</td>
																				<td className='text-right py-1 px-2 text-xs md:text-sm'></td>
																			</tr>
																		);
																	}

																	const isExpanded = expandedSeasonPlayers.has(row.playerName);
																	const stats = seasonPlayerStats[row.playerName];
																	const isLoadingStats = loadingSeasonIndividualStats.has(row.playerName);
																	const isLastRow = index === displayedSeasonRows.length - 1;

																	return (
																		<React.Fragment key={`${row.playerName}-${row.rank}`}>
																			<tr
																				className={`cursor-pointer hover:bg-gray-800 transition-colors ${isLastRow ? "" : "border-b border-green-500"} ${row.isSelected ? "bg-yellow-400/20" : ""}`}
																				style={
																					row.isSelected
																						? {}
																						: {
																								background:
																									"linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))",
																							}
																				}
																				onClick={() => handleSeasonRowExpand(row.playerName)}
																				role='button'
																				tabIndex={0}
																				onKeyDown={(e) => {
																					if (e.key === "Enter" || e.key === " ") {
																						e.preventDefault();
																						handleSeasonRowExpand(row.playerName);
																					}
																				}}>
																				<td colSpan={3} className='p-0 relative'>
																					<div className='flex flex-col'>
																						<div className='flex items-center py-2 px-2'>
																							<div className='w-1/12 text-base md:text-lg'>{row.rank}</div>
																							<div className='flex-1 text-base md:text-lg'>{row.playerName}</div>
																							<div className='w-1/12 text-center text-base md:text-lg font-bold'>
																								{row.score !== null ? Math.round(row.score) : "-"}
																							</div>
																						</div>
																						{stats && (
																							<div className='py-1 px-2 pl-6 md:pl-8 pb-4'>
																								<div className='flex flex-nowrap gap-x-2 md:gap-x-3 gap-y-1 text-[0.6rem] md:text-[0.7rem] text-gray-300 justify-end pl-3 md:pl-4'>
																									{stats.appearances > 0 && (
																										<span>
																											Apps: <span className='text-white font-semibold'>{stats.appearances}</span>
																										</span>
																									)}
																									{stats.mom > 0 && (
																										<span>
																											MoM: <span className='text-white font-semibold'>{stats.mom}</span>
																										</span>
																									)}
																									{stats.goals > 0 && (
																										<span>
																											Goals: <span className='text-white font-semibold'>{stats.goals}</span>
																										</span>
																									)}
																									{stats.assists > 0 && (
																										<span>
																											Assists: <span className='text-white font-semibold'>{stats.assists}</span>
																										</span>
																									)}
																									{stats.cleanSheets > 0 && (
																										<span>
																											Clean Sheets: <span className='text-white font-semibold'>{stats.cleanSheets}</span>
																										</span>
																									)}
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
																					<td colSpan={3} className='py-4 px-2 relative' style={{ backgroundColor: "#0f0f0f" }}>
																						<div className='absolute top-2 left-2'>
																							<ChevronUpIcon className='h-4 w-4 text-yellow-300' />
																						</div>
																						{renderExpandedStatsSection(stats, isLoadingStats, "Season Total")}
																					</td>
																				</tr>
																			)}
																		</React.Fragment>
																	);
																})}
															</tbody>
															</table>
														</div>
														{selectedPlayer && seasonRankings.length > 5 && (
															<button
																type='button'
																data-testid='players-of-month-toggle-extra-season'
																className='mt-4 w-full text-center text-sm text-white underline underline-offset-2'
																onClick={() => setShowSeasonSelectedPlayerContext((prev) => !prev)}>
																{showSeasonSelectedPlayerContext ? "Hide extra players" : "Show selected player"}
															</button>
														)}
													</>
												);
											})()
										) : (
											<div className='text-center py-8 text-gray-400'>
												<p>No rankings available for {selectedSeason}</p>
											</div>
										)}
									</>
								) : (
									<div className='text-center py-6'>
										<p className='text-white text-sm md:text-base mb-4'>
											Select a player to see their current FTP ranking
										</p>
										<HoverTooltip content='Select a player'>
											<button
												type='button'
												onClick={handleEditClick}
												className='flex items-center justify-center mx-auto w-8 h-8 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors'
												aria-label='Select a player'>
												<PencilIcon className='h-4 w-4 md:h-5 md:w-5' />
											</button>
										</HoverTooltip>
									</div>
								)}
							</div>
						</div>
					</div>
				)
			)}
		</div>
	);
}
