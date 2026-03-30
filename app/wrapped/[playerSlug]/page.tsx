import WrappedExperience from "@/components/wrapped/WrappedExperience";
import { Suspense } from "react";

function WrappedFallback() {
	return (
		<div className='relative min-h-screen min-h-[100dvh] w-full max-w-[100dvw] overflow-x-hidden overscroll-x-none flex items-center justify-center bg-[#1a2218] bg-gradient-to-b from-[#1c2418] to-[#2a3220] text-white'>
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
