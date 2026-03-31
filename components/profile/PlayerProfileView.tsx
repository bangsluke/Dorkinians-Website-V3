"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import PlayerBadgeMilestoneGrid, {
	type EarnedBadgeRow,
	type ProgressRow,
} from "@/components/stats/PlayerBadgeMilestoneGrid";
import { profileSlugToPlayerName } from "@/lib/profile/slug";
import { isSeasonWrappedPromoMonth } from "@/lib/wrapped/seasonWrappedPromo";
import { playerNameToWrappedSlug } from "@/lib/wrapped/slug";
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
	const [wrappedSeasons, setWrappedSeasons] = useState<string[]>([]);
	const [wrappedSelectedSeason, setWrappedSelectedSeason] = useState<string | null>(null);
	const [seasonPickerOpen, setSeasonPickerOpen] = useState(false);
	const [seasonMenuPos, setSeasonMenuPos] = useState<{ top: number; left: number } | null>(null);
	const [pastSeasonsOpen, setPastSeasonsOpen] = useState(false);
	const [pastSeasonsMenuPos, setPastSeasonsMenuPos] = useState<{ top: number; left: number } | null>(null);
	const seasonTriggerRef = useRef<HTMLButtonElement>(null);
	const seasonDropdownRef = useRef<HTMLDivElement>(null);
	const pastSeasonsTriggerRef = useRef<HTMLButtonElement>(null);
	const pastSeasonsDropdownRef = useRef<HTMLDivElement>(null);
	const [wrappedDefaultSeason, setWrappedDefaultSeason] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [seasonWrappedPromoActive, setSeasonWrappedPromoActive] = useState(false);

	const updateSeasonMenuPosition = useCallback(() => {
		const btn = seasonTriggerRef.current;
		if (!btn) return;
		const r = btn.getBoundingClientRect();
		setSeasonMenuPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
	}, []);

	useLayoutEffect(() => {
		if (!seasonPickerOpen) {
			setSeasonMenuPos(null);
			return;
		}
		updateSeasonMenuPosition();
		const btn = seasonTriggerRef.current;
		const ro = btn ? new ResizeObserver(() => updateSeasonMenuPosition()) : null;
		if (btn) ro?.observe(btn);
		window.addEventListener("scroll", updateSeasonMenuPosition, true);
		window.addEventListener("resize", updateSeasonMenuPosition);
		return () => {
			ro?.disconnect();
			window.removeEventListener("scroll", updateSeasonMenuPosition, true);
			window.removeEventListener("resize", updateSeasonMenuPosition);
		};
	}, [seasonPickerOpen, updateSeasonMenuPosition]);

	useEffect(() => {
		if (!seasonPickerOpen) return;
		const close = (e: MouseEvent) => {
			const t = e.target as Node;
			if (seasonTriggerRef.current?.contains(t)) return;
			if (seasonDropdownRef.current?.contains(t)) return;
			setSeasonPickerOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setSeasonPickerOpen(false);
		};
		document.addEventListener("mousedown", close);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", close);
			document.removeEventListener("keydown", onKey);
		};
	}, [seasonPickerOpen]);

	const updatePastSeasonsMenuPosition = useCallback(() => {
		const btn = pastSeasonsTriggerRef.current;
		if (!btn) return;
		const r = btn.getBoundingClientRect();
		setPastSeasonsMenuPos({ top: r.bottom + 8, left: r.left });
	}, []);

	useLayoutEffect(() => {
		if (!pastSeasonsOpen) {
			setPastSeasonsMenuPos(null);
			return;
		}
		updatePastSeasonsMenuPosition();
		window.addEventListener("scroll", updatePastSeasonsMenuPosition, true);
		window.addEventListener("resize", updatePastSeasonsMenuPosition);
		return () => {
			window.removeEventListener("scroll", updatePastSeasonsMenuPosition, true);
			window.removeEventListener("resize", updatePastSeasonsMenuPosition);
		};
	}, [pastSeasonsOpen, updatePastSeasonsMenuPosition]);

	useEffect(() => {
		if (!pastSeasonsOpen) return;
		const close = (e: MouseEvent) => {
			const t = e.target as Node;
			if (pastSeasonsTriggerRef.current?.contains(t)) return;
			if (pastSeasonsDropdownRef.current?.contains(t)) return;
			setPastSeasonsOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setPastSeasonsOpen(false);
		};
		document.addEventListener("mousedown", close);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", close);
			document.removeEventListener("keydown", onKey);
		};
	}, [pastSeasonsOpen]);

	const playerName = useMemo(() => profileSlugToPlayerName(playerSlug), [playerSlug]);
	const wrappedSlug = useMemo(() => {
		if (!playerName) return null;
		return playerNameToWrappedSlug(playerName);
	}, [playerName]);

	const openWrappedHref = useMemo(() => {
		if (!wrappedSlug) return null;
		const base = `/wrapped/${wrappedSlug}`;
		if (!wrappedSelectedSeason || wrappedSeasons.length <= 1) return base;
		return `${base}?season=${encodeURIComponent(wrappedSelectedSeason)}`;
	}, [wrappedSlug, wrappedSelectedSeason, wrappedSeasons.length]);

	const pastWrappedSeasons = useMemo(() => {
		const cur = wrappedDefaultSeason ?? wrappedSelectedSeason;
		if (!cur) return wrappedSeasons.filter(() => true);
		return wrappedSeasons.filter((s) => s !== cur);
	}, [wrappedSeasons, wrappedDefaultSeason, wrappedSelectedSeason]);

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
			const promo = isSeasonWrappedPromoMonth(new Date());
			setSeasonWrappedPromoActive(promo);
			try {
				const wrappedPromise = wrappedSlug
					? fetch(`/api/wrapped/${encodeURIComponent(wrappedSlug)}`)
					: Promise.resolve(new Response("", { status: 404 }));
				const [playerRes, badgesRes, wrappedRes] = await Promise.all([
					fetch(`/api/player-data?playerName=${encodeURIComponent(playerName)}`),
					fetch(`/api/player-badges?playerName=${encodeURIComponent(playerName)}`),
					wrappedPromise,
				]);

				if (!playerRes.ok) {
					throw new Error("Could not load player profile data.");
				}
				if (!badgesRes.ok) {
					throw new Error("Could not load badge data.");
				}

				const playerJson = (await playerRes.json()) as { playerData?: PlayerData };
				const badgesJson = (await badgesRes.json()) as BadgePayload;

				if (wrappedRes.ok) {
					const wj = (await wrappedRes.json()) as {
						seasonsAvailable?: string[];
						season?: string;
					};
					const seasons = Array.isArray(wj.seasonsAvailable) ? wj.seasonsAvailable : [];
					const season = typeof wj.season === "string" ? wj.season : null;
					if (!cancelled) {
						setWrappedSeasons(seasons);
						setWrappedSelectedSeason(season ?? seasons[0] ?? null);
						setWrappedDefaultSeason(season ?? seasons[0] ?? null);
					}
				} else if (!cancelled) {
					setWrappedSeasons([]);
					setWrappedSelectedSeason(null);
					setWrappedDefaultSeason(null);
				}

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
	}, [playerName, wrappedSlug]);

	return (
		<div className='h-full px-4 py-6 md:px-8 md:py-8' data-testid='player-profile-page'>
			<div className='mx-auto w-full max-w-5xl space-y-4'>
				<div className='flex flex-col items-center justify-center text-center gap-2'>
					<h1 className='text-xl md:text-2xl font-bold text-dorkinians-yellow'>
						Player Profile{playerName ? ` - ${playerName}` : ""}
					</h1>
				</div>

				{isLoading ? (
					<SkeletonTheme baseColor='var(--skeleton-base)' highlightColor='var(--skeleton-highlight)'>
						<div className='rounded-xl border-2 border-[#E8C547]/40 bg-[#E8C547]/12 p-4 md:p-5 space-y-3'>
							<Skeleton height={22} width='40%' />
							<Skeleton count={2} height={14} />
							<Skeleton height={40} width={160} className='mx-auto' />
						</div>
						<div className='rounded-lg bg-white/10 backdrop-blur-sm p-4 mt-4 space-y-3'>
							<Skeleton height={20} width='30%' />
							<div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
								{Array.from({ length: 8 }).map((_, i) => (
									<Skeleton key={i} height={64} className='rounded-md' />
								))}
							</div>
						</div>
						<div className='rounded-lg bg-white/10 backdrop-blur-sm p-4 mt-4 space-y-2'>
							<Skeleton height={20} width='35%' />
							<div className='grid grid-cols-3 sm:grid-cols-4 gap-2'>
								{Array.from({ length: 8 }).map((_, i) => (
									<Skeleton key={i} height={72} className='rounded-lg' />
								))}
							</div>
						</div>
					</SkeletonTheme>
				) : error ? (
					<div className='rounded-lg bg-white/10 backdrop-blur-sm p-4 text-red-200'>{error}</div>
				) : (
					<>
						{seasonWrappedPromoActive ? (
						<div
							id='player-profile-season-wrapped'
							data-testid='player-profile-season-wrapped'
							className='relative z-30 overflow-visible rounded-xl border-2 border-[#E8C547]/60 bg-gradient-to-br from-[#E8C547]/45 via-[#E8C547]/28 to-[#b8941f]/18 p-4 md:p-5 shadow-lg shadow-black/30 ring-1 ring-inset ring-[#E8C547]/35 isolate'>
							<div className='flex flex-row items-start justify-center gap-4 md:gap-5 flex-wrap'>
								<div className='text-left min-w-0 flex-1 max-w-md'>
									<h3 className='text-dorkinians-yellow font-semibold text-base md:text-lg drop-shadow-sm'>
										Season Wrapped
									</h3>
									<p className='mt-1 text-white/90 text-sm leading-relaxed'>
										View {playerName ? <span className='font-medium text-white'>{playerName}</span> : null}
										{playerName ? "’s " : null}
										{wrappedSelectedSeason ? (
											<span className='font-medium text-white'>{wrappedSelectedSeason} </span>
										) : null}
										story.
										{wrappedSeasons.length > 1 && wrappedSelectedSeason ? (
											<>
												{" "}
												<button
													ref={seasonTriggerRef}
													type='button'
													data-testid='player-profile-see-other-seasons'
													onClick={() => {
														setSeasonPickerOpen((o) => {
															const next = !o;
															if (next) {
																const btn = seasonTriggerRef.current;
																if (btn) {
																	const r = btn.getBoundingClientRect();
																	setSeasonMenuPos({
																		top: r.bottom + 8,
																		left: r.left + r.width / 2,
																	});
																}
															} else {
																setSeasonMenuPos(null);
															}
															return next;
														});
													}}
													className='inline p-0 align-baseline text-sm font-medium text-[#E8C547] underline decoration-[#E8C547]/90 underline-offset-2 hover:text-white hover:decoration-white bg-transparent border-0 cursor-pointer'>
													See other seasons
												</button>
											</>
										) : null}
									</p>
								</div>
								<Image
									src='/icons/icon-96x96.png'
									alt='Dorkinians FC'
									width={48}
									height={48}
									className='rounded-full shrink-0 ring-2 ring-[#E8C547]/40'
								/>
							</div>
							{seasonPickerOpen && seasonMenuPos && typeof document !== "undefined"
								? createPortal(
										<div
											ref={seasonDropdownRef}
											data-testid='player-profile-wrapped-season-picker'
											className='fixed z-[300] min-w-[13rem] max-h-[min(50vh,20rem)] overflow-y-auto rounded-xl border-2 border-[#E8C547]/70 bg-[#0f140c] py-2 shadow-[0_16px_48px_rgba(0,0,0,0.75)] ring-1 ring-[#E8C547]/40'
											style={{
												top: seasonMenuPos.top,
												left: seasonMenuPos.left,
												transform: "translateX(-50%)",
											}}
											role='listbox'
											aria-label='Choose season'>
											{wrappedSeasons.map((s) => (
												<button
													key={s}
													type='button'
													role='option'
													aria-selected={s === wrappedSelectedSeason}
													data-season={s}
													className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
														s === wrappedSelectedSeason
															? "bg-[#E8C547]/25 text-dorkinians-yellow font-semibold"
															: "text-white/95 hover:bg-white/12"
													}`}
													onClick={() => {
														setWrappedSelectedSeason(s);
														setSeasonPickerOpen(false);
													}}>
													{s}
												</button>
											))}
										</div>,
										document.body,
									)
								: null}
							{openWrappedHref ? (
								<div className='text-center mt-4'>
									<Link
										href={openWrappedHref}
										className='inline-block text-[#E8C547] text-sm font-semibold hover:underline'>
										Open Season Wrapped
										{wrappedSelectedSeason ? ` ${wrappedSelectedSeason}` : ""} →
									</Link>
								</div>
							) : null}
						</div>
						) : null}

						<div
							className='relative z-10 rounded-lg bg-white/10 backdrop-blur-sm p-4'
							data-testid='player-profile-headline-stats'>
							<h3 className='text-white font-semibold text-sm md:text-base'>Headline Stats</h3>
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

						<div
							id='player-profile-milestone-badges'
							data-testid='player-profile-milestones'
							className='rounded-lg bg-white/10 backdrop-blur-sm p-4'>
							<h3 className='text-white font-semibold text-sm md:text-base'>Milestone Badges</h3>
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

						{!seasonWrappedPromoActive && wrappedSlug && pastWrappedSeasons.length > 0 ? (
							<div className='pt-8 pb-12 text-center border-t border-white/10 mt-6 flex flex-col items-center gap-3'>
								<button
									ref={pastSeasonsTriggerRef}
									type='button'
									data-testid='player-profile-see-past-seasons-wrapped'
									onClick={() => {
										setPastSeasonsOpen((o) => !o);
										if (!pastSeasonsOpen) {
											requestAnimationFrame(() => {
												const btn = pastSeasonsTriggerRef.current;
												if (btn) {
													const r = btn.getBoundingClientRect();
													setPastSeasonsMenuPos({ top: r.bottom + 8, left: r.left });
												}
											});
										}
									}}
									className='inline-flex items-center gap-2 mx-auto text-sm font-medium text-white underline decoration-white/50 underline-offset-2 hover:text-dorkinians-yellow hover:decoration-dorkinians-yellow bg-transparent border-0 cursor-pointer order-1'>
									<Image src='/icons/icon-96x96.png' alt='' width={20} height={20} className='rounded-full shrink-0' />
									See past seasons wrapped
								</button>
								<p className='text-white/60 text-xs max-w-sm leading-relaxed order-2'>
									Open the menu above to pick a season and view that Season Wrapped.
								</p>
								{pastSeasonsOpen && pastSeasonsMenuPos && typeof document !== "undefined"
									? createPortal(
											<div
												ref={pastSeasonsDropdownRef}
												data-testid='player-profile-past-seasons-menu'
												className='fixed z-[300] min-w-[13rem] max-h-[min(50vh,20rem)] overflow-y-auto rounded-xl border-2 border-[#E8C547]/70 bg-[#0f140c] py-2 shadow-[0_16px_48px_rgba(0,0,0,0.75)] ring-1 ring-[#E8C547]/40'
												style={{
													top: pastSeasonsMenuPos.top,
													left: pastSeasonsMenuPos.left,
												}}
												role='listbox'
												aria-label='Past seasons wrapped'>
												{pastWrappedSeasons.map((s) => (
													<Link
														key={s}
														href={`/wrapped/${wrappedSlug}?season=${encodeURIComponent(s)}`}
														role='option'
														prefetch={false}
														className='block w-full px-4 py-2.5 text-left text-sm text-white/95 hover:bg-white/12'
														onClick={() => setPastSeasonsOpen(false)}>
														{s}
													</Link>
												))}
											</div>,
											document.body,
										)
									: null}
							</div>
						) : null}
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
