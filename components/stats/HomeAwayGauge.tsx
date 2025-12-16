"use client";

interface HomeAwayGaugeProps {
	homeWinPercentage: number;
	awayWinPercentage: number;
}

export default function HomeAwayGauge({ homeWinPercentage, awayWinPercentage }: HomeAwayGaugeProps) {
	const homePercentage = Math.round(homeWinPercentage);
	const awayPercentage = Math.round(awayWinPercentage);
	const advantage = homePercentage > awayPercentage ? "Home" : homePercentage < awayPercentage ? "Away" : "Equal";
	const advantageValue = Math.abs(homePercentage - awayPercentage);

	// SVG path for semicircle gauge - fills from left to right
	const createGaugePath = (percentage: number, color: string, offsetX: number = 0) => {
		if (percentage === 0) return null;
		
		const radius = 60;
		const centerX = 70 + offsetX;
		const centerY = 70;
		const sweepAngle = (percentage / 100) * 180;
		
		// Start from left (180 degrees), sweep clockwise towards right
		// For clockwise sweep from 180°: 180° → 270° → 360° (0°)
		// So endAngle = 180 - sweepAngle (going clockwise)
		const startAngle = 180;
		const endAngle = 180 - sweepAngle;
		
		const startX = centerX + radius * Math.cos((startAngle * Math.PI) / 180);
		const startY = centerY + radius * Math.sin((startAngle * Math.PI) / 180);
		const endX = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
		const endY = centerY + radius * Math.sin((endAngle * Math.PI) / 180);
		
		// largeArcFlag: 0 for angles <= 180, 1 for > 180
		// sweep: 1 for clockwise (left to right)
		const largeArcFlag = sweepAngle > 180 ? 1 : 0;
		
		return (
			<path
				d={`M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`}
				fill={color}
				opacity={0.8}
			/>
		);
	};

	return (
		<div className='flex flex-row items-center gap-4 py-4'>
			{/* Combined Gauge with Overlay */}
			<div className='relative flex-shrink-0'>
				<svg width='140' height='80' viewBox='0 0 140 80' className='mb-2'>
					{/* Single background arc */}
					<path
						d='M 10 70 A 60 60 0 0 1 130 70'
						fill='none'
						stroke='rgba(255, 255, 255, 0.1)'
						strokeWidth='8'
					/>
					{/* Home win percentage arc - overlayed */}
					{createGaugePath(homePercentage, '#f9ed32', 0)}
					{/* Away win percentage arc - overlayed on top */}
					{createGaugePath(awayPercentage, '#22c55e', 0)}
					{/* Center dot */}
					<circle cx='70' cy='70' r='4' fill='#fff' />
					{/* Home label - left side */}
					<text x='35' y='50' textAnchor='middle' fill='#fff' fontSize='12' className='text-xs md:text-sm'>
						Home
					</text>
					<text x='35' y='65' textAnchor='middle' fill='#f9ed32' fontSize='16' fontWeight='bold' className='text-lg md:text-xl'>
						{homePercentage}%
					</text>
					{/* Away label - right side */}
					<text x='105' y='50' textAnchor='middle' fill='#fff' fontSize='12' className='text-xs md:text-sm'>
						Away
					</text>
					<text x='105' y='65' textAnchor='middle' fill='#22c55e' fontSize='16' fontWeight='bold' className='text-lg md:text-xl'>
						{awayPercentage}%
					</text>
				</svg>
			</div>

			{/* Home Advantage - Right side */}
			<div className='flex flex-col justify-center'>
				<div className='text-white text-xs md:text-sm mb-1'>{advantage} Advantage</div>
				<div className='text-white font-semibold text-sm md:text-base'>{advantageValue}%</div>
			</div>
		</div>
	);
}
