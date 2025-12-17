import Skeleton from "react-loading-skeleton";

export default function TOTWSummarySkeleton() {
	return (
		<div className='flex flex-row flex-nowrap gap-4 md:gap-12 mb-6 justify-center'>
			{/* Left section - TOTW Total Points */}
			<div className='text-center flex flex-col md:w-auto'>
				<div className='h-5 mb-2 flex items-center justify-center'>
					<Skeleton height={20} width={150} />
				</div>
				<div className='flex-1 md:flex-none flex items-end md:items-center justify-center'>
					<Skeleton height={120} width={100} />
				</div>
				<div className='mt-2'>
					<Skeleton height={16} width={200} className="mx-auto" />
				</div>
			</div>
			{/* Right section - Star Man */}
			<div className='flex flex-col items-center flex-shrink-0'>
				<div className='h-5 mb-2 flex items-center justify-center'>
					<Skeleton height={20} width={100} />
				</div>
				<div className='flex flex-col items-center gap-2'>
					<Skeleton circle height={56} width={56} />
					<div className='px-4 py-1 rounded text-center' style={{ background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))' }}>
						<Skeleton height={16} width={120} className="mb-1" />
						<Skeleton height={16} width={60} />
					</div>
				</div>
			</div>
		</div>
	);
}
