"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BadgeDot from "@/components/stats/BadgeDot";
import PlayerBadgeMilestoneGrid, {
	type EarnedBadgeRow,
	type ProgressRow,
} from "@/components/stats/PlayerBadgeMilestoneGrid";
import { profileSlugToPlayerName } from "@/lib/profile/slug";
import { playerNameToWrappedSlug } from "@/lib/wrapped/slug";
import { selectBadgesForBar } from "@/lib/badges/evaluate";
import type { PlayerData } from "@/lib/stores/navigation";

type BadgePayload = {
	playerName: string;
	totalBadges: number;
	highestBadgeTier: string | null;
	earned: EarnedBadgeRow[];
	progress: ProgressRow[];
};

export default function PlayerProfileView({ playerSlug }: { playerSlug: string }) {
	const [playerData, setPlayerData] = useState<PlayerData | null>(null);
	const [badgePayload, setBadgePayload] = useState<BadgePayload | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const playerName = useMemo(() => profileSlugToPlayerName(playerSlug), [playerSlug]);
	const wrappedHref = useMemo(() => {
		if (!playerName) return null;
		return `/wrapped/${playerNameToWrappedSlug(playerName)}`;
	}, [playerName]);
	const badgeBarItems = useMemo(() => {
		if (!badgePayload?.earned?.length) return [];
		return selectBadgesForBar(badgePayload.earned, 5);
	}, [badgePayload]);

	useEffect(() => {
		let cancelled = false;

		const load = async () => {
			if (!playerName) {
				setError("Invalid player profile link.");
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			setError(null);
			try {
				const [playerRes, badgesRes] = await Promise.all([
					fetch(`/api/player-data?playerName=${encodeURIComponent(playerName)}`),
					fetch(`/api/player-badges?playerName=${encodeURIComponent(playerName)}`),
				]);

				if (!playerRes.ok) {
					throw new Error("Could not load player profile data.");
				}
				if (!badgesRes.ok) {
					throw new Error("Could not load badge data.");
				}

				const playerJson = (await playerRes.json()) as { playerData?: PlayerData };
				const badgesJson = (await badgesRes.json()) as BadgePayload;

				if (!cancelled) {
					setPlayerData(playerJson.playerData ?? null);
					setBadgePayload(badgesJson);
				}
			} catch (e) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : "Failed to load profile.");
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		};

		load();
		return () => {
			cancelled = true;
		};
	}, [playerName]);

	return (
		<div className='min-h-screen px-4 py-6 md:px-8 md:py-8' data-testid='player-profile-page'>
			<div className='mx-auto w-full max-w-5xl space-y-4'>
				<div className='flex items-center justify-between gap-3'>
					<h1 className='text-2xl md:text-3xl font-bold text-dorkinians-yellow'>Player Profile</h1>
					<Link href='/' className='text-sm text-white/80 hover:text-white underline'>
						Back to home
					</Link>
				</div>

				{playerName ? (
					<div className='rounded-lg bg-white/10 backdrop-blur-sm p-4'>
						<h2 className='text-xl md:text-2xl font-bold text-white'>{playerName}</h2>
						{badgeBarItems.length > 0 ? (
							<div className='mt-2 flex flex-wrap gap-1.5' data-testid='player-profile-badge-bar'>
								{badgeBarItems.map((b) => (
									<BadgeDot key={b.badgeId} tier={b.tier} title={`${b.badgeName} (${b.tier})`} size='sm' />
								))}
							</div>
						) : null}
					</div>
				) : null}

				{isLoading ? (
					<div className='rounded-lg bg-white/10 backdrop-blur-sm p-4 text-white/70'>Loading profile...</div>
				) : error ? (
					<div className='rounded-lg bg-white/10 backdrop-blur-sm p-4 text-red-200'>{error}</div>
				) : (
					<>
						<div
							id='player-profile-season-wrapped'
							data-testid='player-profile-season-wrapped'
							className='rounded-lg bg-white/10 backdrop-blur-sm p-4'>
							<h3 className='text-white font-semibold text-sm md:text-base'>Season Wrapped</h3>
							<p className='mt-1 text-white/70 text-sm'>View and share this player&apos;s season story.</p>
							{wrappedHref ? (
								<Link href={wrappedHref} className='inline-block mt-2 text-[#5DCAA5] text-sm font-medium hover:underline'>
									Open Season Wrapped →
								</Link>
							) : null}
						</div>

						<div
							id='player-profile-milestone-badges'
							data-testid='player-profile-milestones'
							className='rounded-lg bg-white/10 backdrop-blur-sm p-4'>
							<h3 className='text-white font-semibold text-sm md:text-base'>Milestone badges</h3>
							{badgePayload ? (
								<>
									<p className='text-white/75 text-sm mt-1'>
										Unlocked: <span className='text-dorkinians-yellow font-semibold'>{badgePayload.totalBadges}</span>
										{badgePayload.highestBadgeTier ? (
											<span>
												{" "}
												(highest tier: <span className='capitalize text-dorkinians-yellow'>{badgePayload.highestBadgeTier}</span>)
											</span>
										) : null}
									</p>
									<PlayerBadgeMilestoneGrid earned={badgePayload.earned} progress={badgePayload.progress} />
								</>
							) : (
								<p className='text-white/65 text-sm mt-2'>No badge data available.</p>
							)}
						</div>

						<div className='rounded-lg bg-white/10 backdrop-blur-sm p-4' data-testid='player-profile-headline-stats'>
							<h3 className='text-white font-semibold text-sm md:text-base'>Headline stats</h3>
							<div className='mt-3 grid grid-cols-2 md:grid-cols-4 gap-2'>
								<HeadlineStat label='Appearances' value={playerData?.appearances ?? 0} />
								<HeadlineStat label='Goals' value={playerData?.allGoalsScored ?? 0} />
								<HeadlineStat label='Assists' value={playerData?.assists ?? 0} />
								<HeadlineStat label='Minutes' value={playerData?.minutes ?? 0} />
								<HeadlineStat label='MoM' value={playerData?.mom ?? 0} />
								<HeadlineStat label='Fantasy points' value={playerData?.fantasyPoints ?? 0} />
								<HeadlineStat label='Avg rating' value={playerData?.averageMatchRating ?? "—"} />
								<HeadlineStat label='Teams played for' value={playerData?.numberTeamsPlayedFor ?? 0} />
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

function HeadlineStat({ label, value }: { label: string; value: number | string }) {
	return (
		<div className='rounded-md border border-white/10 bg-black/15 p-2'>
			<p className='text-[11px] uppercase tracking-wide text-white/60'>{label}</p>
			<p className='text-lg font-semibold text-white'>{typeof value === "number" ? value.toLocaleString() : value}</p>
		</div>
	);
}
