"use client";

import ClubCaptainsSection from "./ClubCaptainsSection";
import ClubAwardsSection from "./ClubAwardsSection";

export default function ClubCaptainsAndAwards() {
	return (
		<div className='h-full flex flex-col overflow-hidden'>
			<div className='flex-shrink-0 p-2 md:p-4 md:max-w-4xl md:mx-auto w-full'>
				<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-2 text-center'>Club Captains and Awards</h2>
			</div>

			<div className='flex-1 overflow-y-auto px-2 md:px-4 pb-4 min-h-0' style={{ WebkitOverflowScrolling: "touch" }}>
				<div className='md:max-w-4xl md:mx-auto space-y-4'>
					<ClubCaptainsSection embedded />
					<ClubAwardsSection embedded />
				</div>
			</div>
		</div>
	);
}
