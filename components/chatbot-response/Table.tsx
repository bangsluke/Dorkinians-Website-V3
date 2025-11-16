"use client";

import { useState } from "react";
import { ChatbotResponse } from "@/lib/services/chatbotService";

interface TableProps {
	visualization: ChatbotResponse["visualization"];
}

export default function Table({ visualization }: TableProps) {
	if (!visualization) return null;

	const [hoveredRow, setHoveredRow] = useState<number | null>(null);

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
		<div className='mt-4 dark-dropdown rounded-lg overflow-hidden'>
			<div className='overflow-x-auto max-h-96 overflow-y-auto'>
				<table className='min-w-full text-sm'>
					<thead className='sticky top-0 z-10'>
						<tr className='bg-gradient-to-b from-white/[0.22] to-white/[0.05] border-b border-yellow-400/20'>
							{dataColumns.map((col, index) => {
								const { key, label } = getColumnInfo(col);
								return (
									<th
										key={index}
										className='text-left py-2 px-3 font-medium text-yellow-300'>
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
								className={`
									border-b border-yellow-400/10 transition-colors
									${hoveredRow === rowIndex ? "bg-yellow-400/20" : ""}
								`}
								onMouseEnter={() => setHoveredRow(rowIndex)}
								onMouseLeave={() => setHoveredRow(null)}
								onTouchStart={() => setHoveredRow(rowIndex)}
								onTouchEnd={() => setHoveredRow(null)}>
								{dataColumns.map((col, colIndex) => {
									const { key } = getColumnInfo(col);
									return (
										<td key={colIndex} className='py-2 px-3 text-white'>
											{row[key] ?? "-"}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

