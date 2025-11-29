"use client";

import { useState, useEffect } from "react";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";

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
	const [closestToMilestone, setClosestToMilestone] = useState<MilestoneEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedFilter, setSelectedFilter] = useState<string>("Show all");

	useEffect(() => {
		const fetchMilestones = async () => {
			try {
				const response = await fetch("/api/milestones");
				if (response.ok) {
					const data = await response.json();
					setAchieved(data.achieved || []);
					setNearing(data.nearing || []);
					setClosestToMilestone(data.closestToMilestone || []);
					
					// Log closest players to milestones
					if (data.closestToMilestone && data.closestToMilestone.length > 0) {
						console.log("Players closest to milestones (even outside window):", data.closestToMilestone);
					}
					
					// Debug logging for MoMs achieved milestones
					const allAchieved = data.achieved || [];
					const momsAchieved = allAchieved.filter((e: MilestoneEntry) => e.statType === "MoMs");
					console.log("=== MoMs Achieved Milestones Debug ===");
					console.log("Total achieved entries:", allAchieved.length);
					console.log("MoMs achieved entries:", momsAchieved.length);
					if (momsAchieved.length > 0) {
						console.log("MoMs Achieved milestones:", momsAchieved.map((e: MilestoneEntry) => ({
							player: e.playerName,
							milestone: e.milestone,
							value: e.currentValue,
							distance: e.distanceFromMilestone,
							mostRecentMatchDate: e.mostRecentMatchDate
						})));
					} else {
						console.log("No MoMs achieved milestones found in API response");
						// Check if there are any MoMs entries in the raw achieved data before filtering
						console.log("All achieved entries by stat type:", {
							MoMs: allAchieved.filter((e: MilestoneEntry) => e.statType === "MoMs").length,
							Goals: allAchieved.filter((e: MilestoneEntry) => e.statType === "Goals").length,
							Assists: allAchieved.filter((e: MilestoneEntry) => e.statType === "Assists").length,
							Apps: allAchieved.filter((e: MilestoneEntry) => e.statType === "Apps").length
						});
					}
					
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

	// Filter milestones based on selected filter
	// "Show all": top 5 globally (already sorted by milestone, then proximity)
	// Single stat type: top 5 for that stat type
	const filteredAchieved = selectedFilter === "Show all" 
		? achieved.slice(0, 5)
		: achieved.filter(entry => entry.statType === selectedFilter).slice(0, 5);
	
	const filteredNearing = selectedFilter === "Show all" 
		? nearing.slice(0, 5)
		: nearing.filter(entry => entry.statType === selectedFilter).slice(0, 5);

	return (
		<div 
			className='p-6 overflow-y-auto'
			style={{ WebkitOverflowScrolling: 'touch' }}>
			<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-4 text-center'>Club Information</h2>
			<p className='text-sm md:text-base text-gray-300 text-center mb-8'>General club details, history, and background information will be displayed here</p>

			{/* Milestones Section */}
			<div className='mb-8'>
				<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-4'>Milestones</h3>
				
				{/* Filter Dropdown */}
				<div className='mb-4'>
					<Listbox value={selectedFilter} onChange={setSelectedFilter}>
						<div className='relative w-full max-w-xs'>
							<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-4 pr-10 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-sm md:text-base'>
								<span className='block truncate text-white'>
									{selectedFilter}
								</span>
								<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
									<ChevronUpDownIcon className='h-5 w-5 text-yellow-300' aria-hidden='true' />
								</span>
							</Listbox.Button>
							<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-sm md:text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
								{["Show all", "Apps", "MoMs", "Goals", "Assists"].map((option) => (
									<Listbox.Option
										key={option}
										className={({ active }) =>
											`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
										}
										value={option}>
										{({ selected }) => (
											<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
												{option}
											</span>
										)}
									</Listbox.Option>
								))}
							</Listbox.Options>
						</div>
					</Listbox>
				</div>

				{/* Milestones Achieved Section */}
				<div className='mb-8'>
					<h4 className='text-base md:text-lg font-bold text-white mb-4'>Milestones Achieved</h4>
				{loading ? (
					<div className='flex justify-center py-4'>
						<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300'></div>
					</div>
				) : filteredAchieved.length > 0 ? (
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
								{filteredAchieved.map((entry, index) => {
									const isLastRow = index === filteredAchieved.length - 1;
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
					<h4 className='text-base md:text-lg font-bold text-white mb-4'>Nearing Milestones</h4>
				{loading ? (
					<div className='flex justify-center py-4'>
						<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300'></div>
					</div>
				) : filteredNearing.length > 0 ? (
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
								{filteredNearing.map((entry, index) => {
									const isLastRow = index === filteredNearing.length - 1;
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
		</div>
	);
}
