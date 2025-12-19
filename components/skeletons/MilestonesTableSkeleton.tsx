import Skeleton from "react-loading-skeleton";

export default function MilestonesTableSkeleton() {
	return (
		<div className='overflow-x-auto overflow-y-auto max-h-96'>
			<table className='w-full text-white'>
				<thead>
					<tr className='border-b-2 border-dorkinians-yellow'>
						<th className='text-left py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={100} /></th>
						<th className='text-center py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={120} className="mx-auto" /></th>
						<th className='text-center py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={80} className="mx-auto" /></th>
					</tr>
				</thead>
				<tbody>
					{[...Array(5)].map((_, index) => {
						const isLastRow = index === 4;
						return (
							<tr
								key={index}
								className={`hover:bg-gray-800 transition-colors ${isLastRow ? '' : 'border-b border-green-500'}`}
								style={{
									background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))',
								}}
							>
								<td className='py-2 px-2 text-xs md:text-sm'><Skeleton height={14} width="70%" /></td>
								<td className='py-2 px-2 text-center text-xs md:text-sm'><Skeleton height={14} width={120} className="mx-auto" /></td>
								<td className='py-2 px-2 text-center text-xs md:text-sm'><Skeleton height={14} width={80} className="mx-auto" /></td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}


