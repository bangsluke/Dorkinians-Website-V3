"use client";

import { useState } from "react";
import { ChatbotResponse } from "@/lib/services/chatbotService";

interface TableProps {
	visualization: ChatbotResponse["visualization"];
}

export default function Table({ visualization }: TableProps) {
	const [hoveredRow, setHoveredRow] = useState<number | null>(null);

	if (!visualization) return null;

	// Extract columns and data
	const columns = visualization.config && "columns" in visualization.config
		? (visualization.config.columns as Array<string | { key: string; label: string }>)
		: [];

	const data = Array.isArray(visualization.data) ? visualization.data : [];

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
		: data.length > 0
			? Object.keys(data[0] as Record<string, unknown>).map((key) => ({ key, label: key }))
			: [];

	if (dataColumns.length === 0 || data.length === 0) {
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
					{data.map((row: any, rowIndex: number) => {
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
		</div>
	);
}

