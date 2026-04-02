"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { buildMatchRatingBreakdown, type MatchRatingDetail } from "@/lib/utils/matchRatingBreakdown";
import { matchRatingCircleStyle } from "@/lib/utils/matchRatingDisplay";

export type PlayerFormRecentMatch = {
	fixtureId: string;
	week: string;
	date: string;
	displayScore: number;
	matchRating: number | null;
	fantasyPoints: number;
	class: string;
	minutes: number;
	goals: number;
	assists: number;
	mom: number;
	cleanSheets: number;
	saves: number;
	yellowCards: number;
	redCards: number;
	ownGoals: number;
	conceded: number;
	penaltiesMissed: number;
	penaltiesSaved: number;
	opposition: string;
	homeOrAway: string;
	result: string;
	compType: string;
	goalsScored: number;
	goalsConceded: number;
};

function toDetail(m: PlayerFormRecentMatch): MatchRatingDetail {
	return {
		class: m.class,
		minutes: m.minutes,
		goals: m.goals,
		assists: m.assists,
		mom: m.mom,
		cleanSheets: m.cleanSheets,
		saves: m.saves,
		yellowCards: m.yellowCards,
		redCards: m.redCards,
		ownGoals: m.ownGoals,
		conceded: m.conceded,
		penaltiesMissed: m.penaltiesMissed,
		penaltiesSaved: m.penaltiesSaved,
	};
}

function ratingBandPresentation(score: number | null): { className: string; style?: CSSProperties } {
	if (score == null || Number.isNaN(score)) {
		return {
			className: "bg-zinc-800 border-2 border-white/10 text-white",
		};
	}
	return {
		className: "border-2",
		style: matchRatingCircleStyle(score),
	};
}

function formatDate(dateString: string): string {
	if (!dateString) return "";
	try {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
	} catch {
		return dateString;
	}
}

type Props = {
	/** Newest match first (same order as `/api/player-form` `recentFormMatches`). */
	matchesNewestFirst: PlayerFormRecentMatch[];
};

export default function PlayerRecentFormBoxes({ matchesNewestFirst }: Props) {
	const [showTooltip, setShowTooltip] = useState<number | null>(null);
	const [tooltipPosition, setTooltipPosition] = useState<{
		top: number;
		left: number;
		placement: "above" | "below";
		arrowLeft: number;
	} | null>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const boxRefs = useRef<(HTMLDivElement | null)[]>([]);
	const tooltipRef = useRef<HTMLDivElement | null>(null);

	const chronological = [...matchesNewestFirst].reverse();
	const boxesToShow = Array.from({ length: 10 }, (_, index) => chronological[index] ?? null);

	const findScrollContainers = (element: HTMLElement | null): HTMLElement[] => {
		const containers: HTMLElement[] = [];
		let current: HTMLElement | null = element;
		try {
			while (current && typeof document !== "undefined" && current !== document.body) {
				try {
					const style = window.getComputedStyle(current);
					const overflowY = style.overflowY;
					const overflowX = style.overflowX;
					if (overflowY === "auto" || overflowY === "scroll" || overflowX === "auto" || overflowX === "scroll") {
						containers.push(current);
					}
				} catch {
					break;
				}
				current = current.parentElement;
			}
		} catch {
			/* ignore */
		}
		return containers;
	};

	const updateTooltipPosition = (index: number) => {
		const boxRef = boxRefs.current[index];
		if (!boxRef || typeof window === "undefined") {
			setShowTooltip(null);
			setTooltipPosition(null);
			return;
		}
		try {
			const rect = boxRef.getBoundingClientRect();
			const viewportHeight = window.innerHeight || 0;
			const viewportWidth = window.innerWidth || 0;
			const scrollY = window.scrollY || 0;
			const scrollX = window.scrollX || 0;
			if (rect.bottom < 0 || rect.top > viewportHeight || rect.right < 0 || rect.left > viewportWidth) {
				setShowTooltip(null);
				setTooltipPosition(null);
				return;
			}
			let tooltipHeight = 120;
			const tooltipWidth = 280;
			if (tooltipRef.current) {
				try {
					const tooltipRect = tooltipRef.current.getBoundingClientRect();
					tooltipHeight = tooltipRect.height || 120;
				} catch {
					/* not measured yet */
				}
			}
			const spaceBelow = viewportHeight - rect.bottom;
			const spaceAbove = rect.top;
			const margin = 10;
			const arrowHeight = 8;
			const spacing = 8;
			let placement: "above" | "below" = "below";
			let top: number;
			const neededSpaceBelow = tooltipHeight + arrowHeight + spacing + margin;
			const neededSpaceAbove = tooltipHeight + arrowHeight + spacing + margin;
			if (spaceBelow < neededSpaceBelow && spaceAbove > neededSpaceAbove) {
				placement = "above";
				top = rect.top + scrollY - tooltipHeight - arrowHeight - spacing;
			} else if (spaceBelow >= neededSpaceBelow) {
				placement = "below";
				top = rect.bottom + scrollY + spacing;
			} else {
				placement = "above";
				top = Math.max(margin, rect.top + scrollY - tooltipHeight - arrowHeight - spacing);
			}
			let left = rect.left + scrollX + rect.width / 2 - tooltipWidth / 2;
			const boxCenter = rect.left + scrollX + rect.width / 2;
			if (left < scrollX + margin) left = scrollX + margin;
			else if (left + tooltipWidth > scrollX + window.innerWidth - margin) {
				left = scrollX + window.innerWidth - tooltipWidth - margin;
			}
			const arrowLeft = Math.max(12, Math.min(tooltipWidth - 12, boxCenter - left));
			setTooltipPosition({ top, left, placement, arrowLeft });
		} catch (e) {
			console.error("Error updating tooltip position:", e);
		}
	};

	useEffect(() => {
		if (showTooltip !== null) {
			const timeoutId = setTimeout(() => updateTooltipPosition(showTooltip), 0);
			return () => clearTimeout(timeoutId);
		}
	}, [showTooltip]);

	useEffect(() => {
		if (showTooltip === null) return;
		const boxRef = boxRefs.current[showTooltip];
		if (!boxRef) return;
		const scrollContainers = findScrollContainers(boxRef);
		const handleScroll = () => updateTooltipPosition(showTooltip);
		window.addEventListener("scroll", handleScroll, true);
		scrollContainers.forEach((c) => c.addEventListener("scroll", handleScroll, true));
		return () => {
			window.removeEventListener("scroll", handleScroll, true);
			scrollContainers.forEach((c) => c.removeEventListener("scroll", handleScroll, true));
		};
	}, [showTooltip]);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, []);

	const handleMouseEnter = (index: number) => {
		updateTooltipPosition(index);
		timeoutRef.current = setTimeout(() => setShowTooltip(index), 300);
	};

	const handleMouseLeave = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setShowTooltip(null);
		setTooltipPosition(null);
	};

	const handleTouchStart = (index: number) => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		updateTooltipPosition(index);
		timeoutRef.current = setTimeout(() => setShowTooltip(index), 200);
	};

	const handleTouchEnd = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setShowTooltip(null);
		setTooltipPosition(null);
	};

	const active = showTooltip !== null ? boxesToShow[showTooltip] : null;
	const activeBreakdown = active ? buildMatchRatingBreakdown(toDetail(active)) : null;
	const storedVsComputed =
		active && active.matchRating != null && Math.abs(active.matchRating - (activeBreakdown?.final ?? 0)) > 0.05
			? `Stored rating: ${active.matchRating.toFixed(1)}`
			: null;

	return (
		<div className='mb-3' data-testid='player-recent-form-boxes'>
			<p className='text-white/70 text-xs mb-2'>Recent match scores (last 10, same filters)</p>
			<div className='flex gap-1 w-full md:scale-[0.7] md:origin-top md:max-w-[calc(100%/0.7)]'>
				{boxesToShow.map((m, index) => {
					const presentation = ratingBandPresentation(m ? m.displayScore : null);
					return (
						<div
							key={index}
							data-testid={m ? "player-recent-form-box" : "player-recent-form-box-empty"}
							ref={(el) => {
								boxRefs.current[index] = el;
							}}
							className={`flex-1 aspect-square rounded flex items-center justify-center cursor-help relative font-bold text-[10px] sm:text-xs ${presentation.className}`}
							style={presentation.style}
							onMouseEnter={() => m && handleMouseEnter(index)}
							onMouseLeave={handleMouseLeave}
							onTouchStart={() => m && handleTouchStart(index)}
							onTouchEnd={handleTouchEnd}
						>
							{m ? <span>{m.displayScore.toFixed(1)}</span> : null}
						</div>
					);
				})}
			</div>
			{showTooltip !== null && active && tooltipPosition && typeof document !== "undefined" && document.body
				? createPortal(
						<div
							ref={tooltipRef}
							className='fixed z-[9999] px-3 py-2 text-xs text-white rounded-lg shadow-lg w-[280px] text-left pointer-events-none'
							style={{
								backgroundColor: "#0f0f0f",
								top: `${tooltipPosition.top}px`,
								left: `${tooltipPosition.left}px`,
							}}
							data-testid='player-recent-form-tooltip'
						>
							{tooltipPosition.placement === "above" ? (
								<div
									className='absolute top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent mt-1'
									style={{
										borderTopColor: "#0f0f0f",
										left: `${tooltipPosition.arrowLeft}px`,
										transform: "translateX(-50%)",
									}}
								/>
							) : (
								<div
									className='absolute bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent mb-1'
									style={{
										borderBottomColor: "#0f0f0f",
										left: `${tooltipPosition.arrowLeft}px`,
										transform: "translateX(-50%)",
									}}
								/>
							)}
							<div className='font-semibold mb-1 text-center'>{active.opposition || "Unknown"}</div>
							<div className='text-[11px] text-white/80 mb-1 text-center'>{formatDate(active.date)}</div>
							<div className='text-[11px] text-white/80 mb-2 text-center'>
								{active.homeOrAway} · {active.compType || "-"} · {active.result} · {active.goalsScored}-{active.goalsConceded}
							</div>
							<div className='text-[11px] text-dorkinians-yellow/90 mb-1 font-medium'>Match rating breakdown</div>
							<ul className='text-[10px] text-white/85 space-y-0.5 font-mono'>
								{activeBreakdown?.lines.map((line, i) => (
									<li key={i} className='flex justify-between gap-2'>
										<span className='truncate'>{line.label}</span>
										<span>
											{line.delta >= 0 ? "+" : ""}
											{line.delta.toFixed(1)} → {line.running.toFixed(1)}
										</span>
									</li>
								))}
							</ul>
							{storedVsComputed ? <p className='text-[10px] text-white/60 mt-1'>{storedVsComputed}</p> : null}
						</div>,
						document.body
				  )
				: null}
		</div>
	);
}
