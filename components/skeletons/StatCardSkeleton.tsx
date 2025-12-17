import Skeleton from "react-loading-skeleton";

export default function StatCardSkeleton() {
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<Skeleton height={20} width="60%" className="mb-3" />
			<div className='grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4'>
				{[...Array(6)].map((_, i) => (
					<div key={i} className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
						<Skeleton circle height={40} width={40} className="flex-shrink-0" />
						<div className='flex-1 min-w-0'>
							<Skeleton height={14} width="60%" className="mb-1" />
							<Skeleton height={20} width="80%" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
