import Skeleton from "react-loading-skeleton";

export default function RadarChartSkeleton() {
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<Skeleton height={20} width="40%" className="mb-2" />
			{/* Team visibility checkboxes skeleton */}
			<div className='mb-3 flex flex-wrap gap-3 justify-center bg-white/25 rounded-lg p-2'>
				{[...Array(6)].map((_, i) => (
					<div key={i} className='flex items-center gap-2'>
						<Skeleton height={16} width={16} className="rounded" />
						<Skeleton height={14} width={40} />
					</div>
				))}
			</div>
			{/* Radar chart placeholder */}
			<div className='chart-container -my-2' style={{ touchAction: 'pan-y', height: '300px', position: 'relative' }}>
				<div className='absolute inset-0 flex items-center justify-center'>
					<div className='relative' style={{ width: '250px', height: '250px' }}>
						{/* Center circle */}
						<div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'>
							<Skeleton circle height={40} width={40} />
						</div>
						{/* Axis lines radiating from center */}
						{[...Array(6)].map((_, i) => {
							const angle = (i * 60) - 90;
							const radian = (angle * Math.PI) / 180;
							const length = 100;
							
							return (
								<div
									key={i}
									className='absolute top-1/2 left-1/2'
									style={{
										width: '2px',
										height: `${length}px`,
										backgroundColor: 'var(--skeleton-base)',
										opacity: '0.3',
										transform: `translate(-50%, -50%) rotate(${angle}deg)`,
										transformOrigin: 'center top',
									}}
								/>
							);
						})}
						{/* Polygon shape - using positioned elements */}
						<div 
							className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
							style={{
								width: '180px',
								height: '180px',
								border: '2px solid',
								borderColor: 'var(--skeleton-highlight)',
								opacity: '0.4',
								clipPath: 'polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)',
								backgroundColor: 'var(--skeleton-base)',
								opacity: '0.2',
							}}
						/>
						{/* Labels around perimeter */}
						{[...Array(6)].map((_, i) => {
							const angle = (i * 60) - 90;
							const radian = (angle * Math.PI) / 180;
							const radius = 115;
							const x = 50 + (Math.cos(radian) * (radius / 125) * 50);
							const y = 50 + (Math.sin(radian) * (radius / 125) * 50);
							
							return (
								<div
									key={i}
									className='absolute'
									style={{
										left: `${x}%`,
										top: `${y}%`,
										transform: 'translate(-50%, -50%)',
									}}
								>
									<Skeleton height={14} width={60} />
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
