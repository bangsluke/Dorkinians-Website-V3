"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";
import { BADGE_DEFINITIONS, BADGE_CATEGORY_ORDER, CATEGORY_LABELS, type BadgeDefinition } from "@/lib/badges/catalog";
import {
	buildMilestoneBadgeTooltip,
	buildMilestoneTooltipLines,
	formatBadgeNumber,
	type MilestoneTooltipLines,
} from "@/lib/badges/badgeTooltip";
import { tierRank } from "@/lib/badges/evaluate";
import BadgeDot from "@/components/stats/BadgeDot";

export type EarnedBadgeRow = {
	badgeId: string;
	badgeKey: string;
	badgeName: string;
	badgeCategory: string;
	tier: string;
	description: string;
	earnedDate: string | null;
};

export type ProgressRow = {
	badgeKey: string;
	badgeName: string;
	nextTier: string;
	currentValue: number;
	targetValue: number;
	progressPercent: number;
	remaining: number;
};

function mergeEarnedByKey(earned: EarnedBadgeRow[]): Map<string, EarnedBadgeRow> {
	const map = new Map<string, EarnedBadgeRow>();
	for (const e of earned) {
		const prev = map.get(e.badgeKey);
		if (!prev || tierRank(e.tier) > tierRank(prev.tier)) {
			map.set(e.badgeKey, e);
		}
	}
	return map;
}

function toDateValue(iso: string | null): number {
	if (!iso) return Number.NEGATIVE_INFINITY;
	const t = Date.parse(iso);
	return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

function getCategoryHeading(category: string): string {
	return CATEGORY_LABELS[category] ?? category;
}

function tierThresholdLabel(def: BadgeDefinition, tier: string): string | undefined {
	const t = def.tiers[tier as keyof typeof def.tiers];
	if (!t) return undefined;
	return formatBadgeNumber(t.threshold);
}

function TooltipLineBlock({ lines }: { lines: MilestoneTooltipLines }) {
	const rows = [
		lines.titleLine,
		lines.descriptionLine,
		lines.currentLine,
		lines.nextLine,
		lines.peersLine,
		lines.leaderLine,
	];
	return (
		<div className='text-left text-[11px] leading-snug text-white space-y-1.5'>
			{rows.map((line, i) => (
				<p key={i} className={i === 0 ? "text-dorkinians-yellow font-semibold text-xs" : ""}>
					{line}
				</p>
			))}
		</div>
	);
}

function MilestoneHoverShell({
	lines,
	className,
	children,
	isSmallScreen,
	onActivate,
}: {
	lines: MilestoneTooltipLines;
	className?: string;
	children: ReactNode;
	isSmallScreen: boolean;
	onActivate: () => void;
}) {
	const tipString = [
		lines.titleLine,
		lines.descriptionLine,
		lines.currentLine,
		lines.nextLine,
		lines.peersLine,
		lines.leaderLine,
	].join("\n");

	return (
		<div
			tabIndex={0}
			role='button'
			onClick={(e) => {
				if (isSmallScreen) {
					e.preventDefault();
					e.stopPropagation();
					onActivate();
				}
			}}
			onKeyDown={(e) => {
				if (isSmallScreen && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					onActivate();
				}
			}}
			className={`group relative outline-none ${className ?? ""} ${isSmallScreen ? "cursor-pointer" : ""}`}>
			{children}
			{!isSmallScreen ? (
				<div
					className='pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md bg-black/90 p-3 shadow-lg group-hover:block group-focus-visible:block'
					role='tooltip'>
					<TooltipLineBlock lines={lines} />
				</div>
			) : null}
			<span className='sr-only'>{tipString}</span>
		</div>
	);
}

export default function PlayerBadgeMilestoneGrid({
	earned,
	progress,
	achieverCountsByBadgeKey,
	tierCountsByBadgeKey,
	milestoneValuesByBadgeKey,
	milestoneLeadersByBadgeKey,
}: {
	earned: EarnedBadgeRow[];
	progress: ProgressRow[];
	achieverCountsByBadgeKey?: Record<string, number>;
	tierCountsByBadgeKey?: Record<string, Record<string, number>>;
	milestoneValuesByBadgeKey?: Record<string, number>;
	milestoneLeadersByBadgeKey?: Record<string, { playerName: string; value: number }>;
}) {
	const earnedByKey = mergeEarnedByKey(earned);
	const achieverCounts = achieverCountsByBadgeKey ?? {};
	const tiers = tierCountsByBadgeKey ?? {};
	const statVals = milestoneValuesByBadgeKey ?? {};
	const leaders = milestoneLeadersByBadgeKey ?? {};
	const progressByKey = new Map<string, ProgressRow>();
	for (const p of progress) {
		progressByKey.set(p.badgeKey, p);
	}
	const totalBadges = Object.keys(BADGE_DEFINITIONS).length;
	const unlockedCount = earnedByKey.size;
	const unlockedPercent = totalBadges > 0 ? Math.round((unlockedCount / totalBadges) * 100) : 0;
	const recentlyUnlocked = [...earned].sort(
		(a, b) => toDateValue(b.earnedDate) - toDateValue(a.earnedDate),
	)[0];

	const [isSmallScreen, setIsSmallScreen] = useState(false);
	const [modalLines, setModalLines] = useState<MilestoneTooltipLines | null>(null);

	useEffect(() => {
		const mq = window.matchMedia("(max-width: 767px)");
		const apply = () => setIsSmallScreen(mq.matches);
		apply();
		mq.addEventListener("change", apply);
		return () => mq.removeEventListener("change", apply);
	}, []);

	const openModal = useCallback((lines: MilestoneTooltipLines) => {
		setModalLines(lines);
	}, []);

	useEffect(() => {
		if (!modalLines) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setModalLines(null);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [modalLines]);

	const buildCtx = useCallback(
		(badgeKey: string, got: EarnedBadgeRow | undefined) => {
			const tierPeerCount =
				got ? tiers[badgeKey]?.[got.tier] : undefined;
			return {
				achieverCountAnyTier: achieverCounts[badgeKey],
				tierPeerCount,
				leader: leaders[badgeKey] ?? null,
				currentStatValue: statVals[badgeKey],
			};
		},
		[achieverCounts, leaders, statVals, tiers],
	);

	const getBadgeCurrentValue = useCallback(
		(badgeKey: string, prog?: ProgressRow): number | null => {
			const value = statVals[badgeKey];
			if (typeof value === "number" && Number.isFinite(value)) return value;
			if (prog && typeof prog.currentValue === "number" && Number.isFinite(prog.currentValue)) return prog.currentValue;
			return null;
		},
		[statVals],
	);

	const nextThresholdAfterTier = (def: BadgeDefinition, tier: string): number | null => {
		const order = ["bronze", "silver", "gold", "diamond"];
		const idx = order.indexOf(tier);
		if (idx < 0 || idx >= order.length - 1) return null;
		const nextTier = order[idx + 1] as keyof typeof def.tiers;
		const next = def.tiers[nextTier];
		return next ? next.threshold : null;
	};

	const badgeValueLabel = (
		def: BadgeDefinition,
		badgeKey: string,
		got: EarnedBadgeRow | undefined,
		prog: ProgressRow | undefined,
	): string => {
		const current = getBadgeCurrentValue(badgeKey, prog);
		if (current == null) return "-";
		if (got) {
			if (got.tier === "diamond") return formatBadgeNumber(current);
			const next = nextThresholdAfterTier(def, got.tier);
			return next == null ? formatBadgeNumber(current) : `${formatBadgeNumber(current)} / ${formatBadgeNumber(next)}`;
		}
		if (prog) return `${formatBadgeNumber(current)} / ${formatBadgeNumber(prog.targetValue)}`;
		return formatBadgeNumber(current);
	};

	return (
		<div id='player-achievement-badges' className='mt-3 space-y-4' data-testid='player-badge-milestones'>
			{modalLines && typeof document !== "undefined"
				? createPortal(
						<div
							className='fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/75'
							role='dialog'
							aria-modal='true'
							aria-label='Milestone details'
							data-testid='milestone-tooltip-modal'
							onClick={() => setModalLines(null)}>
							<div
								className='max-w-md w-full rounded-xl border border-[#E8C547]/40 bg-[#0f140c] p-4 shadow-2xl ring-1 ring-[#E8C547]/25'
								onClick={(e) => e.stopPropagation()}>
								<TooltipLineBlock lines={modalLines} />
								<button
									type='button'
									className='mt-4 w-full rounded-lg border border-white/20 py-2 text-sm font-medium text-white hover:bg-white/10'
									onClick={() => setModalLines(null)}>
									Close
								</button>
							</div>
						</div>,
						document.body,
					)
				: null}

			<div className='rounded-xl border border-white/10 bg-black/15 p-3'>
				<div className='flex items-center justify-between text-sm'>
					<h5 className='text-white font-semibold'>Achievements</h5>
					<span className='text-white/70'>
						{unlockedCount} / {totalBadges}
					</span>
				</div>
				<div className='mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden'>
					<div
						className='h-full rounded-full bg-dorkinians-yellow transition-all duration-300'
						style={{ width: `${Math.max(0, Math.min(100, unlockedPercent))}%` }}
					/>
				</div>
			</div>

			{recentlyUnlocked ? (
				<div className='relative z-20 overflow-visible rounded-xl border-2 border-[#E8C547]/60 bg-gradient-to-br from-[#E8C547]/45 via-[#E8C547]/28 to-[#b8941f]/18 p-3 md:p-5 shadow-lg shadow-black/30 ring-1 ring-inset ring-[#E8C547]/35 isolate'>
					<p className='text-dorkinians-yellow text-xs font-semibold uppercase tracking-wide'>Recently unlocked</p>
					<div className='mt-2 flex items-center gap-3'>
						{(() => {
							const def = BADGE_DEFINITIONS[recentlyUnlocked.badgeKey];
							const prog = progressByKey.get(recentlyUnlocked.badgeKey);
							const ctx = buildCtx(recentlyUnlocked.badgeKey, recentlyUnlocked);
							const lines = def
								? buildMilestoneTooltipLines(def, recentlyUnlocked, prog, ctx)
								: ({
										titleLine: recentlyUnlocked.badgeName,
										descriptionLine: recentlyUnlocked.description,
										currentLine: "Current value: -.",
										nextLine: "Next tier: -",
										peersLine: "Club milestone counts aren’t available.",
										leaderLine: "Club leader: -",
									} as MilestoneTooltipLines);
							const aria = def
								? buildMilestoneBadgeTooltip(def, recentlyUnlocked, prog, ctx)
								: `${recentlyUnlocked.badgeName} - ${recentlyUnlocked.description}`;
							return (
								<MilestoneHoverShell
									className='shrink-0'
									lines={lines}
									isSmallScreen={isSmallScreen}
									onActivate={() => openModal(lines)}>
									<BadgeDot
										tier={recentlyUnlocked.tier}
										title=''
										aria-label={aria}
										size='md'
										innerLabel={
											def ? tierThresholdLabel(def, recentlyUnlocked.tier) : undefined
										}
									/>
								</MilestoneHoverShell>
							);
						})()}
						<div className='min-w-0 flex-1'>
							<p className='text-white font-semibold leading-tight'>{recentlyUnlocked.badgeName}</p>
							<p className='text-white/80 text-xs leading-tight'>{recentlyUnlocked.description}</p>
						</div>
						<span className='px-2 py-0.5 rounded bg-black/20 text-dorkinians-yellow text-[10px] font-semibold uppercase'>
							{recentlyUnlocked.tier}
						</span>
					</div>
				</div>
			) : null}

			{BADGE_CATEGORY_ORDER.map((category) => {
				const keys = Object.entries(BADGE_DEFINITIONS)
					.filter(([, def]) => def.category === category)
					.map(([k]) => k);
				if (!keys.length) return null;
				return (
					<div key={category} className='rounded-xl border border-white/10 bg-black/15 p-3'>
						<p className='text-white/90 text-sm font-semibold mb-3'>{getCategoryHeading(category)}</p>
						<div className='grid grid-cols-3 md:grid-cols-4 gap-3'>
							{keys
								.sort((a, b) => {
									const defA = BADGE_DEFINITIONS[a];
									const defB = BADGE_DEFINITIONS[b];
									const gotA = earnedByKey.get(a);
									const gotB = earnedByKey.get(b);
									if (gotA && !gotB) return -1;
									if (!gotA && gotB) return 1;
									if (gotA && gotB) {
										const tierCmp = tierRank(gotB.tier) - tierRank(gotA.tier);
										if (tierCmp !== 0) return tierCmp;
									}
									return defA.name.localeCompare(defB.name);
								})
								.map((badgeKey) => {
								const def = BADGE_DEFINITIONS[badgeKey];
								if (!def) return null;
								const got = earnedByKey.get(badgeKey);
								const prog = progressByKey.get(badgeKey);
								const ctx = buildCtx(badgeKey, got);
								const lines = buildMilestoneTooltipLines(def, got, prog, ctx);
								const aria = buildMilestoneBadgeTooltip(def, got, prog, ctx);
								const innerValue = badgeValueLabel(def, badgeKey, got, prog);
								return (
									<MilestoneHoverShell
										key={badgeKey}
										lines={lines}
										isSmallScreen={isSmallScreen}
										onActivate={() => openModal(lines)}
										className={`flex flex-col items-center text-center gap-1.5 p-2 rounded-lg ${
											got ? "bg-white/5 border border-white/10" : "border border-dashed border-white/25 bg-transparent"
										} ${isSmallScreen ? "" : "cursor-help"}`}>
										{got ? (
											<BadgeDot tier={got.tier} title='' aria-label={aria} size='md' innerLabel={innerValue} />
										) : (
											<div className='h-9 w-9 min-h-[36px] min-w-[36px] rounded-full border-2 border-dashed border-white/30 flex items-center justify-center bg-black/15'>
												<span className='text-[8px] font-bold text-white/80 tabular-nums px-0.5 text-center leading-none'>
													{innerValue}
												</span>
											</div>
										)}
										<span className='text-white text-[11px] leading-tight line-clamp-2'>{def.name}</span>
										{got ? (
											<span className='text-[10px] text-dorkinians-yellow capitalize font-semibold'>{got.tier}</span>
										) : prog ? (
											<span className='text-[10px] text-white/65'>
												{prog.remaining > 0
													? `${formatBadgeNumber(prog.remaining)} to ${prog.nextTier}`
													: "-"}
											</span>
										) : (
											<span className='text-[10px] text-white/65'>Max tier</span>
										)}
									</MilestoneHoverShell>
								);
							})}
						</div>
					</div>
				);
			})}
		</div>
	);
}
