import Skeleton from "react-loading-skeleton";

export default function LeagueTableSkeleton() {
	const teamNames = ['65%', '70%', '75%', '68%', '72%', '69%', '73%', '71%', '74%', '67%'];
	
	return (
		<div className='w-full'>
			{/* Title section */}
			<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-2 text-center'>
				<Skeleton height={24} width="40%" className="mx-auto" />
			</h3>
			<div className='text-center text-sm text-gray-400 mb-2'>
				<Skeleton height={20} width="30%" className="mx-auto" />
			</div>
			<div className='text-center text-sm text-gray-400 mb-4'>
				<Skeleton height={16} width="25%" className="mx-auto" />
			</div>

			{/* Table */}
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
						{[...Array(10)].map((_, i) => {
							const isDorkinians = i === 3; // Highlight 4th row as Dorkinians
							return (
								<tr
									key={i}
									className={`border-b border-white/10 transition-colors ${
										isDorkinians
											? "bg-dorkinians-yellow/20 font-semibold"
											: i % 2 === 0
												? "bg-gray-800/30"
												: ""
									} hover:bg-white/5`}
								>
									<td className='px-1.5 py-2'><Skeleton height={14} width={20} /></td>
									<td className='px-2 py-2'><Skeleton height={14} width={teamNames[i]} /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={25} className="mx-auto" /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={25} className="mx-auto" /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={25} className="mx-auto" /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={25} className="mx-auto" /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={25} className="mx-auto" /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={25} className="mx-auto" /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={30} className="mx-auto" /></td>
									<td className='px-2 py-2 text-center'><Skeleton height={14} width={30} className="mx-auto" /></td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
