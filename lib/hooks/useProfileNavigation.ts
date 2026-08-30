"use client";

import { useCallback, useEffect, useTransition } from "react";
import { getPlayerProfileHref } from "@/lib/profile/slug";
import { featureFlags } from "@/config/config";
import { useAppRouter } from "@/lib/hooks/useAppRouter";

export function useProfileNavigation(selectedPlayer: string | null) {
	const router = useAppRouter();
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		if (!featureFlags.playerProfile || !selectedPlayer) return;
		router.prefetch(getPlayerProfileHref(selectedPlayer));
	}, [router, selectedPlayer]);

	const navigateToProfile = useCallback(
		(player: string) => {
			startTransition(() => {
				router.push(getPlayerProfileHref(player));
			});
		},
		[router, startTransition],
	);

	return { isPending, navigateToProfile };
}
