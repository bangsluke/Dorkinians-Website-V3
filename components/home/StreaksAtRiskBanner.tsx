"use client";

import { useEffect, useState } from "react";

type Upcoming = {
	team: string;
	matchDate: string;
	opposition: string;
	homeOrAway: string;
};

type Highlight = {
	playerName: string;
	currentScoringStreak: number;
	currentWinStreak: number;
	currentAppearanceStreak: number;
	currentGoalInvolvementStreak: number;
};

function streakBits(h: Highlight): string[] {
	const bits: string[] = [];
	if (h.currentScoringStreak >= 2) bits.push(`${h.currentScoringStreak} scoring`);
	if (h.currentWinStreak >= 2) bits.push(`${h.currentWinStreak} win`);
	if (h.currentAppearanceStreak >= 3) bits.push(`${h.currentAppearanceStreak} app`);
	if (h.currentGoalInvolvementStreak >= 2) bits.push(`${h.currentGoalInvolvementStreak} G+A`);
	return bits;
}

/**
 * Homepage callout when the next XI has a fixture soon and squad members carry notable active streaks.
 */
export default function StreaksAtRiskBanner() {
	const [upcoming, setUpcoming] = useState<Upcoming | null>(null);
	const [highlights, setHighlights] = useState<Highlight[]>([]);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("/api/club-streaks-preview", { cache: "no-store" });
				const data = (await res.json()) as {
					upcoming?: Upcoming | null;
					highlights?: Highlight[];
				};
				if (cancelled) return;
				setUpcoming(data.upcoming ?? null);
				setHighlights(Array.isArray(data.highlights) ? data.highlights : []);
			} catch {
				if (!cancelled) {
					setUpcoming(null);
					setHighlights([]);
				}
			} finally {
				if (!cancelled) setLoaded(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	if (!loaded || !upcoming || highlights.length === 0) {
		return null;
	}

	const venue =
		upcoming.homeOrAway.toLowerCase() === "home" ? "vs" : upcoming.homeOrAway.toLowerCase() === "away" ? "@" : "-";

	return (
		<div
			data-testid='home-streaks-at-risk'
			className='mb-4 md:mb-6 max-w-lg mx-auto rounded-lg border border-dorkinians-yellow/40 bg-yellow-400/10 px-3 py-3 text-left text-xs md:text-sm text-white'>
			<p className='font-semibold text-dorkinians-yellow'>Streaks at risk</p>
			<p className='mt-1 text-white/90'>
				<strong>{upcoming.team}</strong> next: {venue} <strong>{upcoming.opposition || "TBC"}</strong>
				{upcoming.matchDate ? ` · ${upcoming.matchDate}` : ""}
			</p>
			<p className='mt-2 text-white/75'>Players on strong runs for that XI (active streaks):</p>
			<ul className='mt-2 space-y-1.5 list-disc list-inside text-white/90'>
				{highlights.map((h) => (
					<li key={h.playerName}>
						<span className='font-medium'>{h.playerName}</span>
						<span className='text-white/70'> - {streakBits(h).join(", ")}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
