import Skeleton from "react-loading-skeleton";

export default function AwardsTableSkeleton() {
	return (
		<div className='overflow-x-auto -mx-6 px-6'>
			<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
				<thead className='sticky top-0 z-10'>
					<tr className='bg-white/20'>
						<th className='px-2 md:px-4 py-2 md:py-3 text-left'><Skeleton height={16} width={120} /></th>
						<th className='px-2 md:px-4 py-2 md:py-3 text-center'><Skeleton height={16} width={100} /></th>
					</tr>
				</thead>
				<tbody>
					{[...Array(16)].map((_, index) => (
						<tr key={index} className='border-b border-white/10 hover:bg-white/5 transition-colors'>
							<td className='px-2 md:px-4 py-2 md:py-3'><Skeleton height={14} width="90%" /></td>
							<td className='px-2 md:px-4 py-2 md:py-3 text-center'>
								<Skeleton height={14} width="70%" />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}


