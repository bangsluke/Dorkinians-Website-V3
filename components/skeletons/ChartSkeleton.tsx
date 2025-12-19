import Skeleton from "react-loading-skeleton";

interface ChartSkeletonProps {
	showDropdown?: boolean;
	noContainer?: boolean;
	showTrend?: boolean;
}

export default function ChartSkeleton({ showDropdown = true, showTrend = true, noContainer = false }: ChartSkeletonProps) {
	const content = (
		<>
			{/* Section Title and Dropdown Title */}
			<div className='flex items-center justify-between w-full mb-2 gap-2'>
				{/* Section Title */}
				<div className='flex-1 max-w-[50%]'>
					<Skeleton height={20} width="80%" />
				</div>
				{/* Dropdown Title */}
				{showDropdown && (
					<div className='flex-1 max-w-[45%]'>
						<Skeleton height={36} width="100%" className="rounded-md" />
					</div>
				)}
			</div>
			
			{showTrend && (
			<div className='mx-auto mb-2 text-center'>
				<Skeleton height={16} width="35%" />
			</div>
			)}
			<div className='relative' style={{ height: '240px' }}>
				{/* Y-axis */}
				<div className='absolute left-0 top-0 bottom-0 flex flex-col justify-between py-2'>
					{[...Array(5)].map((_, i) => (
						<Skeleton key={i} height={12} width={30} />
					))}
				</div>
				{/* Chart area with grid pattern */}
				<div className='ml-8 mr-4 h-full flex flex-col justify-between'>
					<div className='flex-1 relative'>
						{/* Grid lines */}
						<div className='absolute inset-0 flex flex-col justify-between'>
							{[...Array(4)].map((_, i) => (
								<div key={i} className='border-t border-white/10' />
							))}
						</div>
						{/* Bars */}
						<div className='absolute bottom-0 left-0 right-0 flex items-end justify-around gap-1 px-2'>
							{[...Array(6)].map((_, i) => {
								const barHeights = [120, 80, 140, 100, 90, 110]; // Fixed heights for consistency
								return (
									<Skeleton key={i} height={barHeights[i]} width="12%" />
								);
							})}
						</div>
					</div>
					{/* X-axis */}
					<div className='flex justify-around mt-2'>
						{[...Array(6)].map((_, i) => (
							<Skeleton key={i} height={12} width={40} />
						))}
					</div>
				</div>
			</div>
		</>
	);

	if (noContainer) {
		return content;
	}

	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			{content}
		</div>
	);
}
