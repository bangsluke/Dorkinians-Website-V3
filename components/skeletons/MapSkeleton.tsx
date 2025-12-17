import Skeleton from "react-loading-skeleton";

export default function MapSkeleton() {
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<Skeleton height={20} width="40%" className="mb-4" />
			<div className='relative' style={{ height: '400px' }}>
				<Skeleton height="100%" className="rounded-lg" />
				{/* Marker placeholders */}
				<div className='absolute inset-0'>
					<Skeleton circle height={20} width={20} style={{ position: 'absolute', top: '30%', left: '40%' }} />
					<Skeleton circle height={20} width={20} style={{ position: 'absolute', top: '50%', left: '60%' }} />
					<Skeleton circle height={20} width={20} style={{ position: 'absolute', top: '70%', left: '35%' }} />
					<Skeleton circle height={20} width={20} style={{ position: 'absolute', top: '45%', left: '75%' }} />
				</div>
			</div>
		</div>
	);
}
