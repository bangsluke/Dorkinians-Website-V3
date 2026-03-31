"use client";

import type { CSSProperties } from "react";
import {
	CartesianGrid,
	ComposedChart,
	Line,
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

const FORM_YELLOW = "#E8C547";
const FORM_GREEN = "#5DCAA5";

function FormTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: Array<{ dataKey?: string; value?: number; payload?: FormChartPoint }>;
	label?: string;
}) {
	if (!active || !payload?.length) return null;
	const row = payload[0]?.payload;
	if (!row) return null;
	const yellowLabel: CSSProperties = { color: FORM_YELLOW };
	const greenLabel: CSSProperties = { color: FORM_GREEN };
	return (
		<div
			className='rounded-lg border border-white/15 px-3 py-2 text-xs shadow-lg'
			style={{ background: "rgba(0,0,0,0.88)" }}>
			<p className='mb-1 font-medium text-white/90'>{label}</p>
			<p className='text-white/80'>
				<span className='text-white/60'>Rating:</span> {Number.isFinite(row.rawScore) ? row.rawScore.toFixed(1) : "—"}
			</p>
			<p className='text-white/80'>
				<span className='font-medium' style={yellowLabel}>
					Current form (5-match):
				</span>{" "}
				{Number.isFinite(row.ewmaReactive) ? row.ewmaReactive.toFixed(1) : "—"}
			</p>
			<p className='text-white/80'>
				<span className='font-medium' style={greenLabel}>
					Baseline (15-match):
				</span>{" "}
				{Number.isFinite(row.ewmaBaseline) ? row.ewmaBaseline.toFixed(1) : "—"}
			</p>
		</div>
	);
}

/** @deprecated Golden-cross lines removed from UI; prop kept for call-site compatibility. */
export type GoldenCrossPoint = { week: string; date: string };

export default function FormComposedChart({
	formData,
}: {
	formData: FormChartPoint[];
	goldenCrosses?: GoldenCrossPoint[];
}) {
	return (
		<div className='chart-container -my-2' style={{ touchAction: "pan-y" }}>
			<div className='mb-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/85'>
				<span className='inline-flex items-center gap-1.5'>
					<span className='inline-block h-0.5 w-6 bg-[#E8C547]' aria-hidden />
					Current form (5-match)
				</span>
				<span className='inline-flex items-center gap-1.5'>
					<span className='inline-block h-0.5 w-6 bg-[#5DCAA5]' aria-hidden />
					Baseline (15-match)
				</span>
				<span className='inline-flex items-center gap-1.5'>
					<span className='inline-block h-2 w-2 rounded-full bg-white/40' aria-hidden />
					Rating
				</span>
			</div>
			<ResponsiveContainer width='100%' height={220}>
				<ComposedChart data={formData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
					<CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.06)' vertical={false} />
					<XAxis dataKey='week' tick={{ fill: "#ffffff", fontSize: 10 }} tickLine={{ stroke: "rgba(255,255,255,0.35)" }} />
					<YAxis
						domain={[2, 10]}
						ticks={[2, 4, 6, 8, 10]}
						width={28}
						tick={{ fill: "#ffffff", fontSize: 10 }}
						tickMargin={2}
						allowDecimals={false}
						axisLine={{ stroke: "rgba(255,255,255,0.35)" }}
					/>
					<Tooltip content={<FormTooltip />} />
					<Scatter dataKey='rawScore' fill='rgba(255,255,255,0.4)' />
					<Line type='monotone' dataKey='ewmaBaseline' stroke='#5DCAA5' strokeWidth={1.5} dot={false} opacity={0.75} />
					<Line type='monotone' dataKey='ewmaReactive' stroke='#E8C547' strokeWidth={2.5} dot={false} />
				</ComposedChart>
			</ResponsiveContainer>
		</div>
	);
}
