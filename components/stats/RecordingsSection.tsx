"use client";

import VeoWatchMatchButtons from "@/components/club-info/VeoWatchMatchButtons";
import type { RecordingFixture } from "@/lib/utils/recordingsDisplay";
import {
	formatRecordingDateDesktop,
	formatRecordingDateMobile,
	formatRecordingScore,
	recordingCompBadgeClass,
	recordingCompLabelDesktop,
	recordingCompLabelMobile,
	recordingLocBadgeClass,
	recordingLocLabelDesktop,
	recordingLocLabelMobile,
} from "@/lib/utils/recordingsDisplay";

export type RecordingsSectionProps = {
	id: string;
	title: string;
	subtitle: string;
	fixtures: RecordingFixture[];
	/** When true, show `team` column after Date (club whole-club view). */
	teamColumn?: boolean;
	testIdPrefix: string;
};

export default function RecordingsSection({ id, title, subtitle, fixtures, teamColumn = false, testIdPrefix }: RecordingsSectionProps) {
	if (fixtures.length === 0) return null;

	return (
		<div id={id} className='relative bg-white/10 backdrop-blur-sm rounded-lg p-2 pt-3 md:p-4 md:break-inside-avoid md:mb-4'>
			<div className='absolute right-2 top-2 md:right-3 md:top-3'>
				{/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG from public */}
				<img src='/icons/veo.svg' alt='Veo' className='h-5 w-auto opacity-90 brightness-0 invert md:h-6' />
			</div>
			<h3 className='text-white font-semibold text-sm md:text-base mb-2 pr-14'>{title}</h3>
			<p className='text-white/70 text-xs md:text-sm mb-3 pr-14'>{subtitle}</p>
			<div className='w-full overflow-x-auto'>
				<table className='w-full max-w-full text-white text-[10px] max-sm:table-auto sm:table-fixed sm:text-xs md:text-sm'>
					<colgroup>
						{/* max-sm: min-width hints for table-auto; sm+: % for table-fixed */}
						<col
							className={
								teamColumn
									? "max-sm:min-w-[4.25rem] sm:w-[13%]"
									: "max-sm:min-w-[4.25rem] sm:w-[14%]"
							}
						/>
						{teamColumn ? <col className='max-sm:min-w-[4rem] sm:w-[11%]' /> : null}
						<col className='max-sm:min-w-[1.65rem] sm:w-[9%]' />
						<col className='max-sm:min-w-[1.65rem] sm:w-[9%]' />
						<col className={teamColumn ? "min-w-0 sm:w-[28%]" : "min-w-0 sm:w-[30%]"} />
						<col className='max-sm:min-w-[3.1rem] sm:w-[13%]' />
						<col className='max-sm:min-w-[4.75rem] sm:w-[16%]' />
					</colgroup>
					<thead>
						<tr className='border-b border-white/20 bg-white/5'>
							<th className='whitespace-nowrap py-1.5 pl-1 pr-0.5 text-left sm:py-2 sm:px-2 font-semibold'>
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
							<th className='whitespace-nowrap py-1.5 pr-1 pl-0.5 text-center sm:py-2 sm:px-2 font-semibold'>
								Match
							</th>
						</tr>
					</thead>
					<tbody>
						{fixtures.map((fx, idx) => (
							<tr key={fx.fixtureId || `${fx.date}-${fx.opposition}-${idx}`} className='border-b border-white/10 align-middle'>
								<td className='whitespace-nowrap py-1.5 pl-1 pr-0.5 align-middle tabular-nums leading-tight sm:py-2 sm:px-2'>
									<span className='sm:hidden'>{formatRecordingDateMobile(fx.date)}</span>
									<span className='hidden sm:inline'>{formatRecordingDateDesktop(fx.date)}</span>
								</td>
								{teamColumn ? (
									<td className='py-1.5 px-0.5 align-middle sm:py-2 sm:px-2' title={fx.team || ""}>
										<div className='max-w-[4rem] truncate text-[9px] sm:max-w-none sm:text-xs'>{fx.team || "—"}</div>
									</td>
								) : null}
								<td colSpan={2} className='py-1.5 px-0.5 align-middle sm:hidden'>
									<span className='sr-only'>
										Location {recordingLocLabelDesktop(fx.homeOrAway)}, competition {recordingCompLabelDesktop(fx.compType)}
									</span>
									<div className='flex flex-nowrap items-center justify-start gap-0.5'>
										<span
											className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium leading-none ${recordingLocBadgeClass(fx.homeOrAway)}`}
											title={fx.homeOrAway || ""}>
											{recordingLocLabelMobile(fx.homeOrAway)}
										</span>
										<span
											className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium leading-none ${recordingCompBadgeClass(fx.compType)}`}
											title={fx.compType || ""}>
											{recordingCompLabelMobile(fx.compType)}
										</span>
									</div>
								</td>
								<td className='hidden py-1.5 px-1 sm:table-cell sm:py-2 sm:px-2'>
									<span
										className={`inline-block max-w-full rounded px-1.5 py-0.5 text-[9px] sm:text-xs font-medium ${recordingLocBadgeClass(fx.homeOrAway)}`}
										title={fx.homeOrAway || ""}>
										{recordingLocLabelDesktop(fx.homeOrAway)}
									</span>
								</td>
								<td className='hidden py-1.5 px-1 sm:table-cell sm:py-2 sm:px-2'>
									<span
										className={`inline-block max-w-full rounded px-1.5 py-0.5 text-[9px] sm:text-xs font-medium ${recordingCompBadgeClass(fx.compType)}`}
										title={fx.compType || ""}>
										{recordingCompLabelDesktop(fx.compType)}
									</span>
								</td>
								<td
									className='max-w-0 min-w-0 py-1.5 px-0.5 align-middle sm:max-w-none sm:py-2 sm:px-2'
									title={fx.opposition || ""}>
									<div className='truncate'>{fx.opposition || "—"}</div>
								</td>
								<td className='whitespace-nowrap py-1.5 px-0.5 align-middle font-mono tabular-nums sm:py-2 sm:px-2'>
									{formatRecordingScore(fx.result, fx.goalsScored, fx.goalsConceded)}
								</td>
								<td className='w-px max-sm:min-w-[4.5rem] whitespace-nowrap py-1 px-0.5 align-middle text-center sm:w-auto sm:min-w-0 sm:py-2 sm:px-1'>
									<VeoWatchMatchButtons
										veoLink={fx.veoLink}
										testIdPrefix={`${testIdPrefix}-${fx.fixtureId || idx}`}
										hideLogo
										compact
										shortLabel
										className='!justify-center max-sm:!items-center'
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
