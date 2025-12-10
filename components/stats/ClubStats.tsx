"use client";

import { useEffect, useMemo, useState } from "react";

type ClubStatKey = "players" | "games" | "wins" | "goals" | "competitions" | "cleanSheets";

interface ClubStatsData {
	players: number;
	games: number;
	wins: number;
	goals: number;
	competitions: number;
	cleanSheets: number;
}

const formatNumber = (value: number) =>
	new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);

const cardMeta: Array<{
	key: ClubStatKey;
	label: string;
	helper: string;
	accent: string;
}> = [
	{ key: "players", label: "Players", helper: "Eligible squad members", accent: "from-dorkinians-yellow/80 to-amber-500/40" },
	{ key: "games", label: "Games", helper: "Competitive fixtures tracked", accent: "from-sky-400/80 to-indigo-500/40" },
	{ key: "wins", label: "Wins", helper: "Club victories recorded", accent: "from-emerald-400/80 to-green-500/40" },
	{ key: "goals", label: "Goals", helper: "Goals scored by the club", accent: "from-rose-400/80 to-pink-500/40" },
	{ key: "competitions", label: "Competitions", helper: "Tournaments participated in", accent: "from-violet-400/80 to-purple-500/40" },
	{ key: "cleanSheets", label: "Clean Sheets", helper: "Matches without conceding", accent: "from-cyan-400/80 to-blue-500/40" },
];

export default function ClubStats() {
	const [stats, setStats] = useState<ClubStatsData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;
		const controller = new AbortController();

		const fetchStats = async () => {
			try {
				setIsLoading(true);
				const response = await fetch("/api/club-stats", { signal: controller.signal });
				if (!response.ok) {
					throw new Error("Failed to fetch club stats");
				}
				const data = await response.json();
				if (isMounted) {
					setStats(data.stats);
					setError(null);
				}
			} catch (err) {
				if (!controller.signal.aborted && isMounted) {
					console.error("Failed to load club stats", err);
					setError("Unable to load club statistics right now.");
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		};

		fetchStats();
		return () => {
			isMounted = false;
			controller.abort();
		};
	}, []);

	const kpiCards = useMemo(() => {
		const appliedStats = stats ?? {
			players: 0,
			games: 0,
			wins: 0,
			goals: 0,
			competitions: 0,
			cleanSheets: 0,
		};

		return cardMeta.map((meta) => ({
			...meta,
			value: formatNumber(appliedStats[meta.key]),
		}));
	}, [stats]);

	const renderContent = () => {
		if (isLoading) {
			return (
				<div className='col-span-full text-center py-6 text-gray-300 text-sm'>
					Loading Key Performance Stats...
				</div>
			);
		}

		if (error) {
			return (
				<div className='col-span-full text-center py-6 text-red-300 text-sm'>
					{error}
				</div>
			);
		}

		return kpiCards.map((card) => (
			<div
				key={card.key}
				className={`rounded-2xl border border-white/10 bg-gradient-to-br ${card.accent} p-4 shadow-lg shadow-black/30`}
			>
				<p className='text-xs uppercase tracking-widest text-white/70'>{card.helper}</p>
				<p className='mt-3 text-4xl font-black text-white'>{card.value}</p>
				<p className='mt-2 text-sm text-white/80'>{card.label}</p>
			</div>
		));
	};

	return (
		<div className='p-4 md:p-6 space-y-8'>
			<div className='text-center space-y-2'>
				<h2 className='text-3xl font-bold text-white'>Club Stats</h2>
				<p className='text-sm text-gray-300'>Live overview of the club&apos;s performance footprint.</p>
			</div>

			<section className='rounded-3xl border border-white/10 bg-white/5 p-4 md:p-6 backdrop-blur'>
				<div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6'>
					<div>
						<p className='text-xs uppercase tracking-[0.3em] text-gray-300'>Key Performance Stats</p>
						<h3 className='text-xl font-semibold text-white'>Season-at-a-glance</h3>
					</div>
					<span className='text-xs text-gray-400'>Updated automatically when new data syncs</span>
				</div>

				<div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'>
					{renderContent()}
				</div>
			</section>

			<div className='rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/80'>
				<p>More detailed club-wide insights will appear here soon.</p>
			</div>
		</div>
	);
}
