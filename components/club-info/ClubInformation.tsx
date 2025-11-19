"use client";

import { useState, useEffect } from "react";

interface MilestoneEntry {
	playerName: string;
	statType: string;
	milestone: number;
	currentValue: number;
	distanceFromMilestone: number;
	mostRecentMatchDate?: string;
}

export default function ClubInformation() {
	const [achieved, setAchieved] = useState<MilestoneEntry[]>([]);
	const [nearing, setNearing] = useState<MilestoneEntry[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchMilestones = async () => {
			try {
				const response = await fetch("/api/milestones");
				if (response.ok) {
					const data = await response.json();
					setAchieved(data.achieved || []);
					setNearing(data.nearing || []);
				} else {
					console.error("Failed to fetch milestones");
				}
			} catch (error) {
				console.error("Error fetching milestones:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchMilestones();
	}, []);

	return (
		<div className='p-6 overflow-y-auto'>
			<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-4 text-center'>Club Information</h2>
			<p className='text-sm md:text-base text-gray-300 text-center mb-8'>General club details, history, and background information will be displayed here</p>

			{/* Milestones Achieved Section */}
			<div className='mb-8'>
				<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-4'>Milestones Achieved</h3>
				{loading ? (
					<div className='flex justify-center py-4'>
						<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300'></div>
					</div>
				) : achieved.length > 0 ? (
					<div className='overflow-x-auto overflow-y-auto max-h-96'>
						<table className='w-full text-white'>
							<thead>
								<tr className='border-b-2 border-dorkinians-yellow'>
									<th className='text-left py-2 px-2 text-xs md:text-sm'>Player Name</th>
									<th className='text-center py-2 px-2 text-xs md:text-sm'>Milestone</th>
									<th className='text-center py-2 px-2 text-xs md:text-sm'>Value</th>
								</tr>
							</thead>
							<tbody>
								{achieved.map((entry, index) => {
									const isLastRow = index === achieved.length - 1;
									return (
										<tr
											key={`${entry.playerName}-${entry.statType}-${entry.milestone}-${index}`}
											className={`hover:bg-gray-800 transition-colors ${isLastRow ? '' : 'border-b border-green-500'}`}
											style={{
												background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))',
											}}
										>
											<td className='py-2 px-2 text-xs md:text-sm'>{entry.playerName}</td>
											<td className='py-2 px-2 text-center text-xs md:text-sm font-bold'>{entry.milestone} {entry.statType}</td>
											<td className='py-2 px-2 text-center text-xs md:text-sm font-bold'>{entry.currentValue} {entry.statType}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				) : (
					<p className='text-sm text-gray-400 text-center py-4'>No recent milestone achievements to display</p>
				)}
			</div>

			{/* Nearing Milestones Section */}
			<div className='mb-8'>
				<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-4'>Nearing Milestones</h3>
				{loading ? (
					<div className='flex justify-center py-4'>
						<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300'></div>
					</div>
				) : nearing.length > 0 ? (
					<div className='overflow-x-auto overflow-y-auto max-h-96'>
						<table className='w-full text-white'>
							<thead>
								<tr className='border-b-2 border-dorkinians-yellow'>
									<th className='text-left py-2 px-2 text-xs md:text-sm'>Player Name</th>
									<th className='text-center py-2 px-2 text-xs md:text-sm'>Milestone</th>
									<th className='text-center py-2 px-2 text-xs md:text-sm'>Value</th>
								</tr>
							</thead>
							<tbody>
								{nearing.map((entry, index) => {
									const isLastRow = index === nearing.length - 1;
									return (
										<tr
											key={`${entry.playerName}-${entry.statType}-${entry.milestone}-${index}`}
											className={`hover:bg-gray-800 transition-colors ${isLastRow ? '' : 'border-b border-green-500'}`}
											style={{
												background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))',
											}}
										>
											<td className='py-2 px-2 text-xs md:text-sm'>{entry.playerName}</td>
											<td className='py-2 px-2 text-center text-xs md:text-sm font-bold'>{entry.milestone} {entry.statType}</td>
											<td className='py-2 px-2 text-center text-xs md:text-sm font-bold'>{entry.currentValue} {entry.statType}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				) : (
					<p className='text-sm text-gray-400 text-center py-4'>No players nearing milestones</p>
				)}
			</div>
		</div>
	);
}
