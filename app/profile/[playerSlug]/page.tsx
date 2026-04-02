import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PlayerProfileView from "@/components/profile/PlayerProfileView";
import { featureFlags } from "@/config/config";

export async function generateMetadata(): Promise<Metadata> {
	if (!featureFlags.playerProfile) {
		return { title: "Not found" };
	}
	return {};
}

function ProfileFallback() {
	return (
		<div className='min-h-screen flex items-center justify-center text-white/70'>
			Loading profile...
		</div>
	);
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ playerSlug: string }> }) {
	if (!featureFlags.playerProfile) {
		notFound();
	}
	const { playerSlug } = await params;
	return (
		<Suspense fallback={<ProfileFallback />}>
			<PlayerProfileView playerSlug={playerSlug} />
		</Suspense>
	);
}
