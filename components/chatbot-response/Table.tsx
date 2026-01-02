"use client";

import { useState, useEffect, useRef } from "react";
import { ChatbotResponse } from "@/lib/services/chatbotService";

interface TableProps {
	visualization: ChatbotResponse["visualization"];
}

export default function Table({ visualization }: TableProps) {
	const [hoveredRow, setHoveredRow] = useState<number | null>(null);
	const [isExpanded, setIsExpanded] = useState(false);
	const previousDataRef = useRef<unknown>(null);

	if (!visualization) return null;

	// Reset expanded state when visualization data changes (new question asked)
	useEffect(() => {
		if (visualization.data !== previousDataRef.current) {
			setIsExpanded(false);
			previousDataRef.current = visualization.data;
		}
	}, [visualization.data]);

	// Extract columns and data
	const columns = visualization.config && "columns" in visualization.config
		? (visualization.config.columns as Array<string | { key: string; label: string }>)
		: [];

	const allData = Array.isArray(visualization.data) ? visualization.data : [];

	// Helper to get column key and label
	const getColumnInfo = (col: string | { key: string; label: string }) => {
		if (typeof col === "string") {
			return { key: col, label: col === "name" ? "Player Name" : col };
		}
		return { key: col.key, label: col.label };
	};

	// Get all unique column keys from data if columns not provided
	const dataColumns = columns.length > 0
		? columns
		: allData.length > 0
			? Object.keys(allData[0] as Record<string, unknown>).map((key) => ({ key, label: key }))
			: [];

	if (dataColumns.length === 0 || allData.length === 0) {
		return (
			<div className='mt-4 p-4 dark-dropdown rounded-lg'>
				<p className='text-yellow-300'>No data available</p>
			</div>
		);
	}

	// Check if this is a league table (has Team and Position columns)
	const isLeagueTable = dataColumns.some((col) => {
		const { key } = getColumnInfo(col);
		return key === "Team" || key === "team";
	}) && dataColumns.some((col) => {
		const { key } = getColumnInfo(col);
		return key === "Position" || key === "position";
	});
	
	// Check if table is expandable (not a league table and has expandable config)
	const config = visualization.config || {};
	const hasInitialDisplayLimit = "initialDisplayLimit" in config;
	const hasExpandableLimit = "expandableLimit" in config;
	
	// Table is expandable if:
	// 1. Not a league table
	// 2. Has initial display limit config
	// 3. Has more data than the initial display limit
	const isExpandable = !isLeagueTable && 
		hasInitialDisplayLimit &&
		allData.length > (config.initialDisplayLimit as number);
	
	// Always use initialDisplayLimit if provided, even if not expandable
	const initialDisplayLimit = hasInitialDisplayLimit 
		? (config.initialDisplayLimit as number) 
		: allData.length;
	const expandableLimit = hasExpandableLimit
		? (config.expandableLimit as number) 
		: allData.length;
	
	// Determine which data to display
	// If initialDisplayLimit is set, respect it even if not expandable
	const displayData = hasInitialDisplayLimit && !isExpanded 
		? allData.slice(0, initialDisplayLimit)
		: allData;

	// Helper to check if a team is Dorkinians
	const isDorkiniansTeam = (teamName: string | unknown): boolean => {
		if (typeof teamName !== "string") return false;
		return teamName.toLowerCase().includes("dorkinians");
	};

	return (
		<div className='mt-2 overflow-x-auto -mx-2 md:-mx-4 px-2 md:px-4'>
			<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
				<thead className='sticky top-0 z-10'>
					<tr className='bg-white/20'>
						{dataColumns.map((col, index) => {
							const { key, label } = getColumnInfo(col);
							// Center align numeric columns, left align text columns
							const isNumeric = key === "rank" || key === "value" || key === "Position" || key === "position" || 
								key === "Played" || key === "Won" || key === "Drawn" || key === "Lost" || 
								key === "Goals For" || key === "Goals Against" || key === "Goal Difference" || key === "Points";
							const isPositionColumn = key === "Position" || key === "position";
							return (
								<th
									key={index}
									className={`${isNumeric ? "text-center" : "text-left"} ${
										isPositionColumn ? "px-1.5" : "px-1.5"
									} py-1.5 text-white font-semibold ${
										isPositionColumn ? "text-[10px] md:text-xs" : "text-[10px] md:text-xs"
									}`}>
									{label}
								</th>
							);
						})}
					</tr>
				</thead>
				<tbody>
					{displayData.map((row: any, rowIndex: number) => {
						const teamName = row["Team"] || row["team"] || "";
						const isDorkinians = isLeagueTable && isDorkiniansTeam(teamName);
						return (
							<tr
								key={rowIndex}
								className={`border-b border-white/10 transition-colors ${
									isDorkinians
										? "bg-dorkinians-yellow/20 font-semibold"
										: rowIndex % 2 === 0
											? "bg-gray-800/30"
											: ""
								} hover:bg-white/5`}
								onMouseEnter={() => setHoveredRow(rowIndex)}
								onMouseLeave={() => setHoveredRow(null)}
								onTouchStart={() => setHoveredRow(rowIndex)}
								onTouchEnd={() => setHoveredRow(null)}>
								{dataColumns.map((col, colIndex) => {
									const { key } = getColumnInfo(col);
									const isNumeric = key === "rank" || key === "value" || key === "Position" || key === "position" || 
										key === "Played" || key === "Won" || key === "Drawn" || key === "Lost" || 
										key === "Goals For" || key === "Goals Against" || key === "Goal Difference" || key === "Points";
									const isPositionColumn = key === "Position" || key === "position";
									const isTeamColumn = key === "Team" || key === "team";
									return (
										<td 
											key={colIndex} 
											className={`${isNumeric ? "text-center" : "text-left"} ${
												isPositionColumn ? "px-1.5" : isTeamColumn ? "px-1.5" : "px-1.5"
											} py-1.5 text-white ${
												isPositionColumn ? "text-[10px] md:text-xs" : "text-[10px] md:text-xs"
											} ${isDorkinians && key === "Points" ? "text-dorkinians-yellow font-semibold" : ""}`}>
											{row[key] ?? "-"}
										</td>
									);
								})}
							</tr>
						);
					})}
				</tbody>
			</table>
			
			{/* Expandable button - only show for non-league tables that are expandable */}
			{isExpandable && !isExpanded && allData.length > initialDisplayLimit && (
				<div className='mt-3 text-center'>
					<button
						onClick={() => setIsExpanded(true)}
						className='text-yellow-300 hover:text-yellow-200 underline text-sm md:text-base transition-colors cursor-pointer'>
						{allData.length <= expandableLimit 
							? `Show all ${allData.length}` 
							: `Show the top ${expandableLimit}`}
					</button>
				</div>
			)}
		</div>
	);
}

