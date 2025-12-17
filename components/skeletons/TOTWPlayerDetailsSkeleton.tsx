import Skeleton from "react-loading-skeleton";
import { XMarkIcon } from "@heroicons/react/24/outline";

export default function TOTWPlayerDetailsSkeleton() {
	return (
		<div className='fixed inset-0 z-50' style={{ backgroundColor: 'rgba(15, 15, 15, 0.5)' }}>
			<div
				className='fixed inset-0 flex flex-col'
				style={{ backgroundColor: 'rgb(14, 17, 15)' }}
			>
				{/* Header with Close button */}
				<div className='flex-shrink-0 flex justify-between items-center p-4 border-b border-white/20'>
					<Skeleton height={32} width={200} className="mx-auto" />
					<button className='text-white hover:text-gray-200 ml-4 flex-shrink-0'>
						<XMarkIcon className='h-6 w-6' />
					</button>
				</div>

				{/* Scrollable content */}
				<div 
					className='flex-1 overflow-y-auto min-h-0 player-detail-scrollable px-6 pt-4' 
					style={{ 
						WebkitOverflowScrolling: 'touch',
						paddingTop: '1rem',
						paddingBottom: '1rem'
					}}
				>
					{/* TOTW Appearances */}
					<div className='text-center mb-4'>
						<Skeleton height={16} width={200} className="mx-auto" />
					</div>

					{/* Match Details - 2 matches */}
					{[...Array(2)].map((_, matchIndex) => (
						<div key={matchIndex}>
							{/* White line break between fixtures (except for first fixture) */}
							{matchIndex > 0 && (
								<div className='border-t border-white my-6'></div>
							)}
							
							<div className={matchIndex > 0 ? 'mt-6' : 'mb-6'}>
								{/* Match Summary */}
								<div className='text-center mb-3'>
									<Skeleton height={16} width="80%" className="mx-auto mb-1" />
									<Skeleton height={20} width="60%" className="mx-auto" />
								</div>

								{/* Statistics Table */}
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
											{[...Array(5)].map((_, rowIndex) => (
												<tr key={rowIndex} className='border-b border-green-500'>
													<td className='py-2 px-2 text-xs md:text-sm'><Skeleton height={14} width="70%" /></td>
													<td className='text-center py-2 px-2'><Skeleton height={14} width={30} className="mx-auto" /></td>
													<td className='text-center py-2 px-2'><Skeleton height={14} width={30} className="mx-auto" /></td>
												</tr>
											))}
											<tr className='border-t-2 border-dorkinians-yellow font-bold'>
												<td className='py-2 px-2 text-xs md:text-sm'><Skeleton height={14} width={80} /></td>
												<td className='text-center py-2 px-2'></td>
												<td className='text-center py-2 px-2'><Skeleton height={14} width={30} className="mx-auto" /></td>
											</tr>
										</tbody>
									</table>
								</div>
							</div>
						</div>
					))}

					{/* Total Points */}
					<div className='mt-4 pt-4 pb-4 border-t-2 border-white'>
						<table className='w-full text-white'>
							<tbody>
								<tr className='font-bold text-lg'>
									<td className='py-2 px-2'><Skeleton height={20} width={100} /></td>
									<td className='text-center py-2 px-2'></td>
									<td className='text-center py-2 px-2'><Skeleton height={20} width={40} className="mx-auto" /></td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>

				{/* Close Button at Bottom */}
				<div className='flex-shrink-0 flex justify-center p-4 border-t border-white/20'>
					<Skeleton height={40} width={100} className="rounded-lg" />
				</div>
			</div>
		</div>
	);
}
