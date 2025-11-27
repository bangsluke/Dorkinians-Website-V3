"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface LeagueResultsModalProps {
	isOpen: boolean;
	onClose: () => void;
	teamKey: string;
	teamDisplayName: string;
	season: string;
}

interface Goalscorer {
	playerName: string;
	goals: number;
}

interface Fixture {
	date: string;
	opposition: string;
	homeOrAway: string;
	result: string;
	homeScore: number;
	awayScore: number;
	dorkiniansGoals: number;
	conceded: number;
	goalscorers: Goalscorer[];
}

export default function LeagueResultsModal({
	isOpen,
	onClose,
	teamKey,
	teamDisplayName,
	season,
}: LeagueResultsModalProps) {
	const [fixtures, setFixtures] = useState<Fixture[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Fetch fixtures when modal opens
	useEffect(() => {
		if (!isOpen || !teamKey || !season) return;

		const fetchFixtures = async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await fetch(
					`/api/league-fixtures?team=${encodeURIComponent(teamKey)}&season=${encodeURIComponent(season)}`
				);
				if (response.ok) {
					const data = await response.json();
					setFixtures(data.fixtures || []);
				} else {
					const errorData = await response.json();
					setError(errorData.error || "Failed to fetch fixtures");
				}
			} catch (err) {
				console.error("Error fetching fixtures:", err);
				setError("Error loading fixtures");
			} finally {
				setLoading(false);
			}
		};

		fetchFixtures();
	}, [isOpen, teamKey, season]);

	// Format season for display (2019-20 -> 2019/20)
	const formatSeason = (season: string) => {
		return season.replace("-", "/");
	};

	// Format date for display
	const formatDate = (dateString: string) => {
		if (!dateString) return "";
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
		} catch {
			return dateString;
		}
	};

	// Format goalscorers for display
	const formatGoalscorers = (goalscorers: Goalscorer[]): string => {
		if (!goalscorers || goalscorers.length === 0) return "No goalscorers recorded";
		return goalscorers
			.map((g) => {
				if (g.goals === 1) {
					return g.playerName;
				}
				return `${g.playerName} (${g.goals})`;
			})
			.join(", ");
	};

	// Format result for display
	const formatResult = (fixture: Fixture): string => {
		if (fixture.result) {
			return `${fixture.result} ${fixture.dorkiniansGoals}-${fixture.conceded}`;
		}
		if (fixture.homeScore !== null && fixture.awayScore !== null) {
			const isHome = fixture.homeOrAway?.toLowerCase() === "home";
			if (isHome) {
				return `${fixture.homeScore}-${fixture.awayScore}`;
			}
			return `${fixture.awayScore}-${fixture.homeScore}`;
		}
		return "TBD";
	};

	const handleClose = () => {
		onClose();
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						className='fixed inset-0 bg-black/50 z-40'
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={handleClose}
					/>

					{/* Full-screen modal */}
					<motion.div
						className='fixed inset-0 h-full w-full z-50 shadow-xl'
						style={{ backgroundColor: '#0f0f0f' }}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ type: "spring", stiffness: 300, damping: 30 }}>
						<div className='h-full flex flex-col'>
							{/* Header */}
							<div className='flex items-center justify-between p-4 border-b border-white/20'>
								<h2 className='text-lg font-semibold text-white'>
									{teamDisplayName} - {formatSeason(season)}
								</h2>
								<button
									onClick={handleClose}
									className='p-2 text-white/60 hover:text-white hover:bg-white/20 rounded-full transition-colors'>
									<XMarkIcon className='w-5 h-5' />
								</button>
							</div>

							{/* Scrollable content */}
							<div className='flex-1 overflow-y-auto p-4 space-y-4'>
								{loading && (
									<div className='flex justify-center py-8'>
										<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-dorkinians-yellow'></div>
									</div>
								)}

								{error && (
									<div className='p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-200 text-center'>
										{error}
									</div>
								)}

								{!loading && !error && fixtures.length === 0 && (
									<div className='text-center text-gray-400 py-8'>
										No league fixtures found for this team and season
									</div>
								)}

								{!loading && !error && fixtures.length > 0 && (
									<div className='space-y-4'>
										{fixtures.map((fixture, index) => (
											<div
												key={index}
												className='bg-gray-800/50 rounded-lg p-4 border border-white/10'>
												<div className='flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2'>
													<div className='flex items-center gap-3'>
														<span className='text-sm text-gray-400'>{formatDate(fixture.date)}</span>
														<span
															className={`px-2 py-1 rounded text-xs font-medium ${
																fixture.homeOrAway?.toLowerCase() === "home"
																	? "bg-dorkinians-yellow/20 text-dorkinians-yellow"
																	: "bg-gray-700 text-gray-300"
															}`}>
															{fixture.homeOrAway || "N/A"}
														</span>
													</div>
													<div className='text-lg font-semibold text-white'>
														{formatResult(fixture)}
													</div>
												</div>
												<div className='text-base text-white mb-2'>
													vs <span className='font-medium'>{fixture.opposition || "Unknown"}</span>
												</div>
												{fixture.goalscorers && fixture.goalscorers.length > 0 && (
													<div className='text-sm text-gray-300 mt-2'>
														<span className='text-gray-400'>Goalscorers: </span>
														{formatGoalscorers(fixture.goalscorers)}
													</div>
												)}
											</div>
										))}
									</div>
								)}
							</div>

							{/* Footer */}
							<div className='border-t border-white/20 p-4'>
								<button
									type='button'
									onClick={handleClose}
									className='w-full px-4 py-2 text-sm font-medium text-white/80 bg-white/10 hover:bg-white/20 rounded-md transition-colors'>
									Close
								</button>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}

