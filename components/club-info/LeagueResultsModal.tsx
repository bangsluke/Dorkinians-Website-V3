"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { FixturesListSkeleton } from "@/components/skeletons";
import ModalWrapper from "@/components/modals/ModalWrapper";

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
	compType: string;
	oppoOwnGoals: number;
	goalscorers: Goalscorer[];
	momPlayerName: string | null;
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
	const formatGoalscorers = (goalscorers: Goalscorer[] | undefined, oppoOwnGoals: number = 0): string => {
		const parts: string[] = [];
		
		// Add regular goalscorers
		if (goalscorers && Array.isArray(goalscorers) && goalscorers.length > 0) {
			const validGoalscorers = goalscorers.filter((g) => g && g.playerName);
			validGoalscorers.forEach((g) => {
				if (g.playerName) {
					if (g.goals === 1) {
						parts.push(g.playerName);
					} else {
						parts.push(`${g.playerName} (${g.goals})`);
					}
				}
			});
		}
		
		// Add opponent own goal if it exists
		if (oppoOwnGoals > 0) {
			if (oppoOwnGoals === 1) {
				parts.push("Opponent Own Goal");
			} else {
				parts.push(`Opponent Own Goal (${oppoOwnGoals})`);
			}
		}
		
		if (parts.length === 0) {
			return "No goalscorers recorded";
		}
		
		return parts.join(", ");
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

	if (typeof window === 'undefined') {
		return null;
	}

	if (!isOpen) return null;

	const modalContent = (
		<ModalWrapper
			isOpen={isOpen}
			onClose={onClose}
			backdropClassName="fixed inset-0 bg-black/50 z-[9999]"
			modalClassName="fixed inset-0 h-screen w-screen z-[10000] shadow-xl"
			ariaLabel={`${teamDisplayName} - ${formatSeason(season)} league results`}>
			<div 
				className='h-full flex flex-col'
				style={{ backgroundColor: '#0f0f0f' }}>
				{/* Header */}
				<div className='flex items-center justify-between p-4 border-b border-white/20'>
					<h2 className='text-lg font-semibold text-white'>
						{teamDisplayName} - {formatSeason(season)}
					</h2>
					<button
						onClick={onClose}
						className='min-w-[44px] min-h-[44px] p-2 rounded-full hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
						aria-label={`Close ${teamDisplayName} league results modal`}>
						<XMarkIcon className='w-6 h-6 text-white' />
					</button>
				</div>

							{/* Scrollable content */}
							<div 
								className='flex-1 overflow-y-auto p-4 space-y-4'
								style={{ WebkitOverflowScrolling: 'touch' }}>
								{loading && (
									<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
										<FixturesListSkeleton />
									</SkeletonTheme>
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
												className='bg-gray-800/50 rounded-lg p-4 border border-white/10 relative'>
												{/* Labels in top right */}
												<div className='absolute top-4 right-4 flex gap-2 items-center'>
													{fixture.compType && (
														<span
															className={`px-2 py-1 rounded text-xs font-medium ${
																fixture.compType?.toLowerCase() === "league"
																	? "bg-blue-600/30 text-blue-300"
																	: fixture.compType?.toLowerCase() === "cup"
																	? "bg-purple-600/30 text-purple-300"
																	: "bg-green-600/30 text-green-300"
															}`}>
															{fixture.compType}
														</span>
													)}
													<span
														className={`px-2 py-1 rounded text-xs font-medium ${
															fixture.homeOrAway?.toLowerCase() === "home"
																? "bg-dorkinians-yellow/20 text-dorkinians-yellow"
																: "bg-gray-700 text-gray-300"
														}`}>
														{fixture.homeOrAway || "N/A"}
													</span>
												</div>
												
												{/* Date */}
												<div className='mb-2'>
													<span className='text-sm text-gray-400'>{formatDate(fixture.date)}</span>
												</div>
												
												{/* Result and opponent on same line */}
												<div className='text-lg font-semibold text-white mb-2'>
													{formatResult(fixture)} <span className='text-base font-normal'>vs <span className='font-medium'>{fixture.opposition || "Unknown"}</span></span>
												</div>
												
												{/* Goalscorers */}
												{(fixture.goalscorers && Array.isArray(fixture.goalscorers) && fixture.goalscorers.length > 0) || (fixture.oppoOwnGoals && fixture.oppoOwnGoals > 0) ? (
													<div className='text-sm text-gray-300 mt-2'>
														<span className='text-gray-400'>Goalscorers: </span>
														{formatGoalscorers(fixture.goalscorers, fixture.oppoOwnGoals || 0)}
													</div>
												) : null}
												
												{/* MoM */}
												{fixture.momPlayerName && (
													<div className='text-sm text-gray-300 mt-2'>
														<span className='text-gray-400'>MoM: </span>
														{fixture.momPlayerName}
													</div>
												)}
											</div>
										))}
									</div>
								)}
							</div>

				{/* Footer */}
				<div className='flex justify-center p-4 border-t border-white/20'>
					<button
						type='button'
						onClick={onClose}
						className='px-5 py-2 bg-dorkinians-yellow text-black text-sm font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
						Close
					</button>
				</div>
			</div>
		</ModalWrapper>
	);

	return createPortal(modalContent, document.body);
}
