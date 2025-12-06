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

	return (
		<div className='mt-4 overflow-x-auto -mx-3 md:-mx-6 px-3 md:px-6'>
			<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
				<thead className='sticky top-0 z-10'>
					<tr className='bg-white/20'>
						{dataColumns.map((col, index) => {
							const { key, label } = getColumnInfo(col);
							// Center align numeric columns (rank, value), left align text columns (name)
							const isNumeric = key === "rank" || key === "value";
							return (
								<th
									key={index}
									className={`${isNumeric ? "text-center" : "text-left"} px-2 py-2 text-white font-semibold text-xs md:text-sm`}>
									{label}
								</th>
							);
						})}
					</tr>
				</thead>
				<tbody>
					{data.map((row: any, rowIndex: number) => (
						<tr
							key={rowIndex}
							className={`border-b border-white/10 transition-colors ${
								rowIndex % 2 === 0 ? "bg-gray-800/30" : ""
							} hover:bg-white/5`}
							onMouseEnter={() => setHoveredRow(rowIndex)}
							onMouseLeave={() => setHoveredRow(null)}
							onTouchStart={() => setHoveredRow(rowIndex)}
							onTouchEnd={() => setHoveredRow(null)}>
							{dataColumns.map((col, colIndex) => {
								const { key } = getColumnInfo(col);
								const isNumeric = key === "rank" || key === "value";
								return (
									<td 
										key={colIndex} 
										className={`${isNumeric ? "text-center" : "text-left"} px-2 py-2 text-white text-xs md:text-sm`}>
										{row[key] ?? "-"}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

