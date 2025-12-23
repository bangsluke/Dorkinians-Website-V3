"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { MilestonesTableSkeleton } from "@/components/skeletons";
import { appConfig } from "@/config/config";
import SquadPlayersModal from "./SquadPlayersModal";

interface MilestoneEntry {
	playerName: string;
	statType: string;
	milestone: number;
	currentValue: number;
	distanceFromMilestone: number;
	mostRecentMatchDate?: string;
}

interface ClubAchievement {
	team: string;
	division: string;
	season: string;
	trophyNumber?: number;
}


// Helper function to convert team key to display format
function formatTeamName(team: string): string {
	const teamMap: { [key: string]: string } = {
		"1s": "1st XI",
		"2s": "2nd XI",
		"3s": "3rd XI",
		"4s": "4th XI",
		"5s": "5th XI",
		"6s": "6th XI",
		"7s": "7th XI",
		"8s": "8th XI",
	};
	return teamMap[team] || team;
}

function AchievementBox({ achievement }: { achievement: ClubAchievement }) {
	const [isModalOpen, setIsModalOpen] = useState(false);

	const teamName = formatTeamName(achievement.team);
	const restOfText = `${achievement.division} Champions ${achievement.season}`;
	const trophyPath = `/stat-icons/trophies/Trophy${achievement.trophyNumber || 1}.svg`;

	const handleClick = () => {
		setIsModalOpen(true);
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
	};

	return (
		<>
			<div className='relative p-4 min-w-[140px] flex flex-col items-center'>
				{/* Trophy Icon */}
				<div className='mb-3 flex-shrink-0'>
					<Image
						src={trophyPath}
						alt="Trophy"
						width={150}
						height={150}
						className='w-[120px] h-[120px] md:w-[160px] md:h-[160px] object-contain'
					/>
				</div>
				{/* Achievement Text */}
				<div className='text-center'>
					<p className='text-white text-sm md:text-base leading-tight'>
						<span className='block font-bold'>{teamName}</span>
						<span className='block'>{restOfText}</span>
						<button
							onClick={handleClick}
							className='mt-2 text-xs text-dorkinians-yellow underline decoration-dorkinians-yellow decoration-2 hover:text-yellow-400 transition-colors cursor-pointer'
						>
							Show squad
						</button>
					</p>
				</div>
			</div>
			<SquadPlayersModal
				isOpen={isModalOpen}
				onClose={handleCloseModal}
				teamKey={achievement.team}
				teamDisplayName={teamName}
				season={achievement.season}
				division={achievement.division}
			/>
		</>
	);
}

export default function ClubInformation() {
	const [achieved, setAchieved] = useState<MilestoneEntry[]>([]);
	const [nearing, setNearing] = useState<MilestoneEntry[]>([]);
	const [closestToMilestone, setClosestToMilestone] = useState<MilestoneEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedFilter, setSelectedFilter] = useState<string>("Show all");
	const [achievements, setAchievements] = useState<ClubAchievement[]>([]);
	const [achievementsLoading, setAchievementsLoading] = useState(true);

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

	useEffect(() => {
		const fetchAchievements = async () => {
			try {
				const response = await fetch("/api/club-achievements");
				if (response.ok) {
					const data = await response.json();
					const achievementsData = data.achievements || [];
					
					// Shuffle trophy numbers and assign to achievements
					const trophyNumbers = [1, 2, 3, 4, 5];
					const shuffled = [...trophyNumbers].sort(() => Math.random() - 0.5);
					
					const achievementsWithTrophies = achievementsData.map((achievement: ClubAchievement, index: number) => ({
						...achievement,
						trophyNumber: shuffled[index % 5],
					}));
					
					setAchievements(achievementsWithTrophies);
				} else {
					console.error("Failed to fetch achievements");
				}
			} catch (error) {
				console.error("Error fetching achievements:", error);
			} finally {
				setAchievementsLoading(false);
			}
		};

		fetchAchievements();
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
			className='p-2 md:p-4 overflow-y-auto'
			style={{ WebkitOverflowScrolling: 'touch' }}>
			<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-4 text-center'>Club Information</h2>

			{/* Info Section */}
			<div className='mb-8'>
				<p className='text-sm md:text-base text-white mb-4 text-center'>Formed in 1930, Dorkinian F.C. is the greatest football club in the world, dominating Surrey football from youth to senior level.</p>
				<div className='text-center'>
					<a 
						href='https://www.google.com/maps?saddr=My+Location&daddr=Pixham+Lane+Sports+Ground,+72+B2038,+Dorking+RH4+1PQ'
						target='_blank'
						rel='noopener noreferrer'
						className='text-dorkinians-yellow hover:text-yellow-400 underline transition-colors text-sm md:text-base'
					>
						Navigate to Pixham
					</a>
				</div>
			</div>

			{/* Club Achievements Section */}
			<div className='mb-8'>
				<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-4'>Club Achievements</h3>
				{achievementsLoading ? (
					<div className='flex overflow-x-auto gap-1 pb-2'>
						{[1, 2, 3].map((i) => (
							<div key={i} className='flex-shrink-0 min-w-[140px] flex flex-col items-center p-4'>
								<div className='mb-3 flex-shrink-0'>
									<Image
										src="/stat-icons/trophies/Trophy1.svg"
										alt="Trophy"
										width={150}
										height={150}
										className='w-[120px] h-[120px] md:w-[160px] md:h-[160px] object-contain opacity-30'
									/>
								</div>
								<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
									<Skeleton height={20} width={120} className='mb-2' />
									<Skeleton height={20} width={100} />
								</SkeletonTheme>
							</div>
						))}
					</div>
				) : achievements.length > 0 ? (
					<div className='flex overflow-x-auto gap-1 pb-2' style={{ WebkitOverflowScrolling: 'touch' }}>
						{achievements.map((achievement, index) => (
							<AchievementBox key={`${achievement.team}-${achievement.season}-${index}`} achievement={achievement} />
						))}
					</div>
				) : (
					<p className='text-sm text-gray-400 text-center py-4'>No league championships to display</p>
				)}
			</div>

			{/* Milestones Section */}
			<div className='mb-8'>
				<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-4'>Milestones</h3>
				
				{/* Filter Dropdown */}
				<div className='mb-4'>
					{loading ? (
						<div className='w-[60%] md:w-full md:max-w-xs mx-auto'>
							<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
								<Skeleton height={40} className='rounded-md' />
							</SkeletonTheme>
						</div>
					) : (
						<Listbox value={selectedFilter} onChange={setSelectedFilter}>
							<div className='relative w-[60%] md:w-full md:max-w-xs mx-auto'>
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
					)}
				</div>

				{/* Milestones Achieved Section */}
				<div className='mb-8'>
					<h4 className='text-base md:text-lg font-bold text-white mb-4'>Milestones Achieved</h4>
				{(loading || appConfig.forceSkeletonView) ? (
					<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
						<MilestonesTableSkeleton />
					</SkeletonTheme>
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
				{(loading || appConfig.forceSkeletonView) ? (
					<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
						<MilestonesTableSkeleton />
					</SkeletonTheme>
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
