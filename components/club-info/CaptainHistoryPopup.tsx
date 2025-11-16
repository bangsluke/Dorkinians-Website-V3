"use client";

import { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

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
			className='fixed inset-0 flex items-center justify-center z-50 p-2'
			style={{ backgroundColor: "rgba(15, 15, 15, 0.5)", height: "90vh", maxHeight: "100vh" }}
			onClick={onClose}
		>
			<div
				className='rounded-lg pt-16 pb-8 px-6 max-w-2xl w-full h-[95vh] flex flex-col'
				style={{ backgroundColor: "#0f0f0f" }}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Scrollable content */}
				<div
					className='flex-1 overflow-y-auto min-h-0'
					style={{
						WebkitOverflowScrolling: "touch",
						paddingTop: "1rem",
						paddingBottom: "1rem",
					}}
				>
					{/* Player Name with Close button */}
					<div className='flex justify-between items-center mb-4'>
						<h2 className='text-2xl font-bold text-white uppercase flex-1 text-center'>{playerName}</h2>
						<button onClick={onClose} className='text-white hover:text-gray-200 ml-4 flex-shrink-0'>
							<XMarkIcon className='h-6 w-6' />
						</button>
					</div>

					{/* Summary Count */}
					<div className='text-center mb-6'>
						<p className='text-white text-lg md:text-xl font-bold'>
							Total Captaincies: <span className='text-dorkinians-yellow'>{totalCaptaincies}</span>
						</p>
					</div>

					{/* Loading State */}
					{loading && (
						<div className='text-center'>
							<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-gray-300 mx-auto'></div>
							<p className='text-white mt-4'>Loading captain history...</p>
						</div>
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
			</div>
		</div>
	);
}

