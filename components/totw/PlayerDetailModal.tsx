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
}

interface PlayerDetailModalProps {
	playerName: string;
	matchDetails: MatchDetailWithSummary[];
	onClose: () => void;
}

export default function PlayerDetailModal({ playerName, matchDetails, onClose }: PlayerDetailModalProps) {
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

	// Get match summary text (e.g., "Dorkinians 1st XI 3-2 Honourable Artillery Company First")
	const getMatchSummary = (match: MatchDetailWithSummary): string => {
		if (match.matchSummary) {
			return match.matchSummary;
		}
		// Fallback to basic summary
		return `${match.team} - ${match.date}`;
	};

	const totalFTP = calculateTotalFTP();
	const playerAppearances = matchDetails.length;

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4' onClick={onClose}>
			<div
				className='bg-green-600 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto'
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className='flex justify-between items-center mb-4'>
					<h2 className='text-2xl font-bold text-white uppercase'>{playerName}</h2>
					<button onClick={onClose} className='text-white hover:text-gray-200'>
						<XMarkIcon className='h-6 w-6' />
					</button>
				</div>

				{/* Player Appearances */}
				<div className='text-center mb-4'>
					<p className='text-white'>
						Player Appearances: <span className='font-bold'>{playerAppearances}</span>
					</p>
				</div>

				{/* Match Details */}
				{matchDetails.map((match, matchIndex) => {
					const breakdown = calculateFTPBreakdown(match);
					const matchTotal = breakdown.reduce((sum, stat) => sum + stat.points, 0);
					const visibleStats = breakdown.filter((stat) => stat.show);

					return (
						<div key={matchIndex} className='mb-6 last:mb-0'>
							{/* Match Summary */}
							<p className='text-white text-center mb-3 font-semibold'>{getMatchSummary(match)}</p>

							{/* Statistics Table */}
							<div className='overflow-x-auto'>
								<table className='w-full text-white'>
									<thead>
										<tr className='border-b-2 border-dorkinians-yellow'>
											<th className='text-left py-2 px-2'>Statistics</th>
											<th className='text-center py-2 px-2'>Value</th>
											<th className='text-center py-2 px-2'>Points</th>
										</tr>
									</thead>
									<tbody>
										{visibleStats.map((stat, index) => (
											<tr key={index} className='border-b border-green-500'>
												<td className='py-2 px-2'>{stat.stat}</td>
												<td className='text-center py-2 px-2'>{stat.value}</td>
												<td className='text-center py-2 px-2'>{stat.points}</td>
											</tr>
										))}
										{matchDetails.length > 1 && (
											<tr className='border-t-2 border-dorkinians-yellow font-bold'>
												<td className='py-2 px-2'>Match Total</td>
												<td className='text-center py-2 px-2'></td>
												<td className='text-center py-2 px-2'>{matchTotal}</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</div>
					);
				})}

				{/* Total Points */}
				<div className='mt-4 pt-4 border-t-2 border-dorkinians-yellow'>
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
		</div>
	);
}

