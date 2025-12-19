"use client";

import { useEffect, useState } from "react";

interface HomeAwayGaugeProps {
	homeWinPercentage: number;
	awayWinPercentage: number;
}

export default function HomeAwayGauge({ homeWinPercentage, awayWinPercentage }: HomeAwayGaugeProps) {
	const homePercentage = Math.round(homeWinPercentage);
	const awayPercentage = Math.round(awayWinPercentage);
	const advantage = homePercentage > awayPercentage ? "Home" : homePercentage < awayPercentage ? "Away" : "Equal";
	const advantageValue = Math.abs(homePercentage - awayPercentage);

	// Animation state
	const [animatedHome, setAnimatedHome] = useState(0);
	const [animatedAway, setAnimatedAway] = useState(0);

	// Animate on mount
	useEffect(() => {
		const duration = 1000; // 1 second animation
		const startTime = Date.now();
		
		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);
			
			// Ease-out animation
			const easeOut = 1 - Math.pow(1 - progress, 3);
			
			setAnimatedHome(homePercentage * easeOut);
			setAnimatedAway(awayPercentage * easeOut);
			
			if (progress < 1) {
				requestAnimationFrame(animate);
			}
		};
		
		requestAnimationFrame(animate);
	}, [homePercentage, awayPercentage]);

	// Calculate arc properties
	const radius = 60;
	const arcLength = Math.PI * radius; // Semi-circle circumference
	const strokeWidth = 8;
	const centerX = 70;
	const centerY = 70;

	// Calculate stroke-dasharray and stroke-dashoffset for percentage fill
	const getArcProps = (percentage: number) => {
		const dashLength = (percentage / 100) * arcLength;
		return {
			strokeDasharray: `${dashLength} ${arcLength}`,
			strokeDashoffset: 0,
		};
	};

	const homeArcProps = getArcProps(animatedHome);
	const awayArcProps = getArcProps(animatedAway);

	// Calculate gauge hand/needle position for Home percentage
	// Gauge arc goes from left (180°) to right (0°) clockwise
	// The needle should point to where the green arc ends (at the Home percentage)
	// The arc path starts at left (180°) and sweeps clockwise to right (0°)
	// For percentage p: angle = 180° - (p/100) * 180°
	// This maps: 0% → 180° (left), 100% → 0° (right)
	const needleAngle = 180 - (homePercentage / 100) * 180;
	const needleLength = radius - 5; // Slightly shorter than radius for better visibility
	// Convert angle to radians and calculate end point
	// Math.cos/sin use standard math angles: 0° = right, 90° = up, 180° = left
	// But SVG y-axis is inverted (down is positive), so we need to account for that
	const angleRad = (needleAngle * Math.PI) / 180;
	const needleEndX = centerX + needleLength * Math.cos(angleRad);
	const needleEndY = centerY - needleLength * Math.sin(angleRad); // Negative because SVG y increases downward

	return (
		<div className='flex flex-row items-center gap-4 py-4'>
			{/* Gauge - 40% width */}
			<div className='relative flex-shrink-0' style={{ width: '40%' }}>
				<svg width='100%' height='80' viewBox='0 0 140 80' className='mb-2' preserveAspectRatio='xMidYMid meet'>
					{/* Background arc - full semi-circle */}
					<path
						d='M 10 70 A 60 60 0 0 1 130 70'
						fill='none'
						stroke='rgba(255, 255, 255, 0.1)'
						strokeWidth={strokeWidth}
						strokeLinecap='round'
					/>
					{/* Home win percentage arc - fills from left to right (green) */}
					{homePercentage > 0 && (
						<path
							d='M 10 70 A 60 60 0 0 1 130 70'
							fill='none'
							stroke='#22c55e'
							strokeWidth={strokeWidth}
							strokeLinecap='round'
							opacity={0.8}
							style={{
								strokeDasharray: homeArcProps.strokeDasharray,
								strokeDashoffset: homeArcProps.strokeDashoffset,
								transition: 'stroke-dasharray 0.1s ease-out',
							}}
						/>
					)}
					{/* Away win percentage arc - overlays on top (yellow) */}
					{awayPercentage > 0 && (
						<path
							d='M 10 70 A 60 60 0 0 1 130 70'
							fill='none'
							stroke='#f9ed32'
							strokeWidth={strokeWidth}
							strokeLinecap='round'
							opacity={0.8}
							style={{
								strokeDasharray: awayArcProps.strokeDasharray,
								strokeDashoffset: awayArcProps.strokeDashoffset,
								transition: 'stroke-dasharray 0.1s ease-out',
							}}
						/>
					)}
					{/* Gauge hand/needle pointing to Home percentage */}
					{homePercentage > 0 && (
						<line
							x1={centerX}
							y1={centerY}
							x2={needleEndX}
							y2={needleEndY}
							stroke='#ffffff'
							strokeWidth='3'
							strokeLinecap='round'
							style={{
								transition: 'all 0.1s ease-out',
							}}
						/>
					)}
					{/* Center dot */}
					<circle cx={centerX} cy={centerY} r='4' fill='#fff' />
				</svg>
			</div>

			{/* Text labels - 60% width, right side */}
			<div className='flex flex-col justify-center' style={{ width: '60%' }}>
				<div className='font-semibold text-base md:text-lg mb-2'>
					<span style={{ color: '#22c55e' }}>{homePercentage}%</span> <span className='text-white/70'>Home</span>
				</div>
				<div className='font-semibold text-base md:text-lg mb-2'>
					<span style={{ color: '#f9ed32' }}>{awayPercentage}%</span> <span className='text-white/70'>Away</span>
				</div>
				<div className='font-semibold text-base md:text-lg mb-1'>
					<span className='text-white'>{advantageValue}%</span> <span className='text-white/70'>{advantage} Advantage</span>
				</div>
			</div>
		</div>
	);
}
