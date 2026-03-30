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
import { toBlob } from "html-to-image";
import { getPlayerProfileHref } from "@/lib/profile/slug";
import { getPublicSiteRoot } from "@/lib/utils/publicSiteUrl";
import { formatRecordingDateMobile, formatRecordingScore } from "@/lib/utils/recordingsDisplay";
import type { WrappedData } from "@/lib/wrapped/types";

const SWIPE_PX = 56;
const VEO_WRAP_PREVIEW_COUNT = 5;

function formatOrdinal(n: number): string {
	const abs = Math.floor(Math.abs(n));
	const j = abs % 10;
	const k = abs % 100;
	if (j === 1 && k !== 11) return `${abs}st`;
	if (j === 2 && k !== 12) return `${abs}nd`;
	if (j === 3 && k !== 13) return `${abs}rd`;
	return `${abs}th`;
}

const CARD =
	"rounded-2xl border border-white/[0.08] bg-[rgba(30,35,25,0.75)] p-6 md:p-10 shadow-xl max-w-lg w-full mx-auto";

function SlideFrame({
	children,
	footerUrl,
	slideRef,
	topRight,
}: {
	children: ReactNode;
	footerUrl: string;
	slideRef: LegacyRef<HTMLDivElement>;
	topRight?: ReactNode;
}) {
	return (
		<div
			ref={slideRef}
			className={`${CARD} relative flex flex-col min-h-[70vh] md:min-h-[420px] justify-between`}
			data-testid='wrapped-slide-card'>
			{topRight ? (
				<div className='pointer-events-none absolute top-4 right-4 z-10 md:top-6 md:right-6'>{topRight}</div>
			) : null}
			<div className='flex-1 flex flex-col justify-center'>{children}</div>
			<p className='text-center text-[10px] md:text-xs text-white/45 mt-6 break-all' data-testid='wrapped-slide-url'>
				{footerUrl}
			</p>
		</div>
	);
}

function ShareSlideButton({
	slideRef,
	playerName,
	slideNumber,
	shareUrl,
}: {
	slideRef: LegacyRef<HTMLDivElement>;
	playerName: string;
	slideNumber: number;
	/** Public wrapped URL including path and `?season=` when applicable */
	shareUrl: string;
}) {
	const share = useCallback(async () => {
		const el = slideRef.current;
		if (!el) return;
		try {
			const blob = await toBlob(el, { pixelRatio: 2, backgroundColor: "#1c2418" });
			if (!blob) return;
			const safe = playerName.replace(/[^\w\-]+/g, "_").slice(0, 40);
			const file = new File([blob], `${safe}-wrapped-${slideNumber}.png`, { type: "image/png" });
			const shareText = `Check out my season stats! ${shareUrl.replace(/^https?:\/\//, "")}`;

			if (navigator.canShare?.({ files: [file] })) {
				await navigator.share({
					files: [file],
					title: `${playerName} — Dorkinians Wrapped`,
					text: shareText,
				});
				return;
			}

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = file.name;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			console.warn("Share slide failed", e);
		}
	}, [playerName, shareUrl, slideNumber, slideRef]);

	return (
		<button
			type='button'
			onClick={() => void share()}
			data-testid='wrapped-share-slide'
			className='text-sm font-medium px-4 py-2 rounded-lg bg-[#E8C547] text-black hover:opacity-90'>
			Share this slide
		</button>
	);
}

function FinalSlideFullSiteLink() {
	const root = getPublicSiteRoot();
	return (
		<>
			<p className='text-[#E8C547] text-sm font-semibold uppercase tracking-wide mb-2'>That&apos;s a wrap</p>
			<h2 className='text-2xl md:text-3xl font-bold text-white mb-4'>Thanks for the season</h2>
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
				.
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
	const slideRef = useRef<HTMLDivElement | null>(null);

	const pointerSwipe = useRef<{ x: number; y: number; pointerId: number } | null>(null);
	const touchStart = useRef<{ x: number; y: number } | null>(null);

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

	/** Prevent horizontal rubber-banding / scroll revealing content beside the wrapped shell */
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

	const go = (dir: -1 | 1) => {
		setIndex((i) => Math.min(total - 1, Math.max(0, i + dir)));
	};

	const applySwipe = (dx: number, dy: number) => {
		if (Math.abs(dx) < SWIPE_PX) return;
		if (Math.abs(dx) < Math.abs(dy)) return;
		if (dx < 0) go(1);
		else go(-1);
	};

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

	const whatsappBlock = useMemo(() => {
		if (!data) return "";
		return `${data.playerName} — Dorkinians Wrapped ${data.season}\n${data.wrappedUrl}`;
	}, [data]);

	if (loading) {
		return (
			<div className='relative min-h-screen min-h-[100dvh] w-full max-w-[100dvw] overflow-x-hidden overscroll-x-none flex items-center justify-center bg-[#1a2218] bg-gradient-to-b from-[#1c2418] to-[#2a3220] text-white'>
				<p className='text-white/70'>Loading your season…</p>
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className='relative min-h-screen min-h-[100dvh] w-full max-w-[100dvw] overflow-x-hidden overscroll-x-none flex flex-col items-center justify-center gap-4 px-6 bg-[#1a2218] bg-gradient-to-b from-[#1c2418] to-[#2a3220] text-white'>
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
						<p className='text-[#E8C547] text-sm font-semibold uppercase tracking-wide mb-2'>Overview</p>
						<h2 className='text-2xl md:text-3xl font-bold text-white mb-6'>Your {data.season} season</h2>
						<ul className='text-white/90 space-y-3 text-lg'>
							<li>{data.totalMatches} appearances</li>
							<li>
								{data.totalGoals} goals · {data.totalAssists} assists
							</li>
							<li>{data.totalMom} Man of the Match</li>
						</ul>
					</>
				);
			case 2:
				return (
					<>
						<p className='text-[#E8C547] text-sm font-semibold uppercase tracking-wide mb-2'>Percentile</p>
						<h2 className='text-2xl md:text-3xl font-bold text-white mb-4'>Versus the squad</h2>
						<p className='text-white/85 text-lg leading-relaxed'>
							You played more matches than <span className='text-[#5DCAA5] font-semibold'>{data.matchesPercentile}%</span> of
							the club this season.
						</p>
					</>
				);
			case 3:
				return (
					<>
						<p className='text-[#E8C547] text-sm font-semibold uppercase tracking-wide mb-2'>Best month</p>
						<h2 className='text-2xl md:text-3xl font-bold text-white mb-4'>{data.bestMonth}</h2>
						<p className='text-white/85 text-lg'>
							{data.bestMonthGoals} goals · {data.bestMonthAssists} assists
						</p>
					</>
				);
			case 4:
				return (
					<>
						<p className='text-[#E8C547] text-sm font-semibold uppercase tracking-wide mb-2'>Teammate</p>
						<h2 className='text-2xl md:text-3xl font-bold text-white mb-4'>Chemistry</h2>
						<p className='text-white/85 text-lg leading-relaxed'>
							{data.topPartnerName === "—" ? (
								"Partnership stats will show here once the graph has enough shared games."
							) : (
								<>
									With <span className='text-[#E8C547] font-semibold'>{data.topPartnerName}</span>:{" "}
									<span className='text-[#5DCAA5]'>{data.topPartnerWinRate}%</span> win rate across{" "}
									{data.topPartnerMatches} games.
								</>
							)}
						</p>
					</>
				);
			case 5:
				return (
					<>
						<p className='text-[#E8C547] text-sm font-semibold uppercase tracking-wide mb-2'>Player type</p>
						<h2 className='text-2xl md:text-3xl font-bold text-white mb-4'>{data.playerType}</h2>
						<p className='text-white/80 text-base leading-relaxed'>{data.playerTypeReason}</p>
					</>
				);
			case 6:
				return (
					<>
						<p className='text-[#E8C547] text-sm font-semibold uppercase tracking-wide mb-2'>Peak match</p>
						<h2 className='text-2xl md:text-3xl font-bold text-white mb-4'>Match rating {data.peakMatchRating}</h2>
						<p className='text-white/85 text-lg'>
							vs {data.peakMatchOpposition} — {data.peakMatchGoals}G {data.peakMatchAssists}A
						</p>
					</>
				);
			case 11: {
				const teamLabel = data.wrappedDominantTeam?.trim() || "your main XI";
				const divSuffix =
					data.wrappedDominantTeamLeagueDivision?.trim() ?
						` (${data.wrappedDominantTeamLeagueDivision.trim()})`
					:	"";
				const pos = data.wrappedDominantTeamLeaguePosition;
				const leagueLine =
					pos != null && pos > 0 ?
						`${teamLabel} finished ${formatOrdinal(pos)} in the league${divSuffix}.`
					:	`League table position wasn’t available for ${teamLabel} this season.`;
				return (
					<>
						<p className='text-[#E8C547] text-sm font-semibold uppercase tracking-wide mb-2'>Team season</p>
						<h2 className='text-2xl md:text-3xl font-bold text-white mb-4'>Points, cups, table</h2>
						<ul className='text-white/85 text-sm md:text-base space-y-3 text-left' data-testid='wrapped-team-season-slide'>
							<li>
								<span className='text-[#5DCAA5] font-semibold'>{data.wrappedLeaguePointsContributed}</span> league points from
								games you played (3 for a win, 1 for a draw).
							</li>
							<li>
								<span className='text-[#5DCAA5] font-semibold'>{data.wrappedCupTiesAdvanced}</span> cup ties advanced — matches
								where the club went through (including wins on penalties after a draw).
							</li>
							<li>{leagueLine}</li>
						</ul>
					</>
				);
			}
			case 7:
				return (
					<>
						<p className='text-[#E8C547] text-sm font-semibold uppercase tracking-wide mb-2'>Streak</p>
						<h2 className='text-2xl md:text-3xl font-bold text-white mb-4'>{data.longestStreakType}</h2>
						<p className='text-white/85 text-4xl font-bold text-[#5DCAA5]'>{data.longestStreakValue}</p>
					</>
				);
			case 8:
				return (
					<>
						<p className='text-[#E8C547] text-sm font-semibold uppercase tracking-wide mb-2'>Distance</p>
						<h2 className='text-2xl md:text-3xl font-bold text-white mb-4'>On the road</h2>
						<p className='text-white/85 text-base leading-relaxed'>{data.distanceEquivalent}</p>
					</>
				);
			case 10: {
				const veoAll = data.veoFixtures;
				const veoTotal = veoAll.length;
				const veoRows = veoAll.slice(0, VEO_WRAP_PREVIEW_COUNT);
				const statsHref = getPlayerProfileHref(data.playerName);
				const recordingsHref = `${statsHref}#player-recordings`;
				return (
					<>
						<p className='text-[#E8C547] text-sm font-semibold uppercase tracking-wide mb-2'>Veo</p>
						<h2 className='text-2xl md:text-3xl font-bold text-white mb-4'>Match videos</h2>
						<p className='text-white/70 text-sm mb-4'>
							Fixtures you played with a Veo recording this season.
							{veoTotal > VEO_WRAP_PREVIEW_COUNT ? (
								<>
									{" "}
									Showing the {VEO_WRAP_PREVIEW_COUNT} most recent of {veoTotal}.
								</>
							) : null}
						</p>
						<ul
							className='text-left space-y-3 max-h-[42vh] overflow-y-auto pr-1 touch-pan-y'
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
						<p className='text-white/55 text-xs mt-4 leading-relaxed' data-wrapped-no-swipe>
							See more on{" "}
							<Link
								href={statsHref}
								prefetch={false}
								className='text-[#5DCAA5] font-medium underline decoration-[#5DCAA5]/60 underline-offset-2 hover:text-[#E8C547] hover:decoration-[#E8C547]'>
								player stats
							</Link>
							{" and in "}
							<Link
								href={recordingsHref}
								prefetch={false}
								className='text-[#5DCAA5] font-medium underline decoration-[#5DCAA5]/60 underline-offset-2 hover:text-[#E8C547] hover:decoration-[#E8C547]'>
								Player Recordings
							</Link>
							.
						</p>
					</>
				);
			}
			default:
				return (
					<FinalSlideFullSiteLink />
				);
		}
	};

	const profileHref = getPlayerProfileHref(data.playerName);

	return (
		<div
			className='relative min-h-screen min-h-[100dvh] w-full max-w-[100dvw] overflow-x-hidden overscroll-x-none flex flex-col bg-[#1a2218] bg-gradient-to-b from-[#1c2418] via-[#232b1c] to-[#1a2218] text-white px-4 py-6 md:py-10 touch-pan-y'
			data-testid='wrapped-page'>
			<header className='max-w-xl mx-auto w-full mb-6 relative pr-14 sm:pr-24'>
				<Link
					href={profileHref}
					data-testid='wrapped-exit-profile'
					className='absolute right-0 top-0 z-10 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/30 px-2.5 py-2 text-sm text-white/90 hover:border-[#E8C547]/50 hover:text-[#E8C547] transition-colors'
					prefetch={false}>
					<XMarkIcon className='w-5 h-5 shrink-0' aria-hidden />
					<span className='hidden sm:inline'>Profile</span>
				</Link>
				<div className='flex items-center justify-center gap-3 md:gap-4'>
					<Image
						src='/icons/icon-96x96.png'
						alt='Dorkinians FC'
						width={44}
						height={44}
						className='rounded-full shrink-0'
					/>
					<div className='text-left min-w-0'>
						<p className='text-xs text-white/50 uppercase tracking-widest'>Dorkinians Wrapped</p>
						<h1 className='text-xl md:text-2xl font-bold text-white mt-1'>{data.playerName}</h1>
						<p className='text-sm text-white/45 mt-1'>{data.season}</p>
					</div>
				</div>
			</header>

			<div className='flex justify-center gap-2 mb-6 flex-wrap'>
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

			<div className='flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full min-w-0 relative overflow-x-hidden'>
				<div className='relative w-full min-w-0 overflow-x-hidden'>
					<AnimatePresence mode='wait'>
						<motion.div
							key={currentSlideId}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
							className='w-full min-w-0'
						onPointerDown={onPointerDownSwipe}
						onPointerUp={onPointerUpSwipe}
						onPointerCancel={onPointerCancelSwipe}
						onTouchStart={onTouchStartSwipe}
						onTouchEnd={onTouchEndSwipe}
						data-testid='wrapped-slide-swipe-area'>
						<SlideFrame
							footerUrl={data.wrappedUrl}
							slideRef={slideRef}
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

				<div className='flex flex-wrap items-center justify-center gap-3 mt-8' data-wrapped-no-swipe>
					<button
						type='button'
						onClick={() => go(-1)}
						disabled={index <= 0}
						className='text-sm px-4 py-2 rounded-lg border border-white/15 text-white/90 disabled:opacity-30'>
						Back
					</button>
					<button
						type='button'
						onClick={() => go(1)}
						disabled={index >= total - 1}
						className='text-sm px-4 py-2 rounded-lg border border-white/15 text-white/90 disabled:opacity-30'>
						Next
					</button>
					<ShareSlideButton
						slideRef={slideRef}
						playerName={data.playerName}
						slideNumber={currentSlideId}
						shareUrl={data.wrappedUrl}
					/>
				</div>
			</div>

			<section className='max-w-xl mx-auto w-full mt-10 mb-8'>
				<p className='text-xs text-white/45 mb-2'>WhatsApp-friendly text</p>
				<pre
					data-testid='wrapped-whatsapp-block'
					className='text-xs text-white/75 bg-black/25 rounded-lg p-3 whitespace-pre-wrap break-words border border-white/10'>
					{whatsappBlock}
				</pre>
				<button
					type='button'
					className='mt-2 text-sm text-[#E8C547] underline'
					onClick={() => void navigator.clipboard.writeText(whatsappBlock)}>
					Copy text
				</button>
			</section>
		</div>
	);
}
