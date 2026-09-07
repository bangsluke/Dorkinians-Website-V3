import Skeleton from "react-loading-skeleton";

interface PageShellSkeletonProps {
	/** Mirrors the mobile sub-page dot indicators rendered by the swipeable page containers. */
	showSubPageDots?: boolean;
	/** Mirrors the season/team dropdown row most pages render under the title. */
	showFilters?: boolean;
	/** Number of placeholder content cards. */
	cards?: number;
}

/**
 * Route-level loading shell for the dynamically imported page containers. Reproduces the
 * shared page chrome (dots, title, filter row, card stack) so the layout is stable while
 * the page chunk downloads, instead of collapsing to a centred spinner.
 */
export default function PageShellSkeleton({ showSubPageDots = true, showFilters = true, cards = 3 }: PageShellSkeletonProps) {
	return (
		<div className='w-full' data-testid='page-shell-skeleton'>
			{showSubPageDots && (
				<div className='md:hidden flex justify-center space-x-3 pt-2.5 pb-0'>
					{[0, 1, 2].map((i) => (
						<div key={i} className='w-[6.4px] h-[6.4px] rounded-full bg-gray-400/40' />
					))}
				</div>
			)}
			<div className='flex flex-col p-2 md:p-4 md:max-w-2xl md:mx-auto lg:max-w-6xl w-full'>
				<div className='mb-3 flex justify-center'>
					<Skeleton className='h-7 w-52 rounded md:h-8' containerClassName='leading-none' />
				</div>
				{showFilters && (
					<div className='mb-4 flex flex-row justify-center gap-4 w-full'>
						<div className='w-full max-w-[14rem]'>
							<Skeleton height={36} className='rounded-md' />
						</div>
						<div className='w-full max-w-[14rem]'>
							<Skeleton height={36} className='rounded-md' />
						</div>
					</div>
				)}
				<div className='space-y-4'>
					{Array.from({ length: cards }).map((_, i) => (
						<div key={i} className='rounded-lg bg-white/10 backdrop-blur-sm p-2 md:p-4'>
							<Skeleton height={20} width='40%' className='mb-3' />
							<Skeleton height={120} className='rounded' />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
