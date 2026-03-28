import WrappedExperience from "@/components/wrapped/WrappedExperience";
import { Suspense } from "react";

function WrappedFallback() {
	return (
		<div className='min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1c2418] to-[#2a3220] text-white'>
			<p className='text-white/70'>Loading…</p>
		</div>
	);
}

export default async function WrappedPage({ params }: { params: Promise<{ playerSlug: string }> }) {
	const { playerSlug } = await params;
	return (
		<Suspense fallback={<WrappedFallback />}>
			<WrappedExperience playerSlug={playerSlug} />
		</Suspense>
	);
}
