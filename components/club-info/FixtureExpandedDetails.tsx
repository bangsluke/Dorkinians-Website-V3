"use client";

import { useMemo, useState } from "react";
import { buildMatchRatingBreakdown } from "@/lib/utils/matchRatingBreakdown";
import { matchRatingCircleStyle, playerSurnameOrAfterFirstName } from "@/lib/utils/matchRatingDisplay";
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
	return { label: position || "-", className: "px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300" };
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
	return displayRatingValue(player).toFixed(1);
}

function displayRatingValue(player: FixtureLineupPlayer): number {
	if (player.matchRating != null && player.matchRating !== undefined) {
		const n = Number(player.matchRating);
		if (!Number.isNaN(n)) return clampRating(n);
	}
	return clampRating(breakdownForPlayer(player).final);
}

function clampRating(n: number): number {
	if (Number.isNaN(n)) return 6;
	return Math.min(10, Math.max(1, n));
}

const FORMATION_ROW_ORDER = ["FWD", "MID", "DEF", "GK"] as const;

/** Outfield starter counts only (GK excluded), e.g. 4-4-2. */
function formatOutfieldFormation(def: number, mid: number, fwd: number): string {
	if (def === 0 && mid === 0 && fwd === 0) return "-";
	return `${def}-${mid}-${fwd}`;
}

export default function FixtureExpandedDetails({
	lineup,
	loading = false,
	veoLink,
	suppressVeoLink = false,
	testIdPrefix,
}: FixtureExpandedDetailsProps) {
	const [showLineupTable, setShowLineupTable] = useState(false);
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

	const outfieldFormationLabel = useMemo(
		() => formatOutfieldFormation(formationRows.DEF.length, formationRows.MID.length, formationRows.FWD.length),
		[formationRows.DEF.length, formationRows.MID.length, formationRows.FWD.length],
	);

	const optionalCols = useMemo(() => getVisibleOptionalColumns(sortedLineup), [sortedLineup]);

	if (loading) {
		return <div className='text-gray-400 text-sm'>Loading lineup…</div>;
	}

	if (!lineup || lineup.length === 0) {
		return <div className='text-gray-400 text-sm'>No lineup data</div>;
	}

	const lineupTable = (
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
	);

	const formationGraphic = (
		<div
			className='mt-2 flex min-h-[160px] w-full flex-col gap-5 rounded-lg bg-emerald-950/25 px-2 py-5 sm:px-4'
			data-testid={`${testIdPrefix}-formation`}>
			{FORMATION_ROW_ORDER.map((rowKey) => {
				const rowPlayers = formationRows[rowKey];
				if (rowPlayers.length === 0) return null;
				return (
					<div key={rowKey} className='mx-auto flex w-full flex-wrap items-end justify-center gap-x-1 gap-y-4 sm:gap-x-2'>
						{rowPlayers.map((player, pi) => {
							const isActive = activeTooltipPlayer === player.playerName;
							const breakdown = breakdownForPlayer(player);
							const ratingText = displayRating(player);
							const ratingNum = displayRatingValue(player);
							const circleStyle = matchRatingCircleStyle(ratingNum);
							const shortName = playerSurnameOrAfterFirstName(player.playerName);
							return (
								<div
									key={`${rowKey}-${pi}-${player.playerName}`}
									className='relative flex w-[18%] min-w-[3.1rem] max-w-[5.5rem] flex-shrink-0 flex-col items-center gap-1 sm:min-w-[3.5rem]'>
									<button
										type='button'
										onClick={() => setActiveTooltipPlayer((prev) => (prev === player.playerName ? null : player.playerName))}
										style={circleStyle}
										className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-solid text-xs font-bold shadow-sm transition-opacity hover:opacity-90'
										data-testid={`${testIdPrefix}-formation-player`}>
										{ratingText}
									</button>
									<span
										className='w-full text-center text-[10px] leading-snug text-white break-words hyphens-auto'
										title={player.playerName}>
										{shortName}
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
	);

	return (
		<div className='space-y-3' data-testid={`${testIdPrefix}-fixture-expanded`}>
			<div className='mt-4'>
				<p className='text-sm text-gray-300'>
					<span className='text-gray-400'>Formation:</span> <span className='text-white'>{outfieldFormationLabel}</span>
				</p>
				{showLineupTable ? lineupTable : formationGraphic}
			</div>

			<div className='flex w-full justify-center pt-1'>
				<button
					type='button'
					onClick={() => {
						setShowLineupTable((prev) => !prev);
						setActiveTooltipPlayer(null);
					}}
					className='text-center text-xs text-dorkinians-yellow hover:text-yellow-400 underline'
					data-testid={`${testIdPrefix}-toggle-full-details`}>
					{showLineupTable ? "Show formation" : "Show full player details"}
				</button>
			</div>

			{!suppressVeoLink ? <VeoWatchMatchButtons veoLink={veoLink} testIdPrefix={testIdPrefix} /> : null}
		</div>
	);
}
