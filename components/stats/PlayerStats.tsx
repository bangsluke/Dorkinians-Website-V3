"use client";

import { useNavigationStore, type PlayerData } from "@/lib/stores/navigation";
import { statObject, statsPageConfig } from "@/config/config";
import Image from "next/image";
import { useState, useMemo, useRef, useEffect } from "react";
import { PencilIcon } from "@heroicons/react/24/outline";
import FilterPills from "@/components/filters/FilterPills";
import Tabs from "@/components/ui/Tabs";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

function StatRow({ stat, value, playerData }: { stat: any; value: any; playerData: PlayerData }) {
	const [showTooltip, setShowTooltip] = useState(false);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	const handleMouseEnter = () => {
		timeoutRef.current = setTimeout(() => {
			setShowTooltip(true);
		}, 1000);
	};

	const handleMouseLeave = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setShowTooltip(false);
	};

	const handleTouchStart = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		timeoutRef.current = setTimeout(() => {
			setShowTooltip(true);
		}, 1000);
	};

	const handleTouchEnd = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setShowTooltip(false);
	};

	return (
		<>
			<tr
				className='border-b border-white/10 hover:bg-white/5 transition-colors relative group cursor-help'
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}>
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
				<div className='fixed z-20 px-3 py-2 text-sm text-white rounded-lg shadow-lg w-64 text-center pointer-events-none' style={{ backgroundColor: '#0f0f0f' }}>
					<div className='absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent mb-1' style={{ borderBottomColor: '#0f0f0f' }}></div>
					{stat.description}
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

// Helper to convert PlayerData values to numbers
function toNumber(val: any): number {
	if (val === null || val === undefined) return 0;
	if (typeof val === "number") {
		if (isNaN(val)) return 0;
		return val;
	}
	if (typeof val === "object") {
		if ("toNumber" in val && typeof val.toNumber === "function") {
			return val.toNumber();
		}
		if ("low" in val && "high" in val) {
			const low = val.low || 0;
			const high = val.high || 0;
			return low + high * 4294967296;
		}
	}
	const num = Number(val);
	return isNaN(num) ? 0 : num;
}

// Penalty Stats Visualization Component
function PenaltyStatsVisualization({ scored, missed, saved, conceded }: { scored: number; missed: number; saved: number; conceded: number }) {
	// Calculate sizes (max size 120px, min size 30px) - increased by 50%
	const maxValue = Math.max(scored, missed, saved, conceded, 1);
	const scoredSize = Math.max(30, Math.min(120, (scored / maxValue) * 120));
	const missedSize = Math.max(30, Math.min(120, (missed / maxValue) * 120));
	const savedSize = Math.max(30, Math.min(120, (saved / maxValue) * 120)); // Same scaling as scored
	const concededWidth = Math.max(30, Math.min(150, (conceded / maxValue) * 150));
	const concededHeight = Math.max(22.5, Math.min(60, (conceded / maxValue) * 60));
	
	// Goal dimensions
	const goalWidth = 200;
	const goalHeight = 120;
	const goalX = 150;
	const goalY = 50;
	
	// Center positions
	const goalCenterX = goalX + goalWidth / 2;
	const goalCenterY = goalY + goalHeight / 2;
	
	// Penalty box dimensions (semi-circle in front of goal)
	const penaltyBoxRadius = 60;
	const penaltyBoxCenterY = goalY + goalHeight;
	
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Penalty Stats</h3>
			<div className='w-full relative' style={{ height: '250px', overflow: 'hidden' }}>
				{/* Background SVG from TOTW - zoomed 3.5x, showing top center with less vertical height, trimmed more from bottom */}
				<div className='absolute inset-0 w-full' style={{ top: '30px', bottom: '40px' }}>
					<Image
						src='/totw-images/TOTWBackground.svg'
						alt='Football Pitch'
						fill
						className='object-cover w-full h-full'
						style={{ 
							objectPosition: 'center top',
							transform: 'scale(4)',
							transformOrigin: 'center top'
						}}
						priority
					/>
				</div>
				
				<svg width='100%' height='300' viewBox='0 0 500 300' preserveAspectRatio='xMidYMid meet' className='relative z-10'>
					
					{/* Green circle - Scored (left side of center line, moved up more and separated further) */}
					{scored > 0 && (
						<g>
							{/* Larger invisible hit area */}
							<circle
								cx={goalCenterX - 70}
								cy={goalCenterY - 100}
								r={scoredSize / 2 + 15}
								fill='transparent'
								cursor='pointer'
							/>
							<circle
								cx={goalCenterX - 70}
								cy={goalCenterY - 100}
								r={scoredSize / 2}
								fill='#22c55e'
								cursor='pointer'
								style={{ transition: 'opacity 0.2s', opacity: '0.8' }}
								onMouseOver={(e) => {
									e.currentTarget.style.opacity = '1';
								}}
								onMouseOut={(e) => {
									e.currentTarget.style.opacity = '0.8';
								}}
							/>
							<text
								x={goalCenterX - 70}
								y={goalCenterY - 100}
								textAnchor='middle'
								dominantBaseline='middle'
								fill='#ffffff'
								fontSize='24'
								fontWeight='bold'
								pointerEvents='none'
							>
								{scored}
							</text>
						</g>
					)}
					
					{/* Blue circle - Saved (right side of center line, moved up more and separated further) */}
					{saved > 0 && (
						<g>
							{/* Larger invisible hit area */}
							<circle
								cx={goalCenterX + 70}
								cy={goalCenterY - 100}
								r={savedSize / 2 + 15}
								fill='transparent'
								cursor='pointer'
							/>
							<circle
								cx={goalCenterX + 70}
								cy={goalCenterY - 100}
								r={savedSize / 2}
								fill='#60a5fa'
								cursor='pointer'
								style={{ transition: 'opacity 0.2s', opacity: '0.8' }}
								onMouseOver={(e) => {
									e.currentTarget.style.opacity = '1';
								}}
								onMouseOut={(e) => {
									e.currentTarget.style.opacity = '0.8';
								}}
							/>
							<text
								x={goalCenterX + 70}
								y={goalCenterY - 100}
								textAnchor='middle'
								dominantBaseline='middle'
								fill='#ffffff'
								fontSize='20'
								fontWeight='bold'
								pointerEvents='none'
							>
								{saved}
							</text>
						</g>
					)}
					
					{/* Red circle - Missed (wide of goal, to the right, moved up more) */}
					{missed > 0 && (
						<g>
							{/* Larger invisible hit area */}
							<circle
								cx={goalX + goalWidth + 50 + missedSize / 2 + 10}
								cy={goalCenterY - 200}
								r={missedSize / 2 + 15}
								fill='transparent'
								cursor='pointer'
							/>
							<circle
								cx={goalX + goalWidth + 50 + missedSize / 2 + 10}
								cy={goalCenterY - 200}
								r={missedSize / 2}
								fill='#ef4444'
								cursor='pointer'
								style={{ transition: 'opacity 0.2s', opacity: '0.8' }}
								onMouseOver={(e) => {
									e.currentTarget.style.opacity = '1';
								}}
								onMouseOut={(e) => {
									e.currentTarget.style.opacity = '0.8';
								}}
							/>
							<text
								x={goalX + goalWidth + 50 + missedSize / 2 + 10}
								y={goalCenterY - 200}
								textAnchor='middle'
								dominantBaseline='middle'
								fill='#ffffff'
								fontSize='24'
								fontWeight='bold'
								pointerEvents='none'
							>
								{missed}
							</text>
						</g>
					)}
					
					{/* Orange ellipse - Conceded (in front of goal, below, moved left and up more) */}
					{conceded > 0 && (
						<g>
							{/* Larger invisible hit area */}
							<ellipse
								cx={goalCenterX - 120}
								cy={goalY + goalHeight + 30 + concededHeight / 2 - 40}
								rx={concededWidth / 2 + 20}
								ry={concededHeight / 2 + 15}
								fill='transparent'
								cursor='pointer'
							/>
							<ellipse
								cx={goalCenterX - 120}
								cy={goalY + goalHeight + 30 + concededHeight / 2 - 40}
								rx={concededWidth / 2}
								ry={concededHeight / 2}
								fill='#f97316'
								cursor='pointer'
								style={{ transition: 'opacity 0.2s', opacity: '0.8' }}
								onMouseOver={(e) => {
									e.currentTarget.style.opacity = '1';
								}}
								onMouseOut={(e) => {
									e.currentTarget.style.opacity = '0.8';
								}}
							/>
							<text
								x={goalCenterX - 120}
								y={goalY + goalHeight + 30 + concededHeight / 2 - 40}
								textAnchor='middle'
								dominantBaseline='middle'
								fill='#ffffff'
								fontSize='20'
								fontWeight='bold'
								pointerEvents='none'
							>
								{conceded}
							</text>
						</g>
					)}
				</svg>
			</div>
			{/* Stats Table */}
			<div className='mt-4'>
				<table className='w-full text-white text-sm'>
					<thead>
						<tr className='border-b border-white/20'>
							<th className='text-left py-2 px-2'>Stat</th>
							<th className='text-right py-2 px-2'>Value</th>
						</tr>
					</thead>
					<tbody>
						<tr className='border-b border-white/10'>
							<td className='py-2 px-2'>
								<span className='inline-block w-3 h-3 rounded-full bg-green-500 mr-2'></span>
								Penalties Scored
							</td>
							<td className='text-right py-2 px-2 font-mono'>{scored}</td>
						</tr>
						<tr className='border-b border-white/10'>
							<td className='py-2 px-2'>
								<span className='inline-block w-3 h-3 rounded-full bg-red-500 mr-2'></span>
								Penalties Missed
							</td>
							<td className='text-right py-2 px-2 font-mono'>{missed}</td>
						</tr>
						<tr className='border-b border-white/10'>
							<td className='py-2 px-2'>
								<span className='inline-block w-3 h-3 rounded-full bg-blue-500 mr-2'></span>
								Penalties Saved
							</td>
							<td className='text-right py-2 px-2 font-mono'>{saved}</td>
						</tr>
						<tr>
							<td className='py-2 px-2'>
								<span className='inline-block w-3 h-3 rounded-full bg-orange-500 mr-2'></span>
								Penalties Conceded
							</td>
							<td className='text-right py-2 px-2 font-mono'>{conceded}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default function PlayerStats() {
	const { selectedPlayer, cachedPlayerData, isLoadingPlayerData, enterEditMode, setMainPage, currentStatsSubPage, playerFilters, filterData } = useNavigationStore();

	// Get stats to display for current page
	const statsToDisplay = useMemo(() => {
		return [...(statsPageConfig[currentStatsSubPage]?.statsToDisplay || [])];
	}, [currentStatsSubPage]);

	// Filter statObject entries to only include stats in statsToDisplay
	const filteredStatEntries = useMemo(() => {
		return Object.entries(statObject).filter(([key]) => statsToDisplay.includes(key as keyof typeof statObject));
	}, [statsToDisplay]);

	const playerData: PlayerData | null = cachedPlayerData?.playerData || null;

	// Prepare chart data (hooks must be called before early returns)
	const keyPerformanceData = useMemo(() => {
		if (!playerData) return [];
		return [
			{ name: "Apps", value: toNumber(playerData.appearances) },
			{ name: "Goals", value: toNumber(playerData.allGoalsScored) },
			{ name: "Assists", value: toNumber(playerData.assists) },
			{ name: "MoM", value: toNumber(playerData.mom) },
		];
	}, [playerData]);

	const cardData = useMemo(() => {
		if (!playerData) return [];
		return [
			{ name: "Yellow Cards", value: toNumber(playerData.yellowCards), color: "#f9ed32" },
			{ name: "Red Cards", value: toNumber(playerData.redCards), color: "#ef4444" },
		];
	}, [playerData]);

	const defensiveData = useMemo(() => {
		if (!playerData) return [];
		return [
			{ name: "Clean Sheets", value: toNumber(playerData.cleanSheets) },
			{ name: "Goals Conceded", value: toNumber(playerData.conceded) },
		];
	}, [playerData]);

	const penaltyData = useMemo(() => {
		if (!playerData) return [];
		return [
			{ name: "Scored", value: toNumber(playerData.penaltiesScored) },
			{ name: "Missed", value: toNumber(playerData.penaltiesMissed) },
			{ name: "Saved", value: toNumber(playerData.penaltiesSaved) },
			{ name: "Conceded", value: toNumber(playerData.penaltiesConceded) },
		];
	}, [playerData]);

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
					<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
				</div>
				<div className='flex-1 flex items-center justify-center p-4'>
					<p className='text-white text-sm md:text-base'>Loading player data...</p>
				</div>
			</div>
		);
	}

	if (!cachedPlayerData || !playerData) {
		return (
			<div className='h-full flex items-center justify-center p-4'>
				<div className='text-center'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-2 md:mb-4'>Player Stats</h2>
					<p className='text-white text-sm md:text-base'>No player data available. Please try selecting the player again.</p>
				</div>
			</div>
		);
	}

	// At this point, playerData is guaranteed to be non-null
	const validPlayerData: PlayerData = playerData;

	const tooltipStyle = {
		backgroundColor: '#1f2937',
		border: '1px solid rgba(249, 237, 50, 0.3)',
		borderRadius: '8px',
		color: '#fff',
	};

	const chartContent = (
		<div className='space-y-4 pb-4'>
			{/* Key Performance Stats Bar Chart */}
			{keyPerformanceData.some(item => item.value > 0) && (
				<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
					<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Key Performance Stats</h3>
					<ResponsiveContainer width='100%' height={300}>
						<BarChart data={keyPerformanceData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
							<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
							<XAxis dataKey='name' stroke='#fff' fontSize={12} />
							<YAxis stroke='#fff' fontSize={12} />
							<Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} />
							<Bar dataKey='value' fill='#f9ed32' radius={[4, 4, 0, 0]} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			)}

			{/* Card Stats Bar Chart */}
			{(toNumber(validPlayerData.yellowCards) > 0 || toNumber(validPlayerData.redCards) > 0) && (
				<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
					<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Card Stats</h3>
					<ResponsiveContainer width='100%' height={300}>
						<BarChart data={cardData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
							<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
							<XAxis dataKey='name' stroke='#fff' fontSize={12} />
							<YAxis stroke='#fff' fontSize={12} />
							<Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} />
							<Bar dataKey='value' radius={[4, 4, 0, 0]}>
								{cardData.map((entry, index) => (
									<Cell key={`cell-${index}`} fill={entry.color} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>
			)}

			{/* Defensive Stats Bar Chart */}
			{(toNumber(validPlayerData.cleanSheets) > 0 || toNumber(validPlayerData.conceded) > 0) && (
				<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
					<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Defensive Stats</h3>
					<ResponsiveContainer width='100%' height={300}>
						<BarChart data={defensiveData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
							<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
							<XAxis dataKey='name' stroke='#fff' fontSize={12} />
							<YAxis stroke='#fff' fontSize={12} />
							<Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} />
							<Bar dataKey='value' fill='#22c55e' radius={[4, 4, 0, 0]} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			)}

			{/* Penalty Stats Custom Visualization */}
			{penaltyData.some(item => item.value > 0) && (
				<PenaltyStatsVisualization
					scored={toNumber(validPlayerData.penaltiesScored)}
					missed={toNumber(validPlayerData.penaltiesMissed)}
					saved={toNumber(validPlayerData.penaltiesSaved)}
					conceded={toNumber(validPlayerData.penaltiesConceded)}
				/>
			)}
		</div>
	);

	const dataTableContent = (
		<div className='overflow-x-auto overflow-y-auto h-full'>
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
						const value = validPlayerData[stat.statName as keyof PlayerData];
						return <StatRow key={key} stat={stat} value={value} playerData={validPlayerData} />;
					})}
				</tbody>
			</table>
		</div>
	);

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
				<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
			</div>

			<div className='flex-1 px-2 md:px-4 pb-4 min-h-0'>
				<Tabs
					tabs={[
						{ id: "visualisations", label: "Visualisations", content: chartContent },
						{ id: "data", label: "Data", content: dataTableContent },
					]}
					defaultTab='visualisations'
					storageKey='player-stats-active-tab'
				/>
			</div>
		</div>
	);
}
