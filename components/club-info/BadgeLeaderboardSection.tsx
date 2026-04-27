"use client";

import { useEffect, useState } from "react";
import { useNavigationStore } from "@/lib/stores/navigation";
import { cachedFetch, generatePageCacheKey } from "@/lib/utils/pageCache";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { appConfig } from "@/config/config";

type Row = { playerName: string; totalBadges: number; highestBadgeTier: string | null };
type TierRow = { playerName: string; count: number };

export default function BadgeLeaderboardSection() {
	const { getCachedPageData, setCachedPageData } = useNavigationStore();
	const selectPlayer = useNavigationStore((s) => s.selectPlayer);
	const setMainPage = useNavigationStore((s) => s.setMainPage);
	const setStatsSubPage = useNavigationStore((s) => s.setStatsSubPage);
	const [mostBadges, setMostBadges] = useState<Row[]>([]);
	const [mostDiamond, setMostDiamond] = useState<TierRow[]>([]);
	const [mostGold, setMostGold] = useState<TierRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const goToPlayer = (playerName: string) => {
		selectPlayer(playerName, "picker");
		setStatsSubPage("player-stats");
		setMainPage("stats");
	};

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const cacheKey = generatePageCacheKey("club-info", "club-information", "badge-leaderboard", {});
				const data = await cachedFetch("/api/club-badge-leaderboard", {
					method: "GET",
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				if (cancelled) return;
				setMostBadges(Array.isArray(data.mostBadges) ? data.mostBadges : []);
				setMostDiamond(Array.isArray(data.mostDiamond) ? data.mostDiamond : []);
				setMostGold(Array.isArray(data.mostGold) ? data.mostGold : []);
			} catch {
				if (!cancelled) {
					setError("Could not load badge leaderboard");
					setMostBadges([]);
					setMostDiamond([]);
					setMostGold([]);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [getCachedPageData, setCachedPageData]);

	if (appConfig.forceSkeletonView) {
		return (
			<div data-testid='badge-leaderboard-section' className='mt-8'>
				<SkeletonTheme baseColor='var(--skeleton-base)' highlightColor='var(--skeleton-highlight)'>
					<Skeleton height={22} width='55%' className='mb-3' />
					<Skeleton count={4} height={16} className='mb-2' />
				</SkeletonTheme>
			</div>
		);
	}

	if (loading) {
		return (
			<div data-testid='badge-leaderboard-section' className='mt-8'>
				<SkeletonTheme baseColor='var(--skeleton-base)' highlightColor='var(--skeleton-highlight)'>
					<Skeleton height={22} width='55%' className='mb-3' />
					<Skeleton count={5} height={14} className='mb-2' />
				</SkeletonTheme>
			</div>
		);
	}

	if (error) {
		return (
			<div data-testid='badge-leaderboard-section' className='mt-8'>
				<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-4'>Achievement Leaderboard</h3>
				<p className='text-white/70 text-sm'>{error}</p>
			</div>
		);
	}

	const empty = mostBadges.length === 0 && mostDiamond.length === 0 && mostGold.length === 0;

	return (
		<div data-testid='badge-leaderboard-section' className='mt-8'>
			<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-4'>Achievement Leaderboard</h3>
			{empty ? (
				<p className='text-white/70 text-xs md:text-sm'>No badge data yet. Run a full database seed with Feature 9 enabled.</p>
			) : (
				<div className='space-y-5 text-xs md:text-sm'>
					{mostBadges.length > 0 && (
						<div>
							<h4 className='text-base md:text-lg font-bold text-white mb-4'>Most Badges Earned</h4>
							<div className='rounded-md border border-white/10 divide-y divide-white/10'>
								{mostBadges.map((r) => (
									<div key={r.playerName} className='flex items-baseline justify-between gap-2 px-2 py-1.5'>
										<button
											type='button'
											className='text-left text-[#E8C547] font-medium hover:underline min-w-0 shrink'
											onClick={() => goToPlayer(r.playerName)}>
											{r.playerName}
										</button>
										<span className='text-white/80 tabular-nums text-right shrink-0'>
											{Math.round(r.totalBadges)} badges
										</span>
									</div>
								))}
							</div>
						</div>
					)}
					{mostDiamond.length > 0 && (
						<div>
							<h4 className='text-base md:text-lg font-bold text-white mb-4'>Most Diamond Badges</h4>
							<div className='rounded-md border border-white/10 divide-y divide-white/10'>
								{mostDiamond.map((r) => (
									<div key={`d-${r.playerName}`} className='flex items-baseline justify-between gap-2 px-2 py-1.5'>
										<button
											type='button'
											className='text-left text-[#E8C547] font-medium hover:underline min-w-0 shrink'
											onClick={() => goToPlayer(r.playerName)}>
											{r.playerName}
										</button>
										<span className='text-white tabular-nums font-semibold shrink-0'>{Math.round(r.count)}</span>
									</div>
								))}
							</div>
						</div>
					)}
					{mostGold.length > 0 && (
						<div>
							<h4 className='text-base md:text-lg font-bold text-white mb-4'>Most Gold Badges</h4>
							<div className='rounded-md border border-white/10 divide-y divide-white/10'>
								{mostGold.map((r) => (
									<div key={`g-${r.playerName}`} className='flex items-baseline justify-between gap-2 px-2 py-1.5'>
										<button
											type='button'
											className='text-left text-[#E8C547] font-medium hover:underline min-w-0 shrink'
											onClick={() => goToPlayer(r.playerName)}>
											{r.playerName}
										</button>
										<span className='text-white tabular-nums font-semibold shrink-0'>{Math.round(r.count)}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
