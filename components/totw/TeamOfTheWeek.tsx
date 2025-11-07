"use client";

import { useState, useEffect } from "react";
import { WeeklyTOTW, MatchDetail } from "@/types";
import { formationCoordinateObject } from "@/lib/formations/formationCoordinates";
import PlayerDetailModal from "./PlayerDetailModal";
import Image from "next/image";

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
	const [seasons, setSeasons] = useState<string[]>([]);
	const [currentSeason, setCurrentSeason] = useState<string | null>(null);
	const [selectedSeason, setSelectedSeason] = useState<string>("");
	const [weeks, setWeeks] = useState<Week[]>([]);
	const [currentWeek, setCurrentWeek] = useState<number | null>(null);
	const [selectedWeek, setSelectedWeek] = useState<number>(0);
	const [totwData, setTotwData] = useState<WeeklyTOTW | null>(null);
	const [players, setPlayers] = useState<TOTWPlayer[]>([]);
	const [loading, setLoading] = useState(false);
	const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
	const [playerDetails, setPlayerDetails] = useState<MatchDetailWithSummary[] | null>(null);
	const [showModal, setShowModal] = useState(false);

	// Fetch seasons on mount
	useEffect(() => {
		const fetchSeasons = async () => {
			try {
				const response = await fetch("/api/totw/seasons");
				const data = await response.json();
				if (data.seasons) {
					setSeasons(data.seasons);
					if (data.currentSeason) {
						setCurrentSeason(data.currentSeason);
						setSelectedSeason(data.currentSeason);
					} else if (data.seasons.length > 0) {
						setSelectedSeason(data.seasons[0]);
					}
				}
			} catch (error) {
				console.error("Error fetching seasons:", error);
			}
		};
		fetchSeasons();
	}, []);

	// Fetch weeks when season changes
	useEffect(() => {
		if (!selectedSeason) return;

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
					if (data.currentWeek !== null && data.currentWeek !== undefined) {
						console.log("Setting current week to:", data.currentWeek);
						setCurrentWeek(data.currentWeek);
						setSelectedWeek(data.currentWeek);
					} else if (data.weeks.length > 0) {
						const lastWeek = data.weeks[data.weeks.length - 1].week;
						console.log("No current week found, using last week:", lastWeek);
						setCurrentWeek(lastWeek);
						setSelectedWeek(lastWeek);
					} else {
						console.log("No weeks found for season:", selectedSeason);
						setWeeks([]);
					}
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
	}, [selectedSeason]);

	// Fetch TOTW data when season/week changes
	useEffect(() => {
		if (!selectedSeason || !selectedWeek || selectedWeek === 0) return;

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
	}, [selectedSeason, selectedWeek]);

	// Handle player click
	const handlePlayerClick = async (playerName: string) => {
		if (!selectedSeason || !selectedWeek || !playerName) return;

		try {
			const response = await fetch(
				`/api/totw/player-details?season=${encodeURIComponent(selectedSeason)}&week=${selectedWeek}&playerName=${encodeURIComponent(playerName)}`,
			);
			const data = await response.json();
			if (data.matchDetails) {
				setPlayerDetails(data.matchDetails);
				setSelectedPlayer(playerName);
				setShowModal(true);
			}
		} catch (error) {
			console.error("Error fetching player details:", error);
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

		return {
			x: formationData[posKey].x,
			y: formationData[posKey].y,
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

	// Format player name (truncate if too long)
	const formatPlayerName = (name: string): string => {
		if (name.length > 12) {
			const spacePosition = name.indexOf(" ") + 1;
			if (spacePosition > 0) {
				const firstName = name.substring(0, spacePosition);
				const lastNameInitial = name.substring(spacePosition, spacePosition + 1);
				return firstName + " " + lastNameInitial;
			}
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

	return (
		<div className='flex flex-col p-4 md:p-6'>
			{/* Header */}
			<div className='text-center mb-3 flex items-center justify-center gap-2'>
				<h1 
					className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-1'
					title='Select a week filter to begin reviewing past teams of the week. Or click on a player to see more details.'
				>
					TEAM OF THE WEEK
				</h1>
				<div 
					className='relative group'
					title='Select a week filter to begin reviewing past teams of the week. Or click on a player to see more details.'
				>
					<svg 
						xmlns='http://www.w3.org/2000/svg' 
						fill='none' 
						viewBox='0 0 24 24' 
						strokeWidth={1.5} 
						stroke='currentColor' 
						className='w-5 h-5 text-dorkinians-yellow cursor-help'
					>
						<path strokeLinecap='round' strokeLinejoin='round' d='m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z' />
					</svg>
				</div>
			</div>

			{/* Filters */}
			<div className='flex flex-row gap-4 mb-6'>
				<div className='w-1/2'>
					<select
						value={selectedSeason}
						onChange={(e) => setSelectedSeason(e.target.value)}
						className='w-full text-sm text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-dorkinians-yellow'
						style={{
							background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))',
							border: 'none',
						}}
					>
						{seasons.map((season) => (
							<option key={season} value={season} style={{ backgroundColor: '#1C8841', color: 'white' }}>
								{season}
							</option>
						))}
					</select>
				</div>
				<div className='w-1/2'>
					<select
						value={selectedWeek || ''}
						onChange={(e) => {
							const weekValue = e.target.value ? Number(e.target.value) : 0;
							setSelectedWeek(weekValue);
						}}
						className='w-full text-sm text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-dorkinians-yellow'
						style={{
							background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))',
							border: 'none',
						}}
					>
						{weeks.length === 0 ? (
							<option value=''>Loading...</option>
						) : (
							weeks.map((week) => (
								<option key={week.week} value={week.week} style={{ backgroundColor: '#1C8841', color: 'white' }}>
									Week {week.weekAdjusted} ({week.dateLookup || ''})
								</option>
							))
						)}
					</select>
				</div>
			</div>

			{/* Summary Statistics */}
			<div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 items-start'>
				<div>
					<p className='text-gray-300 font-bold mb-2'>TOTW TOTAL POINTS:</p>
					<p className='text-4xl font-bold text-gray-300'>{totwData?.totwScore || 0}</p>
					<p className='text-gray-300 mt-2'>Number Players Played: {totwData?.playerCount || 0}</p>
				</div>
				<div className='flex flex-col'>
					<p className='text-gray-300 font-bold mb-2'>STAR MAN</p>
					{totwData?.starMan && (
						<div className='flex flex-col items-start gap-2'>
							<div className='relative w-12 h-12 md:w-14 md:h-14'>
								<Image
									src='/totw-images/Kit.svg'
									alt='Star Man Kit'
									fill
									className='object-contain'
								/>
							</div>
							<div className='bg-green-600 text-white px-4 py-1 rounded text-center'>
								<div>{totwData.starMan}</div>
								<div className='font-bold mt-1'>{totwData.starManScore}</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Pitch Visualization */}
			<div className='relative w-full mb-6' style={{ minHeight: '500px', aspectRatio: '16/9' }}>
				{loading ? (
					<div className='absolute inset-0 flex items-center justify-center'>
						<div className='text-white text-xl'>Loading...</div>
					</div>
				) : (
					<>
						{/* Pitch Background */}
						<div className='absolute inset-0 w-full h-full'>
							<Image
								src='/totw-images/TOTWBackground.svg'
								alt='Football Pitch'
								fill
								className='object-cover w-full h-full'
								priority
							/>
						</div>

						{/* Players */}
						{playersInFormation.map((player, index) => {
							const position = getPlayerPosition(formation, player.posKey);
							if (!position) return null;

							const isGoalkeeper = player.position === "GK";

							return (
								<div
									key={`${player.name}-${index}`}
									className='absolute cursor-pointer hover:scale-110 transition-transform z-10'
									style={{
										left: `${position.x}%`,
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
										<div className='bg-green-600 text-white px-2 py-1 rounded text-xs md:text-sm text-center min-w-[60px]'>
											{formatPlayerName(player.name)}
										</div>
										<div className='text-white font-bold text-xs md:text-sm mt-1'>{player.ftp}</div>
									</div>
								</div>
							);
						})}
					</>
				)}
			</div>

			{/* Player Detail Modal */}
			{showModal && selectedPlayer && playerDetails && (
				<PlayerDetailModal
					playerName={selectedPlayer}
					matchDetails={playerDetails}
					onClose={() => {
						setShowModal(false);
						setSelectedPlayer(null);
						setPlayerDetails(null);
					}}
				/>
			)}
		</div>
	);
}
