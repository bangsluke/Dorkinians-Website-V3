"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigationStore, type PlayerData } from "@/lib/stores/navigation";
import { PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";
import PenOnPaperIcon from "@/components/icons/PenOnPaperIcon";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/20/solid";
import FilterPills from "@/components/filters/FilterPills";
import { statObject, statsPageConfig } from "@/config/config";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { createPortal } from "react-dom";
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from "@/lib/utils/pwaDebug";

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
	player2Data 
}: { 
	statKey: string; 
	stat: any; 
	player1Data: PlayerData | null; 
	player2Data: PlayerData | null;
}) {
	const [showTooltip, setShowTooltip] = useState(false);
	const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; placement: 'above' | 'below' } | null>(null);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const rowRef = useRef<HTMLDivElement>(null);
	const tooltipRef = useRef<HTMLDivElement | null>(null);
	const isInView = useInView(rowRef, { once: true, margin: "-100px" });

	const player1Value = getStatValue(player1Data, statKey);
	const player2Value = getStatValue(player2Data, statKey);
	
	const statHigherBetter = stat.statHigherBetterBoolean;
	const maxValue = Math.max(player1Value, player2Value, 1);
	
	let player1IsWinner = false;
	let player2IsWinner = false;
	
	if (statHigherBetter) {
		player1IsWinner = player1Value > player2Value;
		player2IsWinner = player2Value > player1Value;
	} else {
		player1IsWinner = player1Value < player2Value;
		player2IsWinner = player2Value < player1Value;
	}
	
	const player1Width = maxValue > 0 ? (player1Value / maxValue) * 100 : 0;
	const player2Width = maxValue > 0 ? (player2Value / maxValue) * 100 : 0;

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

	const player1Formatted = formatStatValue(player1Value, stat.statFormat, stat.numberDecimalPlaces, (stat as any).statUnit);
	const player2Formatted = formatStatValue(player2Value, stat.statFormat, stat.numberDecimalPlaces, (stat as any).statUnit);

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
							{player1Width > 5 && (
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
							{player2Width > 5 && (
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
					<div className='text-xs text-white/80'>{stat.description}</div>
				</div>,
				document.body
			)}
		</>
	);
}

export default function Comparison() {
	const { selectedPlayer, enterEditMode, setMainPage, playerFilters, filterData, currentStatsSubPage, cachedPlayerData } = useNavigationStore();
	
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

	const player1Data: PlayerData | null = cachedPlayerData?.playerData || null;

	const statsToDisplay = useMemo(() => {
		return [...(statsPageConfig["player-stats"]?.statsToDisplay || [])];
	}, []);

	const filteredStatEntries = useMemo(() => {
		return Object.entries(statObject).filter(([key]) => statsToDisplay.includes(key as keyof typeof statObject));
	}, [statsToDisplay]);

	useEffect(() => {
		const fetchAllPlayers = async () => {
			if (playersLoaded) return;

			setIsLoadingPlayers(true);
			try {
				const response = await fetch("/api/players");
				if (response.ok) {
					const data = await response.json();
					setAllPlayers(data.players || []);
					setPlayersLoaded(true);
				} else {
					console.error("Failed to fetch players:", response.statusText);
					setAllPlayers([]);
				}
			} catch (error) {
				console.error("Error fetching players:", error);
				setAllPlayers([]);
			} finally {
				setIsLoadingPlayers(false);
			}
		};

		fetchAllPlayers();
	}, [playersLoaded]);

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

			setIsLoadingSecondPlayer(true);
			try {
				const response = await fetch("/api/player-data-filtered", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						playerName: secondPlayer,
						filters: playerFilters,
					}),
				});

				if (response.ok) {
					const data = await response.json();
					setSecondPlayerData(data.playerData);
				} else {
					console.error("Failed to fetch second player data:", response.statusText);
					setSecondPlayerData(null);
					if (typeof window !== "undefined") {
						safeLocalStorageRemove("comparison-second-player-data");
					}
				}
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
	}, [secondPlayer, playerFilters]);

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
			<div className='flex-shrink-0 p-2 md:p-4' style={{ overflow: 'visible' }}>
				<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-4 text-center'>Player Comparison</h2>
				
				<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
				
				{/* Player Selection */}
				<div className='flex flex-row gap-3 md:gap-4 mb-4'>
					{/* Player 1 (Current Selection) - 40% width */}
					<div className='flex-1' style={{ flexBasis: '40%', minWidth: 0 }}>
						<div className='flex items-center gap-2 mb-2'>
							<span className='text-sm md:text-base text-white/70'>Player 1</span>
							<button
								onClick={handleEditClick}
								className='flex items-center justify-center w-5 h-5 md:w-6 md:h-6 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors flex-shrink-0'
								title='Edit player selection'>
								<PenOnPaperIcon className='h-3 w-3 md:h-4 md:w-4' />
							</button>
						</div>
						<div className='py-3 text-left text-yellow-300 text-sm md:text-base truncate'>
							{selectedPlayer}
						</div>
					</div>

					{/* Player 2 Selection - 60% width */}
					<div className='flex-1' style={{ flexBasis: '60%', minWidth: 0 }}>
						<div className='flex items-center gap-2 mb-2'>
							<span className='text-sm md:text-base text-white/70'>Player 2</span>
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
				) : (
					<div className='space-y-1'>
						{secondPlayer && (
							<div className='text-xs md:text-sm text-white/70 italic mb-4 text-center'>
								Click on any stat row to see an explanation of the stat
							</div>
						)}
						{filteredStatEntries.map(([key, stat]) => (
							<ComparisonStatRow
								key={key}
								statKey={key}
								stat={stat}
								player1Data={player1Data}
								player2Data={secondPlayerData}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
