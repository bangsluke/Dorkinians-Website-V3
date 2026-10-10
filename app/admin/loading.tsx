import Skeleton from "react-loading-skeleton";

export default function AdminLoading() {
	return (
		<div className='mx-auto w-full max-w-5xl space-y-4 px-4 py-8' data-testid='admin-loading'>
			<Skeleton className='h-8 w-48 rounded' containerClassName='leading-none' />
			<Skeleton className='h-40 w-full rounded' />
			<Skeleton className='h-40 w-full rounded' />
		</div>
	);
}