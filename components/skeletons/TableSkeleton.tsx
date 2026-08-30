import Skeleton from "react-loading-skeleton";

interface TableSkeletonProps {
	rows?: number;
}

export default function TableSkeleton({ rows = 3 }: TableSkeletonProps) {
	return (
		<div className='mb-6'>
			<table className='w-full text-white text-sm'>
				<thead>
					<tr className='border-b border-white/20'>
						<th className='text-left py-2 px-2'><Skeleton height={16} width={60} /></th>
						<th className='text-right py-2 px-2'><Skeleton height={16} width={50} className="ml-auto" /></th>
						<th className='text-right py-2 px-2'><Skeleton height={16} width={50} className="ml-auto" /></th>
					</tr>
				</thead>
				<tbody>
					{[...Array(rows)].map((_, i) => (
						<tr key={i} className='border-b border-white/10'>
							<td className='py-2 px-2'><Skeleton height={14} width={80} /></td>
							<td className='text-right py-2 px-2'><Skeleton height={14} width={40} className="ml-auto" /></td>
							<td className='text-right py-2 px-2'><Skeleton height={14} width={50} className="ml-auto" /></td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
