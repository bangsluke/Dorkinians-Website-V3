"use client";

import type { ReactNode } from "react";
import { weekDateTooltipTitle } from "@/lib/utils/weekNumDates";

type WeekDateTooltipProps = {
	seasonWeek?: string | null;
	fixtureDate?: string | null;
	calendarWeek?: { year: number; weekNumber: number } | null;
	children: ReactNode;
	className?: string;
};

/** Native title tooltip showing the Saturday for a WEEKNUM week reference. */
export default function WeekDateTooltip({
	seasonWeek,
	fixtureDate,
	calendarWeek,
	children,
	className,
}: WeekDateTooltipProps) {
	const title = weekDateTooltipTitle(seasonWeek, fixtureDate, calendarWeek);
	return (
		<span title={title ?? undefined} className={className}>
			{children}
		</span>
	);
}
