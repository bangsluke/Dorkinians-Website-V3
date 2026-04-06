import Skeleton, { SkeletonTheme } from "react-loading-skeleton";

type StatCardSkeletonProps = {
	count?: number;
	/** Grid only - use inside an existing frosted card (e.g. Key Performance Stats) so layout matches loaded content */
	variant?: "full" | "embedded";
};

export default function StatCardSkeleton({ count = 6, variant = "full" }: StatCardSkeletonProps) {
	const grid = (
		<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
			<div className='grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4'>
				{[...Array(count)].map((_, i) => (
					<div key={i} className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
						<Skeleton circle height={40} width={40} className="flex-shrink-0" />
						<div className='flex-1 min-w-0'>
							<Skeleton height={14} width="60%" className="mb-1" />
							<Skeleton height={20} width="80%" />
						</div>
					</div>
				))}
			</div>
		</SkeletonTheme>
	);
	if (variant === "embedded") return grid;
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
				<Skeleton height={20} width="60%" className="mb-3" />
			</SkeletonTheme>
			{grid}
		</div>
	);
}
