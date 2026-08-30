"use client";

import type { ReactNode } from "react";
import { HoverTooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils/cn";
import { weekDateTooltipTitle } from "@/lib/utils/weekNumDates";

type WeekDateTooltipProps = {
	seasonWeek?: string | null;
	fixtureDate?: string | null;
	calendarWeek?: { year: number; weekNumber: number } | null;
	children: ReactNode;
	className?: string;
};

/** Hover/focus tooltip showing the Saturday for a WEEKNUM week reference. */
export default function WeekDateTooltip({
	seasonWeek,
	fixtureDate,
	calendarWeek,
	children,
	className,
}: WeekDateTooltipProps) {
	const title = weekDateTooltipTitle(seasonWeek, fixtureDate, calendarWeek);

	return (
		<HoverTooltip content={title} className={cn("cursor-help outline-none", className)}>
			{children}
		</HoverTooltip>
	);
}
