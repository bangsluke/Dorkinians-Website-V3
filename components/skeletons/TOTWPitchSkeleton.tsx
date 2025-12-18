import Skeleton from "react-loading-skeleton";
import Image from "next/image";

export default function TOTWPitchSkeleton() {
	// Using 4-4-2 formation as default - better spread positions
	const playerPositions = [
		{ x: 50, y: 92, isGoalkeeper: true }, // GK - center bottom
		{ x: 15, y: 72 }, // DEF 1 - left (wider)
		{ x: 35, y: 72 }, // DEF 2 - left center
		{ x: 65, y: 72 }, // DEF 3 - right center
		{ x: 85, y: 72 }, // DEF 4 - right (wider)
		{ x: 15, y: 48 }, // MID 1 - left (wider)
		{ x: 35, y: 48 }, // MID 2 - left center
		{ x: 65, y: 48 }, // MID 3 - right center
		{ x: 85, y: 48 }, // MID 4 - right (wider)
		{ x: 35, y: 24 }, // FWD 1 - left forward
		{ x: 65, y: 24 }, // FWD 2 - right forward
	];

	return (
		<div className='w-full'>
			{/* Dropdown Filters */}
			<div className='flex flex-row gap-4 mb-6'>
				<div className='w-1/3 md:w-1/2'>
					<Skeleton height={40} width="100%" />
				</div>
				<div className='flex-1 md:w-1/2'>
					<Skeleton height={40} width="100%" />
				</div>
			</div>

			{/* Summary Section - Two Squares */}
			<div className='flex flex-row flex-nowrap gap-8 md:gap-20 mb-6 justify-center'>
				{/* Square 1: TOTW TOTAL POINTS section */}
				<div className='text-center flex flex-col md:w-auto'>
					<Skeleton height={140} width={200} />
				</div>
				{/* Square 2: STAR MAN section */}
				<div className='flex flex-col items-center flex-shrink-0'>
					<Skeleton height={140} width={120} />
				</div>
			</div>

			{/* Pitch Visualization */}
			<div className='relative w-full mb-4 overflow-hidden' style={{ minHeight: '450px', aspectRatio: '16/9.6' }}>
				{/* Pitch Background */}
				<div className='absolute inset-0 w-full h-[110%]'>
					<Image
						src='/totw-images/TOTWBackground.svg'
						alt='Football Pitch'
						fill
						className='object-cover w-full h-full'
						style={{ objectPosition: 'center top' }}
						priority
					/>
				</div>

				{/* Player Markers - Circle (kit) + Rectangle (name box) overlaying */}
				{playerPositions.map((position, index) => (
					<div
						key={index}
						className='absolute z-10'
						style={{
							left: `${position.x}%`,
							top: `${position.y}%`,
							transform: "translate(-50%, -50%)",
						}}
					>
						<div className='relative flex flex-col items-center'>
							{/* Kit Circle */}
							<Skeleton circle height={56} width={56} />
							{/* Name Box Rectangle - overlaying bottom of circle */}
							<div className='absolute' style={{ top: '40px' }}>
								<Skeleton height={44} width={60} />
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
