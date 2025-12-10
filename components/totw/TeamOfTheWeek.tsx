"use client";

import { useEffect, useMemo, useState } from "react";
import type { SeasonTOTW, WeeklyTOTW } from "@/types";

interface TotwApiResponse {
	weekly: WeeklyTOTW | null;
	recentSeasonal: SeasonTOTW[];
}

const positions = [
	{ title: "Goalkeeper", keys: ["gk1"] as const },
	{ title: "Defenders", keys: ["def1", "def2", "def3", "def4", "def5"] as const },
	{ title: "Midfielders", keys: ["mid1", "mid2", "mid3", "mid4", "mid5"] as const },
	{ title: "Forwards", keys: ["fwd1", "fwd2", "fwd3"] as const },
];

const formatDate = (value?: string) => {
	if (!value) return "Date to be confirmed";
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	return parsed.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

export default function TeamOfTheWeek() {
	const [weeklyTotw, setWeeklyTotw] = useState<WeeklyTOTW | null>(null);
	const [seasonalTotw, setSeasonalTotw] = useState<SeasonTOTW[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [summaryReady, setSummaryReady] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;
		const loadData = async () => {
			try {
				const response = await fetch("/api/totw/latest");
				if (!response.ok) {
					throw new Error("Unable to load Team of the Week data");
				}
				const data: TotwApiResponse = await response.json();
				if (mounted) {
					setWeeklyTotw(data.weekly);
					setSeasonalTotw(data.recentSeasonal ?? []);
					setError(null);
				}
			} catch (err) {
				if (mounted) {
					setError(err instanceof Error ? err.message : "Unknown error");
				}
			} finally {
				if (mounted) {
					setIsLoading(false);
				}
			}
		};

		loadData();
		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		if (!isLoading && weeklyTotw) {
			const timer = setTimeout(() => setSummaryReady(true), 200);
			return () => clearTimeout(timer);
		}
		setSummaryReady(false);
	}, [isLoading, weeklyTotw]);

	const lineupGroups = useMemo(() => {
		if (!weeklyTotw) return [];

		return positions
			.map(({ title, keys }) => ({
				title,
				players: keys
					.map((key) => weeklyTotw[key as keyof WeeklyTOTW])
					.filter((name): name is string => Boolean(name && name.trim())),
			}))
			.filter((group) => group.players.length > 0);
	}, [weeklyTotw]);

	const selectedPlayers = useMemo(() => {
		if (!weeklyTotw?.playerLookups) return [];
		return weeklyTotw.playerLookups
			.split(",")
			.map((name) => name.trim())
			.filter(Boolean);
	}, [weeklyTotw?.playerLookups]);

	return (
		<div className='h-full flex flex-col p-4 md:p-6 space-y-6 text-white'>
			<header className='space-y-2 text-center'>
				<p className='text-xs uppercase tracking-[0.35em] text-gray-400'>Team of the Week</p>
				<h2 className='text-3xl md:text-4xl font-black'>{weeklyTotw ? `Week ${weeklyTotw.week}` : "Loading..."}</h2>
				<p className='text-sm text-gray-300'>
					{weeklyTotw ? `${weeklyTotw.season} • ${formatDate(weeklyTotw.dateLookup)}` : "Gathering weekly selections"}
				</p>
			</header>

			{isLoading && (
				<div className='space-y-4'>
					<div className='animate-pulse h-24 rounded-2xl bg-white/5 border border-white/10' />
					<div className='animate-pulse h-48 rounded-2xl bg-white/5 border border-white/10' />
					<div className='animate-pulse h-32 rounded-2xl bg-white/5 border border-white/10' />
				</div>
			)}

			{!isLoading && error && (
				<div className='p-4 border border-red-500/40 rounded-2xl bg-red-500/10 text-sm text-red-100'>
					<p>{error}</p>
					<p className='text-xs text-red-200 mt-1'>Please try refreshing the page.</p>
				</div>
			)}

			{!isLoading && weeklyTotw && (
				<>
					<section className='rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6 space-y-4'>
						<div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
							<div>
								<p className='text-sm text-gray-400 uppercase tracking-[0.4em]'>Selected XI</p>
								<p className='text-lg font-semibold text-white'>{weeklyTotw.playerCount ?? selectedPlayers.length} players recognised</p>
							</div>
							{weeklyTotw.bestFormation && (
								<div className='px-4 py-2 rounded-full bg-dorkinians-yellow/20 text-dorkinians-yellow text-sm font-semibold tracking-widest'>
									{weeklyTotw.bestFormation}
								</div>
							)}
						</div>
						<div className='grid gap-4 md:grid-cols-3'>
							{lineupGroups.map((group) => (
								<div key={group.title} className='rounded-xl bg-black/30 border border-white/5 p-3'>
									<p className='text-xs uppercase tracking-[0.4em] text-gray-400 mb-2'>{group.title}</p>
									<ul className='space-y-1'>
										{group.players.map((player) => (
											<li key={`${group.title}-${player}`} className='text-sm font-medium text-white/90'>
												{player}
											</li>
										))}
									</ul>
								</div>
							))}
						</div>
					</section>

					{selectedPlayers.length > 0 && (
						<section className='rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-4 md:p-6'>
							<p className='text-xs uppercase tracking-[0.4em] text-gray-400 mb-3'>Squad Roll Call</p>
							<div className='flex flex-wrap gap-2'>
								{selectedPlayers.map((player) => (
									<span key={player} className='px-3 py-1 rounded-full text-xs font-semibold bg-black/40 border border-white/10'>
										{player}
									</span>
								))}
							</div>
						</section>
					)}

					{summaryReady && (
						<section className='grid gap-4 md:grid-cols-2'>
							<article className='rounded-2xl border border-white/10 bg-dorkinians-green/20 p-4 md:p-6'>
								<p className='text-xs uppercase tracking-[0.6em] text-white/80'>TOTW TOTAL POINTS</p>
								<p className='text-4xl font-black mt-3'>
									{weeklyTotw.totwScore ? Number(weeklyTotw.totwScore).toFixed(1) : "—"}
								</p>
								<p className='text-sm text-white/80 mt-2'>
									Aggregate score across {weeklyTotw.playerCount ?? selectedPlayers.length} selections
								</p>
							</article>

							<article className='rounded-2xl border border-white/10 bg-dorkinians-yellow/15 p-4 md:p-6'>
								<p className='text-xs uppercase tracking-[0.6em] text-white/80'>STAR MAN</p>
								<p className='text-2xl font-bold text-white mt-3'>{weeklyTotw.starMan || "TBC"}</p>
								<p className='text-sm text-white/80 mt-1'>
									Performance rating: {weeklyTotw.starManScore ? Number(weeklyTotw.starManScore).toFixed(1) : "—"}
								</p>
							</article>
						</section>
					)}

					{seasonalTotw.length > 0 && (
						<section className='rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6'>
							<p className='text-xs uppercase tracking-[0.4em] text-gray-400 mb-3'>Recent season highlights</p>
							<div className='grid gap-3 md:grid-cols-3'>
								{seasonalTotw.map((entry) => (
									<div key={`${entry.season}-${entry.month}`} className='rounded-xl bg-black/30 border border-white/5 p-3'>
										<p className='text-sm font-semibold text-white'>{entry.month}</p>
										<p className='text-xs text-gray-400 mb-2'>{entry.season}</p>
										<p className='text-base font-bold text-white'>{entry.starMan ?? entry.playerLookups ?? "TBC"}</p>
										<p className='text-xs text-gray-400 mt-1'>Score: {entry.totwScore ?? "—"}</p>
									</div>
								))}
							</div>
						</section>
					)}
				</>
			)}
		</div>
	);
}
