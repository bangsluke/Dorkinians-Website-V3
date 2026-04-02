"use client";

import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { ComponentType } from "react";

export type SeasonalBarPoint = { name: string; value: number; trendline?: number | null };

export default function SeasonalPerformanceChart({
	data,
	showTrend,
	tooltipContent,
}: {
	data: SeasonalBarPoint[];
	showTrend: boolean;
	tooltipContent: ComponentType<any>;
}) {
	return (
		<div className="chart-container" style={{ touchAction: "pan-y" }}>
			<ResponsiveContainer width="100%" height={240}>
				<ComposedChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
					<XAxis dataKey="name" stroke="#fff" fontSize={12} />
					<YAxis stroke="#fff" fontSize={12} domain={[0, "auto"]} allowDecimals={false} />
					<Tooltip content={tooltipContent as any} />
					<Bar
						dataKey="value"
						fill="#f9ed32"
						radius={[4, 4, 0, 0]}
						opacity={0.9}
						activeBar={{ fill: "#f9ed32", opacity: 1, stroke: "none" }}
					/>
					{showTrend && (
						<Line
							type="linear"
							dataKey="trendline"
							stroke="#ffffff"
							strokeWidth={2}
							strokeDasharray="5 5"
							dot={false}
							activeDot={false}
							isAnimationActive={false}
							connectNulls={false}
						/>
					)}
				</ComposedChart>
			</ResponsiveContainer>
		</div>
	);
}
