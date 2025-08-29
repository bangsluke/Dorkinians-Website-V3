"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon, PencilIcon } from "@heroicons/react/20/solid";
import { useNavigationStore } from "@/lib/stores/navigation";

// Sample player data - replace with real data when available
const samplePlayers = ["Luke Bangs", "Kieran Mackrell", "Oli Goddard", "Al Thom"];

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
			setLocalSelectedPlayer(selectedPlayer);
			setIsSubmitted(true);
		}
	}, [selectedPlayer, isEditMode]);

	const handlePlayerSelect = (playerName: string) => {
		setLocalSelectedPlayer(playerName);
		setIsSubmitted(true);
		onPlayerSelect(playerName);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && localSelectedPlayer.trim()) {
			handlePlayerSelect(localSelectedPlayer.trim());
		}
	};

	// Filter players based on query
	const filteredPlayers =
		query === "" ? samplePlayers : samplePlayers.filter((player) => player.toLowerCase().includes(query.toLowerCase()));

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
						<Listbox value={localSelectedPlayer} onChange={handlePlayerSelect}>
							<div className='relative'>
								<Listbox.Button className='relative w-full cursor-default dark-dropdown py-3 pl-4 pr-10 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 sm:text-sm'>
									<span className={`block truncate ${localSelectedPlayer ? "text-white" : "text-yellow-300"}`}>
										{localSelectedPlayer || "Choose a player..."}
									</span>
									<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
										<ChevronUpDownIcon className='h-5 w-5 text-yellow-300' aria-hidden='true' />
									</span>
								</Listbox.Button>
								<Listbox.Options className='absolute z-10 mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none sm:text-sm'>
									<div className='px-3 py-2'>
										<input
											type='text'
											placeholder='Type to filter players...'
											value={query}
											onChange={(e) => setQuery(e.target.value)}
											onKeyDown={handleKeyDown}
											enterKeyHint='search'
											className='dark-input w-full text-sm'
										/>
									</div>
									{filteredPlayers.map((player, playerIdx) => (
										<Listbox.Option
											key={playerIdx}
											className={({ active }) =>
												`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
											}
											value={player}>
											{({ selected }) => (
												<>
													<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>{player}</span>
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
				<div className='flex items-center justify-center space-x-3'>
					<h2 className='text-xl font-semibold text-white'>{selectedPlayer}</h2>
					<button
						onClick={onEditClick}
						className='p-2 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors'
						title='Edit player selection'>
						<PencilIcon className='h-5 w-5' />
					</button>
					<button
						onClick={onClearPlayer}
						className='p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-full transition-colors'
						title='Clear player selection'>
						<svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
						</svg>
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
					<Listbox value={localSelectedPlayer} onChange={handlePlayerSelect}>
						<div className='relative'>
							<Listbox.Button className='relative w-full cursor-default dark-dropdown py-3 pl-4 pr-10 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 sm:text-sm'>
								<span className={`block truncate ${localSelectedPlayer ? "text-white" : "text-yellow-300"}`}>
									{localSelectedPlayer || "Choose a player..."}
								</span>
								<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
									<ChevronUpDownIcon className='h-5 w-5 text-yellow-300' aria-hidden='true' />
								</span>
							</Listbox.Button>
							<Listbox.Options className='absolute z-10 mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none sm:text-sm'>
								<div className='px-3 py-2'>
									<input
										type='text'
										placeholder='Type to filter players...'
										value={query}
										onChange={(e) => setQuery(e.target.value)}
										onKeyDown={handleKeyDown}
										enterKeyHint='search'
										className='dark-input w-full text-sm'
									/>
								</div>
								{filteredPlayers.map((player, playerIdx) => (
									<Listbox.Option
										key={playerIdx}
										className={({ active }) =>
											`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
										}
										value={player}>
										{({ selected }) => (
											<>
												<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>{player}</span>
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
