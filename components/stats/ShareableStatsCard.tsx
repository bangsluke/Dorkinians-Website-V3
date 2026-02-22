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
	backgroundColor?: "yellow" | "green";
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

function getVisualizationTitle(type: string): string {
	const titles: Record<string, string> = {
		"all-games": "All Games",
		"seasonal-performance": "Seasonal Performance",
		"team-performance": "Team Performance",
		"match-results": "Match Results",
		"positional-stats": "Positional Stats",
		"defensive-record": "Defensive Record",
		"distance-travelled": "Distance Travelled",
		"fantasy-points": "Fantasy Points",
		"card-stats": "Card Stats",
		"penalty-stats": "Penalty Stats",
		"minutes-per-stats": "Minutes per Stats",
		"game-details": "Game Details",
	};
	return titles[type] || "Visualization";
}

function getVisualizationSubtitle(viz: { type: string; data?: any }): string | null {
	if (viz.type === "seasonal-performance" && viz.data?.selectedStat) {
		return viz.data.selectedStat;
	}
	if (viz.type === "team-performance" && viz.data?.selectedStat) {
		return viz.data.selectedStat;
	}
	return null;
}

function renderVisualization(viz: { type: string; data?: any }, accentColor: string = "#f9ed32", playerName: string = "") {
	const { type, data } = viz;

	switch (type) {
		case "seasonal-performance": {
			if (!data || !data.chartData || data.chartData.length === 0) return null;
			return (
				<div style={{ width: "100%", height: "300px" }}>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={data.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
							<XAxis dataKey="name" stroke="#fff" fontSize={14} />
							<YAxis stroke="#fff" fontSize={14} domain={[0, 'auto']} allowDecimals={false} />
							<Bar dataKey="value" fill={accentColor} radius={[4, 4, 0, 0]} opacity={0.9} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			);
		}

		case "team-performance": {
			if (!data || !data.chartData || data.chartData.length === 0) return null;
			return (
				<div style={{ width: "100%", height: "300px" }}>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={data.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
							<XAxis dataKey="name" stroke="#fff" fontSize={14} />
							<YAxis stroke="#fff" fontSize={14} domain={[0, 'auto']} allowDecimals={false} />
							<Bar dataKey="value" fill={accentColor} radius={[4, 4, 0, 0]} opacity={0.9} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			);
		}

		case "match-results": {
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
		}

		case "positional-stats": {
			if (!data) return null;
			const svgWidth = 127;
			const svgHeight = 87;
			const thirdWidth = svgWidth / 3;
			const totalPositionAppearances = (data.gk || 0) + (data.def || 0) + (data.mid || 0) + (data.fwd || 0);
			const positionalAppearances = data.appearances || totalPositionAppearances;
			const defPercentOfTotal = positionalAppearances > 0 ? ((data.def || 0) / positionalAppearances * 100) : 0;
			const midPercentOfTotal = positionalAppearances > 0 ? ((data.mid || 0) / positionalAppearances * 100) : 0;
			const fwdPercentOfTotal = positionalAppearances > 0 ? ((data.fwd || 0) / positionalAppearances * 100) : 0;
			const gkPercentOfTotal = positionalAppearances > 0 ? ((data.gk || 0) / positionalAppearances * 100) : 0;
			
			return (
				<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
					<div style={{ width: "100%", height: "200px", position: "relative", overflow: "hidden" }}>
						{/* Background SVG - horizontal pitch */}
						<div style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
							<img
								src={`${typeof window !== 'undefined' ? window.location.origin : ''}/stat-images/horizontal-pitch.svg`}
								alt="Football Pitch"
								style={{
									width: "100%",
									height: "100%",
									objectFit: "contain",
								}}
								crossOrigin="anonymous"
								loading="eager"
							/>
						</div>
						
						{/* Overlay boxes for each third */}
						<svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet" style={{ position: "relative", zIndex: 10 }}>
							{/* DEF - Left third */}
							<rect
								x="0"
								y="0"
								width={thirdWidth}
								height={svgHeight}
								fill="rgba(139, 69, 19, 0.3)"
								stroke="rgba(255, 255, 255, 0.5)"
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
								pointerEvents="none"
							>
								{data.def || 0}
							</text>
							<text
								x={thirdWidth / 2}
								y={svgHeight / 2 + 12}
								textAnchor="middle"
								dominantBaseline="middle"
								fill="#ffffff"
								fontSize="12"
								pointerEvents="none"
							>
								{defPercentOfTotal.toFixed(1)}%
							</text>
							
							{/* MID - Middle third */}
							<rect
								x={thirdWidth}
								y="0"
								width={thirdWidth}
								height={svgHeight}
								fill="rgba(144, 238, 144, 0.3)"
								stroke="rgba(255, 255, 255, 0.5)"
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
								pointerEvents="none"
							>
								{data.mid || 0}
							</text>
							<text
								x={thirdWidth + thirdWidth / 2}
								y={svgHeight / 2 + 12}
								textAnchor="middle"
								dominantBaseline="middle"
								fill="#ffffff"
								fontSize="12"
								pointerEvents="none"
							>
								{midPercentOfTotal.toFixed(1)}%
							</text>
							
							{/* FWD - Right third */}
							<rect
								x={thirdWidth * 2}
								y="0"
								width={thirdWidth}
								height={svgHeight}
								fill="rgba(64, 224, 208, 0.3)"
								stroke="rgba(255, 255, 255, 0.5)"
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
								pointerEvents="none"
							>
								{data.fwd || 0}
							</text>
							<text
								x={thirdWidth * 2 + thirdWidth / 2}
								y={svgHeight / 2 + 12}
								textAnchor="middle"
								dominantBaseline="middle"
								fill="#ffffff"
								fontSize="12"
								pointerEvents="none"
							>
								{fwdPercentOfTotal.toFixed(1)}%
							</text>
							
							{/* GK - Center circle (if applicable) */}
							{(data.gk || 0) > 0 && (
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
										pointerEvents="none"
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
										pointerEvents="none"
									>
										{gkPercentOfTotal.toFixed(1)}%
									</text>
								</>
							)}
						</svg>
					</div>
				</div>
			);
		}

		case "defensive-record": {
			if (!data) return null;
			const conceded = data.conceded || 0;
			const cleanSheets = data.cleanSheets || 0;
			const ownGoals = data.ownGoals || 0;
			const appearances = data.appearances || 0;
			const gk = data.gk || 0;
			const saves = data.saves || 0;
			const concededPerApp = data.concededPerApp || 0;
			
			const avgGoalsConcededPerGame = appearances > 0 ? (conceded / appearances) : 0;
			const gamesPerCleanSheet = cleanSheets > 0 ? (appearances / cleanSheets) : 0;
			const sectionHeight = gk > 0 ? 340 : 260;
			
			return (
				<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
					<div style={{ width: "100%", position: "relative", height: `${sectionHeight}px`, overflow: "hidden", borderRadius: "0.5rem" }}>
						{/* Background Brick Wall */}
						<div style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: "0.5rem", overflow: "hidden" }}>
							<img
								src={`${typeof window !== 'undefined' ? window.location.origin : ''}/stat-images/brick-wall.jpg`}
								alt="Brick Wall"
								style={{
									width: "100%",
									height: "100%",
									objectFit: "cover",
									objectPosition: "center",
									transform: "scale(1.5)",
									transformOrigin: "center",
									borderRadius: "0.5rem",
								}}
								crossOrigin="anonymous"
								loading="eager"
							/>
						</div>
						
						{/* Content Overlay */}
						<div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "12px 16px" }}>
							<div style={{ backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)", borderRadius: "0.5rem", padding: "12px 16px" }}>
								<table style={{ width: "100%", color: "#fff", fontSize: "14px" }}>
									<thead>
										<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.2)" }}>
											<th style={{ textAlign: "left", padding: "8px", fontSize: "12px" }}>Stat</th>
											<th style={{ textAlign: "right", padding: "8px", fontSize: "12px" }}>Value</th>
										</tr>
									</thead>
									<tbody>
										<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
											<td style={{ padding: "8px", fontSize: "12px" }}>Goals Conceded</td>
											<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>{conceded}</td>
										</tr>
										<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
											<td style={{ padding: "8px", fontSize: "12px" }}>Clean Sheets</td>
											<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>{cleanSheets}</td>
										</tr>
										<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
											<td style={{ padding: "8px", fontSize: "12px" }}>Avg Goals Conceded/Game</td>
											<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
												{avgGoalsConcededPerGame > 0 ? avgGoalsConcededPerGame.toFixed(2) : "0.00"}
											</td>
										</tr>
										<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
											<td style={{ padding: "8px", fontSize: "12px" }}>Games per Clean Sheet</td>
											<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
												{gamesPerCleanSheet > 0 ? gamesPerCleanSheet.toFixed(1) : "N/A"}
											</td>
										</tr>
										<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
											<td style={{ padding: "8px", fontSize: "12px" }}>Own Goals</td>
											<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>{ownGoals}</td>
										</tr>
										{gk > 0 && (
											<>
												<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
													<td style={{ padding: "8px", fontSize: "12px" }}>GK Appearances</td>
													<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>{gk}</td>
												</tr>
												<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
													<td style={{ padding: "8px", fontSize: "12px" }}>GK Clean Sheets</td>
													<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
														{cleanSheets > 0 ? cleanSheets : 0}
													</td>
												</tr>
												<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
													<td style={{ padding: "8px", fontSize: "12px" }}>Saves</td>
													<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>{saves}</td>
												</tr>
												<tr>
													<td style={{ padding: "8px", fontSize: "12px" }}>Conceded per Appearance</td>
													<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
														{concededPerApp > 0 ? concededPerApp.toFixed(2) : "0.00"}
													</td>
												</tr>
											</>
										)}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			);
		}

		case "card-stats": {
			if (!data) return null;
			const yellowCount = data.yellowCards || 0;
			const redCount = data.redCards || 0;
			const cardMaxValue = Math.max(yellowCount, redCount, 1);
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
			
			const yellowHeight = yellowCount === 0 ? minHeight : Math.max(minHeight, (yellowCount / cardMaxValue) * maxHeight);
			const redHeight = redCount === 0 ? 1 : Math.max(minHeight, (redCount / cardMaxValue) * maxHeight);
			
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
		}

		case "penalty-stats": {
			if (!data) return null;
			const scored = data.scored || 0;
			const missed = data.missed || 0;
			const saved = data.saved || 0;
			const conceded = data.conceded || 0;
			const penaltyShootoutScored = data.penaltyShootoutScored || 0;
			const penaltyShootoutMissed = data.penaltyShootoutMissed || 0;
			const penaltyShootoutSaved = data.penaltyShootoutSaved || 0;
			
			// Calculate sizes (max size 120px, min size 30px)
			const penaltyMaxValue = Math.max(scored, missed, saved, conceded, penaltyShootoutScored, penaltyShootoutMissed, penaltyShootoutSaved, 1);
			const scoredSize = Math.max(30, Math.min(120, (scored / penaltyMaxValue) * 120));
			const missedSize = Math.max(30, Math.min(120, (missed / penaltyMaxValue) * 120));
			const savedSize = Math.max(30, Math.min(120, (saved / penaltyMaxValue) * 120));
			const concededWidth = Math.max(30, Math.min(150, (conceded / penaltyMaxValue) * 150));
			const concededHeight = Math.max(22.5, Math.min(60, (conceded / penaltyMaxValue) * 60));
			const penaltyShootoutScoredSize = Math.max(30, Math.min(120, (penaltyShootoutScored / penaltyMaxValue) * 120));
			const penaltyShootoutSavedSize = Math.max(30, Math.min(120, (penaltyShootoutSaved / penaltyMaxValue) * 120));
			const penaltyShootoutMissedSize = Math.max(30, Math.min(120, (penaltyShootoutMissed / penaltyMaxValue) * 120));
			
			// Goal dimensions
			const goalWidth = 200;
			const goalHeight = 120;
			const goalX = 150;
			const goalY = 50;
			
			// Center positions
			const goalCenterX = goalX + goalWidth / 2;
			const goalCenterY = goalY + goalHeight / 2;
			
			return (
				<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
					<div style={{ width: "100%", position: "relative", height: "200px", overflow: "hidden" }}>
						{/* Background SVG from TOTW */}
						<div style={{ position: "absolute", inset: 0, width: "100%", top: "30px", bottom: "40px" }}>
							<img
								src={`${typeof window !== 'undefined' ? window.location.origin : ''}/totw-images/TOTWBackground.svg`}
								alt="Football Pitch"
								style={{
									width: "100%",
									height: "100%",
									objectFit: "cover",
									objectPosition: "center top",
									transform: "scale(4)",
									transformOrigin: "center top",
								}}
								crossOrigin="anonymous"
								loading="eager"
							/>
						</div>
						
						<svg width="100%" height="300" viewBox="0 0 500 300" preserveAspectRatio="xMidYMid meet" style={{ position: "relative", zIndex: 10 }}>
							{/* Green circle - Scored */}
							{scored > 0 && (
								<g>
									<circle
										cx={goalCenterX - 75}
										cy={goalCenterY - 60}
										r={scoredSize / 2}
										fill="#22c55e"
										opacity={0.8}
									/>
									<text
										x={goalCenterX - 75}
										y={goalCenterY - 60}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="24"
										fontWeight="bold"
										pointerEvents="none"
									>
										{scored}
									</text>
								</g>
							)}
							
							{/* Blue circle - Saved */}
							{saved > 0 && (
								<g>
									<circle
										cx={goalCenterX + 70}
										cy={goalCenterY - 60}
										r={savedSize / 2}
										fill="#60a5fa"
										opacity={0.8}
									/>
									<text
										x={goalCenterX + 70}
										y={goalCenterY - 60}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="20"
										fontWeight="bold"
										pointerEvents="none"
									>
										{saved}
									</text>
								</g>
							)}
							
							{/* Dark blue circle - Penalty Shootout Saved */}
							{penaltyShootoutSaved > 0 && (
								<g>
									<circle
										cx={goalCenterX + 50}
										cy={goalCenterY - 60}
										r={penaltyShootoutSavedSize / 2}
										fill="#1e40af"
										opacity={0.8}
									/>
									<text
										x={goalCenterX + 50}
										y={goalCenterY - 60}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="20"
										fontWeight="bold"
										pointerEvents="none"
									>
										{penaltyShootoutSaved}
									</text>
								</g>
							)}
							
							{/* Red circle - Missed */}
							{missed > 0 && (
								<g>
									<circle
										cx={goalX + goalWidth + 50 + missedSize / 2 + 10}
										cy={goalCenterY - 130}
										r={missedSize / 2}
										fill="#ef4444"
										opacity={0.8}
									/>
									<text
										x={goalX + goalWidth + 50 + missedSize / 2 + 10}
										y={goalCenterY - 130}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="24"
										fontWeight="bold"
										pointerEvents="none"
									>
										{missed}
									</text>
								</g>
							)}
							
							{/* Dark red circle - Penalty Shootout Missed */}
							{penaltyShootoutMissed > 0 && (
								<g>
									<circle
										cx={goalX - 50 - penaltyShootoutMissedSize / 2 - 10}
										cy={goalCenterY - 140}
										r={penaltyShootoutMissedSize / 2}
										fill="#991b1b"
										opacity={0.8}
									/>
									<text
										x={goalX - 50 - penaltyShootoutMissedSize / 2 - 10}
										y={goalCenterY - 140}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="24"
										fontWeight="bold"
										pointerEvents="none"
									>
										{penaltyShootoutMissed}
									</text>
								</g>
							)}
							
							{/* Orange ellipse - Conceded */}
							{conceded > 0 && (
								<g>
									<ellipse
										cx={goalCenterX - 120}
										cy={goalY + goalHeight + 30 + concededHeight / 2 - 10}
										rx={concededWidth / 2}
										ry={concededHeight / 2}
										fill="#f97316"
										opacity={0.8}
									/>
									<text
										x={goalCenterX - 120}
										y={goalY + goalHeight + 30 + concededHeight / 2 - 10}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="20"
										fontWeight="bold"
										pointerEvents="none"
									>
										{conceded}
									</text>
								</g>
							)}
							
							{/* Dark green circle - Penalty Shootout Scored */}
							{penaltyShootoutScored > 0 && (
								<g>
									<circle
										cx={goalCenterX - 110}
										cy={goalCenterY - 60}
										r={penaltyShootoutScoredSize / 2}
										fill="#15803d"
										opacity={0.8}
									/>
									<text
										x={goalCenterX - 110}
										y={goalCenterY - 60}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="#ffffff"
										fontSize="24"
										fontWeight="bold"
										pointerEvents="none"
									>
										{penaltyShootoutScored}
									</text>
								</g>
							)}
						</svg>
					</div>
				</div>
			);
		}

		case "fantasy-points": {
			if (!data || !data.totalPoints) return null;
			const breakdownEntries = data.breakdown ? Object.entries(data.breakdown)
				.map(([stat, points]) => ({
					stat,
					points: points as number,
					value: data.breakdownValues?.[stat] || 0
				}))
				.filter((entry) => entry.points !== 0)
				.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)) : [];
			
			return (
				<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff" }}>
					{/* Player Name and Total Score Display - Kit and info side by side */}
					<div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", marginBottom: "16px" }}>
						{/* Kit Image */}
						<div style={{ position: "relative", width: "56px", height: "72px", flexShrink: 0 }}>
							<img
								src={`${typeof window !== 'undefined' ? window.location.origin : ''}/totw-images/Kit.svg`}
								alt="Player Kit"
								style={{
									width: "100%",
									height: "100%",
									objectFit: "contain",
								}}
								crossOrigin="anonymous"
								loading="eager"
							/>
						</div>
						{/* Player name and score */}
						<div style={{ textAlign: "center" }}>
							<p style={{ fontSize: "14px", fontWeight: "500", marginBottom: "4px", color: "#fff" }}>{playerName}</p>
							<p style={{ fontSize: "32px", fontWeight: "bold", color: "#fff", lineHeight: "1" }}>
								{Math.round(data.totalPoints || 0)}
							</p>
						</div>
					</div>

					{/* Breakdown Table */}
					{breakdownEntries.length > 0 && (
						<div style={{ width: "100%", marginTop: "16px" }}>
							<h4 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px", color: "#fff" }}>Total Points Breakdown</h4>
							<div style={{ overflowX: "auto" }}>
								<table style={{ width: "100%", color: "#fff", fontSize: "12px" }}>
									<thead>
										<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.2)" }}>
											<th style={{ textAlign: "left", padding: "8px", fontSize: "12px" }}>Stat</th>
											<th style={{ textAlign: "center", padding: "8px", fontSize: "12px" }}>Value</th>
											<th style={{ textAlign: "right", padding: "8px", fontSize: "12px" }}>Points</th>
										</tr>
									</thead>
									<tbody>
										{breakdownEntries.map((entry, index) => (
											<tr key={index} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
												<td style={{ padding: "8px", fontSize: "12px" }}>{entry.stat}</td>
												<td style={{ textAlign: "center", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
													{Math.round(entry.value).toLocaleString()}
												</td>
												<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
													{entry.points > 0 ? "+" : ""}{entry.points.toLocaleString()}
												</td>
											</tr>
										))}
										<tr style={{ borderTop: "2px solid " + accentColor, fontWeight: "bold" }}>
											<td style={{ padding: "8px", fontSize: "12px" }}>Total</td>
											<td style={{ textAlign: "center", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}></td>
											<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
												{Math.round(data.totalPoints || 0).toLocaleString()}
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>
					)}
				</div>
			);
		}

		case "distance-travelled": {
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
					<div style={{ width: "100%", position: "relative", height: "210px", overflow: "hidden", borderRadius: "0.5rem" }}>
						{/* Background Map Image */}
						<div style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: "0.5rem", overflow: "hidden" }}>
							<img
								src={`${typeof window !== 'undefined' ? window.location.origin : ''}${mapImage}`}
								alt={distance < 1200 ? "UK Map" : distance < 6400 ? "Europe Map" : "World Map"}
								style={{
									width: "100%",
									height: "100%",
									objectFit: "contain",
									filter: "brightness(0) invert(1)",
									borderRadius: "0.5rem",
								}}
								crossOrigin="anonymous"
								loading="eager"
							/>
						</div>
						
						{/* Content Overlay */}
						<div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", zIndex: 10, width: "100%", padding: "0 20px" }}>
							<div style={{ fontSize: "36px", fontWeight: "bold", color: accentColor, marginBottom: "8px" }}>
								{distance.toLocaleString()} miles
							</div>
							<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.9)", marginBottom: "8px" }}>
								{data.awayGames || 0} away games
							</div>
							<div style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>
								{comparisonText}
							</div>
						</div>
					</div>
				</div>
			);
		}

		case "minutes-per-stats": {
			if (!data) return null;
			return (
				<div style={{ width: "100%", textAlign: "center", color: "#fff" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Minutes per Stats</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "15px", fontSize: "14px" }}>
						{data.minutesPerGoal > 0 && (
							<div>
								<div style={{ fontSize: "28px", fontWeight: "bold", color: accentColor }}>
									{Math.round(data.minutesPerGoal).toLocaleString()}
								</div>
								<div style={{ color: "rgba(255,255,255,0.8)" }}>per Goal</div>
							</div>
						)}
						{data.minutesPerAssist > 0 && (
							<div>
								<div style={{ fontSize: "28px", fontWeight: "bold", color: accentColor }}>
									{Math.round(data.minutesPerAssist).toLocaleString()}
								</div>
								<div style={{ color: "rgba(255,255,255,0.8)" }}>per Assist</div>
							</div>
						)}
						{data.minutesPerMoM > 0 && (
							<div>
								<div style={{ fontSize: "28px", fontWeight: "bold", color: accentColor }}>
									{Math.round(data.minutesPerMoM).toLocaleString()}
								</div>
								<div style={{ color: "rgba(255,255,255,0.8)" }}>per MoM</div>
							</div>
						)}
						{data.minutesPerCleanSheet > 0 && (
							<div>
								<div style={{ fontSize: "28px", fontWeight: "bold", color: accentColor }}>
									{Math.round(data.minutesPerCleanSheet).toLocaleString()}
								</div>
								<div style={{ color: "rgba(255,255,255,0.8)" }}>per Clean Sheet</div>
							</div>
						)}
					</div>
				</div>
			);
		}

		case "game-details": {
			if (!data) return null;
			const leagueGames = data.leagueGames || 0;
			const cupGames = data.cupGames || 0;
			const friendlyGames = data.friendlyGames || 0;
			const leagueWins = data.leagueWins || 0;
			const cupWins = data.cupWins || 0;
			const friendlyWins = data.friendlyWins || 0;
			const homeGames = data.homeGames || 0;
			const awayGames = data.awayGames || 0;
			const homeWins = data.homeWins || 0;
			const awayWins = data.awayWins || 0;
			const uniqueOpponents = data.uniqueOpponents || 0;
			const uniqueCompetitions = data.uniqueCompetitions || 0;
			const uniqueTeammates = data.uniqueTeammates || 0;
			
			return (
				<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff" }}>
					{/* CompType Table */}
					<div style={{ width: "100%", marginBottom: "24px" }}>
						<table style={{ width: "100%", color: "#fff", fontSize: "12px" }}>
							<thead>
								<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.2)" }}>
									<th style={{ textAlign: "left", padding: "8px", fontSize: "12px" }}>Type</th>
									<th style={{ textAlign: "right", padding: "8px", fontSize: "12px" }}>Count</th>
									<th style={{ textAlign: "right", padding: "8px", fontSize: "12px" }}>% Won</th>
								</tr>
							</thead>
							<tbody>
								<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
									<td style={{ padding: "8px", fontSize: "12px" }}>
										<span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "500", marginRight: "8px", backgroundColor: "rgba(59, 130, 246, 0.3)", color: "#93c5fd" }}>League</span>
									</td>
									<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>{leagueGames}</td>
									<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
										{leagueGames > 0 ? ((leagueWins / leagueGames * 100).toFixed(1) + "%") : "0.0%"}
									</td>
								</tr>
								<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
									<td style={{ padding: "8px", fontSize: "12px" }}>
										<span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "500", marginRight: "8px", backgroundColor: "rgba(168, 85, 247, 0.3)", color: "#c4b5fd" }}>Cup</span>
									</td>
									<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>{cupGames}</td>
									<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
										{cupGames > 0 ? ((cupWins / cupGames * 100).toFixed(1) + "%") : "0.0%"}
									</td>
								</tr>
								<tr>
									<td style={{ padding: "8px", fontSize: "12px" }}>
										<span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "500", marginRight: "8px", backgroundColor: "rgba(34, 197, 94, 0.3)", color: "#86efac" }}>Friendly</span>
									</td>
									<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>{friendlyGames}</td>
									<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
										{friendlyGames > 0 ? ((friendlyWins / friendlyGames * 100).toFixed(1) + "%") : "0.0%"}
									</td>
								</tr>
							</tbody>
						</table>
					</div>

					{/* Home/Away Table */}
					<div style={{ width: "100%", marginBottom: "24px" }}>
						<table style={{ width: "100%", color: "#fff", fontSize: "12px" }}>
							<thead>
								<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.2)" }}>
									<th style={{ textAlign: "left", padding: "8px", fontSize: "12px" }}>Location</th>
									<th style={{ textAlign: "right", padding: "8px", fontSize: "12px" }}>Count</th>
									<th style={{ textAlign: "right", padding: "8px", fontSize: "12px" }}>% Won</th>
								</tr>
							</thead>
							<tbody>
								<tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
									<td style={{ padding: "8px", fontSize: "12px" }}>
										<span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "500", marginRight: "8px", backgroundColor: "rgba(249, 237, 50, 0.2)", color: accentColor }}>Home</span>
									</td>
									<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>{homeGames}</td>
									<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
										{homeGames > 0 ? ((homeWins / homeGames * 100).toFixed(1) + "%") : "0.0%"}
									</td>
								</tr>
								<tr>
									<td style={{ padding: "8px", fontSize: "12px" }}>
										<span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "500", marginRight: "8px", backgroundColor: "rgba(107, 114, 128, 0.3)", color: "#d1d5db" }}>Away</span>
									</td>
									<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>{awayGames}</td>
									<td style={{ textAlign: "right", padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
										{awayGames > 0 ? ((awayWins / awayGames * 100).toFixed(1) + "%") : "0.0%"}
									</td>
								</tr>
							</tbody>
						</table>
					</div>

					{/* Unique Counts */}
					<div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
						<p style={{ fontSize: "12px", color: "#fff" }}>
							<span style={{ color: "#fff" }}>Opposition played against: </span>
							<span style={{ fontFamily: "monospace", fontWeight: "bold" }}>{uniqueOpponents}</span>
						</p>
						<p style={{ fontSize: "12px", color: "#fff" }}>
							<span style={{ color: "#fff" }}>Competitions competed in: </span>
							<span style={{ fontFamily: "monospace", fontWeight: "bold" }}>{uniqueCompetitions}</span>
						</p>
						<p style={{ fontSize: "12px", color: "#fff" }}>
							<span style={{ color: "#fff" }}>Teammates played with: </span>
							<span style={{ fontFamily: "monospace", fontWeight: "bold" }}>{uniqueTeammates}</span>
						</p>
					</div>
				</div>
			);
		}

		case "monthly-performance": {
			if (!data || !data.chartData || data.chartData.length === 0) return null;
			return (
				<div style={{ width: "100%", height: "300px" }}>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={data.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
							<XAxis dataKey="name" stroke="#fff" fontSize={14} />
							<YAxis stroke="#fff" fontSize={14} domain={[0, 'auto']} allowDecimals={false} />
							<Bar dataKey="value" fill={accentColor} radius={[4, 4, 0, 0]} opacity={0.9} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			);
		}

		case "awards-and-achievements": {
			if (!data) return null;
			const awards = data.awards || [];
			const playerOfMonthCount = data.playerOfMonthCount || 0;
			const starManCount = data.starManCount || 0;
			const totwCount = data.totwCount || 0;
			
			return (
				<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", padding: "20px" }}>
					<h3 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "20px", color: "#fff" }}>Awards and Achievements</h3>
					
					{/* Awards List */}
					{awards.length > 0 && (
						<div style={{ width: "100%", marginBottom: "20px" }}>
							<h4 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "#fff" }}>Awards</h4>
							<div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
								{awards.map((award: any, index: number) => (
									<div key={index} style={{ fontSize: "12px", color: "#fff" }}>
										<span style={{ color: accentColor, fontWeight: "500" }}>{award.awardName}</span>
										{award.season && <span style={{ color: "rgba(255, 255, 255, 0.7)", marginLeft: "8px" }}>({award.season})</span>}
									</div>
								))}
							</div>
						</div>
					)}
					
					{/* TOTW Count */}
					<div style={{ width: "100%", paddingTop: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.1)", marginBottom: "12px" }}>
						<p style={{ fontSize: "12px", color: "#fff" }}>
							<span style={{ color: "rgba(255, 255, 255, 0.7)" }}>Number of times in TOTW: </span>
							<span style={{ fontFamily: "monospace", fontWeight: "bold", color: accentColor }}>{totwCount}</span>
						</p>
					</div>

					{/* Star Man Count */}
					<div style={{ width: "100%", marginBottom: "12px" }}>
						<p style={{ fontSize: "12px", color: "#fff" }}>
							<span style={{ color: "rgba(255, 255, 255, 0.7)" }}>Number of times as Star Man: </span>
							<span style={{ fontFamily: "monospace", fontWeight: "bold", color: accentColor }}>{starManCount}</span>
						</p>
					</div>

					{/* Player of the Month Count */}
					<div style={{ width: "100%" }}>
						<p style={{ fontSize: "12px", color: "#fff" }}>
							<span style={{ color: "rgba(255, 255, 255, 0.7)" }}>Number of times in Player of the Month: </span>
							<span style={{ fontFamily: "monospace", fontWeight: "bold", color: accentColor }}>{playerOfMonthCount}</span>
						</p>
					</div>

					{(!awards || awards.length === 0) && playerOfMonthCount === 0 && starManCount === 0 && totwCount === 0 && (
						<p style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.7)" }}>No awards or achievements recorded.</p>
					)}
				</div>
			);
		}

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
	backgroundColor = "yellow",
}: ShareableStatsCardProps) {
	const filterSummary = formatFilterSummary(playerFilters, filterData);
	
	// Color values based on background color selection
	const accentColor = backgroundColor === "green" ? "#1C8841" : "#f9ed32";
	const accentColorRgb = backgroundColor === "green" ? "28, 136, 65" : "249, 237, 50";
	const gradientStart = backgroundColor === "green" 
		? "rgba(28, 136, 65, 0.1)" 
		: "rgba(249, 237, 50, 0.1)";
	const gradientEnd = backgroundColor === "green"
		? "rgba(28, 136, 65, 0.05)"
		: "rgba(249, 237, 50, 0.05)";
	const borderColor = backgroundColor === "green"
		? "rgba(28, 136, 65, 0.3)"
		: "rgba(249, 237, 50, 0.3)";
	const iconBgColor = backgroundColor === "green"
		? "rgba(28, 136, 65, 0.1)"
		: "rgba(249, 237, 50, 0.1)";

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
					background: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 50%, transparent 100%)`,
					pointerEvents: "none",
				}}
			/>

			{/* Logo in top right corner */}
			<div
				style={{
					position: "absolute",
					top: "-50px",
					right: "-50px",
					zIndex: 2,
					transform: "rotate(-25deg)",
					opacity: 0.05,
				}}>
				<img
					src={`${typeof window !== 'undefined' ? window.location.origin : ''}/icons/icon-512x512.png`}
					alt="Dorkinians FC Logo"
					style={{
						width: "400px",
						height: "400px",
						filter: "grayscale(100%) brightness(0) invert(1)",
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
							color: accentColor,
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
						minHeight: "550px",
						height: "550px",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						marginBottom: "20px",
						flexShrink: 0,
					}}>
					{selectedVisualization ? (
						<>
							{/* Visualization Title */}
							<div style={{ width: "100%", marginBottom: "20px", textAlign: "center" }}>
								<h2 style={{ fontSize: "36px", fontWeight: "bold", color: accentColor, margin: "0 0 8px 0" }}>
									{getVisualizationTitle(selectedVisualization.type)}
								</h2>
								{getVisualizationSubtitle(selectedVisualization) && (
									<h3 style={{ fontSize: "24px", fontWeight: "500", color: "rgba(255, 255, 255, 0.8)", margin: "0" }}>
										{getVisualizationSubtitle(selectedVisualization)}
									</h3>
								)}
							</div>
							{renderVisualization(selectedVisualization, accentColor, playerName)}
						</>
					) : (
						<div />
					)}
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
									backgroundColor: iconBgColor,
									borderRadius: "12px",
									border: `2px solid ${borderColor}`,
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
						borderTop: `2px solid ${borderColor}`,
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}>
					<div
						style={{
							fontSize: "24px",
							fontWeight: "bold",
							color: accentColor,
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

