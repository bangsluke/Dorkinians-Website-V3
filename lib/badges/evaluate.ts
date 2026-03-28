import { BADGE_DEFINITIONS, type BadgeTier } from "./catalog";
import type { BadgePlayer } from "./neo4jProps";

const TIER_ORDER_HIGH_FIRST: BadgeTier[] = ["diamond", "gold", "silver", "bronze"];
const TIER_ORDER_LOW_FIRST: BadgeTier[] = ["bronze", "silver", "gold", "diamond"];

const TIER_RANK: Record<BadgeTier, number> = { bronze: 1, silver: 2, gold: 3, diamond: 4 };

export function tierRank(tier: string): number {
	return TIER_RANK[tier as BadgeTier] ?? 0;
}

export function compareTierHighestFirst(a: string, b: string): number {
	return tierRank(b) - tierRank(a);
}

export type EarnedBadgeDTO = {
	badgeKey: string;
	badgeId: string;
	badgeName: string;
	badgeCategory: string;
	tier: string;
	description: string;
};

export function evaluateAllBadges(player: BadgePlayer): EarnedBadgeDTO[] {
	const earned: EarnedBadgeDTO[] = [];
	for (const [badgeKey, definition] of Object.entries(BADGE_DEFINITIONS)) {
		const playerValue = definition.evaluate(player);
		for (const tier of TIER_ORDER_HIGH_FIRST) {
			const t = definition.tiers[tier];
			if (t && playerValue >= t.threshold) {
				earned.push({
					badgeKey,
					badgeId: `${badgeKey}_${tier}`,
					badgeName: definition.name,
					badgeCategory: definition.category,
					tier,
					description: t.description,
				});
				break;
			}
		}
	}
	return earned;
}

export type BadgeProgressDTO = {
	badgeKey: string;
	badgeName: string;
	nextTier: string;
	currentValue: number;
	targetValue: number;
	progressPercent: number;
	remaining: number;
};

export function getBadgeProgress(player: BadgePlayer): BadgeProgressDTO[] {
	const progress: BadgeProgressDTO[] = [];
	for (const [badgeKey, definition] of Object.entries(BADGE_DEFINITIONS)) {
		const raw = definition.evaluate(player);
		const playerValue = typeof raw === "number" && !Number.isNaN(raw) ? raw : 0;
		for (const tier of TIER_ORDER_LOW_FIRST) {
			const t = definition.tiers[tier];
			if (!t) continue;
			if (playerValue < t.threshold) {
				const target = t.threshold;
				const pct = target > 0 ? Math.min(100, Math.round((playerValue / target) * 100)) : 0;
				progress.push({
					badgeKey,
					badgeName: definition.name,
					nextTier: tier,
					currentValue: playerValue,
					targetValue: target,
					progressPercent: pct,
					remaining: Math.max(0, target - playerValue),
				});
				break;
			}
		}
	}
	return progress;
}

export function highestTierFromEarned(earned: Array<{ tier: string }>): string | null {
	if (!earned.length) return null;
	const sorted = [...earned].sort((a, b) => compareTierHighestFirst(a.tier, b.tier));
	return sorted[0].tier;
}

const TIER_BAR_PRIORITY: Record<string, number> = { diamond: 4, gold: 3, silver: 2, bronze: 1 };

/**
 * Pick up to `limit` badges for the compact header bar (highest tier first).
 */
export function selectBadgesForBar(
	earned: Array<{ badgeId: string; badgeName: string; tier: string; badgeCategory: string }>,
	limit = 5,
): Array<{ badgeId: string; badgeName: string; tier: string; badgeCategory: string }> {
	return [...earned]
		.sort((a, b) => {
			const tr = (TIER_BAR_PRIORITY[b.tier] ?? 0) - (TIER_BAR_PRIORITY[a.tier] ?? 0);
			if (tr !== 0) return tr;
			return a.badgeName.localeCompare(b.badgeName);
		})
		.slice(0, limit);
}
