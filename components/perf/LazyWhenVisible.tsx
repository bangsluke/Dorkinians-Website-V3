"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type LazyWhenVisibleProps = {
	children: ReactNode;
	/** IntersectionObserver rootMargin (e.g. "120px" loads shortly before entering view). */
	rootMargin?: string;
	/** Placeholder height/min space while waiting (avoids layout jump). */
	className?: string;
	fallback?: ReactNode;
};

/**
 * Renders children only after the sentinel enters the viewport (or rootMargin).
 * Use to defer heavy JS (maps, Recharts) until the user scrolls near the block.
 */
export default function LazyWhenVisible({
	children,
	rootMargin = "100px",
	className = "min-h-[200px]",
	fallback,
}: LazyWhenVisibleProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el || visible) return;

		const obs = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) {
						setVisible(true);
						obs.disconnect();
						break;
					}
				}
			},
			{ root: null, rootMargin, threshold: 0 },
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, [visible, rootMargin]);

	return (
		<div ref={ref} className={className}>
			{visible ? children : fallback ?? null}
		</div>
	);
}
