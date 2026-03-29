"use client";

import {
	CartesianGrid,
	ComposedChart,
	Line,
	ReferenceLine,
	ResponsiveContainer,
	Scatter,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

export type FormChartPoint = {
	week: string;
	date: string;
	rawScore: number;
	ewmaReactive: number;
	ewmaBaseline: number;
};

export type GoldenCrossPoint = { week: string; date: string };

export default function FormComposedChart({
	formData,
	goldenCrosses,
}: {
	formData: FormChartPoint[];
	goldenCrosses: GoldenCrossPoint[];
}) {
	return (
		<div className="chart-container -my-2" style={{ touchAction: "pan-y" }}>
			<ResponsiveContainer width="100%" height={220}>
				<ComposedChart data={formData} margin={{ top: 10, right: 10, left: -28, bottom: 0 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
					<XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
					<YAxis domain={[2, 10]} width={32} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} tickMargin={4} />
					<Tooltip
						contentStyle={{
							background: "rgba(0,0,0,0.85)",
							border: "1px solid rgba(255,255,255,0.15)",
							borderRadius: 8,
						}}
					/>
					<Scatter dataKey="rawScore" fill="rgba(255,255,255,0.35)" />
					<Line type="monotone" dataKey="ewmaBaseline" stroke="#5DCAA5" strokeWidth={1.5} dot={false} opacity={0.75} />
					<Line type="monotone" dataKey="ewmaReactive" stroke="#E8C547" strokeWidth={2.5} dot={false} />
					{goldenCrosses.map((cross, crossIdx) => (
						<ReferenceLine
							key={`${cross.week}-${cross.date}`}
							x={cross.week}
							stroke="rgba(232,197,71,0.45)"
							strokeDasharray="4 3"
							label={
								crossIdx === 0
									? {
											value: "Golden cross",
											position: "top",
											fill: "rgba(232,197,71,0.85)",
											fontSize: 9,
										}
									: undefined
							}
						/>
					))}
				</ComposedChart>
			</ResponsiveContainer>
		</div>
	);
}
