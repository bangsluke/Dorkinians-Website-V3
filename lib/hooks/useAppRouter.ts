"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useRouteLoadingStore } from "@/lib/stores/routeLoading";

type NavigateOptions = Parameters<AppRouterInstance["push"]>[1];

function withRouteLoading<T extends (...args: never[]) => unknown>(
	fn: T,
	start: () => void,
): T {
	return ((...args: Parameters<T>) => {
		start();
		return fn(...args);
	}) as T;
}

/** Drop-in router wrapper that starts the top loading bar on push/replace. */
export function useAppRouter(): AppRouterInstance {
	const router = useRouter();
	const start = useRouteLoadingStore((s) => s.start);

	return useMemo(
		() => ({
			...router,
			push: withRouteLoading(router.push.bind(router), start),
			replace: withRouteLoading(router.replace.bind(router), start),
		}),
		[router, start],
	);
}

/** Full document navigation with loading bar (e.g. settings routes that hard-reload). */
export function navigateWithFullReload(href: string) {
	useRouteLoadingStore.getState().start();
	window.location.href = href;
}
