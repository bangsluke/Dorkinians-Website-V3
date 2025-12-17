import Skeleton from "react-loading-skeleton";

export default function PieChartSkeleton() {
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<Skeleton height={20} width="40%" className="mb-2" />
			<div className='flex items-center justify-center' style={{ height: '220px' }}>
				<div className='relative'>
					<Skeleton circle height={180} width={180} />
					{/* Labels around circle */}
					<div className='absolute inset-0'>
						<Skeleton height={14} width={60} style={{ position: 'absolute', top: '20%', left: '110%' }} />
						<Skeleton height={14} width={60} style={{ position: 'absolute', bottom: '20%', right: '110%' }} />
						<Skeleton height={14} width={60} style={{ position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)' }} />
					</div>
				</div>
			</div>
		</div>
	);
}
