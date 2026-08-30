"use client";

import type { ReactNode } from "react";
import { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

/** Skeleton shimmer duration in seconds. Matches the library default, stated explicitly. */
const SKELETON_DURATION_SECONDS = 1.5;

/**
 * Single source of skeleton appearance for the whole app. Mounted in the root layout so
 * individual skeleton components never need to declare their own SkeletonTheme.
 */
export default function SkeletonProvider({ children }: { children: ReactNode }) {
	return (
		<SkeletonTheme
			baseColor='var(--skeleton-base)'
			highlightColor='var(--skeleton-highlight)'
			duration={SKELETON_DURATION_SECONDS}>
			{children}
		</SkeletonTheme>
	);
}
