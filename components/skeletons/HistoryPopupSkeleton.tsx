import Skeleton from "react-loading-skeleton";

export default function HistoryPopupSkeleton() {
	return (
		<div className='overflow-x-auto'>
			<table className='w-full text-white'>
				<thead>
					<tr className='border-b-2 border-dorkinians-yellow'>
						<th className='text-left py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={60} /></th>
						<th className='text-left py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={80} /></th>
					</tr>
				</thead>
				<tbody>
					{[...Array(6)].map((_, index) => (
						<tr key={index} className='border-b border-green-500'>
							<td className='py-2 px-2 text-xs md:text-sm'><Skeleton height={14} width="40%" /></td>
							<td className='py-2 px-2 text-xs md:text-sm'><Skeleton height={14} width="60%" /></td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}


