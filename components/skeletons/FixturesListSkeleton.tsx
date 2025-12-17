import Skeleton from "react-loading-skeleton";

export default function FixturesListSkeleton() {
	return (
		<div className='space-y-4'>
			{[...Array(4)].map((_, index) => (
				<div key={index} className='bg-white/10 backdrop-blur-sm rounded-lg p-4'>
					{/* Date */}
					<div className='text-center mb-2'>
						<Skeleton height={16} width={100} className="mx-auto" />
					</div>
					{/* Team vs Opposition */}
					<div className='text-center mb-2'>
						<Skeleton height={18} width="80%" className="mx-auto" />
					</div>
					{/* Result/Score */}
					<div className='text-center mb-3'>
						<Skeleton height={20} width="50%" className="mx-auto" />
					</div>
					{/* Goalscorers section */}
					<div className='mt-3 pt-3 border-t border-white/10'>
						<Skeleton height={14} width={80} className="mb-2" />
						<div className='space-y-1'>
							{[...Array(3)].map((_, i) => (
								<Skeleton key={i} height={14} width={120} />
							))}
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
