"use client";

import { PlayerData, PlayerFilters } from "@/lib/stores/navigation";
import { formatFilterSummary } from "@/lib/utils/shareUtils";
import { statObject } from "@/config/config";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from "recharts";

interface ShareableStatsCardProps {
	playerName: string;
	playerData: PlayerData;
	playerFilters: PlayerFilters;
	filterData?: {
		seasons: Array<{ season: string; startDate: string; endDate: string }>;
		teams: Array<{ name: string }>;
		opposition: Array<{ name: string }>;
		competitions: Array<{ name: string; type: string }>;
	};
	selectedVisualization?: {
		type: string;
		data?: any;
	};
}

function toNumber(val: any): number {
	if (val === null || val === undefined) return 0;
	if (typeof val === "number") {
		if (isNaN(val)) return 0;
		return val;
	}
	if (typeof val === "object") {
		if ("toNumber" in val && typeof val.toNumber === "function") {
			return val.toNumber();
		}
		if ("low" in val && "high" in val) {
			const low = val.low || 0;
			const high = val.high || 0;
			return low + high * 4294967296;
		}
	}
	const num = Number(val);
	return isNaN(num) ? 0 : num;
}

function formatStatValue(value: any, statFormat: string, decimalPlaces: number, statUnit?: string): string {
	if (value === null || value === undefined) return "0";

	const numValue = toNumber(value);

	let formattedValue: string;
	switch (statFormat) {
		case "Integer":
			formattedValue = Math.round(numValue).toString();
			break;
		case "Decimal1":
			formattedValue = numValue.toFixed(1);
			break;
		case "Decimal2":
			formattedValue = numValue.toFixed(decimalPlaces);
			break;
		case "Percentage":
			formattedValue = `${Math.round(numValue)}%`;
			break;
		case "String":
			formattedValue = String(value);
			break;
		default:
			formattedValue = String(value);
	}

	return statUnit ? `${formattedValue} ${statUnit}` : formattedValue;
}

function renderVisualization(viz: { type: string; data?: any }) {
	const { type, data } = viz;

	switch (type) {
		case "seasonal-performance":
			if (!data || !data.chartData || data.chartData.length === 0) return null;
			return (
				<div style={{ width: "100%", height: "300px" }}>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={data.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
							<XAxis dataKey="name" stroke="#fff" fontSize={14} />
							<YAxis stroke="#fff" fontSize={14} />
							<Bar dataKey="value" fill="#f9ed32" radius={[4, 4, 0, 0]} opacity={0.9} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			);

		case "team-performance":
			if (!data || !data.chartData || data.chartData.length === 0) return null;
			return (
				<div style={{ width: "100%", height: "300px" }}>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={data.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
							<XAxis dataKey="name" stroke="#fff" fontSize={14} />
							<YAxis stroke="#fff" fontSize={14} />
							<Bar dataKey="value" fill="#f9ed32" radius={[4, 4, 0, 0]} opacity={0.9} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			);

		case "match-results":
			if (!data || !data.pieData || data.pieData.length === 0) return null;
			return (
				<div style={{ width: "100%", height: "300px" }}>
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Pie
								data={data.pieData}
								cx="50%"
								cy="50%"
								labelLine={false}
								label={({ name, value }) => `${name}: ${value}`}
								outerRadius={100}
								fill="#8884d8"
								dataKey="value">
								{data.pieData.map((entry: any, index: number) => (
									<Cell key={`cell-${index}`} fill={entry.color} />
								))}
							</Pie>
						</PieChart>
					</ResponsiveContainer>
				</div>
			);

		case "positional-stats":
			if (!data) return null;
			const svgWidth = 127;
			const svgHeight = 87;
			const thirdWidth = svgWidth / 3;
			const totalPositionAppearances = (data.gk || 0) + (data.def || 0) + (data.mid || 0) + (data.fwd || 0);
			const appearances = data.appearances || totalPositionAppearances;
			const defPercentOfTotal = appearances > 0 ? ((data.def || 0) / appearances * 100) : 0;
			const midPercentOfTotal = appearances > 0 ? ((data.mid || 0) / appearances * 100) : 0;
			const fwdPercentOfTotal = appearances > 0 ? ((data.fwd || 0) / appearances * 100) : 0;
			const gkPercentOfTotal = appearances > 0 ? ((data.gk || 0) / appearances * 100) : 0;
			
			return (
				<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px", color: "#fff" }}>Positional Stats</div>
					<div style={{ width: "100%", height: "300px", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
						{/* Background pitch image */}
						<div style={{ position: "absolute", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
							<img
								src={`${typeof window !== 'undefined' ? window.location.origin : ''}/stat-images/horizontal-pitch.svg`}
								alt="Football Pitch"
								style={{
									width: "100%",
									height: "100%",
									objectFit: "contain",
									opacity: 0.5,
								}}
								crossOrigin="anonymous"
								loading="eager"
							/>
						</div>
						
						{/* Overlay SVG with position boxes */}
						<svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet" style={{ position: "relative", zIndex: 10 }}>
							{/* DEF - Left third */}
							{data.def > 0 && (
								<>
									<rect
										x="0"
										y="0"
										width={thirdWidth}
										height={svgHeight}
										fill="rgba(139, 69, 19, 0.4)"
										stroke="rgba(255, 255, 255, 0.6)"
										strokeWidth="1"
									/>
									<text
										x={thirdWidth / 2}
										y={svgHeight / 2 - 8}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="20"
										fontWeight="bold"
									>
										{data.def}
									</text>
									<text
										x={thirdWidth / 2}
										y={svgHeight / 2 + 12}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="12"
									>
										{defPercentOfTotal.toFixed(1)}%
									</text>
								</>
							)}
							
							{/* MID - Middle third */}
							{data.mid > 0 && (
								<>
									<rect
										x={thirdWidth}
										y="0"
										width={thirdWidth}
										height={svgHeight}
										fill="rgba(144, 238, 144, 0.4)"
										stroke="rgba(255, 255, 255, 0.6)"
										strokeWidth="1"
									/>
									<text
										x={thirdWidth + thirdWidth / 2}
										y={svgHeight / 2 - 8}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="20"
										fontWeight="bold"
									>
										{data.mid}
									</text>
									<text
										x={thirdWidth + thirdWidth / 2}
										y={svgHeight / 2 + 12}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="12"
									>
										{midPercentOfTotal.toFixed(1)}%
									</text>
								</>
							)}
							
							{/* FWD - Right third */}
							{data.fwd > 0 && (
								<>
									<rect
										x={thirdWidth * 2}
										y="0"
										width={thirdWidth}
										height={svgHeight}
										fill="rgba(64, 224, 208, 0.4)"
										stroke="rgba(255, 255, 255, 0.6)"
										strokeWidth="1"
									/>
									<text
										x={thirdWidth * 2 + thirdWidth / 2}
										y={svgHeight / 2 - 8}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="20"
										fontWeight="bold"
									>
										{data.fwd}
									</text>
									<text
										x={thirdWidth * 2 + thirdWidth / 2}
										y={svgHeight / 2 + 12}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="12"
									>
										{fwdPercentOfTotal.toFixed(1)}%
									</text>
								</>
							)}
							
							{/* GK - Center circle (if applicable) */}
							{data.gk > 0 && (
								<>
									<circle
										cx={svgWidth / 2}
										cy={svgHeight / 2}
										r="15"
										fill="rgba(147, 51, 234, 0.4)"
										stroke="rgba(255, 255, 255, 0.6)"
										strokeWidth="1"
									/>
									<text
										x={svgWidth / 2}
										y={svgHeight / 2 - 5}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="14"
										fontWeight="bold"
									>
										{data.gk}
									</text>
									<text
										x={svgWidth / 2}
										y={svgHeight / 2 + 10}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="10"
									>
										{gkPercentOfTotal.toFixed(1)}%
									</text>
								</>
							)}
						</svg>
					</div>
				</div>
			);

		case "defensive-record":
			if (!data) return null;
			return (
				<div style={{ width: "100%", textAlign: "center", color: "#fff" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Defensive Record</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
						<div>
							<div style={{ fontSize: "36px", fontWeight: "bold", color: "#f9ed32" }}>{data.cleanSheets || 0}</div>
							<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)" }}>Clean Sheets</div>
						</div>
						<div>
							<div style={{ fontSize: "36px", fontWeight: "bold", color: "#f9ed32" }}>{data.conceded || 0}</div>
							<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)" }}>Goals Conceded</div>
						</div>
					</div>
				</div>
			);

		case "card-stats":
			if (!data) return null;
			const yellowCount = data.yellowCards || 0;
			const redCount = data.redCards || 0;
			const maxValue = Math.max(yellowCount, redCount, 1);
			const maxHeight = 90;
			const minHeight = 10;
			const cardWidth = 80;
			const spacing = 40;
			const textOffset = 30;
			const centerX = 200;
			const yellowRectX = centerX - cardWidth - spacing / 2;
			const redRectX = centerX + spacing / 2;
			const containerCenterY = 54;
			const baseY = 98;
			
			const yellowHeight = yellowCount === 0 ? minHeight : Math.max(minHeight, (yellowCount / maxValue) * maxHeight);
			const redHeight = redCount === 0 ? 1 : Math.max(minHeight, (redCount / maxValue) * maxHeight);
			
			return (
				<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px", color: "#fff" }}>Card Stats</div>
					<div style={{ width: "100%", height: "300px", display: "flex", alignItems: "center", justifyContent: "center" }}>
						<svg width="100%" height="108px" viewBox="0 0 400 108" preserveAspectRatio="xMidYMid meet" style={{ maxWidth: "600px" }}>
							{/* Yellow Card Text - Left of rectangle, vertically centered */}
							<text
								x={yellowRectX - textOffset}
								y={containerCenterY - 6}
								textAnchor="end"
								dominantBaseline="middle"
								fill="#ffffff"
								fontSize="24"
								fontWeight="bold"
							>
								{yellowCount}
							</text>
							<text
								x={yellowRectX - textOffset}
								y={containerCenterY + 16}
								textAnchor="end"
								dominantBaseline="middle"
								fill="#ffffff"
								fontSize="14"
							>
								Yellows
							</text>
							
							{/* Yellow Card Rectangle */}
							<rect
								x={yellowRectX}
								y={baseY - yellowHeight}
								width={cardWidth}
								height={yellowHeight}
								fill="#f9ed32"
								opacity={0.9}
								rx="4"
							/>
							
							{/* Red Card Text - Right of rectangle, vertically centered */}
							<text
								x={redRectX + cardWidth + textOffset}
								y={containerCenterY - 6}
								textAnchor="start"
								dominantBaseline="middle"
								fill="#ffffff"
								fontSize="24"
								fontWeight="bold"
							>
								{redCount}
							</text>
							<text
								x={redRectX + cardWidth + textOffset}
								y={containerCenterY + 16}
								textAnchor="start"
								dominantBaseline="middle"
								fill="#ffffff"
								fontSize="14"
							>
								Reds
							</text>
							
							{/* Red Card Rectangle */}
							<rect
								x={redRectX}
								y={baseY - redHeight}
								width={cardWidth}
								height={redHeight}
								fill="#ef4444"
								opacity={0.9}
								rx="4"
							/>
						</svg>
					</div>
				</div>
			);

		case "penalty-stats":
			if (!data) return null;
			return (
				<div style={{ width: "100%", textAlign: "center", color: "#fff" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Penalty Stats</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
						<div>
							<div style={{ fontSize: "32px", fontWeight: "bold", color: "#22c55e" }}>{data.scored || 0}</div>
							<div style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>Scored</div>
						</div>
						<div>
							<div style={{ fontSize: "32px", fontWeight: "bold", color: "#ef4444" }}>{data.missed || 0}</div>
							<div style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>Missed</div>
						</div>
						<div>
							<div style={{ fontSize: "32px", fontWeight: "bold", color: "#60a5fa" }}>{data.saved || 0}</div>
							<div style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>Saved</div>
						</div>
						<div>
							<div style={{ fontSize: "32px", fontWeight: "bold", color: "#f97316" }}>{data.conceded || 0}</div>
							<div style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>Conceded</div>
						</div>
					</div>
				</div>
			);

		case "fantasy-points":
			if (!data || !data.totalPoints) return null;
			return (
				<div style={{ width: "100%", textAlign: "center", color: "#fff" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "10px" }}>Fantasy Points</div>
					<div style={{ fontSize: "48px", fontWeight: "bold", color: "#f9ed32", marginBottom: "20px" }}>
						{Math.round(data.totalPoints)}
					</div>
					{data.highestWeek && (
						<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)" }}>
							Best Week: {data.highestWeek.points} pts
						</div>
					)}
				</div>
			);

		case "distance-travelled":
			if (!data || !data.distance) return null;
			const UK_LENGTH = 600;
			const EUROPE_LENGTH = 3411;
			const EARTH_CIRCUMFERENCE = 24901;
			const distance = data.distance;
			
			let mapImage: string;
			let comparisonText: string;
			
			if (distance < 1200) {
				const percentage = (distance / UK_LENGTH) * 100;
				mapImage = '/stat-images/uk-map.svg';
				comparisonText = `${percentage.toFixed(1)}% of the length of the UK`;
			} else if (distance < 6400) {
				const times = distance / EUROPE_LENGTH;
				mapImage = '/stat-images/europe-map.svg';
				comparisonText = `${times.toFixed(2)} times the length of Europe`;
			} else {
				const times = distance / EARTH_CIRCUMFERENCE;
				mapImage = '/stat-images/world-map.svg';
				comparisonText = `${times.toFixed(2)} times around the Earth`;
			}
			
			return (
				<div style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px", color: "#fff" }}>Distance Travelled</div>
					<div style={{ width: "100%", height: "280px", position: "relative", borderRadius: "8px", overflow: "hidden" }}>
						<img
							src={`${typeof window !== 'undefined' ? window.location.origin : ''}${mapImage}`}
							alt="Map"
							style={{
								width: "100%",
								height: "100%",
								objectFit: "contain",
								filter: "brightness(0) invert(1)",
								opacity: 0.3,
							}}
							crossOrigin="anonymous"
							loading="eager"
						/>
						<div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", zIndex: 10 }}>
							<div style={{ fontSize: "48px", fontWeight: "bold", color: "#f9ed32", marginBottom: "10px" }}>
								{distance.toLocaleString()} miles
							</div>
							<div style={{ fontSize: "18px", color: "rgba(255,255,255,0.9)", marginBottom: "10px" }}>
								{data.awayGames} away games
							</div>
							<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)" }}>
								{comparisonText}
							</div>
						</div>
					</div>
				</div>
			);

		case "minutes-per-stats":
			if (!data) return null;
			return (
				<div style={{ width: "100%", textAlign: "center", color: "#fff" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Minutes per Stats</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "15px", fontSize: "14px" }}>
						{data.minutesPerGoal > 0 && (
							<div>
								<div style={{ fontSize: "28px", fontWeight: "bold", color: "#f9ed32" }}>
									{Math.round(data.minutesPerGoal).toLocaleString()}
								</div>
								<div style={{ color: "rgba(255,255,255,0.8)" }}>per Goal</div>
							</div>
						)}
						{data.minutesPerAssist > 0 && (
							<div>
								<div style={{ fontSize: "28px", fontWeight: "bold", color: "#f9ed32" }}>
									{Math.round(data.minutesPerAssist).toLocaleString()}
								</div>
								<div style={{ color: "rgba(255,255,255,0.8)" }}>per Assist</div>
							</div>
						)}
						{data.minutesPerMoM > 0 && (
							<div>
								<div style={{ fontSize: "28px", fontWeight: "bold", color: "#f9ed32" }}>
									{Math.round(data.minutesPerMoM).toLocaleString()}
								</div>
								<div style={{ color: "rgba(255,255,255,0.8)" }}>per MoM</div>
							</div>
						)}
						{data.minutesPerCleanSheet > 0 && (
							<div>
								<div style={{ fontSize: "28px", fontWeight: "bold", color: "#f9ed32" }}>
									{Math.round(data.minutesPerCleanSheet).toLocaleString()}
								</div>
								<div style={{ color: "rgba(255,255,255,0.8)" }}>per Clean Sheet</div>
							</div>
						)}
					</div>
				</div>
			);

		case "game-details":
			if (!data) return null;
			return (
				<div style={{ width: "100%", textAlign: "center", color: "#fff" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Game Details</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "15px", fontSize: "14px" }}>
						<div>
							<div style={{ fontSize: "32px", fontWeight: "bold", color: "#f9ed32" }}>{data.uniqueOpponents || 0}</div>
							<div style={{ color: "rgba(255,255,255,0.8)" }}>Opponents</div>
						</div>
						<div>
							<div style={{ fontSize: "32px", fontWeight: "bold", color: "#f9ed32" }}>{data.uniqueCompetitions || 0}</div>
							<div style={{ color: "rgba(255,255,255,0.8)" }}>Competitions</div>
						</div>
						<div>
							<div style={{ fontSize: "32px", fontWeight: "bold", color: "#f9ed32" }}>{data.uniqueTeammates || 0}</div>
							<div style={{ color: "rgba(255,255,255,0.8)" }}>Teammates</div>
						</div>
					</div>
				</div>
			);

		default:
			return null;
	}
}

export default function ShareableStatsCard({
	playerName,
	playerData,
	playerFilters,
	filterData,
	selectedVisualization,
}: ShareableStatsCardProps) {
	const filterSummary = formatFilterSummary(playerFilters, filterData);

	// Key stats to display
	const keyStats = [
		{
			key: "APP",
			label: "Apps",
			value: toNumber(playerData.appearances),
			icon: statObject.APP?.iconName || "Appearance-Icon",
		},
		{
			key: "MIN",
			label: "Minutes",
			value: toNumber(playerData.minutes),
			icon: statObject.MIN?.iconName || "Appearance-Icon",
			format: (val: number) => Math.round(val).toLocaleString(),
		},
		{
			key: "AllGSC",
			label: "Goals",
			value: toNumber(playerData.allGoalsScored),
			icon: statObject.AllGSC?.iconName || "Appearance-Icon",
		},
		{
			key: "A",
			label: "Assists",
			value: toNumber(playerData.assists),
			icon: statObject.A?.iconName || "Appearance-Icon",
		},
		{
			key: "MOM",
			label: "MoM",
			value: toNumber(playerData.mom),
			icon: statObject.MOM?.iconName || "Appearance-Icon",
		},
	];

	return (
		<div
			className="shareable-stats-card"
			style={{
				width: "1080px",
				height: "1080px",
				backgroundColor: "#0f0f0f",
				position: "relative",
				overflow: "hidden",
				fontFamily: "system-ui, -apple-system, sans-serif",
				boxSizing: "border-box",
			}}>
			{/* Background gradient overlay */}
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: "linear-gradient(135deg, rgba(249, 237, 50, 0.1) 0%, rgba(249, 237, 50, 0.05) 50%, transparent 100%)",
					pointerEvents: "none",
				}}
			/>

			{/* Logo in top right corner */}
			<div
				style={{
					position: "absolute",
					top: "30px",
					right: "30px",
					zIndex: 2,
					transform: "rotate(-15deg)",
					opacity: 0.15,
				}}>
				<img
					src={`${typeof window !== 'undefined' ? window.location.origin : ''}/icons/icon-512x512.png`}
					alt="Dorkinians FC Logo"
					style={{
						width: "400px",
						height: "400px",
						filter: "brightness(0) invert(1)",
						objectFit: "contain",
					}}
					crossOrigin="anonymous"
					loading="eager"
				/>
			</div>

			{/* Content */}
			<div
				style={{
					position: "relative",
					zIndex: 1,
					padding: "50px",
					height: "100%",
					display: "flex",
					flexDirection: "column",
				}}>
				{/* Header */}
				<div style={{ flexShrink: 0 }}>
					{/* Player Name */}
					<h1
						style={{
							fontSize: "64px",
							fontWeight: "bold",
							color: "#f9ed32",
							margin: "0 0 16px 0",
							lineHeight: "1.1",
						}}>
						{playerName}
					</h1>

					{/* Filter Summary */}
					<div
						style={{
							fontSize: "20px",
							color: "rgba(255, 255, 255, 0.7)",
							marginBottom: "30px",
							lineHeight: "1.4",
						}}>
						{filterSummary}
					</div>
				</div>

				{/* Selected Visualization - Fixed height to keep stats in same position */}
				<div
					style={{
						height: "380px",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						marginBottom: "20px",
					}}>
					{selectedVisualization ? renderVisualization(selectedVisualization) : <div />}
				</div>

				{/* Stats Grid */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(5, 1fr)",
						gap: "30px",
						marginTop: "0",
						marginBottom: "20px",
						flexShrink: 0,
					}}>
					{keyStats.map((stat) => (
						<div
							key={stat.key}
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: "16px",
							}}>
							{/* Icon */}
							<div
								style={{
									width: "70px",
									height: "70px",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									backgroundColor: "rgba(249, 237, 50, 0.1)",
									borderRadius: "12px",
									border: "2px solid rgba(249, 237, 50, 0.3)",
								}}>
								<img
									src={`${typeof window !== 'undefined' ? window.location.origin : ''}/stat-icons/${stat.icon}.svg`}
									alt={stat.label}
									style={{
										width: "42px",
										height: "42px",
										filter: "brightness(0) invert(1)",
										objectFit: "contain",
									}}
									crossOrigin="anonymous"
									loading="eager"
									onError={(e) => {
										// Hide icon if it fails to load
										(e.target as HTMLImageElement).style.display = "none";
									}}
								/>
							</div>

							{/* Value */}
							<div
								style={{
									fontSize: "42px",
									fontWeight: "bold",
									color: "#ffffff",
									textAlign: "center",
									lineHeight: "1",
								}}>
								{stat.format ? stat.format(stat.value) : stat.value.toLocaleString()}
							</div>

							{/* Label */}
							<div
								style={{
									fontSize: "18px",
									color: "rgba(255, 255, 255, 0.8)",
									textAlign: "center",
									fontWeight: "500",
								}}>
								{stat.label}
							</div>
						</div>
					))}
				</div>

				{/* Footer */}
				<div
					style={{
						paddingTop: "20px",
						borderTop: "2px solid rgba(249, 237, 50, 0.3)",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}>
					<div
						style={{
							fontSize: "24px",
							fontWeight: "bold",
							color: "#f9ed32",
						}}>
						Dorkinians FC
					</div>
					<div
						style={{
							fontSize: "18px",
							color: "rgba(255, 255, 255, 0.6)",
						}}>
						dorkiniansfcstats.co.uk
					</div>
				</div>
			</div>
		</div>
	);
}

