"use client";

import { useEffect, useRef, useState } from "react";
import { Tooltip } from "recharts";

const TOUCH_DELAY_MS = 500;
const MOVEMENT_THRESHOLD = 10;

// Global map to track touch state per chart container
const chartTouchState = new WeakMap<HTMLElement, {
	shouldShow: boolean;
	isTouch: boolean;
}>();

export default function TouchDelayedTooltip(props: any) {
	const [shouldShow, setShouldShow] = useState(false);
	const [isTouch, setIsTouch] = useState(false);
	const containerRef = useRef<HTMLElement | null>(null);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const touchStartRef = useRef<{ x: number; y: number } | null>(null);
	const isTouchRef = useRef(false);

	useEffect(() => {
		// Find the chart container with retry logic
		const findContainer = () => {
			// Look for recharts-wrapper which contains the chart
			const wrapper = document.querySelector('.recharts-wrapper');
			if (wrapper) {
				return wrapper as HTMLElement;
			}
			// Fallback: find SVG and get its container
			const svg = document.querySelector('svg.recharts-surface');
			return svg?.closest('.recharts-wrapper') as HTMLElement || null;
		};

		const trySetup = () => {
			const container = findContainer();
			if (!container) {
				// Retry after a short delay if container not found
				setTimeout(trySetup, 100);
				return;
			}

			containerRef.current = container;

			const handleTouchStart = (e: TouchEvent) => {
				const touch = e.touches[0];
				if (touch) {
					isTouchRef.current = true;
					setIsTouch(true);
					setShouldShow(false);
					touchStartRef.current = {
						x: touch.clientX,
						y: touch.clientY,
					};

					if (timeoutRef.current) {
						clearTimeout(timeoutRef.current);
					}

					timeoutRef.current = setTimeout(() => {
						if (touchStartRef.current && isTouchRef.current) {
							setShouldShow(true);
						}
					}, TOUCH_DELAY_MS);
				}
			};

			const handleTouchMove = (e: TouchEvent) => {
				if (touchStartRef.current && isTouchRef.current) {
					const touch = e.touches[0];
					if (touch) {
						const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
						const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
						const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

						if (distance > MOVEMENT_THRESHOLD) {
							if (timeoutRef.current) {
								clearTimeout(timeoutRef.current);
								timeoutRef.current = null;
							}
							setShouldShow(false);
							touchStartRef.current = null;
						}
					}
				}
			};

			const handleTouchEnd = () => {
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
					timeoutRef.current = null;
				}
				setTimeout(() => {
					isTouchRef.current = false;
					setIsTouch(false);
					touchStartRef.current = null;
				}, 100);
			};

			container.addEventListener("touchstart", handleTouchStart, { passive: true });
			container.addEventListener("touchmove", handleTouchMove, { passive: true });
			container.addEventListener("touchend", handleTouchEnd, { passive: true });

			return () => {
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
				}
				container.removeEventListener("touchstart", handleTouchStart);
				container.removeEventListener("touchmove", handleTouchMove);
				container.removeEventListener("touchend", handleTouchEnd);
			};
		};

		const cleanup = trySetup();
		return cleanup;
	}, []);

	// Determine if tooltip should be active
	// Show immediately for mouse, only after delay for touch
	const isActive = props.active && (!isTouchRef.current || shouldShow);

	// Wrap the content function to control visibility
	if (typeof props.content === "function") {
		const originalContent = props.content;
		const wrappedContent = (tooltipProps: any) => {
			const modifiedProps = {
				...tooltipProps,
				active: isActive,
			};
			return originalContent(modifiedProps);
		};
		return <Tooltip {...props} content={wrappedContent} />;
	}

	// For component content
	if (props.content && typeof props.content !== "function") {
		const ContentComponent = props.content;
		const wrappedContent = (tooltipProps: any) => {
			if (!isActive) return null;
			return <ContentComponent {...tooltipProps} active={isActive} />;
		};
		return <Tooltip {...props} content={wrappedContent} />;
	}

	// Default pass-through
	return <Tooltip {...props} active={isActive} />;
}

