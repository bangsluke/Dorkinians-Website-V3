import { Suspense } from "react";
import PlayerProfileView from "@/components/profile/PlayerProfileView";

function ProfileFallback() {
	return (
		<div className='min-h-screen flex items-center justify-center text-white/70'>
			Loading profile...
		</div>
	);
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ playerSlug: string }> }) {
	const { playerSlug } = await params;
	return (
		<Suspense fallback={<ProfileFallback />}>
			<PlayerProfileView playerSlug={playerSlug} />
		</Suspense>
	);
}
