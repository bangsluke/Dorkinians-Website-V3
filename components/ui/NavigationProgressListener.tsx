"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { hrefToRouteKey, isInternalAppHref, isSameAppRoute, normalizeAppRouteKey } from "@/lib/navigation/internalLink";
import { useRouteLoadingStore } from "@/lib/stores/routeLoading";

/** Starts the top loading bar on internal link clicks (covers Next.js Link). */
export default function NavigationProgressListener() {
	return (
		<Suspense fallback={null}>
			<NavigationProgressListenerInner />
		</Suspense>
	);
}

function NavigationProgressListenerInner() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const start = useRouteLoadingStore((s) => s.start);

	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			if (event.defaultPrevented) return;
			if (event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

			const target = event.target;
			if (!(target instanceof Element)) return;

			const anchor = target.closest("a");
			if (!anchor) return;
			if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

			const rawHref = anchor.getAttribute("href");
			if (!rawHref || !isInternalAppHref(rawHref)) return;

			const targetKey = hrefToRouteKey(rawHref);
			if (!targetKey) return;

			const currentKey = normalizeAppRouteKey(pathname, searchParams.toString() ? `?${searchParams.toString()}` : "");
			if (isSameAppRoute(currentKey, targetKey)) return;

			start();
		};

		document.addEventListener("click", onClick, true);
		return () => document.removeEventListener("click", onClick, true);
	}, [pathname, searchParams, start]);

	return null;
}
