"use client";

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ScatterChartSkeleton } from "@/components/skeletons";
import { TooltipSurface } from "@/components/ui/Tooltip";

interface OppositionPerformanceData {
	name: string;
	goalsPerApp: number;
	assistsPerApp: number;
	appearances: number;
	goals: number;
	assists: number;
}

interface OppositionPerformanceScatterProps {
	data: OppositionPerformanceData[];
	isLoading?: boolean;
}

// Custom tooltip for scatter plot
const scatterTooltip = ({ active, payload }: any) => {
	if (active && payload && payload.length) {
		const data = payload[0].payload as OppositionPerformanceData;
		return (
			<TooltipSurface>
				<p className='mb-1 font-medium text-white/90'>{data.name}</p>
				<p className='text-white/80'>
					<span className='font-medium text-white/60'>Goals/App:</span> {data.goalsPerApp.toFixed(1)}
				</p>
				<p className='text-white/80'>
					<span className='font-medium text-white/60'>Assists/App:</span> {data.assistsPerApp.toFixed(1)}
				</p>
				<p className='text-white/80'>
					<span className='font-medium text-white/60'>Total Goals:</span> {data.goals}
				</p>
				<p className='text-white/80'>
					<span className='font-medium text-white/60'>Total Assists:</span> {data.assists}
				</p>
				<p className='text-white/80'>
					<span className='font-medium text-white/60'>Appearances:</span> {data.appearances}
				</p>
			</TooltipSurface>
		);
	}
	return null;
};

export default function OppositionPerformanceScatter({ data, isLoading }: OppositionPerformanceScatterProps) {
	if (isLoading) {
		return (
			<ScatterChartSkeleton />
		);
	}

	if (!data || data.length === 0) {
		return null;
	}

	// Transform data for ScatterChart (needs x and y properties)
	const scatterData = data.map((item) => ({
		...item,
		x: item.goalsPerApp,
		y: item.assistsPerApp,
	}));

	return (
		<div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 md:p-6">
			<h3 className="text-white font-semibold text-sm md:text-base mb-4">Opposition Performance</h3>
			<div className='chart-container' style={{ touchAction: 'pan-y' }}>
				<ResponsiveContainer width='100%' height={320}>
					<ScatterChart
						margin={{ top: 10, right: 20, bottom: 20, left: 0 }}
					>
						<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
						<XAxis
							type="number"
							dataKey="x"
							name="Goals/App"
							label={{ value: 'Goals per Appearance', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fill: '#fff', fontSize: 12 } }}
							stroke='#fff'
							fontSize={12}
							domain={['dataMin', 'auto']}
						/>
						<YAxis
							type="number"
							dataKey="y"
							name="Assists/App"
							label={{ value: 'Assists per Appearance', angle: -90, position: 'left', offset: -5, style: { textAnchor: 'middle', fill: '#fff', fontSize: 12 } }}
							stroke='#fff'
							fontSize={12}
							domain={['dataMin', 'auto']}
							width={55}
						/>
						<Tooltip content={scatterTooltip} cursor={{ strokeDasharray: '3 3' }} />
						<Scatter
							name="Opposition"
							data={scatterData}
							fill='#f9ed32'
							opacity={0.9}
							shape={(props: any) => {
								const { cx, cy } = props;
								return (
									<circle
										cx={cx}
										cy={cy}
										r={10}
										fill='#f9ed32'
										opacity={0.9}
										stroke='rgba(249, 237, 50, 0.5)'
										strokeWidth={1}
									/>
								);
							}}
						/>
					</ScatterChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
