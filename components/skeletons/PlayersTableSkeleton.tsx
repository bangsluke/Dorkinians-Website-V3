import Skeleton from "react-loading-skeleton";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

export default function PlayersTableSkeleton() {
	return (
		<div className='overflow-x-auto'>
			<table className='w-full text-white'>
				<thead>
					<tr className='border-b-2 border-dorkinians-yellow'>
						<th className='w-[8.33%] text-left py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={30} /></th>
						<th className='text-left py-2 px-2 text-xs md:text-sm'><Skeleton height={16} width={120} /></th>
						<th className='w-[8.33%] text-right py-2 px-2 text-xs md:text-sm whitespace-nowrap'><Skeleton height={16} width={60} className="ml-auto" /></th>
					</tr>
				</thead>
				<tbody>
					{[...Array(6)].map((_, index) => {
						const isLastPlayer = index === 5;
						const showSummaryStats = index % 2 === 0; // Show summary stats on even rows
						return (
							<tr
								key={index}
								className={`cursor-pointer hover:bg-gray-800 transition-colors ${isLastPlayer ? '' : 'border-b border-green-500'}`}
								style={{
									background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))',
								}}
							>
								<td colSpan={3} className='p-0 relative'>
									<div className='flex flex-col'>
										<div className='flex items-center py-2 px-2'>
											<div className='w-1/12'>
												<Skeleton height={20} width={30} />
											</div>
											<div className='flex-1'>
												<Skeleton height={20} width="70%" />
											</div>
											<div className='w-1/12 text-center'>
												<Skeleton height={20} width={60} className="ml-auto" />
											</div>
										</div>
										{showSummaryStats && (
											<div className='py-1 px-2 pl-6 md:pl-8 pb-4'>
												<div className='flex flex-nowrap gap-x-2 md:gap-x-3 gap-y-1 text-[0.6rem] md:text-[0.7rem] justify-end pl-3 md:pl-4'>
													<Skeleton height={12} width={40} />
													<Skeleton height={12} width={35} />
													<Skeleton height={12} width={40} />
													<Skeleton height={12} width={45} />
													<Skeleton height={12} width={70} />
												</div>
											</div>
										)}
										<div className='absolute bottom-1 left-2'>
											<ChevronDownIcon className='h-4 w-4 text-yellow-300 opacity-50' />
										</div>
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
