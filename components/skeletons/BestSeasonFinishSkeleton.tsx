import Skeleton from "react-loading-skeleton";

export default function BestSeasonFinishSkeleton() {
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<Skeleton height={20} width="50%" className="mb-4" />
			{/* Season and division */}
			<div className='text-center mb-4'>
				<Skeleton height={24} width="40%" className="mx-auto mb-1" />
				<Skeleton height={24} width="50%" className="mx-auto" />
			</div>
			{/* Captains */}
			<div className='mb-4 text-center'>
				<Skeleton height={16} width="60%" className="mx-auto" />
			</div>
			{/* League Table */}
			<div className='overflow-x-auto -mx-3 md:-mx-6 px-3 md:px-6'>
				<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
					<thead className='sticky top-0 z-10'>
						<tr className='bg-white/20'>
							<th className='w-8 px-1.5 py-2 text-left'><Skeleton height={14} width={20} /></th>
							<th className='px-2 py-2 text-left'><Skeleton height={14} width={60} /></th>
							<th className='px-2 py-2 text-center'><Skeleton height={14} width={15} /></th>
							<th className='px-2 py-2 text-center'><Skeleton height={14} width={15} /></th>
							<th className='px-2 py-2 text-center'><Skeleton height={14} width={15} /></th>
							<th className='px-2 py-2 text-center'><Skeleton height={14} width={15} /></th>
							<th className='px-2 py-2 text-center'><Skeleton height={14} width={15} /></th>
							<th className='px-2 py-2 text-center'><Skeleton height={14} width={15} /></th>
							<th className='px-2 py-2 text-center'><Skeleton height={14} width={20} /></th>
							<th className='px-2 py-2 text-center'><Skeleton height={14} width={20} /></th>
						</tr>
					</thead>
					<tbody>
						{[...Array(8)].map((_, i) => {
							const teamWidths = ['65%', '70%', '75%', '68%', '72%', '69%', '73%', '71%'];
							return (
								<tr key={i} className='border-b border-white/10'>
									<td className='px-1.5 py-2'><Skeleton height={14} width={20} /></td>
									<td className='px-2 py-2'><Skeleton height={14} width={teamWidths[i]} /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={20} className="mx-auto" /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={20} className="mx-auto" /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={20} className="mx-auto" /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={20} className="mx-auto" /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={25} className="mx-auto" /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={25} className="mx-auto" /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={30} className="mx-auto" /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={25} className="mx-auto" /></td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
