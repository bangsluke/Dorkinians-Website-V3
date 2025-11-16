"use client";

import { useNavigationStore, type PlayerData } from "@/lib/stores/navigation";
import { statObject, statsPageConfig } from "@/config/config";
import Image from "next/image";
import { useState, useMemo } from "react";
import { PencilIcon } from "@heroicons/react/24/outline";

function StatRow({ stat, value, playerData }: { stat: any; value: any; playerData: PlayerData }) {
	const [showTooltip, setShowTooltip] = useState(false);

	return (
		<>
			<tr
				className='border-b border-white/10 hover:bg-white/5 transition-colors relative group cursor-help'
				onMouseEnter={() => setShowTooltip(true)}
				onMouseLeave={() => setShowTooltip(false)}
				onTouchStart={() => setShowTooltip(!showTooltip)}>
				<td className='px-2 md:px-4 py-2 md:py-3'>
					<div className='flex items-center justify-center w-6 h-6 md:w-8 md:h-8'>
						<Image
							src={`/stat-icons/${stat.iconName}.webp`}
							alt={stat.displayText}
							width={24}
							height={24}
							className='w-6 h-6 md:w-8 md:h-8 object-contain brightness-0 invert'
						/>
					</div>
				</td>
				<td className='px-2 md:px-4 py-2 md:py-3'>
					<span className='text-white font-medium text-xs md:text-sm'>{stat.displayText}</span>
				</td>
				<td className='px-2 md:px-4 py-2 md:py-3 text-right'>
					<span className='text-white font-mono text-xs md:text-sm'>
						{formatStatValue(value, stat.statFormat, stat.numberDecimalPlaces, (stat as any).statUnit)}
					</span>
				</td>
			</tr>
			{showTooltip && (
				<div className='fixed z-20 px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg w-64 text-center pointer-events-none'>
					{stat.description}
					<div className='absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800'></div>
				</div>
			)}
		</>
	);
}

function formatStatValue(value: any, statFormat: string, decimalPlaces: number, statUnit?: string): string {
	if (value === null || value === undefined) return "N/A";

	// Helper to convert Neo4j Integer objects or any value to a number
	const toNumber = (val: any): number => {
		if (val === null || val === undefined) return 0;
		if (typeof val === "number") {
			if (isNaN(val)) return 0;
			return val;
		}
		// Handle Neo4j Integer objects
		if (typeof val === "object") {
			if ("toNumber" in val && typeof val.toNumber === "function") {
				return val.toNumber();
			}
			if ("low" in val && "high" in val) {
				// Neo4j Integer format: low + high * 2^32
				const low = val.low || 0;
				const high = val.high || 0;
				return low + high * 4294967296;
			}
		}
		const num = Number(val);
		return isNaN(num) ? 0 : num;
	};

	const numValue = toNumber(value);

	let formattedValue: string;
	switch (statFormat) {
		case "Integer":
			formattedValue = Math.round(numValue).toString();
			break;
		case "Decimal1":
			formattedValue = numValue.toFixed(1);
			break;
		case "Decimal2":
			formattedValue = numValue.toFixed(decimalPlaces);
			break;
		case "Percentage":
			formattedValue = `${Math.round(numValue)}%`;
			break;
		case "String":
			formattedValue = String(value);
			break;
		default:
			formattedValue = String(value);
	}

	return statUnit ? `${formattedValue} ${statUnit}` : formattedValue;
}

export default function PlayerStats() {
	const { selectedPlayer, cachedPlayerData, isLoadingPlayerData, enterEditMode, setMainPage, currentStatsSubPage } = useNavigationStore();

	// Get stats to display for current page
	const statsToDisplay = useMemo(() => {
		return statsPageConfig[currentStatsSubPage]?.statsToDisplay || [];
	}, [currentStatsSubPage]);

	// Filter statObject entries to only include stats in statsToDisplay
	const filteredStatEntries = useMemo(() => {
		return Object.entries(statObject).filter(([key]) => statsToDisplay.includes(key));
	}, [statsToDisplay]);

	// Component state

	const handleEditClick = () => {
		enterEditMode();
		setMainPage("home");
	};

	// Early returns after all hooks to avoid Rules of Hooks violations
	if (!selectedPlayer) {
		return (
			<div className='h-full flex items-center justify-center p-4'>
				<div className='text-center'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-2 md:mb-4'>Player Stats</h2>
					<p className='text-white text-sm md:text-base mb-4'>Select a player to display data here</p>
					<button
						onClick={handleEditClick}
						className='flex items-center justify-center mx-auto w-8 h-8 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors'
						title='Select a player'>
						<PencilIcon className='h-4 w-4 md:h-5 md:w-5' />
					</button>
				</div>
			</div>
		);
	}

	if (isLoadingPlayerData) {
		return (
			<div className='h-full flex items-center justify-center p-4'>
				<div className='text-center'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-2 md:mb-4'>Player Stats</h2>
					<p className='text-white text-sm md:text-base'>Loading player data...</p>
				</div>
			</div>
		);
	}

	if (!cachedPlayerData) {
		return (
			<div className='h-full flex items-center justify-center p-4'>
				<div className='text-center'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-2 md:mb-4'>Player Stats</h2>
					<p className='text-white text-sm md:text-base'>No player data available. Please try selecting the player again.</p>
				</div>
			</div>
		);
	}

	const playerData: PlayerData = cachedPlayerData.playerData;

	return (
		<div className='h-full flex flex-col'>
			<div className='flex-shrink-0 p-2 md:p-4'>
				<div className='flex items-center justify-center mb-2 md:mb-4 relative'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow text-center'>Player Stats - {selectedPlayer}</h2>
					<button
						onClick={handleEditClick}
						className='absolute right-0 flex items-center justify-center w-8 h-8 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors'
						title='Edit player selection'>
						<PencilIcon className='h-4 w-4 md:h-5 md:w-5' />
					</button>
				</div>
			</div>

			<div className='flex-1 overflow-y-auto px-2 md:px-4 pb-4'>
				<div className='overflow-x-auto'>
					<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
						<thead className='sticky top-0 z-10'>
							<tr className='bg-white/20'>
								<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Icon</th>
								<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Stat</th>
								<th className='px-2 md:px-4 py-2 md:py-3 text-right text-white font-semibold text-xs md:text-sm'>Value</th>
							</tr>
						</thead>
						<tbody>
							{filteredStatEntries.map(([key, stat]) => {
								const value = playerData[stat.statName as keyof PlayerData];
								return <StatRow key={key} stat={stat} value={value} playerData={playerData} />;
							})}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
