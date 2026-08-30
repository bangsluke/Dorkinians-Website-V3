"use client";

import { useEffect, useMemo, useState } from "react";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import VeoWatchMatchButtons from "@/components/club-info/VeoWatchMatchButtons";
import { HoverTooltip } from "@/components/ui/Tooltip";
import { getCurrentSeasonFromStorage } from "@/lib/services/currentSeasonService";
import type { RecordingFixture } from "@/lib/utils/recordingsDisplay";
import {
	buildRecordingSeasonFilterOptions,
	filterRecordingsBySeason,
	formatRecordingDateDesktop,
	formatRecordingDateMobile,
	formatRecordingScore,
	formatRecordingSeasonOptionLabel,
	recordingCompBadgeClass,
	recordingCompLabelDesktop,
	recordingCompLabelMobile,
	recordingLocBadgeClass,
	recordingLocLabelDesktop,
	recordingLocLabelMobile,
	resolveDefaultRecordingSeason,
} from "@/lib/utils/recordingsDisplay";

export type RecordingsSectionProps = {
	id: string;
	title: string;
	subtitle: string;
	fixtures: RecordingFixture[];
	/** When true, show `team` column after Date (club whole-club view). */
	teamColumn?: boolean;
	/** When set, show only this many rows until user expands (club-wide lists). */
	collapseAfter?: number;
	/** When true, show a season filter under the heading (Team Stats). */
	enableSeasonFilter?: boolean;
	testIdPrefix: string;
};

export default function RecordingsSection({
	id,
	title,
	subtitle,
	fixtures,
	teamColumn = false,
	collapseAfter,
	enableSeasonFilter = false,
	testIdPrefix,
}: RecordingsSectionProps) {
	const [expanded, setExpanded] = useState(false);
	const seasonOptions = useMemo(
		() => (enableSeasonFilter ? buildRecordingSeasonFilterOptions(fixtures) : []),
		[enableSeasonFilter, fixtures]
	);
	const [selectedSeason, setSelectedSeason] = useState<string | null>(null);

	useEffect(() => {
		if (!enableSeasonFilter) {
			setSelectedSeason(null);
			return;
		}
		if (seasonOptions.length === 0) {
			setSelectedSeason(null);
			return;
		}
		const currentSeason = getCurrentSeasonFromStorage();
		setSelectedSeason((prev) => {
			if (prev != null && seasonOptions.some((opt) => opt.season === prev)) {
				return prev;
			}
			return resolveDefaultRecordingSeason(seasonOptions, currentSeason);
		});
	}, [enableSeasonFilter, seasonOptions]);

	if (fixtures.length === 0) return null;

	const total = fixtures.length;
	const selectedSeasonOption =
		enableSeasonFilter && selectedSeason != null
			? seasonOptions.find((opt) => opt.season === selectedSeason) ?? null
			: null;
	const seasonFilteredFixtures =
		enableSeasonFilter && selectedSeason != null
			? filterRecordingsBySeason(fixtures, selectedSeason)
			: fixtures;
	const collapsed =
		collapseAfter != null && !expanded && seasonFilteredFixtures.length > collapseAfter;
	const visibleFixtures = collapsed
		? seasonFilteredFixtures.slice(0, collapseAfter)
		: seasonFilteredFixtures;
	const visibleTotal = seasonFilteredFixtures.length;

	return (
		<div id={id} className='relative bg-white/10 backdrop-blur-sm rounded-lg p-2 pt-3 md:p-4 md:break-inside-avoid md:mb-4'>
			<div className='absolute right-3 top-2.5 md:right-4 md:top-3.5'>
				{/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG from public */}
				<img src='/icons/veo.svg' alt='Veo' className='h-5 w-auto opacity-90 brightness-0 invert md:h-6' />
			</div>
			<h3 className='text-white font-semibold text-sm md:text-base mb-2 pr-14'>
				{title} ({total})
			</h3>
			{enableSeasonFilter && seasonOptions.length > 0 && selectedSeasonOption ? (
				<div className='mb-3 w-full max-w-xs'>
					<Listbox value={selectedSeason} onChange={setSelectedSeason}>
						<div className='relative'>
							<Listbox.Button
								aria-label='Filter recordings by season'
								data-testid={`${testIdPrefix}-season-filter`}
								className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-xs md:text-sm'
							>
								<span className='block truncate text-white'>
									{formatRecordingSeasonOptionLabel(selectedSeasonOption)}
								</span>
								<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
									<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
								</span>
							</Listbox.Button>
							<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-xs md:text-sm shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
								{seasonOptions.map((option) => (
									<Listbox.Option
										key={option.season}
										className={({ active }) =>
											`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
										}
										value={option.season}
									>
										{({ selected }) => (
											<span className={`block truncate py-1 px-2 ${selected ? "font-medium" : "font-normal"}`}>
												{formatRecordingSeasonOptionLabel(option)}
											</span>
										)}
									</Listbox.Option>
								))}
							</Listbox.Options>
						</div>
					</Listbox>
				</div>
			) : null}
			<p className='text-white/70 text-xs md:text-sm mb-3 pr-14'>{subtitle}</p>
			<div className='w-full overflow-x-auto'>
				<table className='w-full max-w-full table-fixed text-white text-[10px] sm:text-xs md:text-sm'>
					<colgroup>
						{/*
						  Narrow screens: fixed rem cols for date + pills + result + match so opponent gets the rest (no gap between date and pills).
						  sm+: percentage widths.
						*/}
						<col
							className={
								teamColumn
									? "w-[3.25rem] sm:w-[12%]"
									: "w-[3.05rem] sm:w-[14%]"
							}
						/>
						{/* Club: tighter team col on mobile so opponent gets more of the row */}
						{teamColumn ? <col className='w-[2.85rem] sm:w-[11%]' /> : null}
						<col className={teamColumn ? "w-[1.28rem] sm:w-[9%]" : "w-[1.35rem] sm:w-[9%]"} />
						<col className={teamColumn ? "w-[1.28rem] sm:w-[9%]" : "w-[1.35rem] sm:w-[9%]"} />
						{/* Opponent: remainder; club view gets a larger sm % share */}
						<col className={teamColumn ? "min-w-0 sm:w-[28%]" : "min-w-0 sm:w-[26%]"} />
						<col className={teamColumn ? "w-[2.85rem] sm:w-[13%]" : "w-[3rem] sm:w-[14%]"} />
						<col className={teamColumn ? "w-[3.35rem] sm:w-[15%]" : "w-[3.5rem] sm:w-[16%]"} />
					</colgroup>
					<thead>
						<tr className='border-b border-white/20 bg-white/5'>
							<th className='whitespace-nowrap py-1.5 pl-1 pr-0 text-left sm:py-2 sm:px-2 sm:pr-2 font-semibold'>
								Date
							</th>
							{teamColumn ? (
								<th className='whitespace-nowrap py-1.5 px-0.5 text-left sm:py-2 sm:px-2 font-semibold'>
									Team
								</th>
							) : null}
							{/* Mobile only: headerless slot spanning Loc + Comp columns */}
							<th colSpan={2} className='table-cell p-0 sm:hidden' aria-hidden='true' />
							<th className='hidden whitespace-nowrap py-1.5 px-1 text-left sm:table-cell sm:py-2 sm:px-2 font-semibold'>
								Loc
							</th>
							<th className='hidden whitespace-nowrap py-1.5 px-1 text-left sm:table-cell sm:py-2 sm:px-2 font-semibold'>
								Comp
							</th>
							<th className='min-w-0 whitespace-nowrap py-1.5 px-0.5 text-left sm:py-2 sm:px-2 font-semibold'>
								Opponent
							</th>
							<th className='whitespace-nowrap py-1.5 px-0.5 text-left sm:py-2 sm:px-2 font-semibold'>
								Result
							</th>
							<th
								className={`whitespace-nowrap py-1.5 px-0 text-center sm:py-2 sm:px-2 font-semibold sm:w-auto sm:max-w-none ${teamColumn ? "w-[3.35rem] max-w-[3.35rem]" : "w-[3.5rem] max-w-[3.5rem]"}`}>
								Match
							</th>
						</tr>
					</thead>
					<tbody>
						{visibleFixtures.map((fx, idx) => (
							<tr key={fx.fixtureId || `${fx.date}-${fx.opposition}-${idx}`} className='border-b border-white/10 align-middle'>
								<td
									className={`whitespace-nowrap py-1.5 pl-1 align-middle tabular-nums sm:py-2 sm:px-2 sm:pr-2 text-[9px] font-normal leading-tight sm:text-xs ${teamColumn ? "pr-1" : "pr-0.5"}`}>
									<span className='sm:hidden'>{formatRecordingDateMobile(fx.date)}</span>
									<span className='hidden sm:inline'>{formatRecordingDateDesktop(fx.date)}</span>
								</td>
								{teamColumn ? (
									<td className='py-1.5 pl-1 pr-0.5 align-middle sm:py-2 sm:px-2'>
										<HoverTooltip content={fx.team || undefined} className='block min-w-0'>
											<div className='max-w-[4rem] truncate text-[9px] font-normal leading-tight sm:max-w-none sm:text-xs'>
												{fx.team || "-"}
											</div>
										</HoverTooltip>
									</td>
								) : null}
								<td colSpan={2} className='py-1.5 pl-1.5 pr-0 align-middle sm:hidden'>
									<span className='sr-only'>
										Location {recordingLocLabelDesktop(fx.homeOrAway)}, competition {recordingCompLabelDesktop(fx.compType)}
									</span>
									<div className='flex flex-nowrap items-center justify-start gap-px'>
										<HoverTooltip content={fx.homeOrAway || undefined}>
											<span
												className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium leading-none ${recordingLocBadgeClass(fx.homeOrAway)}`}>
												{recordingLocLabelMobile(fx.homeOrAway)}
											</span>
										</HoverTooltip>
										<HoverTooltip content={fx.compType || undefined}>
											<span
												className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium leading-none ${recordingCompBadgeClass(fx.compType)}`}>
												{recordingCompLabelMobile(fx.compType)}
											</span>
										</HoverTooltip>
									</div>
								</td>
								<td className='hidden py-1.5 px-1 sm:table-cell sm:py-2 sm:px-2'>
									<HoverTooltip content={fx.homeOrAway || undefined}>
										<span
											className={`inline-block max-w-full rounded px-1.5 py-0.5 text-[9px] sm:text-xs font-medium ${recordingLocBadgeClass(fx.homeOrAway)}`}>
											{recordingLocLabelDesktop(fx.homeOrAway)}
										</span>
									</HoverTooltip>
								</td>
								<td className='hidden py-1.5 px-1 sm:table-cell sm:py-2 sm:px-2'>
									<HoverTooltip content={fx.compType || undefined}>
										<span
											className={`inline-block max-w-full rounded px-1.5 py-0.5 text-[9px] sm:text-xs font-medium ${recordingCompBadgeClass(fx.compType)}`}>
											{recordingCompLabelDesktop(fx.compType)}
										</span>
									</HoverTooltip>
								</td>
								<td
									className={`min-w-0 max-w-none py-1.5 align-middle sm:py-2 sm:px-2 ${teamColumn ? "px-0.5 text-[9px] font-normal sm:text-xs" : "px-1"}`}>
									<HoverTooltip content={fx.opposition || undefined} className='block min-w-0'>
										<div className='truncate'>{fx.opposition || "-"}</div>
									</HoverTooltip>
								</td>
								<td
									className={`whitespace-nowrap py-1.5 px-0.5 align-middle font-mono tabular-nums sm:py-2 sm:px-2 ${teamColumn ? "max-sm:text-[9px]" : ""}`}>
									{formatRecordingScore(fx.result, fx.goalsScored, fx.goalsConceded)}
								</td>
								<td
									className={`whitespace-nowrap py-1 px-0 align-middle sm:w-auto sm:max-w-none sm:py-2 sm:px-1 ${teamColumn ? "w-[3.35rem] max-w-[3.35rem]" : "w-[3.5rem] max-w-[3.5rem]"}`}>
									<div className='flex justify-center'>
										<VeoWatchMatchButtons
											veoLink={fx.veoLink}
											testIdPrefix={`${testIdPrefix}-${fx.fixtureId || idx}`}
											hideLogo
											compact
											shortLabel
											className='!w-auto !max-w-full !justify-center !items-center'
										/>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{collapsed ? (
				<div className='mt-2 flex justify-center'>
					<button
						type='button'
						className='text-xs font-medium text-dorkinians-yellow underline decoration-dorkinians-yellow/50 underline-offset-2 hover:text-white md:text-sm'
						onClick={() => setExpanded(true)}
						data-testid={`${testIdPrefix}-see-all`}
					>
						See all ({visibleTotal})
					</button>
				</div>
			) : null}
		</div>
	);
}
