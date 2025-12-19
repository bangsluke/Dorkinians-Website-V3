import Skeleton from "react-loading-skeleton";

export default function TopPlayersTableSkeleton() {
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<div className='w-full mb-2'>
				<Skeleton height={20} width="40%" className="mb-2" />
				<Skeleton height={30} width="90%" className="rounded-md mb-2 ml-4" />
			</div>
			<div className='overflow-x-auto'>
				<table className='w-full text-white'>
					<thead>
						<tr className='border-b-2 border-dorkinians-yellow'>
							<th className='text-left py-2 px-2 text-xs md:text-sm w-auto'>
								<div className='flex items-center gap-2'>
									<div className='w-10 md:w-12'></div>
									<Skeleton height={14} width={80} />
								</div>
							</th>
							<th className='text-center py-2 px-2 text-xs md:text-sm w-20 md:w-24'>
								<Skeleton height={14} width={50} className="mx-auto" />
							</th>
						</tr>
					</thead>
					<tbody>
						{[...Array(5)].map((_, i) => (
							<tr key={i} className='border-b border-green-500'>
								<td className='py-2 px-2 align-top' colSpan={2}>
									<div className='flex flex-col'>
										<div className='flex items-center gap-2'>
											<div className='w-10 md:w-12'>
												<Skeleton height={20} width={30} />
											</div>
											<div className='flex-1'>
												<Skeleton height={20} width="70%" />
											</div>
											<div className='w-20 md:w-24 text-center'>
												<Skeleton height={20} width={50} />
											</div>
										</div>
										<div className='pt-1 pl-[3rem] md:pl-[3.5rem]'>
											<Skeleton height={12} width="60%" />
										</div>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
