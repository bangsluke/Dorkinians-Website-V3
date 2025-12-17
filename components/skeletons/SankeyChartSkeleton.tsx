import Skeleton from "react-loading-skeleton";

export default function SankeyChartSkeleton() {
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<Skeleton height={20} width="40%" className="mb-2" />
			<div className='chart-container' style={{ touchAction: 'pan-y', height: '320px', position: 'relative' }}>
				<div className='absolute inset-0 flex items-center'>
					{/* Left node (Players) */}
					<div className='absolute left-4 top-1/2 -translate-y-1/2'>
						<Skeleton height={200} width={120} className="rounded" />
						<div className='mt-2 text-center'>
							<Skeleton height={14} width={80} className="mx-auto" />
						</div>
					</div>
					{/* Right nodes (Teams) */}
					<div className='absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3'>
						{[...Array(5)].map((_, i) => {
							const heights = [120, 80, 100, 90, 110];
							return (
								<div key={i} className='flex flex-col items-end'>
									<Skeleton height={heights[i]} width={100} className="rounded" />
									<div className='mt-2 text-center'>
										<Skeleton height={14} width={60} />
									</div>
								</div>
							);
						})}
					</div>
					{/* Flow connections */}
					<svg className='absolute inset-0 w-full h-full' style={{ overflow: 'visible', pointerEvents: 'none' }}>
						{[...Array(5)].map((_, i) => {
							const startX = 16; // Left node right edge
							const endX = 84; // Right nodes left edge
							const startY = 50;
							const teamHeights = [120, 80, 100, 90, 110];
							const teamPositions = [0, 20, 40, 60, 80];
							const endY = teamPositions[i] + (teamHeights[i] / 2);
							
							// Create curved path
							const controlX1 = startX + (endX - startX) * 0.3;
							const controlX2 = startX + (endX - startX) * 0.7;
							const path = `M ${startX}% ${startY}% C ${controlX1}% ${startY}%, ${controlX2}% ${endY}%, ${endX}% ${endY}%`;
							
							return (
								<path
									key={i}
									d={path}
									stroke="var(--skeleton-base)"
									strokeWidth="18"
									fill="none"
									opacity="0.3"
								/>
							);
						})}
					</svg>
				</div>
			</div>
		</div>
	);
}
