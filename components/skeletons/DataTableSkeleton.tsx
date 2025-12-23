import Skeleton from "react-loading-skeleton";

export default function DataTableSkeleton() {
	return (
		<div className='mb-4'>
			<div className='overflow-x-auto'>
				<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
					<thead className='sticky top-0 z-10'>
						<tr className='bg-white/20'>
							<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>
								<Skeleton height={16} width={40} />
							</th>
							<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>
								<Skeleton height={16} width={80} />
							</th>
							<th className='px-2 md:px-4 py-2 md:py-3 text-right text-white font-semibold text-xs md:text-sm'>
								<Skeleton height={16} width={60} className="ml-auto" />
							</th>
						</tr>
					</thead>
					<tbody>
						{[...Array(10)].map((_, i) => (
							<tr key={i} className='border-b border-white/10'>
								<td className='px-2 md:px-4 py-2 md:py-3'>
									<Skeleton height={20} width={20} />
								</td>
								<td className='px-2 md:px-4 py-2 md:py-3'>
									<Skeleton height={16} width="70%" />
								</td>
								<td className='px-2 md:px-4 py-2 md:py-3 text-right'>
									<Skeleton height={16} width={60} className="ml-auto" />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

