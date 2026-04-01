"use client";

import Link from "next/link";
import { useNavigationStore } from "@/lib/stores/navigation";
import { playerNameToWrappedSlug } from "@/lib/wrapped/slug";

/**
 * End-of-season callout linking to Season Wrapped for the selected player.
 * Set `NEXT_PUBLIC_SEASON_WRAPPED_ACTIVE=false` to hide without a deploy change (rebuild still required for env).
 */
function safePlayerName(raw: unknown): string | null {
	if (raw == null) return null;
	if (typeof raw === "string") {
		const t = raw.trim();
		return t.length > 0 ? t : null;
	}
	return null;
}

export default function SeasonWrappedBanner() {
	const rawName = useNavigationStore((s) => s.selectedPlayer);
	const isPlayerSelected = useNavigationStore((s) => s.isPlayerSelected);

	if (process.env.NEXT_PUBLIC_SEASON_WRAPPED_ACTIVE === "false") {
		return null;
	}

	const playerName = safePlayerName(rawName);
	if (!isPlayerSelected || !playerName) {
		return null;
	}

	const slug = playerNameToWrappedSlug(playerName);
	if (!slug) {
		return null;
	}

	const href = `/wrapped/${slug}`;
	const firstName = playerName.split(/\s+/).find((part) => part.length > 0) ?? playerName;

	return (
		<div
			data-testid='season-wrapped-banner'
			className='mb-4 rounded-xl border border-[rgba(232,197,71,0.25)] bg-[rgba(30,35,25,0.65)] px-4 py-3 text-center'>
			<p className='text-[#E8C547] text-xs font-semibold uppercase tracking-wide'>Season Wrapped</p>
			<p className='text-white/85 text-sm mt-1'>See your season story - slides you can share.</p>
			<Link
				href={href}
				className='inline-block mt-2 text-sm font-medium text-[#5DCAA5] hover:underline'
				data-testid='season-wrapped-banner-link'>
				Open {firstName}&apos;s Wrapped →
			</Link>
		</div>
	);
}
