import type { BadgeDefinition } from "@/lib/badges/catalog";

type EarnedRow = {
	tier: string;
	description: string;
};

type Progress = {
	nextTier: string;
	currentValue: number;
	targetValue: number;
	remaining: number;
};

/** Stable display for badge metrics (avoids float junk like 0.09000000000000001). */
export function formatBadgeNumber(n: number): string {
	if (!Number.isFinite(n)) return "-";
	const nearInt = Math.abs(n - Math.round(n)) < 1e-6;
	if (nearInt) return String(Math.round(n));
	const rounded = Math.round(n * 10000) / 10000;
	let s = rounded.toFixed(4);
	s = s.replace(/\.?0+$/, "");
	return s || "0";
}

export function formatBadgeMetricValue(n: number, badgeKey?: string): string {
	if (!Number.isFinite(n)) return "-";
	if (badgeKey === "fines_paid") return `£${Math.round(n)}`;
	if (badgeKey === "fantasy_centurion") return String(Math.round(n));
	return formatBadgeNumber(n);
}

export type MilestoneTooltipContext = {
	badgeKey?: string;
	/** Count of club players who have earned this milestone at any tier (optional). */
	achieverCountAnyTier?: number;
	/** Count at the same tier as the current player (when earned). */
	tierPeerCount?: number;
	/** Player with the highest raw stat for this milestone’s measure. */
	leader?: { playerName: string; value: number } | null;
	/** Current player’s evaluated stat for this milestone (from API). */
	currentStatValue?: number;
};

export type MilestoneTooltipLines = {
	titleLine: string;
	descriptionLine: string;
	currentLine: string;
	nextLine: string;
	peersLine: string;
	leaderLine: string;
};

/**
 * Six-line milestone tooltip layout for profile grid / modal.
 */
export function buildMilestoneTooltipLines(
	def: BadgeDefinition,
	got: EarnedRow | undefined,
	prog: Progress | undefined,
	ctx: MilestoneTooltipContext = {},
): MilestoneTooltipLines {
	const titleLine = def.name;
	const descriptionLine = def.description;

	const rawVal =
		ctx.currentStatValue != null && Number.isFinite(ctx.currentStatValue)
			? ctx.currentStatValue
			: prog?.currentValue;
	const valueStr = rawVal != null && Number.isFinite(rawVal) ? formatBadgeMetricValue(rawVal, ctx.badgeKey) : "-";

	let currentLine: string;
	if (got) {
		currentLine = `Earned ${got.tier}: ${got.description}. Current value: ${valueStr}.`;
	} else if (prog) {
		currentLine = `Current value: ${valueStr}.`;
	} else {
		currentLine = "Current value: -.";
	}

	let nextLine: string;
	if (prog && prog.remaining > 0) {
		nextLine = `Next tier: ${prog.nextTier} at ${formatBadgeMetricValue(prog.targetValue, ctx.badgeKey)} - ${formatBadgeMetricValue(prog.remaining, ctx.badgeKey)} to go.`;
	} else if (got) {
		nextLine = "Next tier: You’re at the highest tier for this milestone.";
	} else {
		nextLine = "Next tier: Keep playing to unlock progress.";
	}

	let peersLine: string;
	if (got && typeof ctx.tierPeerCount === "number" && Number.isFinite(ctx.tierPeerCount)) {
		peersLine = `${formatBadgeNumber(ctx.tierPeerCount)} club player${ctx.tierPeerCount === 1 ? "" : "s"} ${ctx.tierPeerCount === 1 ? "is" : "are"} at the same tier (${got.tier}) for this milestone.`;
	} else if (typeof ctx.achieverCountAnyTier === "number" && Number.isFinite(ctx.achieverCountAnyTier)) {
		peersLine = `${formatBadgeNumber(ctx.achieverCountAnyTier)} club player${ctx.achieverCountAnyTier === 1 ? "" : "s"} have earned this milestone (any tier).`;
	} else {
		peersLine = "Club milestone counts aren’t available.";
	}

	let leaderLine: string;
	if (ctx.leader && ctx.leader.playerName.trim() !== "") {
		leaderLine = `Club leader: ${ctx.leader.playerName} (${formatBadgeMetricValue(ctx.leader.value, ctx.badgeKey)}).`;
	} else {
		leaderLine = "Club leader: -";
	}

	return {
		titleLine,
		descriptionLine,
		currentLine,
		nextLine,
		peersLine,
		leaderLine,
	};
}

/** Single string for aria-label / simple hover (newline-separated). */
export function buildMilestoneBadgeTooltip(
	def: BadgeDefinition,
	got: EarnedRow | undefined,
	prog: Progress | undefined,
	ctx: MilestoneTooltipContext = {},
): string {
	const lines = buildMilestoneTooltipLines(def, got, prog, ctx);
	return [
		lines.titleLine,
		lines.descriptionLine,
		lines.currentLine,
		lines.nextLine,
		lines.peersLine,
		lines.leaderLine,
	].join("\n");
}
