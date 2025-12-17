"use client";

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

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

const tooltipStyle = {
	backgroundColor: 'rgba(0, 0, 0, 0.8)',
	border: '1px solid rgba(249, 237, 50, 0.3)',
	borderRadius: '8px',
	color: '#fff',
};

// Custom tooltip for scatter plot
const scatterTooltip = ({ active, payload }: any) => {
	if (active && payload && payload.length) {
		const data = payload[0].payload as OppositionPerformanceData;
		return (
			<div style={tooltipStyle} className='px-3 py-2'>
				<p className='text-white text-sm font-semibold mb-1'>{data.name}</p>
				<p className='text-white text-xs'>
					<span className='font-semibold'>Goals/App:</span> {data.goalsPerApp.toFixed(1)}
				</p>
				<p className='text-white text-xs'>
					<span className='font-semibold'>Assists/App:</span> {data.assistsPerApp.toFixed(1)}
				</p>
				<p className='text-white text-xs'>
					<span className='font-semibold'>Total Goals:</span> {data.goals}
				</p>
				<p className='text-white text-xs'>
					<span className='font-semibold'>Total Assists:</span> {data.assists}
				</p>
				<p className='text-white text-xs'>
					<span className='font-semibold'>Appearances:</span> {data.appearances}
				</p>
			</div>
		);
	}
	return null;
};

export default function OppositionPerformanceScatter({ data, isLoading }: OppositionPerformanceScatterProps) {
	if (isLoading) {
		return (
			<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
				<div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 md:p-6">
					<Skeleton height={20} width="40%" className="mb-4" />
					<div className='relative' style={{ height: '320px' }}>
						{/* Grid background */}
						<div className='absolute inset-0'>
							<div className='h-full flex flex-col justify-between'>
								{[...Array(5)].map((_, i) => (
									<div key={i} className='border-t border-white/10' />
								))}
							</div>
							<div className='absolute inset-0 flex justify-between'>
								{[...Array(6)].map((_, i) => (
									<div key={i} className='border-l border-white/10' />
								))}
							</div>
						</div>
						{/* Scatter points */}
						<div className='absolute inset-0'>
							{[
								{ top: '25%', left: '15%' },
								{ top: '40%', left: '30%' },
								{ top: '60%', left: '50%' },
								{ top: '35%', left: '65%' },
								{ top: '70%', left: '25%' },
								{ top: '50%', left: '75%' },
								{ top: '30%', left: '45%' },
								{ top: '65%', left: '60%' },
								{ top: '45%', left: '20%' },
								{ top: '55%', left: '80%' },
							].map((pos, i) => (
								<Skeleton 
									key={i} 
									circle 
									height={12} 
									width={12} 
									style={{ 
										position: 'absolute', 
										top: pos.top, 
										left: pos.left 
									}} 
								/>
							))}
						</div>
					</div>
				</div>
			</SkeletonTheme>
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
							width={40}
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
