import React from "react";
import Skeleton from "react-loading-skeleton";

export default function PlayerStatsExpansionSkeleton() {
	return (
		<div className='space-y-4'>
			{/* Monthly Stats Summary */}
			<div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
				{[...Array(4)].map((_, i) => (
					<div key={i} className='text-center'>
						<Skeleton height={14} width={80} className="mx-auto mb-1" />
						<Skeleton height={24} width={40} className="mx-auto" />
					</div>
				))}
			</div>

			{/* FTP Breakdown Table */}
			<div className='overflow-x-auto'>
				<table className='w-full text-white'>
					<thead>
						<tr className='border-b-2 border-dorkinians-yellow'>
							<th className='text-left py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={80} /></th>
							<th className='text-center py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={50} className="mx-auto" /></th>
							<th className='text-center py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={50} className="mx-auto" /></th>
						</tr>
					</thead>
					<tbody>
						{[...Array(2)].map((_, matchIndex) => (
							<React.Fragment key={matchIndex}>
								{matchIndex > 0 && (
									<tr>
										<td colSpan={3} className='py-2 border-t border-gray-600'></td>
									</tr>
								)}
								{/* Match Details Header */}
								<tr>
									<td colSpan={3} className='py-2 px-2'>
										<div className='text-center mb-2'>
											<Skeleton height={14} width="60%" className="mx-auto mb-1" />
											<Skeleton height={16} width="80%" className="mx-auto mb-1" />
											<Skeleton height={18} width="50%" className="mx-auto" />
										</div>
									</td>
								</tr>
								{/* Stat rows */}
								{[...Array(5)].map((_, statIndex) => (
									<tr key={statIndex} className='border-b border-green-500'>
										<td className='py-2 px-2 text-xs md:text-sm'><Skeleton height={14} width="70%" /></td>
										<td className='text-center py-2 px-2 text-xs md:text-sm'><Skeleton height={14} width={30} className="mx-auto" /></td>
										<td className='text-center py-2 px-2 text-xs md:text-sm'><Skeleton height={14} width={30} className="mx-auto" /></td>
									</tr>
								))}
								{/* Match total row */}
								<tr className='border-t-2 border-dorkinians-yellow font-bold'>
									<td className='py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={80} /></td>
									<td className='text-center py-2 px-2'></td>
									<td className='text-center py-2 px-2'><Skeleton height={16} width={30} className="mx-auto" /></td>
								</tr>
							</React.Fragment>
						))}
						{/* Monthly Total */}
						<tr className='border-t-2 border-white font-bold text-lg'>
							<td className='py-2 px-2 text-xs md:text-sm'><Skeleton height={20} width={100} /></td>
							<td className='text-center py-2 px-2'></td>
							<td className='text-center py-2 px-2'><Skeleton height={20} width={40} className="mx-auto" /></td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}
