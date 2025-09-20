"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon, PencilIcon } from "@heroicons/react/20/solid";
import { useNavigationStore } from "@/lib/stores/navigation";

interface Player {
	playerName: string;
	mostPlayedForTeam: string;
}

interface PlayerSelectionProps {
	onPlayerSelect: (playerName: string) => void;
	onEditClick: () => void;
	onClearPlayer: () => void;
	selectedPlayer: string | null;
	isEditMode: boolean;
}

export default function PlayerSelection({ onPlayerSelect, onEditClick, onClearPlayer, selectedPlayer, isEditMode }: PlayerSelectionProps) {
	const [localSelectedPlayer, setLocalSelectedPlayer] = useState("");
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [query, setQuery] = useState("");
	const [allPlayers, setAllPlayers] = useState<Player[]>([]);
	const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
	const [playersLoaded, setPlayersLoaded] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	// Load all players on component mount
	useEffect(() => {
		const fetchAllPlayers = async () => {
			if (playersLoaded) return; // Don't fetch if already loaded

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

	// Client-side filtering function
	const getFilteredPlayers = () => {
		if (query.length < 3) {
			return [];
		}
		return allPlayers.filter((player) => player.playerName && player.playerName.toLowerCase().includes(query.toLowerCase()));
	};

	// Reset local state when entering edit mode
	useEffect(() => {
		if (isEditMode) {
			setLocalSelectedPlayer("");
			setIsSubmitted(false);
			setQuery("");
		}
	}, [isEditMode]);

	// Set local state when player is selected
	useEffect(() => {
		if (selectedPlayer && !isEditMode) {
			console.log("✅ [PlayerSelection] Setting local state for selected player:", selectedPlayer);
			setLocalSelectedPlayer(selectedPlayer);
			setIsSubmitted(true);
		}
	}, [selectedPlayer, isEditMode]);

	const handlePlayerSelect = (player: Player) => {
		const playerName = player.playerName;
		setLocalSelectedPlayer(playerName);
		setIsSubmitted(true);
		onPlayerSelect(playerName);

		// Trigger async data fetching and caching
		// This will be handled by the navigation store's selectPlayer method
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		// Prevent Listbox from handling space key and other text input keys
		if (e.key === " " || e.key.length === 1) {
			e.stopPropagation();
			return;
		}

		// Only handle Enter key for player selection
		if (e.key === "Enter" && localSelectedPlayer.trim()) {
			// Find the player object that matches the selected name
			const selectedPlayerObj = allPlayers.find((p) => p.playerName && p.playerName === localSelectedPlayer.trim());
			if (selectedPlayerObj) {
				handlePlayerSelect(selectedPlayerObj);
			}
		}
	};

	const handleDropdownOpen = () => {
		// Focus the input field when dropdown opens
		setTimeout(() => {
			if (inputRef.current) {
				inputRef.current.focus();
			}
		}, 100);
	};

	// If we're in edit mode, show the selection form
	if (isEditMode) {
		return (
			<motion.div
				key='player-selection-edit'
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -20 }}
				transition={{ duration: 0.5 }}
				className='w-full max-w-md mx-auto'>
				<div className='space-y-4'>
					<div>
						<Listbox
							value={localSelectedPlayer}
							onChange={(playerName) => {
								const player = allPlayers.find((p) => p.playerName && p.playerName === playerName);
								if (player) handlePlayerSelect(player);
							}}>
							<div className='relative'>
								<Listbox.Button
									onClick={handleDropdownOpen}
									className='relative w-full cursor-default dark-dropdown py-3 pl-4 pr-10 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 sm:text-sm'>
									<span className={`block truncate ${localSelectedPlayer ? "text-white" : "text-yellow-300"}`}>
										{localSelectedPlayer || "Choose a player..."}
									</span>
									<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
										<ChevronUpDownIcon className='h-5 w-5 text-yellow-300' aria-hidden='true' />
									</span>
								</Listbox.Button>
								<Listbox.Options
									className='absolute z-10 mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none sm:text-sm'
									onKeyDown={(e) => {
										// Prevent Listbox from handling text input keys
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
											onKeyDown={handleKeyDown}
											onKeyUp={(e) => {
												// Prevent event bubbling for text input keys
												if (e.key === " " || e.key.length === 1) {
													e.stopPropagation();
												}
											}}
											onInput={(e) => {
												// Ensure all input including spaces is properly handled
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
												`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
											}
											value={player.playerName}>
											{({ selected }) => (
												<>
													<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
														{player.playerName} ({player.mostPlayedForTeam || "Unknown"})
													</span>
													{selected ? (
														<span className='absolute inset-y-0 left-0 flex items-center pl-3 text-green-400'>
															<CheckIcon className='h-5 w-5' aria-hidden='true' />
														</span>
													) : null}
												</>
											)}
										</Listbox.Option>
									))}
								</Listbox.Options>
							</div>
						</Listbox>
					</div>
				</div>
			</motion.div>
		);
	}

	// If we have a selected player, show the player name with edit button
	if (selectedPlayer && isSubmitted) {
		return (
			<motion.div
				key='player-name-display'
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className='text-center'>
				<div className='flex items-center justify-center space-x-2 md:space-x-3'>
					<h2 className='text-lg md:text-xl font-semibold text-white'>{selectedPlayer}</h2>
					<button
						onClick={onEditClick}
						className='p-1.5 md:p-2 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors'
						title='Edit player selection'>
						<PencilIcon className='h-4 w-4 md:h-5 md:w-5' />
					</button>
				</div>
			</motion.div>
		);
	}

	// Initial player selection form
	return (
		<motion.div
			key='player-selection-initial'
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -20 }}
			transition={{ duration: 0.5 }}
			className='w-full max-w-md mx-auto'>
			<div className='space-y-4'>
				<div>
					<Listbox
						value={localSelectedPlayer}
						onChange={(playerName) => {
							const player = allPlayers.find((p) => p.playerName && p.playerName === playerName);
							if (player) handlePlayerSelect(player);
						}}>
						<div className='relative'>
							<Listbox.Button className='relative w-full cursor-default dark-dropdown py-3 pl-4 pr-10 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 sm:text-sm'>
								<span className={`block truncate ${localSelectedPlayer ? "text-white" : "text-yellow-300"}`}>
									{localSelectedPlayer || "Choose a player..."}
								</span>
								<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
									<ChevronUpDownIcon className='h-5 w-5 text-yellow-300' aria-hidden='true' />
								</span>
							</Listbox.Button>
							<Listbox.Options
								className='absolute z-10 mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none sm:text-sm'
								onKeyDown={(e) => {
									// Prevent Listbox from handling text input keys
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
										onKeyDown={handleKeyDown}
										onKeyUp={(e) => {
											// Prevent event bubbling for text input keys
											if (e.key === " " || e.key.length === 1) {
												e.stopPropagation();
											}
										}}
										onInput={(e) => {
											// Ensure all input including spaces is properly handled
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
											`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
										}
										value={player.playerName}>
										{({ selected }) => (
											<>
												<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
													{player.playerName} ({player.mostPlayedForTeam})
												</span>
												{selected ? (
													<span className='absolute inset-y-0 left-0 flex items-center pl-3 text-green-400'>
														<CheckIcon className='h-5 w-5' aria-hidden='true' />
													</span>
												) : null}
											</>
										)}
									</Listbox.Option>
								))}
							</Listbox.Options>
						</div>
					</Listbox>
				</div>
			</div>
		</motion.div>
	);
}
