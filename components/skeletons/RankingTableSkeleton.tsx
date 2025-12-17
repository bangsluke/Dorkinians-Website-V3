import Skeleton from "react-loading-skeleton";

export default function RankingTableSkeleton() {
	return (
		<>
			<h2 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-1'>
				<Skeleton height={24} width="50%" />
			</h2>
			<p className='text-white text-sm md:text-base mb-4 text-center'>
				<Skeleton height={16} width="40%" className="mx-auto" />
			</p>
			<div className='overflow-x-auto'>
				<table className='w-full text-white'>
					<thead>
						<tr className='border-b-2 border-dorkinians-yellow'>
							<th className='w-[8.33%] text-left py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={30} /></th>
							<th className='text-left py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={100} /></th>
							<th className='w-[8.33%] text-right py-2 px-2 text-xs md:text-sm whitespace-nowrap'><Skeleton height={16} width={60} className="ml-auto" /></th>
						</tr>
					</thead>
					<tbody>
						{[...Array(6)].map((_, index) => {
							const isSelected = index === 3; // Highlight 4th row as selected player
							return (
								<tr
									key={index}
									className={`border-b border-green-500 ${isSelected ? 'bg-yellow-400/20' : ''}`}
									style={isSelected ? {} : {
										background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))',
									}}
								>
									<td className='py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={30} /></td>
									<td className='py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width="60%" /></td>
									<td className='text-right py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={60} className="ml-auto" /></td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</>
	);
}
