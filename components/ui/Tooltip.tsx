"use client";

import { forwardRef, useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

/**
 * Canonical tooltip appearance, derived from the Form chart tooltip.
 * Exported for the rare call site that needs the raw classes rather than the component,
 * such as passing styles into a third-party renderer.
 */
export const TOOLTIP_SURFACE_CLASS =
	"rounded-lg border border-[var(--tooltip-border)] px-3 py-2 text-xs text-white shadow-lg";

export const TOOLTIP_SURFACE_STYLE: CSSProperties = {
	background: "var(--tooltip-bg)",
};

export interface TooltipSurfaceProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
	children: ReactNode;
}

/** The shared visual shell every tooltip in the app renders inside. */
export const TooltipSurface = forwardRef<HTMLDivElement, TooltipSurfaceProps>(
	function TooltipSurface({ children, className, style, ...rest }, ref) {
		return (
			<div
				ref={ref}
				role='tooltip'
				className={cn(TOOLTIP_SURFACE_CLASS, className)}
				style={{ ...TOOLTIP_SURFACE_STYLE, ...style }}
				{...rest}>
				{children}
			</div>
		);
	},
);

export type TooltipArrowPlacement = "above" | "below";

/**
 * Caret for portal-positioned tooltips. `placement` describes where the tooltip sits
 * relative to its trigger, so the caret points back towards it. Centred by default;
 * pass `offsetLeft` (px from the tooltip's left edge) when the trigger is not centred.
 */
export function TooltipArrow({
	placement,
	offsetLeft,
}: {
	placement: TooltipArrowPlacement;
	offsetLeft?: number;
}): React.JSX.Element {
	const isAbove = placement === "above";
	const edgeColor = isAbove ? { borderTopColor: "var(--tooltip-bg)" } : { borderBottomColor: "var(--tooltip-bg)" };
	return (
		<div
			className={cn(
				"absolute h-0 w-0 transform border-l-4 border-r-4 border-transparent",
				offsetLeft === undefined && "left-1/2 -translate-x-1/2",
				isAbove ? "top-full mt-1 border-t-4" : "bottom-full mb-1 border-b-4",
			)}
			style={
				offsetLeft === undefined
					? edgeColor
					: { ...edgeColor, left: `${offsetLeft}px`, transform: "translateX(-50%)" }
			}
		/>
	);
}

export interface ChartTooltipPayloadEntry {
	dataKey?: string | number;
	name?: string | number;
	value?: string | number;
	color?: string;
	unit?: string;
}

export interface ChartTooltipProps {
	active?: boolean;
	payload?: ChartTooltipPayloadEntry[];
	label?: string | number;
	/** Overrides the default label/rows body when a chart needs bespoke content. */
	children?: ReactNode;
	/** Formats a payload entry's value for the default body. */
	formatValue?: (entry: ChartTooltipPayloadEntry) => string;
	className?: string;
}

/**
 * Recharts `content` renderer. Handles the active/empty guard every chart repeats,
 * then renders either bespoke `children` or a generic label-plus-rows body.
 */
export function ChartTooltip({ active, payload, label, children, formatValue, className }: ChartTooltipProps): React.JSX.Element | null {
	if (!active || !payload?.length) return null;

	return (
		<TooltipSurface className={className}>
			{children ?? (
				<>
					{label !== undefined && label !== "" && <p className='mb-1 font-medium text-white/90'>{label}</p>}
					{payload.map((entry, index) => (
						<p key={`${entry.dataKey ?? entry.name ?? index}`} className='text-white/80'>
							<span style={entry.color ? { color: entry.color } : undefined}>{entry.name}:</span>{" "}
							{formatValue ? formatValue(entry) : `${entry.value ?? "-"}${entry.unit ?? ""}`}
						</p>
					))}
				</>
			)}
		</TooltipSurface>
	);
}

export type FloatingTooltipAlign = "center" | "start" | "end";
export type FloatingTooltipPlacement = "above" | "below" | "auto";

const FLOATING_TOOLTIP_MARGIN = 8;
const FLOATING_TOOLTIP_GAP = 8;

/** Viewport-aware fixed positioning for portal tooltips. */
export function computeFloatingTooltipPosition({
	triggerRect,
	tooltipWidth,
	tooltipHeight,
	align = "center",
	placement = "auto",
	margin = FLOATING_TOOLTIP_MARGIN,
	gap = FLOATING_TOOLTIP_GAP,
	viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0,
	viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0,
}: {
	triggerRect: DOMRect;
	tooltipWidth: number;
	tooltipHeight: number;
	align?: FloatingTooltipAlign;
	placement?: FloatingTooltipPlacement;
	margin?: number;
	gap?: number;
	viewportWidth?: number;
	viewportHeight?: number;
}): { top: number; left: number; resolvedPlacement: "above" | "below" } {
	let left: number;
	switch (align) {
		case "start":
			left = triggerRect.left;
			break;
		case "end":
			left = triggerRect.right - tooltipWidth;
			break;
		default:
			left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
	}
	left = Math.max(margin, Math.min(left, viewportWidth - tooltipWidth - margin));

	const aboveTop = triggerRect.top - tooltipHeight - gap;
	const belowTop = triggerRect.bottom + gap;
	const spaceAbove = triggerRect.top - margin;
	const spaceBelow = viewportHeight - triggerRect.bottom - margin;
	const fitsAbove = spaceAbove >= tooltipHeight + gap;
	const fitsBelow = spaceBelow >= tooltipHeight + gap;

	let resolvedPlacement: "above" | "below";
	let top: number;

	if (placement === "below") {
		resolvedPlacement = fitsBelow || !fitsAbove ? "below" : "above";
	} else if (placement === "above") {
		resolvedPlacement = fitsAbove || !fitsBelow ? "above" : "below";
	} else {
		resolvedPlacement = fitsAbove ? "above" : "below";
	}

	top = resolvedPlacement === "above" ? aboveTop : belowTop;
	top = Math.max(margin, Math.min(top, viewportHeight - tooltipHeight - margin));

	return { top, left, resolvedPlacement };
}

function useFloatingTooltipPosition({
	visible,
	triggerRef,
	tooltipRef,
	align,
	placement,
}: {
	visible: boolean;
	triggerRef: React.RefObject<HTMLElement | null>;
	tooltipRef: React.RefObject<HTMLElement | null>;
	align: FloatingTooltipAlign;
	placement: FloatingTooltipPlacement;
}): { top: number; left: number } | null {
	const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

	const updatePosition = useCallback(() => {
		if (!triggerRef.current || typeof window === "undefined") return;

		const triggerRect = triggerRef.current.getBoundingClientRect();
		const tooltipWidth = tooltipRef.current?.offsetWidth ?? 160;
		const tooltipHeight = tooltipRef.current?.offsetHeight ?? 32;
		const next = computeFloatingTooltipPosition({
			triggerRect,
			tooltipWidth,
			tooltipHeight,
			align,
			placement,
		});
		setPosition({ top: next.top, left: next.left });
	}, [align, placement, tooltipRef, triggerRef]);

	useLayoutEffect(() => {
		if (!visible) {
			setPosition(null);
			return;
		}

		updatePosition();
		const frame = window.requestAnimationFrame(updatePosition);
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);
		return () => {
			window.cancelAnimationFrame(frame);
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [visible, updatePosition]);

	return position;
}

/**
 * Hover/focus trigger that renders its tooltip in a portal, flipping above or below
 * the trigger depending on available viewport space.
 */
export function FloatingTooltipTrigger({
	tooltip,
	children,
	className,
}: {
	tooltip: ReactNode;
	children: ReactNode;
	className: string;
}): React.JSX.Element {
	const [visible, setVisible] = useState(false);
	const triggerRef = useRef<HTMLDivElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const position = useFloatingTooltipPosition({
		visible,
		triggerRef,
		tooltipRef,
		align: "center",
		placement: "auto",
	});

	return (
		<>
			<div
				ref={triggerRef}
				tabIndex={0}
				className={className}
				onMouseEnter={() => setVisible(true)}
				onMouseLeave={() => setVisible(false)}
				onFocus={() => setVisible(true)}
				onBlur={() => setVisible(false)}>
				{children}
			</div>
			{visible &&
				typeof document !== "undefined" &&
				document.body &&
				createPortal(
					<TooltipSurface
						ref={tooltipRef}
						className='pointer-events-none text-left'
						style={{
							position: "fixed",
							top: position?.top ?? -9999,
							left: position?.left ?? -9999,
							visibility: position ? "visible" : "hidden",
							zIndex: 9999,
							maxWidth: "min(20rem, calc(100vw - 16px))",
						}}>
						{tooltip}
					</TooltipSurface>,
					document.body,
				)}
		</>
	);
}

export default TooltipSurface;

export type HoverTooltipPlacement = FloatingTooltipPlacement;
export type HoverTooltipAlign = FloatingTooltipAlign;

export interface HoverTooltipProps {
	/** Tooltip body. When empty, children render without a wrapper. */
	content?: string | null;
	children: ReactNode;
	className?: string;
	tooltipClassName?: string;
	/** Prefer above, below, or auto-flip based on viewport space. Defaults to auto. */
	placement?: HoverTooltipPlacement;
	align?: HoverTooltipAlign;
	/** Allow multi-line wrapping for long labels. Short title tooltips stay on one line by default. */
	wrap?: boolean;
}

/**
 * Lightweight hover/focus tooltip for replacing native `title=` attributes.
 * Renders in a portal with viewport-aware positioning and single-line labels by default.
 */
export function HoverTooltip({
	content,
	children,
	className,
	tooltipClassName,
	placement = "auto",
	align = "center",
	wrap = false,
}: HoverTooltipProps): React.JSX.Element {
	const label = content?.trim();
	const [visible, setVisible] = useState(false);
	const triggerRef = useRef<HTMLSpanElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const position = useFloatingTooltipPosition({
		visible,
		triggerRef,
		tooltipRef,
		align,
		placement,
	});

	if (!label) {
		return <>{children}</>;
	}

	const show = () => setVisible(true);
	const hide = () => setVisible(false);

	return (
		<>
			<span
				ref={triggerRef}
				className={cn("relative inline-flex max-w-full", className)}
				onMouseEnter={show}
				onMouseLeave={hide}
				onFocusCapture={show}
				onBlurCapture={(event) => {
					const next = event.relatedTarget;
					if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
						hide();
					}
				}}>
				{children}
			</span>
			{visible &&
				typeof document !== "undefined" &&
				document.body &&
				createPortal(
					<TooltipSurface
						ref={tooltipRef}
						className={cn(
							"pointer-events-none fixed z-[9999]",
							!wrap && "whitespace-nowrap",
							tooltipClassName,
						)}
						style={{
							top: position?.top ?? -9999,
							left: position?.left ?? -9999,
							visibility: position ? "visible" : "hidden",
							maxWidth: wrap ? "min(20rem, calc(100vw - 16px))" : undefined,
						}}>
						{label}
					</TooltipSurface>,
					document.body,
				)}
		</>
	);
}
