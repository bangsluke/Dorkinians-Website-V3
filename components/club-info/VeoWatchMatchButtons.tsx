"use client";

import { parseVeoLinks } from "@/lib/utils/veoLinks";

type VeoWatchMatchButtonsProps = {
	veoLink: string | null | undefined;
	testIdPrefix: string;
	className?: string;
	/** Omit Veo brand mark inside each link (e.g. parent section shows the logo). */
	hideLogo?: boolean;
	/** Tighter padding and type for tables / narrow layouts. */
	compact?: boolean;
	/** Mobile: "WATCH"; sm+: "WATCH MATCH" (responsive spans). */
	shortLabel?: boolean;
};

export default function VeoWatchMatchButtons({
	veoLink,
	testIdPrefix,
	className = "",
	hideLogo = false,
	compact = false,
	shortLabel = false,
}: VeoWatchMatchButtonsProps) {
	const urls = parseVeoLinks(veoLink);
	if (urls.length === 0) return null;

	const linkClass = compact
		? "inline-flex items-center justify-center rounded-md border border-dorkinians-yellow/50 bg-dorkinians-yellow/10 px-1.5 py-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide text-dorkinians-yellow hover:bg-dorkinians-yellow/20 transition-colors whitespace-nowrap"
		: "inline-flex items-center gap-2 rounded-lg border border-dorkinians-yellow/50 bg-dorkinians-yellow/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-dorkinians-yellow hover:bg-dorkinians-yellow/20 transition-colors";

	const layoutClass = compact
		? "flex min-w-0 max-w-full flex-col items-stretch justify-center gap-1 max-sm:w-max sm:w-full sm:flex-row sm:flex-wrap sm:items-center"
		: "flex w-full flex-wrap items-center justify-center gap-1 sm:gap-2";

	return (
		<div className={`${layoutClass} ${className}`.trim()}>
			{urls.map((href, index) => (
				<a
					key={`${href}-${index}`}
					href={href}
					target='_blank'
					rel='noopener noreferrer'
					aria-label={urls.length > 1 ? `Watch match ${index + 1}` : "Watch match"}
					className={linkClass}
					data-testid={urls.length > 1 ? `${testIdPrefix}-watch-veo-${index}` : `${testIdPrefix}-watch-veo`}>
					{hideLogo ? null : (
						<span className='h-4 shrink-0 w-[52px]' aria-hidden>
							{/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG from public */}
							<img src='/icons/veo.svg' alt='' className='h-4 w-auto brightness-0 invert' />
						</span>
					)}
					{shortLabel ? (
						<>
							<span className='sm:hidden'>WATCH</span>
							<span className='hidden sm:inline'>WATCH MATCH</span>
						</>
					) : (
						<span>WATCH MATCH</span>
					)}
				</a>
			))}
		</div>
	);
}
