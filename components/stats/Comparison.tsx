"use client";

import { useState } from "react";
import { useNavigationStore } from "@/lib/stores/navigation";
import FilterPills from "@/components/filters/FilterPills";
import PenOnPaperIcon from "@/components/icons/PenOnPaperIcon";

export default function Comparison() {
	const { selectedPlayer, enterEditMode, setMainPage, playerFilters, filterData, currentStatsSubPage } = useNavigationStore();
	const [showInfoTooltip, setShowInfoTooltip] = useState(false);

	const handleEditClick = () => {
		enterEditMode();
		setMainPage("home");
	};

	if (!selectedPlayer) {
		return (
			<div className='h-full flex items-center justify-center p-4'>
				<div className='text-center'>
					<div className='flex items-center justify-center gap-2 mb-2 md:mb-4'>
						<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow'>Player Comparison</h2>
						<button
							className='relative min-w-[40px] min-h-[40px] flex items-center justify-center'
							onMouseEnter={() => setShowInfoTooltip(true)}
							onMouseLeave={() => setShowInfoTooltip(false)}
							onTouchStart={() => setShowInfoTooltip(!showInfoTooltip)}
							aria-label='Information about Player Comparison'
						>
							<svg 
								xmlns='http://www.w3.org/2000/svg' 
								fill='none' 
								viewBox='0 0 24 24' 
								strokeWidth={1.5} 
								stroke='currentColor' 
								className='w-5 h-5 text-dorkinians-yellow cursor-pointer touch-manipulation'
							>
								<path strokeLinecap='round' strokeLinejoin='round' d='m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z' />
							</svg>
							{showInfoTooltip && (
								<div className='absolute top-full right-0 mt-2 px-3 py-2 text-xs text-white rounded-lg shadow-lg w-64 text-center z-50 pointer-events-none' style={{ backgroundColor: '#0f0f0f' }}>
									Compare statistics between different players. Select filters to customize the comparison data.
									<div className='absolute bottom-full right-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent' style={{ borderBottomColor: '#0f0f0f' }}></div>
								</div>
							)}
						</button>
					</div>
					<p className='text-white text-sm md:text-base mb-4'>Select a player to display data here</p>
					<button
						onClick={handleEditClick}
						className='flex items-center justify-center mx-auto w-8 h-8 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors'
						title='Select a player'>
						<PenOnPaperIcon className='h-4 w-4 md:h-5 md:w-5' />
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className='h-full flex flex-col overflow-hidden'>
			<div className='flex-shrink-0 p-2 md:p-4 text-center overflow-x-hidden'>
				<div className='flex items-center justify-center gap-2 mb-4'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow'>Player Comparison</h2>
					<button
						className='relative min-w-[40px] min-h-[40px] flex items-center justify-center'
						onMouseEnter={() => setShowInfoTooltip(true)}
						onMouseLeave={() => setShowInfoTooltip(false)}
						onTouchStart={() => setShowInfoTooltip(!showInfoTooltip)}
						aria-label='Information about Player Comparison'
					>
						<svg 
							xmlns='http://www.w3.org/2000/svg' 
							fill='none' 
							viewBox='0 0 24 24' 
							strokeWidth={1.5} 
							stroke='currentColor' 
							className='w-5 h-5 text-dorkinians-yellow cursor-pointer touch-manipulation'
						>
							<path strokeLinecap='round' strokeLinejoin='round' d='m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z' />
						</svg>
						{showInfoTooltip && (
							<div className='absolute top-full right-0 mt-2 px-3 py-2 text-xs text-white rounded-lg shadow-lg w-64 text-center z-50 pointer-events-none' style={{ backgroundColor: '#0f0f0f' }}>
								Compare statistics between different players. Select filters to customize the comparison data.
								<div className='absolute bottom-full right-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent' style={{ borderBottomColor: '#0f0f0f' }}></div>
							</div>
						)}
					</button>
				</div>
				<div className='flex justify-center mb-4'>
					<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
				</div>
			</div>
			<div className='flex-1 px-2 md:px-4 pb-4 min-h-0 overflow-y-auto overflow-x-hidden' style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
				<p className='text-sm md:text-base text-gray-300'>Compare statistics between different players will be displayed here</p>
				<div className='mt-8 p-4 bg-gray-100 rounded-lg'>
					<p className='text-sm text-gray-500'>⚖️ Player comparison charts and metrics will be integrated here</p>
				</div>
			</div>
		</div>
	);
}
