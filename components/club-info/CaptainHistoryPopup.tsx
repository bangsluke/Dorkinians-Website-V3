"use client";

import { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { HistoryPopupSkeleton } from "@/components/skeletons";

interface CaptainHistory {
	season: string;
	team: string;
}

interface CaptainHistoryPopupProps {
	playerName: string;
	onClose: () => void;
}

export default function CaptainHistoryPopup({ playerName, onClose }: CaptainHistoryPopupProps) {
	const [history, setHistory] = useState<CaptainHistory[]>([]);
	const [totalCaptaincies, setTotalCaptaincies] = useState<number>(0);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchHistory = async () => {
			setLoading(true);
			try {
				const response = await fetch(`/api/captains/player-history?playerName=${encodeURIComponent(playerName)}`);
				if (!response.ok) {
					throw new Error("Failed to fetch captain history");
				}
				const data = await response.json();
				setHistory(data.captaincies || []);
				setTotalCaptaincies(data.totalCaptaincies || 0);
			} catch (error) {
				console.error("Error fetching captain history:", error);
				setHistory([]);
				setTotalCaptaincies(0);
			} finally {
				setLoading(false);
			}
		};

		fetchHistory();
	}, [playerName]);

	return (
		<div
			className='fixed inset-0 z-50'
			style={{ backgroundColor: "rgba(15, 15, 15, 0.5)" }}
			onClick={onClose}
		>
			<div
				className='fixed inset-0 flex flex-col'
				style={{ backgroundColor: "rgb(14, 17, 15)" }}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header - Fixed at top */}
				<div className='flex-shrink-0 flex justify-between items-center p-4 border-b border-white/20'>
					<h2 className='text-2xl font-bold text-white uppercase flex-1 text-center'>{playerName}</h2>
					<button onClick={onClose} className='text-white hover:text-gray-200 ml-4 flex-shrink-0' aria-label={`Close ${playerName} captain history`}>
						<XMarkIcon className='h-6 w-6' />
					</button>
				</div>

				{/* Summary Count - Fixed */}
				<div className='flex-shrink-0 text-center mb-4 pt-4'>
					<p className='text-white text-lg md:text-xl font-bold'>
						Total Captaincies: <span className='text-dorkinians-yellow'>{totalCaptaincies}</span>
					</p>
				</div>

				{/* Scrollable content */}
				<div
					className='flex-1 overflow-y-auto min-h-0 px-6 pt-4'
					style={{
						WebkitOverflowScrolling: "touch",
					}}
				>
					{/* Loading State */}
					{loading && (
						<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
							<HistoryPopupSkeleton />
						</SkeletonTheme>
					)}

					{/* Captain History List */}
					{!loading && history.length > 0 && (
						<div className='overflow-x-auto'>
							<table className='w-full text-white'>
								<thead>
									<tr className='border-b-2 border-dorkinians-yellow'>
										<th className='text-left py-2 px-2 text-xs md:text-sm'>Season</th>
										<th className='text-left py-2 px-2 text-xs md:text-sm'>Team</th>
									</tr>
								</thead>
								<tbody>
									{history.map((item, index) => (
										<tr key={index} className='border-b border-green-500'>
											<td className='py-2 px-2 text-xs md:text-sm'>{item.season}</td>
											<td className='py-2 px-2 text-xs md:text-sm'>{item.team}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					{/* No History Message */}
					{!loading && history.length === 0 && (
						<div className='text-center'>
							<p className='text-white text-sm md:text-base'>No captain history found for this player.</p>
						</div>
					)}
				</div>

				{/* Close Button at Bottom */}
				<div className='flex-shrink-0 flex justify-center p-4 border-t border-white/20'>
					<button
						onClick={onClose}
						className='px-5 py-2 bg-dorkinians-yellow text-black text-sm font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors'>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}
