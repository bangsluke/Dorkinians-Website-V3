"use client";

import { useEffect, useState } from "react";
import { useNavigationStore } from "@/lib/stores/navigation";
import { cachedFetch, generatePageCacheKey } from "@/lib/utils/pageCache";
import { UmamiEvents } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/utils/trackEvent";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export interface ClubRecordDTO {
	id: string;
	category: string;
	recordName: string;
	recordValue: number;
	recordValueDisplay: string | null;
	holderName: string | null;
	holderTeam: string | null;
	season: string | null;
	additionalContext: string | null;
	currentChallenger: string | null;
	challengerValue: number | null;
}

function RecordRow({ rec, onPlayerClick }: { rec: ClubRecordDTO; onPlayerClick: (name: string) => void }) {
	const hasChallenger = rec.currentChallenger && rec.challengerValue != null;
	const displayValue = rec.recordValueDisplay ?? String(rec.recordValue);

	return (
		<div
			className={`rounded-lg px-3 py-2.5 md:px-4 md:py-3 bg-white/5 ${hasChallenger ? "border border-[rgba(232,197,71,0.35)]" : "border border-transparent"}`}>
			<div className='flex flex-row items-start justify-between gap-3'>
				<div className='flex-1 min-w-0'>
					<p className='text-white text-xs md:text-sm font-medium'>{rec.recordName}</p>
					{rec.season ? <p className='text-white/50 text-[10px] md:text-xs mt-0.5'>{rec.season}</p> : null}
					{rec.additionalContext ? (
						<p className='text-white/55 text-[10px] md:text-xs mt-0.5'>{rec.additionalContext}</p>
					) : null}
				</div>
				<div className='flex flex-col items-end text-right shrink-0'>
					{rec.holderName ? (
						<button
							type='button'
							data-testid={`record-holder-${rec.id}`}
							onClick={() => onPlayerClick(rec.holderName!)}
							className='text-[#E8C547] text-xs md:text-sm font-medium hover:underline text-right'>
							{rec.holderName}
						</button>
					) : rec.holderTeam ? (
						<span className='text-white/90 text-xs md:text-sm font-medium'>{rec.holderTeam}</span>
					) : (
						<span className='text-white/50 text-xs'>—</span>
					)}
					{rec.holderTeam && rec.holderName ? (
						<span className='text-white/45 text-[10px] md:text-xs mt-0.5'>{rec.holderTeam}</span>
					) : null}
					<p className='text-white font-bold text-sm md:text-base mt-1'>{displayValue}</p>
				</div>
			</div>
			{hasChallenger ? (
				<p className='text-[#E8C547]/90 text-[10px] md:text-xs mt-2'>
					⚠ Under threat — {rec.currentChallenger} on {rec.challengerValue}
				</p>
			) : null}
		</div>
	);
}

export default function RecordsSection() {
	const { getCachedPageData, setCachedPageData } = useNavigationStore();
	const [records, setRecords] = useState<ClubRecordDTO[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const selectPlayer = useNavigationStore((s) => s.selectPlayer);
	const setMainPage = useNavigationStore((s) => s.setMainPage);
	const setStatsSubPage = useNavigationStore((s) => s.setStatsSubPage);

	const goToPlayerStats = (playerName: string) => {
		trackEvent(UmamiEvents.PlayerSelected, { source: "club-records", playerName });
		selectPlayer(playerName, "picker");
		setStatsSubPage("player-stats");
		setMainPage("stats");
	};

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const cacheKey = generatePageCacheKey("club-info", "club-awards", "club-records", {});
				const data = await cachedFetch("/api/club-records", {
					method: "GET",
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				if (cancelled) return;
				setRecords(Array.isArray(data.records) ? data.records : []);
			} catch (e) {
				if (!cancelled) {
					setError("Could not load records");
					setRecords([]);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [getCachedPageData, setCachedPageData]);

	const individual = records.filter((r) => r.category === "individual");
	const team = records.filter((r) => r.category === "team");

	if (loading) {
		return (
			<div data-testid='records-section' className='flex-shrink-0 px-2 md:px-4 pb-6 md:max-w-2xl md:mx-auto w-full mt-0 lg:mt-0'>
				<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-4'>Records</h3>
				<SkeletonTheme baseColor='var(--skeleton-base)' highlightColor='var(--skeleton-highlight)'>
					<Skeleton count={4} className='rounded-lg mb-2' height={56} />
				</SkeletonTheme>
			</div>
		);
	}

	if (error) {
		return (
			<div data-testid='records-section' className='flex-shrink-0 px-2 md:px-4 pb-6 md:max-w-2xl md:mx-auto w-full mt-0 lg:mt-0'>
				<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-4'>Records</h3>
				<p className='text-white/60 text-xs md:text-sm'>{error}</p>
			</div>
		);
	}

	if (records.length === 0) {
		return (
			<div data-testid='records-section' className='flex-shrink-0 px-2 md:px-4 pb-6 md:max-w-2xl md:mx-auto w-full mt-0 lg:mt-0'>
				<h3 className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-4'>Records</h3>
				<p className='text-white/60 text-xs md:text-sm'>
					No club records are stored yet. Run a full seed in database-dorkinians so ClubRecord nodes are built.
				</p>
			</div>
		);
	}

	return (
		<div data-testid='records-section' className='flex-shrink-0 px-2 md:px-4 pb-6 md:max-w-2xl md:mx-auto w-full mt-0 pt-0'>
			<h3 id='club-records-heading' className='text-lg md:text-xl font-bold text-dorkinians-yellow mb-4'>
				Records
			</h3>

			{individual.length > 0 ? (
				<div className='mb-6'>
					<h4 className='text-dorkinians-yellow/90 text-xs md:text-sm font-semibold mb-3'>Individual records</h4>
					<div className='space-y-2'>
						{individual.map((rec) => (
							<RecordRow key={rec.id} rec={rec} onPlayerClick={goToPlayerStats} />
						))}
					</div>
				</div>
			) : null}

			{team.length > 0 ? (
				<div>
					<h4 className='text-dorkinians-yellow/90 text-xs md:text-sm font-semibold mb-3'>Team records</h4>
					<div className='space-y-2'>
						{team.map((rec) => (
							<RecordRow key={rec.id} rec={rec} onPlayerClick={goToPlayerStats} />
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}
