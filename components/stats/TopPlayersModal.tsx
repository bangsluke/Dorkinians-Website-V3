"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import FullscreenModalContent from "@/components/modals/FullscreenModalContent";
import ModalWrapper from "@/components/modals/ModalWrapper";
import TopPlayersTable from "@/components/stats/TopPlayersTable";
import { TopPlayersTableSkeleton } from "@/components/skeletons";
import { ErrorState, EmptyState } from "@/components/ui/StateComponents";
import { cachedFetch, generatePageCacheKey } from "@/lib/utils/pageCache";
import {
	getStatTypeLabel,
	normalizeTopPlayer,
	type TopPlayer,
	type TopPlayerWithRank,
	type TopPlayersStatType,
} from "@/lib/stats/topPlayersUtils";

interface TopPlayersModalProps {
	isOpen: boolean;
	onClose: () => void;
	statType: TopPlayersStatType;
	filters: object;
	contextLabel: string;
	highlightPlayerName?: string | null;
	pageSource: "team-stats" | "club-stats";
	cacheScopeKey?: string;
	getCachedPageData?: (key: string) => unknown;
	setCachedPageData?: (key: string, data: unknown) => void;
}

interface TopPlayersApiResponse {
	players?: Array<Partial<TopPlayerWithRank>>;
	highlightPlayer?: { player: Partial<TopPlayer>; rank: number } | null;
	totalCount?: number;
	error?: string;
}

export default function TopPlayersModal({
	isOpen,
	onClose,
	statType,
	filters,
	contextLabel,
	highlightPlayerName,
	pageSource,
	cacheScopeKey,
	getCachedPageData,
	setCachedPageData,
}: TopPlayersModalProps) {
	const [showAllPlayers, setShowAllPlayers] = useState(false);
	const [players, setPlayers] = useState<TopPlayerWithRank[]>([]);
	const [highlightPlayer, setHighlightPlayer] = useState<{ player: TopPlayer; rank: number } | null>(null);
	const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [refetchKey, setRefetchKey] = useState(0);
	const highlightRowRef = useRef<HTMLTableRowElement | null>(null);

	useEffect(() => {
		if (!isOpen) {
			setShowAllPlayers(false);
			setPlayers([]);
			setHighlightPlayer(null);
			setTotalCount(undefined);
			setError(null);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;

		const fetchPlayers = async () => {
			setLoading(true);
			setError(null);

			try {
				const requestBody = {
					filters,
					statType,
					limit: showAllPlayers ? "all" : 25,
					...(highlightPlayerName ? { highlightPlayerName } : {}),
				};

				const cacheKey = generatePageCacheKey("stats", pageSource, "top-players-modal", {
					...requestBody,
					...(cacheScopeKey ? { cacheScopeKey } : {}),
				});

				const data = (await cachedFetch("/api/top-players-stats", {
					method: "POST",
					body: requestBody,
					cacheKey,
					getCachedPageData: getCachedPageData ?? (() => null),
					setCachedPageData: setCachedPageData ?? (() => {}),
				})) as TopPlayersApiResponse;

				const normalizedPlayers = (data.players || []).map((player) => ({
					...normalizeTopPlayer(player),
					rank: typeof player.rank === "number" ? player.rank : 0,
				}));

				setPlayers(normalizedPlayers);
				setTotalCount(data.totalCount);

				if (data.highlightPlayer?.player && typeof data.highlightPlayer.rank === "number") {
					setHighlightPlayer({
						player: normalizeTopPlayer(data.highlightPlayer.player),
						rank: data.highlightPlayer.rank,
					});
				} else {
					setHighlightPlayer(null);
				}
			} catch (err) {
				console.error("[TopPlayersModal] Error fetching players:", err);
				setError("Failed to load player rankings");
				setPlayers([]);
				setHighlightPlayer(null);
			} finally {
				setLoading(false);
			}
		};

		void fetchPlayers();
	}, [
		isOpen,
		showAllPlayers,
		statType,
		filters,
		highlightPlayerName,
		pageSource,
		cacheScopeKey,
		getCachedPageData,
		setCachedPageData,
		refetchKey,
	]);

	const tablePlayers = useMemo(() => {
		if (showAllPlayers) {
			return players;
		}

		const highlightInTopList = Boolean(
			highlightPlayerName && players.some((player) => player.playerName === highlightPlayerName)
		);

		if (highlightPlayer && !highlightInTopList) {
			return [...players, { ...highlightPlayer.player, rank: highlightPlayer.rank }];
		}

		return players;
	}, [players, highlightPlayer, highlightPlayerName, showAllPlayers]);

	const highlightOutsideTopList = Boolean(
		!showAllPlayers && highlightPlayer && !players.some((player) => player.playerName === highlightPlayer.player.playerName)
	);

	const statLabel = getStatTypeLabel(statType);
	const heading = showAllPlayers ? `All ${statLabel}` : `Top 25 ${statLabel}`;

	useEffect(() => {
		if (!isOpen || loading) return;
		const timer = window.setTimeout(() => {
			highlightRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
		}, 100);
		return () => window.clearTimeout(timer);
	}, [isOpen, loading, tablePlayers.length, highlightPlayerName]);

	if (typeof window === "undefined" || !isOpen) {
		return null;
	}

	const modalContent = (
		<ModalWrapper
			isOpen={isOpen}
			onClose={onClose}
			backdropClassName='fixed inset-0 bg-black/50 z-[9999]'
			modalClassName='fixed inset-0 h-screen w-screen z-[10000] shadow-xl'
			ariaLabel={`${heading} - ${contextLabel}`}>
			<FullscreenModalContent>
				<div className='flex items-center justify-between p-4 border-b border-white/20'>
					<div>
						<h2 className='text-lg font-semibold text-white'>{heading}</h2>
						<p className='text-sm text-gray-400 mt-1'>{contextLabel}</p>
					</div>
					<button
						type='button'
						onClick={onClose}
						className='min-w-[44px] min-h-[44px] p-2 rounded-full hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
						aria-label={`Close ${heading} modal`}>
						<XMarkIcon className='w-6 h-6 text-white' />
					</button>
				</div>

				<div className='flex-1 overflow-y-auto p-4' style={{ WebkitOverflowScrolling: "touch" }}>
					{loading && <TopPlayersTableSkeleton />}

					{error && (
						<ErrorState
							message='Failed to load player rankings'
							error={error}
							onRetry={() => {
								setError(null);
								setRefetchKey((key) => key + 1);
							}}
						/>
					)}

					{!loading && !error && tablePlayers.length === 0 && (
						<EmptyState title='No players found' message={`No eligible players found for ${statLabel.toLowerCase()}.`} />
					)}

					{!loading && !error && tablePlayers.length > 0 && (
						<TopPlayersTable
							players={tablePlayers}
							statType={statType}
							highlightPlayerName={highlightPlayerName}
							getRank={(player) => ("rank" in player ? (player as TopPlayerWithRank).rank : 0)}
							showSeparatorBeforeHighlight={highlightOutsideTopList}
							highlightRowRef={highlightRowRef}
						/>
					)}
				</div>

				{!loading && !error && tablePlayers.length > 0 && !showAllPlayers && (
					<div className='flex justify-center p-4 border-t border-white/20'>
						<button
							type='button'
							onClick={() => setShowAllPlayers(true)}
							className='text-white underline text-sm hover:text-white/80 min-h-[44px] px-4'>
							Show all players
							{typeof totalCount === "number" ? ` (${totalCount})` : ""}
						</button>
					</div>
				)}

				<div className='flex justify-center p-4 border-t border-white/20'>
					<button
						type='button'
						onClick={onClose}
						className='min-h-[44px] px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors'>
						Close
					</button>
				</div>
			</FullscreenModalContent>
		</ModalWrapper>
	);

	return createPortal(modalContent, document.body);
}
