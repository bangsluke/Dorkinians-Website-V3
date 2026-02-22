"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import ModalWrapper from "@/components/modals/ModalWrapper";

interface AllGamesModalProps {
	isOpen: boolean;
	onClose: () => void;
	playerName: string;
	playerDisplayName: string;
}

interface SeasonSummary {
	season: string;
	apps: number;
}

interface GameSummary {
	fixtureId: string;
	date: string;
	opposition: string;
	homeOrAway: string;
	result: string;
	dorkiniansGoals: number;
	conceded: number;
	compType: string;
	competition: string;
	homeScore: number;
	awayScore: number;
}

interface LineupPlayer {
	playerName: string;
	position: string;
	minutes: number;
	goals: number;
	assists: number;
	mom: number;
	yellowCards: number;
	redCards: number;
	saves: number;
	cleanSheets: number;
	conceded: number;
	ownGoals: number;
	penaltiesScored: number;
	penaltiesMissed: number;
	penaltiesConceded: number;
	penaltiesSaved: number;
}

/** Position order for sorting: GK, DEF, MID, FWD. Returns 0-3 or 4 for unknown. */
function positionSortOrder(position: string): number {
	const p = (position || "").toLowerCase();
	if (p.includes("goalkeeper") || p === "gk") return 0;
	if (p.includes("defender") || p === "def") return 1;
	if (p.includes("midfielder") || p === "mid") return 2;
	if (p.includes("forward") || p === "fwd") return 3;
	return 4;
}

/** Sort lineup by position (GK, DEF, MID, FWD) then by minutes descending. */
function sortLineupByPositionAndMinutes(lineup: LineupPlayer[]): LineupPlayer[] {
	return [...lineup].sort((a, b) => {
		const orderA = positionSortOrder(a.position);
		const orderB = positionSortOrder(b.position);
		if (orderA !== orderB) return orderA - orderB;
		return b.minutes - a.minutes;
	});
}

const OPTIONAL_LINEUP_COLUMNS: { key: keyof LineupPlayer; label: string }[] = [
	{ key: "saves", label: "SAVES" },
	{ key: "ownGoals", label: "OG" },
	{ key: "penaltiesScored", label: "PSC" },
	{ key: "penaltiesMissed", label: "PM" },
	{ key: "penaltiesConceded", label: "PCO" },
	{ key: "penaltiesSaved", label: "PSV" },
];

function getVisibleOptionalColumns(lineup: LineupPlayer[]): (keyof LineupPlayer)[] {
	return OPTIONAL_LINEUP_COLUMNS.filter(({ key }) =>
		lineup.some((row) => (row[key] as number) > 0)
	).map(({ key }) => key);
}

/** Position badge styling to match Positional Stats (GK=purple, DEF=amber, MID=green, FWD=teal). Returns { label, className }. */
function getPositionBadge(position: string): { label: string; className: string } {
	const p = (position || "").trim().toUpperCase();
	if (p.includes("GOAL") || p === "GK") return { label: "GK", className: "px-2 py-1 rounded text-xs font-medium bg-purple-600/30 text-purple-300" };
	if (p.includes("DEF") || p.includes("DEFENDER")) return { label: "DEF", className: "px-2 py-1 rounded text-xs font-medium bg-amber-700/30 text-amber-200" };
	if (p.includes("MID") || p.includes("MIDFIELDER")) return { label: "MID", className: "px-2 py-1 rounded text-xs font-medium bg-green-600/30 text-green-300" };
	if (p.includes("FWD") || p.includes("FORWARD")) return { label: "FWD", className: "px-2 py-1 rounded text-xs font-medium bg-teal-600/30 text-teal-300" };
	return { label: position || "—", className: "px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300" };
}

function formatDate(dateString: string): string {
	if (!dateString) return "";
	try {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
	} catch {
		return dateString;
	}
}

function formatResult(game: GameSummary): string {
	if (game.result) {
		return `${game.result} ${game.dorkiniansGoals}-${game.conceded}`;
	}
	if (game.homeScore != null && game.awayScore != null) {
		const isHome = game.homeOrAway?.toLowerCase() === "home";
		if (isHome) return `${game.homeScore}-${game.awayScore}`;
		return `${game.awayScore}-${game.homeScore}`;
	}
	return "TBD";
}

export default function AllGamesModal({
	isOpen,
	onClose,
	playerName,
	playerDisplayName,
}: AllGamesModalProps) {
	const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
	const [seasonsLoading, setSeasonsLoading] = useState(false);
	const [seasonsError, setSeasonsError] = useState<string | null>(null);

	const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());
	const [gamesBySeason, setGamesBySeason] = useState<Record<string, GameSummary[]>>({});
	const [gamesLoadingBySeason, setGamesLoadingBySeason] = useState<Record<string, boolean>>({});

	const [expandedFixtureIds, setExpandedFixtureIds] = useState<Set<string>>(new Set());
	const [lineupByFixtureId, setLineupByFixtureId] = useState<Record<string, LineupPlayer[]>>({});
	const [lineupLoadingByFixtureId, setLineupLoadingByFixtureId] = useState<Record<string, boolean>>({});

	// Fetch seasons when modal opens
	useEffect(() => {
		if (!isOpen || !playerName) return;
		setSeasonsLoading(true);
		setSeasonsError(null);
		fetch(
			`/api/player-seasons-games?playerName=${encodeURIComponent(playerName)}`
		)
			.then((res) => {
				if (!res.ok) return res.json().then((d) => Promise.reject(d?.error || "Failed to load"));
				return res.json();
			})
			.then((data) => {
				setSeasons(data.seasons || []);
			})
			.catch((err) => {
				setSeasonsError(typeof err === "string" ? err : "Error loading seasons");
			})
			.finally(() => setSeasonsLoading(false));
	}, [isOpen, playerName]);

	// When a season is expanded, fetch its games
	const toggleSeason = useCallback(
		(season: string) => {
			setExpandedSeasons((prev) => {
				const next = new Set(prev);
				if (next.has(season)) {
					next.delete(season);
					return next;
				}
				next.add(season);
				return next;
			});
			if (!gamesBySeason[season] && !gamesLoadingBySeason[season]) {
				setGamesLoadingBySeason((prev) => ({ ...prev, [season]: true }));
				const seasonParam = season.replace("/", "-");
				fetch(
					`/api/player-season-games?playerName=${encodeURIComponent(playerName)}&season=${encodeURIComponent(seasonParam)}`
				)
					.then((res) => {
						if (!res.ok) return res.json().then((d) => Promise.reject(d?.error || "Failed to load"));
						return res.json();
					})
					.then((data) => {
						setGamesBySeason((prev) => ({ ...prev, [season]: data.games || [] }));
					})
					.catch(() => {
						setGamesBySeason((prev) => ({ ...prev, [season]: [] }));
					})
					.finally(() => {
						setGamesLoadingBySeason((prev) => ({ ...prev, [season]: false }));
					});
			}
		},
		[playerName, gamesBySeason, gamesLoadingBySeason]
	);

	// When a game is expanded, fetch its lineup
	const toggleGame = useCallback((fixtureId: string) => {
		setExpandedFixtureIds((prev) => {
			const next = new Set(prev);
			if (next.has(fixtureId)) {
				next.delete(fixtureId);
				return next;
			}
			next.add(fixtureId);
			return next;
		});
		if (!lineupByFixtureId[fixtureId] && !lineupLoadingByFixtureId[fixtureId]) {
			setLineupLoadingByFixtureId((prev) => ({ ...prev, [fixtureId]: true }));
			fetch(
				`/api/fixture-lineup?fixtureId=${encodeURIComponent(fixtureId)}`
			)
				.then((res) => {
					if (!res.ok) return res.json().then((d) => Promise.reject(d?.error || "Failed to load"));
					return res.json();
				})
				.then((data) => {
					setLineupByFixtureId((prev) => ({ ...prev, [fixtureId]: data.lineup || [] }));
				})
				.catch(() => {
					setLineupByFixtureId((prev) => ({ ...prev, [fixtureId]: [] }));
				})
				.finally(() => {
					setLineupLoadingByFixtureId((prev) => ({ ...prev, [fixtureId]: false }));
				});
		}
	}, [lineupByFixtureId, lineupLoadingByFixtureId]);

	if (typeof window === "undefined") return null;
	if (!isOpen) return null;

	const modalContent = (
		<ModalWrapper
			isOpen={isOpen}
			onClose={onClose}
			backdropClassName="fixed inset-0 bg-black/50 z-[9999]"
			modalClassName="fixed inset-0 h-screen w-screen z-[10000] shadow-xl"
			ariaLabel={`All Games - ${playerDisplayName}`}
		>
			<div className="h-full flex flex-col" style={{ backgroundColor: "#0f0f0f" }}>
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-white/20">
					<h2 className="text-lg font-semibold text-white">All Games - {playerDisplayName}</h2>
					<button
						onClick={onClose}
						className="min-w-[44px] min-h-[44px] p-2 rounded-full hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
						aria-label="Close All Games modal"
					>
						<XMarkIcon className="w-6 h-6 text-white" />
					</button>
				</div>

				{/* Scrollable content */}
				<div
					className="flex-1 overflow-y-auto p-4 space-y-4"
					style={{ WebkitOverflowScrolling: "touch" }}
				>
					{seasonsLoading && (
						<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
							<div className="space-y-2">
								{[1, 2, 3].map((i) => (
									<div key={i} className="h-14 rounded-lg bg-white/10" />
								))}
							</div>
						</SkeletonTheme>
					)}

					{seasonsError && (
						<div className="p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-200 text-center">
							{seasonsError}
						</div>
					)}

					{!seasonsLoading && !seasonsError && seasons.length === 0 && (
						<div className="text-center text-gray-400 py-8">No seasons found</div>
					)}

					{!seasonsLoading && !seasonsError && seasons.length > 0 && (
						<div className="space-y-2">
							{seasons.map((s) => {
								const isSeasonExpanded = expandedSeasons.has(s.season);
								const games = gamesBySeason[s.season] ?? [];
								const gamesLoading = gamesLoadingBySeason[s.season];

								return (
									<div key={s.season} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
										<button
											type="button"
											onClick={() => toggleSeason(s.season)}
											className="w-full flex items-center justify-between p-4 text-left text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)]"
										>
											<span className="font-medium">
												{s.season} Season ({s.apps} App{s.apps === 1 ? "" : "s"})
											</span>
											{isSeasonExpanded ? (
												<ChevronDownIcon className="w-5 h-5 text-white flex-shrink-0" />
											) : (
												<ChevronRightIcon className="w-5 h-5 text-white flex-shrink-0" />
											)}
										</button>

										{isSeasonExpanded && (
											<div className="px-4 pb-4 space-y-3">
												{gamesLoading && (
													<div className="space-y-2">
														{[1, 2, 3].map((i) => (
															<div key={i} className="h-24 rounded-lg bg-white/10 animate-pulse" />
														))}
													</div>
												)}
												{!gamesLoading && games.length === 0 && (
													<p className="text-gray-400 text-sm">No games in this season</p>
												)}
												{!gamesLoading &&
													games.length > 0 &&
													games.map((game) => {
														const isGameExpanded = expandedFixtureIds.has(game.fixtureId);
														const lineup = lineupByFixtureId[game.fixtureId];
														const lineupLoading = lineupLoadingByFixtureId[game.fixtureId];

														return (
															<div key={game.fixtureId} className="bg-gray-800/50 rounded-lg border border-white/10 overflow-hidden">
																<button
																	type="button"
																	onClick={() => toggleGame(game.fixtureId)}
																	className="w-full text-left p-4 relative hover:bg-gray-800/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-inset"
																>
																	<div className="absolute top-4 right-4 flex gap-2 items-center">
																		{game.compType && (
																			<span
																				className={`px-2 py-1 rounded text-xs font-medium ${
																					game.compType?.toLowerCase() === "league"
																						? "bg-blue-600/30 text-blue-300"
																						: game.compType?.toLowerCase() === "cup"
																							? "bg-purple-600/30 text-purple-300"
																							: "bg-green-600/30 text-green-300"
																				}`}
																			>
																				{game.compType}
																			</span>
																		)}
																		<span
																			className={`px-2 py-1 rounded text-xs font-medium ${
																				game.homeOrAway?.toLowerCase() === "home"
																					? "bg-dorkinians-yellow/20 text-dorkinians-yellow"
																					: "bg-gray-700 text-gray-300"
																			}`}
																		>
																			{game.homeOrAway || "N/A"}
																		</span>
																	</div>
																	<div className="mb-2">
																		<span className="text-sm text-gray-400">{formatDate(game.date)}</span>
																	</div>
																	<div className="text-lg font-semibold text-white mb-2 pr-8">
																		{formatResult(game)}{" "}
																		<span className="text-base font-normal">
																			vs <span className="font-medium">{game.opposition || "Unknown"}</span>
																		</span>
																	</div>
																	{game.competition && (
																		<div className="text-sm text-gray-400">{game.competition}</div>
																	)}
																	<div className="absolute bottom-4 right-4">
																		<ChevronDownIcon
																			className={`w-5 h-5 text-white transition-transform ${isGameExpanded ? "rotate-180" : ""}`}
																		/>
																	</div>
																</button>

																{isGameExpanded && (
																	<div className="border-t border-white/10 bg-gray-800/40">
																		{lineupLoading && (
																			<div className="p-4 text-gray-400 text-sm">Loading lineup…</div>
																		)}
																		{!lineupLoading && lineup && lineup.length === 0 && (
																			<div className="p-4 text-gray-400 text-sm">No lineup data</div>
																		)}
																		{!lineupLoading && lineup && lineup.length > 0 && (() => {
																			const sorted = sortLineupByPositionAndMinutes(lineup);
																			const optionalCols = getVisibleOptionalColumns(lineup);
																			return (
																				<div className="overflow-x-auto">
																					<table className="w-full text-white text-[0.7rem]">
																						<thead>
																							<tr className="border-b border-white/20 bg-white/5">
																								<th className="sticky left-0 z-10 bg-gray-800 text-left py-2 px-2 shadow-[2px_0_4px_rgba(0,0,0,0.15)]">Player</th>
																								<th className="text-left py-2 px-2">POS</th>
																								<th className="text-right py-2 px-2">Mins</th>
																								<th className="text-right py-2 px-2">MoM</th>
																								<th className="text-right py-2 px-2">G</th>
																								<th className="text-right py-2 px-2">A</th>
																								<th className="text-right py-2 px-2">Y</th>
																								<th className="text-right py-2 px-2">R</th>
																								{optionalCols.map((key) => (
																									<th key={key} className="text-right py-2 px-2">
																										{OPTIONAL_LINEUP_COLUMNS.find((c) => c.key === key)?.label ?? key}
																									</th>
																								))}
																							</tr>
																						</thead>
																						<tbody>
																							{sorted.map((row, idx) => {
																								const isSelectedPlayer = row.playerName.trim().toLowerCase() === playerName.trim().toLowerCase();
																								return (
																									<tr
																										key={idx}
																										className={`border-b border-white/10 ${isSelectedPlayer ? "bg-dorkinians-yellow/20" : ""}`}
																									>
																										<td className={`sticky left-0 z-[1] py-2 px-2 shadow-[2px_0_4px_rgba(0,0,0,0.15)] ${isSelectedPlayer ? "bg-[#494C2F]" : "bg-gray-800"}`}>{row.playerName}</td>
																										<td className="py-2 px-2">
																											{(() => {
																												const badge = getPositionBadge(row.position);
																												return <span className={badge.className}>{badge.label}</span>;
																											})()}
																										</td>
																										<td className="py-2 px-2 text-right">{row.minutes}</td>
																										<td className="py-2 px-2 text-right">{row.mom ? "✓" : ""}</td>
																										<td className="py-2 px-2 text-right">{row.goals > 0 ? row.goals : ""}</td>
																										<td className="py-2 px-2 text-right">{row.assists > 0 ? row.assists : ""}</td>
																										<td className="py-2 px-2 text-right">{row.yellowCards || ""}</td>
																										<td className="py-2 px-2 text-right">{row.redCards || ""}</td>
																										{optionalCols.map((key) => (
																											<td key={key} className="py-2 px-2 text-right">
																												{(row[key] as number) > 0 ? (row[key] as number) : ""}
																											</td>
																										))}
																									</tr>
																								);
																							})}
																						</tbody>
																					</table>
																				</div>
																			);
																		})()}
																	</div>
																)}
															</div>
														);
													})}
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex justify-center p-4 border-t border-white/20">
					<button
						type="button"
						onClick={onClose}
						className="px-5 py-2 bg-dorkinians-yellow text-black text-sm font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
					>
						Close
					</button>
				</div>
			</div>
		</ModalWrapper>
	);

	return createPortal(modalContent, document.body);
}
