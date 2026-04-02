"use client";

import ClubCaptainsSection from "./ClubCaptainsSection";
import ClubAwardsSection from "./ClubAwardsSection";

export default function ClubCaptainsAndAwards() {
	return (
		<div className='h-full flex flex-col overflow-hidden'>
			<div className='flex-shrink-0 w-full px-3 pt-2 pb-2 md:px-4 md:pt-4 lg:px-6'>
				<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-2 text-center'>Club Captains and Awards</h2>
			</div>

			<div className='flex-1 min-h-0 overflow-y-auto px-3 pb-6 md:px-4 lg:px-6' style={{ WebkitOverflowScrolling: "touch" }}>
				<div className='w-full lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 space-y-6 lg:space-y-0'>
					<div className='min-w-0'>
						<ClubCaptainsSection embedded />
					</div>
					<div className='min-w-0'>
						<ClubAwardsSection embedded />
					</div>
				</div>
			</div>
		</div>
	);
}
