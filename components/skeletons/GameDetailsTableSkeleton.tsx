import Skeleton from "react-loading-skeleton";

export default function GameDetailsTableSkeleton() {
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<Skeleton height={20} width="40%" className="mb-4" />
			
			{/* CompType Table */}
			<div className='mb-6'>
				<table className='w-full text-white text-sm'>
					<thead>
						<tr className='border-b border-white/20'>
							<th className='text-left py-2 px-2'><Skeleton height={16} width={60} /></th>
							<th className='text-right py-2 px-2'><Skeleton height={16} width={50} className="ml-auto" /></th>
							<th className='text-right py-2 px-2'><Skeleton height={16} width={60} className="ml-auto" /></th>
						</tr>
					</thead>
					<tbody>
						{[...Array(3)].map((_, i) => (
							<tr key={i} className='border-b border-white/10'>
								<td className='py-2 px-2'>
									<div className='flex items-center gap-2'>
										<Skeleton height={24} width={80} className="rounded" />
										<Skeleton height={14} width={40} />
									</div>
								</td>
								<td className='text-right py-2 px-2'>
									<Skeleton height={14} width={30} className="ml-auto" />
								</td>
								<td className='text-right py-2 px-2'>
									<Skeleton height={14} width={40} className="ml-auto" />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			
			{/* Home/Away Table */}
			<div className='mb-6'>
				<table className='w-full text-white text-sm'>
					<thead>
						<tr className='border-b border-white/20'>
							<th className='text-left py-2 px-2'><Skeleton height={16} width={60} /></th>
							<th className='text-right py-2 px-2'><Skeleton height={16} width={50} className="ml-auto" /></th>
							<th className='text-right py-2 px-2'><Skeleton height={16} width={60} className="ml-auto" /></th>
						</tr>
					</thead>
					<tbody>
						{[...Array(2)].map((_, i) => (
							<tr key={i} className='border-b border-white/10'>
								<td className='py-2 px-2'>
									<Skeleton height={14} width={60} />
								</td>
								<td className='text-right py-2 px-2'>
									<Skeleton height={14} width={30} className="ml-auto" />
								</td>
								<td className='text-right py-2 px-2'>
									<Skeleton height={14} width={40} className="ml-auto" />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
