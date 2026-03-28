"use client";

import Link from "next/link";
import { useNavigationStore } from "@/lib/stores/navigation";
import { playerNameToWrappedSlug } from "@/lib/wrapped/slug";

/**
 * End-of-season callout linking to Season Wrapped for the selected player.
 * Set `NEXT_PUBLIC_SEASON_WRAPPED_ACTIVE=false` to hide without a deploy change (rebuild still required for env).
 */
export default function SeasonWrappedBanner() {
	if (process.env.NEXT_PUBLIC_SEASON_WRAPPED_ACTIVE === "false") {
		return null;
	}

	const selectedPlayer = useNavigationStore((s) => s.selectedPlayer);
	const isPlayerSelected = useNavigationStore((s) => s.isPlayerSelected);

	if (!isPlayerSelected || !selectedPlayer) {
		return null;
	}

	const slug = playerNameToWrappedSlug(selectedPlayer);
	const href = `/wrapped/${slug}`;

	return (
		<div
			data-testid='season-wrapped-banner'
			className='mb-4 rounded-xl border border-[rgba(232,197,71,0.25)] bg-[rgba(30,35,25,0.65)] px-4 py-3 text-center'>
			<p className='text-[#E8C547] text-xs font-semibold uppercase tracking-wide'>Season Wrapped</p>
			<p className='text-white/85 text-sm mt-1'>See your season story — slides you can share.</p>
			<Link
				href={href}
				className='inline-block mt-2 text-sm font-medium text-[#5DCAA5] hover:underline'
				data-testid='season-wrapped-banner-link'>
				Open {selectedPlayer.split(" ")[0]}&apos;s Wrapped →
			</Link>
		</div>
	);
}
