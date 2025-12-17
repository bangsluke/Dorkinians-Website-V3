import Skeleton from "react-loading-skeleton";
import Image from "next/image";

export default function TOTWPitchSkeleton() {
	// Using 4-4-2 formation as default
	const playerPositions = [
		{ x: 50, y: 90, isGoalkeeper: true }, // GK
		{ x: 25, y: 70 }, // DEF 1
		{ x: 40, y: 70 }, // DEF 2
		{ x: 60, y: 70 }, // DEF 3
		{ x: 75, y: 70 }, // DEF 4
		{ x: 25, y: 45 }, // MID 1
		{ x: 40, y: 45 }, // MID 2
		{ x: 60, y: 45 }, // MID 3
		{ x: 75, y: 45 }, // MID 4
		{ x: 40, y: 25 }, // FWD 1
		{ x: 60, y: 25 }, // FWD 2
	];

	return (
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

			{/* Player Skeletons */}
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
					<div className='flex flex-col items-center'>
						<div className='relative w-12 h-12 md:w-14 md:h-14 mb-1'>
							<Skeleton circle height={56} width={56} />
						</div>
						<div 
							className='bg-green-600 text-white rounded text-center' 
							style={{ 
								backgroundColor: 'rgba(28, 136, 65, 0.95)',
								width: '60px',
								minWidth: '60px',
								maxWidth: '60px',
								height: '44px',
								overflow: 'hidden',
								wordWrap: 'break-word',
								paddingLeft: '6px',
								paddingRight: '6px',
								paddingTop: '4px',
								paddingBottom: '4px',
								display: 'flex',
								flexDirection: 'column',
								justifyContent: 'center',
								alignItems: 'center',
							}}
						>
							<Skeleton height={14} width={50} className="mb-1" />
							<Skeleton height={14} width={30} />
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
