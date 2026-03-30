"use client";

import { useMemo, useState } from "react";
import { buildMatchRatingBreakdown } from "@/lib/utils/matchRatingBreakdown";
import VeoWatchMatchButtons from "./VeoWatchMatchButtons";

export interface FixtureLineupPlayer {
	playerName: string;
	position: string;
	minutes: number;
	goals: number;
	assists: number;
	mom: number;
	yellowCards: number;
	redCards: number;
	saves: number;
	cleanSheets: number;
	conceded: number;
	ownGoals: number;
	penaltiesScored: number;
	penaltiesMissed: number;
	penaltiesConceded: number;
	penaltiesSaved: number;
	matchRating?: number | null;
	started?: boolean;
}

interface FixtureExpandedDetailsProps {
	lineup: FixtureLineupPlayer[] | undefined;
	loading?: boolean;
	veoLink?: string | null;
	/** When true, Veo links are rendered by the parent (e.g. below MoM on League Information). */
	suppressVeoLink?: boolean;
	testIdPrefix: string;
}

function positionSortOrder(position: string): number {
	const p = (position || "").toLowerCase();
	if (p.includes("goalkeeper") || p === "gk") return 0;
	if (p.includes("defender") || p === "def") return 1;
	if (p.includes("midfielder") || p === "mid") return 2;
	if (p.includes("forward") || p === "fwd") return 3;
	return 4;
}

function sortLineupByPositionAndMinutes(lineup: FixtureLineupPlayer[]): FixtureLineupPlayer[] {
	return [...lineup].sort((a, b) => {
		const orderA = positionSortOrder(a.position);
		const orderB = positionSortOrder(b.position);
		if (orderA !== orderB) return orderA - orderB;
		return b.minutes - a.minutes;
	});
}

const OPTIONAL_LINEUP_COLUMNS: { key: keyof FixtureLineupPlayer; label: string }[] = [
	{ key: "saves", label: "SAVES" },
	{ key: "ownGoals", label: "OG" },
	{ key: "penaltiesScored", label: "PSC" },
	{ key: "penaltiesMissed", label: "PM" },
	{ key: "penaltiesConceded", label: "PCO" },
	{ key: "penaltiesSaved", label: "PSV" },
];

function getVisibleOptionalColumns(lineup: FixtureLineupPlayer[]): (keyof FixtureLineupPlayer)[] {
	return OPTIONAL_LINEUP_COLUMNS.filter(({ key }) => lineup.some((row) => (row[key] as number) > 0)).map(({ key }) => key);
}

function getPositionBadge(position: string): { label: string; className: string } {
	const p = (position || "").trim().toUpperCase();
	if (p.includes("GOAL") || p === "GK")
		return { label: "GK", className: "px-2 py-1 rounded text-xs font-medium bg-purple-600/30 text-purple-300" };
	if (p.includes("DEF") || p.includes("DEFENDER"))
		return { label: "DEF", className: "px-2 py-1 rounded text-xs font-medium bg-amber-700/30 text-amber-200" };
	if (p.includes("MID") || p.includes("MIDFIELDER"))
		return { label: "MID", className: "px-2 py-1 rounded text-xs font-medium bg-green-600/30 text-green-300" };
	if (p.includes("FWD") || p.includes("FORWARD"))
		return { label: "FWD", className: "px-2 py-1 rounded text-xs font-medium bg-teal-600/30 text-teal-300" };
	return { label: position || "—", className: "px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300" };
}

function normalizePositionBucket(position: string): "GK" | "DEF" | "MID" | "FWD" | "OTHER" {
	const p = (position || "").toUpperCase();
	if (p.includes("GOAL") || p === "GK") return "GK";
	if (p.includes("DEF")) return "DEF";
	if (p.includes("MID")) return "MID";
	if (p.includes("FWD") || p.includes("FORWARD") || p.includes("ATT")) return "FWD";
	return "OTHER";
}

function breakdownForPlayer(player: FixtureLineupPlayer) {
	return buildMatchRatingBreakdown({
		class: player.position,
		minutes: player.minutes,
		goals: player.goals,
		assists: player.assists,
		mom: player.mom,
		cleanSheets: player.cleanSheets,
		saves: player.saves,
		yellowCards: player.yellowCards,
		redCards: player.redCards,
		ownGoals: player.ownGoals,
		conceded: player.conceded,
		penaltiesMissed: player.penaltiesMissed,
		penaltiesSaved: player.penaltiesSaved,
	});
}

function displayRating(player: FixtureLineupPlayer): string {
	if (player.matchRating != null && player.matchRating !== undefined) {
		const n = Number(player.matchRating);
		if (!Number.isNaN(n)) return n.toFixed(1);
	}
	return breakdownForPlayer(player).final.toFixed(1);
}

const FORMATION_ROW_ORDER = ["FWD", "MID", "DEF", "GK"] as const;

export default function FixtureExpandedDetails({
	lineup,
	loading = false,
	veoLink,
	suppressVeoLink = false,
	testIdPrefix,
}: FixtureExpandedDetailsProps) {
	const [showFullPlayerDetails, setShowFullPlayerDetails] = useState(false);
	const [activeTooltipPlayer, setActiveTooltipPlayer] = useState<string | null>(null);

	const sortedLineup = useMemo(() => sortLineupByPositionAndMinutes(lineup || []), [lineup]);
	const starters = useMemo(() => {
		if (sortedLineup.length === 0) return [] as FixtureLineupPlayer[];
		const explicitStarters = sortedLineup.filter((p) => p.started === true);
		if (explicitStarters.length > 0) return explicitStarters;
		return [...sortedLineup].sort((a, b) => b.minutes - a.minutes).slice(0, 11);
	}, [sortedLineup]);

	const formationRows = useMemo(() => {
		const buckets = {
			GK: [] as FixtureLineupPlayer[],
			DEF: [] as FixtureLineupPlayer[],
			MID: [] as FixtureLineupPlayer[],
			FWD: [] as FixtureLineupPlayer[],
		};
		starters.forEach((player) => {
			const bucket = normalizePositionBucket(player.position);
			if (bucket === "OTHER") return;
			buckets[bucket].push(player);
		});
		return buckets;
	}, [starters]);

	const optionalCols = useMemo(() => getVisibleOptionalColumns(sortedLineup), [sortedLineup]);

	if (loading) {
		return <div className='text-gray-400 text-sm'>Loading lineup…</div>;
	}

	if (!lineup || lineup.length === 0) {
		return <div className='text-gray-400 text-sm'>No lineup data</div>;
	}

	return (
		<div className='space-y-3' data-testid={`${testIdPrefix}-fixture-expanded`}>
			<div className='mt-4'>
				<h5 className='text-sm font-semibold text-white'>Formation</h5>
				<p className='text-xs text-gray-400 mt-1'>Click a player dot to view match rating and rating breakdown.</p>
				<div
					className='mt-3 flex min-h-[140px] flex-col gap-5 rounded-lg bg-emerald-950/25 px-2 py-4'
					data-testid={`${testIdPrefix}-formation`}>
					{FORMATION_ROW_ORDER.map((rowKey) => {
						const rowPlayers = formationRows[rowKey];
						if (rowPlayers.length === 0) return null;
						return (
							<div key={rowKey} className='flex w-full flex-wrap items-end justify-center gap-x-4 gap-y-3'>
								{rowPlayers.map((player, pi) => {
									const isActive = activeTooltipPlayer === player.playerName;
									const breakdown = breakdownForPlayer(player);
									const ratingText = displayRating(player);
									return (
										<div key={`${rowKey}-${pi}-${player.playerName}`} className='relative flex flex-col items-center gap-1'>
											<button
												type='button'
												onClick={() => setActiveTooltipPlayer((prev) => (prev === player.playerName ? null : player.playerName))}
												className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-dorkinians-yellow/70 bg-dorkinians-yellow/15 text-xs font-bold text-dorkinians-yellow hover:bg-dorkinians-yellow/25'
												data-testid={`${testIdPrefix}-formation-player`}>
												{ratingText}
											</button>
											<span className='max-w-[4.5rem] truncate text-center text-[10px] leading-tight text-white' title={player.playerName}>
												{player.playerName}
											</span>
											{isActive ? (
												<div
													className='absolute left-1/2 top-full z-20 mt-1 w-64 -translate-x-1/2 rounded-lg border border-white/15 bg-[#111] p-3 text-xs text-gray-200 shadow-lg'
													data-testid={`${testIdPrefix}-rating-tooltip`}>
													<p className='font-semibold text-white mb-1'>{player.playerName}</p>
													<p className='mb-1'>
														Rating: <span className='font-semibold'>{breakdown.final.toFixed(1)}</span>
													</p>
													<p className='mb-1 text-gray-400'>Position: {breakdown.position}</p>
													<ul className='space-y-0.5 max-h-32 overflow-y-auto'>
														{breakdown.lines.map((line, idx) => (
															<li key={`${line.label}-${idx}`} className='flex justify-between gap-2'>
																<span className='text-gray-300'>{line.label}</span>
																<span className='font-medium'>
																	{line.delta > 0 ? "+" : ""}
																	{line.delta.toFixed(1)}
																</span>
															</li>
														))}
													</ul>
												</div>
											) : null}
										</div>
									);
								})}
							</div>
						);
					})}
				</div>
			</div>

			{!suppressVeoLink ? <VeoWatchMatchButtons veoLink={veoLink} testIdPrefix={testIdPrefix} /> : null}

			<div className='flex w-full justify-center pt-1'>
				<button
					type='button'
					onClick={() => setShowFullPlayerDetails((prev) => !prev)}
					className='text-center text-xs text-dorkinians-yellow hover:text-yellow-400 underline'
					data-testid={`${testIdPrefix}-toggle-full-details`}>
					{showFullPlayerDetails ? "Hide full player details" : "Show full player details"}
				</button>
			</div>

			{showFullPlayerDetails ? (
				<div className='overflow-x-auto' data-testid={`${testIdPrefix}-full-details-table`}>
					<table className='w-full text-white text-[0.7rem]'>
						<thead>
							<tr className='border-b border-white/20 bg-white/5'>
								<th className='sticky left-0 z-10 bg-gray-800 text-left py-2 px-2 shadow-[2px_0_4px_rgba(0,0,0,0.15)]'>Player</th>
								<th className='text-left py-2 px-2'>POS</th>
								<th className='text-right py-2 px-2'>Mins</th>
								<th className='text-right py-2 px-2'>MoM</th>
								<th className='text-right py-2 px-2'>G</th>
								<th className='text-right py-2 px-2'>A</th>
								<th className='text-right py-2 px-2'>Y</th>
								<th className='text-right py-2 px-2'>R</th>
								{optionalCols.map((key) => (
									<th key={key} className='text-right py-2 px-2'>
										{OPTIONAL_LINEUP_COLUMNS.find((c) => c.key === key)?.label ?? key}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{sortedLineup.map((row, idx) => {
								const badge = getPositionBadge(row.position);
								return (
									<tr key={idx} className='border-b border-white/10'>
										<td className='sticky left-0 z-[1] py-2 px-2 shadow-[2px_0_4px_rgba(0,0,0,0.15)] bg-gray-800'>{row.playerName}</td>
										<td className='py-2 px-2'>
											<span className={badge.className}>{badge.label}</span>
										</td>
										<td className='py-2 px-2 text-right'>{row.minutes}</td>
										<td className='py-2 px-2 text-right'>{row.mom ? "✓" : ""}</td>
										<td className='py-2 px-2 text-right'>{row.goals > 0 ? row.goals : ""}</td>
										<td className='py-2 px-2 text-right'>{row.assists > 0 ? row.assists : ""}</td>
										<td className='py-2 px-2 text-right'>{row.yellowCards || ""}</td>
										<td className='py-2 px-2 text-right'>{row.redCards || ""}</td>
										{optionalCols.map((key) => (
											<td key={key} className='py-2 px-2 text-right'>
												{(row[key] as number) > 0 ? (row[key] as number) : ""}
											</td>
										))}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			) : null}
		</div>
	);
}
