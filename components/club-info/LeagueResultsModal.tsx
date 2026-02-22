"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { FixturesListSkeleton } from "@/components/skeletons";
import ModalWrapper from "@/components/modals/ModalWrapper";

interface LeagueResultsModalProps {
	isOpen: boolean;
	onClose: () => void;
	teamKey: string;
	teamDisplayName: string;
	season: string;
}

interface Goalscorer {
	playerName: string;
	goals: number;
}

interface Fixture {
	fixtureId: string;
	date: string;
	opposition: string;
	homeOrAway: string;
	result: string;
	homeScore: number;
	awayScore: number;
	dorkiniansGoals: number;
	conceded: number;
	compType: string;
	oppoOwnGoals: number;
	goalscorers: Goalscorer[];
	momPlayerName: string | null;
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

function positionSortOrder(position: string): number {
	const p = (position || "").toLowerCase();
	if (p.includes("goalkeeper") || p === "gk") return 0;
	if (p.includes("defender") || p === "def") return 1;
	if (p.includes("midfielder") || p === "mid") return 2;
	if (p.includes("forward") || p === "fwd") return 3;
	return 4;
}

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

function getPositionBadge(position: string): { label: string; className: string } {
	const p = (position || "").trim().toUpperCase();
	if (p.includes("GOAL") || p === "GK") return { label: "GK", className: "px-2 py-1 rounded text-xs font-medium bg-purple-600/30 text-purple-300" };
	if (p.includes("DEF") || p.includes("DEFENDER")) return { label: "DEF", className: "px-2 py-1 rounded text-xs font-medium bg-amber-700/30 text-amber-200" };
	if (p.includes("MID") || p.includes("MIDFIELDER")) return { label: "MID", className: "px-2 py-1 rounded text-xs font-medium bg-green-600/30 text-green-300" };
	if (p.includes("FWD") || p.includes("FORWARD")) return { label: "FWD", className: "px-2 py-1 rounded text-xs font-medium bg-teal-600/30 text-teal-300" };
	return { label: position || "—", className: "px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300" };
}

export default function LeagueResultsModal({
	isOpen,
	onClose,
	teamKey,
	teamDisplayName,
	season,
}: LeagueResultsModalProps) {
	const [fixtures, setFixtures] = useState<Fixture[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expandedFixtureId, setExpandedFixtureId] = useState<string | null>(null);
	const [lineupByFixtureId, setLineupByFixtureId] = useState<Record<string, LineupPlayer[]>>({});
	const [lineupLoadingByFixtureId, setLineupLoadingByFixtureId] = useState<Record<string, boolean>>({});

	const toggleFixture = useCallback((fixtureId: string) => {
		setExpandedFixtureId((prev) => (prev === fixtureId ? null : fixtureId));
		if (!lineupByFixtureId[fixtureId] && !lineupLoadingByFixtureId[fixtureId]) {
			setLineupLoadingByFixtureId((prev) => ({ ...prev, [fixtureId]: true }));
			fetch(`/api/fixture-lineup?fixtureId=${encodeURIComponent(fixtureId)}`)
				.then((res) => {
					if (!res.ok) return res.json().then((d) => Promise.reject(d?.error || "Failed to load"));
					return res.json();
				})
				.then((data) => {
					setLineupByFixtureId((prev) => ({ ...prev, [fixtureId]: data.lineup || [] }));
				})
				.catch(() => setLineupByFixtureId((prev) => ({ ...prev, [fixtureId]: [] })))
				.finally(() => setLineupLoadingByFixtureId((prev) => ({ ...prev, [fixtureId]: false })));
		}
	}, [lineupByFixtureId, lineupLoadingByFixtureId]);

	// Fetch fixtures when modal opens
	useEffect(() => {
		if (!isOpen || !teamKey || !season) return;

		const fetchFixtures = async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await fetch(
					`/api/league-fixtures?team=${encodeURIComponent(teamKey)}&season=${encodeURIComponent(season)}`
				);
				if (response.ok) {
					const data = await response.json();
					setFixtures(data.fixtures || []);
				} else {
					const errorData = await response.json();
					setError(errorData.error || "Failed to fetch fixtures");
				}
			} catch (err) {
				console.error("Error fetching fixtures:", err);
				setError("Error loading fixtures");
			} finally {
				setLoading(false);
			}
		};

		fetchFixtures();
	}, [isOpen, teamKey, season]);

	// Format season for display (2019-20 -> 2019/20)
	const formatSeason = (season: string) => {
		return season.replace("-", "/");
	};

	// Format date for display
	const formatDate = (dateString: string) => {
		if (!dateString) return "";
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
		} catch {
			return dateString;
		}
	};

	// Format goalscorers for display
	const formatGoalscorers = (goalscorers: Goalscorer[] | undefined, oppoOwnGoals: number = 0): string => {
		const parts: string[] = [];
		
		// Add regular goalscorers
		if (goalscorers && Array.isArray(goalscorers) && goalscorers.length > 0) {
			const validGoalscorers = goalscorers.filter((g) => g && g.playerName);
			validGoalscorers.forEach((g) => {
				if (g.playerName) {
					if (g.goals === 1) {
						parts.push(g.playerName);
					} else {
						parts.push(`${g.playerName} (${g.goals})`);
					}
				}
			});
		}
		
		// Add opponent own goal if it exists
		if (oppoOwnGoals > 0) {
			if (oppoOwnGoals === 1) {
				parts.push("Opponent Own Goal");
			} else {
				parts.push(`Opponent Own Goal (${oppoOwnGoals})`);
			}
		}
		
		if (parts.length === 0) {
			return "No goalscorers recorded";
		}
		
		return parts.join(", ");
	};

	// Format result for display
	const formatResult = (fixture: Fixture): string => {
		if (fixture.result) {
			return `${fixture.result} ${fixture.dorkiniansGoals}-${fixture.conceded}`;
		}
		if (fixture.homeScore !== null && fixture.awayScore !== null) {
			const isHome = fixture.homeOrAway?.toLowerCase() === "home";
			if (isHome) {
				return `${fixture.homeScore}-${fixture.awayScore}`;
			}
			return `${fixture.awayScore}-${fixture.homeScore}`;
		}
		return "TBD";
	};

	if (typeof window === 'undefined') {
		return null;
	}

	if (!isOpen) return null;

	const modalContent = (
		<ModalWrapper
			isOpen={isOpen}
			onClose={onClose}
			backdropClassName="fixed inset-0 bg-black/50 z-[9999]"
			modalClassName="fixed inset-0 h-screen w-screen z-[10000] shadow-xl"
			ariaLabel={`${teamDisplayName} - ${formatSeason(season)} league results`}>
			<div 
				className='h-full flex flex-col'
				style={{ backgroundColor: '#0f0f0f' }}>
				{/* Header */}
				<div className='flex items-center justify-between p-4 border-b border-white/20'>
					<h2 className='text-lg font-semibold text-white'>
						{teamDisplayName} - {formatSeason(season)}
					</h2>
					<button
						onClick={onClose}
						className='min-w-[44px] min-h-[44px] p-2 rounded-full hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
						aria-label={`Close ${teamDisplayName} league results modal`}>
						<XMarkIcon className='w-6 h-6 text-white' />
					</button>
				</div>

							{/* Scrollable content */}
							<div 
								className='flex-1 overflow-y-auto p-4 space-y-4'
								style={{ WebkitOverflowScrolling: 'touch' }}>
								{loading && (
									<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
										<FixturesListSkeleton />
									</SkeletonTheme>
								)}

								{error && (
									<div className='p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-200 text-center'>
										{error}
									</div>
								)}

								{!loading && !error && fixtures.length === 0 && (
									<div className='text-center text-gray-400 py-8'>
										No league fixtures found for this team and season
									</div>
								)}

								{!loading && !error && fixtures.length > 0 && (
									<div className='space-y-4'>
										{fixtures.map((fixture, index) => {
											const fixtureId = fixture.fixtureId ?? "";
											const isExpanded = expandedFixtureId === fixtureId;
											const lineup = fixtureId ? lineupByFixtureId[fixtureId] : undefined;
											const lineupLoading = fixtureId ? lineupLoadingByFixtureId[fixtureId] : false;
											return (
												<div
													key={fixtureId || index}
													className='bg-gray-800/50 rounded-lg border border-white/10 overflow-hidden'>
													<button
														type='button'
														onClick={() => fixtureId && toggleFixture(fixtureId)}
														disabled={!fixtureId}
														className='w-full text-left p-4 relative hover:bg-gray-800/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-inset disabled:cursor-default'>
														{/* Labels in top right */}
														<div className='absolute top-4 right-4 flex gap-2 items-center'>
															{fixture.compType && (
																<span
																	className={`px-2 py-1 rounded text-xs font-medium ${
																		fixture.compType?.toLowerCase() === "league"
																			? "bg-blue-600/30 text-blue-300"
																			: fixture.compType?.toLowerCase() === "cup"
																			? "bg-purple-600/30 text-purple-300"
																			: "bg-green-600/30 text-green-300"
																	}`}>
																	{fixture.compType}
																</span>
															)}
															<span
																className={`px-2 py-1 rounded text-xs font-medium ${
																	fixture.homeOrAway?.toLowerCase() === "home"
																		? "bg-dorkinians-yellow/20 text-dorkinians-yellow"
																		: "bg-gray-700 text-gray-300"
																}`}>
																{fixture.homeOrAway || "N/A"}
															</span>
														</div>
														{/* Date */}
														<div className='mb-2'>
															<span className='text-sm text-gray-400'>{formatDate(fixture.date)}</span>
														</div>
														{/* Result and opponent */}
														<div className='text-lg font-semibold text-white mb-2 pr-8'>
															{formatResult(fixture)} <span className='text-base font-normal'>vs <span className='font-medium'>{fixture.opposition || "Unknown"}</span></span>
														</div>
														{/* Goalscorers */}
														{((fixture.goalscorers && Array.isArray(fixture.goalscorers) && fixture.goalscorers.length > 0) || (fixture.oppoOwnGoals && fixture.oppoOwnGoals > 0)) && (
															<div className='text-sm text-gray-300 mt-2'>
																<span className='text-gray-400'>Goalscorers: </span>
																{formatGoalscorers(fixture.goalscorers, fixture.oppoOwnGoals || 0)}
															</div>
														)}
														{/* MoM */}
														{fixture.momPlayerName && (
															<div className='text-sm text-gray-300 mt-2'>
																<span className='text-gray-400'>MoM: </span>
																{fixture.momPlayerName}
															</div>
														)}
														{fixtureId && (
															<div className='absolute bottom-4 right-4'>
																<ChevronDownIcon className={`w-5 h-5 text-white transition-transform ${isExpanded ? "rotate-180" : ""}`} />
															</div>
														)}
													</button>
													{isExpanded && fixtureId && (
														<div className='border-t border-white/10 bg-gray-800/40'>
															{lineupLoading && (
																<div className='p-4 text-gray-400 text-sm'>Loading lineup…</div>
															)}
															{!lineupLoading && lineup && lineup.length === 0 && (
																<div className='p-4 text-gray-400 text-sm'>No lineup data</div>
															)}
															{!lineupLoading && lineup && lineup.length > 0 && (() => {
																const sorted = sortLineupByPositionAndMinutes(lineup);
																const optionalCols = getVisibleOptionalColumns(lineup);
																return (
																	<div className='overflow-x-auto'>
																		<table className='w-full text-white text-[0.7rem]'>
																			<thead>
																				<tr className='border-b border-white/20 bg-white/5'>
																					<th className='sticky left-0 z-10 bg-gray-800 text-left py-2 px-2 shadow-[2px_0_4px_rgba(0,0,0,0.15)]'>Player</th>
																					<th className='text-left py-2 px-2'>POS</th>
																					<th className='text-right py-2 px-2'>Mins</th>
																					<th className='text-right py-2 px-2'>MoM</th>
																					<th className='text-right py-2 px-2'>G</th>
																					<th className='text-right py-2 px-2'>A</th>
																					<th className='text-right py-2 px-2'>Y</th>
																					<th className='text-right py-2 px-2'>R</th>
																					{optionalCols.map((key) => (
																						<th key={key} className='text-right py-2 px-2'>
																							{OPTIONAL_LINEUP_COLUMNS.find((c) => c.key === key)?.label ?? key}
																						</th>
																					))}
																				</tr>
																			</thead>
																			<tbody>
																				{sorted.map((row, idx) => {
																					const badge = getPositionBadge(row.position);
																					return (
																						<tr key={idx} className='border-b border-white/10'>
																							<td className='sticky left-0 z-[1] py-2 px-2 shadow-[2px_0_4px_rgba(0,0,0,0.15)] bg-gray-800'>{row.playerName}</td>
																							<td className='py-2 px-2'><span className={badge.className}>{badge.label}</span></td>
																							<td className='py-2 px-2 text-right'>{row.minutes}</td>
																							<td className='py-2 px-2 text-right'>{row.mom ? "✓" : ""}</td>
																							<td className='py-2 px-2 text-right'>{row.goals > 0 ? row.goals : ""}</td>
																							<td className='py-2 px-2 text-right'>{row.assists > 0 ? row.assists : ""}</td>
																							<td className='py-2 px-2 text-right'>{row.yellowCards || ""}</td>
																							<td className='py-2 px-2 text-right'>{row.redCards || ""}</td>
																							{optionalCols.map((key) => (
																								<td key={key} className='py-2 px-2 text-right'>
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

				{/* Footer */}
				<div className='flex justify-center p-4 border-t border-white/20'>
					<button
						type='button'
						onClick={onClose}
						className='px-5 py-2 bg-dorkinians-yellow text-black text-sm font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
						Close
					</button>
				</div>
			</div>
		</ModalWrapper>
	);

	return createPortal(modalContent, document.body);
}
