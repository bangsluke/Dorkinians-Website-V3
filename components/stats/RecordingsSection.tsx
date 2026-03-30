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
				<table className='w-full table-fixed text-white text-[10px] sm:text-xs md:text-sm'>
					<colgroup>
						<col className={teamColumn ? "w-[16%] sm:w-[14%]" : "w-[22%] sm:w-[18%]"} />
						{teamColumn ? <col className='w-[14%] sm:w-[12%]' /> : null}
						<col className='w-[12%] sm:w-[10%]' />
						<col className='w-[12%] sm:w-[10%]' />
						<col className={teamColumn ? "w-[22%] sm:w-[24%]" : "w-[26%] sm:w-[28%]"} />
						<col className='w-[12%] sm:w-[14%]' />
						<col className='w-[10%] sm:w-[16%]' />
					</colgroup>
					<thead>
						<tr className='border-b border-white/20 bg-white/5'>
							<th className='text-left py-1.5 px-1 sm:py-2 sm:px-2 font-semibold'>Date</th>
							{teamColumn ? (
								<th className='text-left py-1.5 px-1 sm:py-2 sm:px-2 font-semibold'>Team</th>
							) : null}
							<th className='text-left py-1.5 px-1 sm:py-2 sm:px-2 font-semibold'>Loc</th>
							<th className='text-left py-1.5 px-1 sm:py-2 sm:px-2 font-semibold'>Comp</th>
							<th className='text-left py-1.5 px-1 sm:py-2 sm:px-2 font-semibold'>Opponent</th>
							<th className='text-left py-1.5 px-1 sm:py-2 sm:px-2 font-semibold'>Result</th>
							<th className='text-center py-1.5 px-0.5 sm:py-2 sm:px-2 font-semibold'>Match</th>
						</tr>
					</thead>
					<tbody>
						{fixtures.map((fx, idx) => (
							<tr key={fx.fixtureId || `${fx.date}-${fx.opposition}-${idx}`} className='border-b border-white/10 align-middle'>
								<td className='py-1.5 px-1 sm:py-2 sm:px-2 leading-tight'>
									<span className='sm:hidden'>{formatRecordingDateMobile(fx.date)}</span>
									<span className='hidden sm:inline'>{formatRecordingDateDesktop(fx.date)}</span>
								</td>
								{teamColumn ? (
									<td className='py-1.5 px-1 sm:py-2 sm:px-2 truncate' title={fx.team || ""}>
										{fx.team || "—"}
									</td>
								) : null}
								<td className='py-1.5 px-1 sm:py-2 sm:px-2'>
									<span
										className={`inline-block max-w-full rounded px-1.5 py-0.5 text-[9px] sm:text-xs font-medium ${recordingLocBadgeClass(fx.homeOrAway)}`}
										title={fx.homeOrAway || ""}>
										<span className='sm:hidden'>{recordingLocLabelMobile(fx.homeOrAway)}</span>
										<span className='hidden sm:inline'>{recordingLocLabelDesktop(fx.homeOrAway)}</span>
									</span>
								</td>
								<td className='py-1.5 px-1 sm:py-2 sm:px-2'>
									<span
										className={`inline-block max-w-full rounded px-1.5 py-0.5 text-[9px] sm:text-xs font-medium ${recordingCompBadgeClass(fx.compType)}`}
										title={fx.compType || ""}>
										<span className='sm:hidden'>{recordingCompLabelMobile(fx.compType)}</span>
										<span className='hidden sm:inline'>{recordingCompLabelDesktop(fx.compType)}</span>
									</span>
								</td>
								<td className='py-1.5 px-1 sm:py-2 sm:px-2 truncate' title={fx.opposition || ""}>
									{fx.opposition || "—"}
								</td>
								<td className='py-1.5 px-1 sm:py-2 sm:px-2 font-mono whitespace-nowrap'>
									{formatRecordingScore(fx.result, fx.goalsScored, fx.goalsConceded)}
								</td>
								<td className='py-1 px-0.5 sm:py-2 sm:px-1 text-center'>
									<VeoWatchMatchButtons
										veoLink={fx.veoLink}
										testIdPrefix={`${testIdPrefix}-${fx.fixtureId || idx}`}
										hideLogo
										compact
										shortLabel
										className='!justify-center'
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
