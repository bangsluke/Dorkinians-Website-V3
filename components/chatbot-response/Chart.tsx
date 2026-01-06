"use client";

import { ChatbotResponse } from "@/lib/services/chatbotService";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface ChartProps {
	visualization: ChatbotResponse["visualization"];
}

export default function Chart({ visualization }: ChartProps) {
	if (!visualization) return null;

	// Transform data for Recharts
	const data = Array.isArray(visualization.data) ? visualization.data : [];
	
	const chartData = data.map((item: any) => ({
		name: item.label || item.name || item.season || "Unknown",
		value: item.value || 0,
		isHighest: item.isHighest || false,
	}));

	if (chartData.length === 0) {
		return (
			<div className='dark-dropdown rounded-lg'>
				<p className='text-yellow-300'>No data available</p>
			</div>
		);
	}

	// Find the highest value if not already marked
	const maxValue = Math.max(...chartData.map((item) => item.value));
	const chartDataWithHighlight = chartData.map((item) => ({
		...item,
		isHighest: item.isHighest || item.value === maxValue,
	}));

	// Custom tooltip
	const CustomTooltip = ({ active, payload }: any) => {
		if (active && payload && payload.length) {
			return (
				<div className='bg-gray-800 border border-yellow-400/30 rounded-lg p-2 shadow-lg'>
					<p className='text-yellow-300 font-semibold'>{payload[0].payload.name}</p>
					<p className='text-white'>
						<span className='text-yellow-400'>Goals: </span>
						{payload[0].value}
					</p>
				</div>
			);
		}
		return null;
	};

	return (
		<div className='dark-dropdown rounded-lg w-full overflow-hidden mx-auto shadow-none pt-3 pr-3 pb-1.5 pl-1.5'>
			<ResponsiveContainer width='100%' height={240}>
				<BarChart data={chartDataWithHighlight} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
					<CartesianGrid strokeDasharray='3 3' stroke='rgba(249, 237, 50, 0.2)' />
					<XAxis
						dataKey='name'
						stroke='#f3f3f3'
						fontSize={12}
						angle={-45}
						textAnchor='end'
						height={60}
					/>
					<YAxis stroke='#f3f3f3' fontSize={12} width={30} />
					<Tooltip content={<CustomTooltip />} />
					<Bar
						dataKey='value'
						radius={[4, 4, 0, 0]}
						fill='#FFFFFF'
					>
						{chartDataWithHighlight.map((entry, index) => (
							<Cell
								key={`cell-${index}`}
								fill={entry.isHighest ? "#F9ED32" : "#FFFFFF"}
								stroke={entry.isHighest ? "#F9ED32" : "#FFFFFF"}
								strokeWidth={entry.isHighest ? 2 : 1}
							/>
						))}
					</Bar>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
