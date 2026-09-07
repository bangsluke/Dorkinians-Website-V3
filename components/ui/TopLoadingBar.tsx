"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import { normalizeAppRouteKey } from "@/lib/navigation/internalLink";
import { useRouteLoadingStore } from "@/lib/stores/routeLoading";

const TRICKLE_TARGET = 85;
const TRICKLE_INTERVAL_MS = 400;
const FADE_OUT_MS = 280;
const SAFETY_TIMEOUT_MS = 15000;

export default function TopLoadingBar() {
	return (
		<Suspense fallback={null}>
			<TopLoadingBarInner />
		</Suspense>
	);
}

function TopLoadingBarInner() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const routeKey = normalizeAppRouteKey(pathname, searchParams.toString() ? `?${searchParams.toString()}` : "");
	const isLoading = useRouteLoadingStore((s) => s.isLoading);
	const complete = useRouteLoadingStore((s) => s.complete);
	const [visible, setVisible] = useState(false);
	const [progress, setProgress] = useState(0);
	const [opacity, setOpacity] = useState(1);
	const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const wasLoadingRef = useRef(false);
	const routeKeyAtStartRef = useRef(routeKey);

	// Complete when any in-app route change finishes.
	useEffect(() => {
		if (!isLoading) {
			routeKeyAtStartRef.current = routeKey;
			return;
		}
		if (routeKey !== routeKeyAtStartRef.current) {
			complete();
		}
	}, [routeKey, isLoading, complete]);

	useEffect(() => {
		const clearTrickle = () => {
			if (trickleRef.current) {
				clearInterval(trickleRef.current);
				trickleRef.current = null;
			}
		};
		const clearFade = () => {
			if (fadeTimeoutRef.current) {
				clearTimeout(fadeTimeoutRef.current);
				fadeTimeoutRef.current = null;
			}
		};
		const clearSafety = () => {
			if (safetyTimeoutRef.current) {
				clearTimeout(safetyTimeoutRef.current);
				safetyTimeoutRef.current = null;
			}
		};

		if (isLoading) {
			clearFade();
			clearSafety();
			wasLoadingRef.current = true;
			routeKeyAtStartRef.current = routeKey;
			setVisible(true);
			setOpacity(1);
			setProgress(12);
			clearTrickle();
			trickleRef.current = setInterval(() => {
				setProgress((prev) => {
					if (prev >= TRICKLE_TARGET) return prev;
					const remaining = TRICKLE_TARGET - prev;
					const step = Math.max(0.5, remaining * 0.08);
					return Math.min(TRICKLE_TARGET, prev + step);
				});
			}, TRICKLE_INTERVAL_MS);
			safetyTimeoutRef.current = setTimeout(() => {
				complete();
			}, SAFETY_TIMEOUT_MS);
			return () => {
				clearTrickle();
				clearSafety();
			};
		}

		if (wasLoadingRef.current) {
			clearTrickle();
			clearSafety();
			wasLoadingRef.current = false;
			setProgress(100);
			setOpacity(1);
			fadeTimeoutRef.current = setTimeout(() => {
				setOpacity(0);
				fadeTimeoutRef.current = setTimeout(() => {
					setVisible(false);
					setProgress(0);
					setOpacity(1);
				}, FADE_OUT_MS);
			}, 120);
			return () => clearFade();
		}

		return () => {
			clearTrickle();
			clearFade();
			clearSafety();
		};
	}, [isLoading, complete]);

	return (
		<AnimatePresence>
			{visible ? (
				<motion.div
					key='top-loading-bar'
					className='fixed top-0 left-0 right-0 z-[100] pointer-events-none'
					aria-hidden='true'
					initial={{ opacity: 1 }}
					animate={{ opacity }}
					exit={{ opacity: 0 }}
					transition={{ duration: FADE_OUT_MS / 1000, ease: "easeOut" }}
					data-testid='top-loading-bar'>
					<motion.div
						className='h-0.5 bg-dorkinians-yellow shadow-[0_0_8px_rgba(232,197,71,0.55)]'
						initial={{ width: "0%" }}
						animate={{ width: `${progress}%` }}
						transition={{ duration: 0.35, ease: "easeOut" }}
					/>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
