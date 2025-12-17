import Skeleton from "react-loading-skeleton";

export default function ScatterChartSkeleton() {
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-4 md:p-6'>
			<Skeleton height={20} width="40%" className="mb-4" />
			<div className='relative' style={{ height: '320px' }}>
				{/* Grid background */}
				<div className='absolute inset-0'>
					<div className='h-full flex flex-col justify-between'>
						{[...Array(5)].map((_, i) => (
							<div key={i} className='border-t border-white/10' />
						))}
					</div>
					<div className='absolute inset-0 flex justify-between'>
						{[...Array(6)].map((_, i) => (
							<div key={i} className='border-l border-white/10' />
						))}
					</div>
				</div>
				{/* Scatter points */}
				<div className='absolute inset-0'>
					{[
						{ top: '25%', left: '15%' },
						{ top: '40%', left: '30%' },
						{ top: '60%', left: '50%' },
						{ top: '35%', left: '65%' },
						{ top: '70%', left: '25%' },
						{ top: '50%', left: '75%' },
						{ top: '30%', left: '45%' },
						{ top: '65%', left: '60%' },
						{ top: '45%', left: '20%' },
						{ top: '55%', left: '80%' },
					].map((pos, i) => (
						<Skeleton 
							key={i} 
							circle 
							height={12} 
							width={12} 
							style={{ 
								position: 'absolute', 
								top: pos.top, 
								left: pos.left 
							}} 
						/>
					))}
				</div>
			</div>
		</div>
	);
}
