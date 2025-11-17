"use client";

import { useMemo } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useNavigationStore, type PlayerFilters, type StatsSubPage } from "@/lib/stores/navigation";
import { statsPageConfig } from "@/config/config";
import { getActiveFilters, type ActiveFilter } from "@/lib/utils/filterUtils";

interface FilterPillsProps {
	playerFilters: PlayerFilters;
	filterData?: {
		seasons: Array<{ season: string; startDate: string; endDate: string }>;
		teams: Array<{ name: string }>;
		opposition: Array<{ name: string }>;
		competitions: Array<{ name: string; type: string }>;
	};
	currentStatsSubPage: StatsSubPage;
}

export default function FilterPills({ playerFilters, filterData, currentStatsSubPage }: FilterPillsProps) {
	const {
		removeTimeRangeFilter,
		removeTeamFilter,
		removeLocationFilter,
		removeOppositionFilter,
		removeCompetitionTypeFilter,
		removeCompetitionSearchFilter,
		removeResultFilter,
		removePositionFilter,
	} = useNavigationStore();

	// Get available filters for current page
	const availableFilters = useMemo(() => {
		const config = statsPageConfig[currentStatsSubPage];
		return config?.availableFilters ? [...config.availableFilters] : [];
	}, [currentStatsSubPage]);

	// Get active filters and expand multi-value filters into individual pills
	const filterPills = useMemo(() => {
		// Map filter keys to available filter names
		const keyMap: Record<string, string> = {
			timeRange: "timeRange",
			teams: "team",
			location: "location",
			opposition: "opposition",
			competition: "competition",
			result: "result",
			position: "position",
		};

		// Expand multi-value filters into individual pills
		const expandedPills: Array<ActiveFilter & { onRemove: () => void }> = [];

		// Teams filter
		if (availableFilters.includes("team") && playerFilters.teams.length > 0) {
			playerFilters.teams.forEach((team) => {
				expandedPills.push({
					key: `team-${team}`,
					label: "Team",
					value: team,
					removeKey: "team",
					onRemove: () => removeTeamFilter(team),
				});
			});
		}

		// Location filter
		if (availableFilters.includes("location") && playerFilters.location.length > 0 && playerFilters.location.length < 2) {
			playerFilters.location.forEach((location) => {
				expandedPills.push({
					key: `location-${location}`,
					label: "Location",
					value: location,
					removeKey: "location",
					onRemove: () => removeLocationFilter(location),
				});
			});
		}

		// Result filter
		if (availableFilters.includes("result") && playerFilters.result.length > 0 && playerFilters.result.length < 3) {
			playerFilters.result.forEach((result) => {
				expandedPills.push({
					key: `result-${result}`,
					label: "Result",
					value: result,
					removeKey: "result",
					onRemove: () => removeResultFilter(result),
				});
			});
		}

		// Position filter
		if (availableFilters.includes("position") && playerFilters.position.length > 0) {
			playerFilters.position.forEach((position) => {
				expandedPills.push({
					key: `position-${position}`,
					label: "Position",
					value: position,
					removeKey: "position",
					onRemove: () => removePositionFilter(position),
				});
			});
		}

		// Competition filter
		if (availableFilters.includes("competition")) {
			if (playerFilters.competition.types.length > 0 && playerFilters.competition.types.length < 3) {
				playerFilters.competition.types.forEach((type) => {
					expandedPills.push({
						key: `competition-type-${type}`,
						label: "Competition",
						value: type,
						removeKey: "competition",
						onRemove: () => removeCompetitionTypeFilter(type),
					});
				});
			}
			if (playerFilters.competition.searchTerm !== "") {
				expandedPills.push({
					key: "competition-search",
					label: "Competition",
					value: playerFilters.competition.searchTerm,
					removeKey: "competition",
					onRemove: () => removeCompetitionSearchFilter(),
				});
			}
		}

		// Get active filters for single-value filters
		const activeFilters = getActiveFilters(playerFilters, filterData);
		activeFilters.forEach((filter) => {
			if (filter.key === "timeRange" && availableFilters.includes("timeRange")) {
				expandedPills.push({
					...filter,
					onRemove: () => removeTimeRangeFilter(),
				});
			} else if (filter.key === "opposition" && availableFilters.includes("opposition")) {
				expandedPills.push({
					...filter,
					onRemove: () => removeOppositionFilter(),
				});
			}
		});

		return expandedPills;
	}, [playerFilters, filterData, availableFilters, removeTimeRangeFilter, removeTeamFilter, removeLocationFilter, removeOppositionFilter, removeCompetitionTypeFilter, removeCompetitionSearchFilter, removeResultFilter, removePositionFilter]);

	if (filterPills.length === 0) {
		return null;
	}

	return (
		<div className='mb-2 md:mb-4 overflow-x-auto'>
			<div className='flex gap-2 min-w-max'>
				{filterPills.map((pill) => (
					<div
						key={pill.key}
						className='flex items-center gap-2 px-3 py-1.5 bg-white rounded-full text-sm flex-shrink-0'>
						<span className='text-gray-900 whitespace-nowrap'>
							{pill.label}: {pill.value}
						</span>
						<button
							onClick={pill.onRemove}
							className='flex items-center justify-center min-w-[40px] min-h-[40px] text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0'
							aria-label={`Remove ${pill.label} filter`}>
							<XMarkIcon className='w-4 h-4' />
						</button>
					</div>
				))}
			</div>
		</div>
	);
}

