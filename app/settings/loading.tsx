import Skeleton from "react-loading-skeleton";

export default function SettingsLoading() {
	return (
		<div className='mx-auto w-full max-w-3xl space-y-4 px-4 py-8' data-testid='settings-loading'>
			<Skeleton className='h-8 w-40 rounded' containerClassName='leading-none' />
			<Skeleton className='h-24 w-full rounded' />
			<Skeleton className='h-24 w-full rounded' />
			<Skeleton className='h-24 w-full rounded' />
		</div>
	);
}
