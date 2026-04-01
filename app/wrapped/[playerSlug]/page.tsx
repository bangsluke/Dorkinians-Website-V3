import WrappedExperience from "@/components/wrapped/WrappedExperience";
import { getPublicSiteRoot } from "@/lib/utils/publicSiteUrl";
import { wrappedSlugToPlayerName } from "@/lib/wrapped/slug";
import type { Metadata } from "next";
import { Suspense } from "react";

type WrappedPageProps = {
	params: Promise<{ playerSlug: string }>;
	searchParams: Promise<{ season?: string }>;
};

export async function generateMetadata({ params, searchParams }: WrappedPageProps): Promise<Metadata> {
	const { playerSlug } = await params;
	const sp = await searchParams;
	const season = typeof sp.season === "string" ? sp.season : undefined;
	let decoded = playerSlug;
	try {
		decoded = decodeURIComponent(playerSlug);
	} catch {
		decoded = playerSlug;
	}
	const name = wrappedSlugToPlayerName(decoded);
	const base = getPublicSiteRoot();
	const seasonQ = season ? `?season=${encodeURIComponent(season)}` : "";
	const pathSlug = encodeURIComponent(playerSlug);
	const pageUrl = `${base}/wrapped/${pathSlug}${seasonQ}`;
	const ogImageUrl = `${base}/api/wrapped/${pathSlug}/og/1${seasonQ}`;
	const title = name ? `${name} - Dorkinians Wrapped` : "Dorkinians Wrapped";

	return {
		title,
		description: name ? `Season Wrapped for ${name} (Dorkinians FC Stats).` : "Dorkinians Season Wrapped.",
		openGraph: {
			title,
			description: name ? `View ${name}'s season story on Dorkinians FC Stats.` : "Season Wrapped.",
			url: pageUrl,
			images: [{ url: ogImageUrl, width: 1200, height: 630, alt: "Dorkinians Wrapped" }],
			type: "website",
		},
		twitter: {
			card: "summary_large_image",
			title,
			images: [ogImageUrl],
		},
	};
}

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
