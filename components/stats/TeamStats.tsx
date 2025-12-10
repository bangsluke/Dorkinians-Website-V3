"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import FilterPills from "@/components/filters/FilterPills";
import { useNavigationStore, type TeamData } from "@/lib/stores/navigation";

interface TopPlayer {
	playerName: string;
	appearances: number;
	goals: number;
	assists: number;
	cleanSheets: number;
	mom: number;
	saves: number;
	yellowCards: number;
	redCards: number;
	penaltiesScored: number;
	fantasyPoints: number;
	goalInvolvements: number;
	homeGames: number;
	awayGames: number;
	minutes: number;
	ownGoals: number;
	conceded: number;
	penaltiesMissed: number;
	penaltiesConceded: number;
	penaltiesSaved: number;
	distance: number;
}

type StatType =
	| "appearances"
	| "goals"
	| "assists"
	| "cleanSheets"
	| "mom"
	| "saves"
	| "yellowCards"
	| "redCards"
	| "penaltiesScored"
	| "fantasyPoints"
	| "goalInvolvements"
	| "minutes"
	| "ownGoals"
	| "conceded"
	| "penaltiesMissed"
	| "penaltiesConceded"
	| "penaltiesSaved"
	| "distance";

const STAT_STORAGE_KEY = "team-stats-top-players-stat-type";

const statTypeOptions: StatType[] = [
	"appearances",
	"minutes",
	"mom",
	"goals",
	"assists",
	"goalInvolvements",
	"fantasyPoints",
	"cleanSheets",
	"saves",
	"yellowCards",
	"redCards",
	"penaltiesScored",
	"penaltiesSaved",
	"penaltiesConceded",
	"penaltiesMissed",
	"conceded",
	"ownGoals",
	"distance",
];

const formatLargeNumber = (value: number | undefined) => {
	if (value === undefined || value === null) return "0";
	return value.toLocaleString();
};

const getStatTypeLabel = (statType: StatType): string => {
	switch (statType) {
		case "appearances":
			return "Appearances";
		case "goals":
			return "Goals";
		case "assists":
			return "Assists";
		case "cleanSheets":
			return "Clean Sheets";
		case "mom":
			return "Man of the Matches";
		case "saves":
			return "Saves";
		case "yellowCards":
			return "Yellow Cards";
		case "redCards":
			return "Red Cards";
		case "penaltiesScored":
			return "Penalties Scored";
		case "fantasyPoints":
			return "Fantasy Points";
		case "goalInvolvements":
			return "Goal Involvements";
		case "minutes":
			return "Minutes Played";
		case "ownGoals":
			return "Own Goals";
		case "conceded":
			return "Goals Conceded";
		case "penaltiesMissed":
			return "Penalties Missed";
		case "penaltiesConceded":
			return "Penalties Conceded";
		case "penaltiesSaved":
			return "Penalties Saved";
		case "distance":
			return "Distance Travelled";
		default:
			return "Appearances";
	}
};

const getStatValue = (player: TopPlayer, statType: StatType): number => {
	switch (statType) {
		case "appearances":
			return player.appearances;
		case "goals":
			return player.goals + player.penaltiesScored;
		case "assists":
			return player.assists;
		case "cleanSheets":
			return player.cleanSheets;
		case "mom":
			return player.mom;
		case "saves":
			return player.saves;
		case "yellowCards":
			return player.yellowCards;
		case "redCards":
			return player.redCards;
		case "penaltiesScored":
			return player.penaltiesScored;
		case "fantasyPoints":
			return Math.round(player.fantasyPoints);
		case "goalInvolvements":
			return player.goalInvolvements;
		case "minutes":
			return player.minutes;
		case "ownGoals":
			return player.ownGoals;
		case "conceded":
			return player.conceded;
		case "penaltiesMissed":
			return player.penaltiesMissed;
		case "penaltiesConceded":
			return player.penaltiesConceded;
		case "penaltiesSaved":
			return player.penaltiesSaved;
		case "distance":
			return player.distance;
		default:
			return 0;
	}
};

const formatPlayerSummary = (player: TopPlayer, statType: StatType): string => {
	const apps = `${player.appearances} ${player.appearances === 1 ? "App" : "Apps"}`;
	const formatGoals = () => {
		const totalGoals = player.goals + player.penaltiesScored;
		const penaltyText = player.penaltiesScored > 0 ? ` (incl. ${player.penaltiesScored} ${player.penaltiesScored === 1 ? "pen" : "pens"})` : "";
		return `${totalGoals} ${totalGoals === 1 ? "Goal" : "Goals"}${penaltyText} in ${apps}`;
	};

	switch (statType) {
		case "appearances":
			return `${player.homeGames} Home / ${player.awayGames} Away`;
		case "goals":
			return formatGoals();
		case "assists":
			return `${player.assists} ${player.assists === 1 ? "Assist" : "Assists"} in ${apps}`;
		case "cleanSheets":
			return `${player.cleanSheets} ${player.cleanSheets === 1 ? "Clean Sheet" : "Clean Sheets"} in ${apps}`;
		case "mom":
			return `${player.mom} ${player.mom === 1 ? "Man of the Match" : "Man of the Matches"} in ${apps}`;
		case "saves":
			return `${player.saves} ${player.saves === 1 ? "Save" : "Saves"} in ${apps}`;
		case "yellowCards":
			return `${player.yellowCards} ${player.yellowCards === 1 ? "Yellow Card" : "Yellow Cards"} in ${apps}`;
		case "redCards":
			return `${player.redCards} ${player.redCards === 1 ? "Red Card" : "Red Cards"} in ${apps}`;
		case "penaltiesScored":
			return `${player.penaltiesScored} ${player.penaltiesScored === 1 ? "Penalty Scored" : "Penalties Scored"} in ${apps}`;
		case "fantasyPoints":
			return `${Math.round(player.fantasyPoints)} ${Math.round(player.fantasyPoints) === 1 ? "Point" : "Points"} in ${apps}`;
		case "goalInvolvements":
			return `${player.goalInvolvements} Goal Involvements in ${apps}`;
		case "minutes":
			return `${player.minutes.toLocaleString()} Minutes in ${apps}`;
		case "ownGoals":
			return `${player.ownGoals} ${player.ownGoals === 1 ? "Own Goal" : "Own Goals"} in ${apps}`;
		case "conceded":
			return `${player.conceded} ${player.conceded === 1 ? "Goal Conceded" : "Goals Conceded"} in ${apps}`;
		case "penaltiesMissed":
			return `${player.penaltiesMissed} ${player.penaltiesMissed === 1 ? "Penalty Missed" : "Penalties Missed"} in ${apps}`;
		case "penaltiesConceded":
			return `${player.penaltiesConceded} ${player.penaltiesConceded === 1 ? "Penalty Conceded" : "Penalties Conceded"} in ${apps}`;
		case "penaltiesSaved":
			return `${player.penaltiesSaved} ${player.penaltiesSaved === 1 ? "Penalty Saved" : "Penalties Saved"} in ${apps}`;
		case "distance":
			return `${(Math.round(player.distance * 10) / 10).toFixed(1)} miles in ${apps}`;
		default:
			return apps;
	}
};

export default function TeamStats() {
	const {
		playerFilters,
		updatePlayerFilters,
		applyPlayerFilters,
		filterData,
		isFilterDataLoaded,
		loadFilterData,
		currentStatsSubPage,
		selectedPlayer,
		cachedPlayerData,
	} = useNavigationStore();

	const [selectedTeam, setSelectedTeam] = useState<string>("");
	const [hasInitializedTeam, setHasInitializedTeam] = useState(false);
	const [teamData, setTeamData] = useState<TeamData | null>(null);
	const [isLoadingTeamData, setIsLoadingTeamData] = useState(false);
	const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
	const [isLoadingTopPlayers, setIsLoadingTopPlayers] = useState(false);
	const [selectedStatType, setSelectedStatType] = useState<StatType>(() => {
		if (typeof window !== "undefined") {
			const saved = window.localStorage.getItem(STAT_STORAGE_KEY) as StatType | null;
			if (saved && statTypeOptions.includes(saved)) {
				return saved;
			}
		}
		return "goals";
	});

	useEffect(() => {
		if (!isFilterDataLoaded) {
			loadFilterData();
		}
	}, [isFilterDataLoaded, loadFilterData]);

	useEffect(() => {
		if (typeof window !== "undefined") {
			window.localStorage.setItem(STAT_STORAGE_KEY, selectedStatType);
		}
	}, [selectedStatType]);

	const teamOptions = useMemo(() => {
		const options = (filterData.teams || [])
			.map((team) => team.name?.trim())
			.filter((name): name is string => Boolean(name));
		return Array.from(new Set(options)).sort((a, b) => a.localeCompare(b));
	}, [filterData.teams]);

	const primaryTeamFilter = playerFilters.teams[0] || "";
	const playerMostPlayedTeam = cachedPlayerData?.playerData?.mostPlayedForTeam?.trim();

	useEffect(() => {
		if (hasInitializedTeam) {
			return;
		}
		const fallbackTeam = playerMostPlayedTeam || primaryTeamFilter || teamOptions[0] || "";
		if (!fallbackTeam) {
			return;
		}
		setSelectedTeam(fallbackTeam);
		const syncFilters = async () => {
			if (primaryTeamFilter !== fallbackTeam) {
				updatePlayerFilters({ teams: [fallbackTeam] });
				await applyPlayerFilters();
			}
			setHasInitializedTeam(true);
		};
		void syncFilters();
	}, [applyPlayerFilters, hasInitializedTeam, playerMostPlayedTeam, primaryTeamFilter, teamOptions, updatePlayerFilters]);

	useEffect(() => {
		if (!hasInitializedTeam) {
			return;
		}
		if (primaryTeamFilter && primaryTeamFilter !== selectedTeam) {
			setSelectedTeam(primaryTeamFilter);
		}
	}, [hasInitializedTeam, primaryTeamFilter, selectedTeam]);

	const filtersForTeam = useMemo(() => {
		return {
			...playerFilters,
			timeRange: { ...playerFilters.timeRange },
			opposition: { ...playerFilters.opposition },
			competition: { ...playerFilters.competition },
			teams: selectedTeam ? [selectedTeam] : playerFilters.teams,
		};
	}, [playerFilters, selectedTeam]);

	const filtersKey = useMemo(() => JSON.stringify(filtersForTeam), [filtersForTeam]);

	const fetchTeamData = useCallback(async () => {
		if (!selectedTeam) {
			return;
		}
		setIsLoadingTeamData(true);
		try {
			const response = await fetch("/api/team-data-filtered", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					teamName: selectedTeam,
					filters: filtersForTeam,
				}),
			});
			if (response.ok) {
				const data = await response.json();
				setTeamData(data.teamData || null);
			} else {
				setTeamData(null);
			}
		} catch (error) {
			console.error("Error fetching team data:", error);
			setTeamData(null);
		} finally {
			setIsLoadingTeamData(false);
		}
	}, [filtersForTeam, selectedTeam]);

	useEffect(() => {
		if (!hasInitializedTeam) {
			return;
		}
		void fetchTeamData();
	}, [fetchTeamData, filtersKey, hasInitializedTeam]);

	useEffect(() => {
		if (!selectedTeam) {
			return;
		}
		const fetchTopPlayers = async () => {
			setIsLoadingTopPlayers(true);
			try {
				const response = await fetch("/api/top-players-stats", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						filters: {
							...filtersForTeam,
							teams: selectedTeam ? [selectedTeam] : [],
						},
						statType: selectedStatType,
					}),
				});
				if (response.ok) {
					const data = await response.json();
					setTopPlayers(data.players || []);
				} else {
					setTopPlayers([]);
				}
			} catch (error) {
				console.error("Error fetching top players:", error);
				setTopPlayers([]);
			} finally {
				setIsLoadingTopPlayers(false);
			}
		};

		void fetchTopPlayers();
	}, [filtersForTeam, selectedStatType, selectedTeam]);

	const handleTeamChange = async (team: string) => {
		setSelectedTeam(team);
		updatePlayerFilters({ teams: [team] });
		await applyPlayerFilters();
	};

	const keyPerformanceStats = useMemo(() => {
		if (!teamData) {
			return [];
		}
		return [
			{ label: "Players", value: teamData.playerCount },
			{ label: "Games", value: teamData.gamesPlayed },
			{ label: "Wins", value: teamData.wins },
			{ label: "Goals", value: teamData.goalsScored },
			{ label: "Competitions", value: teamData.numberOfCompetitions },
			{ label: "Clean Sheets", value: teamData.cleanSheets },
		];
	}, [teamData]);

	return (
		<div className='h-full flex flex-col'>
			<div className='flex-shrink-0 p-2 md:p-4 space-y-3'>
				<div className='flex flex-col gap-1'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow'>Team Stats</h2>
					<p className='text-sm text-gray-300'>Dive into team-specific performance filtered by your selections.</p>
				</div>
				<div className='space-y-1'>
					<p className='text-sm text-gray-300'>Select Team</p>
					<Listbox value={selectedTeam} onChange={handleTeamChange} disabled={!teamOptions.length}>
						<div className='relative'>
							<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md text-xs md:text-sm disabled:opacity-60'>
								<span className='block truncate text-white'>{selectedTeam || "No team available"}</span>
								<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
									<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
								</span>
							</Listbox.Button>
							<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-xs md:text-sm shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
								{teamOptions.map((team) => (
									<Listbox.Option
										key={team}
										value={team}
										className={({ active }) =>
											`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
										}>
										{({ selected }) => (
											<span className={`block truncate py-1 px-2 ${selected ? "font-medium" : "font-normal"}`}>{team}</span>
										)}
									</Listbox.Option>
								))}
							</Listbox.Options>
						</div>
					</Listbox>
				</div>
				<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
			</div>

			{isLoadingTeamData ? (
				<div className='flex-1 flex items-center justify-center p-4'>
					<p className='text-white text-sm md:text-base'>Loading team data...</p>
				</div>
			) : !selectedTeam || !teamData ? (
				<div className='flex-1 flex items-center justify-center p-4'>
					<p className='text-white text-sm md:text-base text-center'>Select a team to view detailed statistics.</p>
				</div>
			) : (
				<div className='flex-1 px-2 md:px-4 pb-4 overflow-y-auto' style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
					<div className='space-y-4'>
						<div className='bg-white/10 backdrop-blur-sm rounded-lg p-3 md:p-4'>
							<div className='flex items-center justify-between flex-wrap gap-2 mb-3'>
								<h3 className='text-white font-semibold text-base md:text-lg'>Key Performance Stats</h3>
								<span className='text-xs text-gray-300'>Filtered for {selectedTeam}</span>
							</div>
							<div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
								{keyPerformanceStats.map((stat) => (
									<div key={stat.label} className='bg-black/30 border border-white/10 rounded-lg p-3 text-center'>
										<p className='text-xs uppercase text-gray-300 tracking-wide'>{stat.label}</p>
										<p className='text-2xl font-bold text-white mt-1'>{formatLargeNumber(stat.value)}</p>
									</div>
								))}
							</div>
						</div>

						<div className='bg-white/10 backdrop-blur-sm rounded-lg p-3 md:p-4'>
							<div className='flex items-center justify-between flex-wrap gap-2 mb-3'>
								<h3 className='text-white font-semibold text-base md:text-lg'>Top 5 {getStatTypeLabel(selectedStatType)}</h3>
								<div className='w-48 sm:w-60'>
									<Listbox value={selectedStatType} onChange={setSelectedStatType}>
										<div className='relative'>
											<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md text-xs md:text-sm'>
												<span className='block truncate text-white'>{getStatTypeLabel(selectedStatType)}</span>
												<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
													<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
												</span>
											</Listbox.Button>
											<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-xs md:text-sm shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
												{statTypeOptions.map((statType) => (
													<Listbox.Option
														key={statType}
														value={statType}
														className={({ active }) =>
															`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
														}>
														{({ selected }) => (
															<span className={`block truncate py-1 px-2 ${selected ? "font-medium" : "font-normal"}`}>{getStatTypeLabel(statType)}</span>
														)}
													</Listbox.Option>
												))}
											</Listbox.Options>
										</div>
									</Listbox>
								</div>
							</div>

							{isLoadingTopPlayers ? (
								<p className='text-center text-white text-sm'>Loading top players...</p>
							) : topPlayers.length === 0 ? (
								<p className='text-center text-white text-sm'>No players found for the current filters.</p>
							) : (
								<div className='overflow-x-auto'>
									<table className='w-full text-white'>
										<thead>
											<tr className='border-b-2 border-dorkinians-yellow'>
												<th className='text-left py-2 px-2 text-xs md:text-sm w-auto'>Player</th>
												<th className='text-center py-2 px-2 text-xs md:text-sm w-24'>{getStatTypeLabel(selectedStatType)}</th>
											</tr>
										</thead>
										<tbody>
											{topPlayers.map((player, index) => {
												const statValue = getStatValue(player, selectedStatType);
												let formattedValue: string | number = statValue;
												if (selectedStatType === "minutes") {
													formattedValue = statValue.toLocaleString();
												} else if (selectedStatType === "distance") {
													formattedValue = (Math.round(statValue * 10) / 10).toFixed(1);
												}
												return (
													<tr
														key={player.playerName}
														className='border-b border-white/10 last:border-b-0'>
														<td className='py-3 px-2'>
															<div className='flex flex-col'>
																<div className='flex items-center justify-between gap-2'>
																	<div className='flex items-center gap-2'>
																		<span className='font-mono text-base'>{index + 1}</span>
																		<span className='font-semibold text-base'>{player.playerName}</span>
																	</div>
																	<span className='font-semibold text-base text-right'>{formattedValue}</span>
																</div>
																<p className='text-[0.7rem] text-gray-300 mt-1'>{formatPlayerSummary(player, selectedStatType)}</p>
															</div>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
