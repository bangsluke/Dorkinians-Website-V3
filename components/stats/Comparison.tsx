"use client";

import { useNavigationStore } from "@/lib/stores/navigation";
import { PencilIcon } from "@heroicons/react/24/outline";
import FilterPills from "@/components/filters/FilterPills";

export default function Comparison() {
	const { selectedPlayer, enterEditMode, setMainPage, playerFilters, filterData, currentStatsSubPage } = useNavigationStore();

	const handleEditClick = () => {
		enterEditMode();
		setMainPage("home");
	};

	if (!selectedPlayer) {
		return (
			<div className='h-full flex items-center justify-center p-4'>
				<div className='text-center'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-2 md:mb-4'>Player Comparison</h2>
					<p className='text-white text-sm md:text-base mb-4'>Select a player to display data here</p>
					<button
						onClick={handleEditClick}
						className='flex items-center justify-center mx-auto w-8 h-8 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors'
						title='Select a player'>
						<PencilIcon className='h-4 w-4 md:h-5 md:w-5' />
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className='p-4 text-center'>
			<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-4'>Player Comparison</h2>
			<div className='flex justify-center mb-4'>
				<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
			</div>
			<p className='text-sm md:text-base text-gray-300'>Compare statistics between different players will be displayed here</p>
			<div className='mt-8 p-4 bg-gray-100 rounded-lg'>
				<p className='text-sm text-gray-500'>⚖️ Player comparison charts and metrics will be integrated here</p>
			</div>
		</div>
	);
}
