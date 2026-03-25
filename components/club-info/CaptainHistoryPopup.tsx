"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { HistoryPopupSkeleton } from "@/components/skeletons";
import ModalWrapper from "@/components/modals/ModalWrapper";

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

	if (typeof window === "undefined") {
		return null;
	}

	const modalContent = (
		<ModalWrapper
			isOpen
			onClose={onClose}
			backdropClassName="fixed inset-0 bg-black/50 z-[9999]"
			modalClassName="fixed inset-0 h-screen w-screen z-[10000] shadow-xl"
			ariaLabel={`${playerName} captain history`}>
			<div className="h-full flex flex-col" style={{ backgroundColor: "#0f0f0f" }}>
				{/* Header */}
				<div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-white/20">
					<div className="w-11 min-w-[44px] flex-shrink-0" aria-hidden />
					<h2 className="text-2xl font-bold text-white uppercase flex-1 text-center px-2">{playerName}</h2>
					<button
						type="button"
						onClick={onClose}
						className="min-w-[44px] min-h-[44px] p-2 rounded-full hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent flex-shrink-0"
						aria-label={`Close ${playerName} captain history`}>
						<XMarkIcon className="w-6 h-6 text-white" />
					</button>
				</div>

				{/* Summary Count */}
				<div className="flex-shrink-0 text-center mb-4 pt-4">
					<p className="text-white text-lg md:text-xl font-bold">
						Total Captaincies: <span className="text-dorkinians-yellow">{totalCaptaincies}</span>
					</p>
				</div>

				{/* Scrollable content */}
				<div
					className="flex-1 overflow-y-auto min-h-0 px-6 pt-4"
					style={{
						WebkitOverflowScrolling: "touch",
					}}>
					{loading && (
						<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
							<HistoryPopupSkeleton />
						</SkeletonTheme>
					)}

					{!loading && history.length > 0 && (
						<div className="overflow-x-auto">
							<table className="w-full text-white">
								<thead>
									<tr className="border-b-2 border-dorkinians-yellow">
										<th className="text-left py-2 px-2 text-xs md:text-sm">Season</th>
										<th className="text-left py-2 px-2 text-xs md:text-sm">Team</th>
									</tr>
								</thead>
								<tbody>
									{history.map((item, index) => (
										<tr key={index} className="border-b border-green-500">
											<td className="py-2 px-2 text-xs md:text-sm">{item.season}</td>
											<td className="py-2 px-2 text-xs md:text-sm">{item.team}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					{!loading && history.length === 0 && (
						<div className="text-center">
							<p className="text-white text-sm md:text-base">No captain history found for this player.</p>
						</div>
					)}
				</div>

				<div className="flex-shrink-0 flex justify-center p-4 border-t border-white/20">
					<button
						type="button"
						onClick={onClose}
						className="px-5 py-2 bg-dorkinians-yellow text-black text-sm font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent">
						Close
					</button>
				</div>
			</div>
		</ModalWrapper>
	);

	return createPortal(modalContent, document.body);
}
