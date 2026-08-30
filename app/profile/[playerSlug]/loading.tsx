import ProfilePageSkeleton from "@/components/profile/ProfilePageSkeleton";

export default function ProfileLoading() {
	return (
		<div className='h-full px-4 py-6 md:px-8 md:py-8' data-testid='player-profile-page'>
			<div className='mx-auto w-full max-w-5xl space-y-4 pb-6 md:pb-8'>
				<div className='flex flex-col items-center justify-center text-center gap-2'>
					<div className='h-8 w-48 rounded bg-white/10 animate-pulse' aria-hidden='true' />
				</div>
				<ProfilePageSkeleton />
			</div>
		</div>
	);
}
