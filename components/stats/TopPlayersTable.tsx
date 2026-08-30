"use client";

import { Fragment, type CSSProperties, type RefObject } from "react";
import {
	formatPlayerSummary,
	formatRank,
	formatStatValue,
	getStatTypeLabel,
	type TopPlayer,
	type TopPlayersStatType,
} from "@/lib/stats/topPlayersUtils";

interface TopPlayersTableProps {
	players: TopPlayer[];
	statType: TopPlayersStatType;
	highlightPlayerName?: string | null;
	getRank?: (player: TopPlayer, index: number) => number;
	showSeparatorBeforeHighlight?: boolean;
	highlightRowRef?: RefObject<HTMLTableRowElement | null>;
}

function getRowClassName(isHighlighted: boolean, isLastPlayer: boolean): string {
	const borderClass = isLastPlayer ? "" : "border-b border-green-500";
	const highlightClass = isHighlighted ? "ring-2 ring-dorkinians-yellow bg-yellow-400/10" : "";
	return `${borderClass} ${highlightClass}`.trim();
}

function getRowStyle(isHighlighted: boolean): CSSProperties | undefined {
	if (isHighlighted) return undefined;
	return {
		background: "linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))",
	};
}

export default function TopPlayersTable({
	players,
	statType,
	highlightPlayerName,
	getRank,
	showSeparatorBeforeHighlight = false,
	highlightRowRef,
}: TopPlayersTableProps) {
	const statLabel = getStatTypeLabel(statType);

	return (
		<div className='overflow-x-auto'>
			<table className='w-full text-white'>
				<thead>
					<tr className='border-b-2 border-dorkinians-yellow'>
						<th className='text-left py-2 px-2 text-xs md:text-sm w-auto'>
							<div className='flex items-center gap-2'>
								<div className='w-10 md:w-12'></div>
								<div>Player Name</div>
							</div>
						</th>
						<th className='text-center py-2 px-2 text-xs md:text-sm w-20 md:w-24'>{statLabel}</th>
					</tr>
				</thead>
				<tbody>
					{players.map((player, index) => {
						const isLastPlayer = index === players.length - 1;
						const isHighlighted = Boolean(highlightPlayerName && player.playerName === highlightPlayerName);
						const rank = getRank ? getRank(player, index) : index + 1;
						const formattedStatValue = formatStatValue(player, statType);
						const summary = formatPlayerSummary(player, statType);
						const shouldShowSeparator = showSeparatorBeforeHighlight && isHighlighted && index > 0;

						return (
							<Fragment key={player.playerName}>
								{shouldShowSeparator && (
									<tr aria-hidden='true'>
										<td colSpan={2} className='py-2 px-2 text-center text-white/40 text-sm tracking-widest'>
											···
										</td>
									</tr>
								)}
								<tr
									ref={isHighlighted ? highlightRowRef : undefined}
									className={getRowClassName(isHighlighted, isLastPlayer && !shouldShowSeparator)}
									style={getRowStyle(isHighlighted)}>
									<td className='py-2 px-2 align-top' colSpan={2}>
										<div className='flex flex-col'>
											<div className='flex items-center gap-2'>
												<div className='text-base md:text-lg font-semibold whitespace-nowrap w-10 md:w-12'>
													{formatRank(rank)}
												</div>
												<div className='text-base md:text-lg font-semibold flex-1'>{player.playerName}</div>
												<div className='text-base md:text-lg font-bold w-20 md:w-24 text-center'>
													{formattedStatValue}
												</div>
											</div>
											<div className='pt-1 pl-[3rem] md:pl-[3.5rem]'>
												<div className='text-[0.7rem] md:text-[0.8rem] text-gray-300 text-left'>{summary}</div>
											</div>
										</div>
									</td>
								</tr>
							</Fragment>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
