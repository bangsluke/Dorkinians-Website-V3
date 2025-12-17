import Skeleton from "react-loading-skeleton";

export default function RecentGamesSkeleton() {
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 mb-4'>
			<Skeleton height={20} width="40%" className="mb-2" />
			<div className='flex gap-1 w-full'>
				{[...Array(10)].map((_, i) => (
					<Skeleton key={i} className='flex-1 aspect-square rounded' />
				))}
			</div>
			<div className='flex gap-1 w-full mt-1'>
				{[...Array(10)].map((_, i) => (
					<Skeleton key={i} className='flex-1 aspect-square rounded' />
				))}
			</div>
			<div className='flex gap-1 w-full mt-1'>
				{[...Array(10)].map((_, i) => (
					<Skeleton key={i} className='flex-1 aspect-square rounded' />
				))}
			</div>
		</div>
	);
}
