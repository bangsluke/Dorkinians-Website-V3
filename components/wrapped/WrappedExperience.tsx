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
import { useSearchParams } from "next/navigation";
import { toBlob } from "html-to-image";
import type { WrappedData } from "@/lib/wrapped/types";

const CARD =
	"rounded-2xl border border-white/[0.08] bg-[rgba(30,35,25,0.75)] p-6 md:p-10 shadow-xl max-w-lg w-full mx-auto";

function SlideFrame({
	children,
	footerUrl,
	slideRef,
}: {
	children: ReactNode;
	footerUrl: string;
	slideRef: LegacyRef<HTMLDivElement>;
}) {
	return (
		<div
			ref={slideRef}
			className={`${CARD} flex flex-col min-h-[70vh] md:min-h-[420px] justify-between`}
			data-testid='wrapped-slide-card'>
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
	playerSlug,
}: {
	slideRef: LegacyRef<HTMLDivElement>;
	playerName: string;
	slideNumber: number;
	playerSlug: string;
}) {
	const share = useCallback(async () => {
		const el = slideRef.current;
		if (!el) return;
		try {
			const blob = await toBlob(el, { pixelRatio: 2, backgroundColor: "#1c2418" });
			if (!blob) return;
			const safe = playerName.replace(/[^\w\-]+/g, "_").slice(0, 40);
			const file = new File([blob], `${safe}-wrapped-${slideNumber}.png`, { type: "image/png" });
			const shareText = `Check out my season stats! dorkiniansfcstats.co.uk/wrapped/${playerSlug}`;

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
	}, [playerName, playerSlug, slideNumber, slideRef]);

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

export default function WrappedExperience({ playerSlug }: { playerSlug: string }) {
	const searchParams = useSearchParams();
	const seasonQ = searchParams.get("season")?.trim();

	const [data, setData] = useState<WrappedData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [index, setIndex] = useState(0);
	const slideRef = useRef<HTMLDivElement | null>(null);

	const touchStartX = useRef<number | null>(null);

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

	const slideIds = useMemo(() => {
		if (!data) return [1];
		const base = [1, 2, 3, 4, 5, 6, 7, 8, 9];
		if (data.longestStreakValue != null && data.longestStreakValue >= 3) return base;
		return base.filter((id) => id !== 7);
	}, [data]);

	const total = slideIds.length;
	const currentSlideId = slideIds[index] ?? 1;

	const go = (dir: -1 | 1) => {
		setIndex((i) => Math.min(total - 1, Math.max(0, i + dir)));
	};

	const onTouchStart = (e: React.TouchEvent) => {
		touchStartX.current = e.changedTouches[0]?.clientX ?? null;
	};
	const onTouchEnd = (e: React.TouchEvent) => {
		const start = touchStartX.current;
		touchStartX.current = null;
		if (start == null) return;
		const end = e.changedTouches[0]?.clientX ?? start;
		const dx = end - start;
		if (Math.abs(dx) < 48) return;
		if (dx < 0) go(1);
		else go(-1);
	};

	const whatsappBlock = useMemo(() => {
		if (!data) return "";
		return `${data.playerName} — Dorkinians Wrapped ${data.season}\n${data.wrappedUrl}`;
	}, [data]);

	if (loading) {
		return (
			<div className='min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1c2418] to-[#2a3220] text-white'>
				<p className='text-white/70'>Loading your season…</p>
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className='min-h-screen flex flex-col items-center justify-center gap-4 px-6 bg-gradient-to-b from-[#1c2418] to-[#2a3220] text-white'>
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
			default:
				return (
					<>
						<p className='text-[#E8C547] text-sm font-semibold uppercase tracking-wide mb-2'>That&apos;s a wrap</p>
						<h2 className='text-2xl md:text-3xl font-bold text-white mb-4'>Thanks for the season</h2>
						<p className='text-white/80 text-sm'>Share your story and come back for more stats on the full site.</p>
					</>
				);
		}
	};

	return (
		<div
			className='min-h-screen flex flex-col bg-gradient-to-b from-[#1c2418] via-[#232b1c] to-[#1a2218] text-white px-4 py-6 md:py-10'
			onTouchStart={onTouchStart}
			onTouchEnd={onTouchEnd}
			data-testid='wrapped-page'>
			<header className='max-w-xl mx-auto w-full mb-6 text-center'>
				<p className='text-xs text-white/50 uppercase tracking-widest'>Dorkinians Wrapped</p>
				<h1 className='text-xl md:text-2xl font-bold text-white mt-1'>{data.playerName}</h1>
				<p className='text-sm text-white/45 mt-1'>{data.season}</p>
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

			<div className='flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full relative'>
				<AnimatePresence mode='wait'>
					<motion.div
						key={currentSlideId}
						initial={{ opacity: 0, x: 28 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -28 }}
						transition={{ duration: 0.22 }}
						className='w-full'>
						<SlideFrame footerUrl={data.wrappedUrl} slideRef={slideRef}>
							{renderSlide()}
						</SlideFrame>
					</motion.div>
				</AnimatePresence>

				<div className='flex flex-wrap items-center justify-center gap-3 mt-8'>
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
						playerSlug={playerSlug}
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
