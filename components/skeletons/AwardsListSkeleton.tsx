import Skeleton from "react-loading-skeleton";

export default function AwardsListSkeleton() {
	return (
		<div className='space-y-4'>
			<div>
				<Skeleton height={16} width="30%" className="mb-2" />
				<ul className='space-y-1'>
					{[...Array(3)].map((_, i) => {
						const widths = ['65%', '75%', '70%'];
						return (
							<li key={i}>
								<Skeleton height={16} width={widths[i]} />
							</li>
						);
					})}
				</ul>
			</div>
			<div className='pt-2 border-t border-white/10 space-y-2'>
				<Skeleton height={16} width="70%" />
				<Skeleton height={16} width="75%" />
				<Skeleton height={16} width="80%" />
			</div>
		</div>
	);
}
