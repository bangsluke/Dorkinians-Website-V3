"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ComponentType } from "react";

export type PieSlice = { name: string; value: number; color: string };

export default function MatchResultsPieChart({
	data,
	tooltipContent,
}: {
	data: PieSlice[];
	tooltipContent: ComponentType<any>;
}) {
	return (
		<div className="chart-container -my-2" style={{ touchAction: "pan-y" }}>
			<ResponsiveContainer width="100%" height={220}>
				<PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
					<Pie
						data={data}
						cx="50%"
						cy="50%"
						labelLine={false}
						label={({ cx, cy, midAngle, innerRadius, outerRadius, name, value }) => {
							const RADIAN = Math.PI / 180;
							const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
							const x = cx + radius * Math.cos(-midAngle * RADIAN);
							const y = cy + radius * Math.sin(-midAngle * RADIAN);

							return (
								<text
									x={x}
									y={y}
									fill="#ffffff"
									textAnchor={x > cx ? "start" : "end"}
									dominantBaseline="central"
									fontSize={14}
									fontWeight="bold"
								>
									{`${name}: ${value}`}
								</text>
							);
						}}
						outerRadius={90}
						fill="#8884d8"
						dataKey="value"
					>
						{data.map((entry, index) => (
							<Cell key={`cell-${index}`} fill={entry.color} />
						))}
					</Pie>
					<Tooltip content={tooltipContent as any} />
				</PieChart>
			</ResponsiveContainer>
		</div>
	);
}
