"use client";

import { MatchDetail } from "@/types";
import { XMarkIcon } from "@heroicons/react/24/outline";

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

interface PlayerDetailModalProps {
	playerName: string;
	matchDetails: MatchDetailWithSummary[];
	totwAppearances?: number;
	onClose: () => void;
}

export default function PlayerDetailModal({ playerName, matchDetails, totwAppearances, onClose }: PlayerDetailModalProps) {
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

	const totalFTP = calculateTotalFTP();
	const playerAppearances = matchDetails.length;

	return (
		<div className='fixed inset-0 z-50' style={{ backgroundColor: 'rgba(15, 15, 15, 0.5)' }} onClick={onClose}>
			<div
				className='fixed inset-0 flex flex-col'
				style={{ backgroundColor: '#0f0f0f' }}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header with Close button */}
				<div className='flex-shrink-0 flex justify-between items-center p-4 border-b border-white/20'>
					<h2 className='text-2xl font-bold text-white uppercase flex-1 text-center'>{playerName}</h2>
					<button onClick={onClose} className='text-white hover:text-gray-200 ml-4 flex-shrink-0'>
						<XMarkIcon className='h-6 w-6' />
					</button>
				</div>

				{/* Scrollable content */}
				<div 
					className='flex-1 overflow-y-auto min-h-0 player-detail-scrollable px-6' 
					style={{ 
						WebkitOverflowScrolling: 'touch',
						paddingTop: '1rem',
						paddingBottom: '1rem'
					}}
				>

					{/* TOTW Appearances */}
					{totwAppearances !== undefined && (
						<div className='text-center mb-4'>
							<p className='text-white text-xs md:text-sm'>
								Number of TOTW appearances: <span className='font-bold'>{totwAppearances}</span>
							</p>
						</div>
					)}

					{/* Player Appearances - Only show if > 1 */}
					{playerAppearances > 1 && (
						<div className='text-center mb-4'>
							<p className='text-white text-xs md:text-sm'>
								Player Appearances: <span className='font-bold'>{playerAppearances}</span>
							</p>
						</div>
					)}

					{/* Match Details */}
					{matchDetails.map((match, matchIndex) => {
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
					})}

					{/* Total Points */}
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
				</div>

				{/* Close Button at Bottom */}
				<div className='flex-shrink-0 flex justify-center p-4 border-t border-white/20'>
					<button
						onClick={onClose}
						className='px-8 py-3 bg-dorkinians-yellow text-black font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors'>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}

