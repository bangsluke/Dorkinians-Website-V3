import Skeleton from "react-loading-skeleton";
import ProfilePageSkeleton from "@/components/profile/ProfilePageSkeleton";

export default function ProfileLoading() {
	return (
		<div className='h-full px-4 py-6 md:px-8 md:py-8' data-testid='player-profile-page'>
			<div className='mx-auto w-full max-w-5xl space-y-4 pb-6 md:pb-8'>
				<div className='flex flex-col items-center justify-center text-center gap-2'>
					{/* Tracks the h1's text-xl/md:text-2xl line height so the title does not jump on load. */}
					<Skeleton className='h-7 w-48 rounded md:h-8' containerClassName='leading-none' />
				</div>
				<ProfilePageSkeleton />
			</div>
		</div>
	);
}
