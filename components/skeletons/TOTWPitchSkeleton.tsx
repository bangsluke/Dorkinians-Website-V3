import Skeleton from "react-loading-skeleton";
import Image from "next/image";

export default function TOTWPitchSkeleton() {
	// Using 4-4-2 formation coordinates from formationCoordinateObject
	// Apply same centering offsets as real component: x + 10, y * 0.97 + 15
	const basePositions = [
		{ x: 40, y: 1, isGoalkeeper: true }, // GK - Pos1
		{ x: 5, y: 24 }, // DEF 1 - Pos2
		{ x: 25, y: 24 }, // DEF 2 - Pos3
		{ x: 55, y: 24 }, // DEF 3 - Pos4
		{ x: 75, y: 24 }, // DEF 4 - Pos5
		{ x: 5, y: 47 }, // MID 1 - Pos6
		{ x: 25, y: 47 }, // MID 2 - Pos7
		{ x: 55, y: 47 }, // MID 3 - Pos8
		{ x: 75, y: 47 }, // MID 4 - Pos9
		{ x: 20, y: 71 }, // FWD 1 - Pos10
		{ x: 60, y: 71 }, // FWD 2 - Pos11
	];
	
	// Apply centering offsets to match real component
	const playerPositions = basePositions.map(pos => ({
		...pos,
		x: pos.x + 10,
		y: 1 + (pos.y - 1) * 0.97 + 15,
	}));

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
					<Skeleton height={140} width={160} />
				</div>
				{/* Square 2: STAR MAN section */}
				<div className='flex flex-col items-center flex-shrink-0'>
					<Skeleton height={140} width={100} />
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
						{/* Kit Circle - matches w-14 h-14 (56px) with mb-1 spacing */}
						<Skeleton circle height={56} width={56} className="mb-1" />
						{/* Name Box Rectangle - matches actual dimensions (60px width, 50px height) */}
						<Skeleton height={50} width={60} />
					</div>
					</div>
				))}
			</div>
		</div>
	);
}
