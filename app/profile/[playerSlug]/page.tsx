import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import PlayerProfileView from "@/components/profile/PlayerProfileView";
import { featureFlags } from "@/config/config";
import type { PlayerData } from "@/lib/stores/navigation";
import { playerNameToWrappedSlug } from "@/lib/wrapped/slug";

type InitialWrappedMeta = {
	seasons: string[];
	selectedSeason: string | null;
	defaultSeason: string | null;
};

export async function generateMetadata(): Promise<Metadata> {
	if (!featureFlags.playerProfile) {
		return { title: "Not found" };
	}
	return {};
}

function ProfileFallback() {
	return (
		<div className='min-h-screen flex items-center justify-center text-white/70'>
			Loading profile...
		</div>
	);
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ playerSlug: string }> }) {
	if (!featureFlags.playerProfile) {
		notFound();
	}
	const { playerSlug } = await params;
	let decodedPlayerSlug = playerSlug;
	try {
		decodedPlayerSlug = decodeURIComponent(playerSlug);
	} catch {
		decodedPlayerSlug = playerSlug;
	}
	const playerName = decodedPlayerSlug.replace(/-/g, " ");
	let initialHeadlineData: PlayerData | null = null;
	let initialWrappedMeta: InitialWrappedMeta | null = null;
	if (featureFlags.profileServerHeadline) {
		try {
			const headerStore = await headers();
			const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
			const proto = headerStore.get("x-forwarded-proto") ?? "https";
			if (host) {
				const res = await fetch(
					`${proto}://${host}/api/player-data?playerName=${encodeURIComponent(playerName)}&profileHeadline=1`,
					{ next: { revalidate: 120 } },
				);
				if (res.ok) {
					const json = (await res.json()) as { playerData?: PlayerData };
					initialHeadlineData = json.playerData ?? null;
				}
				if (featureFlags.seasonWrapped) {
					const wrappedSlug = playerNameToWrappedSlug(playerName);
					const wrappedMetaRes = await fetch(
						`${proto}://${host}/api/wrapped/${encodeURIComponent(wrappedSlug)}?meta=1`,
						{ next: { revalidate: 300 } },
					);
					if (wrappedMetaRes.ok) {
						const wrappedMetaJson = (await wrappedMetaRes.json()) as {
							seasonsAvailable?: string[];
							season?: string;
						};
						const seasons = Array.isArray(wrappedMetaJson.seasonsAvailable) ? wrappedMetaJson.seasonsAvailable : [];
						const selectedSeason = typeof wrappedMetaJson.season === "string" ? wrappedMetaJson.season : null;
						const defaultSeason = selectedSeason ?? seasons[0] ?? null;
						initialWrappedMeta = { seasons, selectedSeason: defaultSeason, defaultSeason };
					}
				}
			}
		} catch {
			initialHeadlineData = null;
			initialWrappedMeta = null;
		}
	}
	return (
		<Suspense fallback={<ProfileFallback />}>
			<PlayerProfileView
				playerSlug={playerSlug}
				initialHeadlineData={initialHeadlineData}
				initialWrappedMeta={initialWrappedMeta}
			/>
		</Suspense>
	);
}
