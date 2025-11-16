"use client";

import { useNavigationStore, type TeamData } from "@/lib/stores/navigation";
import { statObject, statsPageConfig } from "@/config/config";
import Image from "next/image";
import { useState, useMemo, useEffect } from "react";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/20/solid";
import FilterPills from "@/components/filters/FilterPills";

interface Team {
	name: string;
}

function StatRow({ stat, value, teamData }: { stat: any; value: any; teamData: TeamData }) {
	const [showTooltip, setShowTooltip] = useState(false);

	return (
		<>
			<tr
				className='border-b border-white/10 hover:bg-white/5 transition-colors relative group cursor-help'
				onMouseEnter={() => setShowTooltip(true)}
				onMouseLeave={() => setShowTooltip(false)}
				onTouchStart={() => setShowTooltip(!showTooltip)}>
				<td className='px-2 md:px-4 py-2 md:py-3'>
					<div className='flex items-center justify-center w-6 h-6 md:w-8 md:h-8'>
						<Image
							src={`/stat-icons/${stat.iconName}.webp`}
							alt={stat.displayText}
							width={24}
							height={24}
							className='w-6 h-6 md:w-8 md:h-8 object-contain brightness-0 invert'
						/>
					</div>
				</td>
				<td className='px-2 md:px-4 py-2 md:py-3'>
					<span className='text-white font-medium text-xs md:text-sm'>{stat.displayText}</span>
				</td>
				<td className='px-2 md:px-4 py-2 md:py-3 text-right'>
					<span className='text-white font-mono text-xs md:text-sm'>
						{formatStatValue(value, stat.statFormat, stat.numberDecimalPlaces, (stat as any).statUnit)}
					</span>
				</td>
			</tr>
			{showTooltip && (
				<div className='fixed z-20 px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg w-64 text-center pointer-events-none'>
					{stat.description}
					<div className='absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800'></div>
				</div>
			)}
		</>
	);
}

function formatStatValue(value: any, statFormat: string, decimalPlaces: number, statUnit?: string): string {
	if (value === null || value === undefined) return "N/A";

	// Helper to convert Neo4j Integer objects or any value to a number
	const toNumber = (val: any): number => {
		if (val === null || val === undefined) return 0;
		if (typeof val === "number") {
			if (isNaN(val)) return 0;
			return val;
		}
		// Handle Neo4j Integer objects
		if (typeof val === "object") {
			if ("toNumber" in val && typeof val.toNumber === "function") {
				return val.toNumber();
			}
			if ("low" in val && "high" in val) {
				// Neo4j Integer format: low + high * 2^32
				const low = val.low || 0;
				const high = val.high || 0;
				return low + high * 4294967296;
			}
		}
		const num = Number(val);
		return isNaN(num) ? 0 : num;
	};

	const numValue = toNumber(value);

	let formattedValue: string;
	switch (statFormat) {
		case "Integer":
			formattedValue = Math.round(numValue).toString();
			break;
		case "Decimal1":
			formattedValue = numValue.toFixed(1);
			break;
		case "Decimal2":
			formattedValue = numValue.toFixed(decimalPlaces);
			break;
		case "Percentage":
			formattedValue = `${Math.round(numValue)}%`;
			break;
		case "String":
			formattedValue = String(value);
			break;
		default:
			formattedValue = String(value);
	}

	return statUnit ? `${formattedValue} ${statUnit}` : formattedValue;
}

export default function ClubTeamStats() {
	const {
		selectedPlayer,
		cachedPlayerData,
		playerFilters,
		currentStatsSubPage,
		filterData,
	} = useNavigationStore();

	const [selectedTeam, setSelectedTeam] = useState<string>("Whole Club");
	const [teams, setTeams] = useState<Team[]>([]);
	const [isLoadingTeams, setIsLoadingTeams] = useState(false);
	const [teamData, setTeamData] = useState<TeamData | null>(null);
	const [isLoadingTeamData, setIsLoadingTeamData] = useState(false);

	// Determine page heading based on selected team
	const pageHeading = useMemo(() => {
		return selectedTeam === "Whole Club" ? "Club Stats" : "Team Stats";
	}, [selectedTeam]);

	// Get stats to display for current page
	const statsToDisplay = useMemo(() => {
		return [...(statsPageConfig[currentStatsSubPage]?.statsToDisplay || [])];
	}, [currentStatsSubPage]);

	// Filter statObject entries to only include stats in statsToDisplay
	const filteredStatEntries = useMemo(() => {
		return Object.entries(statObject).filter(([key]) => statsToDisplay.includes(key as keyof typeof statObject));
	}, [statsToDisplay]);

	// Load teams on mount
	useEffect(() => {
		const fetchTeams = async () => {
			setIsLoadingTeams(true);
			try {
				const response = await fetch("/api/teams");
				if (response.ok) {
					const data = await response.json();
					setTeams(data.teams || []);
				} else {
					console.error("Failed to fetch teams:", response.statusText);
					setTeams([]);
				}
			} catch (error) {
				console.error("Error fetching teams:", error);
				setTeams([]);
			} finally {
				setIsLoadingTeams(false);
			}
		};

		fetchTeams();
	}, []);

	// Set "Whole Club" as default when teams are loaded (if not already set)
	useEffect(() => {
		if (teams.length > 0 && !selectedTeam) {
			setSelectedTeam("Whole Club");
		}
	}, [teams, selectedTeam]);

	// Fetch team data when team changes or filters are applied
	// Use JSON.stringify to detect filter changes even if object reference doesn't change
	const filtersKey = JSON.stringify(playerFilters);
	
	useEffect(() => {
		if (!selectedTeam) {
			setTeamData(null);
			return;
		}

		const fetchTeamData = async () => {
			setIsLoadingTeamData(true);
			try {
				const response = await fetch("/api/team-data-filtered", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						teamName: selectedTeam,
						filters: playerFilters,
					}),
				});

				if (response.ok) {
					const data = await response.json();
					setTeamData(data.teamData);
				} else {
					console.error("Failed to fetch team data:", response.statusText);
					setTeamData(null);
				}
			} catch (error) {
				console.error("Error fetching team data:", error);
				setTeamData(null);
			} finally {
				setIsLoadingTeamData(false);
			}
		};

		fetchTeamData();
	}, [selectedTeam, filtersKey, playerFilters]);

	// Handle team selection
	const handleTeamSelect = (teamName: string) => {
		setSelectedTeam(teamName);
	};

	if (isLoadingTeams) {
		return (
			<div className='h-full flex flex-col'>
				<div className='flex-shrink-0 p-2 md:p-4'>
					<div className='flex items-center justify-center mb-2 md:mb-4 relative'>
						<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow text-center'>Club Stats</h2>
					</div>
					<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
				</div>
				<div className='flex-1 flex items-center justify-center p-4'>
					<p className='text-white text-sm md:text-base'>Loading teams...</p>
				</div>
			</div>
		);
	}

	return (
		<div className='h-full flex flex-col'>
			<div className='flex-shrink-0 p-2 md:p-4'>
				<div className='flex items-center justify-center mb-2 md:mb-4 relative'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow text-center'>{pageHeading}</h2>
				</div>
				<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
				<div className='mb-4'>
					<Listbox value={selectedTeam} onChange={handleTeamSelect}>
						<div className='relative'>
							<Listbox.Button className='relative w-full cursor-default dark-dropdown py-3 pl-4 pr-10 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 sm:text-sm'>
								<span className={`block truncate ${selectedTeam ? "text-white" : "text-yellow-300"}`}>
									{selectedTeam || "Select a team..."}
								</span>
								<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
									<ChevronUpDownIcon className='h-5 w-5 text-yellow-300' aria-hidden='true' />
								</span>
							</Listbox.Button>
							<Listbox.Options className='absolute z-10 mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-base shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none sm:text-sm'>
								<Listbox.Option
									key="whole-club"
									className={({ active }) =>
										`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
									}
									value="Whole Club">
									{({ selected }) => (
										<>
											<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
												Whole Club
											</span>
											{selected ? (
												<span className='absolute inset-y-0 left-0 flex items-center pl-3 text-green-400'>
													<CheckIcon className='h-5 w-5' aria-hidden='true' />
												</span>
											) : null}
										</>
									)}
								</Listbox.Option>
								{teams.map((team, teamIdx) => (
									<Listbox.Option
										key={teamIdx}
										className={({ active }) =>
											`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
										}
										value={team.name}>
										{({ selected }) => (
											<>
												<span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
													{team.name}
												</span>
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

			{isLoadingTeamData ? (
				<div className='flex-1 flex items-center justify-center p-4'>
					<p className='text-white text-sm md:text-base'>Loading team data...</p>
				</div>
			) : !selectedTeam ? (
				<div className='flex-1 flex items-center justify-center p-4'>
					<div className='text-center'>
						<p className='text-white text-sm md:text-base'>Select a team to display stats</p>
					</div>
				</div>
			) : !teamData ? (
				<div className='flex-1 flex items-center justify-center p-4'>
					<div className='text-center'>
						<p className='text-white text-sm md:text-base'>No team data available</p>
					</div>
				</div>
			) : (
				<div className='flex-1 overflow-y-auto px-2 md:px-4 pb-4'>
					<div className='overflow-x-auto'>
						<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
							<thead className='sticky top-0 z-10'>
								<tr className='bg-white/20'>
									<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Icon</th>
									<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Stat</th>
									<th className='px-2 md:px-4 py-2 md:py-3 text-right text-white font-semibold text-xs md:text-sm'>Value</th>
								</tr>
							</thead>
							<tbody>
								{filteredStatEntries.map(([key, stat]) => {
									const value = teamData[stat.statName as keyof TeamData];
									return <StatRow key={key} stat={stat} value={value} teamData={teamData} />;
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}

