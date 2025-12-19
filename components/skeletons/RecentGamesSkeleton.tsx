import Skeleton from "react-loading-skeleton";

export default function RecentGamesSkeleton() {
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 mb-4'>
			{/* Title */}
			<Skeleton height={20} width="40%" className="mb-2" />
			
			{/* Toggle text */}
			<div className='w-full mb-2 text-center'>
				<Skeleton height={16} width="35%" className="inline-block" />
			</div>

			{/* Main result boxes row */}
			<div className='flex gap-1 w-full'>
				{[...Array(10)].map((_, i) => (
					<div key={i} className='flex-1 aspect-square rounded overflow-hidden'>
						<Skeleton className='w-full h-full' />
					</div>
				))}
			</div>
			
			{/* Summary text */}
			<div className='mt-2 text-center'>
				<Skeleton height={16} width="60%" className="mx-auto" />
			</div>
		</div>
	);
}
