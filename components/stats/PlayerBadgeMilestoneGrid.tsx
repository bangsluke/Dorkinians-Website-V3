"use client";

import { BADGE_DEFINITIONS, BADGE_CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/badges/catalog";
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

	return (
		<div id='player-achievement-badges' className='mt-3 space-y-4' data-testid='player-badge-milestones'>
			<h5 className='text-white/90 font-medium text-xs uppercase tracking-wide'>Milestone badges</h5>
			{BADGE_CATEGORY_ORDER.map((category) => {
				const keys = Object.entries(BADGE_DEFINITIONS)
					.filter(([, def]) => def.category === category)
					.map(([k]) => k);
				if (!keys.length) return null;
				return (
					<div key={category}>
						<p className='text-dorkinians-yellow text-xs font-semibold mb-2'>{CATEGORY_LABELS[category] ?? category}</p>
						<div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'>
							{keys.map((badgeKey) => {
								const def = BADGE_DEFINITIONS[badgeKey];
								if (!def) return null;
								const got = earnedByKey.get(badgeKey);
								const prog = progressByKey.get(badgeKey);
								return (
									<div
										key={badgeKey}
										className={`flex flex-col items-center text-center gap-1.5 p-2 rounded-lg ${
											got ? "bg-white/5" : "border border-dashed border-white/25 bg-transparent"
										}`}>
										{got ? (
											<BadgeDot tier={got.tier} title={`${got.badgeName} — ${got.description}`} size='md' />
										) : (
											<div
												className='h-9 w-9 min-h-[36px] min-w-[36px] rounded-full border-2 border-dashed border-white/35 flex items-center justify-center'
												title={def.name}>
												<span className='text-[10px] text-white/50 font-mono'>{prog?.progressPercent ?? 0}%</span>
											</div>
										)}
										<span className='text-white text-[11px] leading-tight line-clamp-2'>{def.name}</span>
										{got ? (
											<span className='text-[10px] text-dorkinians-yellow capitalize'>{got.tier}</span>
										) : prog ? (
											<span className='text-[10px] text-white/60'>
												{prog.remaining > 0 ? `${prog.remaining} to ${prog.nextTier}` : "—"}
											</span>
										) : (
											<span className='text-[10px] text-white/60'>Max tier</span>
										)}
									</div>
								);
							})}
						</div>
					</div>
				);
			})}
		</div>
	);
}
