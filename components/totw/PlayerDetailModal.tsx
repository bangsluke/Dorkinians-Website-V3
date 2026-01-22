"use client";

import { MatchDetail } from "@/types";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { createPortal } from "react-dom";
import ModalWrapper from "@/components/modals/ModalWrapper";

interface FTPBreakdown {
	stat: string;
	value: number | string;
	points: number;
	show: boolean;
}

interface MatchDetailWithSummary extends MatchDetail {
	matchSummary?: string | null;
	opposition?: string | null;
	result?: string | null;
}

interface AggregatedPlayerStats {
	playerName: string;
	season: string;
	aggregatedStats: {
		appearances: number;
		goals: number;
		assists: number;
		cleanSheets: number;
		conceded: number;
		saves: number;
		yellowCards: number;
		redCards: number;
		ownGoals: number;
		penaltiesScored: number;
		penaltiesMissed: number;
		penaltiesConceded: number;
		penaltiesSaved: number;
		mom: number;
		totalMinutes: number;
		playerClass: string;
	};
	ftpBreakdown: FTPBreakdown[];
	totalFTP: number;
	totwAppearances?: number;
}

interface PlayerDetailModalProps {
	playerName: string;
	matchDetails?: MatchDetailWithSummary[] | null;
	aggregatedStats?: AggregatedPlayerStats | null;
	totwAppearances?: number;
	onClose: () => void;
}

export default function PlayerDetailModal({ playerName, matchDetails, aggregatedStats, totwAppearances, onClose }: PlayerDetailModalProps) {
	// Calculate FTP breakdown for a single match
	const calculateFTPBreakdown = (match: MatchDetailWithSummary): FTPBreakdown[] => {
		const playerClass = match.class;
		const breakdown: FTPBreakdown[] = [];

		// Minutes played (always show if player appeared)
		const minutes = match.min || 0;
		const minutesPoints = minutes >= 60 ? 2 : minutes > 0 ? 1 : 0;
		breakdown.push({
			stat: "Minutes played",
			value: minutes,
			points: minutesPoints,
			show: true, // Always show minutes
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
			// Show clean sheet
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
			// Show goals conceded (only for GK and DEF)
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
	};

	// Calculate total FTP for all matches
	const calculateTotalFTP = (): number => {
		if (!matchDetails || matchDetails.length === 0) {
			return 0;
		}
		return matchDetails.reduce((total, match) => {
			const breakdown = calculateFTPBreakdown(match);
			const matchTotal = breakdown.reduce((sum, stat) => sum + stat.points, 0);
			return total + matchTotal;
		}, 0);
	};

	// Get match summary split into team/opposition and result/score
	const getMatchSummary = (match: MatchDetailWithSummary): { teamOpposition: string; resultScore: string } => {
		const team = match.team || "";
		const opposition = match.opposition || "";
		const result = match.result || "";
		const score = match.matchSummary || "";

		if (team && opposition && result && score) {
			// Check if score already starts with any result code (W, D, L) to avoid duplication
			// If so, just use the score as-is
			const scoreTrimmed = score.trim();
			let resultScoreText = "";
			if (scoreTrimmed.match(/^(W|D|L)\s/)) {
				resultScoreText = scoreTrimmed;
			} else {
				// Otherwise, combine result and score
				resultScoreText = `${result} ${scoreTrimmed}`;
			}
			return {
				teamOpposition: `${team} vs ${opposition}`,
				resultScore: resultScoreText,
			};
		}

		// Fallback to basic summary
		if (match.matchSummary) {
			return {
				teamOpposition: match.matchSummary,
				resultScore: "",
			};
		}
		return {
			teamOpposition: `${match.team} - ${match.date}`,
			resultScore: "",
		};
	};

	const totalFTP = aggregatedStats ? aggregatedStats.totalFTP : calculateTotalFTP();
	const playerAppearances = aggregatedStats 
		? aggregatedStats.aggregatedStats.appearances 
		: (matchDetails ? matchDetails.length : 0);
	const isAggregatedMode = !!aggregatedStats;

	// Handle SSR
	if (typeof window === 'undefined') {
		return null;
	}

	const modalContent = (
		<ModalWrapper
			isOpen={true}
			onClose={onClose}
			backdropClassName="fixed inset-0 bg-black/50 z-[9999]"
			modalClassName="fixed inset-0 h-screen w-screen z-[10000] shadow-xl"
			ariaLabel={`${playerName} player details`}>
			<div 
				className='h-full flex flex-col'
				style={{ backgroundColor: '#0f0f0f' }}>
				{/* Header with Close button */}
				<div className='flex-shrink-0 flex justify-between items-center p-4 border-b border-white/20'>
					<h2 className='text-2xl font-bold text-white uppercase flex-1 text-center'>{playerName}</h2>
					<button
						data-testid="totw-player-modal-close"
						onClick={onClose}
						className='min-w-[44px] min-h-[44px] p-2 rounded-full hover:bg-white/20 transition-colors ml-4 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
						aria-label={`Close ${playerName} player details modal`}>
						<XMarkIcon className='w-6 h-6 text-white' />
					</button>
				</div>

						{/* Scrollable content */}
						<div 
							className='flex-1 overflow-y-auto min-h-0 player-detail-scrollable px-6 pt-4' 
							style={{ 
								WebkitOverflowScrolling: 'touch',
								paddingTop: '1rem',
								paddingBottom: '1rem'
							}}
						>
							{/* Season Context for Aggregated Stats */}
							{isAggregatedMode && aggregatedStats && (
								<div className='text-center mb-4'>
									<p className='text-white text-sm md:text-base font-semibold'>
										{aggregatedStats.season === "All Time" ? "All Time" : `${aggregatedStats.season} Season`}
									</p>
								</div>
							)}

							{/* TOTW Appearances - Only show for match-by-match mode, not aggregated */}
							{!isAggregatedMode && totwAppearances !== undefined && (
								<div className='text-center mb-4'>
									<p className='text-white text-xs md:text-sm'>
										Number of TOTW appearances: <span className='font-bold'>{totwAppearances}</span>
									</p>
								</div>
							)}

							{/* Player Appearances */}
							{playerAppearances > 0 && (
								<div className='text-center mb-4'>
									<p className='text-white text-xs md:text-sm'>
										Player Appearances: <span className='font-bold'>{playerAppearances}</span>
									</p>
								</div>
							)}

							{/* Aggregated Stats Display */}
							{isAggregatedMode && aggregatedStats ? (
								<div className='mb-6'>
									{/* Statistics Table */}
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
												{aggregatedStats.ftpBreakdown
													.filter((stat) => {
														return stat.show && stat.stat !== "Penalties Conceded";
													})
													.map((stat, index) => {
														// Format minutes played value with comma separator
														const displayValue = stat.stat === "Minutes played" && typeof stat.value === "number"
															? stat.value.toLocaleString()
															: stat.value;
														return (
															<tr key={index} className='border-b border-green-500'>
																<td className='py-2 px-2 text-xs md:text-sm'>{stat.stat}</td>
																<td className='text-center py-2 px-2'>{displayValue}</td>
																<td className='text-center py-2 px-2'>{stat.points}</td>
															</tr>
														);
													})}
											</tbody>
										</table>
									</div>
								</div>
							) : matchDetails && matchDetails.length > 0 ? (
								/* Match Details - Fixture by Fixture */
								matchDetails.map((match, matchIndex) => {
									const breakdown = calculateFTPBreakdown(match);
									const matchTotal = breakdown.reduce((sum, stat) => sum + stat.points, 0);
									const visibleStats = breakdown.filter((stat) => stat.show);
									const matchSummary = getMatchSummary(match);

									return (
										<div key={matchIndex}>
											{/* White line break between fixtures (except for first fixture) */}
											{matchIndex > 0 && (
												<div className='border-t border-white my-6'></div>
											)}
											
											<div className={matchIndex > 0 ? 'mt-6' : 'mb-6'}>
												{/* Match Summary - Split into two lines */}
												<div className='text-center mb-3'>
													<p className='text-white text-xs md:text-sm font-normal'>{matchSummary.teamOpposition}</p>
													{matchSummary.resultScore && (
														<p className='text-white text-sm md:text-base font-semibold mt-1'>{matchSummary.resultScore}</p>
													)}
												</div>

												{/* Statistics Table */}
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
															{visibleStats.map((stat, index) => (
																<tr key={index} className='border-b border-green-500'>
																	<td className='py-2 px-2 text-xs md:text-sm'>{stat.stat}</td>
																	<td className='text-center py-2 px-2'>{stat.value}</td>
																	<td className='text-center py-2 px-2'>{stat.points}</td>
																</tr>
															))}
															{matchDetails.length > 1 && (
																<tr className='border-t-2 border-dorkinians-yellow font-bold'>
																	<td className='py-2 px-2 text-xs md:text-sm'>Match Total</td>
																	<td className='text-center py-2 px-2'></td>
																	<td className='text-center py-2 px-2'>{matchTotal}</td>
																</tr>
															)}
														</tbody>
													</table>
												</div>
											</div>
										</div>
									);
								})
							) : (
								<div className='text-center text-gray-400 py-8'>
									No match details available
								</div>
							)}

							{/* Total Points */}
							{(isAggregatedMode || (matchDetails && matchDetails.length > 0)) && (
								<div className='mt-4 pt-4 pb-4 border-t-2 border-white'>
									<table className='w-full text-white'>
										<tbody>
											<tr className='font-bold text-lg'>
												<td className='py-2 px-2'>Total Points</td>
												<td className='text-center py-2 px-2'></td>
												<td className='text-center py-2 px-2'>{totalFTP}</td>
											</tr>
										</tbody>
									</table>
								</div>
							)}
						</div>

				{/* Close Button at Bottom */}
				<div className='flex-shrink-0 flex justify-center p-4 border-t border-white/20'>
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

