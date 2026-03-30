"use client";

import { parseVeoLinks } from "@/lib/utils/veoLinks";

type VeoWatchMatchButtonsProps = {
	veoLink: string | null | undefined;
	testIdPrefix: string;
	className?: string;
};

export default function VeoWatchMatchButtons({ veoLink, testIdPrefix, className = "" }: VeoWatchMatchButtonsProps) {
	const urls = parseVeoLinks(veoLink);
	if (urls.length === 0) return null;

	return (
		<div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
			{urls.map((href, index) => (
				<a
					key={`${href}-${index}`}
					href={href}
					target='_blank'
					rel='noopener noreferrer'
					aria-label={urls.length > 1 ? `Watch match ${index + 1}` : "Watch match"}
					className='inline-flex items-center gap-2 rounded-lg border border-dorkinians-yellow/50 bg-dorkinians-yellow/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-dorkinians-yellow hover:bg-dorkinians-yellow/20 transition-colors'
					data-testid={urls.length > 1 ? `${testIdPrefix}-watch-veo-${index}` : `${testIdPrefix}-watch-veo`}>
					<span className='h-4 shrink-0 w-[52px]' aria-hidden>
						{/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG from public */}
						<img src='/icons/veo.svg' alt='' className='h-4 w-auto brightness-0 invert' />
					</span>
					<span>WATCH MATCH</span>
				</a>
			))}
		</div>
	);
}
