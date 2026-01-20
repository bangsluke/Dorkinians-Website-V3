"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/StateComponents";
import { useToast } from "@/lib/hooks/useToast";

interface SquadPlayersModalProps {
	isOpen: boolean;
	onClose: () => void;
	teamKey: string;
	teamDisplayName: string;
	season: string;
	division: string;
}

interface PlayerWithAppearances {
	playerName: string;
	appearances: number;
}

export default function SquadPlayersModal({
	isOpen,
	onClose,
	teamKey,
	teamDisplayName,
	season,
	division,
}: SquadPlayersModalProps) {
	const [players, setPlayers] = useState<PlayerWithAppearances[]>([]);
	const [captains, setCaptains] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { showError } = useToast();

	// Fetch players and captains when modal opens
	useEffect(() => {
		if (!isOpen || !teamKey || !season) return;

		const fetchData = async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await fetch(
					`/api/team-season-players?team=${encodeURIComponent(teamKey)}&season=${encodeURIComponent(season)}`
				);
				if (response.ok) {
					const data = await response.json();
					setPlayers(data.players || []);
					setCaptains(data.captains || []);
				} else {
					const errorData = await response.json();
					setError(errorData.error || "Failed to fetch squad data");
				}
			} catch (err) {
				console.error("Error fetching squad data:", err);
				setError("Error loading squad data");
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [isOpen, teamKey, season]);

	// Format season for display (2019-20 -> 2019/20)
	const formatSeason = (season: string) => {
		return season.replace("-", "/");
	};

	const handleClose = () => {
		onClose();
	};

	// Handle ESC key
	useEffect(() => {
		if (!isOpen) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				handleClose();
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => {
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isOpen]);

	if (typeof window === 'undefined') {
		return null;
	}

	// Group players by appearance count
	const playersByAppearances = players.reduce((acc, player) => {
		const apps = player.appearances;
		if (!acc[apps]) acc[apps] = [];
		acc[apps].push(player.playerName);
		return acc;
	}, {} as Record<number, string[]>);

	const sortedAppearanceGroups = Object.entries(playersByAppearances)
		.sort(([a], [b]) => Number(b) - Number(a));

	const modalContent = (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						className='fixed inset-0 bg-black/50 z-[9999]'
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={handleClose}
					/>

					{/* Full-screen modal */}
					<motion.div
						className='fixed inset-0 h-screen w-screen z-[10000] shadow-xl'
						style={{ backgroundColor: '#0f0f0f' }}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ type: "spring", stiffness: 300, damping: 30 }}>
						<div className='h-full flex flex-col'>
							{/* Header */}
							<div className='flex items-center justify-between p-4 border-b border-white/20'>
								<div>
									<h2 className='text-lg font-semibold text-white'>
										{teamDisplayName} - {formatSeason(season)}
									</h2>
									{division && (
										<p className='text-sm text-gray-400 mt-1'>{division} Champions</p>
									)}
								</div>
								<button
									onClick={handleClose}
									className='p-2 text-white/60 hover:text-white hover:bg-white/20 rounded-full transition-colors'
									aria-label={`Close ${teamDisplayName} squad players modal`}>
									<XMarkIcon className='w-5 h-5' />
								</button>
							</div>

							{/* Scrollable content */}
							<div 
								className='flex-1 overflow-y-auto p-4 space-y-6'
								style={{ WebkitOverflowScrolling: 'touch' }}>
								{loading && (
									<LoadingState message="Loading squad data..." variant="spinner" />
								)}

								{error && (
									<ErrorState 
										message="Failed to load squad data" 
										error={error}
										onShowToast={showError}
										showToast={true}
										onRetry={() => {
											setError(null);
											// Trigger re-fetch by toggling isOpen or using a ref
										}}
									/>
								)}

								{!loading && !error && players.length === 0 && (
									<EmptyState 
										title="No squad data available"
										message={`No player data found for ${teamDisplayName} in ${formatSeason(season)}`}
									/>
								)}

								{!loading && !error && players.length > 0 && (
									<>
										{/* Captains Section */}
										{captains.length > 0 && (
											<div className='bg-gray-800/50 rounded-lg p-4 border border-white/10'>
												<h3 className='text-base font-semibold text-dorkinians-yellow mb-2'>Captains</h3>
												<div className='text-sm text-gray-300'>{captains.join(', ')}</div>
											</div>
										)}

										{/* Squad Players Section */}
										<div className='bg-gray-800/50 rounded-lg p-4 border border-white/10'>
											<h3 className='text-base font-semibold text-dorkinians-yellow mb-4'>Squad Players</h3>
											{players.length > 0 ? (
												<div className='space-y-3'>
													{sortedAppearanceGroups.map(([appsStr, names]) => {
														const apps = Number(appsStr);
														return (
															<div key={appsStr} className='text-sm'>
																<span className='text-gray-500 font-semibold'>{apps} {apps === 1 ? 'app' : 'apps'}:</span>{' '}
																<span className='text-gray-300'>{names.join(', ')}</span>
															</div>
														);
													})}
												</div>
											) : null}
										</div>
									</>
								)}
							</div>

							{/* Footer */}
							<div className='flex justify-center p-4 border-t border-white/20'>
								<button
									type='button'
									onClick={handleClose}
									className='px-5 py-2 bg-dorkinians-yellow text-black text-sm font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors'>
									Close
								</button>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);

	return createPortal(modalContent, document.body);
}
