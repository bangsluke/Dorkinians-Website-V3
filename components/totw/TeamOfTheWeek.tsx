"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { WeeklyTOTW, MatchDetail } from "@/types";
import { formationCoordinateObject } from "@/lib/formations/formationCoordinates";
import PlayerDetailModal from "./PlayerDetailModal";
import Image from "next/image";
import { useNavigationStore } from "@/lib/stores/navigation";
import { getCurrentSeasonFromStorage } from "@/lib/services/currentSeasonService";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/20/solid";

interface MatchDetailWithSummary extends MatchDetail {
	matchSummary?: string | null;
	opposition?: string | null;
}

interface Week {
	week: number;
	dateLookup: string;
	weekAdjusted: string;
}

interface TOTWPlayer {
	playerName: string;
	ftpScore: number;
	position: string;
}

export default function TeamOfTheWeek() {
	const {
		cacheTOTWSeasons,
		cacheTOTWWeeks,
		cacheTOTWWeekData,
		getCachedTOTWSeasons,
		getCachedTOTWWeeks,
		getCachedTOTWWeekData,
	} = useNavigationStore();

	const [seasons, setSeasons] = useState<string[]>([]);
	const [currentSeason, setCurrentSeason] = useState<string | null>(null);
	const [selectedSeason, setSelectedSeason] = useState<string>("");
	const [weeks, setWeeks] = useState<Week[]>([]);
	const [currentWeek, setCurrentWeek] = useState<number | null>(null);
	const [selectedWeek, setSelectedWeek] = useState<number>(0);
	const [totwData, setTotwData] = useState<WeeklyTOTW | null>(null);
	const [players, setPlayers] = useState<TOTWPlayer[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
	const [playerDetails, setPlayerDetails] = useState<MatchDetailWithSummary[] | null>(null);
	const [totwAppearances, setTotwAppearances] = useState<number | undefined>(undefined);
	const [showModal, setShowModal] = useState(false);
	const [showInfoTooltip, setShowInfoTooltip] = useState(false);
	const [loadingPlayerDetails, setLoadingPlayerDetails] = useState(false);
	const [containerWidth, setContainerWidth] = useState(800);

	// Fetch seasons on mount - check cache first
	useEffect(() => {
		const cachedSeasons = getCachedTOTWSeasons();
		if (cachedSeasons) {
			setSeasons(cachedSeasons.seasons);
			if (cachedSeasons.currentSeason) {
				setCurrentSeason(cachedSeasons.currentSeason);
				setSelectedSeason(cachedSeasons.currentSeason);
			} else if (cachedSeasons.seasons.length > 0) {
				setSelectedSeason(cachedSeasons.seasons[0]);
			}
			return;
		}

		const fetchSeasons = async () => {
			try {
				const response = await fetch("/api/totw/seasons");
				const data = await response.json();
				if (data.seasons) {
					setSeasons(data.seasons);
					// Use currentSeason from API, or fallback to localStorage, or first season
					const seasonToUse = data.currentSeason || getCurrentSeasonFromStorage();
					if (seasonToUse && data.seasons.includes(seasonToUse)) {
						setCurrentSeason(seasonToUse);
						setSelectedSeason(seasonToUse);
					} else if (data.seasons.length > 0) {
						setSelectedSeason(data.seasons[0]);
					}
					cacheTOTWSeasons(data.seasons, data.currentSeason || getCurrentSeasonFromStorage() || null);
				}
			} catch (error) {
				console.error("Error fetching seasons:", error);
			}
		};
		fetchSeasons();
	}, [getCachedTOTWSeasons, cacheTOTWSeasons]);

	// Fetch weeks when season changes - check cache first
	useEffect(() => {
		if (!selectedSeason) return;

		const cachedWeeks = getCachedTOTWWeeks(selectedSeason);
		if (cachedWeeks) {
			setWeeks(cachedWeeks.weeks);
			if (cachedWeeks.currentWeek !== null) {
				setCurrentWeek(cachedWeeks.currentWeek);
				setSelectedWeek(cachedWeeks.currentWeek);
			} else if (cachedWeeks.weeks.length > 0) {
				const weekToSelect = cachedWeeks.weeks[cachedWeeks.weeks.length - 1].week;
				setCurrentWeek(weekToSelect);
				setSelectedWeek(weekToSelect);
			}
			return;
		}

		const fetchWeeks = async () => {
			try {
				const response = await fetch(`/api/totw/weeks?season=${encodeURIComponent(selectedSeason)}`);
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const data = await response.json();
				
				console.log("=== Week Calculation Debug ===");
				console.log("Selected Season:", selectedSeason);
				console.log("Full API response:", data);
				console.log("Weeks data:", data.weeks);
				console.log("Weeks array length:", data.weeks?.length);
				console.log("Current Week from API (last week in list):", data.currentWeek);
				console.log("Expected: 44 (last week in season)");
				
				if (data.error) {
					console.error("API Error:", data.error);
					setWeeks([]);
					return;
				}
				
				if (data.weeks && Array.isArray(data.weeks)) {
					setWeeks(data.weeks);
					// Prioritize latestGameweek from SiteDetail, then currentWeek, then last week in list
					let weekToSelect: number | null = null;
					if (data.latestGameweek && data.latestGameweek !== "") {
						const latestWeekNum = Number(data.latestGameweek);
						if (!isNaN(latestWeekNum)) {
							weekToSelect = latestWeekNum;
							console.log("Setting week to latestGameweek from SiteDetail:", weekToSelect);
						}
					}
					if (weekToSelect === null && data.currentWeek !== null && data.currentWeek !== undefined) {
						weekToSelect = data.currentWeek;
						console.log("Setting week to currentWeek from API:", weekToSelect);
					}
					if (weekToSelect === null && data.weeks.length > 0) {
						weekToSelect = data.weeks[data.weeks.length - 1].week;
						console.log("Setting week to last week in list:", weekToSelect);
					}
					if (weekToSelect !== null) {
						setCurrentWeek(weekToSelect);
						setSelectedWeek(weekToSelect);
					} else {
						console.log("No weeks found for season:", selectedSeason);
						setWeeks([]);
					}
					cacheTOTWWeeks(selectedSeason, data.weeks, weekToSelect, data.latestGameweek);
				} else {
					console.error("Invalid weeks data format:", data);
					setWeeks([]);
				}
			} catch (error) {
				console.error("Error fetching weeks:", error);
				setWeeks([]);
			}
		};
		fetchWeeks();
	}, [selectedSeason, getCachedTOTWWeeks, cacheTOTWWeeks]);

	// Fetch TOTW data when season/week changes - check cache first
	useEffect(() => {
		if (!selectedSeason || !selectedWeek || selectedWeek === 0) return;

		const cachedWeekData = getCachedTOTWWeekData(selectedSeason, selectedWeek);
		if (cachedWeekData) {
			setTotwData(cachedWeekData.totwData);
			setPlayers(cachedWeekData.players);
			setLoading(false);
			return;
		}

		const fetchWeekData = async () => {
			setLoading(true);
			try {
				const response = await fetch(
					`/api/totw/week-data?season=${encodeURIComponent(selectedSeason)}&week=${selectedWeek}`,
				);
				
				if (!response.ok) {
					console.error(`[TOTW] Week-data API error: ${response.status} ${response.statusText}`);
					const errorData = await response.json().catch(() => ({}));
					console.error(`[TOTW] Error details:`, errorData);
					setTotwData(null);
					setPlayers([]);
					return;
				}
				
				const data = await response.json();
				console.log(`[TOTW] Week-data response:`, data);
				console.log(`[TOTW] Players array:`, data.players);
				console.log(`[TOTW] Players count:`, data.players?.length);
				
				if (data.totwData) {
					setTotwData(data.totwData);
					setPlayers(data.players || []);
					cacheTOTWWeekData(selectedSeason, selectedWeek, data.totwData, data.players || []);
					
					// Log player matching for debugging
					if (data.players && data.players.length > 0) {
						console.log(`[TOTW] Player FTP scores:`, data.players.map((p: any) => `${p.playerName}: ${p.ftpScore}`));
					}
				} else {
					console.log(`[TOTW] No TOTW data found for week ${selectedWeek}`);
					setTotwData(null);
					setPlayers([]);
				}
			} catch (error) {
				console.error("[TOTW] Error fetching week data:", error);
				setTotwData(null);
				setPlayers([]);
			} finally {
				setLoading(false);
			}
		};
		fetchWeekData();
	}, [selectedSeason, selectedWeek, getCachedTOTWWeekData, cacheTOTWWeekData]);

	// Update container width on resize and when data loads
	useEffect(() => {
		const updateWidth = () => {
			if (pitchContainerRef.current) {
				setContainerWidth(pitchContainerRef.current.offsetWidth);
			}
		};

		// Initial update
		updateWidth();
		
		// Update on window resize
		window.addEventListener('resize', updateWidth);
		
		// Update when data loads (container might not be sized initially)
		const timeoutId = setTimeout(updateWidth, 100);
		
		return () => {
			window.removeEventListener('resize', updateWidth);
			clearTimeout(timeoutId);
		};
	}, [totwData, loading]);

	// Handle player click
	const handlePlayerClick = async (playerName: string) => {
		if (!selectedSeason || !selectedWeek || !playerName) return;

		const queryUrl = `/api/totw/player-details?season=${encodeURIComponent(selectedSeason)}&week=${selectedWeek}&playerName=${encodeURIComponent(playerName)}`;
		console.log("[TOTW] Player details query:", queryUrl);

		setLoadingPlayerDetails(true);
		setSelectedPlayer(playerName);

		try {
			const response = await fetch(queryUrl);
			const data = await response.json();
			if (data.matchDetails) {
				setPlayerDetails(data.matchDetails);
				setTotwAppearances(data.totwAppearances);
				setShowModal(true);
			}
		} catch (error) {
			console.error("Error fetching player details:", error);
			setSelectedPlayer(null);
		} finally {
			setLoadingPlayerDetails(false);
		}
	};

	// Map player positions to formation positions
	const getPlayerPosition = (formation: string, positionKey: string): { x: number; y: number } | null => {
		if (!formation || !formationCoordinateObject[formation]) return null;

		const formationData = formationCoordinateObject[formation];
		
		// Create mapping based on formation structure
		// Each formation has different number of defenders, midfielders, forwards
		// The position keys (gk1, def1-5, mid1-5, fwd1-3) map to Pos1-11 based on formation
		const getPosKey = (key: string): keyof typeof formationData | null => {
			// Goalkeeper is always Pos1
			if (key === "gk1") return "Pos1";
			
			// Map based on formation
			if (formation === "3-4-3") {
				if (key === "def1") return "Pos2";
				if (key === "def2") return "Pos3";
				if (key === "def3") return "Pos4";
				if (key === "mid1") return "Pos5";
				if (key === "mid2") return "Pos6";
				if (key === "mid3") return "Pos7";
				if (key === "mid4") return "Pos8";
				if (key === "fwd1") return "Pos9";
				if (key === "fwd2") return "Pos10";
				if (key === "fwd3") return "Pos11";
			} else if (formation === "4-4-2") {
				if (key === "def1") return "Pos2";
				if (key === "def2") return "Pos3";
				if (key === "def3") return "Pos4";
				if (key === "def4") return "Pos5";
				if (key === "mid1") return "Pos6";
				if (key === "mid2") return "Pos7";
				if (key === "mid3") return "Pos8";
				if (key === "mid4") return "Pos9";
				if (key === "fwd1") return "Pos10";
				if (key === "fwd2") return "Pos11";
			} else if (formation === "4-3-3") {
				if (key === "def1") return "Pos2";
				if (key === "def2") return "Pos3";
				if (key === "def3") return "Pos4";
				if (key === "def4") return "Pos5";
				if (key === "mid1") return "Pos6";
				if (key === "mid2") return "Pos7";
				if (key === "mid3") return "Pos8";
				if (key === "fwd1") return "Pos9";
				if (key === "fwd2") return "Pos10";
				if (key === "fwd3") return "Pos11";
			} else if (formation === "3-5-2") {
				if (key === "def1") return "Pos2";
				if (key === "def2") return "Pos3";
				if (key === "def3") return "Pos4";
				if (key === "mid1") return "Pos5";
				if (key === "mid2") return "Pos6";
				if (key === "mid3") return "Pos7";
				if (key === "mid4") return "Pos8";
				if (key === "mid5") return "Pos9";
				if (key === "fwd1") return "Pos10";
				if (key === "fwd2") return "Pos11";
			} else if (formation === "4-5-1") {
				if (key === "def1") return "Pos2";
				if (key === "def2") return "Pos3";
				if (key === "def3") return "Pos4";
				if (key === "def4") return "Pos5";
				if (key === "mid1") return "Pos6";
				if (key === "mid2") return "Pos7";
				if (key === "mid3") return "Pos8";
				if (key === "mid4") return "Pos9";
				if (key === "mid5") return "Pos10";
				if (key === "fwd1") return "Pos11";
			} else if (formation === "5-3-2") {
				if (key === "def1") return "Pos2";
				if (key === "def2") return "Pos3";
				if (key === "def3") return "Pos4";
				if (key === "def4") return "Pos5";
				if (key === "def5") return "Pos6";
				if (key === "mid1") return "Pos7";
				if (key === "mid2") return "Pos8";
				if (key === "mid3") return "Pos9";
				if (key === "fwd1") return "Pos10";
				if (key === "fwd2") return "Pos11";
			} else if (formation === "5-4-1") {
				if (key === "def1") return "Pos2";
				if (key === "def2") return "Pos3";
				if (key === "def3") return "Pos4";
				if (key === "def4") return "Pos5";
				if (key === "def5") return "Pos6";
				if (key === "mid1") return "Pos7";
				if (key === "mid2") return "Pos8";
				if (key === "mid3") return "Pos9";
				if (key === "mid4") return "Pos10";
				if (key === "fwd1") return "Pos11";
			}
			
			return null;
		};

		const posKey = getPosKey(positionKey);
		if (!posKey || !formationData[posKey]) return null;

		// Apply centering offsets to better center the formation on the pitch
		// Fine-tuned offsets to align formation with background image center
		// Shift right by ~10% and down by ~15% to center the formation horizontally and align with background image
		// Compress vertical spacing by 10% (reduce gaps by 10%)
		const baseY = formationData[posKey].y;
		const compressedY = 1 + (baseY - 1) * 0.95;
		return {
			x: formationData[posKey].x + 10,
			y: compressedY + 15,
		};
	};

	// Get player FTP score
	const getPlayerFTP = (playerName: string): number => {
		const player = players.find((p) => {
			// Try exact match first
			if (p.playerName === playerName) return true;
			// Try case-insensitive match
			if (p.playerName.toLowerCase().trim() === playerName.toLowerCase().trim()) return true;
			return false;
		});
		
		const ftp = player?.ftpScore || 0;
		if (ftp === 0 && playerName) {
			console.log(`[TOTW] No FTP score found for player: ${playerName}. Available players:`, players.map(p => p.playerName));
		}
		return ftp;
	};

	// Format player name (first initial + full surname)
	const formatPlayerName = (name: string): string => {
		const spacePosition = name.indexOf(" ");
		if (spacePosition > 0) {
			const firstInitial = name.substring(0, 1);
			const surname = name.substring(spacePosition + 1);
			return firstInitial + " " + surname;
		}
		return name;
	};

	// Get all players in formation order
	const getPlayersInFormation = (): Array<{ name: string; position: string; ftp: number; posKey: string }> => {
		if (!totwData) return [];

		const playersList: Array<{ name: string; position: string; ftp: number; posKey: string }> = [];

		// Always add goalkeeper first
		if (totwData.gk1) {
			playersList.push({
				name: totwData.gk1,
				position: "GK",
				ftp: getPlayerFTP(totwData.gk1),
				posKey: "gk1",
			});
		}

		// Add defenders
		["def1", "def2", "def3", "def4", "def5"].forEach((key) => {
			const playerName = totwData[key as keyof WeeklyTOTW] as string;
			if (playerName) {
				playersList.push({
					name: playerName,
					position: "DEF",
					ftp: getPlayerFTP(playerName),
					posKey: key,
				});
			}
		});

		// Add midfielders
		["mid1", "mid2", "mid3", "mid4", "mid5"].forEach((key) => {
			const playerName = totwData[key as keyof WeeklyTOTW] as string;
			if (playerName) {
				playersList.push({
					name: playerName,
					position: "MID",
					ftp: getPlayerFTP(playerName),
					posKey: key,
				});
			}
		});

		// Add forwards
		["fwd1", "fwd2", "fwd3"].forEach((key) => {
			const playerName = totwData[key as keyof WeeklyTOTW] as string;
			if (playerName) {
				playersList.push({
					name: playerName,
					position: "FWD",
					ftp: getPlayerFTP(playerName),
					posKey: key,
				});
			}
		});

		return playersList;
	};

	const playersInFormation = getPlayersInFormation();
	const formation = totwData?.bestFormation || "";
	const pitchContainerRef = useRef<HTMLDivElement>(null);

	// Track row player counts and positions for 4-player row adjustments
	const rowPlayerData = useMemo(() => {
		if (!formation || playersInFormation.length === 0) return new Map<number, { playerCount: number; players: Array<{ player: typeof playersInFormation[0]; position: { x: number; y: number }; index: number }> }>();
		
		const rowData = new Map<number, { playerCount: number; players: Array<{ player: typeof playersInFormation[0]; position: { x: number; y: number }; index: number }> }>();
		
		playersInFormation.forEach((player, index) => {
			const position = getPlayerPosition(formation, player.posKey);
			if (position) {
				const rowY = Math.round(position.y);
				const existing = rowData.get(rowY);
				if (existing) {
					existing.playerCount++;
					existing.players.push({ player, position, index });
				} else {
					rowData.set(rowY, {
						playerCount: 1,
						players: [{ player, position, index }],
					});
				}
			}
		});
		
		// Sort players in each row by x position
		rowData.forEach((data) => {
			data.players.sort((a, b) => a.position.x - b.position.x);
		});
		
		return rowData;
	}, [formation, playersInFormation]);

	// Calculate dynamic box dimensions for each row based on player positions and container width
	const rowDimensions = useMemo(() => {
		if (!formation || playersInFormation.length === 0) return new Map<number, { width: number; height: number }>();

		// Use container width state (updates on resize)
		const width = containerWidth;
		const edgeMargin = 2; // Reduced gap in pixels from pitch edge
		const baseHeight = 44; // Consistent height for all boxes in a row

		// Group players by their y-coordinate and track x positions
		const rowData = new Map<number, { playerCount: number; minX: number; maxX: number }>();
		
		playersInFormation.forEach((player) => {
			const position = getPlayerPosition(formation, player.posKey);
			if (position) {
				const rowY = Math.round(position.y);
				const existing = rowData.get(rowY);
				if (existing) {
					existing.playerCount++;
					existing.minX = Math.min(existing.minX, position.x);
					existing.maxX = Math.max(existing.maxX, position.x);
				} else {
					rowData.set(rowY, {
						playerCount: 1,
						minX: position.x,
						maxX: position.x,
					});
				}
			}
		});

		// Calculate dimensions for each row
		const dimensions = new Map<number, { width: number; height: number }>();
		const minWidth = 55; // Minimum width in pixels

		rowData.forEach((data, rowY) => {
			// Use smaller gap for 4-player rows to maximize box width
			const gapBetweenBoxes = data.playerCount === 4 ? 1 : 2;
			
			// Get players in this row with their positions
			const rowPlayersWithPositions = playersInFormation
				.map((player) => {
					const position = getPlayerPosition(formation, player.posKey);
					return position && Math.round(position.y) === rowY 
						? { player, position } 
						: null;
				})
				.filter((item): item is { player: typeof playersInFormation[0]; position: { x: number; y: number } } => item !== null)
				.sort((a, b) => a.position.x - b.position.x);
			
			// For rows with 1-3 players, size boxes to fit names (not maximize)
			if (data.playerCount <= 3) {
				// Estimate width needed for names (rough calculation: ~8px per character + padding)
				const padding = 16; // px-2 on both sides = 8px * 2
				const maxNameLength = Math.max(...rowPlayersWithPositions.map(({ player }) => formatPlayerName(player.name).length));
				const estimatedNameWidth = (maxNameLength * 8) + padding; // ~8px per character
				
				// Calculate minimum spacing between adjacent players to ensure gaps
				let minSpacing = Infinity;
				if (rowPlayersWithPositions.length > 1) {
					for (let i = 0; i < rowPlayersWithPositions.length - 1; i++) {
						const spacing = (rowPlayersWithPositions[i + 1].position.x - rowPlayersWithPositions[i].position.x) / 100 * width;
						minSpacing = Math.min(minSpacing, spacing);
					}
				}
				
				// Box width should be less than minimum spacing to ensure gaps (if multiple players)
				let boxWidth = Math.max(minWidth, estimatedNameWidth);
				if (rowPlayersWithPositions.length > 1 && minSpacing < Infinity) {
					// Ensure box width leaves at least gapBetweenBoxes space between boxes
					const maxBoxWidth = minSpacing - gapBetweenBoxes;
					boxWidth = Math.min(boxWidth, maxBoxWidth);
				}
				
				dimensions.set(rowY, {
					width: boxWidth,
					height: baseHeight,
				});
			} else {
				// For rows with 4+ players, calculate based on spacing between players
				// Apply position adjustments for 4-player rows to bring players closer
				const adjustedPositions = rowPlayersWithPositions.map((item, idx) => {
					if (data.playerCount === 4) {
						// Apply same adjustments as in rendering: reduce spread
						if (idx === 0) {
							// Leftmost: move wider (left) - reduced spread
							return { ...item, position: { ...item.position, x: item.position.x - 2.5 } };
						} else if (idx === 1) {
							// Left inner: move narrower (right) - move closer to center
							return { ...item, position: { ...item.position, x: item.position.x + 2.5 } };
						} else if (idx === 2) {
							// Right inner: move narrower (left) - move closer to center
							return { ...item, position: { ...item.position, x: item.position.x - 2.5 } };
						} else if (idx === 3) {
							// Rightmost: move wider (right) - reduced spread
							return { ...item, position: { ...item.position, x: item.position.x + 2.5 } };
						}
					}
					return item;
				});
				
				// Find minimum spacing between adjacent players using adjusted positions
				let minSpacing = Infinity;
				for (let i = 0; i < adjustedPositions.length - 1; i++) {
					const spacing = (adjustedPositions[i + 1].position.x - adjustedPositions[i].position.x) / 100 * width;
					minSpacing = Math.min(minSpacing, spacing);
				}
				
				// Box width should maximize available space while maintaining gaps
				// Calculate from leftmost to rightmost adjusted positions
				const leftmostX = adjustedPositions[0].position.x;
				const rightmostX = adjustedPositions[adjustedPositions.length - 1].position.x;
				const totalRowWidth = ((rightmostX - leftmostX) / 100) * width;
				const totalGapWidth = gapBetweenBoxes * (data.playerCount - 1);
				const maxBoxWidthFromRow = (totalRowWidth - totalGapWidth) / data.playerCount;
				
				// Also consider spacing between adjacent players
				const maxBoxWidthFromSpacing = minSpacing - gapBetweenBoxes;
				
				// For 4-player rows, maximize width by using the full row width more aggressively
				// For other rows, use the smaller to maintain gaps
				let boxWidth;
				if (data.playerCount === 4) {
					// For 4-player rows, use the full available width from the row
					// Use 92% of the calculated width to ensure small gaps remain
					const widerBoxWidth = maxBoxWidthFromRow * 0.92;
					// Also consider using more of the spacing if it's larger
					const widerFromSpacing = maxBoxWidthFromSpacing * 1.05;
					// Use the larger of the two to maximize width, then reduce by 5px
					boxWidth = Math.max(minWidth, Math.max(widerBoxWidth, widerFromSpacing) - 5);
				} else if (data.playerCount === 5) {
					// For 5-player rows, use the smaller of the two and add 14px
					boxWidth = Math.max(minWidth, Math.min(maxBoxWidthFromRow, maxBoxWidthFromSpacing) + 14);
				} else {
					// Use the smaller of the two for other row sizes
					boxWidth = Math.max(minWidth, Math.min(maxBoxWidthFromRow, maxBoxWidthFromSpacing));
				}
				
				dimensions.set(rowY, {
					width: boxWidth,
					height: baseHeight,
				});
			}
		});

		return dimensions;
	}, [formation, playersInFormation, containerWidth]);

	return (
		<div className='flex flex-col px-[11.2px] md:px-[16.8px] py-4 md:py-6 relative'>
			{/* Header */}
			<div className='text-center mb-3 flex items-center justify-center gap-2'>
				<h1 
					className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-1'
					title='Select a week filter to begin reviewing past teams of the week. Or click on a player to see more details.'
				>
					Team of the Week
				</h1>
				<button
					className='relative min-w-[40px] min-h-[40px] flex items-center justify-center'
					onMouseEnter={() => setShowInfoTooltip(true)}
					onMouseLeave={() => setShowInfoTooltip(false)}
					onTouchStart={() => setShowInfoTooltip(!showInfoTooltip)}
					aria-label='Information about Team of the Week'
				>
					<svg 
						xmlns='http://www.w3.org/2000/svg' 
						fill='none' 
						viewBox='0 0 24 24' 
						strokeWidth={1.5} 
						stroke='currentColor' 
						className='w-5 h-5 text-dorkinians-yellow cursor-pointer touch-manipulation'
					>
						<path strokeLinecap='round' strokeLinejoin='round' d='m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z' />
					</svg>
					{showInfoTooltip && (
						<div className='absolute bottom-full left-0 mb-2 px-3 py-2 text-xs text-white rounded-lg shadow-lg w-64 text-center z-50 pointer-events-none' style={{ backgroundColor: '#0f0f0f' }}>
							Select a week filter to begin reviewing past teams of the week. Or click on a player to see more details.
							<div className='absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent' style={{ borderTopColor: '#0f0f0f' }}></div>
						</div>
					)}
				</button>
			</div>

			{/* Filters */}
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
					<Listbox value={selectedWeek || 0} onChange={setSelectedWeek}>
						<div className='relative'>
							<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-[0.65rem] md:text-sm'>
								<span className={`block truncate ${selectedWeek ? "text-white" : "text-yellow-300"}`}>
									{weeks.length === 0 ? "Loading..." : selectedWeek ? `Week ${selectedWeek}${weeks.find(w => w.week === selectedWeek) ? ` (${weeks.find(w => w.week === selectedWeek)?.dateLookup || ''})` : ''}` : "Select week..."}
								</span>
								<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
									<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
								</span>
							</Listbox.Button>
							<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none text-[0.65rem] md:text-sm'>
								{weeks.length === 0 ? (
									<Listbox.Option value={0} className='relative cursor-default select-none dark-dropdown-option py-2 pl-3 pr-9 text-white'>
										Loading...
									</Listbox.Option>
								) : (
									weeks.map((week) => (
										<Listbox.Option
											key={week.week}
											className={({ active }) =>
												`relative cursor-default select-none dark-dropdown-option py-2 pl-3 pr-9 ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
											}
											value={week.week}>
											{({ selected }) => (
												<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
													Week {week.week} ({week.dateLookup || ''})
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

			{/* Central Loading Spinner */}
			{loading && (
				<div className='absolute inset-0 flex items-center justify-center z-50'>
					<div className='animate-spin rounded-full h-16 w-16 md:h-20 md:w-20 border-b-2 border-gray-300'></div>
				</div>
			)}

			{/* Summary Statistics */}
			<div className='flex flex-row flex-nowrap gap-4 md:gap-12 mb-6 justify-center'>
				<div className='text-center flex flex-col md:w-auto'>
					<div className='h-5 mb-2 flex items-center justify-center'>
						<p className='text-gray-300 font-bold text-xs md:text-sm'>TOTW TOTAL POINTS</p>
					</div>
					<div className='flex-1 md:flex-none flex items-end md:items-center justify-center'>
						{!loading && totwData ? (
							<p className='text-7xl md:text-8xl font-bold text-gray-300 leading-none'>{Math.round(totwData?.totwScore || 0)}</p>
						) : null}
					</div>
					{!loading && totwData && (
						<p className='text-gray-300 mt-2 text-[0.65rem] md:text-xs whitespace-nowrap'>Number Players Played: {totwData?.playerCount || 0}</p>
					)}
				</div>
				<div className='flex flex-col items-center flex-shrink-0'>
					<div className='h-5 mb-2 flex items-center justify-center'>
						<p className='text-gray-300 font-bold text-xs md:text-sm'>STAR MAN</p>
					</div>
					{!loading && totwData?.starMan && (
						<div className='flex flex-col items-center gap-2 cursor-pointer hover:scale-105 transition-transform' onClick={() => handlePlayerClick(totwData.starMan)}>
							<div className='relative w-12 h-12 md:w-14 md:h-14'>
								<Image
									src='/totw-images/Kit.svg'
									alt='Star Man Kit'
									fill
									className='object-contain'
								/>
							</div>
							<div className='text-white px-4 py-1 rounded text-center' style={{ background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))' }}>
								<div className='text-xs md:text-sm'>{totwData.starMan}</div>
								<div className='font-bold mt-1 text-xs md:text-sm'>{Math.round(totwData.starManScore)}</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Pitch Visualization */}
			<div ref={pitchContainerRef} className='relative w-full mb-4 overflow-hidden' style={{ minHeight: '450px', aspectRatio: '16/9.6' }}>
				{!loading && (
					<>
						{/* Pitch Background */}
						<div className='absolute inset-0 w-full h-[110%]'>
							<Image
								src='/totw-images/TOTWBackground.svg'
								alt='Football Pitch'
								fill
								className='object-cover w-full h-full'
								style={{ objectPosition: 'center top' }}
								priority
							/>
						</div>

						{/* Players */}
						{playersInFormation.map((player, index) => {
							const position = getPlayerPosition(formation, player.posKey);
							if (!position) return null;

							const isGoalkeeper = player.position === "GK";
							const rowY = Math.round(position.y);
							const dimensions = rowDimensions.get(rowY) || { width: 60, height: 50 };
							
							// Adjust position for 4-player rows
							let adjustedX = position.x;
							const rowData = rowPlayerData.get(rowY);
							if (rowData && rowData.playerCount === 4) {
								// Find this player's index in the sorted row
								const playerInRow = rowData.players.find(p => p.index === index);
								if (playerInRow) {
									const positionInRow = rowData.players.indexOf(playerInRow);
									// Position 0 = leftmost (outside), 1 = left inner, 2 = right inner, 3 = rightmost (outside)
									if (positionInRow === 0) {
										// Leftmost: move wider (left) - reduced spread
										adjustedX = position.x - 2.5;
									} else if (positionInRow === 1) {
										// Left inner: move narrower (right) - move closer to center
										adjustedX = position.x + 2.5;
									} else if (positionInRow === 2) {
										// Right inner: move narrower (left) - move closer to center
										adjustedX = position.x - 2.5;
									} else if (positionInRow === 3) {
										// Rightmost: move wider (right) - reduced spread
										adjustedX = position.x + 2.5;
									}
								}
							}

							return (
								<div
									key={`${player.name}-${index}`}
									className='absolute cursor-pointer hover:scale-110 transition-transform z-10'
									style={{
										left: `${adjustedX}%`,
										top: `${position.y}%`,
										transform: "translate(-50%, -50%)",
									}}
									onClick={() => handlePlayerClick(player.name)}
								>
									<div className='flex flex-col items-center'>
										<div className='relative w-12 h-12 md:w-14 md:h-14 mb-1'>
											<Image
												src={isGoalkeeper ? "/totw-images/KeeperKit.svg" : "/totw-images/Kit.svg"}
												alt={`${player.name} kit`}
												fill
												className='object-contain'
											/>
										</div>
										<div 
											className='bg-green-600 text-white rounded text-center' 
											style={{ 
												backgroundColor: 'rgba(28, 136, 65, 0.95)',
												width: `${dimensions.width}px`,
												minWidth: `${dimensions.width}px`,
												maxWidth: `${dimensions.width}px`,
												height: `${dimensions.height}px`,
												overflow: 'hidden',
												wordWrap: 'break-word',
												paddingLeft: '6px',
												paddingRight: '6px',
												paddingTop: '4px',
												paddingBottom: '4px',
												display: 'flex',
												flexDirection: 'column',
												justifyContent: 'center',
												alignItems: 'center',
											}}
										>
											<div className='whitespace-nowrap leading-tight text-[0.625rem] overflow-hidden'>
												{(() => {
													const formattedName = formatPlayerName(player.name);
													// For 4-player rows, truncate to 11 characters with ".."
													if (rowData && rowData.playerCount === 4 && formattedName.length > 11) {
														return formattedName.substring(0, 11) + "..";
													}
													// For 5-player rows, truncate to 8 characters with ".."
													if (rowData && rowData.playerCount === 5 && formattedName.length > 8) {
														return formattedName.substring(0, 8) + "..";
													}
													return formattedName;
												})()}
											</div>
											<div className='font-bold mt-0.5 text-xs md:text-sm'>
												{!loading && totwData && Math.round(player.ftp)}
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</>
				)}
			</div>

			{/* Loading Overlay */}
			{loadingPlayerDetails && (
				<div className='fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50'>
					<div className='flex flex-col items-center'>
						<div className='animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-300 mb-4'></div>
						<p className='text-white text-lg'>Loading player details...</p>
					</div>
				</div>
			)}

			{/* Player Detail Modal */}
			{showModal && selectedPlayer && playerDetails && (
				<PlayerDetailModal
					playerName={selectedPlayer}
					matchDetails={playerDetails}
					totwAppearances={totwAppearances}
					onClose={() => {
						setShowModal(false);
						setSelectedPlayer(null);
						setPlayerDetails(null);
						setTotwAppearances(undefined);
					}}
				/>
			)}
		</div>
	);
}
