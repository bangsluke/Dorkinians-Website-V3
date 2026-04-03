"use client";

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type LegacyRef,
	type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { PauseIcon, PlayIcon } from "@heroicons/react/24/solid";
import { toBlob } from "html-to-image";
import { getPlayerProfileHref } from "@/lib/profile/slug";
import { featureFlags } from "@/config/config";
import { getPublicSiteRoot } from "@/lib/utils/publicSiteUrl";
import { formatRecordingDateMobile, formatRecordingScore } from "@/lib/utils/recordingsDisplay";
import type { WrappedData, WrappedLeagueTableRow } from "@/lib/wrapped/types";

const SWIPE_PX = 56;
const VEO_WRAP_PREVIEW_COUNT = 3;
const AUTOPLAY_MS = 15_000;

function formatOrdinal(n: number): string {
	const abs = Math.floor(Math.abs(n));
	const j = abs % 10;
	const k = abs % 100;
	if (j === 1 && k !== 11) return `${abs}st`;
	if (j === 2 && k !== 12) return `${abs}nd`;
	if (j === 3 && k !== 13) return `${abs}rd`;
	return `${abs}th`;
}

function partnerInitials(name: string): string {
	if (!name || name === "-") return "?";
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatWrappedShareFilename(playerName: string, season: string, slideId: number): string {
	const namePart = playerName
		.trim()
		.replace(/\s+/g, "_")
		.replace(/[^\w\-]+/g, "");
	const seasonPart = season.trim().replace(/\//g, "_").replace(/-/g, "_");
	return `${namePart}_Dorkinians_Wrapped_${seasonPart}_Slide_${slideId}`;
}

function formatLeagueGoalDiff(gd: number): string {
	return gd > 0 ? `+${gd}` : `${gd}`;
}

function WrappedLeagueSnapshotTable({ row }: { row: WrappedLeagueTableRow }) {
	return (
		<div className='mt-3 rounded-lg border border-white/10 bg-black/20 overflow-x-auto' data-testid='wrapped-league-snapshot-table'>
			<table className='w-full min-w-[280px] border-collapse text-left text-[10px] sm:text-xs text-white/90'>
				<thead>
					<tr className='border-b border-white/15 text-white/55'>
						<th scope='col' className='py-1.5 pr-1 font-semibold'>
							#
						</th>
						<th scope='col' className='py-1.5 pr-1 font-semibold'>
							Team
						</th>
						<th scope='col' className='py-1.5 px-0.5 text-center font-semibold'>
							P
						</th>
						<th scope='col' className='py-1.5 px-0.5 text-center font-semibold'>
							W
						</th>
						<th scope='col' className='py-1.5 px-0.5 text-center font-semibold'>
							D
						</th>
						<th scope='col' className='py-1.5 px-0.5 text-center font-semibold'>
							L
						</th>
						<th scope='col' className='py-1.5 px-0.5 text-center font-semibold'>
							GF
						</th>
						<th scope='col' className='py-1.5 px-0.5 text-center font-semibold'>
							GA
						</th>
						<th scope='col' className='py-1.5 px-0.5 text-center font-semibold'>
							GD
						</th>
						<th scope='col' className='py-1.5 pl-0.5 text-center font-semibold'>
							Pts
						</th>
					</tr>
				</thead>
				<tbody>
					<tr className='border-b border-white/5'>
						<td className='py-1.5 pr-1 tabular-nums text-white font-medium'>{row.position}</td>
						<td className='py-1.5 pr-1 max-w-[7rem] sm:max-w-none break-words'>{row.team}</td>
						<td className='py-1.5 px-0.5 text-center tabular-nums'>{row.played}</td>
						<td className='py-1.5 px-0.5 text-center tabular-nums'>{row.won}</td>
						<td className='py-1.5 px-0.5 text-center tabular-nums'>{row.drawn}</td>
						<td className='py-1.5 px-0.5 text-center tabular-nums'>{row.lost}</td>
						<td className='py-1.5 px-0.5 text-center tabular-nums'>{row.goalsFor}</td>
						<td className='py-1.5 px-0.5 text-center tabular-nums'>{row.goalsAgainst}</td>
						<td className='py-1.5 px-0.5 text-center tabular-nums'>{formatLeagueGoalDiff(row.goalDifference)}</td>
						<td className='py-1.5 pl-0.5 text-center tabular-nums font-medium text-white'>{row.points}</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
}

const CARD =
	"rounded-2xl border border-[#E8C547]/20 bg-[rgba(18,24,14,0.88)] backdrop-blur-md p-4 md:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.45)] max-w-lg w-full mx-auto ring-1 ring-inset ring-white/[0.06] min-h-[50vh] md:min-h-[300px] flex flex-col";

const ACCENT = "text-[#E8C547]";
const MINT = "text-[#5DCAA5]";

function SlideFrame({
	children,
	slideRef,
	topRight,
	timerPct,
	showTimer,
	footerControls,
}: {
	children: ReactNode;
	slideRef: LegacyRef<HTMLDivElement>;
	topRight?: ReactNode;
	timerPct: number;
	showTimer: boolean;
	footerControls: ReactNode;
}) {
	return (
		<div ref={slideRef} className={`${CARD} relative flex-1`} data-testid='wrapped-slide-card'>
			{topRight ? (
				<div className='pointer-events-none absolute top-4 right-4 z-10 md:top-6 md:right-6'>{topRight}</div>
			) : null}
			<div className='flex-1 flex flex-col justify-center min-h-0 overflow-y-auto [&_p]:text-base [&_li]:text-base'>{children}</div>
			<div className='mt-2 pt-2 border-t border-white/10 shrink-0' data-wrapped-no-swipe>
				{showTimer ? (
					<div className='flex justify-center mb-2' data-testid='wrapped-slide-timer'>
						<div className='relative h-1 w-48 max-w-[88%] rounded-full bg-white/25 overflow-hidden'>
							<div
								className='absolute top-0 right-0 h-full rounded-full bg-white transition-[width] duration-150 ease-linear'
								style={{ width: `${timerPct}%` }}
							/>
						</div>
					</div>
				) : null}
				<div className='flex flex-wrap items-center justify-center gap-2'>{footerControls}</div>
			</div>
		</div>
	);
}

function FinalSlideFullSiteLink() {
	const root = getPublicSiteRoot();
	return (
		<>
			<p className={`${ACCENT} text-sm font-semibold uppercase tracking-wide mb-1`}>That&apos;s a wrap</p>
			<h2 className='text-xl md:text-3xl font-bold text-white mb-2'>Thanks for the season</h2>
			<p className='text-white/80 text-sm'>
				Share your story and come back for more stats on the{" "}
				<a
					data-testid='wrapped-full-site-link'
					href={`${root}/`}
					className='text-[#5DCAA5] font-semibold underline decoration-[#5DCAA5] underline-offset-2 hover:text-[#E8C547] hover:decoration-[#E8C547]'
					target='_blank'
					rel='noopener noreferrer'>
					full site
				</a>
			</p>
		</>
	);
}

export default function WrappedExperience({ playerSlug }: { playerSlug: string }) {
	const searchParams = useSearchParams();
	const seasonQ = searchParams.get("season")?.trim();

	const [data, setData] = useState<WrappedData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [index, setIndex] = useState(0);
	const [timerPct, setTimerPct] = useState(100);
	const [isPaused, setIsPaused] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);
	const slideRef = useRef<HTMLDivElement | null>(null);

	const pointerSwipe = useRef<{ x: number; y: number; pointerId: number } | null>(null);
	const touchStart = useRef<{ x: number; y: number } | null>(null);
	const swipeLockUntil = useRef(0);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const q = seasonQ ? `?season=${encodeURIComponent(seasonQ)}` : "";
				const res = await fetch(`/api/wrapped/${encodeURIComponent(playerSlug)}${q}`);
				const json = await res.json();
				if (!res.ok) {
					throw new Error(json?.error || "Could not load wrapped");
				}
				if (!cancelled) {
					setData(json as WrappedData);
				}
			} catch (e) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : "Could not load wrapped");
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [playerSlug, seasonQ]);

	useEffect(() => {
		setIndex(0);
	}, [seasonQ, playerSlug]);

	useEffect(() => {
		const html = document.documentElement;
		const body = document.body;
		const prevHtmlOx = html.style.overflowX;
		const prevBodyOx = body.style.overflowX;
		html.style.overflowX = "hidden";
		body.style.overflowX = "hidden";
		html.style.setProperty("overscroll-behavior-x", "none");
		body.style.setProperty("overscroll-behavior-x", "none");
		return () => {
			html.style.overflowX = prevHtmlOx;
			body.style.overflowX = prevBodyOx;
			html.style.removeProperty("overscroll-behavior-x");
			body.style.removeProperty("overscroll-behavior-x");
		};
	}, []);

	const slideIds = useMemo(() => {
		if (!data) return [1];
		const ids: number[] = [1, 2, 3, 4, 5, 6, 11];
		if (data.veoFixtures?.length) ids.push(10);
		if (data.longestStreakValue != null && data.longestStreakValue >= 3) ids.push(7);
		ids.push(8, 9);
		return ids;
	}, [data]);

	const total = slideIds.length;
	const currentSlideId = slideIds[index] ?? 1;

	const go = useCallback((dir: -1 | 1) => {
		setIndex((i) => Math.min(total - 1, Math.max(0, i + dir)));
	}, [total]);

	useEffect(() => {
		if (!data || total <= 0) return;
		if (index >= total - 1) {
			setTimerPct(100);
			return;
		}
		if (isPaused) return;
		setTimerPct(100);
		const start = Date.now();
		const iv = setInterval(() => {
			const elapsed = Date.now() - start;
			setTimerPct(Math.max(0, 100 - (elapsed / AUTOPLAY_MS) * 100));
			if (elapsed >= AUTOPLAY_MS) {
				setIndex((i) => Math.min(total - 1, i + 1));
			}
		}, 120);
		return () => clearInterval(iv);
	}, [index, data, total, isPaused]);

	const applySwipe = useCallback(
		(dx: number, dy: number) => {
			if (Date.now() < swipeLockUntil.current) return;
			if (Math.abs(dx) < SWIPE_PX) return;
			if (Math.abs(dx) < Math.abs(dy)) return;
			swipeLockUntil.current = Date.now() + 450;
			if (dx < 0) go(1);
			else go(-1);
		},
		[go],
	);

	const onTouchStartSwipe = (e: React.TouchEvent) => {
		const t = e.changedTouches[0];
		if (!t) return;
		const el = e.target as HTMLElement | null;
		if (el?.closest("a, button, input, select, textarea, [data-wrapped-no-swipe]")) return;
		touchStart.current = { x: t.clientX, y: t.clientY };
	};
	const onTouchEndSwipe = (e: React.TouchEvent) => {
		const start = touchStart.current;
		touchStart.current = null;
		if (!start) return;
		const t = e.changedTouches[0];
		if (!t) return;
		applySwipe(t.clientX - start.x, t.clientY - start.y);
	};

	const onPointerDownSwipe = (e: React.PointerEvent) => {
		if (e.button !== 0) return;
		const t = e.target as HTMLElement | null;
		if (t?.closest("a, button, input, select, textarea, [data-wrapped-no-swipe]")) return;
		pointerSwipe.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
		try {
			(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
		} catch {
			/* ignore */
		}
	};

	const onPointerUpSwipe = (e: React.PointerEvent) => {
		const s = pointerSwipe.current;
		if (!s || s.pointerId !== e.pointerId) return;
		pointerSwipe.current = null;
		try {
			(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
		} catch {
			/* ignore */
		}
		applySwipe(e.clientX - s.x, e.clientY - s.y);
	};

	const onPointerCancelSwipe = (e: React.PointerEvent) => {
		if (pointerSwipe.current?.pointerId === e.pointerId) pointerSwipe.current = null;
	};

	const shareSeasonText = useMemo(() => {
		if (!data) return "";
		return `${data.playerName} - Dorkinians Wrapped ${data.season}`;
	}, [data]);

	const shareSlideText = useMemo(() => {
		if (!data) return "";
		return `Check out my season stats! ${data.wrappedUrl.replace(/^https?:\/\//, "")}`;
	}, [data]);

	const captureAndShareSlide = useCallback(async () => {
		const el = slideRef.current;
		if (!el || !data) return;
		try {
			const blob = await toBlob(el, { pixelRatio: 2, backgroundColor: "#141a10" });
			if (!blob) return;
			const fname = `${formatWrappedShareFilename(data.playerName, data.season, currentSlideId)}.png`;
			const file = new File([blob], fname, { type: "image/png" });

			if (navigator.canShare?.({ files: [file] })) {
				await navigator.share({
					files: [file],
					title: `${data.playerName} - Dorkinians Wrapped`,
					text: shareSlideText,
				});
				return;
			}

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = fname;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			console.warn("Share slide failed", e);
		}
	}, [data, currentSlideId, shareSlideText]);

	const shareSeasonWrapped = useCallback(async () => {
		if (!data) return;
		try {
			if (navigator.share) {
				await navigator.share({
					title: `${data.playerName} - Dorkinians Wrapped ${data.season}`,
					text: shareSeasonText,
					url: data.wrappedUrl,
				});
				return;
			}
			await navigator.clipboard.writeText(`${shareSeasonText}\n${data.wrappedUrl}`);
		} catch (e) {
			console.warn("Share season failed", e);
			try {
				await navigator.clipboard.writeText(`${shareSeasonText}\n${data.wrappedUrl}`);
			} catch {
				/* ignore */
			}
		}
	}, [data, shareSeasonText]);

	if (loading) {
		return (
			<div className='relative min-h-screen min-h-[100dvh] w-full max-w-[100dvw] overflow-x-hidden overscroll-x-none flex items-center justify-center bg-[#12180e] text-white'>
				<p className='text-white/70'>Loading your season…</p>
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className='relative min-h-screen min-h-[100dvh] w-full max-w-[100dvw] overflow-x-hidden overscroll-x-none flex flex-col items-center justify-center gap-4 px-6 bg-[#12180e] text-white'>
				<p className='text-center text-white/85'>{error || "Something went wrong"}</p>
				<a href='/' className='text-[#E8C547] underline'>
					Back to home
				</a>
			</div>
		);
	}

	const renderSlide = () => {
		switch (currentSlideId) {
			case 1:
				return (
					<>
						<p className={`${ACCENT} text-xs sm:text-sm font-semibold uppercase tracking-wide mb-1`}>Overview</p>
						<h2 className='text-xl md:text-3xl font-bold text-white mb-1 leading-tight'>Your {data.season} season</h2>
						<div className='border-t border-white/10 my-2' />
						<p className='text-white/55 text-base mb-2'>
							This season you played{" "}
							<span className={`text-2xl sm:text-3xl font-extrabold ${ACCENT} tabular-nums leading-none`}>
								{data.totalMatches}
							</span>{" "}
							<span className={`font-semibold ${ACCENT}`}>matches</span>
						</p>
						<p className='text-white/75 text-base leading-snug mb-2'>
							<span className='text-white/55'>{data.totalMinutes.toLocaleString()} minutes</span>
							{" · "}
							<span className={MINT}>{data.totalStarts}</span> starts
						</p>
						<p className='text-white/75 text-base leading-snug mb-2'>
							Most played position: <span className='text-white font-medium'>{data.mostPlayedPosition}</span>
						</p>
						<div className='grid grid-cols-3 gap-1.5 text-center border-y border-white/10 py-2.5'>
							<div>
								<p className={`text-2xl font-bold ${ACCENT}`}>{data.totalGoals}</p>
								<p className='text-white/45 text-[10px] sm:text-xs mt-0.5'>Goals</p>
							</div>
							<div className='border-l border-r border-white/10'>
								<p className={`text-2xl font-bold ${ACCENT}`}>{data.totalAssists}</p>
								<p className='text-white/45 text-[10px] sm:text-xs mt-0.5'>Assists</p>
							</div>
							<div>
								<p className={`text-2xl font-bold ${ACCENT}`}>{data.totalMom}</p>
								<p className='text-white/45 text-[10px] sm:text-xs mt-0.5'>MoM</p>
							</div>
						</div>
					</>
				);
			case 2:
				return (
					<>
						<p className={`${ACCENT} text-xs sm:text-sm font-semibold uppercase tracking-wide mb-1`}>Percentile</p>
						<h2 className='text-xl md:text-3xl font-bold text-white mb-2'>Versus the squad</h2>
						<div className='border-t border-white/10 my-2' />
						<p className='text-white/85 text-base sm:text-lg leading-snug'>
							You played more matches than <span className={`${MINT} font-semibold`}>{data.matchesPercentile}%</span> of
							the club this season
						</p>
					</>
				);
			case 3:
				return (
					<>
						<p className={`${ACCENT} text-xs sm:text-sm font-semibold uppercase tracking-wide mb-1`}>Best month</p>
						<h2 className='text-xl md:text-3xl font-bold text-white mb-2'>{data.bestMonth}</h2>
						<div className='border-t border-white/10 my-2' />
						<p className='text-white/75 text-xs sm:text-sm mb-2'>
							<span className={MINT}>{data.bestMonthMatches}</span> games · {" "} 
							<span className={MINT}>{data.bestMonthFantasyPoints}</span> {" "} Fantasy Points
						</p>
						<p className='text-white/85 text-base sm:text-lg mb-1.5'>
							{data.bestMonthGoals} goals · {data.bestMonthAssists} assists
						</p>
						<p className='text-white/70 text-xs sm:text-sm'>
							{data.bestMonthMinutes.toLocaleString()} mins · {data.bestMonthStarts} starts ·{" "}
							{data.bestMonthYellowCards}Y · {data.bestMonthRedCards}R
						</p>
					</>
				);
			case 4:
				return (
					<>
						<p className={`${ACCENT} text-xs sm:text-sm font-semibold uppercase tracking-wide mb-1`}>Teammate</p>
						<p className='text-white/50 text-base mb-2'>Your most trusted teammate</p>
						<div className='border-t border-white/10 my-2' />
						{data.topPartnerName === "-" ? (
							<p className='text-white/85 text-lg leading-relaxed'>
								Partnership stats will show here once you have shared games this season.
							</p>
						) : (
							<div className='flex flex-col items-center text-center gap-2'>
								<div
									className={`flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border-2 border-[#5DCAA5]/50 bg-[rgba(30,45,30,0.6)] text-2xl sm:text-3xl font-bold ${MINT}`}>
									{partnerInitials(data.topPartnerName)}
								</div>
								<h2 className='text-lg md:text-2xl font-bold text-white leading-tight'>{data.topPartnerName}</h2>
								<p className='text-white/80 text-sm sm:text-base leading-snug'>
									You played <span className={MINT}>{data.topPartnerMatches} matches</span> together
									<br />
									Win rate together: <span className={MINT}>{data.topPartnerWinRate}%</span>
								</p>
							</div>
						)}
					</>
				);
			case 5:
				return (
					<>
						<p className={`${ACCENT} text-xs sm:text-sm font-semibold uppercase tracking-wide mb-1`}>Player type</p>
						<p className='text-white/50 text-base mb-2'>Your player type this season</p>
						<div className='border-t border-white/10 my-2' />
						<h2 className={`text-xl md:text-3xl font-bold ${MINT} mb-2 leading-tight`}>{data.playerType}</h2>
						<p className='text-white/70 text-sm sm:text-base leading-snug'>{data.playerTypeReason}</p>
					</>
				);
			case 6:
				return (
					<>
						<p className={`${ACCENT} text-xs sm:text-sm font-semibold uppercase tracking-wide mb-1`}>Peak match</p>
						<h2 className='text-xl md:text-3xl font-bold text-white mb-1 leading-tight'>
							Match rating <span className={ACCENT}>{data.peakMatchRating}</span>
						</h2>
						<div className='border-t border-white/10 my-2' />
						<p className='text-white/75 text-sm sm:text-base mb-1'>
							Result: <span className={`font-semibold ${MINT}`}>{data.peakMatchResultLabel}</span>
							{" · "}
							<span className='text-white font-medium'>{data.peakMatchScoreline}</span>
							{" "}vs {data.peakMatchOpposition}
						</p>
						
						<p className='text-white/70 text-xs sm:text-sm'>
						{data.peakMatchStarted ? "Started" : "Sub"} · {data.peakMatchMinutes} mins {data.peakMatchGoals > 0 ? "· " + data.peakMatchGoals + "G" : ""} {data.peakMatchAssists > 0 ? "· " + data.peakMatchAssists + "A" : ""} {data.peakMatchYellowCards > 0 ? "· " + data.peakMatchYellowCards + "Y" : ""} {data.peakMatchRedCards > 0 ? "· " + data.peakMatchRedCards + "R" : ""}
						</p>

						<p className='text-white/70 text-xs sm:text-sm'>
						<span className={`font-semibold ${MINT}`}>{data.peakMatchFantasyPoints}</span> Fantasy Points
						</p>
					</>
				);
			case 11: {
				const teamLabel = data.wrappedDominantTeam?.trim() || "your main XI";
				const divSuffix =
					data.wrappedDominantTeamLeagueDivision?.trim() ?
						` (${data.wrappedDominantTeamLeagueDivision.trim()})`
					:	"";
				const row = data.wrappedDominantTeamLeagueRow;
				const leagueFinishLine =
					row && row.position > 0 ?
						`${teamLabel} finished ${formatOrdinal(row.position)} in the league${divSuffix}.`
					:	null;
				return (
					<>
						<p className={`${ACCENT} text-xs sm:text-sm font-semibold uppercase tracking-wide mb-1`}>Team season</p>
						<h2 className='text-xl md:text-3xl font-bold text-white mb-2'>League Points and Cups</h2>
						<div className='border-t border-white/10 my-2' />
						<ul className='text-white/85 text-xs sm:text-sm md:text-base space-y-2 text-left' data-testid='wrapped-team-season-slide'>
							<li>
								<span className={`${MINT} font-semibold`}>{data.wrappedLeaguePointsContributed}</span> league points from
								games you played
							</li>
							<li>
								<span className={`${MINT} font-semibold`}>{data.wrappedCupTiesAdvanced}</span> cup ties advanced
							</li>
							{leagueFinishLine ? <li className='text-white/70'>{leagueFinishLine}</li> : null}
						</ul>
						{row ? <WrappedLeagueSnapshotTable row={row} /> : null}
					</>
				);
			}
			case 7: {
				const streakType = data.longestStreakType ?? "";
				const isDisciplineNoCardsStreak = /discipline|no\s*cards/i.test(streakType);
				return (
					<>
						<p className={`${ACCENT} text-xs sm:text-sm font-semibold uppercase tracking-wide mb-1`}>Streak</p>
						<h2 className='text-xl md:text-3xl font-bold text-white mb-2 leading-tight'>{data.longestStreakType}</h2>
						<div className='border-t border-white/10 my-2' />
						<p className={`text-white/85 text-3xl sm:text-4xl ${MINT}`}>
							{data.longestStreakValue}
							{isDisciplineNoCardsStreak ? " games without a card" : ""}
						</p>
					</>
				);
			}
			case 8:
				return (
					<>
						<p className={`${ACCENT} text-xs sm:text-sm font-semibold uppercase tracking-wide mb-1`}>Distance</p>
						<h2 className='text-xl md:text-3xl font-bold text-white mb-2'>On the road</h2>
						<div className='border-t border-white/10 my-2' />
						<p className='text-white/85 text-sm sm:text-base leading-snug'>{data.distanceEquivalent}</p>
					</>
				);
			case 10: {
				const veoAll = data.veoFixtures;
				const veoTotal = veoAll.length;
				const veoRows = veoAll.slice(0, VEO_WRAP_PREVIEW_COUNT);
				const statsHref = featureFlags.playerProfile ? getPlayerProfileHref(data.playerName) : "/";
				const showRecordingsDeepLink =
					featureFlags.playerProfile && featureFlags.playerStatsPlayerRecordings;
				const recordingsHref = `${statsHref}#player-recordings`;
				return (
					<>
						<p className={`${ACCENT} text-xs sm:text-sm font-semibold uppercase tracking-wide mb-1`}>Veo</p>
						<h2 className='text-xl md:text-3xl font-bold text-white mb-2'>Match videos</h2>
						<div className='border-t border-white/10 my-2' />
						<p className='text-white/70 text-base mb-2'>
							Fixtures you played with a Veo recording this season.
							{veoTotal > VEO_WRAP_PREVIEW_COUNT ? (
								<>
									{" "}
									Showing the {VEO_WRAP_PREVIEW_COUNT} most recent of {veoTotal}.
								</>
							) : null}
						</p>
						<ul
							className='text-left space-y-2 pr-1 touch-pan-y'
							style={{ touchAction: "pan-y" }}
							data-testid='wrapped-veo-list'>
							{veoRows.map((row) => {
								const scoreline = formatRecordingScore(row.result, row.goalsScored, row.goalsConceded);
								const metaBits = [row.team?.trim(), scoreline].filter(Boolean);
								return (
									<li key={`${row.fixtureId}-${row.veoLink}`} className='border-b border-white/10 pb-2'>
										<a
											href={row.veoLink}
											target='_blank'
											rel='noopener noreferrer'
											className='text-[#5DCAA5] text-sm font-medium hover:underline break-words'>
											{row.opposition || "Fixture"}
											{row.date ? ` · ${formatRecordingDateMobile(row.date)}` : ""}
										</a>
										{metaBits.length > 0 ? (
											<p className='text-white/50 text-xs mt-0.5 tabular-nums'>{metaBits.join(" · ")}</p>
										) : null}
									</li>
								);
							})}
						</ul>
						<p className='text-white/55 text-[10px] sm:text-xs mt-2 leading-snug' data-wrapped-no-swipe>
							See more on{" "}
							<Link
								href={statsHref}
								prefetch={false}
								className='text-[#5DCAA5] font-medium underline decoration-[#5DCAA5]/60 underline-offset-2 hover:text-[#E8C547] hover:decoration-[#E8C547]'>
								{featureFlags.playerProfile ? "player stats" : "home"}
							</Link>
							{showRecordingsDeepLink ? (
								<>
									{" and in "}
									<Link
										href={recordingsHref}
										prefetch={false}
										className='text-[#5DCAA5] font-medium underline decoration-[#5DCAA5]/60 underline-offset-2 hover:text-[#E8C547] hover:decoration-[#E8C547]'>
										Player Recordings
									</Link>
								</>
							) : null}
							.
						</p>
					</>
				);
			}
			default:
				return <FinalSlideFullSiteLink />;
		}
	};

	const profileExitHref = featureFlags.playerProfile ? getPlayerProfileHref(data.playerName) : "/";
	const profileExitLabel = featureFlags.playerProfile ? "Profile" : "Home";
	const showTimer = index < total - 1;

	const wrappedNavControls = (
		<>
			<button
				type='button'
				onClick={() => go(-1)}
				disabled={index <= 0}
				className='text-xs sm:text-sm px-3 py-1.5 rounded-lg border border-white/15 text-white/90 disabled:opacity-30'>
				Back
			</button>
			<button
				type='button'
				onClick={() => setIsPaused((p) => !p)}
				disabled={index >= total - 1}
				className='text-xs sm:text-sm px-3 py-1.5 rounded-lg border border-white/15 text-white/90 disabled:opacity-30'
				aria-label={isPaused ? "Resume autoplay" : "Pause autoplay"}>
				{isPaused ?
					<PlayIcon className='h-4 w-4 sm:h-5 sm:w-5' aria-hidden />
				:	<PauseIcon className='h-4 w-4 sm:h-5 sm:w-5' aria-hidden />}
			</button>
			<button
				type='button'
				onClick={() => go(1)}
				disabled={index >= total - 1}
				className='text-xs sm:text-sm px-3 py-1.5 rounded-lg border border-white/15 text-white/90 disabled:opacity-30'>
				Next
			</button>
			<button
				type='button'
				data-testid='wrapped-share-open'
				onClick={() => setShareOpen(true)}
				className='text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg bg-[#E8C547] text-black hover:opacity-90'>
				Share
			</button>
			{index >= total - 1 ? (
				<button
					type='button'
					onClick={() => {
						setIndex(0);
						setTimerPct(100);
						setIsPaused(false);
					}}
					className='text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg bg-[#5DCAA5] text-black hover:opacity-90'>
					Restart
				</button>
			) : null}
		</>
	);

	return (
		<div
			className='relative h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-[100dvw] overflow-x-hidden overflow-y-hidden overscroll-x-none flex flex-col text-white px-4 py-6 md:py-10 touch-pan-y bg-[#12180e] bg-[radial-gradient(ellipse_100%_70%_at_50%_-5%,rgba(72,92,48,0.45)_0%,transparent_55%),linear-gradient(180deg,#1a2212_0%,#0f140c_50%,#1a2212_100%)]'
			data-testid='wrapped-page'>
			<header className='max-w-xl mx-auto w-full mb-6 shrink-0 relative pr-14 sm:pr-24'>
				<Link
					href={profileExitHref}
					data-testid='wrapped-exit-profile'
					className='absolute right-0 top-0 z-10 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/30 px-2.5 py-2 text-sm text-white/90 hover:border-[#E8C547]/50 hover:text-[#E8C547] transition-colors'
					prefetch={false}>
					<XMarkIcon className='w-5 h-5 shrink-0' aria-hidden />
					<span className='hidden sm:inline'>{profileExitLabel}</span>
				</Link>
				<div className='flex items-center justify-center gap-3 md:gap-4'>
					<Image
						src='/icons/icon-96x96.png'
						alt='Dorkinians FC'
						width={44}
						height={44}
						className='rounded-full shrink-0 ring-2 ring-[#E8C547]/30'
					/>
					<div className='text-left min-w-0'>
						<p className='text-xs text-[#E8C547]/90 uppercase tracking-widest font-semibold'>
							Dorkinians Wrapped {data.season}
						</p>
						<h1 className='text-xl md:text-2xl font-bold text-white mt-1'>{data.playerName}</h1>
					</div>
				</div>
			</header>

			<div className='flex justify-center gap-2 mb-6 flex-wrap shrink-0'>
				{slideIds.map((id, i) => (
					<button
						key={id}
						type='button'
						aria-label={`Go to slide ${i + 1}`}
						data-testid={`wrapped-dot-${id}`}
						onClick={() => setIndex(i)}
						className={`h-2.5 w-2.5 rounded-full transition-colors ${i === index ? "bg-[#E8C547]" : "bg-white/25"}`}
					/>
				))}
			</div>

			<div className='flex-1 flex flex-col min-h-0 max-w-2xl mx-auto w-full min-w-0 relative overflow-x-hidden overflow-y-hidden'>
				<div className='relative w-full min-h-0 flex-1 flex flex-col overflow-hidden'>
					<AnimatePresence mode='wait'>
						<motion.div
							key={currentSlideId}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
							className='w-full min-h-0 flex-1 flex flex-col overflow-hidden'
							onPointerDown={onPointerDownSwipe}
							onPointerUp={onPointerUpSwipe}
							onPointerCancel={onPointerCancelSwipe}
							onTouchStart={onTouchStartSwipe}
							onTouchEnd={onTouchEndSwipe}
							data-testid='wrapped-slide-swipe-area'>
							<SlideFrame
								slideRef={slideRef}
								timerPct={timerPct}
								showTimer={showTimer}
								footerControls={wrappedNavControls}
								topRight={
									currentSlideId === 10 ? (
										<img
											src='/icons/veo.svg'
											alt='Veo'
											className='h-7 w-auto opacity-95 brightness-0 invert md:h-8'
										/>
									) : undefined
								}>
								{renderSlide()}
							</SlideFrame>
						</motion.div>
					</AnimatePresence>
				</div>
			</div>

			{shareOpen ? (
				<div
					className='fixed inset-0 z-[400] flex items-center justify-center bg-black/70 p-4'
					role='dialog'
					aria-modal='true'
					aria-label='Share options'
					data-testid='wrapped-share-modal'
					onClick={() => setShareOpen(false)}>
					<div
						className='w-full max-w-sm rounded-xl border border-white/15 bg-[#1a2210] p-5 shadow-2xl'
						onClick={(e) => e.stopPropagation()}>
						<p className='text-white font-semibold mb-4'>Share</p>
						<div className='flex flex-col gap-2'>
							<button
								type='button'
								className='rounded-lg bg-[#E8C547] text-black font-medium py-2.5 px-3 text-sm'
								data-testid='wrapped-share-season'
								onClick={() => {
									setShareOpen(false);
									void shareSeasonWrapped();
								}}>
								Share season wrapped
							</button>
							<button
								type='button'
								className='rounded-lg border border-white/20 text-white py-2.5 px-3 text-sm font-medium hover:bg-white/10'
								data-testid='wrapped-share-slide'
								onClick={() => {
									setShareOpen(false);
									void captureAndShareSlide();
								}}>
								Share this slide
							</button>
							<button
								type='button'
								className='mt-2 text-sm text-white/70 underline'
								data-testid='wrapped-share-close'
								onClick={() => setShareOpen(false)}>
								Close
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
