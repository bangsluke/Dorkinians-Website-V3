import Skeleton from "react-loading-skeleton";

interface PieChartSkeletonProps {
	/** Omit the card wrapper and title when rendering inside an existing titled container. */
	noContainer?: boolean;
}

export default function PieChartSkeleton({ noContainer = false }: PieChartSkeletonProps) {
	// 220px matches the ResponsiveContainer height used by the live pie charts.
	const chart = (
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
	);

	if (noContainer) {
		return chart;
	}

	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<Skeleton height={20} width="40%" className="mb-2" />
			{chart}
		</div>
	);
}
