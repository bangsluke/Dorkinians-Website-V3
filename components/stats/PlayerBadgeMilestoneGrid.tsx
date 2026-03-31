"use client";

import type { ReactNode } from "react";
import { BADGE_DEFINITIONS, BADGE_CATEGORY_ORDER, CATEGORY_LABELS, type BadgeDefinition } from "@/lib/badges/catalog";
import { buildMilestoneBadgeTooltip, formatBadgeNumber } from "@/lib/badges/badgeTooltip";
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
	const label = CATEGORY_LABELS[category] ?? category;
	return label.toLowerCase().includes("milestone") ? label : `${label} milestones`;
}

function tierThresholdLabel(def: BadgeDefinition, tier: string): string | undefined {
	const t = def.tiers[tier as keyof typeof def.tiers];
	if (!t) return undefined;
	return formatBadgeNumber(t.threshold);
}

function MilestoneHoverShell({
	tip,
	className,
	children,
}: {
	tip: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div
			tabIndex={0}
			className={`group relative outline-none ${className ?? ""}`}>
			{children}
			<div
				className='pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md bg-black/90 p-2 text-left text-[11px] leading-snug text-white shadow-lg group-hover:block group-focus-visible:block'
				role='tooltip'>
				{tip}
			</div>
		</div>
	);
}

export default function PlayerBadgeMilestoneGrid({
	earned,
	progress,
}: {
	earned: EarnedBadgeRow[];
	progress: ProgressRow[];
}) {
	const earnedByKey = mergeEarnedByKey(earned);
	const progressByKey = new Map<string, ProgressRow>();
	for (const p of progress) {
		progressByKey.set(p.badgeKey, p);
	}
	const totalBadges = Object.keys(BADGE_DEFINITIONS).length;
	const unlockedCount = earnedByKey.size;
	const unlockedPercent = totalBadges > 0 ? Math.round((unlockedCount / totalBadges) * 100) : 0;
	const recentlyUnlocked = [...earned]
		.sort((a, b) => toDateValue(b.earnedDate) - toDateValue(a.earnedDate))
		.at(0);

	return (
		<div id='player-achievement-badges' className='mt-3 space-y-4' data-testid='player-badge-milestones'>
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
						<MilestoneHoverShell
							className='shrink-0'
							tip={
								BADGE_DEFINITIONS[recentlyUnlocked.badgeKey]
									? buildMilestoneBadgeTooltip(
											BADGE_DEFINITIONS[recentlyUnlocked.badgeKey],
											recentlyUnlocked,
											progressByKey.get(recentlyUnlocked.badgeKey),
										)
									: `${recentlyUnlocked.badgeName} — ${recentlyUnlocked.description}`
							}>
							<BadgeDot
								tier={recentlyUnlocked.tier}
								title=''
								aria-label={
									BADGE_DEFINITIONS[recentlyUnlocked.badgeKey]
										? buildMilestoneBadgeTooltip(
												BADGE_DEFINITIONS[recentlyUnlocked.badgeKey],
												recentlyUnlocked,
												progressByKey.get(recentlyUnlocked.badgeKey),
											)
										: `${recentlyUnlocked.badgeName} — ${recentlyUnlocked.description}`
								}
								size='md'
								innerLabel={
									BADGE_DEFINITIONS[recentlyUnlocked.badgeKey]
										? tierThresholdLabel(BADGE_DEFINITIONS[recentlyUnlocked.badgeKey], recentlyUnlocked.tier)
										: undefined
								}
							/>
						</MilestoneHoverShell>
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
						<div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'>
							{keys.map((badgeKey) => {
								const def = BADGE_DEFINITIONS[badgeKey];
								if (!def) return null;
								const got = earnedByKey.get(badgeKey);
								const prog = progressByKey.get(badgeKey);
								const tip = buildMilestoneBadgeTooltip(def, got, prog);
								const earnedInner = got ? tierThresholdLabel(def, got.tier) : undefined;
								const lockedInner =
									prog && prog.remaining > 0 ? formatBadgeNumber(prog.targetValue) : prog ? "—" : "—";
								return (
									<MilestoneHoverShell
										key={badgeKey}
										tip={tip}
										className={`flex flex-col items-center text-center gap-1.5 p-2 rounded-lg cursor-help ${
											got ? "bg-white/5 border border-white/10" : "border border-dashed border-white/25 bg-transparent"
										}`}>
										{got ? (
											<BadgeDot tier={got.tier} title='' aria-label={tip} size='md' innerLabel={earnedInner} />
										) : (
											<div className='h-9 w-9 min-h-[36px] min-w-[36px] rounded-full border-2 border-dashed border-white/30 flex items-center justify-center bg-black/15'>
												<span className='text-[9px] font-bold text-white/80 tabular-nums px-0.5 text-center leading-none'>
													{lockedInner}
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
													: "—"}
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
