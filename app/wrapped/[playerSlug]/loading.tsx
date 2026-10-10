import Skeleton from "react-loading-skeleton";

export default function WrappedLoading() {
	return (
		<div className='flex min-h-[70vh] w-full flex-col items-center justify-center gap-4 px-4' data-testid='wrapped-loading'>
			<Skeleton className='h-16 w-16 rounded-full' containerClassName='leading-none' />
			<Skeleton className='h-6 w-48 rounded' containerClassName='leading-none' />
			<p className='text-sm text-[var(--color-text-secondary,#a3a3a3)]'>Loading season wrapped…</p>
		</div>
	);
}
