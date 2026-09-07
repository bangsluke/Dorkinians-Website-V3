"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/StateComponents";
import { useToast } from "@/lib/hooks/useToast";
import FullscreenModalContent from "@/components/modals/FullscreenModalContent";
import ModalWrapper from "@/components/modals/ModalWrapper";

export type SquadAchievementType = "league" | "cup";

interface SquadPlayersModalProps {
	isOpen: boolean;
	onClose: () => void;
	teamKey: string;
	teamDisplayName: string;
	season: string;
	division: string;
	achievementType?: SquadAchievementType;
	competition?: string;
}

interface PlayerWithAppearances {
	playerName: string;
	appearances: number;
}

function buildSquadPlayersUrl(
	teamKey: string,
	season: string,
	achievementType: SquadAchievementType,
	competition?: string,
): string {
	const params = new URLSearchParams();
	params.set("team", teamKey);
	params.set("season", season);
	if (achievementType === "cup") {
		params.set("type", "cup");
		if (competition) params.set("competition", competition);
	} else {
		params.set("type", "league");
	}
	return `/api/team-season-players?${params.toString()}`;
}

export default function SquadPlayersModal({
	isOpen,
	onClose,
	teamKey,
	teamDisplayName,
	season,
	division,
	achievementType = "league",
	competition,
}: SquadPlayersModalProps) {
	const [players, setPlayers] = useState<PlayerWithAppearances[]>([]);
	const [captains, setCaptains] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { showError } = useToast();

	useEffect(() => {
		if (!isOpen || !teamKey || !season) return;

		const fetchData = async () => {
			setLoading(true);
			setError(null);
			try {
				const url = buildSquadPlayersUrl(teamKey, season, achievementType, competition);
				const response = await fetch(url);
				if (response.ok) {
					const data = await response.json();
					setPlayers(data.players || []);
					setCaptains(data.captains || []);
				} else {
					const errorData = await response.json();
					setError(errorData.error || "Failed to fetch squad data");
				}
			} catch (err) {
				console.error("Error fetching squad data:", err);
				setError("Error loading squad data");
			} finally {
				setLoading(false);
			}
		};

		void fetchData();
	}, [isOpen, teamKey, season, achievementType, competition]);

	const formatSeason = (s: string) => {
		return s.replace("-", "/");
	};

	if (typeof window === "undefined") {
		return null;
	}

	if (!isOpen) return null;

	const playersByAppearances = players.reduce(
		(acc, player) => {
			const apps = player.appearances;
			if (!acc[apps]) acc[apps] = [];
			acc[apps].push(player.playerName);
			return acc;
		},
		{} as Record<number, string[]>,
	);

	const sortedAppearanceGroups = Object.entries(playersByAppearances).sort(([a], [b]) => Number(b) - Number(a));

	const subtitle =
		achievementType === "cup" && competition
			? `${competition} — cup squad (${formatSeason(season)})`
			: division
				? `${division} Champions`
				: null;

	const modalContent = (
		<ModalWrapper
			isOpen={isOpen}
			onClose={onClose}
			backdropClassName="fixed inset-0 bg-black/50 z-[9999]"
			modalClassName="fixed inset-0 h-screen w-screen z-[10000] shadow-xl"
			ariaLabel={`${teamDisplayName} - ${formatSeason(season)} squad players`}>
			<FullscreenModalContent>
				<div className="flex items-center justify-between p-4 border-b border-white/20">
					<div>
						<h2 className="text-lg font-semibold text-white">
							{teamDisplayName} - {formatSeason(season)}
						</h2>
						{subtitle ? <p className="text-sm text-gray-400 mt-1">{subtitle}</p> : null}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="min-w-[44px] min-h-[44px] p-2 rounded-full hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
						aria-label={`Close ${teamDisplayName} squad players modal`}>
						<XMarkIcon className="w-6 h-6 text-white" />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto p-4 space-y-6" style={{ WebkitOverflowScrolling: "touch" }}>
					{loading && <LoadingState message="Loading squad data..." variant="spinner" />}

					{error && (
						<ErrorState
							message="Failed to load squad data"
							error={error}
							onShowToast={showError}
							showToast={true}
							onRetry={() => {
								setError(null);
							}}
						/>
					)}

					{!loading && !error && players.length === 0 && (
						<EmptyState
							title="No squad data available"
							message={`No player data found for ${teamDisplayName} in ${formatSeason(season)}`}
						/>
					)}

					{!loading && !error && players.length > 0 && (
						<>
							{captains.length > 0 && (
								<div className="bg-gray-800/50 rounded-lg p-4 border border-white/10">
									<h3 className="text-base font-semibold text-dorkinians-yellow mb-2">Captains</h3>
									<div className="text-sm text-gray-300">{captains.join(", ")}</div>
								</div>
							)}

							<div className="bg-gray-800/50 rounded-lg p-4 border border-white/10">
								<h3 className="text-base font-semibold text-dorkinians-yellow mb-4">Squad Players</h3>
								{players.length > 0 ? (
									<div className="space-y-3">
										{sortedAppearanceGroups.map(([appsStr, names]) => {
											const apps = Number(appsStr);
											return (
												<div key={appsStr} className="text-sm">
													<span className="text-gray-500 font-semibold">
														{apps} {apps === 1 ? "app" : "apps"}:
													</span>{" "}
													<span className="text-gray-300">{names.join(", ")}</span>
												</div>
											);
										})}
									</div>
								) : null}
							</div>
						</>
					)}
				</div>

				<div className="flex justify-center p-4 border-t border-white/20">
					<button
						type="button"
						onClick={onClose}
						className="px-5 py-2 bg-dorkinians-yellow text-black text-sm font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent">
						Close
					</button>
				</div>
			</FullscreenModalContent>
		</ModalWrapper>
	);

	return createPortal(modalContent, document.body);
}
